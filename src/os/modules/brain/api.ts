export interface SearchHit {
  id: string;
  title: string;
  relativePath: string;
  score: number;
  snippet: string;
  tags: string[];
}

export interface Answer {
  answer: string;
  sources: Array<{ id: string; title: string; relativePath: string }>;
}

export interface Snapshot {
  id: string;
  label: string;
  ts: number;
  nodes: number;
  edges: number;
}

export interface GraphDiff {
  from: Snapshot;
  to: Snapshot;
  addedCount: number;
  removedCount: number;
  added: Array<{ label: string; file?: string }>;
  removed: Array<{ label: string; file?: string }>;
  edgesAdded: number;
  edgesRemoved: number;
  hotFiles: Array<{ file: string; added: number; removed: number }>;
  truncated: boolean;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: init?.body ? { 'content-type': 'application/json' } : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const brainApi = {
  search: (q: string) => call<{ hits: SearchHit[] }>(`/api/brain/search?q=${encodeURIComponent(q)}`).then((r) => r.hits),
  ask: (question: string, agent: string) => call<Answer>('/api/brain/ask', { method: 'POST', body: JSON.stringify({ question, agent }) }),
  settings: () => call<{ settings: { autoCapture: boolean } }>('/api/brain/settings').then((r) => r.settings),
  setAutoCapture: (autoCapture: boolean) => call<{ settings: { autoCapture: boolean } }>('/api/brain/settings', { method: 'PUT', body: JSON.stringify({ autoCapture }) }).then((r) => r.settings),
  snapshots: (projectId: string) => call<{ snapshots: Snapshot[] }>(`/api/brain/graph/${projectId}/snapshots`).then((r) => r.snapshots),
  diff: (projectId: string, from: string) => call<{ diff: GraphDiff }>(`/api/brain/graph/${projectId}/diff?from=${encodeURIComponent(from)}&to=current`).then((r) => r.diff),
  saveNote: (relativePath: string, content: string) => call<unknown>('/api/vault/note', { method: 'POST', body: JSON.stringify({ path: relativePath, content }) }),
};
