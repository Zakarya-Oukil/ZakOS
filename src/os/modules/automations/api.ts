export type Trigger = { kind: 'cron'; cron: string } | { kind: 'commit' } | { kind: 'files' } | { kind: 'chain'; after: string } | { kind: 'webhook'; name: string };

export interface Automation {
  id: string;
  name: string;
  templateId: string;
  templateName: string | null;
  project: string | null;
  trigger: Trigger;
  enabled: boolean;
  created: number;
  lastRunAt?: number;
  lastRunId?: string;
  lastError?: string;
  nextAt: number | null;
  history: Array<{ runId: string; at: number; why: string; status: string }>;
}

export interface TemplateInfo {
  id: string;
  name: string;
  input: { cwd: string; goal: string };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: init?.body ? { 'content-type': 'application/json' } : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const automationsApi = {
  list: () => call<{ schedules: Automation[] }>('/api/workflow-schedules').then((r) => r.schedules),
  templates: () => call<{ templates: TemplateInfo[] }>('/api/workflow-templates').then((r) => r.templates),
  create: (templateId: string, trigger: Trigger) => call<{ schedule: Automation }>('/api/workflow-schedules', { method: 'POST', body: JSON.stringify({ templateId, trigger }) }).then((r) => r.schedule),
  update: (id: string, patch: { enabled?: boolean; trigger?: Trigger }) => call<unknown>(`/api/workflow-schedules/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (id: string) => call<unknown>(`/api/workflow-schedules/${id}`, { method: 'DELETE' }),
  runNow: (id: string) => call<{ runId: string }>(`/api/workflow-schedules/${id}/run`, { method: 'POST' }),
  preview: (cron: string) => call<{ times: number[] }>('/api/workflow-schedules/preview', { method: 'POST', body: JSON.stringify({ cron }) }).then((r) => r.times),
};

export const PRESETS: Array<{ label: string; cron: string }> = [
  { label: 'Every weekday at 9:00', cron: '0 9 * * 1-5' },
  { label: 'Every day at 2:00', cron: '0 2 * * *' },
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every 15 minutes', cron: '*/15 * * * *' },
  { label: 'Every Monday at 9:00', cron: '0 9 * * 1' },
];

export const describe = (t: Trigger) =>
  t.kind === 'commit' ? 'On every new commit' : t.kind === 'files' ? 'When files change' : t.kind === 'chain' ? 'After another automation finishes' : t.kind === 'webhook' ? `Webhook ${t.name}` : (PRESETS.find((p) => p.cron === t.cron)?.label ?? `Cron ${t.cron}`);
