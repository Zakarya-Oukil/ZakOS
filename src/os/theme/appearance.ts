import { useEffect, useSyncExternalStore } from 'react';

/**
 * The appearance studio's settings. They are applied as attributes and variables on <html>, so every page
 * and the background canvas follow them without knowing about this file.
 */
export type Motion = 'full' | 'calm' | 'off';
export type Backdrop = 'contours' | 'still' | 'none';
export type Density = 'comfortable' | 'compact';

export interface Appearance {
  accent: string;
  motion: Motion;
  backdrop: Backdrop;
  density: Density;
}

export const ACCENTS: Array<{ id: string; label: string; dark: string; light: string; darkRgb: string; lightRgb: string }> = [
  { id: 'vermilion', label: 'Vermilion', dark: '#ff6a3d', light: '#b83a12', darkRgb: '255, 106, 61', lightRgb: '184, 58, 18' },
  { id: 'chartreuse', label: 'Chartreuse', dark: '#b8e03c', light: '#4d6a08', darkRgb: '184, 224, 60', lightRgb: '77, 106, 8' },
  { id: 'cobalt', label: 'Cobalt', dark: '#6f9bff', light: '#2c57c9', darkRgb: '111, 155, 255', lightRgb: '44, 87, 201' },
  { id: 'saffron', label: 'Saffron', dark: '#f2b544', light: '#8a5d00', darkRgb: '242, 181, 68', lightRgb: '138, 93, 0' },
  { id: 'orchid', label: 'Orchid', dark: '#e48fd0', light: '#9c3b87', darkRgb: '228, 143, 208', lightRgb: '156, 59, 135' },
];

const KEY = 'zakos_appearance';
const DEFAULT: Appearance = { accent: 'vermilion', motion: 'full', backdrop: 'contours', density: 'comfortable' };

function read(): Appearance {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<Appearance>;
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

/** Writes the settings onto <html>. Safe to call before React mounts. */
export function applyAppearance(a: Appearance) {
  const root = document.documentElement;
  const accent = ACCENTS.find((x) => x.id === a.accent) ?? ACCENTS[0];
  const light = root.dataset.theme === 'light';
  root.style.setProperty('--os-cyan', light ? accent.light : accent.dark);
  root.style.setProperty('--os-cyan-rgb', light ? accent.lightRgb : accent.darkRgb);
  root.dataset.motion = a.motion;
  root.dataset.backdrop = a.backdrop;
  root.dataset.density = a.density;
}

let current: Appearance | null = null;
const listeners = new Set<() => void>();

function getCurrent(): Appearance {
  if (!current) current = read();
  return current;
}

/** One shared store, so the Shell, Settings and the template library all see the same values. */
export function setAppearance(patch: Partial<Appearance>) {
  current = { ...getCurrent(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage blocked */
  }
  applyAppearance(current);
  listeners.forEach((l) => l());
}

export function useAppearance() {
  const appearance = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getCurrent,
  );

  useEffect(() => {
    applyAppearance(appearance);
    // Accents differ per theme, so re-apply when the theme flips.
    const mo = new MutationObserver(() => applyAppearance(getCurrent()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, [appearance]);

  return { appearance, update: setAppearance };
}
