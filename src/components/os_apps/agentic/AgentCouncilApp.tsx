import React from 'react';
import { Bot, Shield, BookOpen, Cpu, HardDrive, Sparkles, CheckCircle } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface AgentCouncilAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

export const AgentCouncilApp: React.FC<AgentCouncilAppProps> = () => {
  const agents = [
    {
      name: 'Athena',
      role: 'Chief Synthesizer & Knowledge Architect',
      status: 'Online',
      model: 'Gemini 3.7 Flash',
      task: 'Synthesizing eJPT lab findings into structured knowledge vault',
      color: 'text-purple-400',
      bg: 'bg-purple-500/20 border-purple-500/30'
    },
    {
      name: 'Daedalus',
      role: 'Senior Systems & Fullstack Engineer',
      status: 'Active',
      model: 'DeepSeek Coder V2 (Ollama)',
      task: 'Architecting ZakOS v2.0 multi-desktop window manager',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/20 border-emerald-500/30'
    },
    {
      name: 'Ares',
      role: 'Offensive Security & Pentest Specialist',
      status: 'Scanning',
      model: 'DeepSeek R1 8B (Ollama)',
      task: 'Running Spider recon on DMZ 192.168.100.0/24 subnet',
      color: 'text-red-400',
      bg: 'bg-red-500/20 border-red-500/30'
    },
    {
      name: 'Socrates',
      role: 'Master Philosophical & Technical Mentor',
      status: 'Ready',
      model: 'Gemini 2.5 Flash',
      task: 'Preparing oral examination questions for study session',
      color: 'text-amber-400',
      bg: 'bg-amber-500/20 border-amber-500/30'
    },
    {
      name: 'Memex',
      role: 'Memory Governance & Vault Custodian',
      status: 'Syncing',
      model: 'Qwen 2.5 14B (Ollama)',
      task: 'Managing Optimal Engine truth pipeline for 123 vault notes',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/20 border-cyan-500/30'
    }
  ];

  return (
    <div className="h-full flex flex-col p-4 bg-[#050914] text-zinc-200 font-sans">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold text-white uppercase">The Agent Council // Active Roster</span>
        </div>
        <span className="text-[10px] font-mono text-cyan-300 font-bold bg-cyan-500/20 px-2 py-0.5 rounded">
          5 Autonomous Runtimes
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 font-mono text-xs">
        {agents.map((agent) => (
          <div key={agent.name} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/30 transition-all">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full bg-cyan-400 animate-pulse`} />
                <span className="font-bold text-white text-sm">{agent.name}</span>
                <span className="text-zinc-400 text-xs font-normal">• {agent.role}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${agent.bg} ${agent.color}`}>
                {agent.model}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 bg-black/40 p-2 rounded-lg border border-white/5 mt-2">
              <span className="text-zinc-500">Current Task:</span> <span className="text-zinc-200">{agent.task}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
