import type { Express, Request, Response } from 'express';
import { queryAudit } from '../agents/store';
import { audit } from '../audit';
import { listRuns } from '../workflows/engine';
import { vaultService } from '../vault';
import { handle, kvGet, kvSet, localOnly, osdb, str } from './common';
import { listTasks } from './tasks';

export type Schedule = 'off' | 'daily' | 'weekly';

interface ReportSettings {
  schedule: Schedule;
  lastAt: number | null;
}

const DAY = 86_400_000;
const money = (n: number) => (n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`);
const tok = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
const dayStamp = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Builds a report for the last `days` days from the audit log, usage table, runs and task board. */
export function buildReport(days: number): { title: string; markdown: string } {
  const now = Date.now();
  const since = now - days * DAY;
  const title = `Zak OS report ${dayStamp(now)}`;

  const usage = osdb
    .prepare('SELECT COALESCE(SUM(cost_usd),0) AS cost, COALESCE(SUM(input+output),0) AS tokens, COUNT(*) AS runs FROM usage WHERE ts >= ?')
    .get(since) as { cost: number; tokens: number; runs: number };
  const byAgent = osdb.prepare('SELECT agent, SUM(cost_usd) AS cost, COUNT(*) AS runs FROM usage WHERE ts >= ? GROUP BY agent ORDER BY cost DESC').all(since) as Array<{ agent: string; cost: number; runs: number }>;

  const runs = listRuns().filter((r) => r.updated >= since);
  const done = runs.filter((r) => r.status === 'done');
  const failed = runs.filter((r) => r.status === 'error');
  const awaiting = runs.filter((r) => r.status === 'awaiting_approval');

  const entries = queryAudit({ limit: 200 }).filter((e) => e.ts >= since);
  const tasks = listTasks();
  const open = tasks.filter((t) => t.column !== 'done');
  const finished = tasks.filter((t) => t.column === 'done' && t.updated >= since);
  const overdue = open.filter((t) => t.due && t.due < now);

  const L: string[] = [];
  L.push(`# ${title}`, '', `Covers the last ${days} day${days === 1 ? '' : 's'}, to ${new Date(now).toLocaleString()}.`, '');
  L.push('## What was done', '');
  if (done.length === 0 && finished.length === 0) L.push('No workflow runs or tasks finished in this period.', '');
  for (const r of done) L.push(`- Workflow finished: ${r.goal}`);
  for (const t of finished) L.push(`- Task done: ${t.title}`);
  if (done.length || finished.length) L.push('');
  L.push(`Audit log recorded ${entries.length} event${entries.length === 1 ? '' : 's'} in this period.`, '');

  L.push('## Cost and usage', '');
  L.push(`- Spend: ${money(usage.cost)} across ${usage.runs} run${usage.runs === 1 ? '' : 's'}, ${tok(usage.tokens)} tokens`);
  for (const a of byAgent) L.push(`- ${a.agent}: ${money(a.cost)}, ${a.runs} run${a.runs === 1 ? '' : 's'}`);
  L.push('', 'Only runs made through Zak OS are counted. Plan limits cover all your use of each provider.', '');

  L.push('## Open items and risks', '');
  if (failed.length === 0 && awaiting.length === 0 && overdue.length === 0 && open.length === 0) L.push('Nothing is open.', '');
  for (const r of failed) L.push(`- Failed run: ${r.goal}${r.error ? ` (${r.error.slice(0, 120)})` : ''}`);
  for (const r of awaiting) L.push(`- Plan waiting for approval: ${r.goal}`);
  for (const t of overdue) L.push(`- Overdue task: ${t.title} (was due ${dayStamp(t.due!)})`);
  const rest = open.filter((t) => !overdue.includes(t));
  for (const t of rest.slice(0, 15)) L.push(`- ${t.column === 'doing' ? 'In progress' : t.column === 'waiting' ? 'Waiting on you' : t.column === 'review' ? 'In review' : 'Backlog'}: ${t.title}`);
  if (rest.length > 15) L.push(`- and ${rest.length - 15} more on the task board`);
  L.push('');

  L.push('## Next steps', '');
  const next: string[] = [];
  if (awaiting.length) next.push(`Approve or reject ${awaiting.length} waiting plan${awaiting.length === 1 ? '' : 's'}.`);
  if (failed.length) next.push(`Look at ${failed.length} failed run${failed.length === 1 ? '' : 's'} and decide whether to retry.`);
  if (overdue.length) next.push(`Re-plan ${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}.`);
  const high = open.filter((t) => t.priority === 'high' && !overdue.includes(t));
  if (high.length) next.push(`Start with high priority: ${high.slice(0, 3).map((t) => t.title).join('; ')}.`);
  if (next.length === 0) next.push('Nothing urgent. Pick the top card from Backlog.');
  for (const n of next) L.push(`- ${n}`);
  L.push('');
  return { title, markdown: L.join('\n') };
}

function saveToVault(title: string, markdown: string): string {
  const rel = `00 Reports/${title}.md`;
  const note = `---\ntitle: "${title}"\ntype: report\ncategory: reports\ntags:\n  - zak-os\n  - report\ncreated: ${dayStamp(Date.now())}\nupdated: ${dayStamp(Date.now())}\n---\n\n${markdown}`;
  void vaultService.saveNote(rel, note);
  return rel;
}

export function startReportScheduler() {
  const timer = setInterval(() => {
    const s = kvGet<ReportSettings>('reports.settings', { schedule: 'off', lastAt: null });
    if (s.schedule === 'off') return;
    const gap = s.schedule === 'daily' ? DAY : 7 * DAY;
    if (s.lastAt && Date.now() - s.lastAt < gap - 60_000) return;
    try {
      const r = buildReport(s.schedule === 'daily' ? 1 : 7);
      saveToVault(r.title, r.markdown);
      kvSet('reports.settings', { ...s, lastAt: Date.now() });
      audit('report', 'scheduler', `Saved ${r.title} to the vault`);
    } catch (err) {
      console.error('[reports] scheduled report failed:', err instanceof Error ? err.message : err);
    }
  }, 30 * 60_000);
  timer.unref();
}

export function mountReportRoutes(app: Express) {
  app.use('/api/reports', localOnly);

  app.get('/api/reports/settings', (_req: Request, res: Response) => {
    res.json({ success: true, settings: kvGet<ReportSettings>('reports.settings', { schedule: 'off', lastAt: null }) });
  });

  app.put('/api/reports/settings', handle((req, res) => {
    const schedule = req.body?.schedule;
    if (schedule !== 'off' && schedule !== 'daily' && schedule !== 'weekly') throw new Error('schedule must be off, daily or weekly');
    const cur = kvGet<ReportSettings>('reports.settings', { schedule: 'off', lastAt: null });
    kvSet('reports.settings', { ...cur, schedule });
    res.json({ success: true });
  }));

  app.post('/api/reports/generate', handle(async (req, res) => {
    const days = Math.min(90, Math.max(1, Number(req.body?.days) || 7));
    const r = buildReport(days);
    let saved: string | null = null;
    if (req.body?.save === true) {
      saved = saveToVault(r.title, r.markdown);
      const cur = kvGet<ReportSettings>('reports.settings', { schedule: 'off', lastAt: null });
      kvSet('reports.settings', { ...cur, lastAt: Date.now() });
      audit('report', 'owner', `Saved ${r.title} to the vault`);
    }
    res.json({ success: true, title: r.title, markdown: r.markdown, saved, note: str(req.body?.note) ?? undefined });
  }));
}
