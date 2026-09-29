import { useCallback, useEffect, useState } from 'react';
import { MODULES } from '../modules/registry';

const KEY = 'zakos_os_disabled_modules';

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function cache(list: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage blocked: the server copy still holds it */
  }
}

/**
 * Which modules are switched off. The server copy is the source of truth; localStorage is only
 * an instant first paint. Required modules are never disabled.
 */
export function useModuleState() {
  const [disabled, setDisabled] = useState<string[]>(read);

  useEffect(() => {
    fetch('/api/os/modules')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.disabled)) {
          const clean = d.disabled.filter((id: unknown): id is string => typeof id === 'string' && !MODULES.find((m) => m.id === id)?.required);
          setDisabled(clean);
          cache(clean);
        }
      })
      .catch(() => {
        /* server unreachable: keep the cached list */
      });
  }, []);

  const isEnabled = useCallback((id: string) => !disabled.includes(id), [disabled]);

  const setEnabled = useCallback((id: string, enabled: boolean) => {
    if (MODULES.find((m) => m.id === id)?.required) return;
    setDisabled((prev) => {
      const next = enabled ? prev.filter((x) => x !== id) : [...new Set([...prev, id])];
      cache(next);
      fetch('/api/os/modules', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ disabled: next }),
      }).catch(() => {
        /* the local cache still applies; the next successful change re-syncs */
      });
      return next;
    });
  }, []);

  return { isEnabled, setEnabled };
}
