import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const KEY = 'zakos_theme';
const EVENT = 'zakos:theme';

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

/** Sets the theme from outside React (a world opens in its own theme). Every useTheme hook follows. */
export function setTheme(theme: Theme) {
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked */
  }
  apply(theme);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: theme }));
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setThemeState] = useState<Theme>(read);

  useEffect(() => {
    apply(theme);
  }, [theme]);

  useEffect(() => {
    const on = (e: Event) => setThemeState((e as CustomEvent<Theme>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  const toggle = useCallback(() => setTheme(read() === 'dark' ? 'light' : 'dark'), []);

  return { theme, toggle };
}
