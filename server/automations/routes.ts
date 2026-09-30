import type { Express, NextFunction, Request, Response } from 'express';
import { audit } from '../audit';
import { isTrustedLocalRequest } from '../terminal/pty';
import { getTemplate } from '../workflows/templates';
import { parseCron } from './cron';
import { createSchedule, deleteSchedule, getSchedule, listSchedules, updateSchedule, type Trigger } from './schedules';
import { nextFire } from './scheduler';

/** Schedules start agents unattended, so these routes are local-only like the terminal. */
function localOnly(req: Request, res: Response, next: NextFunction) {
  if (!isTrustedLocalRequest(req)) {
    res.status(403).json({ success: false, error: 'Local access only' });
    return;
  }
  next();
}

const fail = (res: Response, status: number, error: string) => res.status(status).json({ success: false, error });
const pid = (req: Request) => String(req.params.id);
const withNext = <T extends { id: string }>(s: T) => ({ ...s, nextAt: nextFire(s as never) });

/** Returns a validated trigger, or an error message. */
function parseTrigger(raw: any): { trigger: Trigger } | { error: string } {
  if (raw?.kind === 'commit') return { trigger: { kind: 'commit' } };
  if (raw?.kind === 'cron' && typeof raw.cron === 'string') {
    try {
      parseCron(raw.cron);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
    return { trigger: { kind: 'cron', cron: raw.cron.trim().replace(/\s+/g, ' ') } };
  }
  return { error: 'trigger must be { kind: "cron", cron } or { kind: "commit" }' };
}

export function mountScheduleRoutes(app: Express) {
  app.use('/api/workflow-schedules', localOnly);

  app.get('/api/workflow-schedules', (_req: Request, res: Response) => {
    res.json({ success: true, schedules: listSchedules().map(withNext) });
  });

  app.post('/api/workflow-schedules', (req: Request, res: Response) => {
    const template = getTemplate(String(req.body?.templateId ?? ''));
    if (!template) return fail(res, 404, 'Template not found');
    const parsed = parseTrigger(req.body?.trigger);
    if ('error' in parsed) return fail(res, 400, parsed.error);
    const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name : template.name;
    const schedule = createSchedule(name, template.id, parsed.trigger);
    audit('schedule-create', 'owner', `${schedule.name}: ${JSON.stringify(schedule.trigger)}`);
    res.status(201).json({ success: true, schedule: withNext(schedule) });
  });

  app.patch('/api/workflow-schedules/:id', (req: Request, res: Response) => {
    if (!getSchedule(pid(req))) return fail(res, 404, 'Schedule not found');
    let trigger: Trigger | undefined;
    if (req.body?.trigger !== undefined) {
      const parsed = parseTrigger(req.body.trigger);
      if ('error' in parsed) return fail(res, 400, parsed.error);
      trigger = parsed.trigger;
    }
    const s = updateSchedule(pid(req), {
      name: typeof req.body?.name === 'string' ? req.body.name : undefined,
      enabled: typeof req.body?.enabled === 'boolean' ? req.body.enabled : undefined,
      trigger,
    });
    res.json({ success: true, schedule: s && withNext(s) });
  });

  app.delete('/api/workflow-schedules/:id', (req: Request, res: Response) => {
    if (!deleteSchedule(pid(req))) return fail(res, 404, 'Schedule not found');
    res.json({ success: true });
  });
}
