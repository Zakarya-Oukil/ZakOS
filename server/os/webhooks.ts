import crypto from 'node:crypto';
import type { Express, NextFunction, Request, Response } from 'express';
import { audit } from '../audit';
import { fail, handle, kvGet, kvSet, localOnly, osdb, str } from './common';
import { createTask } from './tasks';

/**
 * Inbound webhooks and a personal API key. Each webhook has a name, an HMAC secret and an action. The
 * secret is shown once and kept in the local database (it must be readable to verify signatures). The
 * personal API key is only stored as a hash.
 */
osdb.exec(`
  CREATE TABLE IF NOT EXISTS webhooks (
    name TEXT PRIMARY KEY,
    secret TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'log',
    created INTEGER NOT NULL,
    hits INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS webhook_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    name TEXT NOT NULL,
    status INTEGER NOT NULL,
    note TEXT NOT NULL,
    body TEXT NOT NULL
  );
`);

const NAME = /^[a-z0-9-]{2,40}$/;
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

function sign(secret: string, body: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function log(name: string, status: number, note: string, body: string) {
  osdb.prepare('INSERT INTO webhook_log(ts, name, status, note, body) VALUES(?,?,?,?,?)').run(Date.now(), name, status, note.slice(0, 200), body.slice(0, 4000));
  osdb.prepare('DELETE FROM webhook_log WHERE id NOT IN (SELECT id FROM webhook_log ORDER BY id DESC LIMIT 200)').run();
}

/** Performs a hook's action on a payload. Shared by live deliveries and replays. */
function perform(action: string, name: string, body: string): string {
  if (action === 'task') {
    let title = `Webhook ${name}`;
    let detail = body.slice(0, 1500);
    try {
      const j = JSON.parse(body) as Record<string, unknown>;
      const t = j.title ?? j.subject ?? j.message ?? j.text;
      if (typeof t === 'string' && t.trim()) title = t.trim().slice(0, 200);
      detail = JSON.stringify(j, null, 2).slice(0, 1500);
    } catch {
      /* plain text payload */
    }
    createTask({ title, body: detail, source: 'webhook', sourceRef: name });
    return 'Created a task card';
  }
  return 'Logged';
}

declare module 'http' {
  interface IncomingMessage {
    rawBody?: string;
  }
}

/** The personal API key guards /api/v1 for outside scripts. */
function apiKeyGuard(req: Request, res: Response, next: NextFunction) {
  const hash = kvGet<string | null>('apikey.hash', null);
  const given = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '')?.[1];
  if (!hash || !given || !safeEqual(sha(given), hash)) {
    res.status(401).json({ success: false, error: 'Missing or wrong API key' });
    return;
  }
  next();
}

