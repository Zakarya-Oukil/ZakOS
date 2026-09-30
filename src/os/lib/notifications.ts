import { useCallback, useEffect, useState } from 'react';
import { agentsSocket } from './agentsSocket';

export interface OsNotification {
  id: string;
  title: string;
  body: string;
  ts: number;
  read: boolean;
  link?: { module: string; route: string[] };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export function useNotifications() {
  const [items, setItems] = useState<OsNotification[]>([]);

  const refresh = useCallback(() => {
    call<{ notifications: OsNotification[] }>('/api/notifications')
      .then((r) => setItems(r.notifications))
      .catch(() => setItems([]));
  }, []);

  useEffect(refresh, [refresh]);
  useEffect(
    () =>
      agentsSocket.subscribeNotifications((n) => {
        setItems((prev) => [n as OsNotification, ...prev.filter((p) => p.id !== (n as OsNotification).id)].slice(0, 100));
      }),
    [],
  );

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    call('/api/notifications/read', { method: 'POST' }).catch(refresh);
  }, [refresh]);

  return { items, unread: items.filter((n) => !n.read).length, markAllRead };
}
