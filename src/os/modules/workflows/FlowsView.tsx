import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Play, Plus, Stop, Trash } from '@phosphor-icons/react';
import { Button, EmptyState, ErrorNote, Field, inputCls } from '../../ui';
import { cx } from '../../ui/cx';
import { api } from '../../lib/api';
import { timeAgo } from '../../lib/projectsApi';
import { templatesApi, type WorkflowTemplate } from './api';

type When = 'always' | 'previous-done' | 'previous-failed';
type OnFail = 'stop' | 'continue' | 'retry';
interface Step {
  templateId: string;
  when: When;
  onFail: OnFail;
  retries: number;
}
interface Flow {
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

const WHEN_TEXT: Record<When, string> = { always: 'Always run', 'previous-done': 'Only if the step before succeeded', 'previous-failed': 'Only if the step before failed' };
const STATE_TONE: Record<StepLog['state'], string> = {
  queued: 'var(--os-muted)',
  skipped: 'var(--os-muted)',
  running: 'var(--os-cyan)',
  done: 'var(--os-ok)',
  error: 'var(--os-danger)',
  stopped: 'var(--os-amber)',
};

/** The line between two waypoints. A slight bend, so a flow reads as a route and not as a list. */
function Leg({ alt }: { alt: boolean }) {
  return (
    <svg width="28" height="44" viewBox="0 0 28 44" aria-hidden className="block">
      <path d={alt ? 'M14 0 C 4 12, 24 30, 14 44' : 'M14 0 C 24 12, 4 30, 14 44'} fill="none" stroke="var(--os-contour)" strokeWidth="2" strokeDasharray="3 4" />
    </svg>
  );
}

export function FlowsView() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [runs, setRuns] = useState<FlowRun[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [openId, setOpenId] = useState<string | 'new' | null>(null);
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ flows: Flow[]; runs: FlowRun[] }>('/api/flows')
      .then((d) => {
        setFlows(d.flows);
        setRuns(d.runs);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    templatesApi.list().then(setTemplates).catch(() => setTemplates([]));
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const open = (f: Flow | null) => {
    setError(null);
    if (f) {
      setOpenId(f.id);
      setName(f.name);
      setSteps(f.steps);
    } else {
      setOpenId('new');
      setName('');
      setSteps(templates[0] ? [{ templateId: templates[0].id, when: 'always', onFail: 'stop', retries: 1 }] : []);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (openId === 'new') {
        const d = await api<{ flow: Flow }>('/api/flows', { method: 'POST', body: { name, steps } });
        setOpenId(d.flow.id);
      } else await api(`/api/flows/${openId}`, { method: 'PUT', body: { name, steps } });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!openId || openId === 'new' || !window.confirm(`Delete the flow "${name}"?`)) return;
    await api(`/api/flows/${openId}`, { method: 'DELETE' }).catch((e: Error) => setError(e.message));
    setOpenId(null);
    load();
  };

  const run = async () => {
    if (!openId || openId === 'new') return;
    setError(null);
    try {
      await api(`/api/flows/${openId}/run`, { method: 'POST' });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stop = async (id: string) => {
    await api(`/api/flows/runs/${id}/stop`, { method: 'POST' }).catch((e: Error) => setError(e.message));
    load();
  };

  const update = (i: number, patch: Partial<Step>) => setSteps((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setSteps((s) => {
      const j = i + d;
      if (j < 0 || j >= s.length) return s;
      const n = [...s];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const current = openId && openId !== 'new' ? flows.find((f) => f.id === openId) : undefined;
  const latest = current ? runs.find((r) => r.flowId === current.id) : undefined;
  const live = latest?.status === 'running';
  const nameOf = (id: string) => templates.find((t) => t.id === id)?.name ?? 'Missing template';

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="min-h-0 overflow-y-auto border-b border-os-line p-4 lg:border-b-0 lg:border-r">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-os-text">Flows</h2>
          <Button size="sm" variant="primary" onClick={() => open(null)} disabled={templates.length === 0}>
            <Plus size={14} aria-hidden /> New flow
          </Button>
        </div>
        {templates.length === 0 && <p className="text-sm text-os-muted">A flow chains saved workflows. Save a workflow as a template first, then come back.</p>}
        <ul className="grid gap-1.5">
          {flows.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                aria-current={openId === f.id ? 'true' : undefined}
                onClick={() => open(f)}
                className={cx('w-full rounded-[var(--os-radius)] border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]', openId === f.id ? 'border-os-cyan bg-os-surface-2' : 'border-os-line hover:border-os-muted')}
              >
                <span className="block text-sm text-os-text">{f.name}</span>
                <span className="block text-xs text-os-muted">{f.steps.length} step{f.steps.length === 1 ? '' : 's'}{runs.find((r) => r.flowId === f.id) ? `, last ${runs.find((r) => r.flowId === f.id)!.status}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="min-h-0 overflow-y-auto p-5">
        {!openId ? (
          <EmptyState title="Chain workflows into a route">Each step runs one saved workflow. Say what happens next: carry on, skip, stop, or try again a few times.</EmptyState>
        ) : (
          <div className="mx-auto grid max-w-2xl gap-5">
            {error && <ErrorNote>{error}</ErrorNote>}
            <Field label="Flow name" htmlFor="flow-name">
              <input id="flow-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </Field>

            <ol className="grid">
              {steps.map((s, i) => {
                const log = latest?.steps[i];
                return (
                  <li key={i} className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-4">
                    <div className="flex flex-col items-center">
                      <span
                        className="mt-4 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold"
                        style={{ borderColor: log && live ? STATE_TONE[log.state] : 'var(--os-contour)', color: 'var(--os-text)' }}
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      {i < steps.length - 1 && <Leg alt={i % 2 === 0} />}
                    </div>
                    <div className="mb-3 rounded-[var(--os-radius)] border border-os-line bg-os-surface p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Run this workflow" htmlFor={`st-t-${i}`}>
                          <select id={`st-t-${i}`} value={s.templateId} onChange={(e) => update(i, { templateId: e.target.value })} className="w-full">
                            {templates.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                            {!templates.some((t) => t.id === s.templateId) && <option value={s.templateId}>Missing template</option>}
                          </select>
                        </Field>
                        <Field label="When" htmlFor={`st-w-${i}`}>
                          <select id={`st-w-${i}`} value={s.when} disabled={i === 0} onChange={(e) => update(i, { when: e.target.value as When })} className="w-full">
                            {(Object.keys(WHEN_TEXT) as When[]).map((w) => (
                              <option key={w} value={w}>{WHEN_TEXT[w]}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="If it fails" htmlFor={`st-f-${i}`}>
                          <select id={`st-f-${i}`} value={s.onFail} onChange={(e) => update(i, { onFail: e.target.value as OnFail })} className="w-full">
                            <option value="stop">Stop the flow</option>
                            <option value="continue">Carry on to the next step</option>
                            <option value="retry">Try again</option>
                          </select>
                        </Field>
                        {s.onFail === 'retry' && (
                          <Field label="Extra attempts" htmlFor={`st-r-${i}`} hint="Up to 5. This is the loop.">
                            <input id={`st-r-${i}`} type="number" min={1} max={5} value={s.retries} onChange={(e) => update(i, { retries: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })} className={inputCls} />
                          </Field>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-xs text-os-muted">
                          {log && latest ? `${nameOf(s.templateId)}: ${log.state}${log.note ? `, ${log.note}` : ''}` : nameOf(s.templateId)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14} aria-hidden /></Button>
                          <Button size="sm" variant="ghost" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === steps.length - 1}><ArrowDown size={14} aria-hidden /></Button>
                          <Button size="sm" variant="ghost" aria-label="Remove this step" onClick={() => setSteps((x) => x.filter((_, k) => k !== i))}><Trash size={14} aria-hidden /></Button>
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => setSteps((s) => [...s, { templateId: templates[0]?.id ?? '', when: 'previous-done', onFail: 'stop', retries: 1 }])} disabled={steps.length >= 12 || templates.length === 0}>
                <Plus size={14} aria-hidden /> Add a step
              </Button>
              <Button variant="primary" size="sm" onClick={save} disabled={busy || !name.trim() || steps.length === 0}>Save the flow</Button>
              {current && !live && <Button size="sm" onClick={run}><Play size={14} aria-hidden /> Run it</Button>}
              {live && latest && <Button size="sm" onClick={() => stop(latest.id)}><Stop size={14} aria-hidden /> Stop</Button>}
              {current && <Button size="sm" variant="ghost" onClick={remove}>Delete</Button>}
            </div>

            {current && runs.filter((r) => r.flowId === current.id).length > 0 && (
              <section aria-label="Flow runs">
                <h3 className="mb-2 text-sm font-semibold text-os-text">Runs of this flow</h3>
                <ul className="grid gap-1.5">
                  {runs.filter((r) => r.flowId === current.id).slice(0, 6).map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-[var(--os-radius)] border border-os-line px-3 py-2 text-sm">
                      <span className={r.status === 'done' ? 'font-medium text-os-ok' : r.status === 'error' ? 'font-medium text-os-danger' : r.status === 'running' ? 'font-medium text-os-cyan' : 'text-os-muted'}>{r.status}</span>
                      <span className="text-xs text-os-muted">{timeAgo(r.started)}</span>
                      <span className="text-xs text-os-text">{r.steps.map((x) => x.state).join(' / ')}</span>
                      {r.steps.flatMap((x) => x.runIds).map((id) => (
                        <a key={id} href={`#/workflows/${id}`} className="text-xs text-os-muted underline underline-offset-2 hover:text-os-text">open run</a>
                      ))}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
