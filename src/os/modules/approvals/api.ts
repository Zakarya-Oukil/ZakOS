import { useCallback, useEffect, useState } from 'react';
import { agentsSocket } from '../../lib/agentsSocket';

export interface ApprovalItem {
  id: string;
  sessionId: string;
  sessionTitle?: string;
  project: string;
  tool: string;
  summary: string;
  rule: string;
  state: 'pending' | 'approved' | 'dismissed';
  created: number;
  resolved?: number;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const approvalsApi = {
  list: () => call<{ approvals: ApprovalItem[] }>('/api/approvals').then((r) => r.approvals),
  approve: (id: string) => call<unknown>(`/api/approvals/${id}/approve`, { method: 'POST' }),
  dismiss: (id: string) => call<unknown>(`/api/approvals/${id}/dismiss`, { method: 'POST' }),
  clear: () => call<unknown>('/api/approvals/clear', { method: 'POST' }),
};

/** The inbox, kept fresh by the server's `approvals` broadcast (and a slow poll as a safety net). */
export function useApprovalsApi() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    approvalsApi
      .list()
      .then((list) => {
        setItems(list);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(refresh, [refresh]);
  useEffect(() => agentsSocket.subscribeApprovals(refresh), [refresh]);
  useEffect(() => {
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  return { items, error, refresh, pending: items.filter((a) => a.state === 'pending').length };
}
