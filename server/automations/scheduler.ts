import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Broadcast } from '../agents/runner';
import { audit } from '../audit';
import { notify } from '../notifications';
import { getRun } from '../workflows/engine';
import { budgetExhausted } from '../os/usageApi';
import { launchRun, parseLaunch, toBody } from '../workflows/launch';
import { LimitError } from '../workflows/limits';
import { getTemplate, markTemplateRun } from '../workflows/templates';
import { cronMatches, nextRun, parseCron } from './cron';
import { getSchedule, listSchedules, recordSchedule, type Schedule } from './schedules';
import { kvGet } from '../os/common';

const ACTIVE = new Set(['planning', 'awaiting_approval', 'running', 'reviewing', 'reporting']);

function headOf(cwd: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile('git', ['rev-parse', 'HEAD'], { cwd, windowsHide: true, timeout: 5000 }, (err, stdout) => resolve(err ? undefined : stdout.trim() || undefined));
  });
}

/** The next time a schedule will fire, for display; null for commit triggers or invalid cron. */
export function nextFire(s: Schedule): number | null {
  if (s.trigger.kind !== 'cron' || !s.enabled) return null;
  try {
    return nextRun(parseCron(s.trigger.cron))?.getTime() ?? null;
  } catch {
    return null;
  }
}


export interface Quiet {
  enabled: boolean;
  from: string;
  to: string;
}

export const getQuiet = (): Quiet => ({ enabled: false, from: '22:00', to: '07:00', ...kvGet<Partial<Quiet>>('automations.quiet', {}) });

/** True inside the owner's quiet hours, which may wrap past midnight. Scheduled runs wait; Run now never does. */
export function inQuietHours(at: Date = new Date()): boolean {
  const q = getQuiet();
  if (!q.enabled) return false;
  const mins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const now = at.getHours() * 60 + at.getMinutes();
  const a = mins(q.from);
  const b = mins(q.to);
  return a <= b ? now >= a && now < b : now >= a || now < b;
}

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'graphify-out']);

/** Newest modification time under a folder, scanning a bounded number of files. */
function newestMtime(root: string): number {
  let newest = 0;
  let scanned = 0;
  const walk = (dir: string, depth: number) => {
    if (depth > 5 || scanned > 5000) return;
    let list: fs.Dirent[];
    try {
      list = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of list) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP.has(e.name)) walk(p, depth + 1);
      } else {
        scanned++;
        try {
          newest = Math.max(newest, fs.statSync(p).mtimeMs);
        } catch {
          /* vanished */
        }
      }
    }
  };
  walk(root, 0);
  return newest;
}

/** Called by the webhook receiver: starts every enabled automation listening on that webhook name. */
export async function fireWebhook(name: string, broadcast: Broadcast): Promise<number> {
  let n = 0;
  for (const s of listSchedules()) {
    if (!s.enabled || s.trigger.kind !== 'webhook' || s.trigger.name !== name) continue;
    const r = await fire(s, `Webhook ${name}`, broadcast);
    if (r.ok) n++;
  }
  return n;
}

export type FireResult = { ok: true; runId: string } | { ok: false; error: string };

