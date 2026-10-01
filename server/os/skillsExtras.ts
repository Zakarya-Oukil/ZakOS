import { spawn } from 'node:child_process';
import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { createSkill, frontmatter, NAME, readSkill, scopeOf, writeSkill } from '../skills/skills';
import { fail, handle, localOnly, osdb, str } from './common';

/**
 * Skill helpers: import one from a link after a safety review, try one on a sample prompt without any tools, count how
 * often each was used, and export one as a file. Importing never installs anything by itself: the page shows the review first.
 */
const MAX = 120_000;

/** Turns a GitHub page link into the raw file link. Only https links to a few well-known hosts are fetched. */
function rawUrl(link: string): URL {
  const u = new URL(link.trim());
  if (u.protocol !== 'https:') throw new Error('Use an https link');
  if (u.hostname === 'github.com') {
    const m = /^\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(u.pathname);
    if (m) return new URL(`https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`);
  }
  if (!['raw.githubusercontent.com', 'gist.githubusercontent.com', 'github.com', 'gitlab.com'].includes(u.hostname)) {
    throw new Error('Only links on GitHub or GitLab can be imported');
  }
  return u;
}

/** A short list of things worth a second look before a skill is trusted. */
function review(text: string): string[] {
  const flags: string[] = [];
  const t = text.toLowerCase();
  if (/\b(curl|wget|invoke-webrequest|iwr)\b/.test(t)) flags.push('It talks to the internet (curl, wget or similar).');
  if (/\brm\s+-|\bdel\s+\/|remove-item|format\s+[a-z]:|mkfs/.test(t)) flags.push('It mentions deleting files or disks.');
  if (/\bsudo\b|chmod\s+7|runas\b/.test(t)) flags.push('It asks for elevated rights.');
  if (/\|\s*(sh|bash|iex|powershell)\b/.test(t)) flags.push('It pipes a download into a shell.');
  if (/\.ssh|id_rsa|\.aws|credentials|api[_-]?key|password|secret/.test(t)) flags.push('It mentions credentials or keys.');
  if (/allowed-tools\s*:/.test(t)) flags.push('It lists tools it wants to use without asking.');
  if (/ignore (all |any )?(previous|prior) instructions|disregard/.test(t)) flags.push('It contains text that tries to override earlier instructions.');
  return flags;
}

function askWith(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'text', '--permission-mode', 'plan'], { windowsHide: true, shell: process.platform === 'win32' });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Claude took too long to answer'));
    }, 90_000);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      code === 0 && out.trim() ? resolve(out.trim()) : reject(new Error(err.trim().split('\n')[0] || 'Claude did not answer'));
    });
    child.stdin.end(prompt);
  });
}

export function mountSkillsExtras(app: Express) {
  app.use('/api/skills-x', localOnly);

  app.post('/api/skills-x/fetch', handle(async (req: Request, res: Response) => {
    const url = rawUrl(str(req.body?.url, 500) ?? '');
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'follow' });
    if (!r.ok) return fail(res, 502, `The link answered ${r.status}`);
    const text = await r.text();
    if (text.length > MAX) return fail(res, 413, 'That file is too large to be a skill');
    const fm = frontmatter(text);
    const name = (fm.name ?? '').toLowerCase();
    res.json({ success: true, content: text, name: NAME.test(name) ? name : '', description: fm.description ?? '', flags: review(text), source: url.toString() });
  }));

  app.post('/api/skills-x/install', handle((req: Request, res: Response) => {
    const name = (str(req.body?.name, 63) ?? '').toLowerCase();
    const scope = str(req.body?.scope, 80) ?? 'user';
    const content = str(req.body?.content, MAX) ?? '';
    if (!NAME.test(name)) return fail(res, 400, 'Choose a name with lowercase letters, numbers and dashes');
    if (!scopeOf(scope)) return fail(res, 404, 'Unknown location');
    if (!/^---\r?\n[\s\S]*?\r?\n---/.test(content)) return fail(res, 400, 'A skill file starts with a --- header block');
    let exists = true;
    try {
      readSkill(scope, name);
    } catch {
      exists = false;
    }
    if (exists) return fail(res, 409, `A skill called ${name} already exists there`);
    // createSkill makes the folder and a stub; the reviewed file then replaces the stub.
    createSkill(scope, name, 'Imported skill', 'placeholder');
    writeSkill(scope, name, content);
    audit('skill-import', 'owner', `Imported skill ${name} (${scope})`);
    res.status(201).json({ success: true });
  }));

  app.post('/api/skills-x/try', handle(async (req: Request, res: Response) => {
    const body = readSkill(String(req.body?.scope ?? ''), String(req.body?.name ?? '')).content;
    const sample = (str(req.body?.sample, 2000) ?? '').trim();
    if (!sample) return fail(res, 400, 'Write a sample request to try the skill on');
    const prompt =
      'You are being tested with a skill. Follow the skill instructions below exactly. You have no tools and cannot touch any files: ' +
      'answer in text only, as the skill says you would, and say which of its steps you would take.\n\n--- SKILL ---\n' +
      body.slice(0, 40_000) +
      '\n--- END SKILL ---\n\nSample request: ' +
      sample;
    const answer = await askWith(prompt);
    audit('skill-try', 'owner', `Tried skill ${req.body?.name} on a sample request`);
    res.json({ success: true, answer });
  }));

  /** How many times Claude invoked each skill through Zak OS, from the audit log. */
  app.get('/api/skills-x/usage', handle((_req: Request, res: Response) => {
    const rows = osdb.prepare("SELECT detail FROM audit WHERE kind = 'tool' AND detail LIKE 'Skill %' ORDER BY id DESC LIMIT 2000").all() as Array<{ detail: string }>;
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const m = /"skill"\s*:\s*"([^"]+)"/.exec(r.detail);
      if (m) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
    }
    res.json({ success: true, counts });
  }));

  app.get('/api/skills-x/export/:scope/:name', handle((req: Request, res: Response) => {
    const { content } = readSkill(String(req.params.scope), String(req.params.name));
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${String(req.params.name).replace(/[^a-z0-9-]/gi, '')}-SKILL.md"`);
    res.send(content);
  }));

}
