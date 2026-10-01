import { api } from '../../lib/api';

export type InputKind = 'domain' | 'ip' | 'email' | 'username' | 'url' | 'file' | 'text';

export interface Tool {
  id: string;
  name: string;
  group: string;
  blurb: string;
  mode: 'passive' | 'active';
  input: { kind: InputKind; label: string; placeholder: string };
  needsKey?: string;
  keyReady: boolean;
  sendsTo: string;
  plugin: boolean;
}

export interface Entity {
  type: string;
  value: string;
}
export interface RunOut {
  id: string;
  ms: number;
  sha256: string | null;
  summary: string;
  data: unknown;
  entities: Entity[];
  edges: Array<{ a: string; b: string; rel: string }>;
}

export interface CaseRow {
  id: string;
  name: string;
  scope: string;
  notes: string;
  status: 'open' | 'closed';
  created: number;
  updated: number;
  runs?: number;
  entities?: number;
}
export interface RunRow {
  id: string;
  tool: string;
  input: string;
  mode: 'passive' | 'active';
  ts: number;
  ms: number;
  ok: number;
  summary: string;
  sha256: string | null;
  error: string | null;
  case_id?: string | null;
}
export interface EntityRow {
  id: number;
  type: string;
  value: string;
  confidence: 'low' | 'medium' | 'high';
  note: string;
  first_run: string | null;
  first_seen: number;
}
export interface EdgeRow {
  a: string;
  b: string;
  rel: string;
  run_id: string | null;
}
export interface CaseDetail {
  case: CaseRow;
  runs: RunRow[];
  entities: EntityRow[];
  edges: EdgeRow[];
}

export interface CatalogueEntry {
  name: string;
  url: string;
  note: string;
  phase: string;
  group: string;
}
export interface Catalogue {
  source: string;
  licence: string;
  fetched: string;
  entries: CatalogueEntry[];
}

export interface StudyTrack {
  id: string;
  name: string;
  status: 'earned' | 'in progress';
  domains: Array<{ id: string; name: string; weight?: number }>;
}
export interface StudyData {
  tracks: StudyTrack[];
  progress: Record<string, { percent: number; notes: string }>;
  exams: Record<string, string>;
}

export const cyberApi = {
  tools: () => api<{ tools: Tool[]; vaultUnlocked: boolean; pluginDir: string }>('/api/cyberlab/tools'),
  catalogue: () => api<Catalogue>('/api/cyberlab/catalogue'),
  run: (tool: string, input: string, caseId?: string, confirmActive?: boolean) => api<{ run: RunOut }>('/api/cyberlab/run', { method: 'POST', body: { tool, input, caseId, confirmActive } }),
  runFile: async (file: File, caseId?: string): Promise<{ run: RunOut }> => {
    const res = await fetch('/api/cyberlab/run-file', { method: 'POST', body: file, headers: { 'content-type': 'application/octet-stream', 'x-filename': encodeURIComponent(file.name), ...(caseId ? { 'x-case': caseId } : {}) }, credentials: 'same-origin' });
    const d = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; run?: RunOut };
    if (!res.ok || !d.success || !d.run) throw new Error(d.error ?? `Request failed (${res.status})`);
    return { run: d.run };
  },
  cases: () => api<{ cases: CaseRow[] }>('/api/cyberlab/cases'),
  createCase: (name: string, scope: string) => api<{ id: string }>('/api/cyberlab/cases', { method: 'POST', body: { name, scope } }),
  caseDetail: (id: string) => api<CaseDetail>(`/api/cyberlab/cases/${id}`),
  updateCase: (id: string, patch: Partial<Pick<CaseRow, 'name' | 'scope' | 'notes' | 'status'>>) => api(`/api/cyberlab/cases/${id}`, { method: 'PATCH', body: patch }),
  deleteCase: (id: string) => api(`/api/cyberlab/cases/${id}`, { method: 'DELETE' }),
  updateEntity: (id: number, patch: { confidence?: string; note?: string }) => api(`/api/cyberlab/entities/${id}`, { method: 'PATCH', body: patch }),
  deleteEntity: (id: number) => api(`/api/cyberlab/entities/${id}`, { method: 'DELETE' }),
  run_: (id: string) => api<{ run: RunRow & { output: RunOut | null } }>(`/api/cyberlab/runs/${id}`),
  runs: () => api<{ runs: RunRow[] }>('/api/cyberlab/runs'),
  report: async (id: string) => {
    const res = await fetch(`/api/cyberlab/cases/${id}/report`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Could not build the report');
    return res.text();
  },
  study: () => api<StudyData>('/api/cyberlab/study'),
  saveStudy: (body: Partial<Pick<StudyData, 'progress' | 'exams'>>) => api('/api/cyberlab/study', { method: 'PUT', body }),
};

export const TYPE_LABEL: Record<string, string> = {
  domain: 'Domain',
  ip: 'IP address',
  email: 'Email',
  username: 'Username',
  url: 'URL',
  asn: 'ASN',
  hash: 'Hash',
  org: 'Organisation',
  host: 'Host',
  service: 'Service',
  account: 'Account',
  file: 'File',
};

export const fmtTime = (ts: number) => new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
