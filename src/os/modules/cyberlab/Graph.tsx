import { useMemo, useRef, useState } from 'react';
import type { EdgeRow, EntityRow } from './api';
import { TYPE_LABEL } from './api';

interface GNode {
  id: string;
  type: string;
  value: string;
  x: number;
  y: number;
}

const W = 1000;
const H = 640;
const MAX = 300;

/** A small force layout (repulsion, spring edges, gravity), computed once per data set. Same input, same picture. */
function layout(entities: EntityRow[], edges: EdgeRow[]): { nodes: GNode[]; links: Array<{ a: number; b: number; rel: string }>; hidden: number } {
  const map = new Map<string, GNode>();
  const add = (type: string, value: string) => {
    const id = `${type}:${value}`;
    if (!map.has(id)) map.set(id, { id, type, value, x: 0, y: 0 });
  };
  for (const e of entities) add(e.type, e.value);
  for (const e of edges)
    for (const id of [e.a, e.b]) {
      const i = id.indexOf(':');
      add(id.slice(0, i), id.slice(i + 1));
    }
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
  }
  let all = [...map.values()];
  const hidden = Math.max(0, all.length - MAX);
  if (hidden) all = all.sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0)).slice(0, MAX);
  const index = new Map(all.map((n, i) => [n.id, i]));
  all.forEach((n, i) => {
    const a = i * 2.399963;
    const r = 30 * Math.sqrt(i + 1);
    n.x = W / 2 + Math.cos(a) * r;
    n.y = H / 2 + Math.sin(a) * r;
  });
  const links = edges.flatMap((e) => (index.has(e.a) && index.has(e.b) ? [{ a: index.get(e.a)!, b: index.get(e.b)!, rel: e.rel }] : []));
  const n = all.length;
  const k = Math.sqrt((W * H) / Math.max(n, 1)) * 0.42;
  for (let it = 0; it < 260; it++) {
    const t = 1 - it / 260;
    const dx = new Float64Array(n);
    const dy = new Float64Array(n);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        let vx = all[i].x - all[j].x;
        let vy = all[i].y - all[j].y;
        let d2 = vx * vx + vy * vy;
        if (d2 < 0.01) {
          vx = Math.random() - 0.5;
          vy = Math.random() - 0.5;
          d2 = 0.5;
        }
        // Repulsion of size k²/d along the line between the two nodes.
        const f = (k * k) / d2;
        dx[i] += vx * f * 0.35;
        dy[i] += vy * f * 0.35;
        dx[j] -= vx * f * 0.35;
        dy[j] -= vy * f * 0.35;
      }
    for (const l of links) {
      const vx = all[l.a].x - all[l.b].x;
      const vy = all[l.a].y - all[l.b].y;
      const d = Math.sqrt(vx * vx + vy * vy) || 1;
      // A spring toward a rest length, along the edge, so it can pull but never overshoot wildly.
      const pull = (d - k * 0.6) * 0.12;
      dx[l.a] -= (vx / d) * pull;
      dy[l.a] -= (vy / d) * pull;
      dx[l.b] += (vx / d) * pull;
      dy[l.b] += (vy / d) * pull;
    }
    for (let i = 0; i < n; i++) {
      dx[i] += (W / 2 - all[i].x) * 0.06;
      dy[i] += (H / 2 - all[i].y) * 0.06;
      const m = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1;
      const s = Math.min(m, 40 * t + 2) / m;
      all[i].x = Math.min(W - 60, Math.max(60, all[i].x + dx[i] * s));
      all[i].y = Math.min(H - 40, Math.max(40, all[i].y + dy[i] * s));
    }
  }
  return { nodes: all, links, hidden };
}

/** Shape by type, so the graph reads without colour. */
function Shape({ type, r }: { type: string; r: number }) {
  switch (type) {
    case 'ip':
      return <rect x={-r} y={-r} width={r * 2} height={r * 2} />;
    case 'email':
      return <polygon points={`0,${-r * 1.3} ${r * 1.3},0 0,${r * 1.3} ${-r * 1.3},0`} />;
    case 'username':
      return <polygon points={`0,${-r * 1.25} ${r * 1.2},${r} ${-r * 1.2},${r}`} />;
    case 'host':
      return <rect x={-r} y={-r * 0.65} width={r * 2} height={r * 1.3} rx={0} />;
    case 'hash':
    case 'file':
      return <polygon points={`${-r},${-r} ${r},${-r} ${r},${r * 0.2} 0,${r * 1.2} ${-r},${r * 0.2}`} />;
    case 'asn':
    case 'org':
      return <polygon points={`${-r},0 ${-r / 2},${-r * 0.9} ${r / 2},${-r * 0.9} ${r},0 ${r / 2},${r * 0.9} ${-r / 2},${r * 0.9}`} />;
    default:
      return <circle r={r} />;
  }
}

