import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Raw git output. Unlike the checkpoint helper this never trims, because status lines start with a space. */
export function run(cwd: string, args: string[], opts: { timeout?: number } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd, windowsHide: true, maxBuffer: 20 * 1024 * 1024, timeout: opts.timeout ?? 30_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' } },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(String(stderr || err.message).trim().split('\n').slice(0, 6).join('\n')));
        resolve(stdout);
      },
    );
  });
}

export type FileState = 'M' | 'A' | 'D' | 'R' | 'C' | 'U' | '?' | ' ';

export interface StatusFile {
  path: string;
  /** Index (staged) state and working tree state, as git reports them; `?` means untracked. */
  index: FileState;
  worktree: FileState;
  orig?: string;
}

export interface Status {
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  detached: boolean;
  files: StatusFile[];
}

export async function isRepo(cwd: string): Promise<boolean> {
  try {
    return (await run(cwd, ['rev-parse', '--is-inside-work-tree'])).trim() === 'true';
  } catch {
    return false;
  }
}

export async function status(cwd: string): Promise<Status> {
  const out = await run(cwd, ['status', '--porcelain=v1', '-z', '-b', '--untracked-files=all']);
  const parts = out.split('\0');
  const header = parts.shift() ?? '';
  // "## main...origin/main [ahead 1, behind 2]", "## HEAD (no branch)", "## No commits yet on main"
  let branch = 'HEAD';
  let upstream: string | null = null;
  let ahead = 0;
  let behind = 0;
  let detached = false;
  const h = header.replace(/^## /, '');
  if (h.startsWith('HEAD (no branch)')) detached = true;
  else if (h.startsWith('No commits yet on ')) branch = h.slice('No commits yet on '.length);
  else {
    const m = /^(.+?)(?:\.\.\.(\S+))?(?: \[(.*)\])?$/.exec(h);
    if (m) {
      branch = m[1];
      upstream = m[2] ?? null;
      ahead = Number(/ahead (\d+)/.exec(m[3] ?? '')?.[1] ?? 0);
      behind = Number(/behind (\d+)/.exec(m[3] ?? '')?.[1] ?? 0);
    }
  }
  const files: StatusFile[] = [];
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    if (entry.length < 4) continue;
    const x = entry[0] as FileState;
    const y = entry[1] as FileState;
    const file: StatusFile = { path: entry.slice(3), index: x === '?' ? '?' : x, worktree: y };
    if (x === 'R' || x === 'C') file.orig = parts[++i]; // a rename carries the old name as the next field
    files.push(file);
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { branch, upstream, ahead, behind, detached, files };
}

const MAX_DIFF = 200_000;

export async function diff(cwd: string, file: StatusFile, staged: boolean): Promise<{ diff: string; binary: boolean; truncated: boolean }> {
  if (file.index === '?') {
    const abs = path.resolve(cwd, file.path);
    const rel = path.relative(path.resolve(cwd), abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('File is outside the project');
    const size = fs.statSync(abs).size;
    if (size > MAX_DIFF) return { diff: '', binary: false, truncated: true };
    const buf = fs.readFileSync(abs);
    if (buf.includes(0)) return { diff: '', binary: true, truncated: false };
    const lines = buf.toString('utf8').split('\n');
    if (lines[lines.length - 1] === '') lines.pop(); // a trailing newline is not a line
    return { diff: ['--- /dev/null', `+++ b/${file.path}`, `@@ -0,0 +1,${lines.length} @@`, ...lines.map((l) => `+${l}`)].join('\n'), binary: false, truncated: false };
  }
  const out = await run(cwd, ['diff', '--no-color', ...(staged ? ['--cached'] : []), '--', file.path]);
  if (/^Binary files /m.test(out)) return { diff: '', binary: true, truncated: false };
  return out.length > MAX_DIFF ? { diff: out.slice(0, MAX_DIFF), binary: false, truncated: true } : { diff: out, binary: false, truncated: false };
}

export interface Commit {
  hash: string;
  short: string;
  subject: string;
  author: string;
  ts: number;
}

export async function log(cwd: string, limit: number): Promise<Commit[]> {
  try {
    const out = await run(cwd, ['log', `-n${limit}`, '--pretty=format:%H%x1f%an%x1f%at%x1f%s%x1e']);
    return out
      .split('\x1e')
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) => {
        const [hash, author, at, subject] = r.split('\x1f');
        return { hash, short: hash.slice(0, 7), author, ts: Number(at) * 1000, subject };
      });
  } catch {
    return []; // a repository with no commits yet has no log
  }
}

export interface Branch {
  name: string;
  current: boolean;
  upstream: string | null;
}

export async function branches(cwd: string): Promise<Branch[]> {
  const out = await run(cwd, ['for-each-ref', '--format=%(HEAD)%09%(refname:short)%09%(upstream:short)', 'refs/heads']);
  return out
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [head, name, upstream] = l.split('\t');
      return { name, current: head === '*', upstream: upstream || null };
    });
}

/** Branch names are passed to git as arguments, so anything that could read as an option or a path trick is refused. */
export const validBranch = (name: string) => /^[A-Za-z0-9._\/-]{1,100}$/.test(name) && !name.startsWith('-') && !name.includes('..') && !name.endsWith('/') && !name.endsWith('.lock');
