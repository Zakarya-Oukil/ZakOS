import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd, windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
  return stdout.trim();
}

const ROOT = path.resolve(process.cwd(), 'data', 'worktrees');

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    return (await git(cwd, ['rev-parse', '--is-inside-work-tree'])) === 'true';
  } catch {
    return false;
  }
}

export interface Worktree {
  path: string;
  branch: string;
  /** Where the task's work is committed from; the repo root, which may sit above the run's cwd. */
  repoRoot: string;
  /** Directory the agent should run in: the same sub-folder of the worktree as the run's cwd. */
  workDir: string;
}

/**
 * Creates an isolated checkout of HEAD on a fresh branch for one task.
 * Uncommitted changes in the main tree are not part of it; that is the price of isolation.
 */
export async function createWorktree(cwd: string, runId: string, taskId: string): Promise<Worktree> {
  const repoRoot = await git(cwd, ['rev-parse', '--show-toplevel']);
  const rel = path.relative(path.resolve(repoRoot), path.resolve(cwd));
  const tag = `${runId.slice(0, 8)}-${taskId.slice(0, 8)}`;
  const branch = `zakos/${tag}`;
  const dir = path.join(ROOT, tag);
  fs.mkdirSync(ROOT, { recursive: true });
  await git(repoRoot, ['worktree', 'add', '-b', branch, dir, 'HEAD']);

  // Dependencies are not tracked by git; link them so type checks and tests can run in the worktree.
  const deps = path.join(repoRoot, 'node_modules');
  const link = path.join(dir, 'node_modules');
  if (fs.existsSync(deps) && !fs.existsSync(link)) {
    try {
      fs.symlinkSync(deps, link, 'junction');
    } catch {
      /* not fatal: the agent can still read and edit files */
    }
  }
  return { path: dir, branch, repoRoot, workDir: rel ? path.join(dir, rel) : dir };
}

/** Removes the node_modules junction. rmdir on a junction removes only the link, never the real directory. */
function unlinkDeps(worktreePath: string) {
  const link = path.join(worktreePath, 'node_modules');
  try {
    if (fs.lstatSync(link).isSymbolicLink()) fs.rmdirSync(link);
  } catch {
    /* no link */
  }
}

/** Commits everything the task changed. Returns the number of changed files (0 means nothing to merge). */
export async function commitWorktree(wt: Worktree, message: string): Promise<number> {
  // The agent is done, so drop the node_modules junction first: it must never be staged or counted.
  unlinkDeps(wt.path);
  await git(wt.path, ['add', '-A']);
  const status = await git(wt.path, ['status', '--porcelain']);
  const files = status ? status.split('\n').length : 0;
  if (files === 0) return 0;
  await git(wt.path, ['-c', 'user.name=Zak OS', '-c', 'user.email=zakos@localhost', 'commit', '-q', '-m', message]);
  return files;
}

export type MergeOutcome = { state: 'merged' } | { state: 'conflict'; note: string } | { state: 'failed'; note: string };

/** Merges a task branch into whatever is checked out at the repo root. Aborts cleanly on conflict. */
export async function mergeBranch(repoRoot: string, branch: string, message: string): Promise<MergeOutcome> {
  try {
    await git(repoRoot, ['-c', 'user.name=Zak OS', '-c', 'user.email=zakos@localhost', 'merge', '--no-ff', '-m', message, branch]);
    return { state: 'merged' };
  } catch (err) {
    // git reports CONFLICT on stdout, which execFile keeps off the error message.
    const e = err as { message?: string; stdout?: string; stderr?: string };
    const text = `${e.message ?? ''}
${e.stdout ?? ''}
${e.stderr ?? ''}`;
    const conflict = /CONFLICT|Automatic merge failed/i.test(text);
    try {
      await git(repoRoot, ['merge', '--abort']);
    } catch {
      /* nothing to abort */
    }
    return {
      state: conflict ? 'conflict' : 'failed',
      note: conflict ? `Merge conflict, branch ${branch} kept for manual resolution` : text.split('\n')[0].slice(0, 300),
    };
  }
}

/** Removes the checkout. The branch stays unless `dropBranch` is set (after a clean merge). */
export async function removeWorktree(wt: Worktree, dropBranch: boolean): Promise<void> {
  const link = path.join(wt.path, 'node_modules');
  try {
    // rmdir on a junction removes only the link, never the real node_modules it points to.
    if (fs.lstatSync(link).isSymbolicLink()) fs.rmdirSync(link);
  } catch {
    /* no link */
  }
  try {
    await git(wt.repoRoot, ['worktree', 'remove', '--force', wt.path]);
  } catch {
    /* already gone */
  }
  if (dropBranch) {
    try {
      await git(wt.repoRoot, ['branch', '-D', wt.branch]);
    } catch {
      /* already gone */
    }
  }
}
