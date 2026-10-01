import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { scrubSecrets } from '../secrets';
import { vaultService } from '../vault';
import { fail, handle, localOnly, str } from './common';

/**
 * Brain helpers: notes nobody links to, links that could exist, a timeline of when notes were made, what agents
 * remembered, and quick capture into an Inbox folder. Everything is read from the vault index; capture writes one note.
 */
const isGraphExport = (rel: string) => rel.replace(/\\/g, '/').split('/').includes('Graph');
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function mountBrainExtras(app: Express) {
  app.use('/api/brain-x', localOnly);

  app.get('/api/brain-x/orphans', handle((_req: Request, res: Response) => {
    const notes = vaultService
      .getAllNotes()
      .filter((n) => !isGraphExport(n.relativePath) && n.links.length === 0 && n.backlinks.length === 0 && n.branch !== 'templates')
      .sort((a, b) => b.wordCount - a.wordCount)
      .slice(0, 100)
      .map((n) => ({ title: n.title, relativePath: n.relativePath, words: n.wordCount, updated: n.updated }));
    res.json({ success: true, notes });
  }));

  /** Notes whose text mentions another note's title without linking to it. */
  app.get('/api/brain-x/link-suggestions', handle((_req: Request, res: Response) => {
    const notes = vaultService.getAllNotes().filter((n) => !isGraphExport(n.relativePath) && n.branch !== 'templates');
    const titled = notes.filter((n) => n.title.length >= 8 && n.title.length <= 60);
    const out: Array<{ from: string; fromPath: string; to: string; toPath: string }> = [];
    outer: for (const n of notes.slice(0, 600)) {
      const linked = new Set(n.links.map((l) => l.toLowerCase()));
      const body = n.content.toLowerCase();
      if (body.length < 80) continue;
      for (const t of titled) {
        if (t === n || linked.has(t.title.toLowerCase()) || n.backlinks.some((b) => b.toLowerCase().includes(t.title.toLowerCase()))) continue;
        if (new RegExp(`(^|[^\\w])${esc(t.title.toLowerCase())}([^\\w]|$)`).test(body)) {
          out.push({ from: n.title, fromPath: n.relativePath, to: t.title, toPath: t.relativePath });
          if (out.length >= 40) break outer;
        }
      }
    }
    res.json({ success: true, suggestions: out });
  }));

  app.get('/api/brain-x/timeline', handle((req: Request, res: Response) => {
    const days = Math.min(365, Math.max(7, Number(req.query.days) || 60));
    const since = Date.now() - days * 86_400_000;
    const byDay = new Map<string, Array<{ title: string; relativePath: string }>>();
    for (const n of vaultService.getAllNotes()) {
      if (isGraphExport(n.relativePath)) continue;
      const t = Date.parse(n.created || n.updated);
      if (!Number.isFinite(t) || t < since) continue;
      const key = new Date(t).toISOString().slice(0, 10);
      (byDay.get(key) ?? byDay.set(key, []).get(key)!).push({ title: n.title, relativePath: n.relativePath });
    }
    const timeline = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, notes]) => ({ day, count: notes.length, notes: notes.slice(0, 8) }));
    res.json({ success: true, timeline });
  }));

  app.get('/api/brain-x/agent-memory', handle((_req: Request, res: Response) => {
    const notes = vaultService
      .getAllNotes()
      .filter((n) => n.relativePath.replace(/\\/g, '/').startsWith('00 Zak OS Captures/'))
      .sort((a, b) => (a.relativePath < b.relativePath ? 1 : -1))
      .slice(0, 20)
      .map((n) => ({ title: n.title, relativePath: n.relativePath, entries: (n.content.match(/^## /gm) ?? []).length, excerpt: n.content.replace(/^#.*$/m, '').trim().slice(0, 260) }));
    res.json({ success: true, notes });
  }));

  /** Quick capture: one note in the Inbox folder, credentials blanked. */
  app.post('/api/brain-x/capture', handle(async (req: Request, res: Response) => {
    const title = (str(req.body?.title, 80) ?? '').replace(/[\\/:*?"<>|#^[\]\r\n]+/g, ' ').trim();
    const body = scrubSecrets(str(req.body?.body, 20_000) ?? '').trim();
    if (!title && !body) return fail(res, 400, 'Write something to capture');
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const name = title || body.split('\n')[0].slice(0, 60).replace(/[\\/:*?"<>|#^[\]]+/g, ' ').trim() || 'Quick note';
    const rel = `00 Inbox/${stamp} ${name}`;
    await vaultService.saveNote(rel, `# ${name}\n\n${body}\n`, { title: name, type: 'inbox', category: 'inbox', tags: ['inbox', 'zak-os'], created: stamp, updated: stamp });
    audit('brain-capture', 'owner', `Captured a note: ${name}`);
    res.status(201).json({ success: true, path: `${rel}.md` });
  }));
}
