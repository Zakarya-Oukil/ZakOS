import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { sendMessage, stop as stopSession, type Broadcast } from '../agents/runner';
import * as sessions from '../agents/store';

export type RunStatus = 'planning' | 'awaiting_approval' | 'running' | 'reviewing' | 'reporting' | 'done' | 'error' | 'stopped';
export type TaskState = 'queued' | 'running' | 'done' | 'error';

export interface Task {
  id: string;
  title: string;
  prompt: string;
  state: TaskState;
  sessionId?: string;
  result?: string;
  error?: string;
}

export interface RunOptions {
  /** Pause after the plan so the owner can edit and approve the tasks. */
  approval: boolean;
}

export const DEFAULT_OPTIONS: RunOptions = { approval: true };

export interface Run {
  id: string;
  options: RunOptions;
  goal: string;
  cwd: string;
  projectId?: string;
  status: RunStatus;
  created: number;
  updated: number;
  summary?: string;
  tasks: Task[];
  orchestratorSessionId?: string;
  reviewerSessionId?: string;
  review?: string;
  verdict?: 'pass' | 'needs_work';
  report?: string;
  error?: string;
}

const AGENT = 'claude';
const MAX_TASKS = 5;
const CONCURRENCY = 3;
const RESULT_LIMIT = 6000;
const TURN_TIMEOUT_MS = 30 * 60 * 1000;
const FILE = path.resolve(process.cwd(), 'data', 'workflow-runs.json');

const runs = new Map<string, Run>();
const stopped = new Set<string>();
/** Open approval gates: resolved with the approved tasks, or null to cancel. */
const gates = new Map<string, (tasks: Task[] | null) => void>();

// ---- persistence ------------------------------------------------------------------------------

try {
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Run[];
  for (const r of saved) {
    // A restart leaves no live child processes, so anything mid-flight is over.
    r.options = { ...DEFAULT_OPTIONS, ...r.options };
    if (['planning', 'awaiting_approval', 'running', 'reviewing', 'reporting'].includes(r.status)) {
      r.status = 'stopped';
      r.error = 'Server restarted during the run';
      for (const t of r.tasks) if (t.state === 'running' || t.state === 'queued') t.state = 'error';
    }
    runs.set(r.id, r);
  }
} catch (err) {
  if (fs.existsSync(FILE)) {
    // Unreadable file: keep it for inspection instead of overwriting it on the next save.
    try {
      fs.copyFileSync(FILE, `${FILE}.corrupt-${Date.now()}`);
    } catch {
      /* best effort */
    }
    console.error('[workflows] saved runs were unreadable:', err instanceof Error ? err.message : err);
  }
}

/** Never throws: a failed save must not take down a run that is still doing real work. */
function persist() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify([...runs.values()], null, 2));
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error('[workflows] could not save runs:', err instanceof Error ? err.message : err);
  }
}

export function listRuns(): Run[] {
  return [...runs.values()].sort((a, b) => b.created - a.created);
}

export function getRun(id: string): Run | undefined {
  return runs.get(id);
}

export function deleteRun(id: string): boolean {
  if (isActive(id)) return false;
  const ok = runs.delete(id);
  if (ok) persist();
  return ok;
}

const isActive = (id: string) => {
  const s = runs.get(id)?.status;
  return s === 'planning' || s === 'awaiting_approval' || s === 'running' || s === 'reviewing' || s === 'reporting';
};

// ---- one agent turn, awaited ------------------------------------------------------------------

interface TurnResult {
  text: string;
  error?: string;
}

