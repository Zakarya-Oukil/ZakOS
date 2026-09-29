import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cx } from '../../ui/cx';
import { StatusDot, type Status } from '../../ui';
import type { SessionInfo } from './api';
import { ago, basename } from './format';

interface SessionListProps {
  agent: string;
  sessions: SessionInfo[];
  loading: boolean;
  error: string | null;
  activeId: string | undefined;
  disabledReason?: string;
  onCreate: (cwd: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function statusOf(s: SessionInfo): Status {
  if (s.running || s.status === 'running') return 'live';
  return s.status === 'error' ? 'error' : 'idle';
}

export function SessionList({ agent, sessions, loading, error, activeId, disabledReason, onCreate, onDelete }: SessionListProps) {
  const [creating, setCreating] = useState(false);
  const [cwd, setCwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await onCreate(cwd.trim());
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
        href={`#/agents/${agent}/${s.id}`}
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
        </span>
        <span className="mt-0.5 block truncate pl-4 text-xs text-os-muted">
          {ago(s.updated)} in <span className="font-os-mono">{basename(s.cwd)}</span>
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
        <button
          type="button"
          aria-label={`Delete session ${s.title}`}
          onClick={() => setConfirmId(s.id)}
          className="absolute right-1.5 top-2 rounded-[var(--os-radius-sm)] p-1 text-os-muted opacity-0 hover:text-os-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] group-hover:opacity-100"
        >
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
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
            <Plus size={15} strokeWidth={1.75} aria-hidden />
            New session
          </button>
        ) : (
          <form onSubmit={submit} className="grid gap-2">
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
              className="h-8 rounded-[var(--os-radius)] border border-os-line bg-os-bg px-2 font-os-mono text-xs text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
            />
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
