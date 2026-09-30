import type { Express, NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { Broadcast } from '../agents/runner';
import { isTrustedLocalRequest } from '../terminal/pty';
import { getAdapter } from '../agents/adapters';
import { approveRun, deleteRun, getRun, listRuns, startRun, stopRun } from './engine';

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

export function mountWorkflowRoutes(app: Express, broadcast: Broadcast) {
  app.use('/api/workflows', localOnly);

  app.get('/api/workflows', (_req: Request, res: Response) => {
    res.json({ success: true, runs: listRuns() });
  });

  app.get('/api/workflows/:id', (req: Request, res: Response) => {
    const run = getRun(String(req.params.id));
    if (!run) return fail(res, 404, 'Run not found');
    res.json({ success: true, run });
  });

  app.post('/api/workflows', async (req: Request, res: Response) => {
    const goal = str(req.body?.goal);
    if (!goal) return fail(res, 400, 'goal is required');
    const rawCwd = req.body?.cwd;
    if (rawCwd !== undefined && rawCwd !== '' && typeof rawCwd !== 'string') return fail(res, 400, 'cwd must be a string');
    const cwd = path.resolve(str(rawCwd) ?? process.cwd());
    let isDir = false;
    try {
      isDir = fs.statSync(cwd).isDirectory();
    } catch {
      /* missing or unreadable */
    }
    if (!isDir) return fail(res, 400, 'cwd does not exist or is not a directory');
    // Every role must name a real, installed agent; a typo or missing CLI fails here, not mid-run.
    const agents: Record<string, string> = {};
    for (const role of ['orchestrator', 'worker', 'reviewer']) {
      const id = str(req.body?.agents?.[role]);
      if (!id) continue;
      const adapter = getAdapter(id);
      if (!adapter) return fail(res, 400, `Unknown agent for ${role}: ${id}`);
      const status = await adapter.detect();
      if (!status.available) return fail(res, 400, `${adapter.label} is not available (${status.reason ?? 'not installed'})`);
      agents[role] = id;
    }
    try {
      const run = startRun(goal.slice(0, 4000), cwd, str(req.body?.projectId)?.slice(0, 64), { approval: req.body?.approval !== false, agents: agents as never }, broadcast);
      res.status(201).json({ success: true, run });
    } catch (err) {
      fail(res, 500, err instanceof Error ? err.message : String(err));
    }
  });

  app.post('/api/workflows/:id/approve', (req: Request, res: Response) => {
    if (!getRun(String(req.params.id))) return fail(res, 404, 'Run not found');
    const edits = Array.isArray(req.body?.tasks) ? req.body.tasks : undefined;
    const result = approveRun(String(req.params.id), edits);
    if (!result.ok) return fail(res, 409, result.error);
    res.json({ success: true });
  });

  app.post('/api/workflows/:id/stop', (req: Request, res: Response) => {
    if (!getRun(String(req.params.id))) return fail(res, 404, 'Run not found');
    res.json({ success: true, stopped: stopRun(String(req.params.id)) });
  });

  app.delete('/api/workflows/:id', (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!getRun(id)) return fail(res, 404, 'Run not found');
    if (!deleteRun(id)) return fail(res, 409, 'Stop the run before deleting it');
    res.json({ success: true });
  });
}