async function fire(s: Schedule, why: string, broadcast: Broadcast): Promise<FireResult> {
  // A budget the owner set holds scheduled runs back; Run now is always the owner's call.
  if (!why.startsWith('Started by you')) {
    if (inQuietHours()) {
      recordSchedule(s.id, { lastError: 'Skipped: quiet hours' });
      return { ok: false, error: 'Skipped during quiet hours' };
    }
    const held = budgetExhausted();
    if (held.exhausted) {
      recordSchedule(s.id, { lastError: held.reason });
      return { ok: false, error: held.reason ?? 'Budget used up' };
    }
  }
  const template = getTemplate(s.templateId);
  if (!template) {
    recordSchedule(s.id, { lastError: 'Template no longer exists' });
    return { ok: false, error: 'Its template no longer exists' };
  }
  // A run from this schedule still going means the last one overran; skip rather than pile up.
  const prev = s.lastRunId ? getRun(s.lastRunId) : undefined;
  if (prev && ACTIVE.has(prev.status)) return { ok: false, error: 'The previous run from this automation is still going' };

  const project = path.basename(template.input.cwd);
  try {
    // Stored input is revalidated: agents or folders may have changed since the template was saved.
    const parsed = await parseLaunch(toBody(template.input));
    if (!parsed.ok) throw new Error(parsed.error);
    const run = launchRun(parsed.input, broadcast);
    markTemplateRun(template.id);
    recordSchedule(s.id, { lastRunAt: Date.now(), lastRunId: run.id, lastError: undefined, addRun: { runId: run.id, at: Date.now(), why } });
    audit('schedule-fire', 'scheduler', `${s.name}: ${why}`, { runId: run.id, project });
    notify(`Scheduled run started: ${s.name}`, why, broadcast, { module: 'workflows', route: [run.id] }, { native: false });
    return { ok: true, runId: run.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordSchedule(s.id, { lastError: message });
    audit('schedule-error', 'scheduler', `${s.name}: ${message}`, { project });
    // A limit hit is expected and self-heals; anything else deserves a nudge.
    if (!(err instanceof LimitError)) notify(`Schedule failed: ${s.name}`, message, broadcast, undefined, { native: false });
    return { ok: false, error: message };
  }
}

/** Starts an automation's run immediately, on the owner's request. */
export const fireNow = (s: Schedule, broadcast: Broadcast) => fire(s, 'Started by you (Run now)', broadcast);

let lastMinute = -1;

async function tick(broadcast: Broadcast) {
  const now = new Date();
  const minute = Math.floor(now.getTime() / 60000);
  if (minute === lastMinute) return;
  lastMinute = minute;

  for (const s of listSchedules()) {
    if (!s.enabled) continue;
    try {
      if (s.trigger.kind === 'cron') {
        if (cronMatches(parseCron(s.trigger.cron), now)) await fire(s, `Schedule ${s.trigger.cron}`, broadcast);
      } else if (s.trigger.kind === 'files') {
        const cwd = getTemplate(s.templateId)?.input.cwd;
        if (!cwd) continue;
        const m = newestMtime(cwd);
        if (!s.lastMtime) recordSchedule(s.id, { lastMtime: m }); // the first look is a baseline, not a trigger
        else if (m > s.lastMtime) {
          // Changed: wait until the folder has been quiet for a minute, so one editing session is one run.
          if (s.pendingMtime !== m) recordSchedule(s.id, { pendingMtime: m, pendingSince: Date.now() });
          else if (Date.now() - (s.pendingSince ?? Date.now()) >= 60_000) {
            recordSchedule(s.id, { lastMtime: m, pendingMtime: 0, pendingSince: 0 });
            await fire(s, 'Files changed', broadcast);
          }
        }
      } else if (s.trigger.kind === 'chain') {
        const prev = getSchedule(s.trigger.after);
        const runId = prev?.lastRunId;
        const run = runId ? getRun(runId) : undefined;
        if (run && run.status === 'done' && runId !== s.lastSeenRun) {
          recordSchedule(s.id, { lastSeenRun: runId });
          await fire(s, `After ${prev!.name} finished`, broadcast);
        }
      } else if (s.trigger.kind === 'commit') {
        const cwd = getTemplate(s.templateId)?.input.cwd;
        if (!cwd) continue;
        const head = await headOf(cwd);
        if (!head) continue;
        if (!s.lastHead) recordSchedule(s.id, { lastHead: head }); // first look is a baseline, not a trigger
        else if (head !== s.lastHead) {
          recordSchedule(s.id, { lastHead: head });
          await fire(s, `New commit ${head.slice(0, 7)}`, broadcast);
        }
      }
    } catch (err) {
      recordSchedule(s.id, { lastError: err instanceof Error ? err.message : String(err) });
    }
  }
}

/** Checks schedules every 20s, firing each at most once per clock minute. Runs while the server is up. */
export function startScheduler(broadcast: Broadcast) {
  const timer = setInterval(() => void tick(broadcast), 20_000);
  timer.unref();
}
