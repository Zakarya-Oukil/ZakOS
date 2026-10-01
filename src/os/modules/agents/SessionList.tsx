import { useState, type FormEvent } from 'react';
import { Columns, Plus, Trash } from '@phosphor-icons/react';
import { cx } from '../../ui/cx';
import { StatusDot, type Status } from '../../ui';
import type { SessionInfo } from './api';
import type { ProjectInfo } from '../../lib/projectsApi';
import { ago, basename } from './format';

interface SessionListProps {
  agent: string;
  sessions: SessionInfo[];
  loading: boolean;
  error: string | null;
  activeId: string | undefined;
  disabledReason?: string;
  projects: ProjectInfo[];
  onCreate: (cwd: string, title?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Show a session in a second pane next to the open one. Omitted when nothing is open to sit beside. */
  onOpenBeside?: (id: string) => void;
  /** Session already in the second pane, marked in the list. */
  besideId?: string;
  /** Appended to every row link so picking a session keeps the second pane open. */
  linkSuffix?: string;
}

function statusOf(s: SessionInfo): Status {
  if (s.running || s.status === 'running') return 'live';
  return s.status === 'error' ? 'error' : 'idle';
}

export function SessionList({ agent, sessions, loading, error, activeId, disabledReason, projects, onCreate, onDelete, onOpenBeside, besideId, linkSuffix = '' }: SessionListProps) {
  const [creating, setCreating] = useState(false);
  const [cwd, setCwd] = useState('');
  const [choice, setChoice] = useState<string>(() => {
    try {
      return window.localStorage.getItem('zakos_last_project') ?? '';
    } catch {
      return '';
    }
  });
  const usable = projects.filter((p) => p.exists);
  const picked = usable.find((p) => p.id === choice) ?? usable[0];
  const useOther = choice === '__other' || usable.length === 0;
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      if (useOther) await onCreate(cwd.trim());
      else if (picked) {
        try {
          window.localStorage.setItem('zakos_last_project', picked.id);
        } catch {
          /* storage blocked */
        }
        await onCreate(picked.path, picked.name);
      }
      setCreating(false);
      setCwd('');
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const active = sessions.filter((s) => statusOf(s) === 'live');
  const rest = sessions.filter((s) => statusOf(s) !== 'live');

  const row = (s: SessionInfo) => (
    <li key={s.id} className="group relative">
      <a
        href={`#/agents/${agent}/${s.id}${linkSuffix}`}
        aria-current={s.id === activeId ? 'page' : undefined}
        className={cx(
          'block rounded-[var(--os-radius)] px-2.5 py-2 pr-9 transition-colors',
          'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]',
          s.id === activeId ? 'bg-os-surface-2' : 'hover:bg-os-surface-2',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <StatusDot className="shrink-0" status={statusOf(s)} label={statusOf(s) === 'live' ? 'Running' : statusOf(s) === 'error' ? 'Last run failed' : 'Idle'} />
          <span className="min-w-0 flex-1 truncate text-sm text-os-text">{s.title}</span>
          {s.id === besideId && <span className="shrink-0 rounded-full border border-os-line px-1.5 text-[11px] text-os-muted">beside</span>}
        </span>
        <span className="mt-0.5 block truncate pl-4 text-xs text-os-muted">
          {ago(s.updated)} in{' '}
          {(() => {
            const proj = projects.find((p) => p.path.toLowerCase() === s.cwd.toLowerCase());
            return proj ? (
              <span className="inline-flex items-baseline gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: proj.color }} aria-hidden />
                {proj.name}
              </span>
            ) : (
              <span className="font-os-mono">{basename(s.cwd)}</span>
            );
          })()}
        </span>
      </a>
      {confirmId === s.id ? (
        <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-[var(--os-radius-sm)] bg-os-surface-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setConfirmId(null);
              void onDelete(s.id);
            }}
            className="rounded-[var(--os-radius-sm)] px-1.5 py-0.5 text-os-danger hover:bg-os-bg focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setConfirmId(null)}
            className="rounded-[var(--os-radius-sm)] px-1.5 py-0.5 text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
          >
            Keep
          </button>
        </span>
      ) : (
        <>
          {onOpenBeside && s.id !== activeId && s.id !== besideId && (
            <button
              type="button"
              aria-label={`Open ${s.title} beside the current session`}
              title="Open beside"
              onClick={() => onOpenBeside(s.id)}
              className="absolute right-7 top-2 hidden rounded-[var(--os-radius-sm)] p-1 text-os-muted opacity-0 hover:text-os-cyan focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] group-hover:opacity-100 lg:block"
            >
              <Columns size={14} />
            </button>
          )}
        <button
          type="button"
          aria-label={`Delete session ${s.title}`}
          onClick={() => setConfirmId(s.id)}
          className="absolute right-1.5 top-2 rounded-[var(--os-radius-sm)] p-1 text-os-muted opacity-0 hover:text-os-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] group-hover:opacity-100"
        >
          <Trash size={14} />
        </button>
        </>
      )}
    </li>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-os-line p-2">
        {!creating ? (
          <button
            type="button"
            disabled={Boolean(disabledReason)}
            title={disabledReason}
            onClick={() => setCreating(true)}
            className="flex h-8 w-full items-center justify-center gap-2 rounded-[var(--os-radius)] border border-os-line bg-os-surface-2 text-sm text-os-text transition-colors hover:border-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-os-line"
          >
            <Plus size={15} aria-hidden />
            New session
          </button>
        ) : (
          <form onSubmit={submit} className="grid gap-2">
            {usable.length > 0 && (
              <>
                <label htmlFor="new-session-project" className="text-xs text-os-muted">
                  Project
                </label>
                <select
                  id="new-session-project"
                  value={useOther ? '__other' : (picked?.id ?? '')}
                  onChange={(e) => setChoice(e.target.value)}
                  className="h-8 rounded-[var(--os-input-radius)] border border-os-line bg-os-bg px-3 text-sm text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
                >
                  {usable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  <option value="__other">Another folder</option>
                </select>
              </>
            )}
            {useOther && (
              <>
                <label htmlFor="new-session-cwd" className="text-xs text-os-muted">
                  Working folder
                </label>
                <input
                  id="new-session-cwd"
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  placeholder="Blank uses the Zak OS folder"
                  autoFocus
                  spellCheck={false}
                  className="h-8 rounded-[var(--os-input-radius)] border border-os-line bg-os-bg px-3 font-os-mono text-xs text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
                />
              </>
            )}
            {formError && (
              <p role="alert" className="text-xs text-os-danger">
                {formError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="h-8 flex-1 rounded-[var(--os-radius)] border border-os-cyan bg-os-surface-2 text-sm text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:opacity-50"
              >
                {busy ? 'Creating' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setFormError(null);
                }}
                className="h-8 rounded-[var(--os-radius)] px-3 text-sm text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading && <p className="px-2.5 py-3 text-sm text-os-muted">Loading sessions</p>}
        {error && (
          <p role="alert" className="px-2.5 py-3 text-sm text-os-danger">
            {error}
          </p>
        )}
        {!loading && !error && sessions.length === 0 && (
          <p className="px-2.5 py-3 text-sm leading-relaxed text-os-muted">
            No sessions for this agent yet. Create one and its conversation is saved here.
          </p>
        )}
        {active.length > 0 && (
          <>
            <h3 className="px-2.5 pb-1 pt-2 text-xs text-os-muted">Running</h3>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">{active.map(row)}</ul>
          </>
        )}
        {rest.length > 0 && (
          <>
            {active.length > 0 && <h3 className="px-2.5 pb-1 pt-3 text-xs text-os-muted">Recent</h3>}
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">{rest.map(row)}</ul>
          </>
        )}
      </div>
    </div>
  );
}
