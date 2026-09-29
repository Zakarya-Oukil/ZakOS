import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { Kbd } from './Kbd';
import { cx } from './cx';

export interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface CommandPaletteProps {
  commands: Command[];
  /** Controlled open state; omit for internal Ctrl+K management. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const FOCUSABLE = 'input,button,[href],[tabindex]:not([tabindex="-1"])';
const LIST_ID = 'os-cmd-list';

export function CommandPalette({ commands, open: openProp, onOpenChange }: CommandPaletteProps) {
  const [inner, setInner] = useState(false);
  const open = openProp ?? inner;
  const openRef = useRef(open);
  openRef.current = open;
  const cbRef = useRef(onOpenChange);
  cbRef.current = onOpenChange;
  const setOpen = (v: boolean) => {
    setInner(v);
    cbRef.current?.(v);
  };

  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const next = !openRef.current;
        setInner(next);
        cbRef.current?.(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      returnFocus.current?.focus?.();
      returnFocus.current = null;
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.hint ?? ''}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) return null;

  const runAt = (i: number) => {
    const c = results[i];
    if (!c) return;
    setOpen(false);
    c.run();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(index);
    } else if (e.key === 'Tab') {
      // The input is the only tabbable element; keep focus inside the dialog.
      const els = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!els || !els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[14vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        className="w-full max-w-lg overflow-hidden rounded-[var(--os-radius-lg)] border border-os-line bg-os-surface font-os-sans text-os-text shadow-[var(--os-shadow-panel),var(--os-glow-cyan)]"
      >
        <div className="flex items-center gap-2 border-b border-os-line px-3">
          <Search size={14} className="text-os-muted" aria-hidden />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded
            aria-controls={LIST_ID}
            aria-activedescendant={results[index] ? `os-cmd-${results[index].id}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="h-11 flex-1 bg-transparent font-os-sans text-sm text-os-text placeholder:text-os-muted focus:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul id={LIST_ID} role="listbox" className="max-h-72 overflow-y-auto p-1">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center font-os-sans text-xs text-os-muted">No matches</li>
          )}
          {results.map((c, i) => (
            <li
              key={c.id}
              id={`os-cmd-${c.id}`}
              role="option"
              aria-selected={i === index}
              onMouseMove={() => setIndex(i)}
              onClick={() => runAt(i)}
              className={cx(
                'flex cursor-pointer items-center justify-between gap-3 rounded-[var(--os-radius)] px-3 py-2 text-sm',
                i === index ? 'bg-os-surface-2 text-os-text shadow-[inset_2px_0_0_var(--os-cyan)]' : 'text-os-muted',
              )}
            >
              <span>{c.label}</span>
              {c.hint && <span className="font-os-sans text-[12px] text-os-muted">{c.hint}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
