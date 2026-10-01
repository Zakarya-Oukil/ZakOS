import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { dataDir, fail, handle, localOnly, str } from './common';

/**
 * Encrypted secrets file. The master password never touches disk: it is stretched with scrypt into an
 * AES-256-GCM key that lives in memory only while the store is unlocked, and locks itself after 15 minutes.
 */
const FILE = path.join(dataDir, 'secrets.enc.json');
const IDLE_MS = 15 * 60_000;

interface Envelope {
  v: 1;
  salt: string;
  iv: string;
  tag: string;
  data: string;
  /** A fixed phrase encrypted with the key, so a wrong password is detected before any write. */
}

let key: Buffer | null = null;
let salt: Buffer | null = null;
let cache: Record<string, string> = {};
let lockTimer: NodeJS.Timeout | null = null;

const derive = (password: string, s: Buffer) => crypto.scryptSync(password, s, 32, { N: 16384, r: 8, p: 1 });

function seal(): void {
  if (!key || !salt) throw new Error('Secrets are locked');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(cache), 'utf8'), cipher.final()]);
  const env: Envelope = { v: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(env));
  fs.renameSync(`${FILE}.tmp`, FILE);
}

function touch() {
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = setTimeout(lock, IDLE_MS);
  lockTimer.unref();
}

export function lock() {
  key = null;
  cache = {};
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = null;
}

export const exists = () => fs.existsSync(FILE);
export const unlocked = () => key !== null;

export function init(password: string) {
  if (exists()) throw new Error('Secrets are already set up');
  if (password.length < 8) throw new Error('Use a master password of at least 8 characters');
  salt = crypto.randomBytes(16);
  key = derive(password, salt);
  cache = {};
  seal();
  touch();
}

export function unlock(password: string) {
  if (!exists()) throw new Error('Secrets are not set up yet');
  const env = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Envelope;
  const s = Buffer.from(env.salt, 'base64');
  const k = derive(password, s);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(env.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(env.tag, 'base64'));
    const plain = Buffer.concat([decipher.update(Buffer.from(env.data, 'base64')), decipher.final()]).toString('utf8');
    cache = JSON.parse(plain);
  } catch {
    throw new Error('Wrong master password');
  }
  key = k;
  salt = s;
  touch();
}

export function names(): string[] {
  if (!key) throw new Error('Secrets are locked');
  touch();
  return Object.keys(cache).sort();
}

export function getSecret(name: string): string | undefined {
  if (!key) return undefined;
  touch();
  return cache[name];
}

export function setSecret(name: string, value: string) {
  if (!key) throw new Error('Secrets are locked');
  if (!/^[a-z0-9._-]{1,60}$/i.test(name)) throw new Error('Names use letters, numbers, dot, dash and underscore');
  if (!value || value.length > 4000) throw new Error('A secret needs a value under 4000 characters');
  cache[name] = value;
  seal();
  touch();
}

export function deleteSecret(name: string) {
  if (!key) throw new Error('Secrets are locked');
  delete cache[name];
  seal();
  touch();
}

export function mountSecretRoutes(app: Express) {
  app.use('/api/secrets', localOnly);

  app.get('/api/secrets/status', (_req: Request, res: Response) => res.json({ success: true, exists: exists(), unlocked: unlocked() }));

  app.post('/api/secrets/init', handle((req, res) => {
    init(str(req.body?.password, 200) ?? '');
    audit('secrets-init', 'owner', 'Created the encrypted secrets store');
    res.json({ success: true });
  }));

  app.post('/api/secrets/unlock', handle((req, res) => {
    unlock(str(req.body?.password, 200) ?? '');
    audit('secrets-unlock', 'owner', 'Unlocked the secrets store');
    res.json({ success: true, names: names() });
  }));

  app.post('/api/secrets/lock', (_req: Request, res: Response) => {
    lock();
    res.json({ success: true });
  });

  /** Names only. Values are never sent back to the page. */
  app.get('/api/secrets', handle((_req, res) => res.json({ success: true, names: names() })));

  app.put('/api/secrets/:name', handle((req, res) => {
    setSecret(String(req.params.name), str(req.body?.value, 4000) ?? '');
    audit('secrets-set', 'owner', `Stored secret ${req.params.name}`);
    res.json({ success: true });
  }));

  app.delete('/api/secrets/:name', handle((req, res) => {
    deleteSecret(String(req.params.name));
    audit('secrets-delete', 'owner', `Removed secret ${req.params.name}`);
    res.json({ success: true });
  }));

  void fail;
}
