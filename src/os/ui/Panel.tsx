import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  /** Right-aligned header content (actions, status). */
  header?: ReactNode;
  padded?: boolean;
  /** Drop the chamfered top-right corner (for dense or nested panels). */
  square?: boolean;
}

/** Atlas panel: a card with one cut corner as the signature shape. */
export function Panel({ title, header, padded = true, square = false, className, children, ...rest }: PanelProps) {
  return (
    <section
      className={cx(
        'relative border border-os-line bg-os-surface text-os-text backdrop-blur-[6px]',
        square ? 'rounded-[var(--os-radius)]' : 'os-chamfer rounded-bl-[var(--os-radius)] rounded-tl-[var(--os-radius)] rounded-br-[var(--os-radius)]',
        className,
      )}
      {...rest}
    >
      {(title || header) && (
        <div className="flex h-10 items-center justify-between gap-3 border-b border-os-line px-3.5">
          {title && <h2 className="font-os-sans text-[13px] font-semibold tracking-tight text-os-muted">{title}</h2>}
          {header && <div className="flex items-center gap-2">{header}</div>}
        </div>
      )}
      <div className={padded ? 'p-3.5' : undefined}>{children}</div>
    </section>
  );
}
