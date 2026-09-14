import React, { useState } from 'react';
import { Box, Play, Square, RotateCw, Activity, Terminal, Trash2, Plus, Server, CheckCircle2, Cpu } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface DockerFleetAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

interface ContainerItem {
  id: string;
  name: string;
  image: string;
  port: string;
  status: 'running' | 'stopped';
  cpu: number; // percentage
  memory: string;
  uptime: string;
  logs: string[];
}

export const DockerFleetApp: React.FC<DockerFleetAppProps> = () => {
  const [containers, setContainers] = useState<ContainerItem[]>([
    { 
      id: '3a8f192b', 
      name: 'opensmtpd-lab-25', 
      image: 'opensmtpd:6.6.1p1', 
      port: '25:25/tcp', 
      status: 'running', 
      cpu: 12, 
      memory: '38 MB', 
      uptime: '4h 12m',
      logs: [
        '[smtpd] version 6.6.1p1 starting...',
        '[smtpd] listening on 0.0.0.0:25',
        '[smtpd] mail queue initialized (0 pending)',
        '[audit] inbound connection from 192.168.100.1'
      ]
    },
    { 
      id: '9f2c810a', 
      name: 'zakos-daemon-backend', 
      image: 'node:22-alpine', 
      port: '4000:4000/tcp', 
      status: 'running', 
      cpu: 28, 
      memory: '84 MB', 
      uptime: '2h 45m',
      logs: [
        '[ZakOS-Server] Express API live on port 4000',
        '[VaultEngine] Indexed 155 notes in C:\\Users\\Zakar\\Documents\\Obsidian\\My_Vault',
        '[ModelRouter] Gemini 2.5 Flash connected (avg latency 210ms)'
      ]
    },
    { 
      id: '110e82ba', 
      name: 'consulat-dev-server', 
      image: 'tsx/express', 
      port: '3001:3001/tcp', 
      status: 'running', 
      cpu: 8, 
      memory: '54 MB', 
      uptime: '1h 20m',
      logs: [
        '[EtatCivil] Service ready on port 3001',
        '[DB] MariaDB connection pool initialized'
      ]
    },
    { 
      id: 'bb42901f', 
      name: 'mariadb-db-52', 
      image: 'mariadb:10.3.34', 
      port: '3306:3306/tcp', 
      status: 'running', 
      cpu: 18, 
      memory: '142 MB', 
      uptime: '6h 50m',
      logs: [
        '[mysqld] ready for connections. Version: 10.3.34-MariaDB',
        '[mysqld] socket: /run/mysqld/mysqld.sock port: 3306'
      ]
    }
  ]);

  const [selectedContainerId, setSelectedContainerId] = useState<string>('9f2c810a');
  const selectedContainer = containers.find(c => c.id === selectedContainerId) || containers[0];

  const toggleContainer = (id: string) => {
    soundEngine.playClick();
    setContainers(prev => prev.map(c => c.id === id ? {
      ...c,
      status: c.status === 'running' ? 'stopped' : 'running',
      logs: [...c.logs, `[system] container state toggled to ${c.status === 'running' ? 'stopped' : 'running'}`]
    } : c));
  };

  const restartContainer = (id: string) => {
    soundEngine.playClick();
    setContainers(prev => prev.map(c => c.id === id ? {
      ...c,
      status: 'running',
      logs: [...c.logs, '[system] SIGTERM received. Graceful restart in progress...', '[system] container restarted successfully.']
    } : c));
    setTimeout(() => soundEngine.playCyberPing(), 600);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#080d0a] text-zinc-200 font-sans">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <Box className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Docker Fleet & Container Cockpit</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span className="text-emerald-400 font-bold bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
            {containers.filter(c => c.status === 'running').length}/{containers.length} RUNNING
          </span>
        </div>
      </div>

      {/* Main Split Layout: Container List + Live Logs */}
      <div className="flex-1 flex gap-3 overflow-hidden">
        {/* Container Cards List */}
        <div className="w-1/2 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
          {containers.map((c) => (
            <div 
              key={c.id} 
              onClick={() => {
                soundEngine.playClick();
                setSelectedContainerId(c.id);
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                selectedContainerId === c.id 
                  ? 'bg-emerald-500/15 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                  : 'bg-black/50 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${c.status === 'running' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-zinc-600'}`} />
                  <span className="font-bold text-white text-xs">{c.name}</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">{c.id}</span>
              </div>

              <div className="text-[11px] text-zinc-400 mb-2">
                <div>Image: <strong className="text-zinc-200">{c.image}</strong></div>
                <div>Ports: <span className="text-cyan-400">{c.port}</span> • Uptime: {c.uptime}</div>
              </div>

              {/* Resource Bars */}
              <div className="space-y-1 pt-1 border-t border-white/5 text-[10px]">
                <div className="flex justify-between text-zinc-400">
                  <span>CPU ({c.cpu}%)</span>
                  <span>RAM ({c.memory})</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${c.cpu * 2}%` }} />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-1.5 mt-2.5 pt-2 border-t border-white/5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    restartContainer(c.id);
                  }}
                  className="px-2 py-1 rounded bg-white/5 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-300 text-[10px] font-bold flex items-center gap-1 transition-all"
                >
                  <RotateCw className="w-3 h-3" /> Restart
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleContainer(c.id);
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${
                    c.status === 'running' 
                      ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' 
                      : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                  }`}
                >
                  {c.status === 'running' ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                  {c.status === 'running' ? 'Stop' : 'Start'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Live Container Logs Stream */}
        <div className="w-1/2 flex flex-col rounded-xl bg-black/80 border border-white/10 p-3 overflow-hidden font-mono text-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-zinc-400">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-white font-bold">{selectedContainer.name} (Live Logs)</span>
            </div>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              STREAMING
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 text-[11px] text-zinc-300 custom-scrollbar pr-1 select-text">
            {selectedContainer.logs.map((log, idx) => (
              <div key={idx} className="leading-relaxed">
                <span className="text-zinc-600 mr-2">[{idx + 1}]</span>
                <span className={log.includes('error') ? 'text-red-400' : log.includes('warning') ? 'text-amber-400' : 'text-emerald-300/90'}>
                  {log}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

