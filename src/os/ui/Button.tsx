import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'outline' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: 'bg-os-cyan text-os-on-accent hover:brightness-110 active:brightness-95',
  outline: 'border border-os-line bg-os-surface text-os-text hover:border-os-muted hover:bg-os-surface-2',
  ghost: 'text-os-muted hover:bg-os-surface-2 hover:text-os-text',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-[13px]',
  md: 'h-10 px-5 text-sm',
};

/** Pill button. Primary carries the live accent; use it once per view. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'outline', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-variant={variant}
      className={cx(
        'os-btn',
        'inline-flex items-center justify-center gap-2 rounded-full font-os-sans font-medium transition-[background-color,border-color,filter,transform] duration-150',
        'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] active:scale-[0.98]',
        'disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
});
