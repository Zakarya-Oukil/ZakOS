import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from '../theme/motion';
import { WORLD_EVENT, WORLDS, type WorldId } from './worlds';

/** A short GSAP moment when the world changes, one per world, drawn in the new world's colours. */
export function WorldTransition() {
  const [to, setTo] = useState<WorldId | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const on = (e: Event) => {
      if (prefersReducedMotion() || document.documentElement.dataset.motion === 'off') return;
      setTo((e as CustomEvent<{ to: WorldId }>).detail.to);
    };
    window.addEventListener(WORLD_EVENT, on);
    return () => window.removeEventListener(WORLD_EVENT, on);
  }, []);

  useLayoutEffect(() => {
    const el = root.current;
    if (!to || !el) return;
    const q = <T extends Element = HTMLElement>(s: string) => el.querySelector(s) as T | null;
    const done = () => setTo(null);
    const tl = gsap.timeline({ onComplete: done });
    if (to === 'jarvis') {
      tl.set(el, { opacity: 1 })
        .fromTo(q('.fx-line'), { y: -4 }, { y: window.innerHeight, duration: 0.9, ease: 'power2.inOut' }, 0)
        .fromTo(q('.fx-text'), { opacity: 0, letterSpacing: '0.6em' }, { opacity: 1, letterSpacing: '0.24em', duration: 0.35, ease: 'power2.out' }, 0.05)
        .to(q('.fx-text'), { opacity: 0, duration: 0.25 }, 0.6)
        .to(el, { opacity: 0, duration: 0.35 }, 0.7);
    } else if (to === 'valley') {
      tl.fromTo(q('.fx-wipe'), { xPercent: -101 }, { xPercent: 0, duration: 0.28, ease: 'power3.out' })
        .to(q('.fx-wipe'), { xPercent: 101, duration: 0.32, ease: 'power3.in' }, 0.3);
    } else if (to === 'rack') {
      tl.fromTo(q('.fx-top'), { yPercent: -100 }, { yPercent: 0, duration: 0.22, ease: 'power4.in' }, 0)
        .fromTo(q('.fx-bottom'), { yPercent: 100 }, { yPercent: 0, duration: 0.22, ease: 'power4.in' }, 0)
        .to(el, { x: 3, duration: 0.04, yoyo: true, repeat: 3 }, 0.22)
        .to(q('.fx-top'), { yPercent: -100, duration: 0.4, ease: 'power3.out' }, 0.45)
        .to(q('.fx-bottom'), { yPercent: 100, duration: 0.4, ease: 'power3.out' }, 0.45);
    } else if (to === 'abyss') {
      tl.fromTo(q('.fx-pool'), { scale: 0, opacity: 1 }, { scale: 1, duration: 0.7, ease: 'power2.out' }, 0)
        .to(el, { opacity: 0, duration: 0.5, ease: 'power1.inOut' }, 0.55);
    } else {
      tl.fromTo(q('.fx-wipe'), { opacity: 1 }, { opacity: 0, duration: 0.4 });
    }
    return () => {
      tl.kill();
    };
  }, [to]);

  if (!to) return null;
  const w = WORLDS.find((x) => x.id === to)!;
  const [bg, , accent] = w.swatch;
  return (
    <div ref={root} aria-hidden className="world-fx overflow-hidden" style={{ opacity: to === 'valley' || to === 'rack' ? 1 : 0 }}>
      {to === 'jarvis' && (
        <>
          <div className="absolute inset-0" style={{ background: bg }} />
          <div className="fx-line absolute left-0 right-0 top-0 h-px" style={{ background: accent, boxShadow: `0 0 24px 6px ${accent}` }} />
          <p className="fx-text absolute inset-0 grid place-items-center font-os-mono text-sm uppercase" style={{ color: accent }}>Initialising J.A.R.V.I.S.</p>
        </>
      )}
      {to === 'valley' && <div className="fx-wipe absolute inset-0" style={{ background: '#0a0a0a' }} />}
      {to === 'rack' && (
        <>
          <div className="fx-top absolute inset-x-0 top-0 h-1/2 border-b-4 border-[#1c1c1a]" style={{ background: '#c8c8c3' }} />
          <div className="fx-bottom absolute inset-x-0 bottom-0 h-1/2 border-t-4 border-[#1c1c1a]" style={{ background: '#c8c8c3' }} />
        </>
      )}
      {to === 'abyss' && <div className="fx-pool absolute left-1/2 top-full h-[260vmax] w-[260vmax] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(circle, ${accent}55, ${bg} 55%)` }} />}
      {to === 'atlas' && <div className="fx-wipe absolute inset-0" style={{ background: bg }} />}
    </div>
  );
}
