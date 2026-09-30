export type Trust = 'read-only' | 'default' | 'acceptEdits' | 'full';

export interface ProjectInfo {
  /** Unset means the global permission setting applies. */
  trust?: Trust;
  id: string;
  name: string;
  path: string;
  color: string;
  source: 'folder' | 'github';
  remoteUrl?: string;
  addedAt: number;
  exists: boolean;
  hasGraph: boolean;
  graphUpdated: number | null;
}

export interface ProjectGraphNode {
  id: string;
  label: string;
  community: number;
  communityName?: string;
  file?: string;
  degree: number;
}

export interface ProjectGraphLink {
  source: string;
  target: string;
  relation?: string;
}

export interface ProjectGraph {
  nodes: ProjectGraphNode[];
  links: ProjectGraphLink[];
  builtAtCommit?: string;
}

export interface Job {
  id: string;
  kind: 'clone' | 'graphify';
  state: 'running' | 'done' | 'error';
  projectId?: string;
  log: string;
  error?: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const projectsApi = {
  list: () => call<{ projects: ProjectInfo[] }>('/api/projects').then((r) => r.projects),
  add: (path: string) =>
    call<{ project: ProjectInfo }>('/api/projects', { method: 'POST', body: JSON.stringify({ path }) }).then((r) => r.project),
  clone: (url: string, destination: string) =>
    call<{ job: Job }>('/api/projects/clone', { method: 'POST', body: JSON.stringify({ url, destination }) }).then((r) => r.job),
  setTrust: (id: string, trust: Trust | null, confirmFull = false) =>
    call<{ project: ProjectInfo }>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify({ trust, confirmFull }) }).then((r) => r.project),
  remove: (id: string) => call<unknown>(`/api/projects/${id}`, { method: 'DELETE' }),
  graphify: (id: string) => call<{ job: Job }>(`/api/projects/${id}/graphify`, { method: 'POST' }).then((r) => r.job),
  job: (id: string) => call<{ job: Job }>(`/api/projects/jobs/${id}`).then((r) => r.job),
  graph: (id: string) => call<{ project: ProjectInfo; graph: ProjectGraph }>(`/api/projects/${id}/graph`),
  pickFolder: (title: string) =>
    call<{ path: string | null }>('/api/fs/pick-folder', { method: 'POST', body: JSON.stringify({ title }) }).then((r) => r.path),
};

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
