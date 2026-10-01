import { cx } from '../ui/cx';

/** The owner's portrait. A photo in public/img is used when present; otherwise initials. */
export function OwnerAvatar({ name = 'Zakarya Oukil', size = 36, className }: { name?: string; size?: number; className?: string }) {
  return (
    <img
      src="/img/portrait.webp"
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      className={cx('shrink-0 object-cover grayscale', className)}
      style={{ width: size, height: size, objectPosition: '50% 24%' }}
    />
  );
}
