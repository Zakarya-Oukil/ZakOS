import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { getProject } from '../projects/store';
import { scrubSecrets } from '../secrets';
import { fail, handle, localOnly, str } from './common';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv', 'graphify-out', '.cache']);
const MAX_READ = 1_500_000;
const IMAGE_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const ENV_FILE = /(^|[\\/])\.env(\..*)?$/i;

/** Resolves a path inside a registered project, or throws. Nothing outside the project folder gets through. */
function resolveIn(projectId: string, rel: string): { root: string; full: string } {
  const project = getProject(projectId);
  if (!project) throw new Error('Project not found');
  const root = path.resolve(project.path);
  const full = path.resolve(root, rel || '.');
  const back = path.relative(root, full);
  if (back.startsWith('..') || path.isAbsolute(back)) throw new Error('That path is outside the project');
  // Resolve symlinks so a link cannot lead out of the folder.
  const real = fs.existsSync(full) ? fs.realpathSync(full) : full;
  const realRoot = fs.realpathSync(root);
  const realBack = path.relative(realRoot, real);
  if (realBack.startsWith('..') || path.isAbsolute(realBack)) throw new Error('That path is outside the project');
  return { root, full };
}

function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 4000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

export function mountFileRoutes(app: Express) {
  app.use('/api/files', localOnly);

  app.get('/api/files/tree', handle((req, res) => {
    const { root, full } = resolveIn(str(req.query.project, 80) ?? '', str(req.query.dir, 500) ?? '');
    const entries = fs
      .readdirSync(full, { withFileTypes: true })
      .filter((e) => !(e.isDirectory() && SKIP_DIRS.has(e.name)))
      .map((e) => ({ name: e.name, dir: e.isDirectory(), path: path.relative(root, path.join(full, e.name)).replace(/\\/g, '/') }))
      .sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name))
      .slice(0, 500);
    res.json({ success: true, entries });
  }));

  app.get('/api/files/read', handle((req, res) => {
    const { full } = resolveIn(str(req.query.project, 80) ?? '', str(req.query.path, 500) ?? '');
    const stat = fs.statSync(full);
    if (!stat.isFile()) return fail(res, 400, 'Not a file');
    const ext = path.extname(full).toLowerCase();
    if (IMAGE_TYPES[ext]) {
      if (stat.size > 6_000_000) return fail(res, 400, 'Image is too large to preview');
      return res.json({ success: true, kind: 'image', dataUrl: `data:${IMAGE_TYPES[ext]};base64,${fs.readFileSync(full).toString('base64')}` });
    }
    if (ext === '.pdf') {
      if (stat.size > 12_000_000) return fail(res, 400, 'PDF is too large to preview');
      return res.json({ success: true, kind: 'pdf', dataUrl: `data:application/pdf;base64,${fs.readFileSync(full).toString('base64')}` });
    }
    if (stat.size > MAX_READ) return fail(res, 400, `File is larger than ${Math.round(MAX_READ / 1000)} kB`);
    const buf = fs.readFileSync(full);
    if (looksBinary(buf)) return res.json({ success: true, kind: 'binary', size: stat.size });
    const secret = ENV_FILE.test(full);
    res.json({ success: true, kind: 'text', content: secret ? scrubSecrets(buf.toString('utf8')) : buf.toString('utf8'), readOnly: secret, mtime: stat.mtimeMs });
  }));

  app.put('/api/files/write', handle((req, res) => {
    const rel = str(req.body?.path, 500) ?? '';
    const content = req.body?.content;
    if (typeof content !== 'string' || content.length > MAX_READ) return fail(res, 400, 'content must be text under 1.5 MB');
    const { full } = resolveIn(str(req.body?.project, 80) ?? '', rel);
    if (ENV_FILE.test(full)) return fail(res, 403, 'Environment files are read-only here');
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return fail(res, 404, 'File not found. This editor changes existing files only.');
    fs.writeFileSync(full, content);
    audit('file-edit', 'owner', `Edited ${rel}`, { project: str(req.body?.project, 80) });
    res.json({ success: true });
  }));

  app.get('/api/files/search', handle((req, res) => {
    const { root } = resolveIn(str(req.query.project, 80) ?? '', '');
    const q = (str(req.query.q, 100) ?? '').trim().toLowerCase();
    if (q.length < 2) return res.json({ success: true, hits: [] });
    const hits: Array<{ path: string; line: number; text: string }> = [];
    let scanned = 0;
    const walk = (dir: string) => {
      if (hits.length >= 80 || scanned > 4000) return;
      let list: fs.Dirent[];
      try {
        list = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of list) {
        if (hits.length >= 80 || scanned > 4000) return;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (!SKIP_DIRS.has(e.name)) walk(p);
        } else if (e.isFile() && !ENV_FILE.test(p)) {
          scanned++;
          try {
            if (fs.statSync(p).size > 400_000) continue;
            const buf = fs.readFileSync(p);
            if (looksBinary(buf)) continue;
            const lines = buf.toString('utf8').split(/\r?\n/);
            for (let i = 0; i < lines.length && hits.length < 80; i++) {
              if (lines[i].toLowerCase().includes(q)) hits.push({ path: path.relative(root, p).replace(/\\/g, '/'), line: i + 1, text: lines[i].trim().slice(0, 200) });
            }
          } catch {
            /* unreadable file: skip */
          }
        }
      }
    };
    walk(root);
    res.json({ success: true, hits, truncated: hits.length >= 80 });
  }));
}

export const _test = { resolveIn };
export type { Request, Response };
