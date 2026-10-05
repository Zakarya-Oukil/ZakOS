import { useEffect, useMemo, useState } from 'react';
import { DotsNine, MagnifyingGlass, Moon, Sun } from '@phosphor-icons/react';
import { cx } from '../../ui/cx';
import { useApprovalsApi } from '../../modules/approvals/api';
import { NotificationsMenu } from '../../shell/NotificationsMenu';
import type { OsModule } from '../../modules/registry';
import { Launcher, type NavProps } from '../navs';
import { WorldSwitcher } from '../WorldSwitcher';
import { JarvisOrb } from './JarvisOrb';
import { useOrbFlat, useOrbState } from './orbStore';

const LEFT = ['home', 'agents', 'brain', 'workflows'];
const RIGHT = ['git', 'cyberlab', 'settings'];
const focus = 'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';
const openPalette = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return <time className="hidden font-os-mono text-[13px] tabular-nums text-os-muted lg:block" dateTime={now.toISOString()}>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</time>;
}

function Link({ m, on, badge }: { m: OsModule; on: boolean; badge?: number }) {
  return (
    <a
      href={`#/${m.id}`}
      aria-current={on ? 'page' : undefined}
      className={cx('jv-link relative flex h-9 items-center gap-1.5 px-1 text-sm font-medium transition-colors', on ? 'text-os-text' : 'text-os-muted hover:text-os-text', focus)}
    >
      {m.label}
      {badge ? <span className="rounded-full bg-os-amber px-1.5 font-os-mono text-xs leading-4 text-os-on-accent" aria-label={`${badge} waiting`}>{badge}</span> : null}
      {on && <span aria-hidden className="jv-underline absolute inset-x-1 -bottom-0.5 h-0.5 bg-os-cyan" />}
    </a>
  );
}

/**
 * The J.A.R.V.I.S. header: the orb sits top-centre and shows what the agents are doing. Pages left and right,
 * everything else behind "All pages". The orb opens approvals when something needs the owner, Agents otherwise.
 */
export function JarvisNav({ modules, activeId, connected, theme, onToggleTheme, plan, navigate }: NavProps) {
  const { pending } = useApprovalsApi();
  const orb = useOrbState(pending);
  const flat = useOrbFlat();
  const [all, setAll] = useState(false);
  const byId = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);
  const left = LEFT.map((id) => byId.get(id)).filter((m): m is OsModule => !!m);
  const right = RIGHT.map((id) => byId.get(id)).filter((m): m is OsModule => !!m);
  const hidden = modules.find((m) => m.id === activeId && ![...LEFT, ...RIGHT].includes(m.id));
  const target = orb.state === 'error' && pending > 0 ? '#/approvals' : '#/agents';
  const label = orb.state === 'error' ? (pending > 0 ? `${pending} waiting for you. Open approvals` : 'A run failed. Open agents') : orb.state === 'running' ? 'Agents are running tools. Open agents' : orb.state === 'thinking' ? 'An agent is thinking. Open agents' : 'No session is running. Open agents';

  return (
    <>
      <nav aria-label="Modules" className="jv-nav relative z-20 shrink-0" data-boot>
        <div className="relative flex h-[92px] items-center gap-3 px-5 md:px-8">
          <a href="#/home" aria-label="Zak OS, home" className={cx('jv-display shrink-0 pr-2 text-[22px] text-os-cyan', focus)}>
            Z·OS
          </a>
          <button type="button" onClick={() => setAll(true)} className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full text-os-muted hover:text-os-text md:hidden', focus)} title="All pages">
            <DotsNine size={20} aria-hidden />
            <span className="sr-only">All pages</span>
          </button>
          <div className="hidden min-w-0 flex-1 items-center gap-7 pl-6 md:flex">
            {left.map((m) => (
              <Link key={m.id} m={m} on={m.id === activeId} />
            ))}
            {hidden && <Link m={hidden} on />}
          </div>
          <div className="flex-1 md:hidden" />
          <div className="hidden flex-1 items-center justify-end gap-7 md:flex">
            {right.map((m) => (
              <Link key={m.id} m={m} on={m.id === activeId} />
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!connected && <span className="mr-1 font-os-mono text-xs text-os-amber">No link</span>}
            <Clock />
            <button type="button" onClick={() => setAll(true)} className={cx('hidden h-9 w-9 place-items-center rounded-full text-os-muted hover:text-os-text md:grid', focus)} title="All pages">
              <DotsNine size={20} aria-hidden />
              <span className="sr-only">All pages</span>
            </button>
            <button type="button" onClick={openPalette} className={cx('grid h-9 w-9 place-items-center rounded-full text-os-muted hover:text-os-text', focus)} title="Command palette (Ctrl+K)">
              <MagnifyingGlass size={19} aria-hidden />
              <span className="sr-only">Open the command palette</span>
            </button>
            <div className="w-9"><NotificationsMenu collapsed placement="below" /></div>
            <button type="button" onClick={onToggleTheme} title={theme === 'dark' ? 'Light theme' : 'Dark theme'} className={cx('hidden h-9 w-9 place-items-center sm:grid rounded-full text-os-muted hover:text-os-text', focus)}>
              {theme === 'dark' ? <Sun size={19} weight="duotone" aria-hidden /> : <Moon size={19} weight="duotone" aria-hidden />}
              <span className="sr-only">Switch theme</span>
            </button>
            <div className="hidden sm:block"><WorldSwitcher placement="below" /></div>
          </div>

          {/* The orb: the box is wide for the glow, only the sphere takes clicks. */}
          <div className="jv-orb-slot pointer-events-none absolute left-1/2 top-[-34px] h-[172px] w-[172px] -translate-x-1/2" data-jarvis-orb-slot>
            <a href={target} aria-label={label} className={cx('pointer-events-auto absolute left-1/2 top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-full', focus)}>
              <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <JarvisOrb state={orb.state} progress={orb.progress} flat={flat} size={66} title={label} />
              </span>
            </a>
          </div>
        </div>
        <div aria-hidden className="jv-ray" />
        <span className="sr-only" role="status" aria-live="polite">{orb.state === 'error' ? 'Something needs you' : orb.state === 'running' ? 'Agents are running' : ''}</span>
      </nav>
      <Launcher open={all} onClose={() => setAll(false)} modules={modules} plan={plan} activeId={activeId} navigate={navigate} />
    </>
  );
}
