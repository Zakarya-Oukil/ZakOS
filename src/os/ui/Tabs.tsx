import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { motion } from 'motion/react';
import { cx } from './cx';
import { spring, usePrefersReducedMotion } from '../theme/motion';

export interface TabItem {
  id: string;
  label: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  'aria-label'?: string;
  className?: string;
}

export function Tabs({ tabs, value, onChange, className, 'aria-label': ariaLabel }: TabsProps) {
  const group = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const reduced = usePrefersReducedMotion();

  const onKeyDown = (e: KeyboardEvent) => {
    const enabled = tabs.filter((t) => !t.disabled);
    if (!enabled.length) return;
    const i = enabled.findIndex((t) => t.id === value);
    let next: TabItem | undefined;
    if (e.key === 'ArrowRight') next = enabled[(i + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(i - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    e.preventDefault();
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cx('flex items-center gap-1 border-b border-os-line', className)}
    >
      {tabs.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={t.disabled}
            onClick={() => onChange(t.id)}
            className={cx(
              'relative h-9 shrink-0 whitespace-nowrap px-3 font-os-sans text-[13px] transition-colors',
              'focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--os-cyan)]',
              'disabled:opacity-40',
              selected ? 'text-os-text' : 'text-os-muted hover:text-os-text',
            )}
          >
            {t.label}
            {selected && (
              <motion.span
                layoutId={`tabs-underline-${group}`}
                transition={reduced ? { duration: 0 } : spring.snappy}
                className="absolute inset-x-0 -bottom-px h-px bg-os-cyan shadow-[var(--os-glow-cyan)]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
