import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export function Kbd({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cx(
        'inline-flex h-5 min-w-[20px] items-center justify-center rounded-[var(--os-radius-sm)] border border-os-line bg-os-surface-2 px-1.5 font-os-mono text-[10px] text-os-muted',
        className,
      )}
      {...rest}
    />
  );
}
