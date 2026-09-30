import { ChevronsLeft, ChevronsRight, History } from 'lucide-react';
import { cx } from '../ui/cx';
import { IconButton, StatusDot } from '../ui';
import type { OsModule } from '../modules/registry';
import { NotificationsMenu } from './NotificationsMenu';

interface SidebarProps {
  modules: OsModule[];
  activeId: string | undefined;
  collapsed: boolean;
  onToggle: () => void;
  connected: boolean;
}

const linkBase =
  'group flex h-9 items-center gap-3 rounded-[var(--os-radius)] px-2.5 text-sm transition-colors ' +
  'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';

export function Sidebar({ modules, activeId, collapsed, onToggle, connected }: SidebarProps) {
  return (
    <nav
      aria-label="Modules"
      className={cx(
        'flex shrink-0 flex-col border-r border-os-line bg-os-surface transition-[width] duration-200 ease-out',
        collapsed ? 'w-[52px]' : 'w-[52px] md:w-[200px]',
      )}
    >
      <div className="flex h-12 items-center justify-between border-b border-os-line px-2.5" data-boot>
        {!collapsed && <span className="hidden font-os-sans text-[15px] font-semibold tracking-tight text-os-text md:inline">Zak OS</span>}
        <IconButton
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggle}
          className={collapsed ? 'mx-auto' : 'mx-auto md:mx-0'}
        >
          {collapsed ? <ChevronsRight size={16} strokeWidth={1.75} /> : <ChevronsLeft size={16} strokeWidth={1.75} />}
        </IconButton>
      </div>

      <ul className="flex flex-1 flex-col gap-0.5 p-1.5">
        {modules.map((m) => {
          const active = m.id === activeId;
          const Icon = m.icon;
          return (
            <li key={m.id} data-boot>
              <a
                href={`#/${m.id}`}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? m.label : undefined}
                className={cx(
                  linkBase,
                  collapsed ? 'justify-center px-0' : 'justify-center px-0 md:justify-start md:px-2.5',
                  active
                    ? 'bg-os-surface-2 text-os-text'
                    : 'text-os-muted hover:bg-os-surface-2 hover:text-os-text',
                )}
              >
                <Icon size={17} strokeWidth={1.75} className={active ? 'text-os-cyan' : undefined} aria-hidden />
                {!collapsed && <span className="hidden truncate md:inline">{m.label}</span>}
                <span className={collapsed ? 'sr-only' : 'sr-only md:hidden'}>{m.label}</span>
              </a>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-1 border-t border-os-line p-1.5">
        <NotificationsMenu collapsed={collapsed} />
        <a
          href="#/legacy"
          title={collapsed ? 'Legacy UI' : undefined}
          className={cx(linkBase, 'text-os-muted hover:bg-os-surface-2 hover:text-os-text', collapsed ? 'justify-center px-0' : 'justify-center px-0 md:justify-start md:px-2.5')}
        >
          <History size={17} strokeWidth={1.75} aria-hidden />
          {!collapsed && <span className="hidden truncate md:inline">Legacy UI</span>}
          <span className={collapsed ? 'sr-only' : 'sr-only md:hidden'}>Legacy UI</span>
        </a>
        <div className={cx('flex h-8 items-center gap-2 text-xs text-os-muted', collapsed ? 'justify-center' : 'justify-center md:justify-start md:px-2.5')}>
          <StatusDot status={connected ? 'live' : 'error'} label={connected ? 'Server connected' : 'Server disconnected'} />
          {!collapsed && <span className="hidden md:inline">{connected ? 'Server connected' : 'Reconnecting'}</span>}
        </div>
      </div>
    </nav>
  );
}
