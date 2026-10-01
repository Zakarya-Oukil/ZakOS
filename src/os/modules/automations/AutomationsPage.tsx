import { useCallback, useEffect, useMemo, useState } from 'react';
import { Play, Plus, Trash } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { cx } from '../../ui/cx';
import { timeAgo } from '../../lib/projectsApi';
import { AutomationCalendar } from './AutomationCalendar';
import { Segmented } from '../../ui';
import { automationsApi, describe, PRESETS, type Automation, type TemplateInfo, type Trigger } from './api';

const btn =
  'inline-flex h-9 items-center gap-2 rounded-full border border-os-line bg-os-surface-2 px-4 text-sm text-os-text transition-colors ' +
  'hover:border-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50';
const field =
  'rounded-[var(--os-input-radius)] border border-os-line bg-os-bg px-3 text-sm text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';

const when = (ts: number) => new Date(ts).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const STATUS_TONE: Record<string, string> = { done: 'text-os-cyan', error: 'text-os-danger', stopped: 'text-os-muted', deleted: 'text-os-muted' };

/** One trigger editor, used both to create an automation and to change an existing one. */
function TriggerEditor({ value, onChange }: { value: Trigger; onChange: (t: Trigger) => void }) {
  const [times, setTimes] = useState<number[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const cron = value.kind === 'cron' ? value.cron : '';
  const preset = value.kind === 'cron' && PRESETS.some((p) => p.cron === cron) ? cron : value.kind === 'commit' ? 'commit' : 'custom';

  // The preview doubles as validation: it shows the next runs, or says what is wrong with the expression.
  useEffect(() => {
    if (value.kind !== 'cron') return setTimes(null), setProblem(null);
    let stale = false;
    const t = setTimeout(() => {
      automationsApi
        .preview(cron)
        .then((r) => !stale && (setTimes(r), setProblem(null)))
        .catch((e: Error) => !stale && (setTimes(null), setProblem(e.message)));
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [value.kind, cron]);

  return (
    <div className="grid gap-2">
      <label htmlFor="trg-kind" className="text-xs text-os-muted">Run it</label>
      <select
        id="trg-kind"
        value={preset}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'commit') onChange({ kind: 'commit' });
          else if (v === 'custom') onChange({ kind: 'cron', cron: cron || '0 9 * * 1-5' });
          else onChange({ kind: 'cron', cron: v });
        }}
        className={cx(field, 'h-8')}
      >
        {PRESETS.map((p) => (
          <option key={p.cron} value={p.cron}>{p.label}</option>
        ))}
        <option value="commit">Whenever a new commit lands in the project</option>
        <option value="custom">On a custom schedule (cron)</option>
      </select>
      {preset === 'custom' && (
        <>
          <label htmlFor="trg-cron" className="text-xs text-os-muted">Cron: minute hour day-of-month month day-of-week</label>
          <input id="trg-cron" value={cron} onChange={(e) => onChange({ kind: 'cron', cron: e.target.value })} spellCheck={false} className={cx(field, 'h-8 font-os-mono')} />
        </>
      )}
      {problem && <p className="text-xs text-os-danger" role="alert">{problem}</p>}
      {times && times.length > 0 && (
        <p className="text-xs text-os-muted">
          Next runs: {times.slice(0, 3).map(when).join(', ')}
        </p>
      )}
      {value.kind === 'commit' && <p className="text-xs text-os-muted">Checked once a minute while Zak OS is open. The first check only records where the project is now.</p>}
    </div>
  );
}

export default function AutomationsPage({ route, navigate }: ModuleProps) {
  const [items, setItems] = useState<Automation[] | null>(null);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState('');
  const [newTrigger, setNewTrigger] = useState<Trigger>({ kind: 'cron', cron: '0 9 * * 1-5' });
  const [edit, setEdit] = useState<Trigger | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    automationsApi
      .list()
      .then((l) => {
        setItems(l);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    refresh();
    automationsApi.templates().then(setTemplates).catch(() => setTemplates([]));
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  const selected = useMemo(() => items?.find((a) => a.id === route[0]), [items, route]);
  useEffect(() => {
    setEdit(null);
    setConfirmDelete(false);
    setNotice(null);
  }, [selected?.id]);

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      if (done) setNotice(done);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const create = () =>
    act(async () => {
      const a = await automationsApi.create(newTemplate || templates[0].id, newTrigger);
      setCreating(false);
      navigate('automations', a.id);
    });

  const [view, setView] = useState<'list' | 'calendar'>('list');
  const triggerChanged = selected && edit && JSON.stringify(edit) !== JSON.stringify(selected.trigger);

  return (
    <PageFrame
      title="Automations"
      actions={
        <>
        <Segmented<'list' | 'calendar'> label="View" value={view} onChange={setView} options={[{ id: 'list', label: 'List' }, { id: 'calendar', label: 'Calendar' }]} />
        <button type="button" className={btn} disabled={templates.length === 0} title={templates.length === 0 ? 'Save a workflow as a template first' : undefined} onClick={() => setCreating((v) => !v)}>
          <Plus size={14} aria-hidden /> New automation
        </button>
        </>
      }
    >
      {view === 'calendar' ? (
        <AutomationCalendar onOpen={(id) => { setView('list'); navigate('automations', id); }} />
      ) : (
      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-r border-os-line p-3" aria-label="Automations">
          {creating && (
            <form
              className="mb-3 grid gap-2 rounded-[var(--os-radius)] border border-os-line p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <label htmlFor="auto-template" className="text-xs text-os-muted">Workflow template to run</label>
              <select id="auto-template" value={newTemplate || templates[0]?.id} onChange={(e) => setNewTemplate(e.target.value)} className={cx(field, 'h-8')}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <TriggerEditor value={newTrigger} onChange={setNewTrigger} />
              <div className="flex gap-2">
                <button type="submit" className={btn} disabled={busy}>Create</button>
                <button type="button" className={btn} onClick={() => setCreating(false)}>Cancel</button>
              </div>
              {notice && <p className="text-xs text-os-danger" role="alert">{notice}</p>}
            </form>
          )}
          {error && <p className="mb-2 text-xs text-os-danger" role="alert">{error}</p>}
          {!items && !error && <p className="text-sm text-os-muted">Loading</p>}
          {items && items.length === 0 && (
            <p className="text-sm leading-relaxed text-os-muted">
              {templates.length === 0 ? (
                <>No automations yet. An automation runs a saved workflow on a schedule or when a commit lands. <a className="text-os-text underline" href="#/workflows">Save a workflow as a template</a> first, then come back.</>
              ) : (
                'No automations yet. Create one to run a saved workflow on a schedule or when a commit lands.'
              )}
            </p>
          )}
          <ul className="grid gap-0.5">
            {items?.map((a) => (
              <li key={a.id}>
                <a
                  href={`#/automations/${a.id}`}
                  aria-current={a.id === selected?.id ? 'page' : undefined}
                  className={cx('block rounded-[var(--os-radius)] px-2.5 py-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]', a.id === selected?.id ? 'bg-os-surface-2' : 'hover:bg-os-surface-2', !a.enabled && 'opacity-60')}
                >
                  <span className="block truncate text-sm text-os-text">{a.templateName ?? a.name}</span>
                  <span className="block truncate text-xs text-os-muted">
                    {describe(a.trigger)}
                    {a.enabled ? (a.nextAt ? ` · next ${when(a.nextAt)}` : '') : ' · paused'}
                  </span>
                  {a.lastError && <span className="block truncate text-xs text-os-danger">{a.lastError}</span>}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        <section className="hidden min-h-0 min-w-0 overflow-y-auto lg:block" aria-label="Automation details">
          {!selected ? (
            <p className="p-6 text-sm text-os-muted">{items && items.length > 0 ? 'Select an automation to see its history or change when it runs.' : ''}</p>
          ) : (
            <div className="mx-auto grid max-w-3xl gap-5 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-medium text-os-text">{selected.templateName ?? selected.name}</h2>
                  <p className="text-xs text-os-muted">{selected.project ?? 'Missing project'} · created {timeAgo(selected.created)}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selected.enabled}
                  className={cx(btn, selected.enabled && 'border-os-cyan text-os-cyan')}
                  disabled={busy}
                  onClick={() => void act(() => automationsApi.update(selected.id, { enabled: !selected.enabled }))}
                >
                  {selected.enabled ? 'On' : 'Paused'}
                </button>
                <button
                  type="button"
                  className={btn}
                  disabled={busy || !selected.templateName}
                  onClick={() => void act(async () => { const r = await automationsApi.runNow(selected.id); navigate('workflows', r.runId); })}
                >
                  <Play size={14} aria-hidden /> Run now
                </button>
              </div>
              {notice && <p role="status" className="text-xs text-os-amber">{notice}</p>}
              {selected.lastError && <p className="text-xs text-os-danger" role="alert">Last problem: {selected.lastError}</p>}
              {!selected.templateName && <p className="text-xs text-os-danger" role="alert">The template this automation runs was deleted. Delete this automation and create a new one.</p>}

              <div className="grid gap-3 rounded-[var(--os-radius)] border border-os-line p-4">
                <h3 className="text-sm font-medium text-os-text">When it runs</h3>
                <TriggerEditor value={edit ?? selected.trigger} onChange={setEdit} />
                <div className="flex gap-2">
                  <button type="button" className={btn} disabled={busy || !triggerChanged} onClick={() => void act(async () => { await automationsApi.update(selected.id, { trigger: edit! }); setEdit(null); }, 'Saved.')}>
                    Save schedule
                  </button>
                  {triggerChanged && (
                    <button type="button" className={btn} onClick={() => setEdit(null)}>Discard</button>
                  )}
                </div>
                <p className="text-xs text-os-muted">Automations run only while Zak OS is open, and use the template's approval setting, so a run may wait for your OK.</p>
              </div>

              <div className="grid gap-2">
                <h3 className="text-sm font-medium text-os-text">Recent runs</h3>
                {selected.history.length === 0 ? (
                  <p className="text-sm text-os-muted">It has not run yet. Use Run now to try it.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-os-muted">
                        <th scope="col" className="pb-1 font-normal">Started</th>
                        <th scope="col" className="pb-1 font-normal">Why</th>
                        <th scope="col" className="pb-1 text-right font-normal">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.history.map((h) => (
                        <tr key={h.runId} className="border-t border-os-line">
                          <td className="py-1.5 pr-3 text-xs text-os-muted">{when(h.at)}</td>
                          <td className="py-1.5 pr-3 text-xs text-os-text">{h.why}</td>
                          <td className="py-1.5 text-right text-xs">
                            {h.status === 'deleted' ? (
                              <span className="text-os-muted">deleted</span>
                            ) : (
                              <a className={cx('underline-offset-2 hover:underline', STATUS_TONE[h.status] ?? 'text-os-amber')} href={`#/workflows/${h.runId}`}>
                                {h.status.replace('_', ' ')}
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div>
                {confirmDelete ? (
                  <span className="flex items-center gap-2 text-sm">
                    <span className="text-os-danger">Delete this automation? Its past runs stay on the Workflows page.</span>
                    <button type="button" className={cx(btn, 'text-os-danger')} disabled={busy} onClick={() => void act(async () => { await automationsApi.remove(selected.id); navigate('automations'); })}>Delete</button>
                    <button type="button" className={btn} onClick={() => setConfirmDelete(false)}>Keep</button>
                  </span>
                ) : (
                  <button type="button" className={cx(btn, 'text-os-muted hover:text-os-danger')} onClick={() => setConfirmDelete(true)}>
                    <Trash size={14} aria-hidden /> Delete automation
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
      )}
    </PageFrame>
  );
}
