import fs from 'node:fs';
import path from 'node:path';

export interface Limits {
  /** Runs that may be started per calendar day. */
  maxRunsPerDay: number;
  /** Runs that may be in progress at once. */
  maxActiveRuns: number;
  /** Sub-agents running in parallel inside one run. */
  maxWorkers: number;
  /** Tasks a plan may contain. */
  maxTasks: number;
  /** A run is stopped cleanly once it has been working this long (waiting for approval does not count). */
  maxRunMinutes: number;
}

const FILE = path.resolve(process.cwd(), 'data', 'workflow-limits.json');

const DEFAULTS: Limits = { maxRunsPerDay: 20, maxActiveRuns: 2, maxWorkers: 3, maxTasks: 5, maxRunMinutes: 60 };
const RANGE: Record<keyof Limits, [number, number]> = {
  maxRunsPerDay: [1, 500],
  maxActiveRuns: [1, 10],
  maxWorkers: [1, 8],
  maxTasks: [1, 12],
  maxRunMinutes: [1, 720],
};

export class LimitError extends Error {}

export function getLimits(): Limits {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Partial<Limits>;
    const out = { ...DEFAULTS };
    for (const k of Object.keys(RANGE) as Array<keyof Limits>) {
      const v = raw[k];
      if (typeof v === 'number' && Number.isInteger(v) && v >= RANGE[k][0] && v <= RANGE[k][1]) out[k] = v;
    }
    return out;
  } catch {
    return { ...DEFAULTS };
  }
}

export function updateLimits(patch: Record<string, unknown>): Limits {
  const next = getLimits();
  for (const k of Object.keys(RANGE) as Array<keyof Limits>) {
    if (patch[k] === undefined) continue;
    const v = patch[k];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < RANGE[k][0] || v > RANGE[k][1]) {
      throw new Error(`${k} must be a whole number between ${RANGE[k][0]} and ${RANGE[k][1]}`);
    }
    next[k] = v;
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return next;
}