/** Runs one prompt on a session and resolves with its full text once the turn ends. */
function runTurn(sessionId: string, prompt: string, broadcast: Broadcast): Promise<TurnResult> {
  return new Promise<TurnResult>((resolve, reject) => {
    let text = '';
    let error: string | undefined;
    // A hung CLI must not hold a run forever: stopping the session ends the turn with an error.
    const timer = setTimeout(() => {
      error = 'Timed out after 30 minutes';
      stopSession(sessionId);
    }, TURN_TIMEOUT_MS);
    const watch: Broadcast = (data) => {
      broadcast(data);
      const m = data as { channel?: string; sessionId?: string; event?: { type: string; delta?: string; message?: string; state?: string } };
      if (m.channel !== 'agents' || m.sessionId !== sessionId || !m.event) return;
      const ev = m.event;
      if (ev.type === 'text' && ev.delta) text += ev.delta;
      else if (ev.type === 'error') error = ev.message;
      else if (ev.type === 'status' && ev.state !== 'running') {
        clearTimeout(timer);
        resolve({ text, error });
      }
    };
    sendMessage(sessionId, prompt, watch).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function newSession(title: string, cwd: string): string {
  return sessions.createSession(randomUUID(), AGENT, title.slice(0, 120), cwd).id;
}

/** Pulls the first balanced JSON object out of free text (agents often wrap it in prose or fences). */
function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  for (let s = start; s !== -1; s = text.indexOf('{', s + 1)) {
    let depth = 0;
    let inStr = false;
    for (let i = s; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (c === '\\') i++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(s, i + 1));
          if (parsed && typeof parsed === 'object' && 'tasks' in parsed) return parsed;
        } catch {
          /* not this one, try the next opening brace */
        }
        break;
      }
    }
  }
  throw new Error('The orchestrator did not return a valid plan');
}

const clip = (s: string, n = RESULT_LIMIT) => (s.length > n ? `${s.slice(0, n)}\n(shortened)` : s);

// ---- prompts ----------------------------------------------------------------------------------

const planPrompt = (goal: string) => `You are the orchestrator of a small agent team working in this repository.
Do not modify any files. You may read the code to plan.

Goal from the owner:
${goal}

Split the goal into at most ${MAX_TASKS} independent tasks that sub-agents can do in parallel.
Each task must touch a different set of files so they do not conflict, and its prompt must be
self-contained (the sub-agent has no other context).

Reply with ONLY a JSON object, no prose:
{"summary": "one sentence plan", "tasks": [{"title": "short title", "prompt": "full instructions"}]}`;

const reviewPrompt = (run: Run) => `You are the reviewer. Do not implement anything and do not change files.
Owner goal: ${run.goal}

Sub-agents reported the following:
${run.tasks.map((t, i) => `## Task ${i + 1}: ${t.title}${t.state === 'error' ? ' (FAILED)' : ''}\n${clip([t.result, t.error && `Error: ${t.error}`].filter(Boolean).join('\n') || '(no output)')}`).join('\n\n')}

