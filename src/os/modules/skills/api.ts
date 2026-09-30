export interface SkillInfo {
  scope: string;
  scopeLabel: string;
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  linked: boolean;
  size: number;
  updated: number;
}

export interface SkillDetail {
  content: string;
  enabled: boolean;
  linked: boolean;
  files: Array<{ path: string; size: number }>;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: init?.body ? { 'content-type': 'application/json' } : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

const enc = encodeURIComponent;

export const skillsApi = {
  list: () => call<{ skills: SkillInfo[]; scopes: Array<{ id: string; label: string }> }>('/api/skills'),
  get: (scope: string, name: string) => call<SkillDetail>(`/api/skills/${enc(scope)}/${enc(name)}`),
  create: (scope: string, name: string, description: string) => call<unknown>('/api/skills', { method: 'POST', body: JSON.stringify({ scope, name, description }) }),
  save: (scope: string, name: string, content: string) => call<unknown>(`/api/skills/${enc(scope)}/${enc(name)}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  setEnabled: (scope: string, name: string, enabled: boolean) => call<unknown>(`/api/skills/${enc(scope)}/${enc(name)}/enabled`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  remove: (scope: string, name: string) => call<unknown>(`/api/skills/${enc(scope)}/${enc(name)}`, { method: 'DELETE', body: JSON.stringify({ confirm: name }) }),
};
