import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  /** Right-aligned header content (actions, status). */
  header?: ReactNode;
  padded?: boolean;
  /** Drop the chamfered top-right corner (for dense or nested panels). */
  square?: boolean;
  /** An open section: a heading and its content on the page itself, with no box. For read-only summaries. */
  bare?: boolean;
}

/** Atlas panel: a card with one cut corner as the signature shape. */
export function Panel({ title, header, padded = true, square = false, bare = false, className, children, ...rest }: PanelProps) {
  if (bare)
    return (
      <section className={cx('text-os-text', className)} {...rest}>
        {(title || header) && (
          <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-os-line pb-2">
            {title && <h2 className="os-display text-[21px] text-os-text">{title}</h2>}
            {header && <div className="flex items-center gap-2">{header}</div>}
          </div>
        )}
        <div>{children}</div>
      </section>
    );
  return (
    <section
      className={cx(
        'os-panel relative border border-os-line bg-os-surface text-os-text',
        square ? 'os-panel-square rounded-[var(--os-radius)]' : 'os-chamfer rounded-bl-[var(--os-radius)] rounded-tl-[var(--os-radius)] rounded-br-[var(--os-radius)]',
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
