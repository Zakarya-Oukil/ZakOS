import React, { useState } from 'react';
import { Box, Play, Square, RotateCw, Activity, Terminal } from 'lucide-react';
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
  cpu: string;
  memory: string;
}

export const DockerFleetApp: React.FC<DockerFleetAppProps> = () => {
  const [containers, setContainers] = useState<ContainerItem[]>([
    { id: '3a8f192b', name: 'opensmtpd-lab', image: 'opensmtpd:6.6.1p1', port: '25:25', status: 'running', cpu: '0.4%', memory: '24 MB' },
    { id: '9f2c810a', name: 'zakos-backend', image: 'node:22-alpine', port: '4000:4000', status: 'running', cpu: '1.2%', memory: '68 MB' },
    { id: '110e82ba', name: 'consulat-dev-server', image: 'tsx/express', port: '3001:3001', status: 'running', cpu: '0.8%', memory: '52 MB' },
    { id: 'bb42901f', name: 'mariadb-db-52', image: 'mariadb:10.3.34', port: '3306:3306', status: 'running', cpu: '0.9%', memory: '112 MB' }
  ]);

  const toggleContainer = (id: string) => {
    soundEngine.playClick();
    setContainers(prev => prev.map(c => c.id === id ? {
      ...c,
      status: c.status === 'running' ? 'stopped' : 'running'
    } : c));
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#080d0a] text-zinc-200 font-sans">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold text-white uppercase">Docker & Container Fleet Monitor</span>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded">
          {containers.filter(c => c.status === 'running').length} Active Services
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 font-mono text-xs">
        {containers.map((c) => (
          <div key={c.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full ${c.status === 'running' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-zinc-600'}`} />
              <div>
                <div className="font-bold text-white">{c.name}</div>
                <div className="text-[10px] text-zinc-400">{c.image} • Ports: {c.port}</div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-zinc-400">
              <div>CPU: <span className="text-emerald-300 font-bold">{c.cpu}</span></div>
              <div>RAM: <span className="text-emerald-300 font-bold">{c.memory}</span></div>
              <button
                onClick={() => toggleContainer(c.id)}
                className={`p-1.5 rounded-lg border transition-all ${
                  c.status === 'running'
                    ? 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                }`}
              >
                {c.status === 'running' ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
