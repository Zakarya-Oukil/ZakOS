import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { agentsSocket } from '../../lib/agentsSocket';
import { prefersReducedMotion } from '../../theme/motion';
import { JarvisOrb } from './JarvisOrb';

const KEY = 'zakos_jarvis_booted';
const SIZE = 150;
const DOCKED = 66;

const greeting = () => {
  const h = new Date().getHours();
  return `${h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}, Zak.`;
};

/** A real probe: resolves to true when the route answers, false on an error or after the timeout. */
async function probe(url: string): Promise<boolean> {
  const ctl = new AbortController();
  const timer = window.setTimeout(() => ctl.abort(), 1800);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

const shouldBoot = () => {
  if (prefersReducedMotion() || document.documentElement.dataset.motion === 'off') return false;
  try {
    return window.sessionStorage.getItem(KEY) !== '1';
  } catch {
    return false;
  }
};

/**
 * The J.A.R.V.I.S. boot, once per browser session, about two seconds:
 * the orb pulses, the name and one line of real service checks appear, then the orb flies to the header and the shell is there.
 * Any key or click skips to the end. Reduced motion and "motion off" never show it.
 */
export function JarvisBoot() {
  const [run] = useState(shouldBoot);
  const [done, setDone] = useState(false);
  const [checks, setChecks] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const orbBox = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (!run) return;
    try {
      window.sessionStorage.setItem(KEY, '1');
    } catch {
      /* storage blocked: the boot may show again on reload */
    }
    document.documentElement.dataset.jvBooting = 'true';
    let alive = true;
    void Promise.all([probe('/api/home'), probe('/api/vault/overview'), new Promise<boolean>((r) => (agentsSocket.connected ? r(true) : window.setTimeout(() => r(agentsSocket.connected), 900)))]).then(([api, vault, link]) => {
      if (!alive) return;
      setChecks([api ? 'API ready' : 'API offline', link ? 'Live link ready' : 'Live link offline', vault ? 'Vault ready' : 'Vault offline'].join(' · '));
    });
    return () => {
      alive = false;
      delete document.documentElement.dataset.jvBooting;
    };
  }, [run]);

  useLayoutEffect(() => {
    const el = root.current;
    const box = orbBox.current;
    if (!run || !el || !box) return;
    const q = (s: string) => el.querySelector(s);
    const finish = () => {
      delete document.documentElement.dataset.jvBooting;
      setDone(true);
    };
    const line = gsap.timeline({ onComplete: finish });
    tl.current = line;
    gsap.set(box, { opacity: 0, scale: 0.7 });
    gsap.set([q('.jv-name'), q('.jv-hello'), q('.jv-checks')], { opacity: 0 });
    // 0.0 to 0.6: the orb arrives and pulses once.
    line
      .to(box, { opacity: 1, scale: 1, duration: 0.42, ease: 'power2.out' }, 0)
      .to(box, { scale: 1.07, duration: 0.18, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.42)
      // 0.6 to 1.6: name, greeting, checks.
      .to(box, { y: -34, duration: 0.5, ease: 'power2.inOut' }, 0.6)
      .fromTo(q('.jv-name'), { opacity: 0, letterSpacing: '0.5em' }, { opacity: 1, letterSpacing: '0.28em', duration: 0.6, ease: 'power2.out' }, 0.7)
      .to(q('.jv-hello'), { opacity: 1, duration: 0.35 }, 1.0)
      .to(q('.jv-checks'), { opacity: 1, duration: 0.3 }, 1.15)
      // 1.6 to 2.0: the orb docks, the shell appears.
      .addLabel('dock', 1.6)
      .to([q('.jv-name'), q('.jv-hello'), q('.jv-checks'), q('.jv-skip')], { opacity: 0, duration: 0.2 }, 'dock')
      .add(() => {
        const slot = document.querySelector('[data-jarvis-orb-slot]');
        const r = slot?.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        const to = r ? { x: r.left + r.width / 2 - (b.left + b.width / 2), y: r.top + r.height / 2 - (b.top + b.height / 2) } : { x: 0, y: -window.innerHeight / 2 + 50 };
        gsap.to(box, { x: `+=${to.x}`, y: `+=${to.y}`, scale: DOCKED / SIZE, duration: 0.4, ease: 'power3.inOut' });
        gsap.to(q('.jv-bg'), { opacity: 0, duration: 0.4, ease: 'power1.in' });
      }, 'dock')
      .to({}, { duration: 0.4 }, 'dock');
    return () => {
      line.kill();
    };
  }, [run]);

  useEffect(() => {
    if (!run || done) return;
    const skip = () => tl.current?.timeScale(8);
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [run, done]);

  if (!run || done) return null;
  return (
    <div ref={root} aria-hidden className="jv-boot fixed inset-0 z-[95] grid place-items-center">
      <div className="jv-bg absolute inset-0" />
      <div ref={orbBox} className="relative will-change-transform">
        <JarvisOrb state="idle" size={SIZE} />
      </div>
      <div className="absolute inset-x-0 top-1/2 mt-[84px] flex flex-col items-center gap-3 text-center">
        <p className="jv-name jv-display text-[44px] leading-none text-os-text">J.A.R.V.I.S.</p>
        <p className="jv-hello text-[17px] text-os-muted">{greeting()}</p>
        <p className="jv-checks min-h-[18px] font-os-mono text-xs text-os-cyan opacity-80">{checks ?? 'Checking services'}</p>
      </div>
      <p className="jv-skip absolute inset-x-0 bottom-10 text-center font-os-mono text-xs text-os-muted">Any key skips</p>
    </div>
  );
}
