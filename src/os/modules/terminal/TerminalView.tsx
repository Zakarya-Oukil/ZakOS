import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

type Phase = 'connecting' | 'ready' | 'closed';

interface TerminalViewProps {
  /** A shell the server already owns. The view attaches to it and gets its recent output replayed. */
  sessionId: string;
  active: boolean;
  /** Called when the shell process ends or the server no longer knows this terminal. */
  onEnded?: (why: { exitCode?: number; gone?: boolean }) => void;
}

const DARK_THEME = {
  background: '#0a1513',
  foreground: '#e6eaf0',
  cursor: '#ff6a3d',
  cursorAccent: '#0a1513',
  selectionBackground: 'rgba(255, 106, 61, 0.28)',
  black: '#171b21',
  red: '#ff6b6b',
  green: '#7fd6a0',
  yellow: '#f2b544',
  blue: '#7aa7ff',
  magenta: '#c49bff',
  cyan: '#4fd1c5',
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

const LIGHT_THEME = {
  ...DARK_THEME,
  background: '#f6f8f4',
  foreground: '#14231f',
  cursor: '#b83a12',
  cursorAccent: '#f6f8f4',
  selectionBackground: 'rgba(184, 58, 18, 0.22)',
  black: '#14231f',
  white: '#55695f',
  red: '#c42b2b',
  green: '#4d7a12',
  yellow: '#8a6100',
  blue: '#2a5fb5',
  magenta: '#7b3fa0',
  cyan: '#0b7a75',
  brightBlack: '#55695f',
  brightRed: '#a31f1f',
  brightGreen: '#2f6b1a',
  brightYellow: '#7a5200',
  brightBlue: '#1f4aa8',
  brightMagenta: '#7a2f9a',
  brightCyan: '#07605c',
  brightWhite: '#14231f',
};

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? LIGHT_THEME : DARK_THEME;
}

export function TerminalView({ sessionId, active, onEnded }: TerminalViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const [phase, setPhase] = useState<Phase>('connecting');
  const [note, setNote] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

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
      theme: currentTheme(),
      allowProposedApi: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    termRef.current = term;
    const themeObserver = new MutationObserver(() => {
      term.options.theme = currentTheme();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    fitRef.current = fit;
    try {
      fit.fit();
    } catch {
      /* hidden tab: fitted when it becomes active */
    }

    setPhase('connecting');
    setNote(null);
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/pty?${new URLSearchParams({ session: sessionId })}`);
    let gone = false;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'ready') {
          setPhase('ready');
          // The server keeps one size per shell, so tell it how big this view is.
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        } else if (msg.type === 'output') {
          term.write(msg.data);
        } else if (msg.type === 'exit') {
          setNote(`The shell exited with code ${msg.code}. Close this tab or open a new terminal.`);
          onEndedRef.current?.({ exitCode: msg.code });
        } else if (msg.type === 'error') {
          gone = true;
          setNote(msg.message);
          onEndedRef.current?.({ gone: true });
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
      themeObserver.disconnect();
      dataSub.dispose();
      resizeSub.dispose();
      ws.onclose = null;
      // Closing the socket only detaches: the shell keeps running on the server.
      ws.close();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      void gone;
    };
  }, [sessionId, attempt]);

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

  const reconnect = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <div className="relative h-full w-full bg-os-bg p-2">
      <div ref={host} className="h-full w-full" />
      {(phase === 'closed' || phase === 'connecting' || note) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-[var(--os-radius)] border border-os-line bg-os-surface px-3 py-2 text-sm" role="status">
            <span className="text-os-muted">{note ?? (phase === 'connecting' ? 'Connecting' : 'Terminal disconnected.')}</span>
            {phase === 'closed' && !note && (
              <button
                type="button"
                onClick={reconnect}
                className="rounded-[var(--os-radius-sm)] border border-os-line px-2 py-0.5 text-os-text hover:border-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
