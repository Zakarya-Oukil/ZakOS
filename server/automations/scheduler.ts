import { execFile } from 'node:child_process';
import path from 'node:path';
import type { Broadcast } from '../agents/runner';
import { audit } from '../audit';
import { notify } from '../notifications';
import { getRun } from '../workflows/engine';
import { launchRun, parseLaunch, toBody } from '../workflows/launch';
import { LimitError } from '../workflows/limits';
import { getTemplate, markTemplateRun } from '../workflows/templates';
import { cronMatches, nextRun, parseCron } from './cron';
import { listSchedules, recordSchedule, type Schedule } from './schedules';

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

async function fire(s: Schedule, why: string, broadcast: Broadcast) {
  const template = getTemplate(s.templateId);
  if (!template) {
    recordSchedule(s.id, { lastError: 'Template no longer exists' });
    return;
  }
  // A run from this schedule still going means the last one overran; skip rather than pile up.
  const prev = s.lastRunId ? getRun(s.lastRunId) : undefined;
  if (prev && ACTIVE.has(prev.status)) return;

  const project = path.basename(template.input.cwd);
  try {
    // Stored input is revalidated: agents or folders may have changed since the template was saved.
    const parsed = await parseLaunch(toBody(template.input));
    if (!parsed.ok) throw new Error(parsed.error);
    const run = launchRun(parsed.input, broadcast);
    markTemplateRun(template.id);
    recordSchedule(s.id, { lastRunAt: Date.now(), lastRunId: run.id, lastError: undefined });
    audit('schedule-fire', 'scheduler', `${s.name}: ${why}`, { runId: run.id, project });
    notify(`Scheduled run started: ${s.name}`, why, broadcast, { module: 'workflows', route: [run.id] }, { native: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordSchedule(s.id, { lastError: message });
    audit('schedule-error', 'scheduler', `${s.name}: ${message}`, { project });
    // A limit hit is expected and self-heals; anything else deserves a nudge.
    if (!(err instanceof LimitError)) notify(`Schedule failed: ${s.name}`, message, broadcast, undefined, { native: false });
  }
}

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
      } else {
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
