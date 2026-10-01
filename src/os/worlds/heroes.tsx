import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import type { HomeData } from '../modules/home/api';
import { setAppearance, useAppearance, type Motion } from '../theme/appearance';
import { prefersReducedMotion } from '../theme/motion';
import { useTheme } from '../theme/useTheme';
import { cx } from '../ui/cx';
import Orb from '../reactbits/Orb';
import DecryptedText from '../reactbits/DecryptedText';
import CountUp from '../reactbits/CountUp';
import BlurText from '../reactbits/BlurText';
import type { WorldId } from './worlds';
import { CyberHero } from './CyberHome';
import { OpenBar } from '../shell/OpenBar';

gsap.registerPlugin(Draggable);

export interface HeroProps {
  home: HomeData;
  hello: string;
  summary: string;
}

/** The numbers every hero draws from. All of them come from the real Home data. */
function figures(home: HomeData) {
  const claude = home.providers.find((p) => p.windows?.fiveHour);
  const w = claude?.windows?.fiveHour;
  const fiveHour = w && w.resetsAt * 1000 > Date.now() ? w.utilization : null;
  const running = home.running.sessions.length + home.running.runs.length;
  const need = home.attention.approvals + home.attention.runsAwaiting.length + home.attention.failedRuns.length;
  return {
    fiveHour,
    running,
    need,
    projects: home.projects.length,
    runsToday: home.limits.runsToday,
    maxRuns: home.limits.maxRunsPerDay,
    activeRuns: home.limits.activeRuns,
    maxActive: home.limits.maxActiveRuns,
  };
}

// ------------------------------------------------------------------ J.A.R.V.I.S.

const C = (r: number) => 2 * Math.PI * r;

function Arc({ r, pct, color, label }: { r: number; pct: number; color: string; label: string }) {
  const len = C(r);
  return (
    <>
      <circle cx="200" cy="200" r={r} fill="none" stroke="var(--os-line)" strokeWidth="2" strokeDasharray="2 5" />
      <circle
        className="jarvis-arc"
        data-len={len}
        data-pct={Math.min(1, Math.max(0, pct))}
        cx="200"
        cy="200"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="butt"
        strokeDasharray={len}
        strokeDashoffset={len}
        transform="rotate(-90 200 200)"
      >
        <title>{label}</title>
      </circle>
    </>
  );
}

