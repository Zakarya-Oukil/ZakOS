import React from 'react';
import { JarvisCrewSuite } from '../../agents/JarvisCrewSuite';
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
    <div className="h-full flex flex-col bg-[#050914] text-zinc-200 overflow-hidden">
      <JarvisCrewSuite />
    </div>
  );
};
