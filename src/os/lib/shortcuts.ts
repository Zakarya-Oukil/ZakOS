import { useEffect, useRef, useSyncExternalStore } from 'react';

/** Keyboard shortcuts the owner can rebind. Ctrl+K for the command palette is fixed. */
export interface ShortcutAction {
  id: string;
  label: string;
  default: string;
}

export const ACTIONS: ShortcutAction[] = [
  { id: 'toggle-sidebar', label: 'Collapse or expand the sidebar', default: 'ctrl+b' },
  { id: 'toggle-theme', label: 'Switch between dark and light', default: 'ctrl+shift+l' },
  { id: 'go-home', label: 'Go to Home', default: 'alt+1' },
  { id: 'go-agents', label: 'Go to Agents', default: 'alt+2' },
  { id: 'go-tasks', label: 'Go to Tasks', default: 'alt+3' },
  { id: 'go-projects', label: 'Go to Projects', default: 'alt+4' },
  { id: 'go-brain', label: 'Go to Brain', default: 'alt+5' },
  { id: 'go-approvals', label: 'Go to Approvals', default: 'alt+6' },
  { id: 'go-terminal', label: 'Go to Terminal', default: 'alt+7' },
];

const KEY = 'zakos_shortcuts';
let current: Record<string, string> | null = null;
const listeners = new Set<() => void>();

function read(): Record<string, string> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

const get = () => {
  if (!current) current = read();
  return current;
};

export function setShortcut(id: string, combo: string | null) {
  const next = { ...get() };
  if (combo === null) delete next[id];
  else next[id] = combo;
  current = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
  listeners.forEach((l) => l());
}

export function bindingFor(id: string, overrides: Record<string, string> = get()): string {
  return overrides[id] ?? ACTIONS.find((a) => a.id === id)?.default ?? '';
}

export function useShortcutBindings() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    get,
  );
}

/** Turns a key event into a combo string like `ctrl+shift+l`, or null for a bare modifier press. */
export function comboFromEvent(e: KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  parts.push(e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase());
  return parts.join('+');
}

export const prettyCombo = (c: string) => c.split('+').map((p) => (p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1))).join(' + ');

/** Runs handlers when their bound combo is pressed, except while typing in a field (unless the combo has Ctrl or Alt). */
export function useShortcutListener(handlers: Record<string, () => void>) {
  const bindings = useShortcutBindings();
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const combo = comboFromEvent(e);
      if (!combo || combo === 'ctrl+k') return;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '') || (e.target as HTMLElement)?.isContentEditable;
      for (const a of ACTIONS) {
        if (bindingFor(a.id, bindings) !== combo) continue;
        if (typing && !combo.includes('ctrl') && !combo.includes('alt')) continue;
        const fn = ref.current[a.id];
        if (fn) {
          e.preventDefault();
          fn();
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bindings]);
}
