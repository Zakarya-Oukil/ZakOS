import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { ArrowRight, GithubLogo, Play, Plus, Trash, X } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Button, EmptyState, ErrorNote, Field, IconButton, inputCls, Segmented, textareaCls } from '../../ui';
import { cx } from '../../ui/cx';
import { api } from '../../lib/api';
import { projectsApi, timeAgo, type ProjectInfo } from '../../lib/projectsApi';
import { agentsApi } from '../agents/api';
import { usePrefersReducedMotion } from '../../theme/motion';

type Column = 'backlog' | 'doing' | 'waiting' | 'review' | 'done';
type Priority = 'low' | 'normal' | 'high';

interface Task {
  id: string;
  title: string;
  body: string;
  column: Column;
  priority: Priority;
  due: number | null;
  project: string | null;
  source: string;
  sessionId: string | null;
  created: number;
  updated: number;
}

const COLUMNS: Array<{ id: Column; label: string; hint: string }> = [
  { id: 'backlog', label: 'Backlog', hint: 'Ideas and queued work' },
  { id: 'doing', label: 'Doing', hint: 'An agent or you are on it' },
  { id: 'waiting', label: 'Waiting on you', hint: 'Blocked until you decide' },
  { id: 'review', label: 'Review', hint: 'Finished, needs a look' },
  { id: 'done', label: 'Done', hint: 'Shipped' },
];

const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', normal: 'Normal', high: 'High' };
const dueLabel = (due: number) => new Date(due).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const toInputDate = (due: number | null) => (due ? new Date(due).toISOString().slice(0, 10) : '');

