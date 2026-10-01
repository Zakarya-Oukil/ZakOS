import { spawn } from 'node:child_process';
import fs from 'node:fs';
import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import * as g from '../git/git';
import * as projects from '../projects/store';
import { fail, handle, localOnly, run, str } from './common';

/**
 * Stash, cherry-pick, merge with a conflict helper, pull requests through `gh`, and commit messages written by
 * Claude from the staged diff. Same rules as the main git routes: registered projects only, local only.
 */
function projectOf(req: Request, res: Response): { id: string; name: string; cwd: string } | undefined {
  const p = projects.getProject(String(req.params.projectId));
  if (!p) return void fail(res, 404, 'Project not found');
  if (!fs.existsSync(p.path)) return void fail(res, 410, 'The project folder no longer exists');
  return { id: p.id, name: p.name, cwd: p.path };
}

const HASH = /^[0-9a-f]{7,40}$/i;

/** Asks Claude Code for a one-shot answer with no tools. The prompt travels over stdin so nothing is parsed as a flag. */
function askClaude(prompt: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'text', '--permission-mode', 'plan'], { cwd, windowsHide: true, shell: process.platform === 'win32' });
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
      if (code === 0 && out.trim()) resolve(out.trim());
      else reject(new Error(err.trim().split('\n')[0] || 'Claude did not answer'));
    });
    child.stdin.end(prompt);
  });
}