export function mountWebhookRoutes(app: Express) {
  // ---- public side: deliveries and the external API -------------------------------------------
  app.post('/hooks/:name', (req: Request, res: Response) => {
    const name = String(req.params.name);
    const row = osdb.prepare('SELECT * FROM webhooks WHERE name = ?').get(name) as { secret: string; action: string } | undefined;
    const raw = req.rawBody ?? JSON.stringify(req.body ?? {});
    if (!row) {
      log(name, 404, 'Unknown webhook', raw);
      return fail(res, 404, 'Unknown webhook');
    }
    const given = String(req.headers['x-zakos-signature'] ?? '');
    if (!given || !safeEqual(given, sign(row.secret, raw))) {
      log(name, 401, 'Bad or missing signature', raw);
      return fail(res, 401, 'Bad signature');
    }
    try {
      const note = perform(row.action, name, raw);
      osdb.prepare('UPDATE webhooks SET hits = hits + 1 WHERE name = ?').run(name);
      log(name, 200, note, raw);
      audit('webhook', `hook:${name}`, note);
      res.json({ success: true });
    } catch (err) {
      log(name, 500, err instanceof Error ? err.message : 'Failed', raw);
      fail(res, 500, 'The action failed');
    }
  });

  app.get('/api/v1/status', apiKeyGuard, (_req: Request, res: Response) => res.json({ success: true, service: 'zak-os' }));
  app.post('/api/v1/tasks', apiKeyGuard, handle((req, res) => {
    const task = createTask({ title: str(req.body?.title, 200) ?? '', body: str(req.body?.body, 8000), priority: req.body?.priority, source: 'api' });
    audit('api-task', 'api-key', `Created task: ${task.title}`);
    res.status(201).json({ success: true, task });
  }));

  // ---- management (local only) ------------------------------------------------------------------
  app.use('/api/hooks', localOnly);

  app.get('/api/hooks', (_req: Request, res: Response) => {
    const hooks = osdb.prepare('SELECT name, action, created, hits FROM webhooks ORDER BY created DESC').all();
    res.json({ success: true, hooks, hasKey: kvGet<string | null>('apikey.hash', null) !== null, keyCreated: kvGet<number | null>('apikey.created', null) });
  });

  app.post('/api/hooks', handle((req, res) => {
    const name = (str(req.body?.name, 60) ?? '').trim().toLowerCase();
    if (!NAME.test(name)) throw new Error('Use 2 to 40 lowercase letters, numbers or dashes');
    const action = req.body?.action === 'task' ? 'task' : 'log';
    if (osdb.prepare('SELECT 1 FROM webhooks WHERE name = ?').get(name)) throw new Error('A webhook with that name exists');
    const secret = crypto.randomBytes(24).toString('hex');
    osdb.prepare('INSERT INTO webhooks(name, secret, action, created) VALUES(?,?,?,?)').run(name, secret, action, Date.now());
    audit('webhook-create', 'owner', `Created webhook ${name}`);
    res.status(201).json({ success: true, name, secret });
  }));

  app.delete('/api/hooks/:name', (req: Request, res: Response, next: NextFunction) => (req.params.name === 'apikey' ? next() : handle((rq, rs) => {
    osdb.prepare('DELETE FROM webhooks WHERE name = ?').run(String(rq.params.name));
    audit('webhook-delete', 'owner', `Deleted webhook ${rq.params.name}`);
    rs.json({ success: true });
  })(req, res)));

  app.get('/api/hooks/log', (req: Request, res: Response) => {
    const name = str(req.query.name, 60);
    const rows = name
      ? osdb.prepare('SELECT * FROM webhook_log WHERE name = ? ORDER BY id DESC LIMIT 60').all(name)
      : osdb.prepare('SELECT * FROM webhook_log ORDER BY id DESC LIMIT 60').all();
    res.json({ success: true, log: rows });
  });

  /** Replays a logged delivery that had a valid signature. Failed deliveries are never replayed. */
  app.post('/api/hooks/log/:id/replay', handle((req, res) => {
    const row = osdb.prepare('SELECT * FROM webhook_log WHERE id = ?').get(Number(req.params.id)) as { name: string; status: number; body: string } | undefined;
    if (!row) return fail(res, 404, 'Log entry not found');
    if (row.status !== 200) return fail(res, 400, 'Only deliveries that were accepted can be replayed');
    const hook = osdb.prepare('SELECT action FROM webhooks WHERE name = ?').get(row.name) as { action: string } | undefined;
    if (!hook) return fail(res, 404, 'That webhook no longer exists');
    const note = perform(hook.action, row.name, row.body);
    log(row.name, 200, `Replay: ${note}`, row.body);
    res.json({ success: true, note });
  }));

  app.post('/api/hooks/apikey', handle((_req, res) => {
    const key = `zk_${crypto.randomBytes(24).toString('hex')}`;
    kvSet('apikey.hash', sha(key));
    kvSet('apikey.created', Date.now());
    audit('apikey-create', 'owner', 'Created a personal API key');
    res.json({ success: true, key });
  }));

  app.delete('/api/hooks/apikey', handle((_req, res) => {
    kvSet('apikey.hash', null);
    kvSet('apikey.created', null);
    audit('apikey-revoke', 'owner', 'Revoked the personal API key');
    res.json({ success: true });
  }));
}
