import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { createCheckpoint } from '../agents/checkpoint';

const exec = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, { cwd, windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
  return stdout.trim();
}

/** What the repository looked like when a run started, plus what the run merged since. */
export interface RunBase {
  repoRoot: string;
  /** HEAD at the start. */
  head: string;
  /** Snapshot of tracked changes (or HEAD when the tree was clean); the restore target for shared-directory runs. */
  ref: string | null;
  /** Untracked files that already existed, so undo never deletes the owner's own files. */
  untracked: string[];
  /** Merge commits the run created, in order. */
  mergeCommits: string[];
}

const untrackedFiles = async (root: string): Promise<string[]> => {
  const out = await git(root, ['ls-files', '--others', '--exclude-standard']);
  return out ? out.split('\n').filter(Boolean) : [];
};

/** Captures the starting state. Returns undefined outside a git repository, where undo is not possible. */
export async function captureBase(cwd: string): Promise<RunBase | undefined> {
  try {
    const repoRoot = await git(cwd, ['rev-parse', '--show-toplevel']);
    return {
      repoRoot,
      head: await git(repoRoot, ['rev-parse', 'HEAD']),
      ref: await createCheckpoint(repoRoot),
      untracked: await untrackedFiles(repoRoot),
      mergeCommits: [],
    };
  } catch {
    return undefined; // not a repo, or a repo without commits
  }
}

export interface UndoPlan {
  possible: boolean;
  reason?: string;
  /** Merge commits that would be reverted, newest first. */
  revertMerges: string[];
  /** Tracked files would be restored to their state at the start of the run. */
  restoreTracked: boolean;
  /** New files the run created that would be deleted. */
  deleteFiles: string[];
}

export async function planUndo(base: RunBase | undefined, usedWorktrees: boolean): Promise<UndoPlan> {
  if (!base) return { possible: false, reason: 'This run was not in a git repository, so there is nothing to restore from', revertMerges: [], restoreTracked: false, deleteFiles: [] };
  const before = new Set(base.untracked);
  const now = await untrackedFiles(base.repoRoot);
  return {
    possible: true,
    revertMerges: [...base.mergeCommits].reverse(),
    // Worktree runs change history through merges, which are reverted instead of overwriting files.
    restoreTracked: !usedWorktrees && base.ref !== null,
    deleteFiles: now.filter((f) => !before.has(f)),
  };
}

export interface UndoResult {
  reverted: number;
  restored: boolean;
  deleted: string[];
  problems: string[];
}

/** Applies the plan. Never rewrites history: merges are undone with revert commits. */
export async function applyUndo(base: RunBase, plan: UndoPlan): Promise<UndoResult> {
  const result: UndoResult = { reverted: 0, restored: false, deleted: [], problems: [] };
  const identity = ['-c', 'user.name=Zak OS', '-c', 'user.email=zakos@localhost'];

  for (const sha of plan.revertMerges) {
    try {
      await git(base.repoRoot, [...identity, 'revert', '-m', '1', '--no-edit', sha]);
      result.reverted++;
    } catch (e) {
      try {
        await git(base.repoRoot, ['revert', '--abort']);
      } catch {
        /* nothing to abort */
      }
      result.problems.push(`Could not revert ${sha.slice(0, 8)}: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`);
      break; // later reverts depend on this one
    }
  }

  if (plan.restoreTracked && base.ref) {
    try {
      await git(base.repoRoot, ['checkout', base.ref, '--', '.']);
      result.restored = true;
    } catch (e) {
      result.problems.push(`Could not restore files: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`);
    }
  }

  const root = path.resolve(base.repoRoot);
  for (const rel of plan.deleteFiles) {
    const full = path.resolve(root, rel);
    if (!full.startsWith(root + path.sep)) continue; // never leave the repository
    try {
      fs.rmSync(full, { force: true });
      result.deleted.push(rel);
    } catch (e) {
      result.problems.push(`Could not delete ${rel}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return result;
}