function JarvisHero({ home, hello, summary }: HeroProps) {
  const f = figures(home);
  const { theme } = useTheme();
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const arcs = gsap.utils.toArray<SVGCircleElement>('.jarvis-arc');
      if (prefersReducedMotion()) {
        arcs.forEach((a) => (a.style.strokeDashoffset = String(Number(a.dataset.len) * (1 - Number(a.dataset.pct)))));
        return;
      }
      arcs.forEach((a, i) => gsap.to(a, { strokeDashoffset: Number(a.dataset.len) * (1 - Number(a.dataset.pct)), duration: 1.6, delay: 0.25 + i * 0.18, ease: 'power3.out' }));
      gsap.to('.jarvis-ticks', { rotation: 360, svgOrigin: '200 200', duration: 90, ease: 'none', repeat: -1 });
      gsap.to('.jarvis-ticks-rev', { rotation: -360, svgOrigin: '200 200', duration: 140, ease: 'none', repeat: -1 });
      gsap.from('.jarvis-read', { opacity: 0, x: 18, duration: 0.5, stagger: 0.1, delay: 0.5, ease: 'power2.out' });
    }, el);
    return () => ctx.revert();
  }, [f.fiveHour, f.runsToday, f.running, f.need]);

  const rows: Array<{ k: string; v: string; color: string }> = [
    { k: 'Usage, 5 h window', v: f.fiveHour === null ? 'no reading' : `${Math.round(f.fiveHour * 100)} %`, color: 'var(--os-cyan)' },
    { k: 'Runs today', v: `${f.runsToday} / ${f.maxRuns}`, color: 'var(--os-ok)' },
    { k: 'Agents active', v: `${f.running}`, color: 'var(--os-amber)' },
    { k: 'Awaiting you', v: `${f.need}`, color: f.need > 0 ? 'var(--os-danger)' : 'var(--os-muted)' },
  ];

  return (
    <section ref={root} className="relative -mx-5 -mt-5 min-h-[420px] overflow-hidden px-8 pt-8" aria-label="Status">
      <div className="relative z-10 max-w-[34rem]">
        <p className="font-os-mono text-xs uppercase tracking-[0.3em] text-os-cyan">Zak OS // command</p>
        <h2 className="os-display mt-3 text-[46px] text-os-text">
          <DecryptedText text={hello} animateOn="view" sequential revealDirection="start" speed={45} maxIterations={14} parentClassName="whitespace-pre-wrap" encryptedClassName="text-os-cyan" />
        </h2>
        <p className="mt-3 max-w-[30rem] font-os-mono text-[15px] uppercase tracking-[0.08em] text-os-muted">{summary}</p>
        <dl className="mt-7 grid max-w-sm gap-2.5">
          {rows.map((r) => (
            <div key={r.k} className="jarvis-read flex items-center gap-3 border-l-2 pl-3" style={{ borderColor: r.color }}>
              <dt className="flex-1 text-xs uppercase tracking-[0.16em] text-os-muted">{r.k}</dt>
              <dd className="font-os-mono text-[17px] tabular-nums text-os-text">{r.v}</dd>
            </div>
          ))}
        </dl>
        <OpenBar className="mt-6 max-w-lg" />
      </div>
      <div className="pointer-events-none absolute right-6 top-3 hidden h-[400px] w-[400px] md:block lg:right-[8%]" aria-hidden>
        <div className="absolute inset-[66px] overflow-hidden rounded-full">
          <Orb hue={78} hoverIntensity={0.35} forceHoverState={f.running > 0} backgroundColor={theme === 'dark' ? '#020911' : '#e3eff5'} />
        </div>
        <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
          <g className="jarvis-ticks">
            <circle cx="200" cy="200" r="196" fill="none" stroke="var(--os-contour)" strokeWidth="6" strokeDasharray="1 11" />
          </g>
          <g className="jarvis-ticks-rev">
            <circle cx="200" cy="200" r="184" fill="none" stroke="var(--os-cyan)" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="60 38 8 38" />
          </g>
          <Arc r={166} pct={f.fiveHour ?? 0} color="var(--os-cyan)" label="Usage in the 5 hour window" />
          <Arc r={154} pct={f.maxRuns ? f.runsToday / f.maxRuns : 0} color="var(--os-ok)" label="Runs today" />
          <Arc r={142} pct={f.maxActive ? f.activeRuns / f.maxActive : 0} color="var(--os-amber)" label="Running at once" />
          <Arc r={130} pct={Math.min(1, f.need / 5)} color="var(--os-danger)" label="Waiting for you" />
        </svg>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ Valley

function ValleyHero({ home, hello, summary }: HeroProps) {
  const f = figures(home);
  const cells = [
    { k: 'Projects', n: f.projects, sub: 'on this machine' },
    { k: 'Running now', n: f.running, sub: f.running === 1 ? 'agent at work' : 'agents at work' },
    { k: 'Needs you', n: f.need, sub: f.need === 0 ? 'all clear' : 'waiting for a decision' },
    { k: 'Runs today', n: f.runsToday, sub: `of ${f.maxRuns} allowed` },
  ];
  const date = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <section className="relative border-b border-os-line pb-0 pt-6" aria-label="Overview">
      <p className="font-os-mono text-xs uppercase tracking-[0.08em] text-os-muted">{date}</p>
      <BlurText text={hello} delay={90} animateBy="words" direction="top" className="os-display mt-2 text-[60px] leading-[1.02] text-os-text" />
      <p className="mt-3 max-w-xl text-[16px] text-os-muted">{summary}</p>
      <dl className="mt-9 grid grid-cols-2 border-t border-os-line md:grid-cols-4">
        {cells.map((c, i) => (
          <div key={c.k} className={cx('px-0 py-5 md:px-6', i > 0 && 'md:border-l md:border-os-line', i === 0 && 'md:pl-0', i % 2 === 1 && 'border-l border-os-line pl-5 md:pl-6')}>
            <dt className="text-[13px] text-os-muted">{c.k}</dt>
            <dd className="mt-1.5 text-[44px] font-semibold leading-none tracking-tight tabular-nums text-os-text">
              <CountUp to={c.n} duration={1.4} />
            </dd>
            <dd className="mt-1.5 text-[13px] text-os-muted">{c.sub}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ------------------------------------------------------------------ Rack

function Meter({ label, pct, readout }: { label: string; pct: number; readout: string }) {
  const needle = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    const el = needle.current;
    if (!el) return;
    const to = -50 + Math.min(1, Math.max(0, pct)) * 100;
    if (prefersReducedMotion()) {
      gsap.set(el, { rotation: to, svgOrigin: '100 118' });
      return;
    }
    gsap.fromTo(el, { rotation: -62, svgOrigin: '100 118' }, { rotation: to, svgOrigin: '100 118', duration: 1.6, ease: 'elastic.out(1, 0.35)', delay: 0.15 });
  }, [pct]);
  const ticks = Array.from({ length: 11 }, (_, i) => -50 + i * 10);
  return (
    <figure className="border-2 border-os-line bg-os-surface-2 p-2 shadow-[0_3px_0_var(--os-line)]" style={{ borderRadius: 'var(--os-radius)' }}>
      <svg viewBox="0 0 200 126" role="img" aria-label={`${label}: ${readout}`} className="block w-full">
        <path d="M 31.1 60.1 A 90 90 0 0 1 168.9 60.1" fill="none" stroke="var(--os-line)" strokeWidth="1.5" opacity="0.5" />
        {ticks.map((a, i) => (
          <line key={a} x1="100" y1="28" x2="100" y2={i % 5 === 0 ? 46 : 38} stroke="var(--os-text)" strokeWidth={i % 5 === 0 ? 2.4 : 1.3} transform={`rotate(${a} 100 118)`} />
        ))}
        <g ref={needle}>
          <line x1="100" y1="118" x2="100" y2="30" stroke="var(--os-cyan)" strokeWidth="2.6" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="118" r="7" fill="var(--os-text)" />
      </svg>
      <figcaption className="mt-1 flex items-baseline justify-between gap-2 border-t-2 border-os-line px-0.5 pt-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.1em] text-os-muted">{label}</span>
        <span className="font-os-mono text-sm tabular-nums text-os-text">{readout}</span>
      </figcaption>
    </figure>
  );
}

const DETENTS: Array<{ id: Motion; angle: number; label: string }> = [
  { id: 'off', angle: -60, label: 'Off' },
  { id: 'calm', angle: 0, label: 'Calm' },
  { id: 'full', angle: 60, label: 'Full' },
];

/** A real control: the knob sets the motion level in the appearance studio. */
function MotionKnob() {
  const { appearance } = useAppearance();
  const knob = useRef<HTMLDivElement>(null);
  const current = DETENTS.find((d) => d.id === appearance.motion) ?? DETENTS[2];

  useEffect(() => {
    const el = knob.current;
    if (!el) return;
    gsap.set(el, { rotation: current.angle });
    const [d] = Draggable.create(el, {
      type: 'rotation',
      bounds: { minRotation: -60, maxRotation: 60 },
      onDragEnd(this: Draggable) {
        const near = DETENTS.reduce((a, b) => (Math.abs(b.angle - this.rotation) < Math.abs(a.angle - this.rotation) ? b : a));
        gsap.to(el, { rotation: near.angle, duration: 0.25, ease: 'back.out(2)' });
        setAppearance({ motion: near.id });
      },
    });
    return () => {
      d.kill();
    };
    // The knob follows the stored value; dragging is the only thing that changes it from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (knob.current) gsap.to(knob.current, { rotation: current.angle, duration: 0.25, ease: 'back.out(2)' });
  }, [current.angle]);

  const step = (dir: number) => {
    const i = DETENTS.findIndex((d) => d.id === current.id);
    const next = DETENTS[Math.min(DETENTS.length - 1, Math.max(0, i + dir))];
    setAppearance({ motion: next.id });
  };

  return (
    <div className="grid justify-items-center gap-1.5">
      <div className="relative h-[88px] w-[88px]">
        {DETENTS.map((d) => (
          <span key={d.id} className="absolute left-1/2 top-1/2 text-xs font-bold uppercase text-os-muted" style={{ transform: `translate(-50%, -50%) rotate(${d.angle}deg) translateY(-46px) rotate(${-d.angle}deg)` }}>
            {d.label}
          </span>
        ))}
        <div
          ref={knob}
          role="slider"
          tabIndex={0}
          aria-label="Motion level"
          aria-valuemin={0}
          aria-valuemax={2}
          aria-valuenow={DETENTS.findIndex((d) => d.id === current.id)}
          aria-valuetext={current.label}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(1);
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(-1);
          }}
          className="absolute inset-[18px] cursor-grab rounded-full border-2 border-os-line bg-os-surface shadow-[0_3px_0_var(--os-line)] focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] active:cursor-grabbing"
        >
          <span className="absolute left-1/2 top-1 h-3 w-1 -translate-x-1/2 bg-os-cyan" aria-hidden />
        </div>
      </div>
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-os-muted">Motion</span>
    </div>
  );
}

function RackHero({ home, hello, summary }: HeroProps) {
  const f = figures(home);
  const leds: Array<{ k: string; on: boolean }> = [
    { k: 'Run', on: f.running > 0 },
    { k: 'Need', on: f.need > 0 },
    { k: 'Fail', on: home.attention.failedRuns.length > 0 },
    { k: 'Sched', on: home.schedules.some((s) => s.enabled) },
  ];
  return (
    <section className="relative -mx-5 -mt-5 border-b-2 border-os-line px-6 pb-6 pt-7" aria-label="Instruments">
      <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]">
        <div>
          <p className="font-os-mono text-xs uppercase tracking-[0.2em] text-os-muted">Unit 01 / Zak OS</p>
          <h2 className="os-display mt-2 text-[52px] leading-[0.98] text-os-text">{hello}</h2>
          <p className="mt-3 max-w-[28rem] text-[16px] text-os-muted">{summary}</p>
          <ul className="mt-4 flex flex-wrap gap-4" aria-label="Indicators">
            {leds.map((l) => (
              <li key={l.k} className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-os-text">
                <span className="rack-led" data-on={l.on} aria-hidden />
                {l.k}
                <span className="sr-only">{l.on ? 'on' : 'off'}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Meter label="5 h usage" pct={f.fiveHour ?? 0} readout={f.fiveHour === null ? 'n/a' : `${Math.round(f.fiveHour * 100)}%`} />
          <Meter label="Runs today" pct={f.maxRuns ? f.runsToday / f.maxRuns : 0} readout={`${f.runsToday}/${f.maxRuns}`} />
          <Meter label="At once" pct={f.maxActive ? f.activeRuns / f.maxActive : 0} readout={`${f.activeRuns}/${f.maxActive}`} />
        </div>
        <MotionKnob />
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ Abyss

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h % 1000) / 1000;
}

function AbyssHero({ home, hello, summary }: HeroProps) {
  const root = useRef<HTMLElement>(null);
  const items = useMemo(() => {
    const golden = 2.399963229728653;
    const list = home.projects.slice(0, 12);
    return list.map((p, i) => {
      const t = (i + 0.5) / list.length;
      const a = i * golden;
      const recent = p.lastSessionAt ? Math.max(0, 1 - (Date.now() - p.lastSessionAt) / (14 * 86_400_000)) : 0;
      const size = 96 + recent * 56 + (list.length < 4 ? 40 : 0);
      const running = home.running.sessions.filter((s) => s.cwd.replace(/\\/g, '/').toLowerCase().startsWith(p.path.replace(/\\/g, '/').toLowerCase())).length;
      return { p, size, running, x: 58 + Math.cos(a) * Math.sqrt(t) * 38, y: 50 + Math.sin(a) * Math.sqrt(t) * 36, depth: 0.4 + seedOf(p.id) * 0.9, delay: seedOf(p.id) * -6 };
    });
  }, [home]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from('.abyss-orb', { scale: 0, opacity: 0, duration: 1.1, ease: 'elastic.out(1, 0.5)', stagger: 0.07, delay: 0.2 });
      const movers = gsap.utils.toArray<HTMLElement>('.abyss-mover').map((n) => ({ n, x: gsap.quickTo(n, 'x', { duration: 1.2, ease: 'power3' }), y: gsap.quickTo(n, 'y', { duration: 1.2, ease: 'power3' }), d: Number(n.dataset.depth) }));
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - 0.5;
        const dy = (e.clientY - r.top) / r.height - 0.5;
        movers.forEach((m) => {
          m.x(-dx * 46 * m.d);
          m.y(-dy * 34 * m.d);
        });
      };
      el.addEventListener('pointermove', move);
      return () => el.removeEventListener('pointermove', move);
    }, el);
    return () => ctx.revert();
  }, [items]);

  return (
    <section ref={root} className="relative -mx-5 -mt-5 h-[430px] overflow-hidden" aria-label="Your projects, drifting">
      <div className="pointer-events-none absolute left-8 top-9 z-10 max-w-[30rem]">
        <BlurText text={hello} delay={110} animateBy="words" direction="bottom" className="os-display text-[54px] leading-[1.04] text-os-text" />
        <p className="mt-3 text-[16px] text-os-muted">{summary}</p>
      </div>
      {items.length === 0 ? (
        <p className="absolute bottom-16 right-8 max-w-xs text-right text-sm text-os-muted">
          No projects yet. <a className="text-os-text underline" href="#/projects">Add a folder or clone a repo</a> and it surfaces here.
        </p>
      ) : (
        <ul className="absolute inset-0">
          {items.map(({ p, size, running, x, y, depth, delay }) => (
            <li key={p.id} className="abyss-mover absolute" data-depth={depth} style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}>
              <div className="abyss-orb h-full w-full">
                <a
                  href={p.graphUpdated ? `#/brain/${p.id}` : '#/projects'}
                  className="abyss-bubble grid h-full w-full place-items-center rounded-full p-3 text-center text-os-text outline-none transition-transform hover:scale-105 focus-visible:shadow-[var(--os-focus-ring)]"
                  style={{
                    animationDelay: `${delay}s`,
                    background: `radial-gradient(circle at 30% 24%, color-mix(in srgb, ${p.color} 60%, transparent), color-mix(in srgb, ${p.color} 16%, transparent) 70%)`,
                    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${p.color} 70%, transparent), 0 0 ${running ? 46 : 22}px -4px ${p.color}`,
                  }}
                >
                  <span className="max-w-full">
                    <span className="block truncate text-[14px] font-semibold leading-tight">{p.name}</span>
                    {running > 0 && <span className="mt-0.5 block text-xs text-os-cyan">{running} running</span>}
                  </span>
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function WorldHero({ world, ...props }: HeroProps & { world: Exclude<WorldId, 'atlas'> }) {
  if (world === 'cyber') return <CyberHero {...props} />;
  if (world === 'jarvis') return <JarvisHero {...props} />;
  if (world === 'valley') return <ValleyHero {...props} />;
  if (world === 'rack') return <RackHero {...props} />;
  return <AbyssHero {...props} />;
}
