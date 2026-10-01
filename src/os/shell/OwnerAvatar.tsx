import { useState } from 'react';
import { cx } from '../ui/cx';

/** The owner's portrait from public/img/portrait.webp. Without that file it shows initials, so a copy sold to someone else never shows this face. */
export function OwnerAvatar({ name = 'Zakarya Oukil', size = 36, className }: { name?: string; size?: number; className?: string }) {
  const [missing, setMissing] = useState(false);
  if (missing)
    return (
      <span aria-label={name} role="img" className={cx('grid shrink-0 place-items-center bg-os-surface-2 font-semibold text-os-text', className)} style={{ width: size, height: size, fontSize: size * 0.36 }}>
        {name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
      </span>
    );
  return (
    <img
      src="/img/portrait.webp"
      alt={name}
      width={size}
      height={size}
      onError={() => setMissing(true)}
      className={cx('shrink-0 object-cover grayscale', className)}
      style={{ width: size, height: size, objectPosition: '50% 24%' }}
    />
  );
}
