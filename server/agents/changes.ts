import fs from 'node:fs';
import path from 'node:path';
import { git, isGitWorkTree } from './checkpoint';

/**
 * What an agent changed in a folder, measured against a checkpoint taken before one of its prompts.
 * `U` is an untracked file: git never snapshotted it, so it may have existed before the session.
 */
export type ChangeStatus = 'M' | 'A' | 'D' | 'U';
export interface Change {
  file: string;
  status: ChangeStatus;
}

const MAX_FILES = 300;
const MAX_DIFF = 200_000;

/** Files that differ from `ref`, relative to `cwd`. Empty outside a git work tree. */
export async function listChanges(cwd: string, ref: string): Promise<Change[]> {
  if (!(await isGitWorkTree(cwd))) return [];
  const changes: Change[] = [];

  const tracked = (await git(cwd, ['diff', '--relative', '--name-status', '-z', '--no-renames', ref])).split('\0').filter(Boolean);
  for (let i = 0; i + 1 < tracked.length; i += 2) {
    const letter = tracked[i][0];
    if (letter === 'M' || letter === 'A' || letter === 'D') changes.push({ status: letter, file: tracked[i + 1] });
  }

  const untracked = (await git(cwd, ['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean);
  for (const file of untracked) changes.push({ status: 'U', file });

  return changes.sort((a, b) => a.file.localeCompare(b.file)).slice(0, MAX_FILES);
}

/** Resolves a change list entry to an absolute path, refusing anything that leaves the working folder. */
function inside(cwd: string, file: string): string {
  const abs = path.resolve(cwd, file);
  const rel = path.relative(path.resolve(cwd), abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('File is outside the working folder');
  return abs;
}

export interface FileDiff {
  diff: string;
  binary: boolean;
  truncated: boolean;
}

export async function fileDiff(cwd: string, ref: string, change: Change): Promise<FileDiff> {
  if (change.status === 'U') {
    const abs = inside(cwd, change.file);
    const size = fs.statSync(abs).size;
    if (size > MAX_DIFF) return { diff: '', binary: false, truncated: true };
    const buf = fs.readFileSync(abs);
    if (buf.includes(0)) return { diff: '', binary: true, truncated: false };
    const lines = buf.toString('utf8').split('\n');
    return { diff: [`--- /dev/null`, `+++ b/${change.file}`, `@@ -0,0 +1,${lines.length} @@`, ...lines.map((l) => `+${l}`)].join('\n'), binary: false, truncated: false };
  }
  const out = await git(cwd, ['diff', '--relative', '--no-color', ref, '--', change.file]);
  if (/^Binary files /m.test(out)) return { diff: '', binary: true, truncated: false };
  return out.length > MAX_DIFF ? { diff: out.slice(0, MAX_DIFF), binary: false, truncated: true } : { diff: out, binary: false, truncated: false };
}

/**
 * Puts one file back the way it was at `ref`. Modified and deleted files are restored from the
 * checkpoint, files added since are removed, and untracked files are deleted from disk.
 * The caller must have checked that the file appears in the current change list.
 */
export async function revertFile(cwd: string, ref: string, change: Change): Promise<void> {
  const abs = inside(cwd, change.file);
  if (change.status === 'U') {
    fs.unlinkSync(abs);
    return;
  }
  if (change.status === 'A') {
    await git(cwd, ['rm', '-f', '--quiet', '--', change.file]);
    return;
  }
  await git(cwd, ['checkout', ref, '--', change.file]);
}
