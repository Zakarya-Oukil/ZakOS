import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const KEY = 'zakos_theme';

function read(): Theme {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* storage blocked */
  }
  return 'dark';
}

function apply(theme: Theme) {
  const el = document.documentElement;
  el.dataset.theme = theme;
  el.classList.toggle('dark', theme === 'dark');
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    apply(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(KEY, next);
      } catch {
        /* storage blocked */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
