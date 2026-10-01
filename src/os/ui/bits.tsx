import type { ReactNode } from 'react';
import { cx } from './cx';

/** Shared class strings and small pieces so new pages look like one product. */
export const inputCls =
  'h-10 w-full rounded-[var(--os-input-radius)] border border-os-line bg-os-bg px-3 text-sm text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:opacity-50';
export const textareaCls =
  'w-full rounded-[var(--os-input-radius)] border border-os-line bg-os-bg px-3 py-2 text-sm leading-relaxed text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';
export const linkCls = 'text-os-text underline decoration-os-contour underline-offset-4 hover:text-os-cyan hover:decoration-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';

export function Field({ label, hint, htmlFor, children, className }: { label: string; hint?: string; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('grid gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-os-text">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-os-muted">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-12 text-center">
      <div className="max-w-sm">
        <p className="font-os-sans text-[17px] font-semibold text-os-text">{title}</p>
        {children && <p className="mt-1.5 text-sm leading-relaxed text-os-muted">{children}</p>}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-[var(--os-radius)] border border-os-danger px-3 py-2 text-sm text-os-danger">
      {children}
    </p>
  );
}

export function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-[var(--os-radius)] border border-os-ok px-3 py-2 text-sm text-os-ok">
      {children}
    </p>
  );
}

/** Placeholder shaped like the content it stands in for, so layout does not jump when data arrives. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded-[var(--os-radius)] bg-os-surface-2', className)} />;
}

/** A row of mutually exclusive choices, shown as pills. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ id: T; label: string }>; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex w-fit items-center justify-self-start rounded-full border border-os-line bg-os-bg p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            'h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]',
            value === o.id ? 'bg-os-cyan text-os-on-accent' : 'text-os-muted hover:text-os-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
