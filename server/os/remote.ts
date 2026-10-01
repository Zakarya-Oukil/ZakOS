import type { Express, NextFunction, Request, Response } from 'express';
import { isTrustedLocalRequest } from '../terminal/pty';
import { audit } from '../audit';
import { authEnabled, userFor } from './auth';
import { fail, handle, kvGet, kvSet, localOnly, run } from './common';
import { planAtLeast } from './licence';

/**
 * Remote access never opens a port by itself. The server stays on 127.0.0.1; the owner publishes it with Tailscale
 * or a Cloudflare Tunnel, which forward to localhost. This module decides what a request that arrives that way may do:
 * nothing, unless remote access is switched on, sign-in is enabled and the person holds an owner or operator account.
 * Even then only the routes mounted with `remoteGuard` answer. The terminal, files, secrets and settings stay local.
 */
interface RemoteSettings {
  enabled: boolean;
  method: 'tailscale' | 'cloudflare';
}

export const remoteSettings = (): RemoteSettings => ({ enabled: false, method: 'tailscale', ...kvGet<Partial<RemoteSettings>>('remote.settings', {}) });

export function remoteGuard(req: Request, res: Response, next: NextFunction) {
  if (isTrustedLocalRequest(req)) return next();
  if (!remoteSettings().enabled) return fail(res, 403, 'Remote access is switched off');
  if (!authEnabled()) return fail(res, 403, 'Turn on sign-in before using remote access');
  const user = userFor(req);
  if (!user) return fail(res, 401, 'Sign in required');
  if (user.role === 'viewer') return fail(res, 403, 'Viewers cannot approve actions');
  (req as Request & { zUser?: unknown }).zUser = user;
  next();
}

async function tailscale(): Promise<{ installed: boolean; running: boolean; host: string | null }> {
  const out = await run('tailscale', ['status', '--json'], { timeout: 8000 });
  if (!out.ok && !out.stdout) return { installed: !/not found|ENOENT|not recognized/i.test(out.stderr), running: false, host: null };
  try {
    const j = JSON.parse(out.stdout) as { BackendState?: string; Self?: { DNSName?: string } };
    return { installed: true, running: j.BackendState === 'Running', host: j.Self?.DNSName?.replace(/\.$/, '') ?? null };
  } catch {
    return { installed: true, running: false, host: null };
  }
}

async function cloudflared(): Promise<boolean> {
  const out = await run('cloudflared', ['--version'], { timeout: 6000 });
  return out.ok;
}

export function mountRemoteRoutes(app: Express) {
  app.use('/api/remote/status', localOnly);
  app.use('/api/remote/settings', localOnly);

  app.get('/api/remote/status', handle(async (_req: Request, res: Response) => {
    const [ts, cf] = await Promise.all([tailscale(), cloudflared()]);
    res.json({
      success: true,
      settings: remoteSettings(),
      listening: '127.0.0.1:4000',
      signIn: authEnabled(),
      teamPlan: planAtLeast('team'),
      tailscale: ts,
      cloudflared: cf,
      terminalRemote: false,
    });
  }));

  app.put('/api/remote/settings', handle((req, res) => {
    const next: RemoteSettings = { enabled: req.body?.enabled === true, method: req.body?.method === 'cloudflare' ? 'cloudflare' : 'tailscale' };
    if (next.enabled && !authEnabled()) throw new Error('Turn on sign-in first (Team tab). Remote access without an account would be open to anyone with the link.');
    kvSet('remote.settings', next);
    audit('remote-settings', 'owner', `Remote access ${next.enabled ? 'on' : 'off'} (${next.method})`);
    res.json({ success: true, settings: next });
  }));
}
