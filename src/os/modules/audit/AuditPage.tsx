import { useCallback, useEffect, useRef, useState } from 'react';
import { BookmarkSimple, DownloadSimple, X } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { agentsSocket } from '../../lib/agentsSocket';
import { api } from '../../lib/api';
import { Button, ErrorNote, SuccessNote, inputCls } from '../../ui';
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

interface Stats {
  perDay: Array<{ day: string; n: number }>;
  topKinds: Array<{ kind: string; n: number }>;
  archivable: number;
  archived: number;
  retentionDays: number;
  days: number;
}

interface SavedFilter {
  name: string;
  kind: string;
  q: string;
}

const PAGE = 50;
const SAVED_KEY = 'zakos_audit_filters';

async function fetchAudit(params: { kind: string; q: string; before?: number; archive?: boolean }) {
  const qs = new URLSearchParams({ limit: String(params.archive ? 50 : PAGE) });
  if (params.kind && !params.archive) qs.set('kind', params.kind);
  if (params.q) qs.set('q', params.q);
  if (params.before) qs.set('before', String(params.before));
  return api<{ entries: AuditEntry[]; kinds?: string[] }>(`${params.archive ? '/api/audit-archive' : '/api/audit'}?${qs}`);
}

const time = (ts: number) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

function readSaved(): SavedFilter[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function download(name: string, mime: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  // A leading = + - @ would run as a formula in a spreadsheet, so it is defused.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

function ActivityChart({ stats }: { stats: Stats }) {
  const days: Array<{ day: string; n: number }> = [];
  for (let i = stats.days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ day: key, n: stats.perDay.find((p) => p.day === key)?.n ?? 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.n));
  const W = 420;
  const H = 52;
  const slot = W / days.length;
  const bar = Math.max(4, slot - 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Audit events per day, last ${stats.days} days. Busiest day ${max}.`} className="block h-14 w-full max-w-[420px]">
      {days.map((d, i) => {
        const h = Math.max(d.n ? 3 : 1, (d.n / max) * (H - 2));
        return (
          <rect key={d.day} x={i * slot + (slot - bar) / 2} y={H - h} width={bar} height={h} rx={2} fill={d.n ? 'var(--os-cyan)' : 'var(--os-line)'}>
            <title>{`${d.day}: ${d.n} event${d.n === 1 ? '' : 's'}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export default function AuditPage(_props: ModuleProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [saved, setSaved] = useState<SavedFilter[]>(readSaved);
  const [archive, setArchive] = useState(false);
  const live = useRef({ kind, query, archive });
  live.current = { kind, query, archive };

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const loadStats = useCallback(() => {
    api<Stats>('/api/audit-stats?days=14').then(setStats).catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    fetchAudit({ kind: live.current.kind, q: live.current.query, archive: live.current.archive })
      .then((r) => {
        setEntries(r.entries);
        if (r.kinds) setKinds(r.kinds);
        setMore(r.entries.length >= (live.current.archive ? 50 : PAGE));
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [kind, query, archive, load]);

  useEffect(loadStats, [loadStats]);

  useEffect(() => {
    const offAgents = agentsSocket.subscribe((m) => {
      if (m.event.type === 'status') {
        load();
        loadStats();
      }
    });
    const offFlows = agentsSocket.subscribeWorkflows(load);
    return () => {
      offAgents();
      offFlows();
    };
  }, [load, loadStats]);

  const loadOlder = async () => {
    const last = entries[entries.length - 1];
    if (!last) return;
    try {
      const r = await fetchAudit({ kind, q: query, before: last.id, archive });
      setEntries((prev) => [...prev, ...r.entries]);
      setMore(r.entries.length >= (archive ? 50 : PAGE));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saveFilter = () => {
    const name = window.prompt('Name this filter');
    if (!name?.trim()) return;
    const next = [...saved.filter((s) => s.name !== name.trim()), { name: name.trim().slice(0, 40), kind, q: query }].slice(-12);
    setSaved(next);
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  };

  const dropFilter = (name: string) => {
    const next = saved.filter((s) => s.name !== name);
    setSaved(next);
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  };

  /** Fetches up to 2000 entries that match the current filter, then saves them as CSV or JSON. */
  const exportAll = async (format: 'csv' | 'json') => {
    setError(null);
    try {
      const all: AuditEntry[] = [];
      let before: number | undefined;
      while (all.length < 2000) {
        const r = await fetchAudit({ kind, q: query, before, archive });
        all.push(...r.entries);
        if (r.entries.length < (archive ? 50 : PAGE)) break;
        before = r.entries[r.entries.length - 1].id;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === 'json') download(`zak-os-audit-${stamp}.json`, 'application/json', JSON.stringify(all, null, 2));
      else {
        const head = ['time', 'kind', 'actor', 'project', 'detail', 'session', 'run'];
        const rows = all.map((e) => [new Date(e.ts).toISOString(), e.kind, e.actor, e.project, e.detail, e.session_id, e.run_id].map(csvCell).join(','));
        download(`zak-os-audit-${stamp}.csv`, 'text/csv', [head.join(','), ...rows].join('\n'));
      }
      setNotice(`Exported ${all.length} entr${all.length === 1 ? 'y' : 'ies'}.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runArchive = async () => {
    if (!stats || !window.confirm(`Move ${stats.archivable} entries older than ${stats.retentionDays} days to the archive? They stay searchable there.`)) return;
    try {
      const d = await api<{ moved: number }>('/api/audit-archive/run', { method: 'POST' });
      setNotice(`Archived ${d.moved} entries.`);
      load();
      loadStats();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <PageFrame
      title="Audit"
      actions={
        <>
          <Button size="sm" onClick={() => exportAll('csv')}><DownloadSimple size={15} aria-hidden /> CSV</Button>
          <Button size="sm" onClick={() => exportAll('json')}><DownloadSimple size={15} aria-hidden /> JSON</Button>
          <Button size="sm" variant="ghost" onClick={() => { load(); loadStats(); }}>Refresh</Button>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="grid gap-4 border-b border-os-line p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid content-start gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="audit-search">Search the audit log</label>
              <input id="audit-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts, tools, projects" className={cx(inputCls, 'h-9 w-72')} />
              <label className="sr-only" htmlFor="audit-kind">Filter by kind</label>
              <select id="audit-kind" value={kind} onChange={(e) => setKind(e.target.value)} disabled={archive} className="h-9">
                <option value="">All kinds</option>
                {kinds.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <Button size="sm" variant="ghost" onClick={saveFilter} disabled={!kind && !query}>
                <BookmarkSimple size={15} aria-hidden /> Save filter
              </Button>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-os-muted">
                <input type="checkbox" checked={archive} onChange={(e) => setArchive(e.target.checked)} />
                Search the archive{stats ? ` (${stats.archived})` : ''}
              </label>
            </div>
            {saved.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Saved filters">
                {saved.map((s) => (
                  <li key={s.name} className="flex items-center rounded-full border border-os-line">
                    <button type="button" onClick={() => { setKind(s.kind); setQ(s.q); setArchive(false); }} className="h-8 rounded-l-full pl-3 pr-2 text-[13px] text-os-text hover:text-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
                      {s.name}
                    </button>
                    <button type="button" aria-label={`Remove the filter ${s.name}`} onClick={() => dropFilter(s.name)} className="h-8 rounded-r-full pl-1 pr-2.5 text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
                      <X size={12} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-os-muted">Every prompt, tool call, error, restore and run decision is recorded here. Credentials are redacted.</p>
            {stats && stats.archivable > 0 && !archive && (
              <p className="text-xs text-os-muted">
                {stats.archivable} entries are older than {stats.retentionDays} days.{' '}
                <button type="button" onClick={runArchive} className="text-os-text underline underline-offset-4 hover:text-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">Move them to the archive</button>
              </p>
            )}
          </div>
          {stats && (
            <div className="grid content-start gap-1">
              <p className="text-[13px] font-medium text-os-text">Last {stats.days} days</p>
              <ActivityChart stats={stats} />
              <p className="text-xs text-os-muted">{stats.topKinds.slice(0, 3).map((k) => `${k.kind} ${k.n}`).join(', ') || 'No activity yet'}</p>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}
          {notice && <div className="mb-3"><SuccessNote>{notice}</SuccessNote></div>}
          {loading && entries.length === 0 && <p className="text-sm text-os-muted" role="status">Loading</p>}
          {!loading && entries.length === 0 && !error && (
            <p className="text-sm text-os-muted">{query || kind ? 'No entries match.' : archive ? 'The archive is empty.' : 'Nothing recorded yet. Run an agent or a workflow and it will appear here.'}</p>
          )}
          {entries.length > 0 && (
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <thead className="text-xs text-os-muted">
                <tr>
                  <th scope="col" className="w-36 py-1.5 pr-3 font-normal">Time</th>
                  <th scope="col" className="w-28 py-1.5 pr-3 font-normal">Kind</th>
                  <th scope="col" className="w-28 py-1.5 pr-3 font-normal">Actor</th>
                  <th scope="col" className="w-36 py-1.5 pr-3 font-normal">Project</th>
                  <th scope="col" className="py-1.5 font-normal">Detail</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-os-line align-top">
                    <td className="py-2 pr-3 font-os-mono text-xs tabular-nums text-os-muted">{time(e.ts)}</td>
                    <td className="py-2 pr-3">
                      <span className={cx('font-os-mono text-xs', e.kind.includes('error') || e.kind.includes('fail') ? 'text-os-danger' : e.kind === 'tool' ? 'text-os-muted' : 'text-os-text')}>{e.kind}</span>
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
            <div className="mt-4">
              <Button size="sm" onClick={loadOlder}>Load older entries</Button>
            </div>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
