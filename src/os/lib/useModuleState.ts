import { useCallback, useState } from 'react';
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

/** Which modules are switched off. Stored per browser; required modules are never disabled. */
export function useModuleState() {
  const [disabled, setDisabled] = useState<string[]>(read);

  const isEnabled = useCallback((id: string) => !disabled.includes(id), [disabled]);

  const setEnabled = useCallback((id: string, enabled: boolean) => {
    if (MODULES.find((m) => m.id === id)?.required) return;
    setDisabled((prev) => {
      const next = enabled ? prev.filter((x) => x !== id) : [...new Set([...prev, id])];
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage blocked: the toggle still works for this session */
      }
      return next;
    });
  }, []);

  return { isEnabled, setEnabled };
}
