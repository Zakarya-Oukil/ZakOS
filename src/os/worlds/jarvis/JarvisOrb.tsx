import { useId } from 'react';
import { cx } from '../../ui/cx';
import type { OrbState } from './orbStore';

interface Props {
  state?: OrbState;
  /** Diameter of the glass sphere in px. The SVG is 2.6 times wider so the glow and rings have room. */
  size?: number;
  /** Steps done over steps started in this turn, 0 to 1. Drawn as the arc while running. */
  progress?: number;
  /** Flat concentric rings: reduced motion, a slow GPU, or the owner's choice. No blur, no animation. */
  flat?: boolean;
  className?: string;
  title?: string;
}

const LABEL: Record<OrbState, string> = {
  idle: 'No session is running',
  thinking: 'An agent is thinking',
  running: 'An agent is running tools',
  error: 'Something needs you',
};

/** The J.A.R.V.I.S. orb: a glass sphere with a shifting core. The same drawing as the Figma frames. */
export function JarvisOrb({ state = 'idle', size = 66, progress = 0, flat = false, className, title }: Props) {
  const uid = useId().replace(/:/g, '');
  const arc = state === 'error' ? 'var(--jv-warn)' : 'var(--jv-arc)';
  const P = state === 'error' ? '#FF6B6B' : 'var(--jv-arc)';
  const W = 260; // viewBox; the sphere is 100 wide inside it
  const c = W / 2;
  const R = 50;
  const circ = (r: number) => 2 * Math.PI * r;
  const pct = Math.max(0.12, Math.min(1, progress || 0));
  const px = size * 2.6;

  return (
    <svg
      className={cx('jv-orb', className)}
      data-state={state}
      data-flat={flat ? 'true' : undefined}
      width={px}
      height={px}
      viewBox={`0 0 ${W} ${W}`}
      role="img"
      aria-label={title ?? LABEL[state]}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor={P} stopOpacity={flat ? 0.18 : 0.34} />
          <stop offset="0.45" stopColor={P} stopOpacity={flat ? 0.06 : 0.1} />
          <stop offset="1" stopColor={P} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-shell`} cx="0.38" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#1F5688" stopOpacity="0.6" />
          <stop offset="0.55" stopColor="#0A2342" stopOpacity="0.8" />
          <stop offset="1" stopColor="#040C1A" stopOpacity="0.96" />
        </radialGradient>
        <radialGradient id={`${uid}-rim`}>
          <stop offset="0" stopColor={P} stopOpacity="0" />
          <stop offset="0.76" stopColor={P} stopOpacity="0" />
          <stop offset="1" stopColor={P} stopOpacity="0.55" />
        </radialGradient>
        <radialGradient id={`${uid}-core`}>
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="0.22" stopColor={P} stopOpacity="0.85" />
          <stop offset="0.62" stopColor={P} stopOpacity="0.24" />
          <stop offset="1" stopColor={P} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-hi`}>
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <circle cx={c} cy={c} r={W * 0.48} fill={`url(#${uid}-glow)`} className="jv-glow" />

      {flat ? (
        <g>
          <circle cx={c} cy={c} r={75} fill="none" stroke={P} strokeOpacity="0.35" strokeWidth="1" />
          <circle cx={c} cy={c} r={58} fill="none" stroke={P} strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="2 6" />
          <circle cx={c} cy={c} r={40} fill="none" stroke={P} strokeOpacity="0.85" strokeWidth="2" />
          <circle cx={c} cy={c} r={23} fill={`url(#${uid}-core)`} />
          {state === 'running' && (
            <circle cx={c} cy={c} r={75} fill="none" stroke={arc} strokeWidth="2" strokeLinecap="round" strokeDasharray={`${circ(75) * pct} ${circ(75)}`} transform={`rotate(-90 ${c} ${c})`} />
          )}
          {state === 'error' && (
            <circle cx={c} cy={c} r={75} fill="none" stroke="var(--jv-warn)" strokeWidth="2" strokeLinecap="round" strokeDasharray={`${circ(75) * 0.55} ${circ(75)}`} transform={`rotate(-70 ${c} ${c})`} />
          )}
        </g>
      ) : (
        <g>
          <g className="jv-drift">
            <ellipse cx={c} cy={c} rx={87.5} ry={25} fill="none" stroke={P} strokeOpacity="0.38" strokeWidth="1" transform={`rotate(-18 ${c} ${c})`} />
          </g>
          <circle cx={c} cy={c} r={R} fill={`url(#${uid}-shell)`} />
          <circle cx={c} cy={c} r={R} fill={`url(#${uid}-rim)`} stroke={P} strokeOpacity="0.55" strokeWidth="1.25" />
          {state !== 'error' && (
            <g className="jv-wisps">
              <ellipse cx={c} cy={c} rx={41} ry={15} fill="none" stroke={P} strokeOpacity="0.42" strokeWidth="1" transform={`rotate(-28 ${c} ${c})`} />
              <ellipse cx={c} cy={c} rx={40} ry={13} fill="none" stroke={P} strokeOpacity="0.3" strokeWidth="1" transform={`rotate(34 ${c} ${c})`} />
              {state === 'thinking' && <circle cx={c} cy={c} r={35} fill="none" stroke={P} strokeOpacity="0.5" strokeWidth="1" strokeDasharray="1 5" />}
            </g>
          )}
          <circle className="jv-core" cx={c} cy={c + R * 0.04} r={R * 0.26} fill={`url(#${uid}-core)`} filter={`url(#${uid}-soft)`} />
          <ellipse cx={c - R * 0.18} cy={c - R * 0.3} rx={R * 0.23} ry={R * 0.09} fill={`url(#${uid}-hi)`} transform={`rotate(-34 ${c - R * 0.18} ${c - R * 0.3})`} />

          {state === 'error' ? (
            <>
              <circle cx={c} cy={c} r={77.5} fill="none" stroke="var(--jv-warn)" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 6" />
              <circle cx={c} cy={c} r={77.5} fill="none" stroke="var(--jv-warn)" strokeWidth="2" strokeLinecap="round" strokeDasharray={`${circ(77.5) * 0.55} ${circ(77.5)}`} transform={`rotate(-70 ${c} ${c})`} />
            </>
          ) : state === 'running' ? (
            <>
              <circle cx={c} cy={c} r={75} fill="none" stroke={P} strokeOpacity="0.3" strokeWidth="1" strokeDasharray="1 4" className="jv-ticks" />
              <circle cx={c} cy={c} r={75} fill="none" stroke={P} strokeWidth="2" strokeLinecap="round" strokeDasharray={`${circ(75) * pct} ${circ(75)}`} transform={`rotate(-90 ${c} ${c})`} className="jv-progress" />
            </>
          ) : (
            <g className="jv-drift-rev">
              <ellipse cx={c} cy={c} rx={75} ry={21} fill="none" stroke={P} strokeOpacity="0.7" strokeWidth="1" strokeDasharray="2 6" transform={`rotate(22 ${c} ${c})`} />
            </g>
          )}

          {state === 'thinking' && (
            <g className="jv-orbit">
              {[0.78, 1.4, 0.2].map((a, i) => (
                <circle key={i} cx={c + Math.cos(a * Math.PI) * 75} cy={c + Math.sin(a * Math.PI) * 75} r="2.2" fill="#fff" fillOpacity="0.95" />
              ))}
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
