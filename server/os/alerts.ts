import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { notify } from '../notifications';
import { fail, handle, kvGet, kvSet, localOnly, str } from './common';

/**
 * Alert rules for the audit log. A rule watches one kind of entry (or all) for a word, and raises a notification
 * when a new entry matches. Matching is plain case-insensitive text, never a pattern from the page.
 */
export interface AlertRule {
  id: string;
  name: string;
  kind: string;
  contains: string;
  enabled: boolean;
  fired: number;
  lastAt: number | null;
}

const KEY = 'audit.alerts';
export const listAlerts = (): AlertRule[] => kvGet<AlertRule[]>(KEY, []);

let broadcastFn: ((d: unknown) => void) | null = null;
export const getBroadcast = () => broadcastFn;
export const setAlertBroadcast = (b: (d: unknown) => void) => {
  broadcastFn = b;
};

const recent = new Map<string, number>();

/** Called for every new audit entry. Never throws: an alert must not break the action that was logged. */
export function checkAlerts(kind: string, actor: string, detail: string): void {
  try {
    const rules = listAlerts().filter((r) => r.enabled);
    if (rules.length === 0 || !broadcastFn) return;
    if (kind === 'alert') return;
    const hay = `${actor} ${detail}`.toLowerCase();
    let changed = false;
    const all = listAlerts();
    for (const r of rules) {
      if (r.kind && r.kind !== kind) continue;
      if (r.contains && !hay.includes(r.contains.toLowerCase())) continue;
      // One notification per rule per minute, so a noisy match cannot flood the bell.
      if (Date.now() - (recent.get(r.id) ?? 0) < 60_000) continue;
      recent.set(r.id, Date.now());
      notify(`Alert: ${r.name}`, `${kind}: ${detail}`.slice(0, 280), broadcastFn, { module: 'audit', route: [] }, { native: true });
      const mine = all.find((x) => x.id === r.id);
      if (mine) {
        mine.fired += 1;
        mine.lastAt = Date.now();
        changed = true;
      }
    }
    if (changed) kvSet(KEY, all);
  } catch (err) {
    console.error('[alerts]', err instanceof Error ? err.message : err);
  }
}

export function mountAlertRoutes(app: Express) {
  app.use('/api/alerts', localOnly);

  app.get('/api/alerts', (_req: Request, res: Response) => res.json({ success: true, rules: listAlerts() }));

  app.post('/api/alerts', handle((req, res) => {
    const name = (str(req.body?.name, 60) ?? '').trim();
    const contains = (str(req.body?.contains, 100) ?? '').trim();
    const kind = (str(req.body?.kind, 40) ?? '').trim();
    if (!name) return fail(res, 400, 'Name the alert');
    if (!contains && !kind) return fail(res, 400, 'Pick a kind of entry or a word to watch for');
    const rules = listAlerts();
    if (rules.length >= 30) return fail(res, 409, 'That is enough alert rules. Remove one first.');
    const rule: AlertRule = { id: randomUUID(), name, kind, contains, enabled: true, fired: 0, lastAt: null };
    kvSet(KEY, [...rules, rule]);
    res.status(201).json({ success: true, rule });
  }));

  app.patch('/api/alerts/:id', handle((req, res) => {
    const rules = listAlerts();
    const r = rules.find((x) => x.id === req.params.id);
    if (!r) return fail(res, 404, 'Alert not found');
    if (typeof req.body?.enabled === 'boolean') r.enabled = req.body.enabled;
    kvSet(KEY, rules);
    res.json({ success: true, rule: r });
  }));

  app.delete('/api/alerts/:id', handle((req, res) => {
    kvSet(KEY, listAlerts().filter((x) => x.id !== req.params.id));
    res.json({ success: true });
  }));
}
