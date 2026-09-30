export type RunStatus = 'planning' | 'awaiting_approval' | 'running' | 'reviewing' | 'reporting' | 'done' | 'error' | 'stopped';
export type Role = 'orchestrator' | 'worker' | 'reviewer';
export type TaskState = 'queued' | 'running' | 'done' | 'error';

export interface WorkflowTask {
  id: string;
  title: string;
  prompt: string;
  state: TaskState;
  sessionId?: string;
  result?: string;
  error?: string;
  branch?: string;
  filesChanged?: number;
  merge?: 'merged' | 'nochanges' | 'conflict' | 'failed';
  mergeNote?: string;
}

export interface WorkflowRun {
  id: string;
  options: { approval: boolean; agents: Record<Role, string>; worktrees: boolean };
  goal: string;
  cwd: string;
  projectId?: string;
  status: RunStatus;
  created: number;
  updated: number;
  summary?: string;
  tasks: WorkflowTask[];
  orchestratorSessionId?: string;
  reviewerSessionId?: string;
  review?: string;
  verdict?: 'pass' | 'needs_work';
  report?: string;
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

export const workflowsApi = {
  list: () => call<{ runs: WorkflowRun[] }>('/api/workflows').then((r) => r.runs),
  get: (id: string) => call<{ run: WorkflowRun }>(`/api/workflows/${id}`).then((r) => r.run),
  start: (goal: string, cwd: string, projectId: string | undefined, opts: { approval: boolean; agents: Record<Role, string>; worktrees: boolean }) =>
    call<{ run: WorkflowRun }>('/api/workflows', { method: 'POST', body: JSON.stringify({ goal, cwd, projectId, ...opts }) }).then((r) => r.run),
  approve: (id: string, tasks?: Array<{ title: string; prompt: string }>) =>
    call<unknown>(`/api/workflows/${id}/approve`, { method: 'POST', body: JSON.stringify({ tasks }) }),
  stop: (id: string) => call<unknown>(`/api/workflows/${id}/stop`, { method: 'POST' }),
  remove: (id: string) => call<unknown>(`/api/workflows/${id}`, { method: 'DELETE' }),
};

export interface WorkflowTemplate {
  id: string;
  name: string;
  created: number;
  lastRunAt?: number;
  input: { goal: string; cwd: string; projectId?: string; options: WorkflowRun['options'] };
}

export const templatesApi = {
  list: () => call<{ templates: WorkflowTemplate[] }>('/api/workflow-templates').then((r) => r.templates),
  create: (name: string, goal: string, cwd: string, projectId: string | undefined, opts: WorkflowRun['options']) =>
    call<{ template: WorkflowTemplate }>('/api/workflow-templates', {
      method: 'POST',
      body: JSON.stringify({ name, goal, cwd, projectId, ...opts }),
    }).then((r) => r.template),
  run: (id: string, goal?: string) =>
    call<{ run: WorkflowRun }>(`/api/workflow-templates/${id}/run`, { method: 'POST', body: JSON.stringify({ goal }) }).then((r) => r.run),
  remove: (id: string) => call<unknown>(`/api/workflow-templates/${id}`, { method: 'DELETE' }),
};

export const isActive = (s: RunStatus) => s === 'planning' || s === 'awaiting_approval' || s === 'running' || s === 'reviewing' || s === 'reporting';
