import type { Express, NextFunction, Request, Response } from 'express';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isTrustedLocalRequest } from '../terminal/pty';
import * as store from './store';
import { isTrust } from '../agents/settings';
import { audit } from '../audit';

// ---- guard -------------------------------------------------------------------------------------

/** These routes run git and Python and browse arbitrary folders, so they are local-only. */
function localOnly(req: Request, res: Response, next: NextFunction) {
  if (!isTrustedLocalRequest(req)) {
    res.status(403).json({ success: false, error: 'Local access only' });
    return;
  }
  next();
}

const fail = (res: Response, status: number, error: string) => res.status(status).json({ success: false, error });
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const pid = (req: Request) => String(req.params.id);

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// ---- background jobs (clone, graphify) -------------------------------------------------------

interface Job {
  id: string;
  kind: 'clone' | 'graphify';
  state: 'running' | 'done' | 'error';
  projectId?: string;
  log: string;
  error?: string;
  startedAt: number;
}

const jobs = new Map<string, Job>();

function newJob(kind: Job['kind'], projectId?: string): Job {
  const job: Job = { id: randomUUID(), kind, state: 'running', projectId, log: '', startedAt: Date.now() };
  jobs.set(job.id, job);
  // Keep the map small: drop finished jobs beyond the most recent 30.
  const done = [...jobs.values()].filter((j) => j.state !== 'running').sort((a, b) => a.startedAt - b.startedAt);
  for (const j of done.slice(0, Math.max(0, done.length - 30))) jobs.delete(j.id);
  return job;
}

function runJob(job: Job, command: string, args: string[], cwd: string, onSuccess?: () => void) {
  const child = spawn(command, args, {
    cwd,
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, // never hang on a credentials prompt
  });
  const append = (d: Buffer) => {
    job.log = (job.log + d.toString('utf8')).slice(-6000);
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.on('error', (err) => {
    job.state = 'error';
    job.error = err.message;
  });
  child.on('close', (code) => {
    if (job.state === 'error') return;
    if (code === 0) {
      try {
        onSuccess?.();
        job.state = 'done';
      } catch (e) {
        job.state = 'error';
        job.error = e instanceof Error ? e.message : String(e);
      }
    } else {
      job.state = 'error';
      // Tidy tool output into something readable: drop carriage returns and the "[graphify watch]" tag.
      const lines = job.log
        .replace(/\r/g, '\n')
        .split('\n')
        .map((l) => l.replace(/^\[graphify watch\]\s*/, '').trim())
        .filter(Boolean);
      job.error = lines.slice(-2).join('\n') || `Exited with code ${code}`;
    }
  });
}

// ---- graph reading -----------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  label: string;
  community: number;
  communityName?: string;
  file?: string;
  degree: number;
}
export interface GraphLink {
  source: string;
  target: string;
  relation?: string;
}

const graphCache = new Map<string, { mtime: number; data: { nodes: GraphNode[]; links: GraphLink[]; builtAtCommit?: string } }>();

function graphFile(project: store.Project): string {
  return path.join(project.path, 'graphify-out', 'graph.json');
}

function readGraph(project: store.Project) {
  const file = graphFile(project);
  const mtime = fs.statSync(file).mtimeMs;
  const hit = graphCache.get(project.id);
  if (hit && hit.mtime === mtime) return hit.data;

  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rawNodes: any[] = Array.isArray(raw.nodes) ? raw.nodes : [];
  const rawLinks: any[] = Array.isArray(raw.links) ? raw.links : Array.isArray(raw.edges) ? raw.edges : [];
  const ids = new Set(rawNodes.map((n) => String(n.id)));
  const links: GraphLink[] = rawLinks
    .filter((l) => ids.has(String(l.source)) && ids.has(String(l.target)))
    .map((l) => ({ source: String(l.source), target: String(l.target), relation: l.relation }));
  const degree = new Map<string, number>();
  for (const l of links) {
    degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
    degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
  }
  const nodes: GraphNode[] = rawNodes.map((n) => ({
    id: String(n.id),
    label: String(n.label ?? n.id),
    community: Number.isFinite(n.community) ? n.community : 0,
    communityName: n.community_name,
    file: n.source_file,
    degree: degree.get(String(n.id)) ?? 0,
  }));
  const data = { nodes, links, builtAtCommit: raw.built_at_commit };
  graphCache.set(project.id, { mtime, data });
  return data;
}

function graphInfo(project: store.Project) {
  try {
    const st = fs.statSync(graphFile(project));
    return { hasGraph: true, graphUpdated: st.mtimeMs };
  } catch {
    return { hasGraph: false, graphUpdated: null as number | null };
  }
}

// ---- helpers -----------------------------------------------------------------------------------

const GITHUB_URL = /^(https:\/\/github\.com\/[\w.-]+\/[\w.-]+?(\.git)?\/?|git@github\.com:[\w.-]+\/[\w.-]+?(\.git)?)$/;

function repoName(url: string): string {
  const last = url.replace(/\/+$/, '').split(/[/:]/).pop() ?? 'repo';
  return last.replace(/\.git$/, '');
}

