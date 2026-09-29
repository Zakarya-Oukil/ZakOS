import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ProfileThemeTokens } from '../types/profileTypes';

interface SshTerminalPaneProps {
  theme: ProfileThemeTokens;
  initialTarget?: 'LOCAL' | 'WSL2' | 'CUSTOM';
}

export const SshTerminalPane: React.FC<SshTerminalPaneProps> = ({
  theme,
  initialTarget = 'LOCAL',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [status, setStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('DISCONNECTED');
  const [statusMsg, setStatusMsg] = useState<string>('Ready to connect');
  const [targetType, setTargetType] = useState<'LOCAL' | 'WSL2' | 'CUSTOM'>(initialTarget);
  const [customHost, setCustomHost] = useState<string>('localhost');
  const [customPort, setCustomPort] = useState<number>(22);
  const [customUser, setCustomUser] = useState<string>('root');
  const [customPass, setCustomPass] = useState<string>('');
  const [showConfig, setShowConfig] = useState<boolean>(false);

  // Buffer for "Send to Vault" feature
  const outputBufferRef = useRef<string[]>([]);

  const connectTerminal = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus('CONNECTING');
    setStatusMsg('Opening WebSocket tunnel...');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Port 4000 backend or current host port
    const wsUrl = `${protocol}//${window.location.hostname}:4000/ws/ssh`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('CONNECTING');
      setStatusMsg('Negotiating session...');

      // Send connection credentials
      const cols = termRef.current?.cols || 80;
      const rows = termRef.current?.rows || 24;

      if (targetType === 'LOCAL') {
        ws.send(JSON.stringify({
          type: 'ssh:connect',
          payload: { useLocalFallback: true },
          cols,
          rows,
        }));
      } else if (targetType === 'WSL2') {
        ws.send(JSON.stringify({
          type: 'ssh:connect',
          payload: {
            host: '127.0.0.1',
            port: 22,
            username: customUser || 'user',
            password: customPass || undefined,
          },
          cols,
          rows,
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'ssh:connect',
          payload: {
            host: customHost,
            port: customPort,
            username: customUser,
            password: customPass,
          },
          cols,
          rows,
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'ssh:data') {
          termRef.current?.write(msg.data);
          outputBufferRef.current.push(msg.data);
          if (outputBufferRef.current.length > 2000) outputBufferRef.current.shift();
        } else if (msg.type === 'ssh:status') {
          setStatus(msg.status);
          setStatusMsg(msg.message || msg.status);
        } else if (msg.type === 'ssh:error') {
          setStatus('ERROR');
          setStatusMsg(msg.error || 'Connection error');
          termRef.current?.write(`\r\n\x1b[31m[ERROR]\x1b[0m ${msg.error}\r\n`);
        }
      } catch (e) {
        termRef.current?.write(event.data);
      }
    };

    ws.onclose = () => {
      setStatus('DISCONNECTED');
      setStatusMsg('Session terminated');
    };

    ws.onerror = () => {
      setStatus('ERROR');
      setStatusMsg('WebSocket tunnel failure (port 4000 unreachable)');
    };
  };

  const disconnectTerminal = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'ssh:disconnect' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('DISCONNECTED');
    setStatusMsg('Disconnected');
  };

  // Pipe output to Obsidian vault
  const sendToVault = async () => {
    const rawText = outputBufferRef.current.join('').replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    try {
      const filename = `Terminal-Log-${Date.now()}.md`;
      const res = await fetch('/api/vault/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `Terminal-Logs/${filename}`,
          content: `# Terminal Session Log (${new Date().toLocaleString()})\n\n\`\`\`bash\n${rawText.slice(-4000)}\n\`\`\`\n`,
        }),
      });
      if (res.ok) {
        termRef.current?.write('\r\n\x1b[32m[Vault Bridge]\x1b[0m Output saved to Obsidian!\r\n');
      }
    } catch (e) {
      console.warn('Could not save to vault', e);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Build xterm terminal instance matching Context Profile
    const isCyber = theme.id === 'CYBER';
    const isStudy = theme.id === 'STUDY';

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: theme.bgPrimary,
        foreground: isCyber ? '#f8fafc' : isStudy ? '#e2e8f0' : '#fafafa',
        cursor: theme.accentPrimary,
        cursorAccent: '#000000',
        selectionBackground: `${theme.accentPrimary}40`,
        black: '#000000',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#f1f5f9',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Send keystrokes to WebSocket
    term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ssh:input', data }));
      }
    });

    // Auto-fit on window resize with debounce
    let resizeTimer: any = null;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        try {
          fitAddon.fit();
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'ssh:resize',
              cols: term.cols,
              rows: term.rows,
            }));
          }
        } catch (e) {}
      }, 80);
    };

    window.addEventListener('resize', handleResize);

    // Initial connection to local shell
    connectTerminal();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (wsRef.current) {
        wsRef.current.close();
      }
      term.dispose();
    };
  }, [theme.id]);

  return (
    <div className="flex flex-col w-full h-full font-mono text-xs overflow-hidden select-none">
      {/* Interactive Terminal Toolbar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b text-[10px] shrink-0"
        style={{
          backgroundColor: theme.bgSecondary,
          borderColor: theme.borderPrimary,
        }}
      >
        {/* Left: Status and Target selector */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'CONNECTED'
                ? 'bg-emerald-400 animate-pulse'
                : status === 'CONNECTING'
                ? 'bg-amber-400 animate-ping'
                : 'bg-rose-500'
            }`}
          />
          <span className="font-bold text-white uppercase">{status}</span>
          <span className="text-neutral-500">•</span>
          <span className="text-neutral-400 truncate max-w-xs">{statusMsg}</span>
        </div>

        {/* Right: Quick Target and Actions */}
        <div className="flex items-center gap-2">
          <select
            value={targetType}
            onChange={(e) => {
              const val = e.target.value as any;
              setTargetType(val);
              if (val === 'CUSTOM') setShowConfig(true);
            }}
            className="px-1.5 py-0.5 rounded bg-black/60 border text-[10px] focus:outline-none cursor-pointer"
            style={{ borderColor: theme.borderPrimary, color: theme.accentPrimary }}
          >
            <option value="LOCAL">Local Host Shell</option>
            <option value="WSL2">WSL2 (127.0.0.1:22)</option>
            <option value="CUSTOM">Custom Remote SSH...</option>
          </select>

          {status === 'CONNECTED' ? (
            <button
              onClick={disconnectTerminal}
              className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-700/40 text-[9px] font-bold cursor-pointer"
            >
              DISCONNECT
            </button>
          ) : (
            <button
              onClick={connectTerminal}
              className="px-2 py-0.5 rounded bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/40 text-[9px] font-bold cursor-pointer"
            >
              CONNECT
            </button>
          )}

          <button
            onClick={sendToVault}
            className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-slate-200 text-[9px] cursor-pointer"
            title="Export last 4KB buffer to Obsidian note"
          >
            ➔ VAULT
          </button>
        </div>
      </div>

      {/* Custom Remote Host Configuration Drawer (Collapsible) */}
      {showConfig && targetType === 'CUSTOM' && (
        <div
          className="p-2 border-b grid grid-cols-5 gap-2 text-[10px] items-center"
          style={{ backgroundColor: theme.bgPanel, borderColor: theme.borderPrimary }}
        >
          <input
            type="text"
            placeholder="Host (e.g. 192.168.1.50)"
            value={customHost}
            onChange={(e) => setCustomHost(e.target.value)}
            className="px-2 py-1 rounded bg-black border border-neutral-700 text-white"
          />
          <input
            type="number"
            placeholder="Port"
            value={customPort}
            onChange={(e) => setCustomPort(Number(e.target.value))}
            className="px-2 py-1 rounded bg-black border border-neutral-700 text-white"
          />
          <input
            type="text"
            placeholder="User (root)"
            value={customUser}
            onChange={(e) => setCustomUser(e.target.value)}
            className="px-2 py-1 rounded bg-black border border-neutral-700 text-white"
          />
          <input
            type="password"
            placeholder="Password / Key"
            value={customPass}
            onChange={(e) => setCustomPass(e.target.value)}
            className="px-2 py-1 rounded bg-black border border-neutral-700 text-white"
          />
          <button
            onClick={() => {
              setShowConfig(false);
              connectTerminal();
            }}
            className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-black font-bold cursor-pointer"
          >
            SAVE &amp; CONNECT
          </button>
        </div>
      )}

      {/* Real Canvas Terminal Mount */}
      <div
        ref={containerRef}
        className="flex-1 w-full h-full p-2 overflow-hidden"
        style={{ backgroundColor: theme.bgPrimary }}
      />
    </div>
  );
};
