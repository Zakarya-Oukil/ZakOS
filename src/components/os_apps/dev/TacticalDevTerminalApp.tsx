import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Play, RotateCcw, Trash2, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface TacticalDevTerminalAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

interface CommandLog {
  command: string;
  output: string;
  status: 'success' | 'error' | 'running';
  time: string;
}

export const TacticalDevTerminalApp: React.FC<TacticalDevTerminalAppProps> = () => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [logs, setLogs] = useState<CommandLog[]>([
    {
      command: 'git status',
      output: 'On branch v2-multi-desktop\nAll legacy files backed up on legacy-v1\nWorking tree clean.',
      status: 'success',
      time: '04:11:15'
    },
    {
      command: 'docker ps',
      output: 'CONTAINER ID   IMAGE                 COMMAND                  STATUS          PORTS\n3a8f192b0c41   opensmtpd:6.6.1p1     "smtpd -d"               Up 4 hours      0.0.0.0:25->25/tcp',
      status: 'success',
      time: '04:11:22'
    }
  ]);
  const [isExecuting, setIsExecuting] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleExecute = async (cmdToRun?: string) => {
    const cmd = (cmdToRun || input).trim();
    if (!cmd || isExecuting) return;
    soundEngine.playClick();

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setHistory(prev => [cmd, ...prev]);
    setHistoryIdx(-1);
    setInput('');
    setIsExecuting(true);

    const newLog: CommandLog = {
      command: cmd,
      output: 'Executing PowerShell directive...',
      status: 'running',
      time: now
    };
    setLogs(prev => [...prev, newLog]);

    try {
      const res = await fetch('/api/ide/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, cwd: 'c:\\Users\\Zakar\\Documents\\Web_Dev\\Zak_OS' })
      });
      const data = await res.json();
      soundEngine.playCyberPing();
      setLogs(prev => prev.map((l, i) => i === prev.length - 1 ? {
        command: cmd,
        output: data.output || (data.success ? 'Done (Exit Code 0)' : 'Error: ' + data.error),
        status: data.success !== false ? 'success' : 'error',
        time: now
      } : l));
    } catch (err: any) {
      setLogs(prev => prev.map((l, i) => i === prev.length - 1 ? {
        command: cmd,
        output: 'Execution failed: ' + err.message,
        status: 'error',
        time: now
      } : l));
    } finally {
      setIsExecuting(false);
    }
  };

  const chips = ['git status', 'git branch', 'npm run build', 'docker ps', 'dir', 'nmap -sV -sC 192.168.100.52'];

  return (
    <div className="h-full flex flex-col p-4 bg-[#070c0a] text-zinc-200 font-mono text-xs">
      {/* Top Quick Execution Chips */}
      <div className="flex items-center gap-1.5 pb-3 mb-3 border-b border-white/10 overflow-x-auto select-none">
        <span className="text-[10px] text-zinc-500 uppercase font-bold mr-1">Directives:</span>
        {chips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleExecute(chip)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-300 border border-white/5 hover:border-emerald-500/40 text-[11px] whitespace-nowrap transition-all"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Output Log Stream */}
      <div className="flex-1 overflow-y-auto space-y-3 bg-black/60 rounded-xl p-3 border border-white/10 select-text">
        {logs.map((log, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-zinc-500">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">PS C:\Zak_OS&gt;</span>
                <span className="text-white font-bold">{log.command}</span>
              </div>
              <span>{log.time}</span>
            </div>
            <pre className={`p-2.5 rounded-lg text-[11px] whitespace-pre-wrap break-all leading-relaxed ${
              log.status === 'error' ? 'bg-red-950/30 text-red-300 border border-red-500/20' :
              log.status === 'running' ? 'bg-amber-950/30 text-amber-300 border border-amber-500/20 animate-pulse' :
              'bg-white/5 text-zinc-300'
            }`}>
              {log.output}
            </pre>
          </div>
        ))}
        <div ref={terminalEndRef} />
      </div>

      {/* Input Prompt */}
      <div className="flex items-center gap-2 mt-3 p-1.5 rounded-xl bg-black/80 border border-white/10 focus-within:border-emerald-500/50">
        <span className="text-emerald-400 font-bold px-2 select-none">&gt;</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleExecute();
            else if (e.key === 'ArrowUp') {
              if (history.length > 0 && historyIdx < history.length - 1) {
                const nextIdx = historyIdx + 1;
                setHistoryIdx(nextIdx);
                setInput(history[nextIdx]);
              }
            } else if (e.key === 'ArrowDown') {
              if (historyIdx > 0) {
                const nextIdx = historyIdx - 1;
                setHistoryIdx(nextIdx);
                setInput(history[nextIdx]);
              } else if (historyIdx === 0) {
                setHistoryIdx(-1);
                setInput('');
              }
            }
          }}
          placeholder="Execute PowerShell or terminal command..."
          className="flex-1 bg-transparent text-xs text-white focus:outline-none font-mono"
        />
        <button
          onClick={() => handleExecute()}
          disabled={!input.trim() || isExecuting}
          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all disabled:opacity-40"
        >
          {isExecuting ? 'Running...' : 'Execute'}
        </button>
      </div>
    </div>
  );
};
