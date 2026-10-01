import type { Express, Request, Response } from 'express';
import { getSnapshots } from '../agents/usage';
import { audit } from '../audit';
import { handle, kvGet, kvSet, localOnly, osdb } from './common';

export interface Budget {
  dailyUsd: number | null;
  monthlyUsd: number | null;
  /** Pause scheduled automations once a budget is used up. */
  pauseAutomations: boolean;
}

const DEFAULT: Budget = { dailyUsd: null, monthlyUsd: null, pauseAutomations: true };
export const getBudget = (): Budget => ({ ...DEFAULT, ...kvGet<Partial<Budget>>('usage.budget', {}) });

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function spentSince(since: number): number {
  const r = osdb.prepare('SELECT COALESCE(SUM(cost_usd), 0) AS c FROM usage WHERE ts >= ?').get(since) as { c: number };
  return r.c;
}

/** True when a budget the owner set is used up and automations should hold off. */
export function budgetExhausted(): { exhausted: boolean; reason?: string } {
  const b = getBudget();
  if (!b.pauseAutomations) return { exhausted: false };
  const now = Date.now();
  if (b.dailyUsd !== null && spentSince(startOfDay(now)) >= b.dailyUsd) return { exhausted: true, reason: `Daily budget of $${b.dailyUsd.toFixed(2)} is used up` };
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  if (b.monthlyUsd !== null && spentSince(monthStart.getTime()) >= b.monthlyUsd) return { exhausted: true, reason: `Monthly budget of $${b.monthlyUsd.toFixed(2)} is used up` };
  return { exhausted: false };
}

export function mountUsageRoutes(app: Express) {
  app.use('/api/usage', localOnly);

  app.get('/api/usage/summary', handle((req: Request, res: Response) => {
    const days = Math.min(120, Math.max(1, Number(req.query.days) || 30));
    const since = startOfDay(Date.now() - (days - 1) * 86_400_000);
    const daily = osdb
      .prepare(
        `SELECT date(ts/1000, 'unixepoch', 'localtime') AS day, agent, SUM(cost_usd) AS cost, SUM(input + output) AS tokens, COUNT(*) AS runs
         FROM usage WHERE ts >= ? GROUP BY day, agent ORDER BY day`,
      )
      .all(since);
    const models = osdb
      .prepare('SELECT COALESCE(model, \'unknown\') AS model, SUM(cost_usd) AS cost, SUM(input + output) AS tokens, COUNT(*) AS runs FROM usage WHERE ts >= ? GROUP BY model ORDER BY cost DESC')
      .all(since);
    // Who used what: the session behind each run, with workflow and automation sessions told apart by title.
    const sessions = osdb
      .prepare(
        `SELECT u.session_id AS id, COALESCE(s.title, '(deleted session)') AS title, COALESCE(s.agent, u.agent) AS agent,
                SUM(u.cost_usd) AS cost, SUM(u.input + u.output) AS tokens, COUNT(*) AS runs
         FROM usage u LEFT JOIN sessions s ON s.id = u.session_id WHERE u.ts >= ? GROUP BY u.session_id ORDER BY cost DESC LIMIT 12`,
      )
      .all(since);
    const now = Date.now();
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const spentToday = spentSince(startOfDay(now));
    const spentMonth = spentSince(monthStart.getTime());
    // Projection: average daily spend this month carried to the month's end.
    const dayOfMonth = new Date(now).getDate();
    const daysInMonth = new Date(new Date(now).getFullYear(), new Date(now).getMonth() + 1, 0).getDate();
    const forecastMonth = dayOfMonth > 0 ? (spentMonth / dayOfMonth) * daysInMonth : 0;
    res.json({
      success: true,
      days,
      daily,
      models,
      sessions,
      spentToday,
      spentMonth,
      forecastMonth,
      budget: getBudget(),
      exhausted: budgetExhausted(),
      windows: getSnapshots(),
    });
  }));

  app.put('/api/usage/budget', handle((req: Request, res: Response) => {
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 100_000 ? v : null);
    const next: Budget = { dailyUsd: num(req.body?.dailyUsd), monthlyUsd: num(req.body?.monthlyUsd), pauseAutomations: req.body?.pauseAutomations !== false };
    kvSet('usage.budget', next);
    audit('budget-set', 'owner', `Budget: daily ${next.dailyUsd ?? 'none'}, monthly ${next.monthlyUsd ?? 'none'}`);
    res.json({ success: true, budget: next });
  }));
}
