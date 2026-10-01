export interface AppState {
  projectId: string;
  state: 'running' | 'stopped' | 'exited';
  command: string;
  startedAt: number;
  exitCode: number | null;
  url: string | null;
}

export interface ScriptInfo {
  name: string;
  command: string;
}

export type Level = 'pass' | 'warn' | 'fail' | 'info';

export interface Check {
  id: string;
  label: string;
  level: Level;
  detail: string;
}

export type HeavyCheck = 'typecheck' | 'tests' | 'audit';

export interface HeavyResult {
  check: HeavyCheck;
  level: Level;
  summary: string;
  output: string;
  ms: number;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: init?.body ? { 'content-type': 'application/json' } : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const devApi = {
  app: (id: string) => call<{ scripts: ScriptInfo[]; state: AppState | null }>(`/api/apps/${id}`),
  start: (id: string, body: { script?: string; command?: string; profile?: string }) => call<{ state: AppState }>(`/api/apps/${id}/start`, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.state),
  stop: (id: string) => call<unknown>(`/api/apps/${id}/stop`, { method: 'POST' }),
  log: (id: string, since: number) => call<{ text: string; next: number; reset: boolean; state: AppState | null }>(`/api/apps/${id}/log?since=${since}`),
  checks: (id: string) => call<{ checks: Check[] }>(`/api/health/${id}`).then((r) => r.checks),
  run: (id: string, check: HeavyCheck) => call<{ result: HeavyResult }>(`/api/health/${id}/run`, { method: 'POST', body: JSON.stringify({ check }) }).then((r) => r.result),
};
