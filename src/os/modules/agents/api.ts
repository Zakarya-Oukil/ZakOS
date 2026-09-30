import type { AgentEvent } from '../../lib/agentsSocket';

export interface AgentInfo {
  id: string;
  label: string;
  available: boolean;
  version?: string;
  reason?: string;
}

export interface SessionInfo {
  id: string;
  agent: string;
  title: string;
  cwd: string;
  cli_session_id: string | null;
  status: 'idle' | 'running' | 'error';
  running?: boolean;
  created: number;
  updated: number;
}

export interface StoredMessage {
  seq: number;
  role: 'user' | 'agent';
  event: AgentEvent;
  ts: number;
}

export interface ActionInfo {
  id: number;
  ts: number;
  kind: string;
  detail: string;
  checkpoint_ref: string | null;
}

export interface FileChange {
  file: string;
  status: 'M' | 'A' | 'D' | 'U';
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

export const agentsApi = {
  agents: () => call<{ agents: AgentInfo[] }>('/api/agents').then((r) => r.agents),
  sessions: (agent?: string) =>
    call<{ sessions: SessionInfo[] }>(`/api/agents/sessions${agent ? `?agent=${encodeURIComponent(agent)}` : ''}`).then(
      (r) => r.sessions,
    ),
  create: (agent: string, cwd?: string, title?: string) =>
    call<{ session: SessionInfo }>('/api/agents/sessions', {
      method: 'POST',
      body: JSON.stringify({ agent, cwd: cwd || undefined, title }),
    }).then((r) => r.session),
  get: (id: string) =>
    call<{ session: SessionInfo; messages: StoredMessage[] }>(`/api/agents/sessions/${id}`),
  rename: (id: string, title: string) =>
    call<unknown>(`/api/agents/sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  remove: (id: string) => call<unknown>(`/api/agents/sessions/${id}`, { method: 'DELETE' }),
  send: (id: string, prompt: string, attachments: Array<{ kind: string; ref: string }> = []) =>
    call<unknown>(`/api/agents/sessions/${id}/message`, { method: 'POST', body: JSON.stringify({ prompt, attachments }) }),
  stop: (id: string) => call<unknown>(`/api/agents/sessions/${id}/stop`, { method: 'POST' }),
  actions: (id: string) =>
    call<{ actions: ActionInfo[] }>(`/api/agents/sessions/${id}/checkpoints`).then((r) => r.actions),
  changes: (id: string, ref: string) =>
    call<{ changes: FileChange[] }>(`/api/agents/sessions/${id}/changes?ref=${encodeURIComponent(ref)}`).then((r) => r.changes),
  changeDiff: (id: string, ref: string, file: string) =>
    call<{ diff: string; binary: boolean; truncated: boolean }>(
      `/api/agents/sessions/${id}/changes/diff?ref=${encodeURIComponent(ref)}&file=${encodeURIComponent(file)}`,
    ),
  revertFile: (id: string, ref: string, file: string) =>
    call<unknown>(`/api/agents/sessions/${id}/changes/revert`, { method: 'POST', body: JSON.stringify({ ref, file }) }),
  restore: (id: string, ref: string) =>
    call<unknown>(`/api/agents/sessions/${id}/restore`, { method: 'POST', body: JSON.stringify({ ref }) }),
};
