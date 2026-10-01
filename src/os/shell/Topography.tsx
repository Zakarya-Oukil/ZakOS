import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../theme/motion';

/**
 * Atlas background: a slowly drifting height field drawn as contour lines (marching squares).
 * The pointer pushes a hill into the field, so the lines bend around the cursor.
 * Static single frame under reduced motion; paused while the tab is hidden.
 */

const CELL = 16;
const LEVELS = 16;
const FRAME_MS = 1000 / 30;

type Pt = readonly [number, number];

function hash(ix: number, iy: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function cssColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function Topography({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;
    let field = new Float32Array(0);
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
    let stroke = '#2f5a4a';
    let accent = '#ff6a3d';

    const readColors = () => {
      stroke = cssColor('--os-contour', '#2f5a4a');
      accent = cssColor('--os-cyan', '#ff6a3d');
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / CELL) + 1;
      rows = Math.ceil(h / CELL) + 1;
      field = new Float32Array(cols * rows);
    };

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      // Ease the pointer so the hill glides instead of snapping.
      pointer.x += (pointer.tx - pointer.x) * 0.14;
      pointer.y += (pointer.ty - pointer.y) * 0.14;

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = i * CELL;
          const y = j * CELL;
          let v = noise(i * 0.075 + t * 0.03, j * 0.075 - t * 0.02) * 0.62;
          v += noise(i * 0.17 - t * 0.04, j * 0.17 + t * 0.03 + 40) * 0.26;
          v += noise(i * 0.4 + 90, j * 0.4 + t * 0.05) * 0.12;
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          v += 0.34 * Math.exp(-(dx * dx + dy * dy) / 26000);
          field[j * cols + i] = v;
        }
      }

      ctx.clearRect(0, 0, w, h);
      const step = 1.3 / LEVELS;
      const base = -0.05;
      for (let lv = 0; lv < LEVELS; lv++) {
        const level = base + lv * step;
        const major = lv % 4 === 0;
        ctx.beginPath();
        const seg = (p: Pt, q: Pt) => {
          ctx.moveTo(p[0], p[1]);
          ctx.lineTo(q[0], q[1]);
        };
        for (let j = 0; j < rows - 1; j++) {
          for (let i = 0; i < cols - 1; i++) {
            const a = field[j * cols + i];
            const b = field[j * cols + i + 1];
            const c = field[(j + 1) * cols + i + 1];
            const d = field[(j + 1) * cols + i];
            const mask = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
            if (mask === 0 || mask === 15) continue;
            const x0 = i * CELL;
            const y0 = j * CELL;
            const top: Pt = [x0 + CELL * ((level - a) / (b - a)), y0];
            const right: Pt = [x0 + CELL, y0 + CELL * ((level - b) / (c - b))];
            const bottom: Pt = [x0 + CELL * ((level - d) / (c - d)), y0 + CELL];
            const left: Pt = [x0, y0 + CELL * ((level - a) / (d - a))];
            switch (mask) {
              case 1:
              case 14:
                seg(left, bottom);
                break;
              case 2:
              case 13:
                seg(bottom, right);
                break;
              case 3:
              case 12:
                seg(left, right);
                break;
              case 4:
              case 11:
                seg(top, right);
                break;
              case 5:
                seg(left, top);
                seg(bottom, right);
                break;
              case 6:
              case 9:
                seg(top, bottom);
                break;
              case 7:
              case 8:
                seg(left, top);
                break;
              case 10:
                seg(top, right);
                seg(left, bottom);
                break;
            }
          }
        }
        ctx.strokeStyle = major ? accent : stroke;
        ctx.globalAlpha = major ? 0.26 : 0.5;
        ctx.lineWidth = major ? 1.25 : 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      last = now;
      draw(now);
    };

    const onMove = (e: PointerEvent) => {
      pointer.tx = e.clientX;
      pointer.ty = e.clientY;
      if (pointer.x < -9000) {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
      }
    };
    const onLeave = () => {
      pointer.tx = -9999;
      pointer.ty = -9999;
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) raf = requestAnimationFrame(loop);
    };

    readColors();
    resize();
    draw(performance.now());
    if (!reduced) {
      raf = requestAnimationFrame(loop);
      window.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
      document.addEventListener('visibilitychange', onVisibility);
    }

    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    ro.observe(canvas);
    const mo = new MutationObserver(() => {
      readColors();
      draw(performance.now());
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
