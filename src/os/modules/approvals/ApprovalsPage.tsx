import { useMemo, useState } from 'react';
import { ArrowSquareOut, Check, X } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Button, EmptyState, ErrorNote, Segmented } from '../../ui';
import { timeAgo } from '../../lib/projectsApi';
import { cx } from '../../ui/cx';
import { approvalsApi, useApprovalsApi, type ApprovalItem } from './api';
import { api, useResource } from '../../lib/api';
import { RISK_LABEL, RISK_ORDER, assess, type Risk } from './risk';

const RISK_TEXT: Record<Risk, string> = { safe: 'text-os-ok', caution: 'text-os-amber', dangerous: 'text-os-danger' };

function Row({
  a,
  risk,
  reason,
  selected,
  busy,
  onSelect,
  onApprove,
  onAlways,
  onDismiss,
  onOpen,
}: {
  a: ApprovalItem;
  risk: Risk;
  reason: string;
  selected: boolean;
  busy: boolean;
  onSelect: (v: boolean) => void;
  onApprove: () => void;
  onAlways: () => void;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  const pending = a.state === 'pending';
  return (
    <li className={cx('rounded-[var(--os-radius)] border bg-os-surface px-4 py-3', pending ? 'border-os-line' : 'border-os-line opacity-60')}>
      <div className="flex items-start gap-3">
        {pending && (
          <input
            type="checkbox"
            aria-label={`Select: ${a.summary}`}
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-os-muted">
            {pending && <span className={cx('text-[13px] font-semibold', RISK_TEXT[risk])}>{RISK_LABEL[risk]}</span>}
            <span className="font-medium text-os-text">{a.project}</span>
            <span className="truncate">{a.sessionTitle ?? 'Deleted session'}</span>
            <span>{timeAgo(a.created)}</span>
            {!pending && <span>{a.state === 'approved' ? 'Approved' : 'Dismissed'}</span>}
          </div>
          <p className="mt-1.5 break-words font-os-mono text-sm text-os-text">{a.summary}</p>
          {pending && (
            <>
              <p className="mt-1 text-xs text-os-muted">{reason}.</p>
              <p className="mt-0.5 text-xs text-os-muted">
                Approving allows only <code className="font-os-mono text-os-text">{a.rule}</code> for one follow-up turn.
              </p>
            </>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {pending && (
              <>
                <Button size="sm" variant={risk === 'dangerous' ? 'outline' : 'primary'} disabled={busy} onClick={onApprove}>
                  <Check size={14} aria-hidden /> Approve
                </Button>
                {risk !== 'dangerous' && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={onAlways} title="Allow this exact action in this project from now on">
                    Always allow here
                  </Button>
                )}
                <Button size="sm" disabled={busy} onClick={onDismiss}>
                  <X size={14} aria-hidden /> Dismiss
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={onOpen}>
              <ArrowSquareOut size={14} aria-hidden /> Open session
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

function AlwaysRules() {
  const { data, reload } = useResource<{ rules: Array<{ rule: string; cwd: string; created: number }> }>('/api/always-allow');
  const revoke = async (r: { rule: string; cwd: string }) => {
    await api('/api/always-allow', { method: 'DELETE', body: { rule: r.rule, cwd: r.cwd } }).catch(() => undefined);
    reload();
  };
  if (!data || data.rules.length === 0) return null;
  return (
    <section className="mt-8" aria-label="Always-allow rules">
      <h2 className="mb-1 text-sm font-semibold text-os-text">Always allowed ({data.rules.length})</h2>
      <p className="mb-2 max-w-[68ch] text-xs text-os-muted">These actions no longer ask, in the project folder shown. Revoke any of them whenever you like.</p>
      <ul className="grid gap-2">
        {data.rules.map((r) => (
          <li key={`${r.cwd}|${r.rule}`} className="flex items-center gap-3 rounded-[var(--os-radius)] border border-os-line bg-os-surface px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-os-mono text-sm text-os-text">{r.rule}</p>
              <p className="truncate text-xs text-os-muted">{r.cwd}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => revoke(r)}>Revoke</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ApprovalsPage({ navigate }: ModuleProps) {
  const { items, error, refresh, pending } = useApprovalsApi();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sort, setSort] = useState<'risk' | 'new'>('risk');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const rated = useMemo(() => new Map(items.map((a) => [a.id, assess(a.tool, a.summary, a.rule)])), [items]);
  const waiting = useMemo(() => {
    const list = items.filter((a) => a.state === 'pending');
    return sort === 'risk'
      ? [...list].sort((a, b) => RISK_ORDER[rated.get(a.id)!.level] - RISK_ORDER[rated.get(b.id)!.level] || b.created - a.created)
      : [...list].sort((a, b) => b.created - a.created);
  }, [items, sort, rated]);
  const done = items.filter((a) => a.state !== 'pending');

  const act = async (id: string, fn: (id: string) => Promise<unknown>) => {
    setBusyId(id);
    setActionError(null);
    try {
      await fn(id);
      setPicked((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  /** Runs one at a time: approving resumes a session, and the server refuses a second approval on a busy session. */
  const batch = async (what: 'approve' | 'dismiss') => {
    setActionError(null);
    const ids = waiting.filter((a) => picked.has(a.id) && (what === 'dismiss' || rated.get(a.id)!.level !== 'dangerous')).map((a) => a.id);
    const failures: string[] = [];
    for (const id of ids) {
      try {
        await (what === 'approve' ? approvalsApi.approve(id) : approvalsApi.dismiss(id));
      } catch (e) {
        failures.push((e as Error).message);
      }
    }
    setPicked(new Set());
    if (failures.length) setActionError(`${failures.length} of ${ids.length} could not be ${what === 'approve' ? 'approved' : 'dismissed'}: ${failures[0]}`);
    refresh();
  };

  const selectedCount = waiting.filter((a) => picked.has(a.id)).length;
  const dangerousSelected = waiting.some((a) => picked.has(a.id) && rated.get(a.id)!.level === 'dangerous');
  const allSafe = waiting.filter((a) => rated.get(a.id)!.level === 'safe');
  const open = (a: ApprovalItem) => navigate('agents', 'claude', a.sessionId);

  return (
    <PageFrame
      title="Approvals"
      actions={waiting.length > 1 ? <Segmented<'risk' | 'new'> label="Sort" value={sort} onChange={setSort} options={[{ id: 'risk', label: 'Riskiest first' }, { id: 'new', label: 'Newest first' }]} /> : undefined}
    >
      <div className="h-full overflow-y-auto p-5">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 max-w-[68ch] text-sm leading-relaxed text-os-muted">
            Agent sessions run without a live prompt, so anything that needs permission is refused and lands here. Approve one and the session resumes with just that action allowed.
            Only Claude Code sessions can be approved this way. Risk labels are a quick guide from the command text, so read the action before you approve.
          </p>
          {(error || actionError) && (
            <div className="mb-3">
              <ErrorNote>{actionError ?? error}</ErrorNote>
            </div>
          )}

          {waiting.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => setPicked(new Set(allSafe.map((a) => a.id)))} disabled={allSafe.length === 0}>
                Select the {allSafe.length} safe
              </Button>
              <Button size="sm" variant="primary" onClick={() => batch('approve')} disabled={selectedCount === 0 || (dangerousSelected && waiting.filter((a) => picked.has(a.id) && rated.get(a.id)!.level !== 'dangerous').length === 0)}>
                Approve selected
              </Button>
              <Button size="sm" onClick={() => batch('dismiss')} disabled={selectedCount === 0}>
                Dismiss selected
              </Button>
              {dangerousSelected && <span className="text-xs text-os-muted">Dangerous actions are skipped by batch approve. Approve those one at a time.</span>}
            </div>
          )}

          <h2 className="mb-2 text-sm font-semibold text-os-text">Waiting ({pending})</h2>
          {waiting.length === 0 ? (
            <EmptyState title="Nothing is waiting for you">When an agent is refused permission, the action shows up here with a risk label.</EmptyState>
          ) : (
            <ul className="grid gap-2.5">
              {waiting.map((a) => (
                <Row
                  key={a.id}
                  a={a}
                  risk={rated.get(a.id)!.level}
                  reason={rated.get(a.id)!.reason}
                  selected={picked.has(a.id)}
                  busy={busyId === a.id}
                  onSelect={(v) =>
                    setPicked((p) => {
                      const n = new Set(p);
                      if (v) n.add(a.id);
                      else n.delete(a.id);
                      return n;
                    })
                  }
                  onApprove={() => act(a.id, approvalsApi.approve)}
                  onAlways={() => act(a.id, (id) => api(`/api/approvals/${id}/approve`, { method: 'POST', body: { always: true } }))}
                  onDismiss={() => act(a.id, approvalsApi.dismiss)}
                  onOpen={() => open(a)}
                />
              ))}
            </ul>
          )}

          {done.length > 0 && (
            <>
              <div className="mb-2 mt-7 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-os-text">Resolved</h2>
                <Button size="sm" variant="ghost" onClick={() => act('clear', () => approvalsApi.clear())}>
                  Clear resolved
                </Button>
              </div>
              <ul className="grid gap-2.5">
                {done.map((a) => (
                  <Row key={a.id} a={a} risk="safe" reason="" selected={false} busy={false} onSelect={() => {}} onApprove={() => {}} onAlways={() => {}} onDismiss={() => {}} onOpen={() => open(a)} />
                ))}
              </ul>
            </>
          )}

          <AlwaysRules />
        </div>
      </div>
    </PageFrame>
  );
}
