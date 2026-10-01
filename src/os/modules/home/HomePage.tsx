import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowUp, Bell, CalendarCheck, GitBranch, ShieldCheck, Warning } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Button, Panel, StatusDot } from '../../ui';
import { api } from '../../lib/api';
import { SETUP_KEY } from '../../shell/SetupWizard';
import { cx } from '../../ui/cx';
import { projectsApi, timeAgo, type ProjectInfo } from '../../lib/projectsApi';
import { agentsApi } from '../agents/api';
import { useHome, type HomeData, type Provider, type Window as Win } from './api';

const fmtTokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
const fmtCost = (n: number) => (n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`);
const inFuture = (ts: number) => new Date(ts).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
const untilReset = (unixSeconds: number) => {
  const m = Math.max(0, Math.round((unixSeconds * 1000 - Date.now()) / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h ${m % 60} min` : `${Math.round(h / 24)} days`;
};

const field =
  'rounded-[var(--os-input-radius)] border border-os-line bg-os-bg px-3 text-sm text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';
const primary =
  'inline-flex h-9 items-center gap-2 rounded-full bg-os-cyan px-4 text-sm font-medium text-os-on-accent transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40';
const link = 'text-os-text underline-offset-2 hover:text-os-cyan hover:underline focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';

function Bar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-1.5 overflow-hidden rounded-full bg-os-surface-2"
    >
      <div className={cx('h-full rounded-full', pct >= 90 ? 'bg-os-danger' : pct >= 70 ? 'bg-os-amber' : 'bg-os-cyan')} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-os-muted">{children}</p>;
}

// ---- quick start -------------------------------------------------------------------------------

