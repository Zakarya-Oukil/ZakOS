import type { WorkflowRun } from './api';

/**
 * The plan drawn as a route: a start flag, one waypoint per sub-agent in order, and a finish flag for review. The line
 * fills as work completes, so a glance shows how far along the run is. Colour is never the only signal: each waypoint
 * carries its state as text.
 */
const TONE: Record<string, string> = {
  queued: 'var(--os-muted)',
  running: 'var(--os-cyan)',
  done: 'var(--os-ok)',
  error: 'var(--os-danger)',
};

export function RouteMap({ run }: { run: WorkflowRun }) {
  const tasks = run.tasks;
  if (tasks.length === 0) return null;
  const W = Math.max(560, tasks.length * 150 + 160);
  const H = 120;
  const stops = tasks.length + 2;
  const x = (i: number) => 40 + (i * (W - 80)) / (stops - 1);
  const y = (i: number) => 56 + (i % 2 === 0 ? -14 : 14) * (i === 0 || i === stops - 1 ? 0 : 1);
  const doneCount = tasks.filter((t) => t.state === 'done').length;
  const reviewed = run.status === 'done';
  const progress = tasks.length === 0 ? 0 : (doneCount + (reviewed ? 1 : 0)) / (tasks.length + 1);

  const path = Array.from({ length: stops }, (_, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(i)}`).join(' ');
  const smooth = Array.from({ length: stops }, (_, i) => {
    if (i === 0) return `M${x(0)},${y(0)}`;
    const cx = (x(i - 1) + x(i)) / 2;
    return `C${cx},${y(i - 1)} ${cx},${y(i)} ${x(i)},${y(i)}`;
  }).join(' ');
  void path;

  return (
    <div className="overflow-x-auto" role="group" aria-label={`Route: ${doneCount} of ${tasks.length} sub-agents done${reviewed ? ', reviewed' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-none" aria-hidden>
        <path d={smooth} fill="none" stroke="var(--os-contour)" strokeWidth={3} strokeLinecap="round" strokeDasharray="2 7" />
        <path d={smooth} fill="none" stroke="var(--os-cyan)" strokeWidth={3} strokeLinecap="round" pathLength={1} strokeDasharray={`${progress} 1`} />
        {/* start */}
        <g>
          <circle cx={x(0)} cy={y(0)} r={7} fill="var(--os-bg)" stroke="var(--os-text)" strokeWidth={2} />
          <text x={x(0)} y={y(0) + 28} textAnchor="middle" className="fill-[var(--os-muted)] text-[12px]">Plan</text>
        </g>
        {tasks.map((t, i) => (
          <g key={t.id}>
            <circle cx={x(i + 1)} cy={y(i + 1)} r={9} fill="var(--os-bg)" stroke={TONE[t.state]} strokeWidth={3} />
            {t.state === 'running' && <circle cx={x(i + 1)} cy={y(i + 1)} r={9} fill="none" stroke={TONE.running} strokeWidth={2} className="os-territory-live" />}
            {t.state === 'done' && <path d={`M${x(i + 1) - 4},${y(i + 1)} l3,3 l5,-6`} fill="none" stroke={TONE.done} strokeWidth={2} strokeLinecap="round" />}
            <text x={x(i + 1)} y={y(i + 1) + (i % 2 === 0 ? -20 : 32)} textAnchor="middle" className="fill-[var(--os-text)] text-[12px]">
              {t.title.length > 22 ? `${t.title.slice(0, 21)}...` : t.title}
            </text>
            <text x={x(i + 1)} y={y(i + 1) + (i % 2 === 0 ? -6 : 46)} textAnchor="middle" className="fill-[var(--os-muted)] text-[11px]">{t.state}</text>
          </g>
        ))}
        {/* finish: the review */}
        <g>
          <path d={`M${x(stops - 1)},${y(stops - 1)} v-22 l16,5 l-16,5`} fill={reviewed ? 'var(--os-ok)' : 'none'} stroke={reviewed ? 'var(--os-ok)' : 'var(--os-muted)'} strokeWidth={2} />
          <text x={x(stops - 1)} y={y(stops - 1) + 28} textAnchor="middle" className="fill-[var(--os-muted)] text-[12px]">{run.verdict ? (run.verdict === 'pass' ? 'Review passed' : 'Needs work') : 'Review'}</text>
        </g>
      </svg>
    </div>
  );
}
