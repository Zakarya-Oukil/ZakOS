import { useEffect, useSyncExternalStore } from 'react';

/**
 * Worlds: complete visual identities for the same app. A world swaps the palette, type, shapes, background,
 * navigation and the Home hero. Features and data are identical in every world.
 */
export type WorldId = 'atlas' | 'cyber' | 'jarvis' | 'valley' | 'rack' | 'abyss';

export interface WorldInfo {
  id: WorldId;
  label: string;
  tagline: string;
  /** The theme a world opens in. The dark and light toggle still works inside each. */
  theme: 'dark' | 'light';
  /** Three colours for the picker: background, surface, accent. */
  swatch: [string, string, string];
  /** Where navigation lives. */
  nav: 'sidebar' | 'sheet' | 'hud' | 'rail' | 'rack' | 'dock';
}

export const WORLDS: WorldInfo[] = [
  { id: 'atlas', label: 'Atlas', tagline: 'A map room of contour lines. Calm, cartographic.', theme: 'dark', swatch: ['#0a1513', '#173a31', '#ff6a3d'], nav: 'sidebar' },
  { id: 'cyber', label: 'Cybersec', tagline: 'A professional investigation desk in the Zakarya Oukil portfolio identity.', theme: 'dark', swatch: ['#1b1a18', '#2c2925', '#f26a52'], nav: 'sheet' },
  { id: 'jarvis', label: 'J.A.R.V.I.S.', tagline: 'A holographic command HUD with an arc reactor core.', theme: 'dark', swatch: ['#020911', '#08283e', '#33e6ff'], nav: 'hud' },
  { id: 'valley', label: 'Valley', tagline: 'Startup-grade product UI. Sharp, quiet, fast.', theme: 'light', swatch: ['#fafaf9', '#ffffff', '#0a0a0a'], nav: 'rail' },
  { id: 'rack', label: 'Rack', tagline: 'A hardware instrument panel with needles, keys and LEDs.', theme: 'light', swatch: ['#cfcbc2', '#e8e4da', '#ff5a1f'], nav: 'rack' },
  { id: 'abyss', label: 'Abyss', tagline: 'Deep-sea glass and drifting bioluminescence.', theme: 'dark', swatch: ['#020a0f', '#0e3240', '#5cf2d6'], nav: 'dock' },
];

const KEY = 'zakos_world';
export const WORLD_EVENT = 'zakos:world-changed';

const valid = (v: unknown): v is WorldId => WORLDS.some((w) => w.id === v);

let current: WorldId | null = null;
const listeners = new Set<() => void>();

function read(): WorldId {
  try {
    const v = window.localStorage.getItem(KEY);
    if (valid(v)) return v;
  } catch {
    /* storage blocked */
  }
  return 'atlas';
}

export const getWorld = (): WorldId => (current ??= read());

export function applyWorld(id: WorldId) {
  document.documentElement.dataset.world = id;
}

/** Switches world. The shell reacts to the event with a short transition and the world's own theme. */
export function setWorld(id: WorldId) {
  const prev = getWorld();
  if (prev === id) return;
  current = id;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* storage blocked */
  }
  applyWorld(id);
  listeners.forEach((l) => l());
  window.dispatchEvent(new CustomEvent(WORLD_EVENT, { detail: { from: prev, to: id } }));
}

export function useWorld(): WorldInfo {
  const id = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getWorld,
  );
  useEffect(() => applyWorld(id), [id]);
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}
