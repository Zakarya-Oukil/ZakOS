import { useSyncExternalStore } from 'react';

/** Floating windows that show a link, a video or a page on top of any screen. Plain store, so any code can open one. */
export interface FloatWindow {
  id: string;
  title: string;
  /** What the frame loads (an embeddable address when one is known). */
  src: string;
  /** What "open in browser" opens: the address the person actually asked for. */
  original: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  maximised: boolean;
}

export const MIN_W = 340;
export const MIN_H = 240;

let list: FloatWindow[] = [];
let topZ = 40;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useWindows = () => useSyncExternalStore(subscribe, () => list);

export function openWindow(input: { title: string; src: string; original?: string }): string {
  // Each new window opens a little lower and to the right of the last one so they never hide each other exactly.
  const n = list.length % 6;
  // Narrow screens get a window that nearly fills the width instead of a sliver.
  const narrow = window.innerWidth < 720;
  const w = narrow ? window.innerWidth - 16 : Math.min(960, Math.round(window.innerWidth * 0.62));
  const h = narrow ? Math.round(window.innerHeight * 0.7) : Math.min(620, Math.round(window.innerHeight * 0.68));
  const win: FloatWindow = {
    id: `win-${++seq}`,
    title: input.title,
    src: input.src,
    original: input.original ?? input.src,
    x: narrow ? 8 : Math.max(8, Math.round((window.innerWidth - w) / 2) + n * 28 - 70),
    y: Math.max(8, Math.round((window.innerHeight - h) / 2) + n * 28 - 40),
    w,
    h,
    z: ++topZ,
    maximised: false,
  };
  list = [...list, win];
  emit();
  return win.id;
}

const patch = (id: string, p: Partial<FloatWindow>) => {
  list = list.map((w) => (w.id === id ? { ...w, ...p } : w));
  emit();
};

export const closeWindow = (id: string) => {
  list = list.filter((w) => w.id !== id);
  emit();
};
export const focusWindow = (id: string) => {
  const w = list.find((x) => x.id === id);
  if (w && w.z !== topZ) patch(id, { z: ++topZ });
};
export const toggleMaximise = (id: string) => {
  const w = list.find((x) => x.id === id);
  if (w) patch(id, { maximised: !w.maximised, z: ++topZ });
};
export const setBounds = (id: string, b: Pick<FloatWindow, 'x' | 'y' | 'w' | 'h'>) => patch(id, b);
export const closeAllWindows = () => {
  list = [];
  emit();
};
