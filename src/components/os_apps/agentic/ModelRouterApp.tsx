import React, { useState } from 'react';
import { Sparkles, Server, Check, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface ModelRouterAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

export const ModelRouterApp: React.FC<ModelRouterAppProps> = () => {
  const [primaryModel, setPrimaryModel] = useState('Gemini 2.5 Flash');
  const [fallbackModel, setFallbackModel] = useState('qwen2.5:14b (Ollama)');
  const [autoFallback, setAutoFallback] = useState(true);

  const cloudModels = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', latency: '240 ms', tokens: '1M Context', status: 'Optimal' },
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', latency: '290 ms', tokens: '2M Context', status: 'Optimal' }
  ];

  const localOllamaModels = [
    { id: 'qwen2.5:14b', name: 'qwen2.5:14b', vram: '9.2 GB', speed: '48 tok/s', status: 'Local (11434)' },
    { id: 'deepseek-coder-v2:latest', name: 'deepseek-coder-v2:latest', vram: '8.9 GB', speed: '42 tok/s', status: 'Local (11434)' },
    { id: 'deepseek-r1:8b', name: 'deepseek-r1:8b', vram: '5.6 GB', speed: '64 tok/s', status: 'Local (11434)' },
    { id: 'llama3:8b', name: 'llama3:8b', vram: '5.4 GB', speed: '68 tok/s', status: 'Local (11434)' }
  ];

  return (
    <div className="h-full flex flex-col p-4 bg-[#050a16] text-zinc-200 font-sans">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold text-white uppercase">Universal Model Router & Ollama Switchboard</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
            ENDPOINT: http://localhost:11434
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 font-mono text-xs">
        {/* Active Routing Topology */}
        <div className="p-3.5 rounded-xl bg-black/40 border border-cyan-500/30 flex items-center justify-between shadow-[0_0_20px_rgba(6,182,212,0.15)]">
          <div>
            <div className="text-[10px] text-zinc-500 uppercase">Active Primary Cloud</div>
            <div className="text-sm font-bold text-cyan-400">{primaryModel}</div>
          </div>
          <ArrowRight className="w-5 h-5 text-zinc-500" />
          <div>
            <div className="text-[10px] text-zinc-500 uppercase">Offline Fallback Engine</div>
            <div className="text-sm font-bold text-emerald-400">{fallbackModel}</div>
          </div>
          <div>
            <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/40">
              ZERO DOWNTIME
            </span>
          </div>
        </div>

        {/* Primary Cloud Models */}
        <div>
          <span className="text-[10px] text-zinc-400 uppercase font-bold block mb-2">Google Cloud AI Tier</span>
          <div className="grid grid-cols-2 gap-2">
            {cloudModels.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  soundEngine.playClick();
                  setPrimaryModel(m.name);
                }}
                className={`p-3 rounded-xl text-left border transition-all ${
                  primaryModel === m.name
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                    : 'bg-white/5 border-white/5 hover:bg-white/10 text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-1">
                  <span>{m.name}</span>
                  <span className="text-[10px] text-cyan-400">{m.status}</span>
                </div>
                <div className="text-[10px] text-zinc-500">{m.latency} • {m.tokens}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Local Ollama Models */}
        <div>
          <span className="text-[10px] text-zinc-400 uppercase font-bold block mb-2">Local Ollama Engines (No API Key Required)</span>
          <div className="grid grid-cols-2 gap-2">
            {localOllamaModels.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  soundEngine.playClick();
                  setFallbackModel(m.name);
                }}
                className={`p-3 rounded-xl text-left border transition-all ${
                  fallbackModel === m.name
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'bg-white/5 border-white/5 hover:bg-white/10 text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-1">
                  <span className="text-emerald-300">{m.name}</span>
                  <span className="text-[10px] text-zinc-500">{m.status}</span>
                </div>
                <div className="text-[10px] text-zinc-500">VRAM: {m.vram} • Speed: {m.speed}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
