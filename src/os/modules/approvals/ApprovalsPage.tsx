import { useState } from 'react';
import { Check, ExternalLink, X } from 'lucide-react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { timeAgo } from '../../lib/projectsApi';
import { cx } from '../../ui/cx';
import { approvalsApi, useApprovalsApi, type ApprovalItem } from './api';

const btn =
  'inline-flex h-8 items-center gap-2 rounded-[var(--os-radius)] border border-os-line bg-os-surface-2 px-3 text-sm text-os-text transition-colors ' +
  'hover:border-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50';

function Row({ a, busy, onApprove, onDismiss, onOpen }: { a: ApprovalItem; busy: boolean; onApprove: () => void; onDismiss: () => void; onOpen: () => void }) {
  const pending = a.state === 'pending';
  return (
    <li className={cx('rounded-[var(--os-radius)] border px-3 py-2.5', pending ? 'border-os-line' : 'border-os-line opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-os-muted">
        <span className="font-medium text-os-text">{a.project}</span>
        <span className="truncate">{a.sessionTitle ?? 'Deleted session'}</span>
        <span>{timeAgo(a.created)}</span>
        {!pending && <span>{a.state === 'approved' ? 'Approved' : 'Dismissed'}</span>}
      </div>
      <p className="mt-1.5 break-words font-os-mono text-sm text-os-text">{a.summary}</p>
      {pending && (
        <p className="mt-1 text-xs text-os-muted">
          Approving allows only <code className="font-os-mono text-os-text">{a.rule}</code> for one follow-up turn.
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {pending && (
          <>
            <button type="button" className={btn} disabled={busy} onClick={onApprove}>
              <Check size={14} aria-hidden /> Approve
            </button>
            <button type="button" className={btn} disabled={busy} onClick={onDismiss}>
              <X size={14} aria-hidden /> Dismiss
            </button>
          </>
        )}
        <button type="button" className={btn} onClick={onOpen}>
          <ExternalLink size={14} aria-hidden /> Open session
        </button>
      </div>
    </li>
  );
}

export default function ApprovalsPage({ navigate }: ModuleProps) {
  const { items, error, refresh, pending } = useApprovalsApi();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const act = async (id: string, fn: (id: string) => Promise<unknown>) => {
    setBusyId(id);
    setActionError(null);
    try {
      await fn(id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  const open = (a: ApprovalItem) => navigate('agents', 'claude', a.sessionId);
  const waiting = items.filter((a) => a.state === 'pending');
  const done = items.filter((a) => a.state !== 'pending');

  return (
    <PageFrame title="Approvals">
      <div className="h-full overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-sm text-os-muted">
            Agent sessions run without a live prompt, so anything that needs permission is refused and lands here. Approve one and the session resumes with just that action allowed.
            Only Claude Code sessions can be approved this way.
          </p>
          {(error || actionError) && <p className="mb-3 text-xs text-os-danger" role="alert">{actionError ?? error}</p>}

          <h2 className="mb-2 text-sm font-medium text-os-muted">Waiting ({pending})</h2>
          {waiting.length === 0 ? (
            <p className="text-sm text-os-muted">Nothing is waiting for you.</p>
          ) : (
            <ul className="grid gap-2">
              {waiting.map((a) => (
                <Row key={a.id} a={a} busy={busyId === a.id} onApprove={() => act(a.id, approvalsApi.approve)} onDismiss={() => act(a.id, approvalsApi.dismiss)} onOpen={() => open(a)} />
              ))}
            </ul>
          )}

          {done.length > 0 && (
            <>
              <div className="mb-2 mt-6 flex items-center justify-between">
                <h2 className="text-sm font-medium text-os-muted">Resolved</h2>
                <button type="button" className={btn} onClick={() => act('clear', () => approvalsApi.clear())}>
                  Clear resolved
                </button>
              </div>
              <ul className="grid gap-2">
                {done.map((a) => (
                  <Row key={a.id} a={a} busy={false} onApprove={() => {}} onDismiss={() => {}} onOpen={() => open(a)} />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