Check the actual state of the repository (for example with git status and git diff, and by running the
project's tests or type check if they exist). Do not trust the reports alone.
Finish with a line "VERDICT: PASS" or "VERDICT: NEEDS_WORK", preceded by a short list of concrete issues if any.`;

const reportPrompt = (run: Run) => `Write the final report for the owner in markdown. Sections: What was done, What the reviewer found,
What still needs attention. Be plain and specific, no filler.

Reviewer output:
${clip(run.review ?? '(none)')}`;

// ---- the run ----------------------------------------------------------------------------------

export function startRun(goal: string, cwd: string, projectId: string | undefined, options: Partial<RunOptions>, broadcast: Broadcast): Run {
  const now = Date.now();
  const run: Run = { id: randomUUID(), options: { ...DEFAULT_OPTIONS, ...options }, goal, cwd, projectId, status: 'planning', created: now, updated: now, tasks: [] };
  runs.set(run.id, run);
  persist();
  void execute(run, broadcast);
  return run;
}

const toTask = (t: { title: string; prompt: string }): Task => ({ id: randomUUID(), title: t.title.trim().slice(0, 120), prompt: t.prompt.trim(), state: 'queued' });

/** Approves a run waiting at the gate. `edits` replaces the planned tasks; omit to keep them. */
export function approveRun(id: string, edits?: Array<{ title?: unknown; prompt?: unknown }>): { ok: true } | { ok: false; error: string } {
  const run = runs.get(id);
  const gate = gates.get(id);
  if (!run || !gate || run.status !== 'awaiting_approval') return { ok: false, error: 'This run is not waiting for approval' };
  let tasks = run.tasks;
  if (edits) {
    const clean = edits.filter((t): t is { title: string; prompt: string } => typeof t?.title === 'string' && typeof t?.prompt === 'string' && t.title.trim() !== '' && t.prompt.trim() !== '');
    if (clean.length === 0) return { ok: false, error: 'Keep at least one task with a title and instructions' };
    tasks = clean.slice(0, MAX_TASKS).map(toTask);
  }
  gate(tasks);
  return { ok: true };
}

export function stopRun(id: string): boolean {
  const run = runs.get(id);
  if (!run || !isActive(id)) return false;
  stopped.add(id);
  gates.get(id)?.(null);
  for (const sid of [run.orchestratorSessionId, run.reviewerSessionId, ...run.tasks.map((t) => t.sessionId)]) {
    if (sid) stopSession(sid);
  }
  return true;
}

async function execute(run: Run, broadcast: Broadcast) {
  const update = (patch: Partial<Run> = {}) => {
    Object.assign(run, patch, { updated: Date.now() });
    persist();
    broadcast({ channel: 'workflows', runId: run.id });
  };
  const halted = () => stopped.has(run.id);

  try {
    // 1. Plan
    run.orchestratorSessionId = newSession(`Workflow: ${run.goal}`, run.cwd);
    update();
    const plan = await runTurn(run.orchestratorSessionId, planPrompt(run.goal), broadcast);
    if (halted()) throw new Error('Stopped');
    if (plan.error && !plan.text) throw new Error(plan.error);
    const parsed = extractJson(plan.text) as { summary?: unknown; tasks?: unknown };
    const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    let tasks: Task[] = rawTasks
      .filter((t): t is { title: string; prompt: string } => typeof t?.title === 'string' && typeof t?.prompt === 'string' && t.title.trim() !== '' && t.prompt.trim() !== '')
      .slice(0, MAX_TASKS)
      .map(toTask);
    if (tasks.length === 0) throw new Error('The orchestrator produced no tasks');
    const summary = typeof parsed.summary === 'string' ? parsed.summary : undefined;

    // Approval gate: nothing edits files until the owner has seen and accepted the plan.
    if (run.options.approval) {
      update({ summary, tasks, status: 'awaiting_approval' });
      const approved = await new Promise<Task[] | null>((resolve) => gates.set(run.id, resolve));
      gates.delete(run.id);
      if (approved === null || halted()) throw new Error('Stopped');
      tasks = approved;
    }
    update({ summary, tasks, status: 'running' });

    // 2. Sub-agents, a few at a time
    const queue = [...tasks];
    const worker = async () => {
      for (let task = queue.shift(); task && !halted(); task = queue.shift()) {
        task.sessionId = newSession(`Task: ${task.title}`, run.cwd);
        task.state = 'running';
        update();
        try {
          const out = await runTurn(task.sessionId, task.prompt, broadcast);
          task.result = out.text || undefined;
          if (out.error) {
            task.state = 'error';
            task.error = out.error;
          } else task.state = 'done';
        } catch (err) {
          task.state = 'error';
          task.error = err instanceof Error ? err.message : String(err);
        }
        update();
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));
    if (halted()) throw new Error('Stopped');

    // 3. Review
    update({ status: 'reviewing' });
    run.reviewerSessionId = newSession(`Review: ${run.goal}`, run.cwd);
    update();
    const review = await runTurn(run.reviewerSessionId, reviewPrompt(run), broadcast);
    if (halted()) throw new Error('Stopped');
    // The reviewer may quote the keyword inside a finding, so only the last verdict line counts,
    // and a run with failed tasks can never pass.
    const verdicts = [...review.text.matchAll(/VERDICT:\s*(PASS|NEEDS_WORK)/gi)];
    const last = verdicts.at(-1)?.[1]?.toUpperCase();
    const verdict = last === 'PASS' && !review.error && run.tasks.every((t) => t.state === 'done') ? 'pass' : 'needs_work';
    update({ review: review.text || review.error, verdict });

    // 4. Final report, written by the orchestrator so it keeps the plan in context
    update({ status: 'reporting' });
    const report = await runTurn(run.orchestratorSessionId, reportPrompt(run), broadcast);
    if (halted()) throw new Error('Stopped');
    update({ report: report.text || report.error, status: 'done' });
  } catch (err) {
    const wasStopped = halted();
    for (const t of run.tasks) {
      if (t.state === 'queued' || t.state === 'running') {
        t.state = 'error';
        t.error = wasStopped ? 'Stopped' : 'Run ended before this task finished';
      }
    }
    update({ status: wasStopped ? 'stopped' : 'error', error: wasStopped ? undefined : err instanceof Error ? err.message : String(err) });
  } finally {
    stopped.delete(run.id);
  }
}
