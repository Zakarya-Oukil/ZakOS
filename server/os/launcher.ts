import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { fail, handle, localOnly, run, str } from './common';

/**
 * Opens things on this machine. Apps come from the Windows Start menu list (Win32 and Store apps), and the client can
 * only name an app by its id from that list, never by a path or a command line. Links open in the default browser, and
 * only http and https. Nothing here is reachable except from this machine.
 */
interface StartApp {
  id: string;
  name: string;
}

let cache: { at: number; apps: StartApp[] } | null = null;
const TTL = 5 * 60_000;

async function startApps(force = false): Promise<StartApp[]> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.apps;
  const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress'], { timeout: 20_000 });
  let rows: Array<{ Name?: string; AppID?: string }> = [];
  try {
    const j = JSON.parse(out.stdout) as unknown;
    rows = Array.isArray(j) ? j : j ? [j as { Name?: string; AppID?: string }] : [];
  } catch {
    /* PowerShell returned nothing usable */
  }
  const seen = new Set<string>();
  const apps: StartApp[] = [];
  for (const r of rows) {
    if (!r.Name || !r.AppID || seen.has(r.AppID)) continue;
    seen.add(r.AppID);
    apps.push({ id: r.AppID, name: r.Name });
  }
  apps.sort((a, b) => a.name.localeCompare(b.name));
  cache = { at: Date.now(), apps };
  return apps;
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Best match for a spoken or typed app name: exact, then starts with, then contains, then every word present. */
function findApp(apps: StartApp[], query: string): StartApp | null {
  const q = normalise(query);
  if (!q) return null;
  const rows = apps.map((a) => ({ a, n: normalise(a.name) }));
  return (
    rows.find((r) => r.n === q)?.a ??
    rows.find((r) => r.n.startsWith(q))?.a ??
    rows.find((r) => r.n.includes(q))?.a ??
    rows.find((r) => q.split(' ').every((w) => r.n.includes(w)))?.a ??
    null
  );
}

function safeWebUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** The first video for a search, so "play lofi on YouTube" can open a real player. Read from the public results page. */
async function firstYouTubeVideo(query: string): Promise<{ id: string; title: string } | null> {
  const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en`, {
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'accept-language': 'en' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const html = await res.text();
  const m = /"videoRenderer":\{"videoId":"([\w-]{11})".*?"title":\{"runs":\[\{"text":"(.*?)"\}/s.exec(html);
  return m ? { id: m[1], title: m[2].replace(/\\u0026/g, '&').replace(/\\"/g, '"') } : null;
}

export function mountLauncherRoutes(app: Express) {
  app.use('/api/launcher', localOnly);

  app.get('/api/launcher/apps', handle(async (req: Request, res: Response) => {
    const apps = await startApps(req.query.refresh === '1');
    res.json({ success: true, apps });
  }));

  app.post('/api/launcher/open-app', handle(async (req: Request, res: Response) => {
    const query = str(req.body?.name, 120);
    if (!query) return fail(res, 400, 'Say which app to open');
    const apps = await startApps();
    const hit = findApp(apps, query);
    if (!hit) return fail(res, 404, `No app called "${query}" in the Start menu`);
    // explorer.exe takes the AppID after shell:AppsFolder\ and starts both desktop and Store apps.
    const out = await run('explorer.exe', [`shell:AppsFolder\\${hit.id}`], { timeout: 10_000 });
    // explorer.exe exits 1 even when it succeeds, so only a spawn failure counts.
    if (!out.ok && /ENOENT|not found/i.test(out.stderr)) return fail(res, 500, 'Could not start the app');
    audit('launcher.app', 'owner', `Opened app ${hit.name}`);
    res.json({ success: true, app: hit });
  }));

  app.post('/api/launcher/open-url', handle(async (req: Request, res: Response) => {
    const url = safeWebUrl(str(req.body?.url, 2000) ?? '');
    if (!url) return fail(res, 400, 'Only http and https links can be opened');
    await run('explorer.exe', [url], { timeout: 10_000 });
    audit('launcher.url', 'owner', `Opened in browser ${new URL(url).host}`);
    res.json({ success: true, url });
  }));

  app.get('/api/launcher/youtube', handle(async (req: Request, res: Response) => {
    const q = str(req.query.q, 200);
    if (!q) return fail(res, 400, 'Give a search');
    const hit = await firstYouTubeVideo(q).catch(() => null);
    if (!hit) return fail(res, 404, 'YouTube did not return a video for that search');
    res.json({ success: true, ...hit });
  }));
}
