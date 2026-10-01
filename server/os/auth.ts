import crypto from 'node:crypto';
import type { Express, NextFunction, Request, Response } from 'express';
import { audit } from '../audit';
import { fail, handle, kvGet, kvSet, osdb, str } from './common';

/**
 * Local accounts. Sign-in is optional: until the owner creates the first account everything works as before.
 * Once it is on, API calls need a session cookie. Roles: owner (everything), operator (use agents and tasks,
 * cannot manage users or secrets), viewer (read only).
 */
export type Role = 'owner' | 'operator' | 'viewer';
const ROLES: Role[] = ['owner', 'operator', 'viewer'];

osdb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    salt TEXT NOT NULL,
    hash TEXT NOT NULL,
    role TEXT NOT NULL,
    created INTEGER NOT NULL,
    last_login INTEGER
  );
  CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires INTEGER NOT NULL
  );
`);

const COOKIE = 'zakos_session';
const TTL = 7 * 86_400_000;
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const hashPassword = (pw: string, salt: string) => crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');

interface User {
  id: string;
  name: string;
  role: Role;
  created: number;
  last_login: number | null;
}

export const authEnabled = (): boolean => (osdb.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c > 0;

function cookieOf(req: Request): string | undefined {
  const m = /(?:^|;\s*)zakos_session=([a-f0-9]{64})/.exec(req.headers.cookie ?? '');
  return m?.[1];
}

export function userFor(req: Request): User | undefined {
  const token = cookieOf(req);
  if (!token) return undefined;
  const row = osdb
    .prepare('SELECT u.id, u.name, u.role, u.created, u.last_login, s.expires FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?')
    .get(sha(token)) as (User & { expires: number }) | undefined;
  if (!row || row.expires < Date.now()) return undefined;
  return row;
}

// Attempts per name, to slow password guessing.
const failures = new Map<string, { n: number; until: number }>();

function startSession(res: Response, userId: string) {
  const token = crypto.randomBytes(32).toString('hex');
  osdb.prepare('INSERT INTO auth_sessions(token_hash, user_id, expires) VALUES(?,?,?)').run(sha(token), userId, Date.now() + TTL);
  osdb.prepare('DELETE FROM auth_sessions WHERE expires < ?').run(Date.now());
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL / 1000}`);
}

