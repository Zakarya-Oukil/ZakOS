import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as RPointerEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowSquareOut, ArrowsInSimple, ArrowsOutSimple, X } from '@phosphor-icons/react';
import { MIN_H, MIN_W, closeWindow, focusWindow, setBounds, toggleMaximise, useWindows, type FloatWindow } from '../lib/windows';
import { openInBrowser } from '../lib/launcher';
import { usePrefersReducedMotion } from '../theme/motion';
import { cx } from '../ui/cx';

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const EDGES: Array<{ edge: Edge; cls: string }> = [
  { edge: 'n', cls: 'left-3 right-3 top-0 h-1.5 cursor-ns-resize' },
  { edge: 's', cls: 'bottom-0 left-3 right-3 h-1.5 cursor-ns-resize' },
  { edge: 'w', cls: 'bottom-3 left-0 top-3 w-1.5 cursor-ew-resize' },
  { edge: 'e', cls: 'bottom-3 right-0 top-3 w-1.5 cursor-ew-resize' },
  { edge: 'nw', cls: 'left-0 top-0 h-3 w-3 cursor-nwse-resize' },
  { edge: 'ne', cls: 'right-0 top-0 h-3 w-3 cursor-nesw-resize' },
  { edge: 'sw', cls: 'bottom-0 left-0 h-3 w-3 cursor-nesw-resize' },
  { edge: 'se', cls: 'bottom-0 right-0 h-3 w-3 cursor-nwse-resize' },
];

