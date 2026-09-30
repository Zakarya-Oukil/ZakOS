import type { Express, NextFunction, Request, Response } from 'express';
import { audit } from '../audit';
import * as projects from '../projects/store';
import { isTrustedLocalRequest } from '../terminal/pty';
import { allStates, readLog, scriptsOf, startApp, stateOf, stopApp } from './apps';
import { quickChecks, runHeavy, type HeavyCheck } from './health';

/** These start processes and run builds in project folders, so they are local-only like the terminal. */
function localOnly(req: Request, res: Response, next: NextFunction) {
  if (!isTrustedLocalRequest(req)) {
    res.status(403).json({ success: false, error: 'Local access only' });
    return;
  }
  next();
}

const fail = (res: Response, status: number, error: string) => res.status(status).json({ success: false, error });
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const HEAVY: HeavyCheck[] = ['typecheck', 'tests', 'audit'];

export function mountDevRoutes(app: Express) {
  app.use(['/api/apps', '/api/health'], localOnly);

  const projectOf = (req: Request, res: Response) => {
    const p = projects.getProject(String(req.params.projectId));
    if (!p) fail(res, 404, 'Project not found');
    return p;
  };

  app.get('/api/apps', (_req: Request, res: Response) => {
    res.json({ success: true, apps: allStates() });
  });

  app.get('/api/apps/:projectId', (req: Request, res: Response) => {
    const p = projectOf(req, res);
    if (!p) return;
    res.json({ success: true, scripts: scriptsOf(p.path), state: stateOf(p.id) });
  });

  app.post('/api/apps/:projectId/start', (req: Request, res: Response) => {
    const p = projectOf(req, res);
    if (!p) return;
    try {
      const state = startApp(p.id, { script: str(req.body?.script), command: str(req.body?.command) });
      audit('app-start', 'owner', state.command, { project: p.name });
      res.status(201).json({ success: true, state });
    } catch (err) {
      fail(res, 400, err instanceof Error ? err.message : String(err));
    }
  });

  app.post('/api/apps/:projectId/stop', (req: Request, res: Response) => {
    const p = projectOf(req, res);
    if (!p) return;
    const stopped = stopApp(p.id);
    if (stopped) audit('app-stop', 'owner', 'Stopped the app', { project: p.name });
    res.json({ success: true, stopped });
  });

  app.get('/api/apps/:projectId/log', (req: Request, res: Response) => {
    const p = projectOf(req, res);
    if (!p) return;
    res.json({ success: true, ...readLog(p.id, Math.max(0, Number(req.query.since) || 0)), state: stateOf(p.id) });
  });

  app.get('/api/health/:projectId', async (req: Request, res: Response) => {
    const p = projectOf(req, res);
    if (!p) return;
    try {
      res.json({ success: true, checks: await quickChecks(p.path) });
    } catch (err) {
      fail(res, 500, err instanceof Error ? err.message : String(err));
    }
  });

  app.post('/api/health/:projectId/run', async (req: Request, res: Response) => {
    const p = projectOf(req, res);
    if (!p) return;
    const check = req.body?.check as HeavyCheck;
    if (!HEAVY.includes(check)) return fail(res, 400, 'check must be typecheck, tests or audit');
    const result = await runHeavy(p.path, check);
    audit('health-run', 'owner', `${check}: ${result.summary}`, { project: p.name });
    res.json({ success: true, result });
  });
}