export function mountGitExtras(app: Express) {
  app.use('/api/git-x', localOnly);

  const repo = (fn: (p: { id: string; name: string; cwd: string }, req: Request, res: Response) => Promise<unknown>) =>
    handle(async (req, res) => {
      const p = projectOf(req, res);
      if (!p) return;
      if (!(await g.isRepo(p.cwd))) return fail(res, 409, 'This project is not a git repository');
      await fn(p, req, res);
    });

  // ---- stash ---------------------------------------------------------------------------------------
  app.get('/api/git-x/:projectId/stash', repo(async (p, _req, res) => {
    const out = await g.run(p.cwd, ['stash', 'list', '--format=%gd%x09%cr%x09%gs']);
    const stashes = out.split('\n').filter(Boolean).map((l) => {
      const [ref, when, ...msg] = l.split('\t');
      return { ref, when, message: msg.join('\t') };
    });
    res.json({ success: true, stashes });
  }));

  app.post('/api/git-x/:projectId/stash', repo(async (p, req, res) => {
    const message = (str(req.body?.message, 100) ?? '').replace(/[\r\n]/g, ' ');
    const args = ['stash', 'push', '--include-untracked'];
    if (message) args.push('-m', message);
    const out = await g.run(p.cwd, args);
    if (/No local changes/i.test(out)) return fail(res, 409, 'There is nothing to stash');
    audit('git-stash', 'owner', message || 'Stashed changes', { project: p.name });
    res.json({ success: true });
  }));

  app.post('/api/git-x/:projectId/stash/:ref/:action', repo(async (p, req, res) => {
    const ref = String(req.params.ref);
    if (!/^stash@\{\d{1,3}\}$/.test(ref)) return fail(res, 400, 'Invalid stash');
    const action = String(req.params.action);
    if (!['apply', 'pop', 'drop'].includes(action)) return fail(res, 400, 'Unknown action');
    await g.run(p.cwd, ['stash', action, ref]);
    audit('git-stash', 'owner', `${action} ${ref}`, { project: p.name });
    res.json({ success: true });
  }));

  // ---- cherry-pick and merge ---------------------------------------------------------------------
  app.post('/api/git-x/:projectId/cherry-pick', repo(async (p, req, res) => {
    const hash = str(req.body?.hash, 40) ?? '';
    if (!HASH.test(hash)) return fail(res, 400, 'Invalid commit');
    try {
      await g.run(p.cwd, ['cherry-pick', hash]);
    } catch (e) {
      await g.run(p.cwd, ['cherry-pick', '--abort']).catch(() => undefined);
      return fail(res, 409, `The commit does not apply cleanly here, so nothing was changed. ${(e as Error).message.split('\n')[0]}`);
    }
    audit('git-cherry-pick', 'owner', `Cherry-picked ${hash.slice(0, 7)}`, { project: p.name });
    res.json({ success: true });
  }));

  /** Merges a branch. On conflict the files are listed so the owner can resolve or abort, and nothing is left half done silently. */
  app.post('/api/git-x/:projectId/merge', repo(async (p, req, res) => {
    const branch = str(req.body?.branch, 100) ?? '';
    if (!g.validBranch(branch)) return fail(res, 400, 'Invalid branch name');
    const st = await g.status(p.cwd);
    if (st.files.length) return fail(res, 409, 'Commit or stash your changes before merging');
    try {
      const out = await g.run(p.cwd, ['merge', '--no-edit', branch], { timeout: 120_000 });
      audit('git-merge', 'owner', `Merged ${branch} into ${st.branch}`, { project: p.name });
      return res.json({ success: true, conflicts: [], output: out.trim() });
    } catch (e) {
      const conflicted = (await g.run(p.cwd, ['diff', '--name-only', '--diff-filter=U']).catch(() => '')).split('\n').filter(Boolean);
      if (conflicted.length === 0) {
        await g.run(p.cwd, ['merge', '--abort']).catch(() => undefined);
        throw e;
      }
      res.json({ success: true, conflicts: conflicted, output: (e as Error).message });
    }
  }));

  app.get('/api/git-x/:projectId/conflicts', repo(async (p, _req, res) => {
    const files = (await g.run(p.cwd, ['diff', '--name-only', '--diff-filter=U'])).split('\n').filter(Boolean);
    const out: Array<{ path: string; content: string }> = [];
    for (const f of files.slice(0, 10)) {
      try {
        out.push({ path: f, content: fs.readFileSync(`${p.cwd}/${f}`, 'utf8').slice(0, 60_000) });
      } catch {
        /* a deleted-on-one-side file has no content to show */
      }
    }
    const merging = fs.existsSync(`${p.cwd}/.git/MERGE_HEAD`);
    res.json({ success: true, merging, files: out });
  }));

  /** Takes one side for a whole conflicted file, then stages it. */
  app.post('/api/git-x/:projectId/resolve', repo(async (p, req, res) => {
    const file = str(req.body?.file, 500) ?? '';
    const side = req.body?.side === 'theirs' ? '--theirs' : req.body?.side === 'ours' ? '--ours' : null;
    if (!side) return fail(res, 400, 'side must be ours or theirs');
    const conflicted = (await g.run(p.cwd, ['diff', '--name-only', '--diff-filter=U'])).split('\n').filter(Boolean);
    if (!conflicted.includes(file)) return fail(res, 404, 'That file is not in conflict');
    await g.run(p.cwd, ['checkout', side, '--', file]);
    await g.run(p.cwd, ['add', '--', file]);
    audit('git-resolve', 'owner', `Resolved ${file} with ${side.slice(2)}`, { project: p.name });
    res.json({ success: true });
  }));

  app.post('/api/git-x/:projectId/merge-continue', repo(async (p, _req, res) => {
    const left = (await g.run(p.cwd, ['diff', '--name-only', '--diff-filter=U'])).split('\n').filter(Boolean);
    if (left.length) return fail(res, 409, `${left.length} file${left.length === 1 ? ' is' : 's are'} still in conflict`);
    await g.run(p.cwd, ['commit', '--no-edit']);
    audit('git-merge', 'owner', 'Finished a merge after resolving conflicts', { project: p.name });
    res.json({ success: true });
  }));

  app.post('/api/git-x/:projectId/merge-abort', repo(async (p, _req, res) => {
    await g.run(p.cwd, ['merge', '--abort']);
    audit('git-merge', 'owner', 'Aborted a merge', { project: p.name });
    res.json({ success: true });
  }));

  // ---- commit message ---------------------------------------------------------------------------
  app.post('/api/git-x/:projectId/suggest-message', repo(async (p, _req, res) => {
    const diff = await g.run(p.cwd, ['diff', '--cached', '--no-color', '--stat', '--patch'], { timeout: 30_000 });
    if (!diff.trim()) return fail(res, 409, 'Stage some files first. The message is written from the staged changes.');
    const prompt =
      'Write a git commit message for this staged diff. Rules: one subject line under 70 characters in the imperative mood, ' +
      'then a blank line, then at most three short lines explaining why. Output only the message, no quotes, no code fences, ' +
      'and never mention AI or assistants.\n\n' +
      diff.slice(0, 40_000);
    const message = (await askClaude(prompt, p.cwd)).replace(/^```[a-z]*\n?|```$/g, '').trim();
    audit('git-suggest', 'owner', 'Asked Claude for a commit message', { project: p.name });
    res.json({ success: true, message });
  }));

  // ---- pull requests (GitHub CLI) --------------------------------------------------------------------
  app.get('/api/git-x/:projectId/prs', repo(async (p, _req, res) => {
    const out = await run('gh', ['pr', 'list', '--state', 'open', '--limit', '20', '--json', 'number,title,author,headRefName,baseRefName,url,isDraft,reviewDecision,updatedAt'], { cwd: p.cwd, timeout: 25_000 });
    if (!out.ok) return fail(res, 400, out.stderr.trim().split('\n')[0] || 'gh could not list pull requests. Is the GitHub CLI signed in?');
    res.json({ success: true, prs: JSON.parse(out.stdout) });
  }));

  app.get('/api/git-x/:projectId/prs/:number', repo(async (p, req, res) => {
    const n = String(req.params.number);
    if (!/^\d{1,6}$/.test(n)) return fail(res, 400, 'Invalid pull request number');
    const out = await run('gh', ['pr', 'view', n, '--json', 'number,title,body,author,state,url,reviews,comments,files,additions,deletions,statusCheckRollup'], { cwd: p.cwd, timeout: 25_000 });
    if (!out.ok) return fail(res, 400, out.stderr.trim().split('\n')[0] || 'gh could not read that pull request');
    res.json({ success: true, pr: JSON.parse(out.stdout) });
  }));

  /** Opens a pull request for the current branch. Pushes nothing: the branch must already be on the remote. */
  app.post('/api/git-x/:projectId/prs', repo(async (p, req, res) => {
    const title = str(req.body?.title, 200)?.trim();
    if (!title) return fail(res, 400, 'A pull request needs a title');
    const body = str(req.body?.body, 8000) ?? '';
    const st = await g.status(p.cwd);
    if (!st.upstream) return fail(res, 409, 'Push this branch first, then open the pull request');
    const out = await run('gh', ['pr', 'create', '--title', title, '--body', body], { cwd: p.cwd, timeout: 60_000 });
    if (!out.ok) return fail(res, 400, out.stderr.trim().split('\n')[0] || 'gh could not create the pull request');
    audit('git-pr', 'owner', `Opened a pull request: ${title}`, { project: p.name });
    res.status(201).json({ success: true, url: out.stdout.trim().split('\n').pop() });
  }));
}
