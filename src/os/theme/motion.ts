import { useEffect, useState } from 'react';
import type { Transition, Variants } from 'motion/react';

export const spring = {
  snappy: { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 } as Transition,
  soft: { type: 'spring', stiffness: 260, damping: 30 } as Transition,
  gentle: { type: 'spring', stiffness: 140, damping: 22 } as Transition,
};

export const ease = {
  out: [0.22, 1, 0.36, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
};

export const fade: Transition = { duration: 0.18, ease: ease.out };

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: ease.out } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12, ease: ease.inOut } },
};

/** Opacity-only variant for reduced-motion users. */
export const reducedPageVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.01 } },
  exit: { opacity: 0, transition: { duration: 0.01 } },
};

const QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(prefersReducedMotion);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
