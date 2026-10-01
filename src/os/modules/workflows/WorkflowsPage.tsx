import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowUUpLeft, BookmarkSimple, CalendarCheck, Check, Folder, Play, Plus, Stop, Trash, X } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { agentsSocket } from '../../lib/agentsSocket';
import { projectsApi, timeAgo, type ProjectInfo } from '../../lib/projectsApi';
import { Markdown, Panel, StatusDot } from '../../ui';
import { cx } from '../../ui/cx';
import { useAgents, useSession } from '../agents/hooks';
import { Pipeline } from './Pipeline';
import { TaskBoard } from './TaskBoard';
import { isActive, schedulesApi, templatesApi, workflowsApi, type Outcomes, type OutcomeKey, type Role, type WorkflowRun, type WorkflowSchedule, type WorkflowTask, type WorkflowTemplate } from './api';

const OUTCOME_LABELS: Record<OutcomeKey, string> = {
  obsidian: 'Write the report to Obsidian',
  graphify: 'Update the project graph',
  pr: 'Open a pull request (pushes the branch)',
  notify: 'Notify me',
};

const STATUS_LABEL: Record<WorkflowRun['status'], string> = {
  planning: 'Planning',
  awaiting_approval: 'Needs approval',
  running: 'Building',
  reviewing: 'In review',
  reporting: 'Writing report',
  done: 'Done',
  error: 'Failed',
  stopped: 'Stopped',
};

const btn =
  'inline-flex h-9 items-center gap-2 rounded-full border border-os-line bg-os-surface-2 px-4 text-sm text-os-text transition-colors ' +
  'hover:border-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-os-line';

const field =
  'rounded-[var(--os-input-radius)] border border-os-line bg-os-bg px-3 text-sm text-os-text placeholder:text-os-muted ' +
  'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';

