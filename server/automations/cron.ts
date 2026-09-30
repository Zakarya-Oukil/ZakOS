/** A five-field cron expression: minute hour day-of-month month day-of-week. */
export interface Cron {
  minute: Set<number>;
  hour: Set<number>;
  dom: Set<number>;
  month: Set<number>;
  dow: Set<number>;
  /** True when the field was written as `*`, which decides how day-of-month and day-of-week combine. */
  domStar: boolean;
  dowStar: boolean;
}

const FIELDS: Array<[string, number, number]> = [
  ['minute', 0, 59],
  ['hour', 0, 23],
  ['day of month', 1, 31],
  ['month', 1, 12],
  ['day of week', 0, 7],
];

function parseField(text: string, name: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of text.split(',')) {
    const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
    if (!m) throw new Error(`Invalid ${name}: "${part}"`);
    const step = m[2] === undefined ? 1 : Number(m[2]);
    if (step < 1) throw new Error(`Invalid step in ${name}`);
    let lo = min;
    let hi = max;
    if (m[1] !== '*') {
      const [a, b] = m[1].split('-').map(Number);
      lo = a;
      hi = b ?? (m[2] === undefined ? a : max); // "5/10" means from 5 to the end
    }
    if (lo < min || hi > max || lo > hi) throw new Error(`${name} must be between ${min} and ${max}`);
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

export function parseCron(expr: string): Cron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error('A schedule needs five fields: minute hour day-of-month month day-of-week');
  const [minute, hour, dom, month, dow] = parts.map((p, i) => parseField(p, FIELDS[i][0], FIELDS[i][1], FIELDS[i][2]));
  if (dow.has(7)) {
    dow.delete(7);
    dow.add(0); // Sunday may be written 0 or 7
  }
  return { minute, hour, dom, month, dow, domStar: parts[2] === '*', dowStar: parts[4] === '*' };
}

export function cronMatches(c: Cron, d: Date): boolean {
  if (!c.minute.has(d.getMinutes()) || !c.hour.has(d.getHours()) || !c.month.has(d.getMonth() + 1)) return false;
  const domOk = c.dom.has(d.getDate());
  const dowOk = c.dow.has(d.getDay());
  // Standard cron: when both day fields are restricted, either one matching is enough.
  if (!c.domStar && !c.dowStar) return domOk || dowOk;
  return domOk && dowOk;
}

/** The next time the expression fires after `from`, looking up to eight days ahead; null if none. */
export function nextRun(c: Cron, from: Date = new Date()): Date | null {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  for (let i = 0; i < 8 * 24 * 60; i++) {
    if (cronMatches(c, d)) return new Date(d);
    d.setMinutes(d.getMinutes() + 1);
  }
  return null;
}
