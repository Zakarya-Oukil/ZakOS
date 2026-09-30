import type { Express, NextFunction, Request, Response } from 'express';
import type { Broadcast } from '../agents/runner';
import { isTrustedLocalRequest } from '../terminal/pty';
import { approveRun, deleteRun, getRun, listRuns, stopRun } from './engine';
import { launchRun, parseLaunch, toBody } from './launch';
import { listNotifications, markAllRead } from '../notifications';
import { createTemplate, deleteTemplate, getTemplate, listTemplates, markTemplateRun, updateTemplate } from './templates';

/** Runs start agents that edit files, so these routes are local-only like the terminal. */
function localOnly(req: Request, res: Response, next: NextFunction) {
  if (!isTrustedLocalRequest(req)) {
    res.status(403).json({ success: false, error: 'Local access only' });
    return;
  }
  next();
}

const fail = (res: Response, status: number, error: string) => res.status(status).json({ success: false, error });
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const pid = (req: Request) => String(req.params.id);

export function mountWorkflowRoutes(app: Express, broadcast: Broadcast) {
  app.use('/api/workflows', localOnly);
  app.use('/api/workflow-templates', localOnly);
  app.use('/api/notifications', localOnly);

  app.get('/api/notifications', (_req: Request, res: Response) => {
    res.json({ success: true, notifications: listNotifications() });
  });

  app.post('/api/notifications/read', (_req: Request, res: Response) => {
    markAllRead();
    res.json({ success: true });
  });

  // ---- runs ---------------------------------------------------------------------------------

  app.get('/api/workflows', (_req: Request, res: Response) => {
    res.json({ success: true, runs: listRuns() });
  });

  app.get('/api/workflows/:id', (req: Request, res: Response) => {
    const run = getRun(pid(req));
    if (!run) return fail(res, 404, 'Run not found');
    res.json({ success: true, run });
  });

  app.post('/api/workflows', async (req: Request, res: Response) => {
    const parsed = await parseLaunch(req.body);
    if (!parsed.ok) return fail(res, parsed.status, parsed.error);
    try {
      res.status(201).json({ success: true, run: launchRun(parsed.input, broadcast) });
    } catch (err) {
      fail(res, 500, err instanceof Error ? err.message : String(err));
    }
  });

  app.post('/api/workflows/:id/approve', (req: Request, res: Response) => {
    if (!getRun(pid(req))) return fail(res, 404, 'Run not found');
    const edits = Array.isArray(req.body?.tasks) ? req.body.tasks : undefined;
    const result = approveRun(pid(req), edits);
    if (!result.ok) return fail(res, 409, result.error);
    res.json({ success: true });
  });

  app.post('/api/workflows/:id/stop', (req: Request, res: Response) => {
    if (!getRun(pid(req))) return fail(res, 404, 'Run not found');
    res.json({ success: true, stopped: stopRun(pid(req)) });
  });

  app.delete('/api/workflows/:id', (req: Request, res: Response) => {
    if (!getRun(pid(req))) return fail(res, 404, 'Run not found');
    if (!deleteRun(pid(req))) return fail(res, 409, 'Stop the run before deleting it');
    res.json({ success: true });
  });

  // ---- templates ----------------------------------------------------------------------------

  app.get('/api/workflow-templates', (_req: Request, res: Response) => {
    res.json({ success: true, templates: listTemplates() });
  });

  app.post('/api/workflow-templates', async (req: Request, res: Response) => {
    const name = str(req.body?.name);
    if (!name) return fail(res, 400, 'name is required');
    const parsed = await parseLaunch(req.body);
    if (!parsed.ok) return fail(res, parsed.status, parsed.error);
    res.status(201).json({ success: true, template: createTemplate(name, parsed.input) });
  });

  app.patch('/api/workflow-templates/:id', async (req: Request, res: Response) => {
    const current = getTemplate(pid(req));
    if (!current) return fail(res, 404, 'Template not found');
    // Fields left out keep their stored value, so a rename does not need the whole form.
    const parsed = await parseLaunch({ ...toBody(current.input), ...req.body });
    if (!parsed.ok) return fail(res, parsed.status, parsed.error);
    res.json({ success: true, template: updateTemplate(pid(req), { name: str(req.body?.name), input: parsed.input }) });
  });

  app.delete('/api/workflow-templates/:id', (req: Request, res: Response) => {
    if (!deleteTemplate(pid(req))) return fail(res, 404, 'Template not found');
    res.json({ success: true });
  });

  /** Runs a template. Stored input is revalidated, since agents or folders may have changed since it was saved. */
  app.post('/api/workflow-templates/:id/run', async (req: Request, res: Response) => {
    const template = getTemplate(pid(req));
    if (!template) return fail(res, 404, 'Template not found');
    const override = str(req.body?.goal);
    const parsed = await parseLaunch({ ...toBody(template.input), ...(override ? { goal: override } : {}) });
    if (!parsed.ok) return fail(res, parsed.status, parsed.error);
    markTemplateRun(template.id);
    res.status(201).json({ success: true, run: launchRun(parsed.input, broadcast) });
  });
}