export function Graph({ entities, edges, selected, onSelect }: { entities: EntityRow[]; edges: EdgeRow[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const g = useMemo(() => layout(entities, edges), [entities, edges]);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const types = [...new Set(g.nodes.map((n) => n.type))];
  const near = useMemo(() => {
    if (!selected) return new Set<string>();
    const s = new Set<string>([selected]);
    for (const l of g.links) {
      if (g.nodes[l.a].id === selected) s.add(g.nodes[l.b].id);
      if (g.nodes[l.b].id === selected) s.add(g.nodes[l.a].id);
    }
    return s;
  }, [selected, g]);

  const zoom = (f: number) => setView((v) => ({ ...v, k: Math.min(4, Math.max(0.4, v.k * f)) }));

  return (
    <div>
      <div className="relative border border-os-line bg-os-bg">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-[560px] w-full touch-none select-none"
          role="img"
          aria-label={`Link graph with ${g.nodes.length} entities and ${g.links.length} relationships. The Entities tab lists the same data as a table.`}
          onPointerDown={(e) => {
            if ((e.target as Element).closest('[data-node]')) return;
            (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current || !svg.current) return;
            const sc = W / svg.current.getBoundingClientRect().width;
            setView((v) => ({ ...v, x: drag.current!.vx + (e.clientX - drag.current!.x) * sc, y: drag.current!.vy + (e.clientY - drag.current!.y) * sc }));
          }}
          onPointerUp={() => (drag.current = null)}
          onWheel={(e) => zoom(e.deltaY < 0 ? 1.1 : 0.9)}
          onClick={(e) => {
            if (!(e.target as Element).closest('[data-node]')) onSelect(null);
          }}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`} style={{ transformOrigin: `${W / 2}px ${H / 2}px` }}>
            {g.links.map((l, i) => {
              const a = g.nodes[l.a];
              const b = g.nodes[l.b];
              const hot = selected && (a.id === selected || b.id === selected);
              return (
                <g key={i}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hot ? 'var(--os-cyan)' : 'var(--os-contour)'} strokeWidth={hot ? 1.8 : 1} opacity={selected && !hot ? 0.25 : 0.9} />
                  {hot && (
                    <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle" fontSize="12" fill="var(--os-text)" style={{ paintOrder: 'stroke', stroke: 'var(--os-bg)', strokeWidth: 4 }}>
                      {l.rel}
                    </text>
                  )}
                </g>
              );
            })}
            {g.nodes.map((n) => {
              const on = n.id === selected;
              const dim = selected && !near.has(n.id);
              return (
                <g
                  key={n.id}
                  data-node
                  transform={`translate(${n.x} ${n.y})`}
                  tabIndex={0}
                  role="button"
                  aria-label={`${TYPE_LABEL[n.type] ?? n.type} ${n.value}`}
                  onClick={() => onSelect(on ? null : n.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(on ? null : n.id))}
                  style={{ cursor: 'pointer', opacity: dim ? 0.3 : 1 }}
                  className="outline-none [&:focus-visible>*:first-child]:stroke-[3px]"
                >
                  <g fill={on ? 'var(--os-cyan)' : 'var(--os-surface-2)'} stroke={on ? 'var(--os-cyan)' : 'var(--os-text)'} strokeWidth={1.6}>
                    <Shape type={n.type} r={8} />
                  </g>
                  <text y={22} textAnchor="middle" fontSize="12" fill="var(--os-text)" style={{ paintOrder: 'stroke', stroke: 'var(--os-bg)', strokeWidth: 4 }}>
                    {n.value.length > 24 ? `${n.value.slice(0, 23)}…` : n.value}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        <div className="absolute right-2 top-2 flex flex-col border border-os-line bg-os-surface">
          <button type="button" aria-label="Zoom in" onClick={() => zoom(1.25)} className="h-8 w-8 text-lg text-os-text hover:bg-os-surface-2">+</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoom(0.8)} className="h-8 w-8 border-t border-os-line text-lg text-os-text hover:bg-os-surface-2">−</button>
          <button type="button" aria-label="Reset the view" onClick={() => setView({ x: 0, y: 0, k: 1 })} className="h-8 w-8 border-t border-os-line text-xs text-os-text hover:bg-os-surface-2">1:1</button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-os-muted">
        {types.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="-12 -12 24 24" aria-hidden>
              <g fill="var(--os-surface-2)" stroke="var(--os-text)" strokeWidth="1.6">
                <Shape type={t} r={7} />
              </g>
            </svg>
            {TYPE_LABEL[t] ?? t}
          </span>
        ))}
        {g.hidden > 0 && <span>Showing the {MAX} best connected of {g.nodes.length + g.hidden}</span>}
      </div>
    </div>
  );
}
