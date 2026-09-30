import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Runs a saved template on a cron schedule, or whenever a new commit lands in its project. */
export type Trigger = { kind: 'cron'; cron: string } | { kind: 'commit' };

export interface Schedule {
  id: string;
  name: string;
  templateId: string;
  trigger: Trigger;
  enabled: boolean;
  created: number;
  lastRunAt?: number;
  lastRunId?: string;
  lastError?: string;
  /** Commit trigger only: the HEAD last seen, so a new commit is one that differs from it. */
  lastHead?: string;
  /** The most recent runs this automation started, newest first. */
  history?: Array<{ runId: string; at: number; why: string }>;
}

const FILE = path.resolve(process.cwd(), 'data', 'workflow-schedules.json');

function read(): Schedule[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: Schedule[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, FILE);
}

export const listSchedules = (): Schedule[] => read().sort((a, b) => b.created - a.created);
export const getSchedule = (id: string): Schedule | undefined => read().find((s) => s.id === id);

export function createSchedule(name: string, templateId: string, trigger: Trigger): Schedule {
  const schedule: Schedule = { id: randomUUID(), name: name.trim().slice(0, 80), templateId, trigger, enabled: true, created: Date.now() };
  write([...read(), schedule]);
  return schedule;
}

export function updateSchedule(id: string, patch: Partial<Pick<Schedule, 'name' | 'enabled' | 'trigger'>>): Schedule | undefined {
  const list = read();
  const s = list.find((x) => x.id === id);
  if (!s) return undefined;
  if (patch.name) s.name = patch.name.trim().slice(0, 80);
  if (typeof patch.enabled === 'boolean') s.enabled = patch.enabled;
  if (patch.trigger) {
    s.trigger = patch.trigger;
    s.lastHead = undefined; // a new trigger starts from a fresh baseline
  }
  write(list);
  return s;
}

/** Records what the scheduler just did; fields set to undefined are cleared. */
export function recordSchedule(
  id: string,
  patch: Partial<Pick<Schedule, 'lastRunAt' | 'lastRunId' | 'lastError' | 'lastHead'>> & { addRun?: { runId: string; at: number; why: string } },
) {
  const list = read();
  const s = list.find((x) => x.id === id);
  if (!s) return;
  const { addRun, ...rest } = patch;
  Object.assign(s, rest);
  if (addRun) s.history = [addRun, ...(s.history ?? [])].slice(0, 20);
  write(list);
}

export function deleteSchedule(id: string): boolean {
  const list = read();
  const next = list.filter((s) => s.id !== id);
  if (next.length === list.length) return false;
  write(next);
  return true;
}

/** Schedules are useless without their template, so deleting a template removes them too. */
export function deleteSchedulesForTemplate(templateId: string) {
  const list = read();
  const next = list.filter((s) => s.templateId !== templateId);
  if (next.length !== list.length) write(next);
}
