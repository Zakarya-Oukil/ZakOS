import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  /** Right-aligned header content (actions, status). */
  header?: ReactNode;
  padded?: boolean;
}

export function Panel({ title, header, padded = true, className, children, ...rest }: PanelProps) {
  return (
    <section
      className={cx(
        'rounded-[var(--os-radius)] border border-os-line bg-os-surface text-os-text shadow-[var(--os-shadow-panel)]',
        className,
      )}
      {...rest}
    >
      {(title || header) && (
        <div className="flex h-9 items-center justify-between gap-3 border-b border-os-line px-3">
          {title && <h2 className="font-os-mono text-[11px] uppercase tracking-[0.12em] text-os-muted">{title}</h2>}
          {header && <div className="flex items-center gap-2">{header}</div>}
        </div>
      )}
      <div className={padded ? 'p-3' : undefined}>{children}</div>
    </section>
  );
}
