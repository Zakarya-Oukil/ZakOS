import { cx } from './cx';

export type Status = 'idle' | 'live' | 'review' | 'error';

/**
 * State marker. The shape carries the meaning, so it reads without colour: a hollow ring is idle, a ring with a travelling
 * arc is working, a half-filled disc is waiting for review, and a solid diamond is a failure.
 */
export function StatusDot({ status = 'idle', label, className }: { status?: Status; label?: string; className?: string }) {
  return (
    <svg role="img" aria-label={label ?? status} viewBox="0 0 12 12" className={cx('inline-block h-3 w-3 shrink-0', className)}>
      {status === 'idle' && <circle cx="6" cy="6" r="4" fill="none" stroke="var(--os-muted)" strokeWidth="1.6" opacity="0.8" />}
      {status === 'live' && (
        <>
          <circle cx="6" cy="6" r="4.2" fill="none" stroke="var(--os-contour)" strokeWidth="1.6" />
          <circle cx="6" cy="6" r="4.2" fill="none" stroke="var(--os-cyan)" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="7 20" className="os-sweep" />
        </>
      )}
      {status === 'review' && (
        <>
          <circle cx="6" cy="6" r="4.2" fill="none" stroke="var(--os-amber)" strokeWidth="1.6" />
          <path d="M6 1.8 a4.2 4.2 0 0 1 0 8.4 z" fill="var(--os-amber)" />
        </>
      )}
      {status === 'error' && <path d="M6 1 L11 6 L6 11 L1 6 Z" fill="var(--os-danger)" />}
    </svg>
  );
}
