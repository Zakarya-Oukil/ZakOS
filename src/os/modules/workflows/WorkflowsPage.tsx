import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Folder, Play, Plus, Square, Trash2, X } from 'lucide-react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { agentsSocket } from '../../lib/agentsSocket';
import { projectsApi, timeAgo, type ProjectInfo } from '../../lib/projectsApi';
import { Markdown, Panel, StatusDot } from '../../ui';
import { cx } from '../../ui/cx';
import { useAgents, useSession } from '../agents/hooks';
import { Pipeline } from './Pipeline';
import { TaskBoard } from './TaskBoard';
import { isActive, workflowsApi, type Role, type WorkflowRun, type WorkflowTask } from './api';

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
  'inline-flex h-8 items-center gap-2 rounded-[var(--os-radius)] border border-os-line bg-os-surface-2 px-3 text-sm text-os-text transition-colors ' +
  'hover:border-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-os-line';

const field =
  'rounded-[var(--os-radius)] border border-os-line bg-os-bg px-2 text-sm text-os-text placeholder:text-os-muted ' +
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
            <Square size={14} aria-hidden /> Cancel run
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

  useEffect(() => setSelected(undefined), [run.id]);

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
              <Folder size={13} strokeWidth={1.75} className="shrink-0" aria-hidden />
              <span className="truncate font-os-mono">{run.cwd}</span>
              <span className="shrink-0">, started {timeAgo(run.created)}</span>
            </p>
          </div>
          {isActive(run.status) ? (
            <button type="button" className={btn} disabled={busy} onClick={() => act(() => workflowsApi.stop(run.id))}>
              <Square size={14} aria-hidden /> Stop
            </button>
          ) : (
            <button type="button" className={btn} disabled={busy} onClick={() => act(() => workflowsApi.remove(run.id))}>
              <Trash2 size={14} aria-hidden /> Delete
            </button>
          )}
        </div>
        <div className="mt-5">
          <Pipeline run={run} />
        </div>
        {run.summary && <p className="mt-4 max-w-[68ch] border-t border-os-line pt-3 text-sm leading-relaxed text-os-muted">{run.summary}</p>}
        {run.error && <p className="mt-3 text-sm text-os-danger" role="alert">{run.error}</p>}
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

      {(run.report || run.status === 'reporting') && (
        <Panel title="Final report">
          {run.report ? <Markdown text={run.report} /> : <p className="text-sm text-os-muted">Writing the report…</p>}
        </Panel>
      )}
    </div>
  );
}

function NewRun({ projects, onStarted }: { projects: ProjectInfo[]; onStarted: (run: WorkflowRun) => void }) {
  const [goal, setGoal] = useState('');
  const [projectId, setProjectId] = useState('');
  const { agents } = useAgents();
  const [roles, setRoles] = useState<Record<Role, string>>({ orchestrator: 'claude', worker: 'claude', reviewer: 'claude' });
  const [approval, setApproval] = useState(true);
  const [worktrees, setWorktrees] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const project = projects.find((p) => p.id === projectId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      onStarted(await workflowsApi.start(goal.trim(), project?.path ?? '', project?.id, { approval, agents: roles, worktrees }));
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
      <p className="text-xs text-os-muted">
        Sub-agents edit files in the project under your permission setting, and a checkpoint is taken before each prompt.
      </p>
    </form>
  );
}

export default function WorkflowsPage({ route, navigate }: ModuleProps) {
  const { runs, error, refresh } = useRuns();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
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
          />
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
