import fs from 'node:fs';
import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { quickChecks } from '../dev/health';
import { getProject, listProjects } from '../projects/store';
import { fail, handle, kvGet, kvSet, localOnly, str } from './common';

/**
 * Environment profiles for running a project's app (for example dev and staging), and a health score per project.
 * Values are stored on this machine, are never sent back to the page and never written to the audit log: the page only
 * ever sees the names of the variables.
 */
type Profiles = Record<string, Record<string, string>>;
const key = (projectId: string) => `dev.env.${projectId}`;
const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const PROFILE = /^[a-z0-9-]{1,24}$/;
const BLOCKED = new Set(['PATH', 'PATHEXT', 'COMSPEC', 'SYSTEMROOT', 'WINDIR', 'LD_PRELOAD', 'LD_LIBRARY_PATH', 'NODE_OPTIONS', 'DYLD_INSERT_LIBRARIES']);

export const profilesOf = (projectId: string): Profiles => kvGet<Profiles>(key(projectId), {});
export const varsFor = (projectId: string, profile: string): Record<string, string> => profilesOf(projectId)[profile] ?? {};

export function mountDevExtras(app: Express) {
  app.use(['/api/dev-env', '/api/health-scores'], localOnly);

  app.get('/api/dev-env/:projectId', handle((req: Request, res: Response) => {
    const profiles = profilesOf(String(req.params.projectId));
    res.json({ success: true, profiles: Object.fromEntries(Object.entries(profiles).map(([n, v]) => [n, Object.keys(v).sort()])) });
  }));

  app.put('/api/dev-env/:projectId/:profile', handle((req: Request, res: Response) => {
    const project = getProject(String(req.params.projectId));
    if (!project) return fail(res, 404, 'Project not found');
    const profile = String(req.params.profile);
    if (!PROFILE.test(profile)) return fail(res, 400, 'Profile names use lowercase letters, numbers and dashes');
    const incoming = req.body?.vars;
    if (!incoming || typeof incoming !== 'object') return fail(res, 400, 'vars is required');
    const all = profilesOf(project.id);
    const cur = { ...(all[profile] ?? {}) };
    for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
      if (!NAME.test(k)) return fail(res, 400, `${k} is not a valid variable name`);
      if (BLOCKED.has(k.toUpperCase())) return fail(res, 400, `${k} cannot be overridden here`);
      if (v === '' || v === null) delete cur[k];
      else if (typeof v === 'string' && v.length <= 2000) cur[k] = v;
    }
    if (Object.keys(cur).length > 60) return fail(res, 400, 'That is too many variables for one profile');
    all[profile] = cur;
    kvSet(key(project.id), all);
    audit('env-profile', 'owner', `Updated the ${profile} environment profile (${Object.keys(cur).length} variables)`, { project: project.name });
    res.json({ success: true, keys: Object.keys(cur).sort() });
  }));

  app.delete('/api/dev-env/:projectId/:profile', handle((req: Request, res: Response) => {
    const id = String(req.params.projectId);
    const all = profilesOf(id);
    delete all[String(req.params.profile)];
    kvSet(key(id), all);
    res.json({ success: true });
  }));

  /** A 0 to 100 score from the quick checks: passes count fully, warnings half, failures nothing. Information lines are ignored. */
  app.get('/api/health-scores', handle(async (_req: Request, res: Response) => {
    const out: Record<string, { score: number; pass: number; warn: number; fail: number } | null> = {};
    await Promise.all(
      listProjects().map(async (p) => {
        if (!fs.existsSync(p.path)) {
          out[p.id] = null;
          return;
        }
        try {
          const checks = (await quickChecks(p.path)).filter((c) => c.level !== 'info');
          const pass = checks.filter((c) => c.level === 'pass').length;
          const warn = checks.filter((c) => c.level === 'warn').length;
          const failed = checks.filter((c) => c.level === 'fail').length;
          const total = pass + warn + failed;
          out[p.id] = total === 0 ? null : { score: Math.round(((pass + warn * 0.5) / total) * 100), pass, warn, fail: failed };
        } catch {
          out[p.id] = null;
        }
      }),
    );
    res.json({ success: true, scores: out });
  }));

  void str;
}
