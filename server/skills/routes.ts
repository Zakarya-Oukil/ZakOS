import type { Express, NextFunction, Request, Response } from 'express';
import { audit } from '../audit';
import { isTrustedLocalRequest } from '../terminal/pty';
import * as s from './skills';

/** Skills change how agents behave, so these routes are local-only like the terminal. */
function localOnly(req: Request, res: Response, next: NextFunction) {
  if (!isTrustedLocalRequest(req)) {
    res.status(403).json({ success: false, error: 'Local access only' });
    return;
  }
  next();
}

const fail = (res: Response, status: number, error: string) => res.status(status).json({ success: false, error });
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

export function mountSkillRoutes(app: Express) {
  app.use('/api/skills', localOnly);

  /** Runs a handler and turns the skill module's plain Errors into 400s. */
  const handle = (fn: (req: Request, res: Response) => unknown) => (req: Request, res: Response) => {
    try {
      fn(req, res);
    } catch (err) {
      if (!res.headersSent) fail(res, 400, err instanceof Error ? err.message : String(err));
    }
  };

  app.get('/api/skills', handle((_req, res) => {
    res.json({ success: true, skills: s.listSkills(), scopes: s.scopes().map(({ id, label }) => ({ id, label })) });
  }));

  app.get('/api/skills/:scope/:name', handle((req, res) => {
    res.json({ success: true, ...s.readSkill(String(req.params.scope), String(req.params.name)) });
  }));

  app.post('/api/skills', handle((req, res) => {
    const scope = str(req.body?.scope) ?? '';
    const name = (str(req.body?.name) ?? '').trim().toLowerCase();
    s.createSkill(scope, name, str(req.body?.description) ?? '', str(req.body?.body) ?? '');
    audit('skill-create', 'owner', `Created skill ${name} (${scope})`);
    res.status(201).json({ success: true });
  }));

  app.put('/api/skills/:scope/:name', handle((req, res) => {
    const content = str(req.body?.content);
    if (content === undefined) return fail(res, 400, 'content is required');
    s.writeSkill(String(req.params.scope), String(req.params.name), content);
    audit('skill-edit', 'owner', `Edited skill ${req.params.name} (${req.params.scope})`);
    res.json({ success: true });
  }));

  app.post('/api/skills/:scope/:name/enabled', handle((req, res) => {
    if (typeof req.body?.enabled !== 'boolean') return fail(res, 400, 'enabled must be true or false');
    s.setEnabled(String(req.params.scope), String(req.params.name), req.body.enabled);
    audit('skill-toggle', 'owner', `${req.body.enabled ? 'Enabled' : 'Disabled'} skill ${req.params.name} (${req.params.scope})`);
    res.json({ success: true });
  }));

  /** Deleting removes the whole skill folder, so the client must send the skill's name back as confirmation. */
  app.delete('/api/skills/:scope/:name', handle((req, res) => {
    if (req.body?.confirm !== req.params.name) return fail(res, 400, 'Send the skill name as confirm to delete it');
    s.deleteSkill(String(req.params.scope), String(req.params.name));
    audit('skill-delete', 'owner', `Deleted skill ${req.params.name} (${req.params.scope})`);
    res.json({ success: true });
  }));
}
