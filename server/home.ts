import fs from 'node:fs';
import path from 'node:path';
import type { Express, NextFunction, Request, Response } from 'express';
import { getAdapter, listAdapters } from './agents/adapters';
import { listApprovals } from './agents/approvals';
import { isRunning } from './agents/runner';
import * as store from './agents/store';
import { getSnapshots } from './agents/usage';
import { nextFire } from './automations/scheduler';
import { listSchedules } from './automations/schedules';
import { listNotifications } from './notifications';
import * as projects from './projects/store';
import { isTrustedLocalRequest } from './terminal/pty';
import { getRun, listRuns } from './workflows/engine';
import { getLimits } from './workflows/limits';
import { getTemplate } from './workflows/templates';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ACTIVE = new Set(['planning', 'awaiting_approval', 'running', 'reviewing', 'reporting']);

function localOnly(req: Request, res: Response, next: NextFunction) {
  if (!isTrustedLocalRequest(req)) {
    res.status(403).json({ success: false, error: 'Local access only' });
    return;
  }
  next();
}

function graphUpdated(projectPath: string): number | null {
  try {
    return fs.statSync(path.join(projectPath, 'graphify-out', 'graph.json')).mtimeMs;
  } catch {
    return null;
  }
}

/** Everything the Home page shows, in one call so the page never shows half of it. */
async function build() {
  const now = Date.now();
  const runs = listRuns();
  const sessions = store.listSessions();

  const pendingApprovals = listApprovals().filter((a) => a.state === 'pending');
  const awaiting = runs.filter((r) => r.status === 'awaiting_approval');
  const failed = runs.filter((r) => r.status === 'error' && r.updated > now - DAY);
  const unread = listNotifications().filter((n) => !n.read);

  const liveSessions = sessions.filter((s) => isRunning(s.id)).map((s) => ({ id: s.id, agent: s.agent, title: s.title, cwd: s.cwd, updated: s.updated }));
  const activeRuns = runs.filter((r) => ACTIVE.has(r.status) && r.status !== 'awaiting_approval').map((r) => ({
    id: r.id,
    goal: r.goal,
    status: r.status,
    done: r.tasks.filter((t) => t.state === 'done').length,
    total: r.tasks.length,
  }));

  const schedules = listSchedules().map((s) => {
    const last = s.lastRunId ? getRun(s.lastRunId) : undefined;
    return {
      id: s.id,
      name: getTemplate(s.templateId)?.name ?? s.name,
      trigger: s.trigger,
      enabled: s.enabled,
      nextAt: nextFire(s),
      lastRunAt: s.lastRunAt ?? null,
      lastRunId: s.lastRunId ?? null,
      lastStatus: last?.status ?? null,
      lastError: s.lastError ?? null,
    };
  });

  const activity = store.queryAudit({ limit: 12 });

  const snapshots = getSnapshots();
  const providers = await Promise.all(
    listAdapters().map(async (a) => {
      const status = await a.detect();
      const snap = snapshots[a.id];
      return {
        id: a.id,
        label: a.label,
        available: status.available,
        version: status.version ?? null,
        reason: status.reason ?? null,
        // Only Claude reports tokens, cost and plan windows; for the others these are run counts only.
        reportsUsage: a.id === 'claude',
        trackedSince: store.usageTrackedSince(a.id),
        lastHour: store.usageSince(a.id, now - HOUR),
        last5Hours: store.usageSince(a.id, now - 5 * HOUR),
        lastDay: store.usageSince(a.id, now - DAY),
        lastWeek: store.usageSince(a.id, now - 7 * DAY),
        windows: snap ? { fiveHour: snap.fiveHour ?? null, sevenDay: snap.sevenDay ?? null, status: snap.status ?? null, updated: snap.updated } : null,
      };
    }),
  );

  const projectList = projects.listProjects().map((p) => {
    const root = path.resolve(p.path).toLowerCase();
    const last = sessions.find((s) => path.resolve(s.cwd).toLowerCase().startsWith(root));
    return { id: p.id, name: p.name, color: p.color, path: p.path, exists: fs.existsSync(p.path), graphUpdated: graphUpdated(p.path), lastSessionAt: last?.updated ?? null };
  });

  const limits = getLimits();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  return {
    attention: {
      approvals: pendingApprovals.length,
      runsAwaiting: awaiting.map((r) => ({ id: r.id, goal: r.goal })),
      failedRuns: failed.map((r) => ({ id: r.id, goal: r.goal, error: r.error ?? null })),
      unreadNotifications: unread.length,
    },
    running: { sessions: liveSessions, runs: activeRuns },
    schedules,
    activity,
    providers,
    projects: projectList,
    limits: {
      runsToday: runs.filter((r) => r.created >= midnight.getTime()).length,
      maxRunsPerDay: limits.maxRunsPerDay,
      activeRuns: runs.filter((r) => ACTIVE.has(r.status)).length,
      maxActiveRuns: limits.maxActiveRuns,
    },
    agents: providers.filter((p) => getAdapter(p.id)).map((p) => p.id),
  };
}

export function mountHomeRoutes(app: Express) {
  app.use('/api/home', localOnly);
  app.get('/api/home', async (_req: Request, res: Response) => {
    try {
      res.json({ success: true, home: await build() });
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
}
