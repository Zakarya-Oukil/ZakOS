import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { notify } from '../notifications';
import { getRun, listRuns } from '../workflows/engine';
import { launchRun, parseLaunch, toBody } from '../workflows/launch';
import { getTemplate } from '../workflows/templates';
import { fail, handle, localOnly, osdb, str } from './common';

/**
 * Flows chain saved workflow templates. Each step says what to do after it: carry on, stop, or run again (a loop with a cap).
 * A step can also be skipped unless the one before it succeeded or failed, which gives conditions without a scripting language.
 */
export type When = 'always' | 'previous-done' | 'previous-failed';
export type OnFail = 'stop' | 'continue' | 'retry';

export interface Step {
  templateId: string;
  when: When;
  onFail: OnFail;
  /** Extra attempts when onFail is retry, 1 to 5. */
  retries: number;
}

export interface Flow {
  id: string;
  name: string;
  steps: Step[];
  created: number;
}

interface StepLog {
  index: number;
  templateId: string;
  state: 'queued' | 'skipped' | 'running' | 'done' | 'error' | 'stopped';
  runIds: string[];
  note?: string;
}

interface FlowRun {
  id: string;
  flowId: string;
  started: number;
  ended: number | null;
  status: 'running' | 'done' | 'error' | 'stopped';
  steps: StepLog[];
}

osdb.exec(`
  CREATE TABLE IF NOT EXISTS flows (id TEXT PRIMARY KEY, name TEXT NOT NULL, steps TEXT NOT NULL, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS flow_runs (id TEXT PRIMARY KEY, flow_id TEXT NOT NULL, started INTEGER NOT NULL, ended INTEGER, status TEXT NOT NULL, steps TEXT NOT NULL);
`);

const WHENS: When[] = ['always', 'previous-done', 'previous-failed'];
const ONFAILS: OnFail[] = ['stop', 'continue', 'retry'];
const TERMINAL = new Set(['done', 'error', 'stopped']);

function cleanSteps(raw: unknown): Step[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 12) throw new Error('A flow needs 1 to 12 steps');
  return raw.map((s: Partial<Step>) => {
    if (typeof s.templateId !== 'string' || !getTemplate(s.templateId)) throw new Error('A step points at a workflow template that no longer exists');
    return {
      templateId: s.templateId,
      when: WHENS.includes(s.when as When) ? (s.when as When) : 'always',
      onFail: ONFAILS.includes(s.onFail as OnFail) ? (s.onFail as OnFail) : 'stop',
      retries: Math.min(5, Math.max(1, Math.round(Number(s.retries) || 1))),
    };
  });
}

const rowToFlow = (r: { id: string; name: string; steps: string; created: number }): Flow => ({ id: r.id, name: r.name, steps: JSON.parse(r.steps), created: r.created });
const getFlow = (id: string) => {
  const r = osdb.prepare('SELECT * FROM flows WHERE id = ?').get(id) as { id: string; name: string; steps: string; created: number } | undefined;
  return r ? rowToFlow(r) : undefined;
};

const live = new Map<string, FlowRun>();
const cancelled = new Set<string>();

