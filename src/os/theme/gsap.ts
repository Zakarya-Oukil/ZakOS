import gsap from 'gsap';
import { prefersReducedMotion } from './motion';

/** Staggered fade/translate of every descendant carrying a data-boot attribute. */
export function bootSequence(container: HTMLElement | null): gsap.core.Timeline | null {
  if (!container || prefersReducedMotion()) return null;
  const targets = container.querySelectorAll<HTMLElement>('[data-boot]');
  if (!targets.length) return null;
  const tl = gsap.timeline();
  tl.fromTo(
    targets,
    { autoAlpha: 0, y: 10 },
    { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out', stagger: 0.06, clearProps: 'transform,opacity,visibility' },
  );
  return tl;
}

/** Looping cyan glow for a live-status element. Call .kill() to stop. */
export function pulse(el: HTMLElement | null): gsap.core.Timeline | null {
  if (!el || prefersReducedMotion()) return null;
  const tl = gsap.timeline({ repeat: -1, yoyo: true });
  tl.fromTo(
    el,
    { boxShadow: '0 0 0 0 rgba(255,106,61,0)' },
    { boxShadow: '0 0 14px 2px rgba(255,106,61,0.45)', duration: 1.1, ease: 'sine.inOut' },
  );
  return tl;
}
