import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { getProject } from '../projects/store';
import { vaultService } from '../vault';
import { fail, handle, kvGet, kvSet, localOnly, run, str } from './common';

/**
 * Extra facts about a project that the project registry does not hold: group, tags, archived, default agent, a linked vault
 * folder, and the standing instructions file (CLAUDE.md) that Claude Code reads on its own.
 */
export interface ProjectMeta {
  group: string;
  tags: string[];
  archived: boolean;
  defaultAgent: string;
  vaultFolder: string;
  notes: string;
  /** Rebuild the project graph when a new commit lands. */
  autoGraph: boolean;
  /** Shown in the Pinned row on Home. */
  pinned: boolean;
}

const DEFAULT: ProjectMeta = { group: '', tags: [], archived: false, defaultAgent: 'claude', vaultFolder: '', notes: '', autoGraph: false, pinned: false };
const key = (id: string) => `project.meta.${id}`;
export const metaOf = (id: string): ProjectMeta => ({ ...DEFAULT, ...kvGet<Partial<ProjectMeta>>(key(id), {}) });

const INSTRUCTION_FILES = ['CLAUDE.md'];

export function mountProjectMeta(app: Express) {
  app.use('/api/project-meta', localOnly);

  const project = (req: Request, res: Response) => {
    const p = getProject(String(req.params.id));
    if (!p) {
      fail(res, 404, 'Project not found');
      return null;
    }
    return p;
  };

  app.get('/api/project-meta', handle((_req: Request, res: Response) => {
    // One call for the list page: every project's meta by id.
    const out: Record<string, ProjectMeta> = {};
    const rows = kvGet<string[]>('project.meta.index', []);
    for (const id of rows) out[id] = metaOf(id);
    res.json({ success: true, meta: out });
  }));

  app.put('/api/project-meta/:id', handle((req: Request, res: Response) => {
    const p = project(req, res);
    if (!p) return;
    const cur = metaOf(p.id);
    const b = req.body ?? {};
    const tags = Array.isArray(b.tags) ? [...new Set((b.tags as unknown[]).map((t) => String(t).trim().toLowerCase().slice(0, 24)).filter(Boolean))].slice(0, 10) : cur.tags;
    const vaultFolder = typeof b.vaultFolder === 'string' ? b.vaultFolder.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : cur.vaultFolder;
    if (vaultFolder.includes('..')) return fail(res, 400, 'The vault folder must stay inside the vault');
    const next: ProjectMeta = {
      group: typeof b.group === 'string' ? b.group.trim().slice(0, 40) : cur.group,
      tags,
      archived: typeof b.archived === 'boolean' ? b.archived : cur.archived,
      defaultAgent: ['claude', 'hermes', 'antigravity'].includes(b.defaultAgent) ? b.defaultAgent : cur.defaultAgent,
      vaultFolder,
      notes: typeof b.notes === 'string' ? b.notes.slice(0, 4000) : cur.notes,
      autoGraph: typeof b.autoGraph === 'boolean' ? b.autoGraph : cur.autoGraph,
      pinned: typeof b.pinned === 'boolean' ? b.pinned : cur.pinned,
    };
    kvSet(key(p.id), next);
    const idx = kvGet<string[]>('project.meta.index', []);
    if (!idx.includes(p.id)) kvSet('project.meta.index', [...idx, p.id]);
    res.json({ success: true, meta: next });
  }));

  app.get('/api/project-meta/:id/overview', handle(async (req: Request, res: Response) => {
    const p = project(req, res);
    if (!p) return;
    const meta = metaOf(p.id);
    let vaultNotes: Array<{ title: string; relativePath: string; updated?: string }> = [];
    if (meta.vaultFolder) {
      try {
        vaultNotes = vaultService
          .getAllNotes()
          .filter((n) => n.relativePath.replace(/\\/g, '/').startsWith(meta.vaultFolder + '/'))
          .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
          .slice(0, 12)
          .map((n) => ({ title: n.title, relativePath: n.relativePath, updated: n.updated }));
      } catch {
        vaultNotes = [];
      }
    }
    res.json({ success: true, meta, instructions: INSTRUCTION_FILES.map((f) => ({ file: f, exists: fs.existsSync(path.join(p.path, f)) })), vaultNotes });
  }));

  app.get('/api/project-meta/:id/instructions', handle((req: Request, res: Response) => {
    const p = project(req, res);
    if (!p) return;
    const file = path.join(p.path, 'CLAUDE.md');
    res.json({ success: true, exists: fs.existsSync(file), content: fs.existsSync(file) ? fs.readFileSync(file, 'utf8').slice(0, 200_000) : '' });
  }));

  app.put('/api/project-meta/:id/instructions', handle((req: Request, res: Response) => {
    const p = project(req, res);
    if (!p) return;
    const content = req.body?.content;
    if (typeof content !== 'string' || content.length > 200_000) return fail(res, 400, 'content must be text under 200 kB');
    fs.writeFileSync(path.join(p.path, 'CLAUDE.md'), content);
    audit('instructions', 'owner', 'Saved CLAUDE.md', { project: p.name });
    res.json({ success: true });
  }));

  /** Open issues and pull requests through the GitHub CLI. */
  app.get('/api/project-meta/:id/github', handle(async (req: Request, res: Response) => {
    const p = project(req, res);
    if (!p) return;
    const [issues, prs] = await Promise.all([
      run('gh', ['issue', 'list', '--state', 'open', '--limit', '15', '--json', 'number,title,author,labels,url,updatedAt'], { cwd: p.path, timeout: 25_000 }),
      run('gh', ['pr', 'list', '--state', 'open', '--limit', '15', '--json', 'number,title,author,headRefName,url,isDraft,reviewDecision,updatedAt'], { cwd: p.path, timeout: 25_000 }),
    ]);
    if (!issues.ok && !prs.ok) return fail(res, 400, (issues.stderr || prs.stderr).trim().split('\n')[0] || 'The GitHub CLI could not read this repository. Is it signed in and does the project have a GitHub remote?');
    res.json({ success: true, issues: issues.ok ? JSON.parse(issues.stdout) : [], prs: prs.ok ? JSON.parse(prs.stdout) : [] });
  }));

  void str;
}
