import fs from 'node:fs';
import type { Express, NextFunction, Request, Response } from 'express';
import { audit } from '../audit';
import * as projects from '../projects/store';
import { isTrustedLocalRequest } from '../terminal/pty';
import * as g from './git';

/** These change repositories and can push code, so they are local-only like the terminal. */
function localOnly(req: Request, res: Response, next: NextFunction) {
  if (!isTrustedLocalRequest(req)) {
    res.status(403).json({ success: false, error: 'Local access only' });
    return;
  }
  next();
}

const fail = (res: Response, status: number, error: string) => res.status(status).json({ success: false, error });
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Only registered projects can be operated on, so a request cannot point git at an arbitrary folder. */
function projectOf(req: Request, res: Response): { id: string; name: string; cwd: string } | undefined {
  const p = projects.getProject(String(req.params.projectId));
  if (!p) return void fail(res, 404, 'Project not found');
  if (!fs.existsSync(p.path)) return void fail(res, 410, 'The project folder no longer exists');
  return { id: p.id, name: p.name, cwd: p.path };
}

export function mountGitRoutes(app: Express) {
  app.use('/api/git', localOnly);

  /** Wraps a handler so every git failure becomes a readable 400 and non-repos get a clear answer. */
  const handle = (fn: (p: { id: string; name: string; cwd: string }, req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
    const p = projectOf(req, res);
    if (!p) return;
    if (!(await g.isRepo(p.cwd))) return fail(res, 409, 'This project is not a git repository');
    try {
      await fn(p, req, res);
    } catch (err) {
      if (!res.headersSent) fail(res, 400, err instanceof Error ? err.message : String(err));
    }
  };

  /** A file name from the client is only acted on if it really appears in git status. */
  const known = async (cwd: string, file: unknown) => (typeof file === 'string' ? (await g.status(cwd)).files.find((f) => f.path === file) : undefined);

  app.get('/api/git/:projectId/status', handle(async (p, _req, res) => {
    res.json({ success: true, status: await g.status(p.cwd) });
  }));

  app.get('/api/git/:projectId/diff', handle(async (p, req, res) => {
    const file = await known(p.cwd, req.query.file);
    if (!file) return fail(res, 404, 'That file has no changes');
    res.json({ success: true, ...(await g.diff(p.cwd, file, req.query.staged === '1')) });
  }));

  app.post('/api/git/:projectId/stage', handle(async (p, req, res) => {
    const st = await g.status(p.cwd);
    const wanted: string[] = req.body?.all === true ? st.files.filter((f) => f.worktree !== ' ' || f.index === '?').map((f) => f.path) : Array.isArray(req.body?.files) ? req.body.files : [];
    const paths = st.files.filter((f) => wanted.includes(f.path)).map((f) => f.path);
    if (paths.length === 0) return fail(res, 400, 'Nothing to stage');
    await g.run(p.cwd, ['add', '--', ...paths]);
    res.json({ success: true, staged: paths.length });
  }));

  app.post('/api/git/:projectId/unstage', handle(async (p, req, res) => {
    const st = await g.status(p.cwd);
    const wanted: string[] = req.body?.all === true ? st.files.filter((f) => f.index !== ' ' && f.index !== '?').map((f) => f.path) : Array.isArray(req.body?.files) ? req.body.files : [];
    const paths = st.files.filter((f) => wanted.includes(f.path)).map((f) => f.path);
    if (paths.length === 0) return fail(res, 400, 'Nothing to unstage');
    // A repository with no commits has no HEAD to reset to, so fall back to removing from the index.
    await g.run(p.cwd, ['reset', '-q', '--', ...paths]).catch(() => g.run(p.cwd, ['rm', '--cached', '-q', '--', ...paths]));
    res.json({ success: true, unstaged: paths.length });
  }));

  /** Throws away uncommitted work in one file. The client confirms first; this is the only destructive route. */
  app.post('/api/git/:projectId/discard', handle(async (p, req, res) => {
    const file = await known(p.cwd, req.body?.file);
    if (!file) return fail(res, 404, 'That file has no changes');
    if (file.index === '?') fs.unlinkSync(`${p.cwd}/${file.path}`);
    else {
      // Staged changes go back to the last commit as well, so the file really returns to its committed state.
      await g.run(p.cwd, ['restore', '--source=HEAD', '--staged', '--worktree', '--', file.path]).catch(() => g.run(p.cwd, ['rm', '-f', '-q', '--', file.path]));
    }
    audit('git-discard', 'owner', `Discarded changes to ${file.path}`, { project: p.name });
    res.json({ success: true });
  }));

  app.post('/api/git/:projectId/commit', handle(async (p, req, res) => {
    const message = str(req.body?.message);
    if (!message) return fail(res, 400, 'Write a commit message first');
    const st = await g.status(p.cwd);
    if (!st.files.some((f) => f.index !== ' ' && f.index !== '?')) return fail(res, 409, 'Nothing is staged. Stage some files first.');
    await g.run(p.cwd, ['commit', '-m', message.slice(0, 5000)], { timeout: 120_000 });
    const [latest] = await g.log(p.cwd, 1);
    audit('git-commit', 'owner', `${latest?.short ?? ''} ${message.split('\n')[0]}`.trim(), { project: p.name });
    res.json({ success: true, commit: latest });
  }));

  app.get('/api/git/:projectId/log', handle(async (p, req, res) => {
    res.json({ success: true, commits: await g.log(p.cwd, Math.min(200, Math.max(1, Number(req.query.limit) || 40))) });
  }));

  app.get('/api/git/:projectId/commit/:hash', handle(async (p, req, res) => {
    const hash = String(req.params.hash);
    if (!/^[0-9a-f]{7,40}$/i.test(hash)) return fail(res, 400, 'Invalid commit');
    const out = await g.run(p.cwd, ['show', '--no-color', '--stat', '--patch', '--format=fuller', hash]);
    res.json({ success: true, diff: out.length > 200_000 ? out.slice(0, 200_000) : out, truncated: out.length > 200_000 });
  }));

  app.get('/api/git/:projectId/branches', handle(async (p, _req, res) => {
    res.json({ success: true, branches: await g.branches(p.cwd) });
  }));

  app.post('/api/git/:projectId/checkout', handle(async (p, req, res) => {
    const name = str(req.body?.branch);
    if (!name || !g.validBranch(name)) return fail(res, 400, 'Invalid branch name');
    await g.run(p.cwd, ['checkout', name, '--']);
    audit('git-checkout', 'owner', `Switched to ${name}`, { project: p.name });
    res.json({ success: true });
  }));

  app.post('/api/git/:projectId/branch', handle(async (p, req, res) => {
    const name = str(req.body?.name);
    if (!name || !g.validBranch(name)) return fail(res, 400, 'Use letters, numbers, dots, slashes, dashes and underscores for a branch name');
    await g.run(p.cwd, ['checkout', '-b', name]);
    audit('git-branch', 'owner', `Created branch ${name}`, { project: p.name });
    res.json({ success: true });
  }));

  app.post('/api/git/:projectId/pull', handle(async (p, _req, res) => {
    const out = await g.run(p.cwd, ['pull', '--ff-only'], { timeout: 120_000 });
    audit('git-pull', 'owner', out.trim().split('\n')[0] || 'Pulled', { project: p.name });
    res.json({ success: true, output: out.trim() });
  }));

  /** Sends commits to the remote, so the client asks first and this only pushes the current branch. */
  app.post('/api/git/:projectId/push', handle(async (p, _req, res) => {
    const st = await g.status(p.cwd);
    if (st.detached) return fail(res, 409, 'You are not on a branch, so there is nothing to push');
    const out = await g.run(p.cwd, st.upstream ? ['push'] : ['push', '-u', 'origin', st.branch], { timeout: 180_000 });
    audit('git-push', 'owner', `Pushed ${st.branch}`, { project: p.name });
    res.json({ success: true, output: out.trim() });
  }));
}
