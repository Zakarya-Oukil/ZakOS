import React, { useState } from 'react';
import { Compass, ZoomIn, ZoomOut, RotateCcw, Share2, Layers } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface UniverseGraphAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

export const UniverseGraphApp: React.FC<UniverseGraphAppProps> = () => {
  const [selectedNode, setSelectedNode] = useState<string | null>('eJPT Lab Assessment');

  const nodes = [
    { id: '1', name: 'Master Root', tier: 1, color: '#06b6d4' },
    { id: '2', name: 'EJPT — Root Overview', tier: 2, color: '#a855f7' },
    { id: '3', name: 'EJPT Labs — Hub', tier: 3, color: '#ef4444' },
    { id: '4', name: 'eJPT Lab Assessment', tier: 4, color: '#10b981' },
    { id: '5', name: 'Insecure File Upload', tier: 4, color: '#f59e0b' },
    { id: '6', name: 'Active Directory Enum', tier: 4, color: '#ec4899' },
    { id: '7', name: 'ZakOS v2 Architecture', tier: 2, color: '#3b82f6' }
  ];

  return (
    <div className="h-full flex flex-col p-4 bg-[#030712] text-zinc-200 font-sans relative overflow-hidden">
      {/* 3D Force Graph Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 z-10">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400 animate-spin" />
          <span className="text-xs font-mono font-bold text-white uppercase">3D Obsidian Knowledge Universe</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400">
          <span>123 Active Nodes</span>
          <span>•</span>
          <span className="text-cyan-400">Interactive WebGL</span>
        </div>
      </div>

      {/* Simulated 3D Force Visualizer Viewport */}
      <div className="flex-1 rounded-2xl bg-black/80 border border-white/10 relative flex items-center justify-center overflow-hidden">
        {/* Graph background grid */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.15),transparent_60%)] pointer-events-none" />
        
        {/* Dynamic Nodes */}
        <div className="relative w-full h-full flex items-center justify-center">
          {nodes.map((n, idx) => {
            const angle = (idx / nodes.length) * 2 * Math.PI;
            const radius = idx === 0 ? 0 : 130;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <div
                key={n.id}
                onClick={() => {
                  soundEngine.playClick();
                  setSelectedNode(n.name);
                }}
                style={{
                  transform: `translate(${x}px, ${y}px)`
                }}
                className={`absolute p-3 rounded-2xl border transition-all cursor-pointer select-none group ${
                  selectedNode === n.name
                    ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.4)] scale-110'
                    : 'bg-black/60 border-white/10 hover:border-white/30 hover:scale-105'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: n.color }} />
                  <span className="text-xs font-mono font-bold text-white whitespace-nowrap">{n.name}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Node Details Floating HUD */}
        {selectedNode && (
          <div className="absolute bottom-4 left-4 p-3 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 text-xs font-mono text-left z-20">
            <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Active Obsidian Node</span>
            <span className="text-cyan-300 font-bold">{selectedNode}</span>
          </div>
        )}
      </div>
    </div>
  );
};