const PICKER_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = $args[0]
$dialog.ShowNewFolderButton = $true
if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }
`;

// ---- routes ------------------------------------------------------------------------------------

export function mountProjectRoutes(app: Express) {
  app.use(['/api/projects', '/api/fs'], localOnly);

  app.get('/api/projects', (_req: Request, res: Response) => {
    res.json({ success: true, projects: store.listProjects().map((p) => ({ ...p, exists: isDirectory(p.path), ...graphInfo(p) })) });
  });

  app.post('/api/projects', (req: Request, res: Response) => {
    const folder = str(req.body?.path);
    if (!folder) return fail(res, 400, 'path is required');
    const resolved = path.resolve(folder);
    if (!isDirectory(resolved)) return fail(res, 400, 'That folder does not exist');
    if (store.findByPath(resolved)) return fail(res, 409, 'That folder is already a project');
    const project = store.addProject({ path: resolved, name: str(req.body?.name), source: 'folder' });
    res.status(201).json({ success: true, project });
  });

  app.post('/api/projects/clone', (req: Request, res: Response) => {
    const url = str(req.body?.url);
    const parent = str(req.body?.destination);
    if (!url || !GITHUB_URL.test(url)) return fail(res, 400, 'Enter a GitHub URL such as https://github.com/owner/repo');
    if (!parent) return fail(res, 400, 'Choose the folder to clone into');
    const parentDir = path.resolve(parent);
    if (!isDirectory(parentDir)) return fail(res, 400, 'The destination folder does not exist');
    const target = path.join(parentDir, repoName(url));
    if (fs.existsSync(target)) return fail(res, 409, `${target} already exists`);

    const job = newJob('clone');
    // `--` ends option parsing, so a URL can never be read as a git flag.
    runJob(job, 'git', ['clone', '--progress', '--', url, target], parentDir, () => {
      const project = store.addProject({ path: target, source: 'github', remoteUrl: url });
      job.projectId = project.id;
    });
    res.status(202).json({ success: true, job });
  });

  app.patch('/api/projects/:id', (req: Request, res: Response) => {
    const rawTrust = req.body?.trust;
    if (rawTrust !== undefined && rawTrust !== null && !isTrust(rawTrust)) return fail(res, 400, 'Invalid trust level');
    // Full access removes every permission prompt, so it is never set by accident.
    if (rawTrust === 'full' && req.body?.confirmFull !== true) return fail(res, 400, 'Full access needs explicit confirmation');
    const project = store.updateProject(pid(req), { name: str(req.body?.name), color: str(req.body?.color), trust: rawTrust });
    if (!project) return fail(res, 404, 'Project not found');
    if (rawTrust !== undefined) audit('trust', 'owner', `Agent permissions for ${project.name}: ${rawTrust ?? 'follow global setting'}`, { project: project.name });
    res.json({ success: true, project });
  });

  app.delete('/api/projects/:id', (req: Request, res: Response) => {
    if (!store.removeProject(pid(req))) return fail(res, 404, 'Project not found');
    graphCache.delete(pid(req));
    res.json({ success: true });
  });

  app.post('/api/projects/:id/graphify', (req: Request, res: Response) => {
    const project = store.getProject(pid(req));
    if (!project) return fail(res, 404, 'Project not found');
    if (!isDirectory(project.path)) return fail(res, 400, 'The project folder no longer exists');
    const running = [...jobs.values()].find((j) => j.kind === 'graphify' && j.projectId === project.id && j.state === 'running');
    if (running) return res.status(202).json({ success: true, job: running });

    const job = newJob('graphify', project.id);
    // AST extraction only: no model calls, no cost. `update` also works for a first build.
    runJob(job, 'python', ['-m', 'graphify', 'update', '.'], project.path, () => {
      graphCache.delete(project.id);
      if (!fs.existsSync(graphFile(project))) throw new Error('graphify finished but produced no graph');
    });
    res.status(202).json({ success: true, job });
  });

  app.get('/api/projects/jobs/:jobId', (req: Request, res: Response) => {
    const job = jobs.get(String(req.params.jobId));
    if (!job) return fail(res, 404, 'Job not found');
    res.json({ success: true, job });
  });

  app.get('/api/projects/:id/graph', (req: Request, res: Response) => {
    const project = store.getProject(pid(req));
    if (!project) return fail(res, 404, 'Project not found');
    try {
      res.json({ success: true, project, graph: readGraph(project) });
    } catch (err) {
      const missing = (err as NodeJS.ErrnoException).code === 'ENOENT';
      fail(res, missing ? 404 : 500, missing ? 'No graph yet. Run graphify on this project first.' : 'The graph file could not be read');
    }
  });

  // Native Windows folder dialog: the browser cannot reveal absolute paths, but this server runs
  // on the same machine as the browser, so it can show the real picker.
  app.post('/api/fs/pick-folder', (req: Request, res: Response) => {
    if (process.platform !== 'win32') return fail(res, 501, 'The folder picker is only available on Windows. Type the path instead.');
    const title = (str(req.body?.title) ?? 'Select a folder').slice(0, 120);
    execFile(
      'powershell.exe',
      ['-NoProfile', '-STA', '-Command', `& { ${PICKER_SCRIPT} } '${title.replace(/'/g, "''")}'`],
      { windowsHide: false, timeout: 5 * 60_000 },
      (err, stdout) => {
        if (err) return fail(res, 500, 'The folder dialog could not be opened');
        const chosen = stdout.trim();
        res.json({ success: true, path: chosen || null });
      },
    );
  });
}
