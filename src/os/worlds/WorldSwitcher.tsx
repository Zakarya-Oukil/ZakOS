import { useEffect, useRef, useState } from 'react';
import { Check, Planet } from '@phosphor-icons/react';
import { cx } from '../ui/cx';
import { setTheme } from '../theme/useTheme';
import { WORLDS, getWorld, setWorld, useWorld, type WorldId } from './worlds';

/** Switches world, and opens the new world in its own theme. The theme toggle still works afterwards. */
export function chooseWorld(id: WorldId) {
  const w = WORLDS.find((x) => x.id === id);
  if (!w) return;
  setWorld(id);
  setTheme(w.theme);
}

export function WorldCards({ onPick }: { onPick?: () => void }) {
  const current = useWorld();
  return (
    <ul className="grid gap-2" role="listbox" aria-label="Interface world">
      {WORLDS.map((w) => {
        const on = w.id === current.id;
        return (
          <li key={w.id} role="option" aria-selected={on}>
            <button
              type="button"
              onClick={() => {
                chooseWorld(w.id);
                onPick?.();
              }}
              className={cx(
                'flex w-full items-center gap-3 rounded-[var(--os-radius)] border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]',
                on ? 'border-os-cyan bg-os-surface-2' : 'border-os-line hover:bg-os-surface-2',
              )}
            >
              <span className="grid h-10 w-10 shrink-0 overflow-hidden rounded-[var(--os-radius-sm)] border border-os-line" aria-hidden style={{ background: w.swatch[0] }}>
                <span className="m-1.5 rounded-[var(--os-radius-sm)]" style={{ background: w.swatch[1], boxShadow: `inset 0 -6px 0 ${w.swatch[2]}` }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-os-text">{w.label}</span>
                <span className="block text-xs leading-snug text-os-muted">{w.tagline}</span>
              </span>
              {on && <Check size={16} weight="bold" className="shrink-0 text-os-cyan" aria-label="Current" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface SwitcherProps {
  /** Where the menu opens relative to the button. */
  placement?: 'right' | 'below' | 'above';
  /** Show the world's name next to the icon. */
  label?: boolean;
  className?: string;
  buttonClassName?: string;
}

export function WorldSwitcher({ placement = 'right', label = false, className, buttonClassName }: SwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const current = useWorld();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const toggle = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r && !open) {
      const w = 320;
      const left = Math.min(Math.max(8, placement === 'right' ? r.right + 8 : r.left), window.innerWidth - w - 8);
      if (placement === 'above') setPos({ left, bottom: window.innerHeight - r.top + 8, width: w });
      else if (placement === 'below') setPos({ left: Math.min(left, window.innerWidth - w - 8), top: r.bottom + 8, width: w });
      else setPos({ left, bottom: Math.max(8, window.innerHeight - r.bottom), width: w });
    }
    setOpen((o) => !o);
  };

  return (
    <div ref={ref} className={cx('relative', className)}>
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={toggle}
        title={`World: ${current.label}`}
        className={cx(
          'flex h-9 items-center gap-2 rounded-full px-3 text-sm text-os-muted transition-colors hover:bg-os-surface-2 hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]',
          buttonClassName,
        )}
      >
        <Planet size={19} weight="duotone" aria-hidden />
        {label ? <span className="truncate">{current.label}</span> : <span className="sr-only">Change world, now {current.label}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Choose a world" style={pos} className="fixed z-[80] rounded-[var(--os-radius-lg)] border border-os-line bg-os-bg p-3 shadow-[var(--os-shadow-panel)]">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-os-muted">World</p>
          <WorldCards onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

export { getWorld };
