import { useEffect, useMemo, useRef, useState } from 'react';
import { DotsNine, LockSimple, MagnifyingGlass, Moon, Sun, X } from '@phosphor-icons/react';
import { cx } from '../ui/cx';
import { StatusDot } from '../ui';
import { GROUPS, type OsModule } from '../modules/registry';
import { NotificationsMenu } from '../shell/NotificationsMenu';
import { useApprovalsApi } from '../modules/approvals/api';
import { planAtLeast, type Plan } from '../lib/useLicence';
import type { Theme } from '../theme/useTheme';
import Dock from '../reactbits/Dock';
import { WorldCards, WorldSwitcher } from './WorldSwitcher';
import { OwnerAvatar } from '../shell/OwnerAvatar';
import { useWorld } from './worlds';

export interface NavProps {
  modules: OsModule[];
  activeId: string | undefined;
  connected: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  plan: Plan;
  navigate: (...parts: string[]) => void;
}

const PINNED = ['home', 'agents', 'tasks', 'projects', 'brain', 'approvals', 'terminal', 'git'];
const focus = 'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';
const locked = (m: OsModule, plan: Plan) => !!m.premium && !planAtLeast(plan, m.premium);
const openPalette = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));

function pinnedFor(modules: OsModule[], activeId: string | undefined) {
  const list = modules.filter((m) => PINNED.includes(m.id));
  const extra = modules.find((m) => m.id === activeId && !PINNED.includes(m.id));
  return extra ? [...list, extra] : list;
}

function ThemeButton({ theme, onToggle, className }: { theme: Theme; onToggle: () => void; className?: string }) {
  return (
    <button type="button" onClick={onToggle} title={theme === 'dark' ? 'Light theme' : 'Dark theme'} className={cx('grid h-9 w-9 place-items-center rounded-full text-os-muted transition-colors hover:bg-os-surface-2 hover:text-os-text', focus, className)}>
      {theme === 'dark' ? <Sun size={19} weight="duotone" aria-hidden /> : <Moon size={19} weight="duotone" aria-hidden />}
      <span className="sr-only">Switch theme</span>
    </button>
  );
}

// ------------------------------------------------------------------ Launcher (Valley, Abyss)

