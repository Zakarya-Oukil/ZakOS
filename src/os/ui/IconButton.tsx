import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  'aria-label': string;
  children: ReactNode;
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, active, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-os-muted transition-colors',
        'hover:border-os-line hover:bg-os-surface-2 hover:text-os-text',
        'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]',
        'disabled:pointer-events-none disabled:opacity-40',
        active && 'border-os-line bg-os-surface-2 text-os-cyan',
        className,
      )}
      {...rest}
    />
  );
});
