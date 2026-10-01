import type { Express, Request, Response } from 'express';
import { cronMatches, parseCron } from '../automations/cron';
import { listSchedules } from '../automations/schedules';
import { getRun } from '../workflows/engine';
import { getQuiet } from '../automations/scheduler';
import { handle, kvSet, localOnly } from './common';

/** Every time an enabled cron automation will fire in the next few weeks, for the calendar view. */
export function mountCalendarRoutes(app: Express) {
  app.use(['/api/automation-calendar', '/api/automation-quiet'], localOnly);

  app.get('/api/automation-quiet', (_req: Request, res: Response) => res.json({ success: true, quiet: getQuiet() }));
  app.put('/api/automation-quiet', handle((req: Request, res: Response) => {
    const t = /^([01]\d|2[0-3]):[0-5]\d$/;
    const from = String(req.body?.from ?? '');
    const to = String(req.body?.to ?? '');
    if (!t.test(from) || !t.test(to)) throw new Error('Use times like 22:00');
    kvSet('automations.quiet', { enabled: req.body?.enabled === true, from, to });
    res.json({ success: true });
  }));

  app.get('/api/automation-calendar', handle((req: Request, res: Response) => {
    const days = Math.min(42, Math.max(7, Number(req.query.days) || 35));
    const start = new Date();
    start.setSeconds(0, 0);
    const end = start.getTime() + days * 86_400_000;
    const events: Array<{ id: string; name: string; at: number; kind: 'planned' | 'ran'; status?: string }> = [];
    for (const s of listSchedules()) {
      for (const h of s.history ?? []) if (h.at >= Date.now() - 28 * 86_400_000) events.push({ id: s.id, name: s.name, at: h.at, kind: 'ran', status: getRun(h.runId)?.status ?? 'deleted' });
      if (!s.enabled || s.trigger.kind !== 'cron') continue;
      let cron;
      try {
        cron = parseCron(s.trigger.cron);
      } catch {
        continue;
      }
      let count = 0;
      for (let t = start.getTime() + 60_000; t <= end && count < 200; t += 60_000) {
        if (cronMatches(cron, new Date(t))) {
          events.push({ id: s.id, name: s.name, at: t, kind: 'planned' });
          count++;
        }
      }
    }
    res.json({ success: true, events: events.sort((a, b) => a.at - b.at) });
  }));
}