/** Every page, grouped, with a filter. Used where the nav itself only holds the core pages. */
export function Launcher({ open, onClose, modules, plan, activeId, navigate }: Pick<NavProps, 'modules' | 'plan' | 'activeId' | 'navigate'> & { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setQ('');
      setTimeout(() => input.current?.focus(), 30);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);
  if (!open) return null;
  const match = (m: OsModule) => !q.trim() || `${m.label} ${m.description}`.toLowerCase().includes(q.trim().toLowerCase());
  return (
    <div className="fixed inset-0 z-[85] grid place-items-start justify-center bg-[rgba(0,0,0,0.45)] p-4 pt-[8vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="All pages" className="os-panel os-panel-square max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-[var(--os-radius-lg)] border border-os-line bg-os-bg p-4">
        <div className="mb-3 flex items-center gap-2">
          <MagnifyingGlass size={18} aria-hidden className="text-os-muted" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter pages" placeholder="Filter pages" className="h-9 flex-1 bg-transparent text-[15px] text-os-text placeholder:text-os-muted focus:outline-none" />
          <button type="button" onClick={onClose} aria-label="Close" className={cx('grid h-8 w-8 place-items-center rounded-full text-os-muted hover:text-os-text', focus)}>
            <X size={16} aria-hidden />
          </button>
        </div>
        {GROUPS.map((g) => {
          const items = modules.filter((m) => m.group === g.id && match(m));
          if (!items.length) return null;
          return (
            <section key={g.id} className="mb-3">
              <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-os-muted">{g.label}</h2>
              <ul className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
                {items.map((m) => {
                  const Icon = m.icon;
                  return (
                    <li key={m.id}>
                      <a
                        href={`#/${m.id}`}
                        onClick={() => {
                          navigate(m.id);
                          onClose();
                        }}
                        aria-current={m.id === activeId ? 'page' : undefined}
                        className={cx('flex items-center gap-2.5 rounded-[var(--os-radius)] border border-os-line px-3 py-2 text-sm text-os-text transition-colors hover:bg-os-surface-2', m.id === activeId && 'border-os-cyan', focus)}
                      >
                        <Icon size={18} weight="duotone" aria-hidden className={m.id === activeId ? 'text-os-cyan' : 'text-os-muted'} />
                        <span className="truncate">{m.label}</span>
                        {locked(m, plan) && <LockSimple size={13} aria-hidden className="ml-auto opacity-70" />}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Valley: icon rail

export function RailNav({ modules, activeId, connected, theme, onToggleTheme, plan, navigate }: NavProps) {
  const { pending } = useApprovalsApi();
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
  const [all, setAll] = useState(false);
  const list = useMemo(() => pinnedFor(modules, activeId), [modules, activeId]);
  const show = (label: string) => (e: { currentTarget: HTMLElement }) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2 });
  };
  const item = 'relative grid h-10 w-10 place-items-center rounded-[var(--os-radius)] text-os-muted transition-colors hover:bg-os-surface-2 hover:text-os-text';
  return (
    <>
      <nav aria-label="Modules" className="relative z-20 flex w-[60px] shrink-0 flex-col items-center gap-1 border-r border-os-line bg-os-surface py-3" data-boot>
        <a href="#/home" aria-label="Zak OS, home" className={cx('mb-3 grid h-9 w-9 place-items-center rounded-[var(--os-radius)] bg-os-cyan text-[17px] font-semibold tracking-tight text-os-on-accent', focus)}>
          Z
        </a>
        <button type="button" onClick={openPalette} onMouseEnter={show('Search  Ctrl K')} onMouseLeave={() => setTip(null)} className={cx(item, 'mb-1 border border-os-line', focus)}>
          <MagnifyingGlass size={18} aria-hidden />
          <span className="sr-only">Open the command palette</span>
        </button>
        <ul className="flex flex-1 flex-col items-center gap-1">
          {list.map((m) => {
            const Icon = m.icon;
            const on = m.id === activeId;
            return (
              <li key={m.id}>
                <a
                  href={`#/${m.id}`}
                  aria-current={on ? 'page' : undefined}
                  onMouseEnter={show(m.label)}
                  onMouseLeave={() => setTip(null)}
                  onFocus={show(m.label)}
                  onBlur={() => setTip(null)}
                  className={cx(item, on && 'bg-os-surface-2 text-os-text shadow-[inset_0_0_0_1px_var(--os-line)]', focus)}
                >
                  <Icon size={19} weight={on ? 'fill' : 'regular'} aria-hidden />
                  <span className="sr-only">{m.label}</span>
                  {m.id === 'approvals' && pending > 0 && <span className="absolute right-0.5 top-0.5 min-w-[16px] rounded-full bg-os-cyan px-1 text-center text-xs leading-4 text-os-on-accent" aria-label={`${pending} waiting`}>{pending}</span>}
                </a>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setAll(true)} onMouseEnter={show('All pages')} onMouseLeave={() => setTip(null)} className={cx(item, focus)}>
              <DotsNine size={19} aria-hidden />
              <span className="sr-only">All pages</span>
            </button>
          </li>
        </ul>
        <div className="flex flex-col items-center gap-1">
          <NotificationsMenu collapsed />
          <ThemeButton theme={theme} onToggle={onToggleTheme} className="!rounded-[var(--os-radius)]" />
          <WorldSwitcher placement="right" buttonClassName="!px-0 w-10 justify-center !rounded-[var(--os-radius)]" />
          <div className="grid h-8 place-items-center"><StatusDot status={connected ? 'live' : 'error'} label={connected ? 'Server connected' : 'Server disconnected'} /></div>
        </div>
      </nav>
      {tip && (
        <div role="presentation" aria-hidden className="pointer-events-none fixed z-[70] -translate-y-1/2 rounded-[6px] bg-os-text px-2 py-1 text-xs font-medium text-os-bg" style={{ left: 68, top: tip.top }}>
          {tip.label}
        </div>
      )}
      <Launcher open={all} onClose={() => setAll(false)} modules={modules} plan={plan} activeId={activeId} navigate={navigate} />
    </>
  );
}

// ------------------------------------------------------------------ Rack: grid of keys

export function RackNav({ modules, activeId, connected, theme, onToggleTheme, plan }: NavProps) {
  const { pending } = useApprovalsApi();
  return (
    <nav aria-label="Modules" className="relative z-20 flex w-[228px] shrink-0 flex-col border-r-2 border-os-line bg-os-surface" data-boot>
      <div className="flex h-14 items-center justify-between border-b-2 border-os-line px-3">
        <span className="os-display text-[22px] leading-none text-os-text">Zak OS</span>
        <span className="flex items-center gap-1.5 font-os-mono text-xs uppercase text-os-muted">
          <span className="rack-led" data-on={connected} aria-hidden />
          {connected ? 'Link' : 'Down'}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2.5">
        {GROUPS.map((g) => {
          const items = modules.filter((m) => m.group === g.id);
          if (!items.length) return null;
          return (
            <section key={g.id} className="mb-3">
              <h2 className="mb-1.5 flex items-center gap-2 font-os-mono text-xs uppercase tracking-[0.14em] text-os-muted">
                {g.label}
                <span className="h-px flex-1 bg-os-contour" aria-hidden />
              </h2>
              <ul className="grid grid-cols-2 gap-2">
                {items.map((m) => {
                  const Icon = m.icon;
                  const on = m.id === activeId;
                  return (
                    <li key={m.id}>
                      <a href={`#/${m.id}`} aria-current={on ? 'page' : undefined} title={m.label} className={cx('rack-key relative flex h-14 flex-col items-center justify-end gap-0.5 rounded-[var(--os-radius)] pb-1 text-os-text', focus)}>
                        <span className="rack-led absolute right-1.5 top-1.5" data-on={on || (m.id === 'approvals' && pending > 0)} aria-hidden />
                        <Icon size={20} weight="duotone" aria-hidden className={on ? 'text-os-cyan' : undefined} />
                        <span className="max-w-full truncate px-0.5 text-xs font-semibold uppercase tracking-normal">{m.label}</span>
                        {locked(m, plan) && <span className="sr-only">, needs the {m.premium === 'team' ? 'Team' : 'Pro'} plan</span>}
                        {m.id === 'approvals' && pending > 0 && <span className="sr-only">, {pending} waiting</span>}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="grid gap-2 border-t-2 border-os-line p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-os-mono text-xs uppercase tracking-[0.1em] text-os-muted">{theme === 'dark' ? 'Night' : 'Day'}</span>
          <button
            type="button"
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="Dark theme"
            onClick={onToggleTheme}
            className={cx('relative h-6 w-12 rounded-[3px] border-2 border-os-line bg-os-surface-2', focus)}
          >
            <span className="absolute top-0.5 h-4 w-5 rounded-[2px] border-2 border-os-line bg-os-surface shadow-[0_2px_0_var(--os-line)] transition-all duration-100" style={{ left: theme === 'dark' ? 'calc(100% - 1.5rem)' : '0.125rem' }} aria-hidden />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <NotificationsMenu collapsed placement="above" />
          <WorldSwitcher placement="above" label buttonClassName="border-2 border-os-line !rounded-[var(--os-radius)] font-os-mono text-xs uppercase" />
        </div>
      </div>
    </nav>
  );
}

// ------------------------------------------------------------------ Abyss: dock + floating strip

export function DockNav({ modules, activeId, connected, theme, onToggleTheme, plan, navigate }: NavProps) {
  const { pending } = useApprovalsApi();
  const world = useWorld();
  const [all, setAll] = useState(false);
  const [pick, setPick] = useState(false);
  const list = useMemo(() => pinnedFor(modules, activeId), [modules, activeId]);
  const items = [
    ...list.map((m) => {
      const Icon = m.icon;
      return { icon: <Icon size={24} weight="duotone" aria-hidden />, label: m.id === 'approvals' && pending > 0 ? `${m.label} (${pending})` : m.label, onClick: () => navigate(m.id), className: m.id === activeId ? 'abyss-active' : '' };
    }),
    { icon: <DotsNine size={24} aria-hidden />, label: 'All pages', onClick: () => setAll(true), className: '' },
  ];
  return (
    <>
      <nav aria-label="Modules" className="relative z-20 flex h-11 shrink-0 items-center justify-between px-4" data-boot>
        <a href="#/home" className={cx('flex items-center gap-2 rounded-full pr-2', focus)} aria-label="Zak OS, home">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-os-cyan text-xs font-semibold text-os-on-accent" aria-hidden>Z</span>
          <span className="text-sm font-semibold tracking-tight text-os-text">Zak OS</span>
        </a>
        <div className="flex items-center gap-1">
          <span className="mr-1 flex items-center gap-2 text-xs text-os-muted">
            <StatusDot status={connected ? 'live' : 'error'} label={connected ? 'Server connected' : 'Server disconnected'} />
            <span className="hidden sm:inline">{connected ? 'Surface calm' : 'Reconnecting'}</span>
          </span>
          <button type="button" onClick={openPalette} className={cx('grid h-9 w-9 place-items-center rounded-full text-os-muted hover:bg-os-surface-2 hover:text-os-text', focus)} title="Command palette (Ctrl+K)">
            <MagnifyingGlass size={19} aria-hidden />
            <span className="sr-only">Open the command palette</span>
          </button>
          <div className="w-9"><NotificationsMenu collapsed placement="below" /></div>
          <ThemeButton theme={theme} onToggle={onToggleTheme} />
          <button type="button" onClick={() => setPick(true)} className={cx('flex h-9 items-center gap-2 rounded-full px-3 text-sm text-os-muted hover:bg-os-surface-2 hover:text-os-text', focus)}>
            {world.label}
            <span className="sr-only">, change world</span>
          </button>
        </div>
      </nav>
      <div className="abyss-dock pointer-events-none fixed inset-x-0 bottom-2 z-30 flex justify-center">
        <div className="pointer-events-auto">
          <Dock items={items} panelHeight={64} baseItemSize={46} magnification={66} distance={150} dockHeight={140} />
        </div>
      </div>
      <Launcher open={all} onClose={() => setAll(false)} modules={modules} plan={plan} activeId={activeId} navigate={navigate} />
      {pick && (
        <div className="fixed inset-0 z-[85] grid place-items-center bg-[rgba(0,0,0,0.45)] p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && setPick(false)}>
          <div role="dialog" aria-modal="true" aria-label="Choose a world" className="os-panel os-panel-square w-full max-w-md rounded-[var(--os-radius-lg)] border border-os-line bg-os-bg p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-os-text">World</h2>
              <button type="button" onClick={() => setPick(false)} aria-label="Close" className={cx('grid h-8 w-8 place-items-center rounded-full text-os-muted hover:text-os-text', focus)}>
                <X size={16} aria-hidden />
              </button>
            </div>
            <WorldCards onPick={() => setPick(false)} />
          </div>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Cybersec: the index sheet

const SHEET_ORDER = ['security', 'workspace', 'agents', 'knowledge', 'build', 'connect', 'system'];

export function SheetNav({ modules, activeId, connected, theme, onToggleTheme, plan }: NavProps) {
  const { pending } = useApprovalsApi();
  const groups = [...GROUPS].sort((a, b) => SHEET_ORDER.indexOf(a.id) - SHEET_ORDER.indexOf(b.id));
  return (
    <nav aria-label="Modules" className="relative z-20 flex w-[252px] shrink-0 flex-col border-r border-os-line bg-os-surface" data-boot>
      <div className="flex h-16 items-center border-b border-os-line px-5">
        <a href="#/home" className={cx('os-display text-[26px] text-os-text', focus)}>Zak OS</a>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {groups.map((g) => {
          const items = modules.filter((m) => m.group === g.id);
          if (!items.length) return null;
          return (
            <section key={g.id} className="mb-4">
              <h2 className="px-2 pb-1 text-[13px] font-semibold text-os-muted">{g.label}</h2>
              <ul>
                {items.map((m) => {
                  const Icon = m.icon;
                  const on = m.id === activeId;
                  return (
                    <li key={m.id}>
                      <a
                        href={`#/${m.id}`}
                        aria-current={on ? 'page' : undefined}
                        className={cx('flex h-9 items-center gap-2.5 px-2 text-[14px] transition-colors', on ? 'bg-os-surface-2 text-os-text' : 'text-os-muted hover:bg-os-surface-2 hover:text-os-text', focus)}
                      >
                        <span className={cx('h-1.5 w-1.5 shrink-0', on ? 'bg-os-cyan' : 'bg-transparent')} aria-hidden />
                        <Icon size={18} weight={on ? 'fill' : 'regular'} aria-hidden className={on ? 'text-os-cyan' : undefined} />
                        <span className="truncate">{m.label}</span>
                        {locked(m, plan) && (
                          <>
                            <LockSimple size={13} aria-hidden className="ml-auto opacity-70" />
                            <span className="sr-only">, needs the {m.premium === 'team' ? 'Team' : 'Pro'} plan</span>
                          </>
                        )}
                        {m.id === 'approvals' && pending > 0 && <span className="ml-auto min-w-[20px] bg-os-cyan px-1 text-center text-xs font-semibold leading-5 text-os-on-accent" aria-label={`${pending} waiting`}>{pending}</span>}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="border-t border-os-line p-3">
        <div className="flex items-center gap-3 px-1 pb-3">
          <OwnerAvatar size={40} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[14px] font-semibold text-os-text">Zakarya Oukil</p>
            <p className="truncate text-xs text-os-muted">eJPT certified</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NotificationsMenu collapsed placement="above" />
          <ThemeButton theme={theme} onToggle={onToggleTheme} className="!rounded-none" />
          <WorldSwitcher placement="above" buttonClassName="!rounded-none" />
          <span className="ml-auto flex items-center gap-1.5 pr-1 text-xs text-os-muted">
            <StatusDot status={connected ? 'live' : 'error'} label={connected ? 'Server connected' : 'Server disconnected'} />
            {connected ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>
    </nav>
  );
}
