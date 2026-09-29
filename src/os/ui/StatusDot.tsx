import { cx } from './cx';

export type Status = 'idle' | 'live' | 'review' | 'error';

const color: Record<Status, string> = {
  idle: 'bg-os-muted opacity-60',
  live: 'bg-os-cyan os-live-dot',
  review: 'bg-os-amber',
  error: 'bg-os-danger',
};

export function StatusDot({ status = 'idle', label, className }: { status?: Status; label?: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label={label ?? status}
      className={cx('inline-block h-2 w-2 shrink-0 rounded-full', color[status], className)}
    />
  );
}
