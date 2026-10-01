import { useMemo } from 'react';

/** A hand-wobbled closed ring: one contour line around a summit. The seed makes every page's glyph its own. */
export function ringPath(cx: number, cy: number, r: number, seed: number, k: number, squash = 0.82): string {
  const pts: string[] = [];
  const steps = 56;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const wob = 1 + 0.13 * Math.sin(3 * t + seed) + 0.07 * Math.sin(5 * t + seed * 1.7 + k) + 0.04 * Math.sin(8 * t + seed * 0.6);
    pts.push(`${(cx + Math.cos(t) * r * wob * 1.2).toFixed(1)},${(cy + Math.sin(t) * r * wob * squash).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

export function seedOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h % 628) / 100;
}

/** Concentric contours with a small flag on top. Decorative, so it is hidden from assistive technology. */
export function ContourGlyph({ seed, size = 120 }: { seed: string; size?: number }) {
  const s = useMemo(() => seedOf(seed), [seed]);
  return (
    <svg viewBox="0 0 120 90" width={size} height={size * 0.75} aria-hidden className="mx-auto block">
      {[1, 0.78, 0.58, 0.4, 0.22].map((f, k) => (
        <path key={k} d={ringPath(60, 50, 34 * f, s, k)} fill={k === 0 ? 'var(--os-cyan)' : 'none'} fillOpacity={k === 0 ? 0.08 : 0} stroke={k === 0 ? 'var(--os-cyan)' : 'var(--os-contour)'} strokeWidth={k === 0 ? 1.6 : 1.2} />
      ))}
      <path d="M60 50 v-17" stroke="var(--os-text)" strokeWidth="1.5" />
      <path d="M60 33 l11 4 l-11 4z" fill="var(--os-cyan)" />
    </svg>
  );
}