function useRuns() {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    workflowsApi
      .list()
      .then((r) => {
        setRuns(r);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(refresh, [refresh]);
  // The server pings on every phase or task change; refetching keeps one source of truth.
  useEffect(() => agentsSocket.subscribeWorkflows(refresh), [refresh]);
  return { runs, error, refresh };
}

function TaskLog({ task }: { task: WorkflowTask }) {
  // Live text while the sub-agent runs; the stored result once it is done.
  const { items } = useSession(task.state === 'running' ? task.sessionId : undefined);
  const live = items
    .filter((i) => i.kind === 'text')
    .map((i) => (i.kind === 'text' ? i.text : ''))
    .join('\n\n');
  const text = task.state === 'running' ? live : task.result || task.error || '';
  return (
    <Panel title={task.title} padded className="min-w-0">
      <details className="mb-3 text-xs text-os-muted">
        <summary className="cursor-pointer">Task prompt</summary>
        <p className="mt-2 whitespace-pre-wrap break-words">{task.prompt}</p>
      </details>
      {text ? <Markdown text={text} /> : <p className="text-sm text-os-muted">{task.state === 'queued' ? 'Waiting for a free slot.' : 'Working…'}</p>}
    </Panel>
  );
}

function ApprovalPanel({ run, onDone }: { run: WorkflowRun; onDone: () => void }) {
  const [drafts, setDrafts] = useState(() => run.tasks.map((t) => ({ title: t.title, prompt: t.prompt })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = drafts.length > 0 && drafts.every((d) => d.title.trim() && d.prompt.trim());
  const edit = (i: number, patch: Partial<{ title: string; prompt: string }>) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const submit = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Review the plan before anything runs">
      <div className="grid gap-3">
        {drafts.map((d, i) => (
          <div key={i} className="grid gap-1.5 rounded-[var(--os-radius)] border border-os-line bg-os-surface-2 p-2.5">
            <div className="flex items-center gap-2">
              <input
                aria-label={`Task ${i + 1} title`}
                value={d.title}
                onChange={(e) => edit(i, { title: e.target.value })}
                className={cx(field, 'h-8 min-w-0 flex-1')}
              />
              <button
                type="button"
                aria-label={`Remove task ${i + 1}`}
                className={cx(btn, 'w-8 justify-center px-0')}
                onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))}
              >
                <X size={14} aria-hidden />
              </button>
            </div>
            <textarea
              aria-label={`Task ${i + 1} instructions`}
              rows={4}
              value={d.prompt}
              onChange={(e) => edit(i, { prompt: e.target.value })}
              className={cx(field, 'resize-y py-2 text-xs leading-relaxed')}
            />
          </div>
        ))}
        {error && <p className="text-xs text-os-danger" role="alert">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={busy || drafts.length >= 5} onClick={() => setDrafts((ds) => [...ds, { title: '', prompt: '' }])}>
            <Plus size={14} aria-hidden /> Add task
          </button>
          <button type="button" className={btn} disabled={busy || !valid} onClick={() => submit(() => workflowsApi.approve(run.id, drafts))}>
            <Check size={14} aria-hidden /> Approve and run
          </button>
          <button type="button" className={btn} disabled={busy} onClick={() => submit(() => workflowsApi.stop(run.id))}>
            <Stop size={14} aria-hidden /> Cancel run
          </button>
        </div>
      </div>
    </Panel>
  );
}

function RunView({ run, onChanged }: { run: WorkflowRun; onChanged: () => void }) {
  const [selected, setSelected] = useState<string | undefined>();
  const task = run.tasks.find((t) => t.id === selected);
  const [busy, setBusy] = useState(false);
  const [undoNote, setUndoNote] = useState<string | null>(null);

  useEffect(() => setSelected(undefined), [run.id]);

  const undo = async () => {
    setUndoNote(null);
    setBusy(true);
    try {
      const plan = await workflowsApi.undoPlan(run.id);
      if (plan.blocked || !plan.possible) {
        setUndoNote(plan.blocked ?? plan.reason ?? 'Nothing to undo');
        return;
      }
      const lines = [
        plan.revertMerges.length ? `Revert ${plan.revertMerges.length} merged change${plan.revertMerges.length > 1 ? 's' : ''} (history is kept)` : '',
        plan.restoreTracked ? 'Restore tracked files to how they were before the run' : '',
        plan.deleteFiles.length ? `Delete ${plan.deleteFiles.length} new file${plan.deleteFiles.length > 1 ? 's' : ''}:\n  ${plan.deleteFiles.slice(0, 8).join('\n  ')}${plan.deleteFiles.length > 8 ? '\n  ...' : ''}` : '',
      ].filter(Boolean);
      if (lines.length === 0) {
        setUndoNote('This run changed nothing that can be undone');
        return;
      }
      if (!window.confirm(`Undo this run?\n\n${lines.join('\n')}`)) return;
      const result = await workflowsApi.undo(run.id);
      setUndoNote(result.problems.length ? `Partly undone. ${result.problems.join(' ')}` : 'Undone');
    } catch (e) {
      setUndoNote((e as Error).message);
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  return (
    <div className="grid min-w-0 gap-3 [&>*]:min-w-0">
      <Panel padded>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-[68ch]">
            <h2 className="text-balance text-lg font-medium leading-snug text-os-text break-words">{run.goal}</h2>
            <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-os-muted">
              <Folder size={13} className="shrink-0" aria-hidden />
              <span className="truncate font-os-mono">{run.cwd}</span>
              <span className="shrink-0">, started {timeAgo(run.created)}</span>
            </p>
          </div>
          {isActive(run.status) ? (
            <button type="button" className={btn} disabled={busy} onClick={() => act(() => workflowsApi.stop(run.id))}>
              <Stop size={14} aria-hidden /> Stop
            </button>
          ) : (
            <div className="flex gap-2">
              {!run.undone && (
                <button type="button" className={btn} disabled={busy} onClick={undo}>
                  <ArrowUUpLeft size={14} aria-hidden /> Undo run
                </button>
              )}
              <button type="button" className={btn} disabled={busy} onClick={() => act(() => workflowsApi.remove(run.id))}>
                <Trash size={14} aria-hidden /> Delete
              </button>
            </div>
          )}
        </div>
        <div className="mt-5">
          <Pipeline run={run} />
        </div>
        {run.summary && <p className="mt-4 max-w-[68ch] border-t border-os-line pt-3 text-sm leading-relaxed text-os-muted">{run.summary}</p>}
        {run.error && <p className="mt-3 text-sm text-os-danger" role="alert">{run.error}</p>}
        {run.undone && <p className="mt-3 text-sm text-os-muted" role="status">Undone {timeAgo(run.undone.ts)}</p>}
        {undoNote && <p className="mt-3 text-sm text-os-muted" role="status">{undoNote}</p>}
      </Panel>

      {run.status === 'awaiting_approval' && <ApprovalPanel key={run.updated} run={run} onDone={onChanged} />}

      <Panel title="Sub-agents" padded={false}>
        <TaskBoard run={run} selected={selected} onSelect={(id) => setSelected((cur) => (cur === id ? undefined : id))} />
      </Panel>

      {task && <TaskLog task={task} />}

      {(run.review || run.status === 'reviewing') && (
        <Panel
          title="Reviewer"
          header={
            run.verdict && (
              <span className={cx('font-os-mono text-xs', run.verdict === 'pass' ? 'text-os-cyan' : 'text-os-amber')}>
                {run.verdict === 'pass' ? 'PASS' : 'NEEDS WORK'}
              </span>
            )
          }
        >
          {run.review ? <Markdown text={run.review} /> : <p className="text-sm text-os-muted">Checking the repository…</p>}
        </Panel>
      )}

      {run.outcomes && Object.keys(run.outcomes).length > 0 && (
        <Panel title="Outcomes">
          <ul className="grid gap-1.5 text-sm">
            {(Object.entries(run.outcomes) as Array<[OutcomeKey, NonNullable<WorkflowRun['outcomes']>[OutcomeKey]]>).map(([k, r]) => (
              <li key={k} className="flex items-start gap-2">
                <span className={cx('mt-0.5', r?.state === 'error' ? 'text-os-danger' : 'text-os-cyan')} aria-label={r?.state}>
                  {r?.state === 'error' ? <X size={14} aria-hidden /> : <Check size={14} aria-hidden />}
                </span>
                <span className="min-w-0 break-words">
                  <span className="text-os-text">{OUTCOME_LABELS[k]}</span>
                  <span className={cx('block text-xs', r?.state === 'error' ? 'text-os-danger' : 'text-os-muted')}>{r?.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {(run.report || run.status === 'reporting') && (
        <Panel title="Final report">
          {run.report ? <Markdown text={run.report} /> : <p className="text-sm text-os-muted">Writing the report…</p>}
        </Panel>
      )}
    </div>
  );
}

function NewRun({ projects, onStarted, onTemplatesChanged }: { projects: ProjectInfo[]; onStarted: (run: WorkflowRun) => void; onTemplatesChanged: () => void }) {
  const [goal, setGoal] = useState('');
  const [projectId, setProjectId] = useState('');
  const { agents } = useAgents();
  const [roles, setRoles] = useState<Record<Role, string>>({ orchestrator: 'claude', worker: 'claude', reviewer: 'claude' });
  const [approval, setApproval] = useState(true);
  const [worktrees, setWorktrees] = useState(true);
  const [outcomes, setOutcomes] = useState<Outcomes>({ obsidian: true, notify: true, graphify: false, pr: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const project = projects.find((p) => p.id === projectId);
  const [tplName, setTplName] = useState('');
  const [saved, setSaved] = useState(false);
  const opts = { approval, agents: roles, worktrees, outcomes };

  const saveTemplate = async () => {
    if (!goal.trim() || !tplName.trim()) return;
    setError(null);
    try {
      await templatesApi.create(tplName.trim(), goal.trim(), project?.path ?? '', project?.id, opts);
      setTplName('');
      setSaved(true);
      onTemplatesChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      onStarted(await workflowsApi.start(goal.trim(), project?.path ?? '', project?.id, { approval, agents: roles, worktrees, outcomes }));
      setGoal('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-2">
      <label className="text-xs text-os-muted" htmlFor="wf-goal">Goal</label>
      <textarea
        id="wf-goal"
        rows={4}
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="Describe the outcome you want. The orchestrator splits it across sub-agents."
        className={cx(field, 'resize-y py-2 leading-relaxed')}
      />
      <label className="text-xs text-os-muted" htmlFor="wf-project">Project</label>
      <select id="wf-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={cx(field, 'h-8')}>
        <option value="">Zak OS (this repository)</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id} disabled={!p.exists}>
            {p.name}
          </option>
        ))}
      </select>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-xs text-os-muted">Agent for each role</legend>
        {(['orchestrator', 'worker', 'reviewer'] as Role[]).map((role) => (
          <label key={role} className="flex items-center justify-between gap-2 text-sm text-os-text">
            <span className="capitalize">{role}</span>
            <select
              value={roles[role]}
              onChange={(e) => setRoles((r) => ({ ...r, [role]: e.target.value }))}
              className={cx(field, 'h-8 w-40')}
            >
              {(agents.length ? agents : [{ id: 'claude', label: 'Claude Code', available: true }]).map((a) => (
                <option key={a.id} value={a.id} disabled={!a.available}>
                  {a.label}{a.available ? '' : ' (unavailable)'}
                </option>
              ))}
            </select>
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-os-text">
        <input type="checkbox" checked={approval} onChange={(e) => setApproval(e.target.checked)} />
        Ask me to approve the plan first
      </label>
      <label className="flex items-center gap-2 text-sm text-os-text">
        <input type="checkbox" checked={worktrees} onChange={(e) => setWorktrees(e.target.checked)} />
        Isolate each sub-agent in a git worktree
      </label>
      {error && <p className="text-xs text-os-danger">{error}</p>}
      <button type="submit" className={btn} disabled={busy || !goal.trim()}>
        <Play size={14} aria-hidden /> Start workflow
      </button>
      <fieldset className="grid gap-1">
        <legend className="mb-1 text-xs text-os-muted">When the run finishes</legend>
        {(Object.keys(OUTCOME_LABELS) as OutcomeKey[]).map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm text-os-text">
            <input type="checkbox" checked={outcomes[k]} onChange={(e) => setOutcomes((o) => ({ ...o, [k]: e.target.checked }))} />
            {OUTCOME_LABELS[k]}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <input
          aria-label="Template name"
          value={tplName}
          onChange={(e) => {
            setTplName(e.target.value);
            setSaved(false);
          }}
          placeholder="Template name"
          className={cx(field, 'h-8 min-w-0 flex-1')}
        />
        <button type="button" className={btn} disabled={!goal.trim() || !tplName.trim()} onClick={saveTemplate}>
          <BookmarkSimple size={14} aria-hidden /> Save
        </button>
      </div>
      {saved && <p className="text-xs text-os-cyan" role="status">Template saved</p>}
      <p className="text-xs text-os-muted">
        Sub-agents edit files in the project under your permission setting, and a checkpoint is taken before each prompt.
      </p>
    </form>
  );
}

function Templates({ templates, onRun, onDelete }: { templates: WorkflowTemplate[]; onRun: (t: WorkflowTemplate) => void; onDelete: (t: WorkflowTemplate) => void }) {
  if (templates.length === 0) return null;
  return (
    <>
      <h2 className="mb-2 mt-6 text-sm font-medium text-os-muted">Templates</h2>
      <ul className="grid gap-1.5">
        {templates.map((t) => (
          <li key={t.id} className="flex items-center gap-2 rounded-[var(--os-radius)] border border-os-line px-2.5 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-os-text">{t.name}</span>
              <span className="block truncate text-xs text-os-muted">{t.lastRunAt ? `Last run ${timeAgo(t.lastRunAt)}` : 'Never run'}</span>
            </span>
            <button type="button" aria-label={`Run template ${t.name}`} className={cx(btn, 'w-8 justify-center px-0')} onClick={() => onRun(t)}>
              <Play size={14} aria-hidden />
            </button>
            <button type="button" aria-label={`Delete template ${t.name}`} className={cx(btn, 'w-8 justify-center px-0')} onClick={() => onDelete(t)}>
              <Trash size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

const PRESETS: Array<{ label: string; cron?: string }> = [
  { label: 'Every weekday at 9:00', cron: '0 9 * * 1-5' },
  { label: 'Every day at 2:00', cron: '0 2 * * *' },
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every Monday at 9:00', cron: '0 9 * * 1' },
  { label: 'On every new commit' },
];

const describeTrigger = ({ trigger }: WorkflowSchedule) =>
  trigger.kind === 'commit' ? 'On every new commit' : PRESETS.find((p) => p.cron === trigger.cron)?.label ?? `Cron ${trigger.cron}`;

function Schedules({ templates, schedules, onChanged }: { templates: WorkflowTemplate[]; schedules: WorkflowSchedule[]; onChanged: () => void }) {
  const [templateId, setTemplateId] = useState('');
  const [preset, setPreset] = useState(0);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (templates.length === 0) return null;
  const chosen = templateId || templates[0].id;
  const nameOf = (id: string) => templates.find((t) => t.id === id)?.name ?? 'Missing template';

  const add = async () => {
    setError(null);
    const p = PRESETS[preset];
    const cron = custom.trim() || p.cron;
    try {
      await schedulesApi.create(chosen, cron ? { kind: 'cron', cron } : { kind: 'commit' });
      setCustom('');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const field = 'rounded-[var(--os-radius)] border border-os-line bg-os-surface px-2 py-1.5 text-xs text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';

  return (
    <>
      <h2 className="mb-2 mt-6 text-sm font-medium text-os-muted">Schedules</h2>
      <div className="mb-2 grid gap-1.5">
        <select aria-label="Template to schedule" className={field} value={chosen} onChange={(e) => setTemplateId(e.target.value)}>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select aria-label="When to run" className={field} value={preset} onChange={(e) => setPreset(Number(e.target.value))}>
          {PRESETS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
        </select>
        <input aria-label="Custom cron expression" className={field} placeholder="Or custom cron, e.g. 30 6 * * 1-5" value={custom} onChange={(e) => setCustom(e.target.value)} />
        <button type="button" className={btn} onClick={add}>
          <CalendarCheck size={14} aria-hidden /> Add schedule
        </button>
        {error && <p className="text-xs text-os-danger" role="alert">{error}</p>}
      </div>
      <ul className="grid gap-1.5">
        {schedules.map((s) => (
          <li key={s.id} className="flex items-center gap-2 rounded-[var(--os-radius)] border border-os-line px-2.5 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-os-text">{nameOf(s.templateId)}</span>
              <span className="block truncate text-xs text-os-muted">
                {describeTrigger(s)}
                {s.enabled && s.nextAt ? ` · next ${new Date(s.nextAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                {s.lastRunAt ? ` · last ${timeAgo(s.lastRunAt)}` : ''}
              </span>
              {s.lastError && <span className="block truncate text-xs text-os-danger">{s.lastError}</span>}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={s.enabled}
              aria-label={`${s.enabled ? 'Pause' : 'Resume'} schedule for ${nameOf(s.templateId)}`}
              className={cx(btn, 'px-2', s.enabled && 'border-os-cyan text-os-cyan')}
              onClick={() => schedulesApi.setEnabled(s.id, !s.enabled).then(onChanged).catch((e: Error) => setError(e.message))}
            >
              {s.enabled ? 'On' : 'Off'}
            </button>
            <button type="button" aria-label={`Delete schedule for ${nameOf(s.templateId)}`} className={cx(btn, 'w-8 justify-center px-0')} onClick={() => schedulesApi.remove(s.id).then(onChanged).catch((e: Error) => setError(e.message))}>
              <Trash size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-os-muted">Schedules run only while Zak OS is open. Runs use the template's approval setting.</p>
    </>
  );
}

export default function WorkflowsPage({ route, navigate }: ModuleProps) {
  const { runs, error, refresh } = useRuns();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const refreshTemplates = useCallback(() => {
    templatesApi.list().then(setTemplates).catch(() => setTemplates([]));
  }, []);
  useEffect(refreshTemplates, [refreshTemplates]);
  const [schedules, setSchedules] = useState<WorkflowSchedule[]>([]);
  const refreshSchedules = useCallback(() => {
    schedulesApi.list().then(setSchedules).catch(() => setSchedules([]));
  }, []);
  useEffect(refreshSchedules, [refreshSchedules]);
  useEffect(() => {
    const t = setInterval(refreshSchedules, 30_000); // picks up last-run times from the scheduler
    return () => clearInterval(t);
  }, [refreshSchedules]);
  const selectedId = route[0];
  const run = useMemo(() => runs.find((r) => r.id === selectedId), [runs, selectedId]);

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => setProjects([]));
  }, []);

  return (
    <PageFrame title="Workflows">
      <div className="grid h-full min-h-0 grid-cols-1 content-start overflow-y-auto lg:grid-cols-[320px_minmax(0,1fr)] lg:overflow-hidden">
        <aside className={cx('min-w-0 border-b border-os-line p-3 lg:order-1 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r', selectedId ? 'order-2' : 'order-1')}>
          <NewRun
            projects={projects}
            onStarted={(r) => {
              refresh();
              navigate('workflows', r.id);
            }}
            onTemplatesChanged={refreshTemplates}
          />
          <Templates
            templates={templates}
            onRun={(t) => {
              setTemplateError(null);
              templatesApi
                .run(t.id)
                .then((r) => {
                  refresh();
                  refreshTemplates();
                  navigate('workflows', r.id);
                })
                .catch((e: Error) => setTemplateError(e.message));
            }}
            onDelete={(t) => templatesApi.remove(t.id).then(() => { refreshTemplates(); refreshSchedules(); }).catch((e: Error) => setTemplateError(e.message))}
          />
          <Schedules templates={templates} schedules={schedules} onChanged={refreshSchedules} />
          {templateError && <p className="mt-2 text-xs text-os-danger" role="alert">{templateError}</p>}
          <h2 className="mb-2 mt-6 text-sm font-medium text-os-muted">Runs</h2>
          {error && <p className="text-xs text-os-danger">{error}</p>}
          {runs.length === 0 && !error && <p className="text-sm text-os-muted">No runs yet.</p>}
          <ul className="grid gap-1.5">
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => navigate('workflows', r.id)}
                  aria-current={r.id === selectedId ? 'true' : undefined}
                  className={cx(
                    'flex w-full items-start gap-2 rounded-[var(--os-radius)] border px-2.5 py-2 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]',
                    r.id === selectedId ? 'border-os-cyan bg-os-surface-2' : 'border-os-line hover:border-os-muted',
                  )}
                >
                  <StatusDot
                    status={isActive(r.status) ? 'live' : r.status === 'error' ? 'error' : r.verdict === 'needs_work' ? 'review' : 'idle'}
                    label={r.status}
                    className="mt-1.5"
                  />
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm text-os-text">{r.goal}</span>
                    <span className="block text-xs text-os-muted">{STATUS_LABEL[r.status]}, {timeAgo(r.updated)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className={cx('min-w-0 p-3 lg:order-2 lg:min-h-0 lg:overflow-y-auto', selectedId ? 'order-1' : 'order-2')}>
          {run ? (
            <RunView run={run} onChanged={refresh} />
          ) : (
            <p className="p-2 text-sm text-os-muted">Start a workflow, or pick a run to watch it.</p>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
