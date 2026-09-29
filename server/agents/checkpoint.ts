import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
  return stdout.trim();
}

async function isGitWorkTree(cwd: string): Promise<boolean> {
  try {
    return (await git(cwd, ['rev-parse', '--is-inside-work-tree'])) === 'true';
  } catch {
    return false;
  }
}

/**
 * Snapshot the working tree before an agent run.
 * `git stash create` writes a commit for tracked changes without touching the
 * tree or the stash list. It prints nothing when the tree is clean, so we fall
 * back to HEAD. Returns null outside a git repo.
 */
export async function createCheckpoint(cwd: string): Promise<string | null> {
  if (!(await isGitWorkTree(cwd))) return null;
  try {
    const stash = await git(cwd, ['stash', 'create']);
    if (stash) return stash;
    return await git(cwd, ['rev-parse', 'HEAD']);
  } catch {
    return null;
  }
}

/**
 * Restore tracked files to the state captured in `ref`.
 * Deliberately narrow: it only overwrites tracked files via `git checkout <ref> -- .`.
 * It never deletes untracked files and never moves HEAD or rewrites history.
 */
export async function restoreCheckpoint(cwd: string, ref: string): Promise<void> {
  if (!/^[0-9a-f]{7,64}$/i.test(ref)) throw new Error('Invalid checkpoint ref');
  if (!(await isGitWorkTree(cwd))) throw new Error('Session directory is not a git work tree');
  await git(cwd, ['cat-file', '-e', `${ref}^{commit}`]);
  await git(cwd, ['checkout', ref, '--', '.']);
}
