import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { agentsSocket } from '../../lib/agentsSocket';
import { cx } from '../../ui/cx';

interface AuditEntry {
  id: number;
  ts: number;
  kind: string;
  actor: string;
  detail: string;
  session_id: string | null;
  run_id: string | null;
  project: string | null;
}

const PAGE = 50;

const field =
  'h-8 rounded-[var(--os-radius)] border border-os-line bg-os-bg px-2 text-sm text-os-text placeholder:text-os-muted ' +
  'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';
const btn =
  'inline-flex h-8 items-center gap-2 rounded-[var(--os-radius)] border border-os-line bg-os-surface-2 px-3 text-sm text-os-text transition-colors ' +
  'hover:border-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50';

async function fetchAudit(params: { kind: string; q: string; before?: number }) {
  const qs = new URLSearchParams({ limit: String(PAGE) });
  if (params.kind) qs.set('kind', params.kind);
  if (params.q) qs.set('q', params.q);
  if (params.before) qs.set('before', String(params.before));
  const res = await fetch(`/api/audit?${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data as { entries: AuditEntry[]; kinds: string[] };
}

const time = (ts: number) =>
  new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function AuditPage(_props: ModuleProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const live = useRef({ kind, query });
  live.current = { kind, query };

  // Typing is debounced so each keystroke does not hit the database.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    fetchAudit({ kind: live.current.kind, q: live.current.query })
      .then((r) => {
        setEntries(r.entries);
        setKinds(r.kinds);
        setMore(r.entries.length === PAGE);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [kind, query, load]);

  // A run starting or finishing adds entries; refresh then instead of polling.
  useEffect(() => {
    const offAgents = agentsSocket.subscribe((m) => {
      if (m.event.type === 'status') load();
    });
    const offFlows = agentsSocket.subscribeWorkflows(load);
    return () => {
      offAgents();
      offFlows();
    };
  }, [load]);

  const loadOlder = async () => {
    const last = entries[entries.length - 1];
    if (!last) return;
    try {
      const r = await fetchAudit({ kind, q: query, before: last.id });
      setEntries((prev) => [...prev, ...r.entries]);
      setMore(r.entries.length === PAGE);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <PageFrame
      title="Audit"
      actions={
        <button type="button" className={btn} onClick={load}>
          Refresh
        </button>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-os-line p-3">
          <label className="sr-only" htmlFor="audit-search">Search the audit log</label>
          <input
            id="audit-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search prompts, tools, projects"
            className={cx(field, 'w-72')}
          />
          <label className="sr-only" htmlFor="audit-kind">Filter by kind</label>
          <select id="audit-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
            <option value="">All kinds</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <span className="text-xs text-os-muted">Every prompt, tool call, error, restore and run decision is recorded here. Credentials are redacted.</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {error && <p className="mb-2 text-sm text-os-danger" role="alert">{error}</p>}
          {loading && entries.length === 0 && <p className="text-sm text-os-muted" role="status">Loading</p>}
          {!loading && entries.length === 0 && !error && (
            <p className="text-sm text-os-muted">{query || kind ? 'No entries match.' : 'Nothing recorded yet. Run an agent or a workflow and it will appear here.'}</p>
          )}
          {entries.length > 0 && (
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <thead className="text-xs text-os-muted">
                <tr>
                  <th className="w-36 py-1.5 pr-3 font-normal">Time</th>
                  <th className="w-28 py-1.5 pr-3 font-normal">Kind</th>
                  <th className="w-28 py-1.5 pr-3 font-normal">Actor</th>
                  <th className="w-36 py-1.5 pr-3 font-normal">Project</th>
                  <th className="py-1.5 font-normal">Detail</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-os-line align-top">
                    <td className="py-2 pr-3 font-os-mono text-xs tabular-nums text-os-muted">{time(e.ts)}</td>
                    <td className="py-2 pr-3">
                      <span className={cx('font-os-mono text-xs', e.kind.includes('error') ? 'text-os-danger' : e.kind === 'tool' ? 'text-os-muted' : 'text-os-cyan')}>{e.kind}</span>
                    </td>
                    <td className="truncate py-2 pr-3 text-os-muted">{e.actor}</td>
                    <td className="truncate py-2 pr-3 text-os-muted" title={e.project ?? undefined}>{e.project ?? ''}</td>
                    <td className="break-words py-2 font-os-mono text-xs leading-relaxed text-os-text [overflow-wrap:anywhere]">{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {more && (
            <div className="mt-3">
              <button type="button" className={btn} onClick={loadOlder}>
                Load older entries
              </button>
            </div>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
