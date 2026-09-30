import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { cx } from '../ui/cx';
import { useNotifications } from '../lib/notifications';
import { timeAgo } from '../lib/projectsApi';

const linkBase =
  'group flex h-9 w-full items-center gap-3 rounded-[var(--os-radius)] px-2.5 text-sm transition-colors ' +
  'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';

export function NotificationsMenu({ collapsed }: { collapsed: boolean }) {
  const { items, unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={cx(linkBase, 'text-os-muted hover:bg-os-surface-2 hover:text-os-text', collapsed ? 'justify-center px-0' : 'justify-center px-0 md:justify-start md:px-2.5')}
      >
        <span className="relative">
          <Bell size={17} strokeWidth={1.75} aria-hidden />
          {unread > 0 && <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-os-amber" aria-hidden />}
        </span>
        {!collapsed && <span className="hidden truncate md:inline">Notifications{unread ? ` (${unread})` : ''}</span>}
        <span className={collapsed ? 'sr-only' : 'sr-only md:hidden'}>Notifications{unread ? `, ${unread} unread` : ''}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute bottom-0 left-full z-40 ml-2 w-80 rounded-[var(--os-radius)] border border-os-line bg-os-surface shadow-[var(--os-shadow-panel)]"
        >
          <div className="flex items-center justify-between border-b border-os-line px-3 py-2">
            <span className="text-sm font-medium text-os-text">Notifications</span>
            <button type="button" onClick={markAllRead} disabled={unread === 0} className="text-xs text-os-muted hover:text-os-text disabled:opacity-50">
              Mark all read
            </button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && <li className="px-3 py-4 text-sm text-os-muted">Nothing yet. Finished runs and approvals show up here.</li>}
            {items.map((n) => (
              <li key={n.id} className="border-b border-os-line last:border-0">
                <a
                  href={n.link ? `#/${[n.link.module, ...n.link.route].join('/')}` : undefined}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
                >
                  <span className="flex items-center gap-2 text-sm text-os-text">
                    {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-os-amber" aria-label="Unread" />}
                    {n.title}
                  </span>
                  <span className="line-clamp-2 block text-xs text-os-muted">{n.body}</span>
                  <span className="block text-xs text-os-muted">{timeAgo(n.ts)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
