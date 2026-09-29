import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

type Phase = 'connecting' | 'ready' | 'closed';

interface TerminalViewProps {
  cwd: string;
  active: boolean;
  /** Reports the shell's folder once the server confirms the session. */
  onReady?: (cwd: string) => void;
}

const THEME = {
  background: '#0b0d10',
  foreground: '#e6eaf0',
  cursor: '#5fe3f0',
  cursorAccent: '#0b0d10',
  selectionBackground: 'rgba(95, 227, 240, 0.28)',
  black: '#171b21',
  red: '#ff6b6b',
  green: '#7fd6a0',
  yellow: '#f2b544',
  blue: '#7aa7ff',
  magenta: '#c49bff',
  cyan: '#5fe3f0',
  white: '#c9d1dc',
  brightBlack: '#5b6472',
  brightRed: '#ff8f8f',
  brightGreen: '#9be8b6',
  brightYellow: '#ffd07a',
  brightBlue: '#a0c0ff',
  brightMagenta: '#d9bcff',
  brightCyan: '#8fefff',
  brightWhite: '#f4f7fb',
};

export function TerminalView({ cwd, active, onReady }: TerminalViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [phase, setPhase] = useState<Phase>('connecting');
  const [note, setNote] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const term = new Terminal({
      // Nerd Font names first so prompt icons (oh-my-posh, starship) render when one is installed.
      fontFamily:
        "'JetBrainsMono Nerd Font', 'CaskaydiaCove Nerd Font', 'MesloLGS NF', 'FiraCode Nerd Font', 'JetBrains Mono', ui-monospace, Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      scrollback: 5000,
      theme: THEME,
      allowProposedApi: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    termRef.current = term;
    fitRef.current = fit;
    try {
      fit.fit();
    } catch {
      /* hidden tab: fitted when it becomes active */
    }

    setPhase('connecting');
    setNote(null);
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const params = new URLSearchParams({ cols: String(term.cols), rows: String(term.rows) });
    if (cwd) params.set('cwd', cwd);
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/pty?${params}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'ready') {
          setPhase('ready');
          onReadyRef.current?.(msg.cwd);
        } else if (msg.type === 'output') {
          term.write(msg.data);
        } else if (msg.type === 'exit') {
          setNote(`Shell exited with code ${msg.code}.`);
        } else if (msg.type === 'error') {
          setNote(msg.message);
        }
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => setPhase('closed');
    ws.onerror = () => setNote((n) => n ?? 'Could not reach the terminal service.');

    const send = (payload: unknown) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
    };
    const dataSub = term.onData((data) => send({ type: 'input', data }));
    const resizeSub = term.onResize(({ cols, rows }) => send({ type: 'resize', cols, rows }));

    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        try {
          fit.fit();
        } catch {
          /* ignore transient layout errors */
        }
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      dataSub.dispose();
      resizeSub.dispose();
      ws.onclose = null;
      ws.close();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      wsRef.current = null;
    };
  }, [cwd, attempt]);

  // A background tab has no size; refit and focus when it comes forward.
  useEffect(() => {
    if (!active) return;
    const id = window.requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
      } catch {
        /* ignore */
      }
      termRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [active]);

  const restart = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <div className="relative h-full w-full bg-os-bg p-2">
      <div ref={host} className="h-full w-full" />
      {(phase === 'closed' || phase === 'connecting') && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-[var(--os-radius)] border border-os-line bg-os-surface px-3 py-2 text-sm" role="status">
            <span className="text-os-muted">{phase === 'connecting' ? 'Starting shell' : (note ?? 'Terminal disconnected.')}</span>
            {phase === 'closed' && (
              <button
                type="button"
                onClick={restart}
                className="rounded-[var(--os-radius-sm)] border border-os-line px-2 py-0.5 text-os-text hover:border-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
              >
                Restart
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
