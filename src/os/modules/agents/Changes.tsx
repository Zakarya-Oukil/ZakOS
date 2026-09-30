import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Undo2 } from 'lucide-react';
import { Panel } from '../../ui';
import { cx } from '../../ui/cx';
import { agentsApi, type ActionInfo, type FileChange, type SessionInfo } from './api';
import { ago } from './format';

const LABEL: Record<FileChange['status'], { text: string; tone: string; hint: string }> = {
  M: { text: 'M', tone: 'text-os-amber', hint: 'Modified' },
  A: { text: 'A', tone: 'text-os-cyan', hint: 'Added since the checkpoint' },
  D: { text: 'D', tone: 'text-os-danger', hint: 'Deleted' },
  U: { text: 'N', tone: 'text-os-cyan', hint: 'New, untracked file' },
};

const small =
  'rounded-[var(--os-radius-sm)] px-1.5 py-0.5 text-xs text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40';

function DiffView({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <pre className="max-h-72 overflow-auto border-t border-os-line bg-os-bg px-3 py-2 font-os-mono text-[11px] leading-[1.5]">
      {lines.map((l, i) => (
        <span
          key={i}
          className={cx(
            'block whitespace-pre',
            l.startsWith('+') && !l.startsWith('+++') && 'bg-[rgba(95,227,240,0.08)] text-os-cyan',
            l.startsWith('-') && !l.startsWith('---') && 'bg-[rgba(255,107,107,0.08)] text-os-danger',
            l.startsWith('@@') && 'text-os-muted',
          )}
        >
          {l || ' '}
        </span>
      ))}
    </pre>
  );
}

function FileRow({ session, refId, change, running, onReverted }: { session: SessionInfo; refId: string; change: FileChange; running: boolean; onReverted: () => void }) {
  const [open, setOpen] = useState(false);
  const [diff, setDiff] = useState<{ diff: string; binary: boolean; truncated: boolean } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = LABEL[change.status];

  useEffect(() => {
    if (!open) return;
    setDiff(null);
    agentsApi.changeDiff(session.id, refId, change.file).then(setDiff).catch((e: Error) => setError(e.message));
  }, [open, session.id, refId, change.file, change.status]);

  const revert = async () => {
    setConfirm(false);
    setError(null);
    try {
      await agentsApi.revertFile(session.id, refId, change.file);
      onReverted();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <li>
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
          {open ? <ChevronDown size={13} aria-hidden className="shrink-0 text-os-muted" /> : <ChevronRight size={13} aria-hidden className="shrink-0 text-os-muted" />}
          <span className={cx('w-3 shrink-0 font-os-mono text-xs', label.tone)} title={label.hint} aria-label={label.hint}>
            {label.text}
          </span>
          <span className="truncate font-os-mono text-xs text-os-text" title={change.file}>{change.file}</span>
        </button>
        {confirm ? (
          <span className="flex shrink-0 items-center gap-1">
            <button type="button" className={cx(small, 'text-os-amber')} onClick={() => void revert()}>
              {change.status === 'U' ? 'Delete file' : 'Revert'}
            </button>
            <button type="button" className={small} onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" className={cx(small, 'shrink-0')} disabled={running} title={running ? 'Stop the run first' : `Revert ${change.file}`} aria-label={`Revert ${change.file}`} onClick={() => setConfirm(true)}>
            <Undo2 size={13} aria-hidden />
          </button>
        )}
      </div>
      {confirm && change.status === 'U' && (
        <p className="px-3 pb-1.5 text-xs text-os-amber">This deletes the file from disk. Git never saved a copy, and it may have existed before this session.</p>
      )}
      {error && <p className="px-3 pb-1.5 text-xs text-os-danger" role="alert">{error}</p>}
      {open && (diff ? (
        diff.binary ? <p className="border-t border-os-line px-3 py-2 text-xs text-os-muted">Binary file, no text diff.</p>
        : diff.truncated && !diff.diff ? <p className="border-t border-os-line px-3 py-2 text-xs text-os-muted">File is too large to preview.</p>
        : <>
            <DiffView text={diff.diff} />
            {diff.truncated && <p className="px-3 py-1 text-xs text-os-muted">Diff cut short. Only the first part is shown.</p>}
          </>
      ) : !error && <p className="border-t border-os-line px-3 py-2 text-xs text-os-muted">Loading…</p>)}
    </li>
  );
}

/** Files that differ from a checkpoint, with a diff per file and a one-file revert. */
export function Changes({ session, actions, running }: { session: SessionInfo; actions: ActionInfo[]; running: boolean }) {
  // Actions arrive newest first; the oldest checkpoint shows everything this session changed.
  const checkpoints = useMemo(() => actions.filter((a) => a.kind === 'prompt' && a.checkpoint_ref), [actions]);
  const [refId, setRefId] = useState<string>('');
  const [changes, setChanges] = useState<FileChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const oldest = checkpoints[checkpoints.length - 1]?.checkpoint_ref ?? '';
  useEffect(() => {
    if (!checkpoints.some((c) => c.checkpoint_ref === refId)) setRefId(oldest);
  }, [checkpoints, oldest, refId]);

  const load = useCallback(() => {
    if (!refId) return setChanges(null);
    agentsApi
      .changes(session.id, refId)
      .then((c) => {
        setChanges(c);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [session.id, refId]);

  // Reload when a run finishes or a new prompt adds a checkpoint.
  useEffect(load, [load, running, checkpoints.length]);

  return (
    <Panel title="Changes" padded={false}>
      {checkpoints.length === 0 ? (
        <p className="p-3 text-xs leading-relaxed text-os-muted">In a git folder, files this session changes will be listed here with a diff and a one-file revert.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 px-3 py-2">
            <label htmlFor="changes-base" className="sr-only">Compare against</label>
            <select
              id="changes-base"
              value={refId}
              onChange={(e) => setRefId(e.target.value)}
              className="h-7 min-w-0 flex-1 rounded-[var(--os-radius)] border border-os-line bg-os-bg px-1.5 text-xs text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
            >
              {checkpoints.map((c, i) => (
                <option key={c.id} value={c.checkpoint_ref!}>
                  {i === checkpoints.length - 1 ? 'Since the start' : `Since: ${c.detail.slice(0, 40)}`} ({ago(c.ts)})
                </option>
              ))}
            </select>
            <button type="button" className={small} aria-label="Refresh changes" onClick={load}>
              <RefreshCw size={13} aria-hidden />
            </button>
          </div>
          {error && <p className="px-3 pb-2 text-xs text-os-danger" role="alert">{error}</p>}
          {changes && changes.length === 0 && <p className="px-3 pb-3 text-xs text-os-muted">No files differ from that checkpoint.</p>}
          {changes && changes.length > 0 && (
            <ul className="divide-y divide-os-line border-t border-os-line">
              {changes.map((c) => (
                <FileRow key={`${refId}:${c.file}`} session={session} refId={refId} change={c} running={running} onReverted={load} />
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}
