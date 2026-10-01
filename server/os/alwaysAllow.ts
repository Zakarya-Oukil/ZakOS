import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { fail, handle, kvGet, kvSet, localOnly, str } from './common';

/**
 * Always-allow rules: a permission the owner has granted for good, scoped to one project folder. They are added to the
 * allowed tools of every run in that folder, listed here, and revocable at any time.
 */
export interface AlwaysRule {
  rule: string;
  cwd: string;
  created: number;
}

const KEY = 'approvals.always';
export const listRules = (): AlwaysRule[] => kvGet<AlwaysRule[]>(KEY, []);

const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase().replace(/\/$/, '');

export const rulesFor = (cwd: string): string[] => listRules().filter((r) => norm(r.cwd) === norm(cwd)).map((r) => r.rule);

/** A rule is only stored when it names one specific action. Bare tool names and wildcards would allow far too much. */
export function validRule(rule: string): boolean {
  if (!/^[A-Za-z_]+(\(.{1,300}\))?$/.test(rule)) return false;
  if (/\*|^Bash$|^Bash\(\)$/.test(rule)) return false;
  if (/rm\s+-|sudo|--force|push\s+.*-f|\|\s*(sh|bash)|curl|wget|chmod|chown/i.test(rule)) return false;
  return true;
}

export function addRule(cwd: string, rule: string): void {
  if (!validRule(rule)) throw new Error('That action is too broad or too risky to allow for good');
  const rules = listRules();
  if (rules.some((r) => r.rule === rule && norm(r.cwd) === norm(cwd))) return;
  kvSet(KEY, [...rules, { rule, cwd, created: Date.now() }].slice(-200));
  audit('always-allow', 'owner', `Always allow ${rule} in ${cwd}`);
}

export function mountAlwaysAllowRoutes(app: Express) {
  app.use('/api/always-allow', localOnly);

  app.get('/api/always-allow', (_req: Request, res: Response) => res.json({ success: true, rules: listRules() }));

  app.delete('/api/always-allow', handle((req, res) => {
    const rule = str(req.body?.rule, 400) ?? '';
    const cwd = str(req.body?.cwd, 500) ?? '';
    const next = listRules().filter((r) => !(r.rule === rule && norm(r.cwd) === norm(cwd)));
    if (next.length === listRules().length) return fail(res, 404, 'No such rule');
    kvSet(KEY, next);
    audit('always-allow', 'owner', `Revoked always-allow ${rule} in ${cwd}`);
    res.json({ success: true });
  }));
}
