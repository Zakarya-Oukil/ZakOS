import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { fail, handle, kvGet, kvSet, localOnly, str } from './common';

/**
 * Offline licence keys. A key is `ZAKOS1.<payload>.<signature>` where the signature is Ed25519 over the payload.
 * Only the public key ships with the app (licence/public.pem), so a customer cannot mint keys. The seller signs keys
 * with scripts/licence.mjs using the private key, which is never committed. Verification needs no network.
 *
 * Enforcement is friendly: without a valid key the premium modules show an upgrade page. Nothing is deleted,
 * and every module's data stays on disk and exportable.
 */
export type Plan = 'free' | 'pro' | 'team';
const RANK: Record<Plan, number> = { free: 0, pro: 1, team: 2 };

interface Payload {
  plan: Plan;
  licensee: string;
  email?: string;
  issued: number;
  expires: number | null;
}

const PUBLIC_FILE = path.resolve(process.cwd(), 'licence', 'public.pem');
const b64u = (s: string) => Buffer.from(s, 'base64url');

export function verifyKey(key: string): { ok: true; payload: Payload } | { ok: false; reason: string } {
  const parts = key.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'ZAKOS1') return { ok: false, reason: 'That does not look like a Zak OS licence key' };
  let publicKey: crypto.KeyObject;
  try {
    publicKey = crypto.createPublicKey(fs.readFileSync(PUBLIC_FILE, 'utf8'));
  } catch {
    return { ok: false, reason: 'This build has no licence public key (licence/public.pem)' };
  }
  let valid = false;
  try {
    valid = crypto.verify(null, b64u(parts[1]), publicKey, b64u(parts[2]));
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: 'The signature does not match. The key may have been changed or copied wrongly.' };
  let payload: Payload;
  try {
    payload = JSON.parse(b64u(parts[1]).toString('utf8')) as Payload;
  } catch {
    return { ok: false, reason: 'The key contents are unreadable' };
  }
  if (!(payload.plan in RANK) || typeof payload.licensee !== 'string') return { ok: false, reason: 'The key contents are not valid' };
  if (payload.expires !== null && payload.expires < Date.now()) return { ok: false, reason: `This key expired on ${new Date(payload.expires).toLocaleDateString()}` };
  return { ok: true, payload };
}

export function currentPlan(): { plan: Plan; payload: Payload | null; reason?: string } {
  const key = kvGet<string | null>('licence.key', null);
  if (!key) return { plan: 'free', payload: null };
  const v = verifyKey(key);
  return v.ok ? { plan: v.payload.plan, payload: v.payload } : { plan: 'free', payload: null, reason: v.reason };
}

export const planAtLeast = (need: Plan): boolean => RANK[currentPlan().plan] >= RANK[need];

export function mountLicenceRoutes(app: Express) {
  app.use('/api/licence', localOnly);

  app.get('/api/licence', (_req: Request, res: Response) => {
    const cur = currentPlan();
    const pkg = (() => {
      try {
        return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')) as { version?: string };
      } catch {
        return {};
      }
    })();
    res.json({
      success: true,
      plan: cur.plan,
      licensee: cur.payload?.licensee ?? null,
      expires: cur.payload?.expires ?? null,
      reason: cur.reason ?? null,
      version: pkg.version ?? '0.0.0',
      buyUrl: kvGet<string>('licence.buyUrl', ''),
      manifestUrl: kvGet<string>('licence.manifestUrl', ''),
      hasPublicKey: fs.existsSync(PUBLIC_FILE),
    });
  });

  app.post('/api/licence/activate', handle((req, res) => {
    const key = str(req.body?.key, 2000)?.trim() ?? '';
    const v = verifyKey(key);
    if (!v.ok) return fail(res, 400, v.reason);
    kvSet('licence.key', key);
    audit('licence-activate', 'owner', `Activated ${v.payload.plan} licence for ${v.payload.licensee}`);
    res.json({ success: true, plan: v.payload.plan });
  }));

  app.delete('/api/licence', handle((_req, res) => {
    kvSet('licence.key', null);
    audit('licence-remove', 'owner', 'Removed the licence key');
    res.json({ success: true });
  }));

  app.put('/api/licence/settings', handle((req, res) => {
    const url = (v: unknown) => {
      const s = typeof v === 'string' ? v.trim() : '';
      if (!s) return '';
      const u = new URL(s);
      if (u.protocol !== 'https:') throw new Error('Use an https link');
      return u.toString();
    };
    kvSet('licence.buyUrl', url(req.body?.buyUrl));
    kvSet('licence.manifestUrl', url(req.body?.manifestUrl));
    res.json({ success: true });
  }));

  /** Reads a small JSON manifest the seller hosts: { "version": "1.2.0", "notes": "...", "url": "https://..." }. */
  app.get('/api/licence/updates', handle(async (_req, res) => {
    const manifest = kvGet<string>('licence.manifestUrl', '');
    if (!manifest) return res.json({ success: true, configured: false });
    const r = await fetch(manifest, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return fail(res, 502, `The update manifest answered ${r.status}`);
    const m = (await r.json()) as { version?: string; notes?: string; url?: string };
    res.json({ success: true, configured: true, latest: m.version ?? null, notes: m.notes ?? '', url: m.url ?? '' });
  }));
}
