import React, { useState } from 'react';
import { Brain, ArrowRight, ShieldCheck, FileCheck, Database, CheckCircle2 } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface GbrainMemoryAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

export const GbrainMemoryApp: React.FC<GbrainMemoryAppProps> = () => {
  const [activeStage, setActiveStage] = useState<'all' | 'signal' | 'claim' | 'fact' | 'memory'>('all');

  const lifecycle = [
    { stage: 'Source', desc: 'Raw markdown files in Obsidian Vault & terminal stdout logs', count: 123 },
    { stage: 'Signal', desc: 'Unprocessed discoveries and agent scan detections', count: 42 },
    { stage: 'Claim', desc: 'Hypotheses pending verification & validation', count: 18 },
    { stage: 'Fact', desc: 'Verified technical artifacts & verified credentials', count: 64 },
    { stage: 'Memory', desc: 'Immutable long-term knowledge embedded for all agent runtimes', count: 210 }
  ];

  return (
    <div className="h-full flex flex-col p-4 bg-[#080808] text-zinc-200 font-sans">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-white" />
          <span className="text-xs font-mono font-bold text-white uppercase">
            G-Brain & Optimal Engine // Memory Lifecycle
          </span>
        </div>
        <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
          Governed Epistemic Pipeline
        </span>
      </div>

      {/* Visual Pipeline Stages */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {lifecycle.map((l, idx) => (
          <div key={l.stage} className="p-3 rounded-xl bg-white/5 border border-white/5 text-center font-mono">
            <div className="text-[10px] text-zinc-500 uppercase">{l.stage}</div>
            <div className="text-lg font-black text-white my-0.5">{l.count}</div>
            <div className="text-[9px] text-zinc-400 line-clamp-2">{l.desc}</div>
          </div>
        ))}
      </div>

      {/* Verified Facts & Memories */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
        <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">
          Active Promoted Long-Term Memories
        </span>
        <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="font-bold text-white">eJPT Network Scope & Target Dossiers</div>
              <div className="text-[10px] text-zinc-400">Validated DMZ (.50 - .67) with .67 as dual-homed Linux Gateway</div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
            PROMOTED FACT
          </span>
        </div>

        <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="font-bold text-white">Universal Model Router Failover Rules</div>
              <div className="text-[10px] text-zinc-400">Automatic switchover from Gemini API to Ollama local endpoint</div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
            DURABLE MEMORY
          </span>
        </div>
      </div>
    </div>
  );
};
