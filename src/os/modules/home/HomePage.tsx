import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, ArrowUp, Bell, CalendarClock, GitBranch, ShieldCheck } from 'lucide-react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Panel, StatusDot } from '../../ui';
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
  'rounded-[var(--os-radius)] border border-os-line bg-os-bg px-2 text-sm text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';
const primary =
  'inline-flex h-8 items-center gap-2 rounded-[var(--os-radius)] bg-os-cyan px-3 text-sm font-medium text-os-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40';
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
  const [agent, setAgent] = useState('claude');
  const [projectId, setProjectId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agents.some((a) => a.id === agent) && agents[0]) setAgent(agents[0].id);
  }, [agents, agent]);
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
      const session = await agentsApi.create(agent, cwd, text.replace(/\s+/g, ' ').slice(0, 60));
      await agentsApi.send(session.id, text);
      navigate('agents', agent, session.id);
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
          <select aria-label="Agent" value={agent} onChange={(e) => setAgent(e.target.value)} className={cx(field, 'h-8')}>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <select aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={cx(field, 'h-8 min-w-0 max-w-[14rem]')}>
            {projects.length === 0 && <option value="">Zak OS folder</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button type="submit" className={cx(primary, 'ml-auto')} disabled={!prompt.trim() || busy}>
            <ArrowUp size={14} aria-hidden /> {busy ? 'Starting' : 'Start'}
          </button>
        </div>
        <p className="text-xs text-os-muted">Starts a real session you can keep using in Agents. Ctrl+Enter also starts it.</p>
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
        <AlertTriangle size={15} aria-hidden className="shrink-0 text-os-danger" />
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
    <Panel title="Needs attention" header={items.length > 0 ? <StatusDot status="error" label="Needs attention" /> : undefined}>
      {items.length === 0 ? <Empty>Nothing needs you right now.</Empty> : <ul className="grid gap-2 text-sm">{items}</ul>}
    </Panel>
  );
}

// ---- running now -------------------------------------------------------------------------------

function Running({ r, labelOf }: { r: HomeData['running']; labelOf: (id: string) => string }) {
  const none = r.sessions.length === 0 && r.runs.length === 0;
  return (
    <Panel title="Running now">
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
    <div className={cx('rounded-[var(--os-radius)] border border-os-line p-3', p.reportsUsage && 'md:col-span-2 lg:col-span-1 xl:col-span-2')}>
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
          <p className="text-[11px] text-os-muted">Reading from {timeAgo(p.windows.updated)}. It refreshes after each Claude run.</p>
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
      <p className="mt-2 text-[11px] leading-relaxed text-os-muted">
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
    <Panel title="Schedules" header={<a className="text-xs text-os-muted hover:text-os-text" href="#/workflows">Manage</a>}>
      {items.length === 0 ? (
        <Empty>No schedules yet. Save a workflow as a template, then schedule it.</Empty>
      ) : (
        <ul className="grid gap-2.5 text-sm">
          {items.map((s) => (
            <li key={s.id} className="grid gap-0.5">
              <span className="flex items-center gap-2">
                <CalendarClock size={14} aria-hidden className={cx('shrink-0', s.enabled ? 'text-os-cyan' : 'text-os-muted')} />
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

function Projects({ items }: { items: HomeData['projects'] }) {
  return (
    <Panel title="Projects" header={<a className="text-xs text-os-muted hover:text-os-text" href="#/projects">Manage</a>}>
      {items.length === 0 ? (
        <Empty>No projects yet. Add one on the Projects page.</Empty>
      ) : (
        <ul className="grid gap-2 text-sm">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-os-text">{p.name}</span>
              <span className="shrink-0 text-xs text-os-muted">
                {!p.exists ? 'folder missing' : p.graphUpdated ? `graph ${timeAgo(p.graphUpdated)}` : 'no graph'}
                {p.lastSessionAt ? ` · active ${timeAgo(p.lastSessionAt)}` : ''}
              </span>
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
    <Panel title="Recent activity" header={<a className="text-xs text-os-muted hover:text-os-text" href="#/audit">Audit log</a>}>
      {items.length === 0 ? (
        <Empty>Nothing has happened yet.</Empty>
      ) : (
        <ul className="grid gap-1.5 text-xs">
          {items.map((e) => {
            const to = href(e);
            return (
              <li key={e.id} className="flex items-baseline gap-2">
                <span className="w-[4.5rem] shrink-0 text-os-muted">{timeAgo(e.ts)}</span>
                <span className="shrink-0 rounded-[var(--os-radius-sm)] bg-os-surface-2 px-1.5 py-0.5 font-os-mono text-[10px] text-os-muted">{e.kind}</span>
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
    <Panel title="Workflow limits today">
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

// ---- page --------------------------------------------------------------------------------------

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
      <div className="h-full overflow-y-auto p-4">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-4">
          {error && !home && <p className="text-sm text-os-danger" role="alert">{error}</p>}
          {!home && !error && <p className="text-sm text-os-muted">Loading</p>}
          {home && (
            <>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <QuickStart home={home} projects={projects} navigate={navigate} />
                <Attention a={home.attention} />
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div className="grid content-start gap-4">
                  <Running r={home.running} labelOf={labelOf} />
                  <Schedules items={home.schedules} />
                  <Limits l={home.limits} />
                </div>
                <Panel title="Usage by provider">
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {home.providers.map((p) => (
                      <ProviderCard key={p.id} p={p} />
                    ))}
                  </div>
                </Panel>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Projects items={home.projects} />
                <Activity items={home.activity} />
              </div>
            </>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
