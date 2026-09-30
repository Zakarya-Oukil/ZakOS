export type FileState = 'M' | 'A' | 'D' | 'R' | 'C' | 'U' | '?' | ' ';

export interface GitFile {
  path: string;
  index: FileState;
  worktree: FileState;
  orig?: string;
}

export interface GitStatus {
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  detached: boolean;
  files: GitFile[];
}

export interface Commit {
  hash: string;
  short: string;
  subject: string;
  author: string;
  ts: number;
}

export interface Branch {
  name: string;
  current: boolean;
  upstream: string | null;
}

export interface DiffResult {
  diff: string;
  binary: boolean;
  truncated: boolean;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: init?.body ? { 'content-type': 'application/json' } : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

const post = (path: string, body?: unknown) => call<Record<string, unknown>>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const gitApi = {
  status: (p: string) => call<{ status: GitStatus }>(`/api/git/${p}/status`).then((r) => r.status),
  diff: (p: string, file: string, staged: boolean) => call<DiffResult>(`/api/git/${p}/diff?file=${encodeURIComponent(file)}&staged=${staged ? 1 : 0}`),
  stage: (p: string, files: string[]) => post(`/api/git/${p}/stage`, { files }),
  stageAll: (p: string) => post(`/api/git/${p}/stage`, { all: true }),
  unstage: (p: string, files: string[]) => post(`/api/git/${p}/unstage`, { files }),
  unstageAll: (p: string) => post(`/api/git/${p}/unstage`, { all: true }),
  discard: (p: string, file: string) => post(`/api/git/${p}/discard`, { file }),
  commit: (p: string, message: string) => post(`/api/git/${p}/commit`, { message }),
  log: (p: string) => call<{ commits: Commit[] }>(`/api/git/${p}/log?limit=60`).then((r) => r.commits),
  commitDiff: (p: string, hash: string) => call<{ diff: string; truncated: boolean }>(`/api/git/${p}/commit/${hash}`),
  branches: (p: string) => call<{ branches: Branch[] }>(`/api/git/${p}/branches`).then((r) => r.branches),
  checkout: (p: string, branch: string) => post(`/api/git/${p}/checkout`, { branch }),
  createBranch: (p: string, name: string) => post(`/api/git/${p}/branch`, { name }),
  pull: (p: string) => post(`/api/git/${p}/pull`),
  push: (p: string) => post(`/api/git/${p}/push`),
};

/** A short word for what happened to a file, for screen readers and tooltips. */
export const STATE_WORD: Record<string, string> = { M: 'Modified', A: 'Added', D: 'Deleted', R: 'Renamed', C: 'Copied', U: 'Conflict', '?': 'New, untracked' };
export const STATE_TONE: Record<string, string> = { M: 'text-os-amber', A: 'text-os-cyan', D: 'text-os-danger', R: 'text-os-amber', C: 'text-os-cyan', U: 'text-os-danger', '?': 'text-os-cyan' };
