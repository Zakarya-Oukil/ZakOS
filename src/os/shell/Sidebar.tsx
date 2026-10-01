import { useState } from 'react';
import { CaretDown, ClockCounterClockwise, LockSimple, Moon, SidebarSimple, Sun } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { cx } from '../ui/cx';
import { IconButton, StatusDot } from '../ui';
import { GROUPS, type OsModule } from '../modules/registry';
import { NotificationsMenu } from './NotificationsMenu';
import { useApprovalsApi } from '../modules/approvals/api';
import { usePrefersReducedMotion } from '../theme/motion';
import type { Theme } from '../theme/useTheme';
import { planAtLeast, type Plan } from '../lib/useLicence';

interface SidebarProps {
  modules: OsModule[];
  activeId: string | undefined;
  collapsed: boolean;
  onToggle: () => void;
  connected: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  plan: Plan;
}

const linkBase =
  'group flex h-9 items-center gap-3 rounded-full px-3 text-sm transition-colors ' +
  'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';

const GROUPS_KEY = 'zakos_os_sidebar_groups';

function readClosed(): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(GROUPS_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function Sidebar({ modules, activeId, collapsed, onToggle, connected, theme, onToggleTheme, plan }: SidebarProps) {
  const { pending } = useApprovalsApi();
  const reduced = usePrefersReducedMotion();
  const [closed, setClosed] = useState<Record<string, boolean>>(readClosed);

  const toggleGroup = (id: string) =>
    setClosed((c) => {
      const next = { ...c, [id]: !c[id] };
      try {
        window.localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
      } catch {
        /* storage blocked */
      }
      return next;
    });

  const renderLink = (m: OsModule) => {
    const active = m.id === activeId;
    const Icon = m.icon;
    return (
      <li key={m.id}>
        <a
          href={`#/${m.id}`}
          aria-current={active ? 'page' : undefined}
          title={collapsed ? m.label : undefined}
          className={cx(
            linkBase,
            'relative',
            collapsed ? 'justify-center px-0' : 'justify-start',
            active ? 'bg-os-surface-2 text-os-text' : 'text-os-muted hover:bg-os-surface-2 hover:text-os-text',
          )}
        >
          <Icon size={20} weight="duotone" className={active ? 'text-os-cyan' : undefined} aria-hidden />
          {!collapsed && <span className="truncate font-medium">{m.label}</span>}
          {collapsed && <span className="sr-only">{m.label}</span>}
          {m.premium && !planAtLeast(plan, m.premium) && (
            <>
              <LockSimple size={14} aria-hidden className={collapsed ? 'absolute right-1.5 top-1.5' : 'ml-auto opacity-70'} />
              <span className="sr-only">, needs the {m.premium === 'team' ? 'Team' : 'Pro'} plan</span>
            </>
          )}
          {m.id === 'approvals' && pending > 0 && (
            <span
              className={cx(
                'rounded-full bg-os-cyan px-1.5 text-[11px] font-semibold leading-4 text-os-on-accent',
                collapsed ? 'absolute right-1 top-1' : 'ml-auto',
              )}
              aria-label={`${pending} waiting`}
            >
              {pending}
            </span>
          )}
        </a>
      </li>
    );
  };

  return (
    <nav
      aria-label="Modules"
      className={cx(
        'flex shrink-0 flex-col border-r border-os-line bg-os-surface backdrop-blur-[6px] transition-[width] duration-200 ease-out',
        collapsed ? 'w-[64px]' : 'w-[232px]',
      )}
    >
      <div className={cx('flex h-14 items-center border-b border-os-line px-3', collapsed ? 'justify-center' : 'justify-between')} data-boot>
        {!collapsed && <span className="pl-1 font-os-sans text-[20px] font-extrabold tracking-tight text-os-text">Zak OS</span>}
        <IconButton aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggle}>
          <SidebarSimple size={18} weight="duotone" />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {GROUPS.map((g) => {
          const items = modules.filter((m) => m.group === g.id);
          if (!items.length) return null;
          const isClosed = !collapsed && !!closed[g.id];
          return (
            <div key={g.id} className="mb-2" data-boot>
              {!collapsed && (
                <button
                  type="button"
                  aria-expanded={!isClosed}
                  onClick={() => toggleGroup(g.id)}
                  className="flex h-7 w-full items-center justify-between rounded-full px-3 font-os-sans text-xs font-semibold text-os-muted transition-colors hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
                >
                  {g.label}
                  <CaretDown size={12} weight="bold" className={cx('transition-transform', isClosed && '-rotate-90')} aria-hidden />
                </button>
              )}
              <AnimatePresence initial={false}>
                {!isClosed && (
                  <motion.ul
                    className="relative flex flex-col gap-0.5 overflow-hidden"
                    initial={reduced ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{ duration: reduced ? 0.01 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {items.map(renderLink)}
                  </motion.ul>
                )}
              </AnimatePresence>
              {collapsed && <div className="mx-3 my-1.5 border-t border-os-line" aria-hidden />}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 border-t border-os-line p-2">
        <NotificationsMenu collapsed={collapsed} />
        <button
          type="button"
          onClick={onToggleTheme}
          title={collapsed ? (theme === 'dark' ? 'Light theme' : 'Dark theme') : undefined}
          className={cx(linkBase, 'w-full text-os-muted hover:bg-os-surface-2 hover:text-os-text', collapsed ? 'justify-center px-0' : 'justify-start')}
        >
          {theme === 'dark' ? <Sun size={19} weight="duotone" aria-hidden /> : <Moon size={19} weight="duotone" aria-hidden />}
          {!collapsed && <span className="truncate">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>}
          {collapsed && <span className="sr-only">Switch theme</span>}
        </button>
        <a
          href="#/legacy"
          title={collapsed ? 'Legacy UI' : undefined}
          className={cx(linkBase, 'text-os-muted hover:bg-os-surface-2 hover:text-os-text', collapsed ? 'justify-center px-0' : 'justify-start')}
        >
          <ClockCounterClockwise size={19} weight="duotone" aria-hidden />
          {!collapsed && <span className="truncate">Legacy UI</span>}
          {collapsed && <span className="sr-only">Legacy UI</span>}
        </a>
        <div className={cx('flex h-8 items-center gap-2 text-xs text-os-muted', collapsed ? 'justify-center' : 'px-3')}>
          <StatusDot status={connected ? 'live' : 'error'} label={connected ? 'Server connected' : 'Server disconnected'} />
          {!collapsed && <span>{connected ? 'Server connected' : 'Reconnecting'}</span>}
        </div>
      </div>
    </nav>
  );
}