const isLocalHost = (src: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(src);

function WindowFrame({ win }: { win: FloatWindow }) {
  const reduced = usePrefersReducedMotion();
  const shell = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  /**
   * Dragging and resizing write straight to the element so the page does not re-render on every pointer move.
   * The final box is committed to the store on release.
   */
  const begin = (e: RPointerEvent, mode: 'move' | Edge) => {
    if (win.maximised || e.button !== 0) return;
    const el = shell.current;
    if (!el) return;
    e.preventDefault();
    focusWindow(win.id);
    const start = { px: e.clientX, py: e.clientY, x: win.x, y: win.y, w: win.w, h: win.h };
    const box = { x: win.x, y: win.y, w: win.w, h: win.h };
    el.dataset.busy = '1';
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const apply = () => {
      el.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;
      el.style.width = `${box.w}px`;
      el.style.height = `${box.h}px`;
    };

    const move = (ev: globalThis.PointerEvent) => {
      const dx = ev.clientX - start.px;
      const dy = ev.clientY - start.py;
      if (mode === 'move') {
        box.x = Math.min(Math.max(start.x + dx, 80 - start.w), window.innerWidth - 80);
        box.y = Math.min(Math.max(start.y + dy, 0), window.innerHeight - 40);
      } else {
        if (mode.includes('e')) box.w = Math.max(MIN_W, start.w + dx);
        if (mode.includes('s')) box.h = Math.max(MIN_H, start.h + dy);
        if (mode.includes('w')) {
          box.w = Math.max(MIN_W, start.w - dx);
          box.x = start.x + (start.w - box.w);
        }
        if (mode.includes('n')) {
          box.h = Math.max(MIN_H, start.h - dy);
          box.y = Math.max(0, start.y + (start.h - box.h));
        }
      }
      apply();
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      delete el.dataset.busy;
      setBounds(win.id, box);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  // Keyboard: arrows move the window, Shift with arrows resizes it, Escape closes it.
  const onKey = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const step = e.altKey ? 64 : 16;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d && !win.maximised) {
      e.preventDefault();
      if (e.shiftKey) setBounds(win.id, { x: win.x, y: win.y, w: Math.max(MIN_W, win.w + d[0]), h: Math.max(MIN_H, win.h + d[1]) });
      else setBounds(win.id, { x: win.x + d[0], y: win.y + d[1], w: win.w, h: win.h });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeWindow(win.id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      toggleMaximise(win.id);
    }
  };

  const external = async () => {
    try {
      await openInBrowser(win.original);
      setNote(null);
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not open the browser');
    }
  };

  const btn = 'grid h-8 w-8 place-items-center rounded-[var(--os-radius)] text-os-muted transition-colors hover:bg-os-surface-2 hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] active:scale-95';

  return (
    <div
      ref={shell}
      role="dialog"
      aria-label={win.title}
      onPointerDownCapture={() => focusWindow(win.id)}
      className={cx('os-float group fixed left-0 top-0 flex flex-col', win.maximised && '!inset-0')}
      style={
        win.maximised
          ? { zIndex: win.z, width: '100vw', height: '100dvh', transform: 'none' }
          : { zIndex: win.z, width: win.w, height: win.h, transform: `translate3d(${win.x}px, ${win.y}px, 0)` }
      }
    >
      <motion.div
        className={cx('flex h-full min-h-0 flex-col overflow-hidden border border-os-line bg-os-bg shadow-[var(--os-shadow-panel),var(--os-glow-cyan)]', win.maximised ? 'rounded-none' : 'rounded-[var(--os-radius-lg)]')}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: reduced ? 0.01 : 0.28, ease: [0.16, 1, 0.3, 1] } }}
      >
        <div
          tabIndex={0}
          aria-label={`${win.title} window. Arrow keys move it, Shift and arrows resize it, Enter toggles full screen, Escape closes it.`}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            begin(e, 'move');
          }}
          onDoubleClick={(e) => {
            if (!(e.target as HTMLElement).closest('button')) toggleMaximise(win.id);
          }}
          className={cx('flex h-10 shrink-0 select-none items-center gap-2 border-b border-os-line bg-os-surface pl-3 pr-1 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--os-cyan)]', win.maximised ? 'cursor-default' : 'cursor-grab active:cursor-grabbing')}
        >
          <span className="min-w-0 flex-1 truncate font-os-sans text-[13px] font-medium text-os-text">{win.title}</span>
          <button type="button" onClick={external} className={btn} aria-label="Open in the default browser" title="Open in the default browser">
            <ArrowSquareOut size={16} weight="regular" aria-hidden />
          </button>
          <button type="button" onClick={() => toggleMaximise(win.id)} className={btn} aria-label={win.maximised ? 'Restore window size' : 'Full screen'} title={win.maximised ? 'Restore' : 'Full screen'}>
            {win.maximised ? <ArrowsInSimple size={16} weight="regular" aria-hidden /> : <ArrowsOutSimple size={16} weight="regular" aria-hidden />}
          </button>
          <button type="button" onClick={() => closeWindow(win.id)} className={cx(btn, 'hover:!bg-os-danger/20 hover:!text-os-danger')} aria-label="Close window" title="Close">
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 bg-os-surface">
          <iframe
            key={win.src}
            title={win.title}
            src={win.src}
            onLoad={() => setLoaded(true)}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
            allowFullScreen
            sandbox={`allow-scripts allow-forms allow-popups allow-presentation${isLocalHost(win.src) ? '' : ' allow-same-origin'}`}
            className="h-full w-full border-0 bg-white"
          />
          {/* While moving or resizing, the frame must not swallow the pointer. */}
          <div className="os-float-shield absolute inset-0 hidden" />
          {!loaded && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-os-surface" role="status">
              <span className="font-os-sans text-xs text-os-muted">Loading {win.title}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-os-line bg-os-surface px-3 py-1.5">
          <p className="min-w-0 truncate font-os-sans text-[12px] text-os-muted">{note ?? 'If the page stays blank, the site refuses to be shown in a window. Use Open in the default browser.'}</p>
        </div>
      </motion.div>

      {!win.maximised &&
        EDGES.map(({ edge, cls }) => <div key={edge} onPointerDown={(e) => begin(e, edge)} className={cx('absolute z-10', cls)} aria-hidden />)}
    </div>
  );
}

/** Every open floating window. Mounted once, at the root of the shell. */
export function FloatingWindows() {
  const wins = useWindows();
  return (
    <>
      {wins.map((w) => (
        <WindowFrame key={w.id} win={w} />
      ))}
    </>
  );
}
