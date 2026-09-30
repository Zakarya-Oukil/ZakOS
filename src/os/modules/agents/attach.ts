export type AttachKind = 'file' | 'folder' | 'note' | 'graph' | 'url' | 'picked';

/** What is sent with a prompt: references only, resolved on the server. */
export interface AttachRef {
  kind: AttachKind;
  ref: string;
}

/** What is shown on a chip in the prompt box. */
export interface Attachment extends AttachRef {
  key: string;
  label: string;
  size?: number;
  truncated?: boolean;
}

/** What a sent message keeps, for display in the conversation. */
export interface SentAttachment {
  kind: AttachKind;
  label: string;
  truncated: boolean;
}

export interface Candidate extends AttachRef {
  label: string;
  detail?: string;
}

export interface SavedPrompt {
  id: string;
  name: string;
  text: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: init?.body ? { 'content-type': 'application/json' } : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const contextApi = {
  search: (sessionId: string, q: string, kind?: 'file' | 'note' | 'graph') => {
    const qs = new URLSearchParams({ sessionId, q });
    if (kind) qs.set('kind', kind);
    return call<{ results: Candidate[] }>(`/api/context/search?${qs}`).then((r) => r.results);
  },
  check: (sessionId: string, a: AttachRef) =>
    call<{ label: string; size: number; truncated: boolean }>('/api/context/check', { method: 'POST', body: JSON.stringify({ sessionId, ...a }) }),
  pick: (type: 'file' | 'folder') =>
    call<{ picked: (AttachRef & { label: string }) | null }>('/api/context/pick', { method: 'POST', body: JSON.stringify({ type }) }).then((r) => r.picked),
};

export const promptsApi = {
  list: () => call<{ prompts: SavedPrompt[] }>('/api/prompts').then((r) => r.prompts),
  save: (name: string, text: string) => call<{ prompt: SavedPrompt }>('/api/prompts', { method: 'POST', body: JSON.stringify({ name, text }) }).then((r) => r.prompt),
  remove: (id: string) => call<unknown>(`/api/prompts/${id}`, { method: 'DELETE' }),
};

export const KIND_LABEL: Record<AttachKind, string> = {
  file: 'File',
  folder: 'Folder',
  note: 'Note',
  graph: 'Graph',
  url: 'Web page',
  picked: 'Picked',
};

export const formatSize = (n: number) => (n < 1000 ? `${n} B` : `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)} KB`);