function QuickStart({ home, projects, navigate }: { home: HomeData; projects: ProjectInfo[]; navigate: ModuleProps['navigate'] }) {
  const agents = home.providers.filter((p) => p.available);
  const [picked, setPicked] = useState<string[]>(['claude']);
  const [saved, setSaved] = useState<Array<{ id: string; name: string; text: string }>>([]);
  useEffect(() => {
    api<{ prompts: Array<{ id: string; name: string; text: string }> }>('/api/prompts').then((d) => setSaved(d.prompts)).catch(() => undefined);
  }, []);
  const [projectId, setProjectId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok = picked.filter((id) => agents.some((a) => a.id === id));
    if (ok.length === 0 && agents[0]) setPicked([agents[0].id]);
    else if (ok.length !== picked.length) setPicked(ok);
  }, [agents, picked]);
  useEffect(() => {
    if (!projectId && projects[0]) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const start = async (e: FormEvent) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const cwd = projects.find((p) => p.id === projectId)?.path;
      // One session per chosen agent, all given the same prompt, so their answers can be compared side by side.
      const made: Array<{ agent: string; id: string }> = [];
      for (const a of picked) {
        const session = await agentsApi.create(a, cwd, text.replace(/\s+/g, ' ').slice(0, 60));
        await agentsApi.send(session.id, text);
        made.push({ agent: a, id: session.id });
      }
      if (made.length > 1) navigate('agents', made[0].agent, made[0].id, 'beside', made[1].agent, made[1].id);
      else navigate('agents', made[0].agent, made[0].id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Panel title="Quick start">
      <form onSubmit={start} className="grid gap-2">
        <label htmlFor="qs-prompt" className="sr-only">What should the agent do?</label>
        <textarea
          id="qs-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void start(e as unknown as FormEvent);
          }}
          rows={3}
          placeholder="What should the agent do?"
          className={cx(field, 'w-full resize-y py-2 leading-relaxed')}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Agents to ask" className="flex flex-wrap items-center gap-1.5">
            {agents.map((a) => {
              const on = picked.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((p) => (on ? (p.length > 1 ? p.filter((x) => x !== a.id) : p) : [...p, a.id]))}
                  className={cx(
                    'h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]',
                    on ? 'border-os-cyan text-os-text' : 'border-os-line text-os-muted hover:text-os-text',
                  )}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
          {saved.length > 0 && (
            <select aria-label="Insert a saved prompt" value="" onChange={(e) => { const t = saved.find((x) => x.id === e.target.value); if (t) setPrompt(t.text); }} className={cx(field, 'h-9 max-w-[12rem]')}>
              <option value="">Saved prompts</option>
              {saved.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          )}
          <select aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={cx(field, 'h-8 min-w-0 max-w-[14rem]')}>
            {projects.length === 0 && <option value="">Zak OS folder</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button type="submit" className={cx(primary, 'ml-auto')} disabled={!prompt.trim() || busy}>
            <ArrowUp size={14} aria-hidden /> {busy ? 'Starting' : picked.length > 1 ? `Ask ${picked.length} agents` : 'Start'}
          </button>
        </div>
        <p className="text-xs text-os-muted">Starts a real session you can keep using in Agents. Pick more than one agent to ask them all and compare. Ctrl+Enter also starts it.</p>
        {error && <p className="text-xs text-os-danger" role="alert">{error}</p>}
      </form>
    </Panel>
  );
}

// ---- needs attention ---------------------------------------------------------------------------

function Attention({ a }: { a: HomeData['attention'] }) {
  const items: ReactNode[] = [];
  if (a.approvals > 0)
    items.push(
      <li key="ap" className="flex items-center gap-2">
        <ShieldCheck size={15} aria-hidden className="shrink-0 text-os-amber" />
        <a className={link} href="#/approvals">{a.approvals} action{a.approvals > 1 ? 's' : ''} waiting for your approval</a>
      </li>,
    );
  for (const r of a.runsAwaiting)
    items.push(
      <li key={`aw${r.id}`} className="flex items-center gap-2">
        <GitBranch size={15} aria-hidden className="shrink-0 text-os-amber" />
        <a className={cx(link, 'truncate')} href={`#/workflows/${r.id}`}>Plan ready to approve: {r.goal}</a>
      </li>,
    );
  for (const r of a.failedRuns)
    items.push(
      <li key={`f${r.id}`} className="flex items-center gap-2">
        <Warning size={15} aria-hidden className="shrink-0 text-os-danger" />
        <a className={cx(link, 'truncate')} href={`#/workflows/${r.id}`} title={r.error ?? undefined}>Failed: {r.goal}</a>
      </li>,
    );
  if (a.unreadNotifications > 0)
    items.push(
      <li key="n" className="flex items-center gap-2 text-os-muted">
        <Bell size={15} aria-hidden className="shrink-0" /> {a.unreadNotifications} unread notification{a.unreadNotifications > 1 ? 's' : ''} (bell, bottom left)
      </li>,
    );
  return (
    <Panel bare title="Needs attention">
      {items.length === 0 ? <Empty>Nothing needs you right now.</Empty> : <ul className="grid gap-2 text-sm">{items}</ul>}
    </Panel>
  );
}

// ---- running now -------------------------------------------------------------------------------

function Running({ r, labelOf }: { r: HomeData['running']; labelOf: (id: string) => string }) {
  const none = r.sessions.length === 0 && r.runs.length === 0;
  return (
    <Panel bare title="Running now">
      {none ? (
        <Empty>No agents are working.</Empty>
      ) : (
        <ul className="grid gap-2 text-sm">
          {r.runs.map((run) => (
            <li key={run.id} className="flex items-center gap-2">
              <StatusDot status="live" label="Running" />
              <a className={cx(link, 'min-w-0 flex-1 truncate')} href={`#/workflows/${run.id}`}>{run.goal}</a>
              <span className="shrink-0 text-xs text-os-muted">{run.status}{run.total ? ` · ${run.done}/${run.total}` : ''}</span>
            </li>
          ))}
          {r.sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <StatusDot status="live" label="Running" />
              <a className={cx(link, 'min-w-0 flex-1 truncate')} href={`#/agents/${s.agent}/${s.id}`}>{s.title}</a>
              <span className="shrink-0 text-xs text-os-muted">{labelOf(s.agent)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---- usage -------------------------------------------------------------------------------------

function WindowRow({ label, w, updated }: { label: string; w: Win | null; updated: number }) {
  if (!w) return null;
  const expired = w.resetsAt * 1000 < Date.now();
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-os-muted">{label}</span>
        {expired ? (
          <span className="text-os-muted">reset, usage shown after the next run</span>
        ) : (
          <span className="text-os-text">{Math.round(w.utilization * 100)}% used · resets in {untilReset(w.resetsAt)}</span>
        )}
      </div>
      <Bar value={expired ? 0 : w.utilization} label={`${label} usage`} />
      <span className="sr-only">Reading from {timeAgo(updated)}</span>
    </div>
  );
}

function ProviderCard({ p }: { p: Provider }) {
  const rows: Array<[string, Provider['lastHour']]> = [['Last hour', p.lastHour], ['Last 5 hours', p.last5Hours], ['Last 24 hours', p.lastDay], ['Last 7 days', p.lastWeek]];
  return (
    <div className="border-t border-os-line pt-4 first:border-t-0 first:pt-0">
      <div className="mb-2 flex items-center gap-2">
        <StatusDot status={p.available ? 'live' : 'error'} label={p.available ? 'Available' : 'Unavailable'} />
        <span className="text-sm font-medium text-os-text">{p.label}</span>
        {p.version && <span className="truncate text-xs text-os-muted">{p.version}</span>}
      </div>
      {!p.available && <p className="mb-2 text-xs text-os-danger">{p.reason ?? 'Not available'}</p>}
      {p.windows && (
        <div className="mb-3 grid gap-2">
          <WindowRow label="5-hour limit" w={p.windows.fiveHour} updated={p.windows.updated} />
          <WindowRow label="Weekly limit" w={p.windows.sevenDay} updated={p.windows.updated} />
          <p className="max-w-[68ch] text-xs text-os-muted">Reading from {timeAgo(p.windows.updated)}. It refreshes after each Claude run.</p>
        </div>
      )}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-os-muted">
            <th scope="col" className="pb-1 font-normal">Period</th>
            <th scope="col" className="pb-1 text-right font-normal">Runs</th>
            {p.reportsUsage && <th scope="col" className="pb-1 text-right font-normal">Tokens</th>}
            {p.reportsUsage && <th scope="col" className="pb-1 text-right font-normal">Cost</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, t]) => (
            <tr key={label} className="text-os-text">
              <th scope="row" className="py-0.5 text-left font-normal text-os-muted">{label}</th>
              <td className="py-0.5 text-right tabular-nums">{t.runs}</td>
              {p.reportsUsage && <td className="py-0.5 text-right tabular-nums">{fmtTokens(t.tokens)}</td>}
              {p.reportsUsage && <td className="py-0.5 text-right tabular-nums">{fmtCost(t.costUsd)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 max-w-[68ch] text-xs leading-relaxed text-os-muted">
        {p.reportsUsage
          ? p.trackedSince
            ? `Tokens and cost are counted from runs made through Zak OS since ${new Date(p.trackedSince).toLocaleDateString()}. Plan limits cover all your Claude use.`
            : 'Tokens and cost appear after the first Claude run.'
          : `${p.label} does not report tokens or limits, so only the number of runs started here is shown.`}
      </p>
    </div>
  );
}

// ---- lists -------------------------------------------------------------------------------------

function Schedules({ items }: { items: HomeData['schedules'] }) {
  return (
    <Panel bare title="Schedules" header={<a className="text-xs text-os-muted hover:text-os-text" href="#/workflows">Manage</a>}>
      {items.length === 0 ? (
        <Empty>No schedules yet. Save a workflow as a template, then schedule it.</Empty>
      ) : (
        <ul className="grid gap-2.5 text-sm">
          {items.map((s) => (
            <li key={s.id} className="grid gap-0.5">
              <span className="flex items-center gap-2">
                <CalendarCheck size={14} aria-hidden className={cx('shrink-0', s.enabled ? 'text-os-cyan' : 'text-os-muted')} />
                <span className="truncate text-os-text">{s.name}</span>
                {!s.enabled && <span className="shrink-0 text-xs text-os-muted">paused</span>}
              </span>
              <span className="pl-[22px] text-xs text-os-muted">
                {s.trigger.kind === 'commit' ? 'On every new commit' : `Cron ${s.trigger.cron}`}
                {s.enabled && s.nextAt ? ` · next ${inFuture(s.nextAt)}` : ''}
                {s.lastRunAt ? (
                  <>
                    {' · last '}
                    {s.lastRunId ? <a className={link} href={`#/workflows/${s.lastRunId}`}>{timeAgo(s.lastRunAt)}</a> : timeAgo(s.lastRunAt)}
                    {s.lastStatus ? ` (${s.lastStatus})` : ''}
                  </>
                ) : ' · never run'}
              </span>
              {s.lastError && <span className="pl-[22px] text-xs text-os-danger">{s.lastError}</span>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Activity({ items }: { items: HomeData['activity'] }) {
  const href = (e: HomeData['activity'][number]) => (e.run_id ? `#/workflows/${e.run_id}` : e.session_id ? `#/agents/claude/${e.session_id}` : undefined);
  return (
    <Panel bare title="Recent activity" header={<a className="text-xs text-os-muted hover:text-os-text" href="#/audit">Audit log</a>}>
      {items.length === 0 ? (
        <Empty>Nothing has happened yet.</Empty>
      ) : (
        <ul className="grid gap-1.5 text-xs">
          {items.map((e) => {
            const to = href(e);
            return (
              <li key={e.id} className="flex items-baseline gap-2">
                <span className="w-[4.5rem] shrink-0 text-os-muted">{timeAgo(e.ts)}</span>
                <span className="w-28 shrink-0 truncate font-os-mono text-xs text-os-muted">{e.kind}</span>
                {to ? <a className={cx(link, 'min-w-0 flex-1 truncate')} href={to}>{e.detail}</a> : <span className="min-w-0 flex-1 truncate text-os-text">{e.detail}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function Limits({ l }: { l: HomeData['limits'] }) {
  return (
    <Panel bare title="Workflow limits today">
      <div className="grid gap-3 text-sm">
        <div className="grid gap-1">
          <div className="flex justify-between text-xs"><span className="text-os-muted">Runs started today</span><span className="text-os-text">{l.runsToday} of {l.maxRunsPerDay}</span></div>
          <Bar value={l.runsToday / l.maxRunsPerDay} label="Runs used today" />
        </div>
        <div className="grid gap-1">
          <div className="flex justify-between text-xs"><span className="text-os-muted">Running at once</span><span className="text-os-text">{l.activeRuns} of {l.maxActiveRuns}</span></div>
          <Bar value={l.activeRuns / l.maxActiveRuns} label="Runs in progress" />
        </div>
        <p className="text-xs text-os-muted">These are your own safety limits. Change them on the Workflows page.</p>
      </div>
    </Panel>
  );
}

// ---- pinned projects ------------------------------------------------------------------------------

function Pinned({ home, navigate }: { home: HomeData; navigate: ModuleProps['navigate'] }) {
  const [pinned, setPinned] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/project-meta')
      .then((r) => r.json())
      .then((d) => d.success && setPinned(Object.entries(d.meta as Record<string, { pinned?: boolean; archived?: boolean }>).filter(([, m]) => m.pinned && !m.archived).map(([id]) => id)))
      .catch(() => undefined);
  }, []);
  const list = home.projects.filter((p) => pinned.includes(p.id));
  if (list.length === 0) return null;
  return (
    <Panel bare title="Pinned">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => (
          <li key={p.id} className="grid gap-2">
            <button type="button" onClick={() => navigate('projects', p.id)} className="flex items-center gap-2 text-left focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
              <span className="truncate text-[15px] font-medium text-os-text">{p.name}</span>
            </button>
            <span className="flex flex-wrap gap-1.5">
              <Button size="sm" onClick={() => navigate('agents', 'claude')}>Session</Button>
              <Button size="sm" onClick={() => navigate('git', p.id)}>Git</Button>
              <Button size="sm" onClick={() => navigate('dev', p.id, 'run')}>Run</Button>
              <Button size="sm" onClick={() => navigate('files')}>Files</Button>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ---- catch-up ------------------------------------------------------------------------------------

const VISIT_KEY = 'zakos_last_visit';

/** What happened while you were away, from the audit log. The visit time moves forward a few seconds after you arrive. */
function CatchUp({ items }: { items: HomeData['activity'] }) {
  const [since] = useState(() => {
    try {
      return Number(window.localStorage.getItem(VISIT_KEY)) || 0;
    } catch {
      return 0;
    }
  });
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(VISIT_KEY, String(Date.now()));
      } catch {
        /* storage blocked */
      }
    }, 6000);
    return () => clearTimeout(t);
  }, []);
  const news = items.filter((e) => e.ts > since && !['tool', 'prompt'].includes(e.kind));
  if (since === 0 || news.length === 0) return null;
  const hours = Math.round((Date.now() - since) / 3_600_000);
  return (
    <Panel bare title={`Since you were last here${hours >= 1 ? `, ${hours >= 48 ? `${Math.round(hours / 24)} days` : `${hours} h`} ago` : ''}`}>
      <ul className="grid gap-1.5 text-sm">
        {news.slice(0, 6).map((e) => (
          <li key={e.id} className="flex items-baseline gap-3">
            <span className="w-24 shrink-0 text-xs text-os-muted">{timeAgo(e.ts)}</span>
            <span className="min-w-0 flex-1 truncate text-os-text">{e.detail}</span>
          </li>
        ))}
      </ul>
      {news.length > 6 && <p className="mt-2 text-xs text-os-muted">and {news.length - 6} more in the <a className={link} href="#/audit">audit log</a></p>}
    </Panel>
  );
}

// ---- territory ---------------------------------------------------------------------------------

const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase().replace(/\/$/, '');

/** A closed, hand-wobbled ring: the outline of one contour around a project's summit. */
function ring(cx: number, cy: number, r: number, seed: number, k: number): string {
  const pts: string[] = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const wob = 1 + 0.13 * Math.sin(3 * t + seed) + 0.07 * Math.sin(5 * t + seed * 1.7 + k) + 0.04 * Math.sin(8 * t + seed * 0.6);
    pts.push(`${(cx + Math.cos(t) * r * wob * 1.25).toFixed(1)},${(cy + Math.sin(t) * r * wob * 0.82).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h % 628) / 100;
}

function Territory({ home }: { home: HomeData }) {
  const [metas, setMetas] = useState<Record<string, { archived: boolean }>>({});
  const [scores, setScores] = useState<Record<string, { score: number } | null>>({});
  useEffect(() => {
    fetch('/api/project-meta').then((r) => r.json()).then((d) => d.success && setMetas(d.meta)).catch(() => undefined);
    fetch('/api/health-scores').then((r) => r.json()).then((d) => d.success && setScores(d.scores)).catch(() => undefined);
  }, []);
  const items = home.projects.filter((p) => !metas[p.id]?.archived);
  const W = 1100;
  const H = 400;
  const golden = 2.399963229728653;
  // The land sits to the right of centre so the greeting has the open sea on the left.
  const cx0 = W * 0.62;
  const cy0 = H * 0.4;
  const placed = items.map((p, i) => {
    const a = i * golden + 0.6;
    const spread = items.length === 1 ? 0 : 0.34 + 0.07 * Math.min(items.length, 5);
    const rx = i === 0 ? 0 : Math.sqrt(i / items.length) * spread * W * 0.7;
    const ry = i === 0 ? 0 : Math.sqrt(i / items.length) * spread * H * 1.05;
    const running = home.running.sessions.filter((s) => norm(s.cwd).startsWith(norm(p.path))).length;
    const recent = p.lastSessionAt ? Math.max(0, 1 - (Date.now() - p.lastSessionAt) / (7 * 86_400_000)) : 0;
    return { p, x: cx0 + Math.cos(a) * rx, y: cy0 + Math.sin(a) * ry, r: (38 + recent * 26 + (p.graphUpdated ? 10 : 0)) * (items.length < 3 ? 2.1 : items.length < 6 ? 1.4 : 1), running };
  });
  if (items.length === 0)
    return (
      <p className="absolute bottom-16 right-8 max-w-xs text-right text-sm text-os-muted">
        No projects on the map yet. <a className={link} href="#/projects">Add a folder or clone a repo</a> and it appears here as land.
      </p>
    );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Map of ${items.length} project${items.length === 1 ? '' : 's'}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMaxYMid meet">
      {placed.map(({ p, x, y, r, running }) => {
        const seed = seedOf(p.id);
        const to = p.graphUpdated ? `#/brain/${p.id}` : '#/projects';
        return (
          <a key={p.id} href={to} className="group outline-none">
            <title>{`${p.name}${scores[p.id] ? `, health ${scores[p.id]!.score} percent` : ''}${running ? `, ${running} running` : ''}`}</title>
            {[1, 0.8, 0.6, 0.4, 0.2].map((f, k) => (
              <path
                key={k}
                d={ring(x, y, r * f, seed, k)}
                fill={k === 0 ? p.color : 'none'}
                fillOpacity={k === 0 ? 0.12 : 0}
                stroke={k === 0 ? p.color : 'var(--os-contour)'}
                strokeWidth={k === 0 ? 1.8 : 1.1}
                strokeOpacity={k === 0 ? 0.95 : 0.85}
                className="transition-[stroke-width] duration-200 group-hover:[stroke-width:2.4px] group-focus-visible:[stroke-width:2.4px]"
              />
            ))}
            <path d={`M${x},${y} v-26`} stroke="var(--os-text)" strokeWidth={1.5} />
            <path d={`M${x},${y - 26} l17,6 l-17,6z`} fill={p.color} />
            {running > 0 && <circle cx={x} cy={y} r={r * 0.34} fill="none" stroke="var(--os-cyan)" strokeWidth={2.2} className="os-territory-live" />}
            <text x={x} y={y + r * 0.84 + 22} textAnchor="middle" className="fill-[var(--os-text)] text-[15px] font-semibold" style={{ paintOrder: 'stroke', stroke: 'var(--os-bg)', strokeWidth: 5 }}>
              {p.name}{scores[p.id] ? `  ${scores[p.id]!.score}%` : ''}
            </text>
            {running > 0 && (
              <text x={x} y={y + r * 0.84 + 40} textAnchor="middle" className="fill-[var(--os-cyan)] text-[13px] font-medium" style={{ paintOrder: 'stroke', stroke: 'var(--os-bg)', strokeWidth: 5 }}>
                {running} running
              </text>
            )}
          </a>
        );
      })}
    </svg>
  );
}

// ---- setup checklist ---------------------------------------------------------------------------

/** Shown on Home until the basics are in place. Every tick comes from real data, not from a flag. */
function SetupChecklist({ home }: { home: HomeData }) {
  const [vaultOk, setVaultOk] = useState<boolean | null>(null);
  useEffect(() => {
    api('/api/vault/overview').then(() => setVaultOk(true)).catch(() => setVaultOk(false));
  }, []);
  const items: Array<{ done: boolean; label: string; to: string; cta: string }> = [
    { done: home.providers.some((p) => p.available), label: 'Connect an agent', to: '#/settings', cta: 'Open settings' },
    { done: home.projects.length > 0, label: 'Add your first project', to: '#/projects', cta: 'Add a project' },
    { done: vaultOk === true, label: 'Connect your notes vault', to: '#/brain', cta: 'Open Brain' },
  ];
  if (vaultOk === null || items.every((i) => i.done)) return null;
  const left = items.filter((i) => !i.done).length;
  return (
    <Panel
      title={`Finish setting up, ${left} to go`}
      header={
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            try {
              window.localStorage.removeItem(SETUP_KEY);
            } catch {
              /* storage blocked */
            }
            window.location.reload();
          }}
        >
          Run the setup tour
        </Button>
      }
    >
      <ul className="divide-y divide-os-line">
        {items.map((i) => (
          <li key={i.label} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <span className={i.done ? 'text-sm text-os-muted line-through' : 'text-sm font-medium text-os-text'}>{i.label}</span>
            {i.done ? <span className="text-xs text-os-ok">Done</span> : <a className={link} href={i.to}>{i.cta}</a>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ---- page --------------------------------------------------------------------------------------

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function profileName(): string {
  try {
    return window.localStorage.getItem('zakos_profile_name')?.trim() ?? '';
  } catch {
    return '';
  }
}

function summary(h: HomeData): string {
  const need = h.attention.approvals + h.attention.runsAwaiting.length + h.attention.failedRuns.length;
  const running = h.running.sessions.length + h.running.runs.length;
  const parts: string[] = [];
  parts.push(need === 0 ? 'Nothing needs you' : `${need} ${need === 1 ? 'item needs' : 'items need'} you`);
  parts.push(running === 0 ? 'no agents running' : `${running} running`);
  return parts.join(', ') + '.';
}

export default function HomePage({ navigate }: ModuleProps) {
  const { home, error } = useHome();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => setProjects([]));
  }, []);
  const labelOf = useMemo(() => {
    const map = new Map(home?.providers.map((p) => [p.id, p.label]));
    return (id: string) => map.get(id) ?? id;
  }, [home]);

  return (
    <PageFrame title="Home">
      <div className="h-full overflow-y-auto p-5">
        <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] gap-5">
          {error && !home && <p className="text-sm text-os-danger" role="alert">{error}</p>}
          {!home && !error && <p className="text-sm text-os-muted">Loading</p>}
          {home && (
            <>
              <section className="relative -mx-5 -mt-5 h-[400px] overflow-hidden" aria-label="Your projects as a map">
                <Territory home={home} />
                <div className="pointer-events-none absolute left-8 top-8 max-w-[34rem]">
                  <h2 className="os-display text-[64px] leading-[0.95] text-os-text">
                    {greeting()}
                    {profileName() ? `, ${profileName()}` : ''}.
                  </h2>
                  <p className="mt-3 text-[16px] text-os-muted">{summary(home)}</p>
                </div>
              </section>
              <div className="relative z-10 -mt-14">
                <QuickStart home={home} projects={projects} navigate={navigate} />
              </div>
              <SetupChecklist home={home} />
              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div className="grid content-start gap-5">
                  <Attention a={home.attention} />
                  <Running r={home.running} labelOf={labelOf} />
                  <Pinned home={home} navigate={navigate} />
                  <CatchUp items={home.activity} />
                  <Panel bare title="Usage by provider">
                    <div className="grid gap-4">
                      {home.providers.map((p) => (
                        <ProviderCard key={p.id} p={p} />
                      ))}
                    </div>
                  </Panel>
                </div>
                <div className="grid content-start gap-5">
                  <Schedules items={home.schedules} />
                  <Limits l={home.limits} />
                  <Activity items={home.activity} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