export default function TasksPage({ navigate }: ModuleProps) {
  const reduced = usePrefersReducedMotion();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Column | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    api<{ tasks: Task[] }>('/api/tasks')
      .then((d) => {
        setTasks(d.tasks);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    load();
    projectsApi.list().then(setProjects).catch(() => setProjects([]));
  }, [load]);

  const visible = useMemo(() => tasks.filter((t) => filter === 'all' || t.project === filter), [tasks, filter]);
  const open = tasks.find((t) => t.id === openId) ?? null;
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name;

  const patch = async (id: string, body: Record<string, unknown>) => {
    // Optimistic: the card moves at once and is corrected if the server refuses.
    setTasks((ts) => ts.map((t) => (t.id === id ? ({ ...t, ...body } as Task) : t)));
    try {
      const d = await api<{ task: Task }>(`/api/tasks/${id}`, { method: 'PATCH', body });
      setTasks((ts) => ts.map((t) => (t.id === id ? d.task : t)));
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  };

  const add = async (column: Column, title: string) => {
    try {
      const d = await api<{ task: Task }>('/api/tasks', { method: 'POST', body: { title, column, project: filter === 'all' ? null : filter } });
      setTasks((ts) => [...ts, d.task]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/api/tasks/${id}`, { method: 'DELETE' });
      setTasks((ts) => ts.filter((t) => t.id !== id));
      setOpenId(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runWithAgent = async (t: Task) => {
    setError(null);
    try {
      const cwd = projects.find((p) => p.id === t.project)?.path;
      const session = await agentsApi.create('claude', cwd, t.title.slice(0, 60));
      await agentsApi.send(session.id, `${t.title}\n\n${t.body}`.trim());
      await patch(t.id, { column: 'doing', sessionId: session.id });
      navigate('agents', 'claude', session.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const importIssues = async () => {
    const p = projects.find((x) => x.id === filter) ?? projects[0];
    if (!p) return setError('Add a project first, then import its GitHub issues.');
    setImporting(true);
    setError(null);
    try {
      const d = await api<{ added: number }>('/api/tasks/import-github', { method: 'POST', body: { projectId: p.id } });
      load();
      if (d.added === 0) setError(`No new open issues in ${p.name}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const onDrop = (e: DragEvent, column: Column) => {
    e.preventDefault();
    const id = dragId ?? e.dataTransfer.getData('text/plain');
    setOver(null);
    setDragId(null);
    const t = tasks.find((x) => x.id === id);
    if (t && t.column !== column) void patch(id, { column });
  };

  return (
    <PageFrame
      title="Tasks"
      leading={
        <select aria-label="Filter by project" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 max-w-[14rem] text-[13px]">
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      }
      actions={
        <Button size="sm" onClick={importIssues} disabled={importing}>
          <GithubLogo size={16} aria-hidden /> {importing ? 'Importing' : 'Import GitHub issues'}
        </Button>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {error && (
          <div className="px-5 pt-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        {loaded && tasks.length === 0 && !error ? (
          <div className="flex-1 overflow-y-auto">
            <EmptyState title="Nothing on the board yet" action={<Button variant="primary" onClick={() => void add('backlog', 'My first task')}>Add a card</Button>}>
              Cards can come from you, from a failed check, from a webhook or from GitHub issues. Agents can pick one up and run it.
            </EmptyState>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-5 gap-4 overflow-x-auto p-5">
            {COLUMNS.map((c) => {
              const items = visible.filter((t) => t.column === c.id);
              return (
                <section
                  key={c.id}
                  aria-label={`${c.label}, ${items.length} cards`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(c.id);
                  }}
                  onDragLeave={() => setOver((o) => (o === c.id ? null : o))}
                  onDrop={(e) => onDrop(e, c.id)}
                  className={cx(
                    'flex min-h-0 min-w-[210px] flex-col rounded-[var(--os-radius-lg)] border bg-os-surface transition-colors',
                    over === c.id ? 'border-os-cyan' : 'border-os-line',
                  )}
                >
                  <header className="px-3.5 pb-1 pt-3">
                    <h2 className="flex items-baseline justify-between text-[14px] font-semibold text-os-text">
                      {c.label}
                      <span className="font-os-mono text-xs font-normal text-os-muted">{items.length}</span>
                    </h2>
                    <p className="text-xs text-os-muted">{c.hint}</p>
                  </header>
                  <ul className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto p-2.5">
                    <AnimatePresence initial={false}>
                      {items.map((t) => (
                        <motion.li
                          key={t.id}
                          layout={!reduced}
                          initial={reduced ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.18 }}
                        >
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => {
                              setDragId(t.id);
                              e.dataTransfer.setData('text/plain', t.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setOver(null);
                            }}
                            onClick={() => setOpenId(t.id)}
                            className={cx(
                              'w-full rounded-[var(--os-radius)] border border-os-line bg-os-bg p-3 text-left transition-colors hover:border-os-muted',
                              'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]',
                              dragId === t.id && 'opacity-40',
                            )}
                          >
                            <span className="block text-[14px] font-medium leading-snug text-os-text">{t.title}</span>
                            <span className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-os-muted">
                              {t.priority === 'high' && <span className="font-semibold text-os-cyan">High</span>}
                              {t.priority === 'low' && <span>Low</span>}
                              {t.due && <span className={cx(t.due < Date.now() && t.column !== 'done' && 'font-semibold text-os-danger')}>Due {dueLabel(t.due)}</span>}
                              {projectName(t.project) && <span className="truncate">{projectName(t.project)}</span>}
                              {t.source !== 'manual' && <span>from {t.source}</span>}
                              {t.sessionId && <span>agent attached</span>}
                            </span>
                          </button>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                  <AddCard onAdd={(title) => add(c.id, title)} />
                </section>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <TaskDrawer
          task={open}
          projects={projects}
          onClose={() => setOpenId(null)}
          onSave={(body) => patch(open.id, body)}
          onDelete={() => remove(open.id)}
          onRun={() => runWithAgent(open)}
          onOpenSession={(id) => navigate('agents', 'claude', id)}
        />
      )}
    </PageFrame>
  );
}

function AddCard({ onAdd }: { onAdd: (title: string) => void }) {
  const [on, setOn] = useState(false);
  const [title, setTitle] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim());
    setTitle('');
    setOn(false);
  };
  if (!on)
    return (
      <button
        type="button"
        onClick={() => setOn(true)}
        className="m-2.5 mt-0 flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] text-os-muted transition-colors hover:bg-os-surface-2 hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
      >
        <Plus size={14} aria-hidden /> Add card
      </button>
    );
  return (
    <form onSubmit={submit} className="p-2.5 pt-0">
      <label htmlFor="new-card" className="sr-only">
        Card title
      </label>
      <input id="new-card" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setOn(false)} placeholder="What needs doing?" className={cx(inputCls, 'h-9')} />
    </form>
  );
}

function TaskDrawer({
  task,
  projects,
  onClose,
  onSave,
  onDelete,
  onRun,
  onOpenSession,
}: {
  task: Task;
  projects: ProjectInfo[];
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => void;
  onDelete: () => void;
  onRun: () => void;
  onOpenSession: (id: string) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [body, setBody] = useState(task.body);
  useEffect(() => {
    setTitle(task.title);
    setBody(task.body);
  }, [task.id, task.title, task.body]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const dirty = title !== task.title || body !== task.body;

  return (
    <aside role="dialog" aria-label="Task details" className="absolute inset-y-0 right-0 z-20 flex w-[400px] max-w-full flex-col border-l border-os-line bg-os-bg shadow-[var(--os-shadow-panel)]">
      <header className="flex h-14 items-center justify-between border-b border-os-line px-5">
        <h2 className="text-[16px] font-semibold text-os-text">Card</h2>
        <IconButton aria-label="Close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>
      <div className="grid flex-1 content-start gap-4 overflow-y-auto p-5">
        <Field label="Title" htmlFor="t-title">
          <input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Notes" htmlFor="t-body">
          <textarea id="t-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} className={textareaCls} />
        </Field>
        {dirty && (
          <Button variant="primary" size="sm" className="justify-self-start" onClick={() => onSave({ title, body })}>
            Save changes
          </Button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Column" htmlFor="t-col">
            <select id="t-col" value={task.column} onChange={(e) => onSave({ column: e.target.value })}>
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due" htmlFor="t-due">
            <input id="t-due" type="date" value={toInputDate(task.due)} onChange={(e) => onSave({ due: e.target.value ? new Date(`${e.target.value}T12:00:00`).getTime() : null })} className={inputCls} />
          </Field>
        </div>
        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium text-os-text">Priority</span>
          <Segmented<Priority> label="Priority" value={task.priority} onChange={(v) => onSave({ priority: v })} options={(['low', 'normal', 'high'] as Priority[]).map((p) => ({ id: p, label: PRIORITY_LABEL[p] }))} />
        </div>
        <Field label="Project" htmlFor="t-project" hint="An agent started from this card runs in the project's folder.">
          <select id="t-project" value={task.project ?? ''} onChange={(e) => onSave({ project: e.target.value || null })}>
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-os-muted">
          Created {timeAgo(task.created)}
          {task.source !== 'manual' ? `, from ${task.source}` : ''}.
        </p>
      </div>
      <footer className="flex items-center justify-between gap-2 border-t border-os-line p-4">
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash size={15} aria-hidden /> Delete
        </Button>
        {task.sessionId ? (
          <Button size="sm" onClick={() => onOpenSession(task.sessionId!)}>
            Open the agent session <ArrowRight size={15} aria-hidden />
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onRun}>
            <Play size={15} aria-hidden /> Run with Claude
          </Button>
        )}
      </footer>
    </aside>
  );
}