function save(run: FlowRun) {
  osdb
    .prepare('INSERT INTO flow_runs(id, flow_id, started, ended, status, steps) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET ended=excluded.ended, status=excluded.status, steps=excluded.steps')
    .run(run.id, run.flowId, run.started, run.ended, run.status, JSON.stringify(run.steps));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits for one workflow run to finish. A plan waiting for approval keeps the flow waiting, up to two hours. */
async function waitFor(runId: string, flowRunId: string): Promise<'done' | 'error' | 'stopped'> {
  const deadline = Date.now() + 2 * 3_600_000;
  while (Date.now() < deadline) {
    if (cancelled.has(flowRunId)) return 'stopped';
    const r = getRun(runId);
    if (!r) return 'error';
    if (TERMINAL.has(r.status)) return r.status as 'done' | 'error' | 'stopped';
    await sleep(3000);
  }
  return 'error';
}

async function execute(flow: Flow, run: FlowRun, broadcast: (d: unknown) => void) {
  let previous: 'done' | 'error' | 'stopped' | null = null;
  try {
    for (let i = 0; i < flow.steps.length; i++) {
      const step = flow.steps[i];
      const log = run.steps[i];
      if (cancelled.has(run.id)) {
        log.state = 'stopped';
        break;
      }
      if ((step.when === 'previous-done' && previous !== 'done') || (step.when === 'previous-failed' && previous !== 'error')) {
        log.state = 'skipped';
        log.note = step.when === 'previous-done' ? 'Skipped: the step before did not succeed' : 'Skipped: the step before did not fail';
        save(run);
        continue;
      }
      const template = getTemplate(step.templateId);
      if (!template) {
        log.state = 'error';
        log.note = 'The template no longer exists';
        previous = 'error';
        if (step.onFail === 'stop') break;
        continue;
      }
      const attempts = step.onFail === 'retry' ? 1 + step.retries : 1;
      let outcome: 'done' | 'error' | 'stopped' = 'error';
      for (let a = 0; a < attempts; a++) {
        log.state = 'running';
        log.note = attempts > 1 ? `Attempt ${a + 1} of ${attempts}` : undefined;
        save(run);
        const parsed = await parseLaunch(toBody(template.input));
        if (!parsed.ok) {
          log.note = parsed.error;
          outcome = 'error';
          break;
        }
        try {
          const r = launchRun(parsed.input, broadcast);
          log.runIds.push(r.id);
          save(run);
          outcome = await waitFor(r.id, run.id);
        } catch (e) {
          log.note = e instanceof Error ? e.message : String(e);
          outcome = 'error';
          break;
        }
        if (outcome !== 'error') break;
      }
      log.state = outcome;
      previous = outcome;
      save(run);
      if (outcome === 'stopped') break;
      if (outcome === 'error' && step.onFail !== 'continue') break;
    }
    const failed = run.steps.some((s) => s.state === 'error') && !run.steps.some((s) => s.state === 'stopped');
    run.status = cancelled.has(run.id) || run.steps.some((s) => s.state === 'stopped') ? 'stopped' : failed ? 'error' : 'done';
  } catch (e) {
    run.status = 'error';
    console.error('[flows]', e instanceof Error ? e.message : e);
  } finally {
    run.ended = Date.now();
    save(run);
    live.delete(run.id);
    cancelled.delete(run.id);
    audit('flow', 'flows', `Flow ${flow.name} finished: ${run.status}`);
    notify(`Flow ${run.status === 'done' ? 'finished' : run.status}: ${flow.name}`, `${run.steps.filter((s) => s.state === 'done').length} of ${run.steps.length} steps done`, broadcast, { module: 'workflows', route: [] }, { native: false });
  }
}

export function mountFlowRoutes(app: Express, broadcast: (d: unknown) => void) {
  app.use('/api/flows', localOnly);

  /** What a workflow run has cost before, from the usage Claude reported for each run's sessions. */
  app.get('/api/flows/estimate', (_req: Request, res: Response) => {
    const costs: number[] = [];
    for (const r of listRuns().filter((x) => x.status === 'done' || x.status === 'error').slice(0, 20)) {
      const ids = [r.orchestratorSessionId, r.reviewerSessionId, ...r.tasks.map((t) => t.sessionId)].filter((x): x is string => !!x);
      if (ids.length === 0) continue;
      const row = osdb.prepare(`SELECT COALESCE(SUM(cost_usd),0) AS c FROM usage WHERE session_id IN (${ids.map(() => '?').join(',')})`).get(...ids) as { c: number };
      if (row.c > 0) costs.push(row.c);
    }
    if (costs.length === 0) return res.json({ success: true, samples: 0 });
    res.json({ success: true, samples: costs.length, avg: costs.reduce((a, b) => a + b, 0) / costs.length, min: Math.min(...costs), max: Math.max(...costs) });
  });

  app.get('/api/flows/run-cost', (req: Request, res: Response) => {
    const ids = String(req.query.ids ?? '').split(',').filter((x) => /^[0-9a-f-]{8,40}$/i.test(x)).slice(0, 40);
    if (ids.length === 0) return res.json({ success: true, cost: 0 });
    const row = osdb.prepare(`SELECT COALESCE(SUM(cost_usd),0) AS c FROM usage WHERE session_id IN (${ids.map(() => '?').join(',')})`).get(...ids) as { c: number };
    res.json({ success: true, cost: row.c });
  });

  app.get('/api/flows', (_req: Request, res: Response) => {
    const flows = (osdb.prepare('SELECT * FROM flows ORDER BY created DESC').all() as Array<{ id: string; name: string; steps: string; created: number }>).map(rowToFlow);
    const runs = (osdb.prepare('SELECT * FROM flow_runs ORDER BY started DESC LIMIT 30').all() as Array<{ id: string; flow_id: string; started: number; ended: number | null; status: string; steps: string }>).map((r) => ({
      id: r.id,
      flowId: r.flow_id,
      started: r.started,
      ended: r.ended,
      status: r.status,
      steps: JSON.parse(r.steps),
    }));
    res.json({ success: true, flows, runs });
  });

  app.post('/api/flows', handle((req, res) => {
    const name = (str(req.body?.name, 80) ?? '').trim();
    if (!name) return fail(res, 400, 'Name the flow');
    const steps = cleanSteps(req.body?.steps);
    const id = randomUUID();
    osdb.prepare('INSERT INTO flows(id, name, steps, created) VALUES(?,?,?,?)').run(id, name, JSON.stringify(steps), Date.now());
    audit('flow-create', 'owner', `Created flow ${name}`);
    res.status(201).json({ success: true, flow: getFlow(id) });
  }));

  app.put('/api/flows/:id', handle((req, res) => {
    const cur = getFlow(String(req.params.id));
    if (!cur) return fail(res, 404, 'Flow not found');
    const name = (str(req.body?.name, 80) ?? cur.name).trim() || cur.name;
    const steps = req.body?.steps === undefined ? cur.steps : cleanSteps(req.body.steps);
    osdb.prepare('UPDATE flows SET name = ?, steps = ? WHERE id = ?').run(name, JSON.stringify(steps), cur.id);
    res.json({ success: true, flow: getFlow(cur.id) });
  }));

  app.delete('/api/flows/:id', handle((req, res) => {
    osdb.prepare('DELETE FROM flows WHERE id = ?').run(String(req.params.id));
    res.json({ success: true });
  }));

  app.post('/api/flows/:id/run', handle((req, res) => {
    const flow = getFlow(String(req.params.id));
    if (!flow) return fail(res, 404, 'Flow not found');
    if ([...live.values()].some((r) => r.flowId === flow.id)) return fail(res, 409, 'This flow is already running');
    const run: FlowRun = {
      id: randomUUID(),
      flowId: flow.id,
      started: Date.now(),
      ended: null,
      status: 'running',
      steps: flow.steps.map((s, index) => ({ index, templateId: s.templateId, state: 'queued' as const, runIds: [] })),
    };
    live.set(run.id, run);
    save(run);
    audit('flow-run', 'owner', `Started flow ${flow.name}`);
    void execute(flow, run, broadcast);
    res.status(202).json({ success: true, run });
  }));

  app.post('/api/flows/runs/:id/stop', handle((req, res) => {
    const id = String(req.params.id);
    if (!live.has(id)) return fail(res, 404, 'That flow run is not active');
    cancelled.add(id);
    res.json({ success: true });
  }));
}
