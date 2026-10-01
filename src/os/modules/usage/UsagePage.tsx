import { useMemo, useState, type FormEvent } from 'react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Button, EmptyState, ErrorNote, Field, Panel, Segmented, Skeleton, SuccessNote, inputCls } from '../../ui';
import { api, money, tokens, useResource } from '../../lib/api';

interface Summary {
  days: number;
  daily: Array<{ day: string; agent: string; cost: number; tokens: number; runs: number }>;
  models: Array<{ model: string; cost: number; tokens: number; runs: number }>;
  sessions: Array<{ id: string; title: string; agent: string; cost: number; tokens: number; runs: number }>;
  spentToday: number;
  spentMonth: number;
  forecastMonth: number;
  budget: { dailyUsd: number | null; monthlyUsd: number | null; pauseAutomations: boolean };
  exhausted: { exhausted: boolean; reason?: string };
  windows: Record<string, { fiveHour?: { utilization: number; resetsAt: number }; sevenDay?: { utilization: number; resetsAt: number }; updated: number }>;
}

const untilReset = (unixSeconds: number) => {
  const m = Math.max(0, Math.round((unixSeconds * 1000 - Date.now()) / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h ${m % 60} min` : `${Math.round(h / 24)} days`;
};

/** Daily spend as bars. One series per day keeps it readable; hover or focus a bar for the exact figure. */
function DailyBars({ data, days }: { data: Summary['daily']; days: number }) {
  const rows = useMemo(() => {
    const byDay = new Map<string, { cost: number; runs: number }>();
    for (const r of data) {
      const cur = byDay.get(r.day) ?? { cost: 0, runs: 0 };
      byDay.set(r.day, { cost: cur.cost + r.cost, runs: cur.runs + r.runs });
    }
    const out: Array<{ day: string; cost: number; runs: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({ day: key, ...(byDay.get(key) ?? { cost: 0, runs: 0 }) });
    }
    return out;
  }, [data, days]);
  const max = Math.max(0.01, ...rows.map((r) => r.cost));
  const H = 150;
  const W = 960;
  const slot = W / rows.length;
  const bar = Math.max(5, Math.min(30, slot - 4));
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 24}`} role="img" aria-label={`Daily spend over the last ${days} days. Highest day ${money(max)}.`} className="block h-auto w-full">
        {[0.5, 1].map((f) => (
          <g key={f}>
            <line x1={0} x2={W} y1={H - H * f} y2={H - H * f} stroke="var(--os-line)" strokeWidth={1} strokeDasharray="3 4" />
          </g>
        ))}
        {rows.map((r, i) => {
          const h = Math.max(r.cost > 0 ? 3 : 1, (r.cost / max) * H);
          return (
            <g key={r.day}>
              <rect x={i * slot + (slot - bar) / 2} y={H - h} width={bar} height={h} rx={Math.min(4, bar / 2)} fill={r.cost > 0 ? 'var(--os-cyan)' : 'var(--os-line)'} tabIndex={0}>
                <title>{`${r.day}: ${money(r.cost)}, ${r.runs} run${r.runs === 1 ? '' : 's'}`}</title>
              </rect>
              {(i === 0 || i === rows.length - 1 || i === Math.floor(rows.length / 2)) && (
                <text x={Math.min(Math.max(i * slot, 0), W - 44)} y={H + 16} className="fill-[var(--os-muted)] text-xs">
                  {r.day.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">Bars show cost per day. The tallest is {money(max)}.</figcaption>
    </figure>
  );
}

function Bar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 overflow-hidden rounded-full bg-os-surface-2">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 90 ? 'var(--os-danger)' : pct >= 70 ? 'var(--os-amber)' : 'var(--os-cyan)' }} />
    </div>
  );
}

export default function UsagePage(_props: ModuleProps) {
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const { data, error, loading, reload } = useResource<Summary>(`/api/usage/summary?days=${days}`);
  const [daily, setDaily] = useState('');
  const [monthly, setMonthly] = useState('');
  const [pause, setPause] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (data && !seeded) {
    setDaily(data.budget.dailyUsd?.toString() ?? '');
    setMonthly(data.budget.monthlyUsd?.toString() ?? '');
    setPause(data.budget.pauseAutomations);
    setSeeded(true);
  }

  const saveBudget = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await api('/api/usage/budget', { method: 'PUT', body: { dailyUsd: daily ? Number(daily) : null, monthlyUsd: monthly ? Number(monthly) : null, pauseAutomations: pause } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      reload();
    } catch (err) {
      setFormError((err as Error).message);
    }
  };

  const claude = data?.windows.claude;
  const totalCost = data?.daily.reduce((n, r) => n + r.cost, 0) ?? 0;
  const totalRuns = data?.daily.reduce((n, r) => n + r.runs, 0) ?? 0;

  return (
    <PageFrame title="Usage and cost" actions={<Segmented<'7' | '30' | '90'> label="Period" value={days} onChange={setDays} options={[{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: '90', label: '90 days' }]} />}>
      <div className="h-full overflow-y-auto p-5">
        <div className="mx-auto grid max-w-[1180px] gap-5">
          {error && <ErrorNote>{error}</ErrorNote>}
          {data?.exhausted.exhausted && <ErrorNote>{data.exhausted.reason}. Scheduled automations are paused until it resets. Run now still works.</ErrorNote>}
          {loading && !data && (
            <div className="grid gap-4">
              <Skeleton className="h-52" />
              <Skeleton className="h-40" />
            </div>
          )}
          {data && (
            <>
              <Panel title={`Spend in the last ${data.days} days`}>
                <p className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <span className="font-os-sans text-[34px] font-extrabold leading-none tracking-tight text-os-text">{money(totalCost)}</span>
                  <span className="text-sm text-os-muted">{totalRuns} run{totalRuns === 1 ? '' : 's'} through Zak OS</span>
                </p>
                {totalRuns === 0 ? <EmptyState title="No tracked runs yet">Cost appears here after Claude Code runs through Zak OS. Other agents do not report cost.</EmptyState> : <DailyBars data={data.daily} days={data.days} />}
              </Panel>

              <div className="grid gap-5 lg:grid-cols-3">
                <Panel title="Today">
                  <p className="text-[26px] font-bold tracking-tight text-os-text">{money(data.spentToday)}</p>
                  {data.budget.dailyUsd !== null && (
                    <div className="mt-3 grid gap-1.5">
                      <Bar value={data.spentToday / data.budget.dailyUsd} label="Share of the daily budget used" />
                      <p className="text-xs text-os-muted">of a {money(data.budget.dailyUsd)} daily budget</p>
                    </div>
                  )}
                </Panel>
                <Panel title="This month">
                  <p className="text-[26px] font-bold tracking-tight text-os-text">{money(data.spentMonth)}</p>
                  {data.budget.monthlyUsd !== null && (
                    <div className="mt-3 grid gap-1.5">
                      <Bar value={data.spentMonth / data.budget.monthlyUsd} label="Share of the monthly budget used" />
                      <p className="text-xs text-os-muted">of a {money(data.budget.monthlyUsd)} monthly budget</p>
                    </div>
                  )}
                </Panel>
                <Panel title="Forecast for the month">
                  <p className="text-[26px] font-bold tracking-tight text-os-text">{money(data.forecastMonth)}</p>
                  <p className="mt-3 text-xs leading-relaxed text-os-muted">The month so far, extended at the same daily pace. It is an estimate, not a bill.</p>
                </Panel>
              </div>

              <div className="grid items-start gap-5 lg:grid-cols-2">
                <Panel title="By model" padded={false}>
                  {data.models.length === 0 ? (
                    <p className="p-4 text-sm text-os-muted">No model data yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-os-muted">
                          <th scope="col" className="px-4 py-2 font-medium">Model</th>
                          <th scope="col" className="px-2 py-2 text-right font-medium">Runs</th>
                          <th scope="col" className="px-2 py-2 text-right font-medium">Tokens</th>
                          <th scope="col" className="px-4 py-2 text-right font-medium">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.models.map((m) => (
                          <tr key={m.model} className="border-t border-os-line text-os-text">
                            <th scope="row" className="truncate px-4 py-2 text-left font-normal">{m.model}</th>
                            <td className="px-2 py-2 text-right tabular-nums">{m.runs}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{tokens(m.tokens)}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{money(m.cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Panel>
                <Panel title="Who used what" padded={false}>
                  {data.sessions.length === 0 ? (
                    <p className="p-4 text-sm text-os-muted">No sessions yet.</p>
                  ) : (
                    <ul>
                      {data.sessions.map((s) => (
                        <li key={s.id ?? s.title} className="flex items-center gap-3 border-t border-os-line px-4 py-2.5 first:border-t-0">
                          <a className="min-w-0 flex-1 truncate text-sm text-os-text hover:text-os-cyan" href={`#/agents/${s.agent}/${s.id}`}>
                            {s.title}
                          </a>
                          <span className="shrink-0 text-xs text-os-muted">{s.runs} run{s.runs === 1 ? '' : 's'}</span>
                          <span className="w-16 shrink-0 text-right text-sm tabular-nums text-os-text">{money(s.cost)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>

              <div className="grid items-start gap-5 lg:grid-cols-2">
                <Panel title="Claude plan windows">
                  {!claude ? (
                    <p className="text-sm text-os-muted">Appears after the next Claude run. The limits are whatever Claude last reported.</p>
                  ) : (
                    <div className="grid gap-4">
                      {([['5-hour limit', claude.fiveHour], ['Weekly limit', claude.sevenDay]] as const).map(([label, w]) =>
                        w ? (
                          <div key={label} className="grid gap-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="text-os-muted">{label}</span>
                              <span className="text-os-text">{w.resetsAt * 1000 < Date.now() ? 'reset' : `${Math.round(w.utilization * 100)}% used, resets in ${untilReset(w.resetsAt)}`}</span>
                            </div>
                            <Bar value={w.resetsAt * 1000 < Date.now() ? 0 : w.utilization} label={`${label} used`} />
                          </div>
                        ) : null,
                      )}
                    </div>
                  )}
                </Panel>

                <Panel title="Budgets">
                  <form onSubmit={saveBudget} className="grid gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Daily budget (USD)" htmlFor="b-day">
                        <input id="b-day" inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="No limit" className={inputCls} />
                      </Field>
                      <Field label="Monthly budget (USD)" htmlFor="b-month">
                        <input id="b-month" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="No limit" className={inputCls} />
                      </Field>
                    </div>
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-os-text">
                      <input type="checkbox" checked={pause} onChange={(e) => setPause(e.target.checked)} className="mt-0.5" />
                      <span>
                        Pause scheduled automations when a budget is used up
                        <span className="block text-xs text-os-muted">Run now and sessions you start yourself are never blocked.</span>
                      </span>
                    </label>
                    {formError && <ErrorNote>{formError}</ErrorNote>}
                    {saved && <SuccessNote>Budgets saved.</SuccessNote>}
                    <Button type="submit" variant="primary" size="sm" className="justify-self-start">
                      Save budgets
                    </Button>
                  </form>
                </Panel>
              </div>
              <p className="text-xs text-os-muted">Only runs made through Zak OS are counted, and only Claude Code reports cost. Plan limits cover all your Claude use.</p>
            </>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