const OPEN = [/^\/api\/auth\//, /^\/hooks\//, /^\/api\/v1\//];
const READ_ONLY_OK = new Set(['GET', 'HEAD']);
const OWNER_ONLY = [/^\/api\/auth\/users/, /^\/api\/secrets/, /^\/api\/licence\/activate/, /^\/api\/mcp/, /^\/api\/hooks/, /^\/api\/integrations/, /^\/api\/backup/];

/** Applied before the routes. A no-op until the first account exists. */
export function authGate(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/') || OPEN.some((r) => r.test(req.path)) || !authEnabled()) return next();
  const user = userFor(req);
  if (!user) return fail(res, 401, 'Sign in required');
  if (user.role === 'viewer' && !READ_ONLY_OK.has(req.method)) return fail(res, 403, 'Viewers can look but not change things');
  if (user.role !== 'owner' && OWNER_ONLY.some((r) => r.test(req.path))) return fail(res, 403, 'Only the owner can do that');
  (req as Request & { zUser?: User }).zUser = user;
  next();
}

export function mountAuthRoutes(app: Express) {
  app.get('/api/auth/status', (req: Request, res: Response) => {
    const user = userFor(req);
    res.json({ success: true, enabled: authEnabled(), user: user ? { id: user.id, name: user.name, role: user.role } : null });
  });

  /** First account: becomes the owner and turns sign-in on. Allowed only while no account exists. */
  app.post('/api/auth/setup', handle((req, res) => {
    if (authEnabled()) return fail(res, 409, 'Sign-in is already set up');
    const name = (str(req.body?.name, 40) ?? '').trim();
    const pw = str(req.body?.password, 200) ?? '';
    if (!name) throw new Error('A name is required');
    if (pw.length < 8) throw new Error('Use a password of at least 8 characters');
    const id = crypto.randomUUID();
    const salt = crypto.randomBytes(16).toString('hex');
    osdb.prepare('INSERT INTO users(id, name, salt, hash, role, created, last_login) VALUES(?,?,?,?,?,?,?)').run(id, name, salt, hashPassword(pw, salt), 'owner', Date.now(), Date.now());
    startSession(res, id);
    audit('auth-setup', name, 'Turned on sign-in and created the owner account');
    res.status(201).json({ success: true });
  }));

  app.post('/api/auth/login', handle((req, res) => {
    const name = (str(req.body?.name, 40) ?? '').trim();
    const pw = str(req.body?.password, 200) ?? '';
    const f = failures.get(name.toLowerCase());
    if (f && f.n >= 5 && f.until > Date.now()) return fail(res, 429, 'Too many tries. Wait a minute.');
    const row = osdb.prepare('SELECT * FROM users WHERE name = ? COLLATE NOCASE').get(name) as { id: string; salt: string; hash: string; name: string } | undefined;
    const ok = row && crypto.timingSafeEqual(Buffer.from(hashPassword(pw, row.salt), 'hex'), Buffer.from(row.hash, 'hex'));
    if (!row || !ok) {
      const cur = failures.get(name.toLowerCase()) ?? { n: 0, until: 0 };
      failures.set(name.toLowerCase(), { n: cur.n + 1, until: Date.now() + 60_000 });
      audit('auth-fail', name || 'unknown', 'Failed sign-in');
      return fail(res, 401, 'Wrong name or password');
    }
    failures.delete(name.toLowerCase());
    osdb.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(Date.now(), row.id);
    startSession(res, row.id);
    audit('auth-login', row.name, 'Signed in');
    res.json({ success: true });
  }));

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = cookieOf(req);
    if (token) osdb.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(sha(token));
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    res.json({ success: true });
  });

  app.get('/api/auth/users', handle((req, res) => {
    const me = userFor(req);
    if (authEnabled() && me?.role !== 'owner') return fail(res, 403, 'Only the owner can see accounts');
    res.json({ success: true, users: osdb.prepare('SELECT id, name, role, created, last_login FROM users ORDER BY created').all() });
  }));

  app.post('/api/auth/users', handle((req, res) => {
    const me = userFor(req);
    if (me?.role !== 'owner') return fail(res, 403, 'Only the owner can add accounts');
    const name = (str(req.body?.name, 40) ?? '').trim();
    const pw = str(req.body?.password, 200) ?? '';
    const role = req.body?.role as Role;
    if (!name || !ROLES.includes(role)) throw new Error('A name and a role are required');
    if (pw.length < 8) throw new Error('Use a password of at least 8 characters');
    if (osdb.prepare('SELECT 1 FROM users WHERE name = ? COLLATE NOCASE').get(name)) throw new Error('That name is taken');
    const salt = crypto.randomBytes(16).toString('hex');
    osdb.prepare('INSERT INTO users(id, name, salt, hash, role, created) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(), name, salt, hashPassword(pw, salt), role, Date.now());
    audit('auth-user-add', me.name, `Added ${role} account ${name}`);
    res.status(201).json({ success: true });
  }));

  app.patch('/api/auth/users/:id', handle((req, res) => {
    const me = userFor(req);
    if (me?.role !== 'owner') return fail(res, 403, 'Only the owner can change accounts');
    const role = req.body?.role as Role;
    if (!ROLES.includes(role)) throw new Error('Unknown role');
    const target = osdb.prepare('SELECT id, role FROM users WHERE id = ?').get(String(req.params.id)) as { id: string; role: Role } | undefined;
    if (!target) return fail(res, 404, 'Account not found');
    if (target.role === 'owner' && role !== 'owner') {
      const owners = (osdb.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'owner'").get() as { c: number }).c;
      if (owners <= 1) throw new Error('There must be at least one owner');
    }
    osdb.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, target.id);
    res.json({ success: true });
  }));

  app.delete('/api/auth/users/:id', handle((req, res) => {
    const me = userFor(req);
    if (me?.role !== 'owner') return fail(res, 403, 'Only the owner can remove accounts');
    const target = osdb.prepare('SELECT id, name, role FROM users WHERE id = ?').get(String(req.params.id)) as { id: string; name: string; role: Role } | undefined;
    if (!target) return fail(res, 404, 'Account not found');
    if (target.role === 'owner') {
      const owners = (osdb.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'owner'").get() as { c: number }).c;
      if (owners <= 1) throw new Error('There must be at least one owner');
    }
    osdb.prepare('DELETE FROM users WHERE id = ?').run(target.id);
    osdb.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(target.id);
    audit('auth-user-remove', me.name, `Removed account ${target.name}`);
    res.json({ success: true });
  }));

  /** Turns sign-in off again. Owner only, and needs the owner's password. */
  app.post('/api/auth/disable', handle((req, res) => {
    const me = userFor(req);
    if (!me || me.role !== 'owner') return fail(res, 403, 'Only the owner can turn sign-in off');
    const row = osdb.prepare('SELECT salt, hash FROM users WHERE id = ?').get(me.id) as { salt: string; hash: string };
    const ok = crypto.timingSafeEqual(Buffer.from(hashPassword(str(req.body?.password, 200) ?? '', row.salt), 'hex'), Buffer.from(row.hash, 'hex'));
    if (!ok) return fail(res, 401, 'Wrong password');
    osdb.exec('DELETE FROM auth_sessions; DELETE FROM users;');
    audit('auth-disable', me.name, 'Turned sign-in off');
    res.json({ success: true });
  }));

  void kvGet;
  void kvSet;
}
