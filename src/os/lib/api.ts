import { useCallback, useEffect, useState } from 'react';

/** Shared fetch wrapper: JSON in and out, and a thrown Error carrying the server's message. */
export async function api<T = Record<string, unknown>>(path: string, init?: Omit<RequestInit, 'body'> & { body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    headers: init?.body === undefined ? init?.headers : { 'content-type': 'application/json', ...(init?.headers as Record<string, string>) },
    credentials: 'same-origin',
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.success === false) {
    if (res.status === 401) window.dispatchEvent(new CustomEvent('zakos:auth-required'));
    throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${res.status})`);
  }
  return data as T;
}

/** Loads a resource, exposing loading, error and a reload function. */
export function useResource<T>(path: string | null, deps: unknown[] = []): { data: T | null; error: string | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (path === null) return;
    let live = true;
    setLoading(true);
    api<T>(path)
      .then((d) => {
        if (!live) return;
        setData(d);
        setError(null);
      })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  return { data, error, loading, reload };
}

export const money = (n: number) => (n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`);
export const tokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
