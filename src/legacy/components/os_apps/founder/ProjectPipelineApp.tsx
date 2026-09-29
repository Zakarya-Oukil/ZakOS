import React, { useState } from 'react';
import { Briefcase, CheckCircle2, Clock, Plus, ArrowRight } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface ProjectPipelineAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

export const ProjectPipelineApp: React.FC<ProjectPipelineAppProps> = () => {
  const projects = [
    { name: 'ZakOS v2.0 Multi-Desktop', stage: 'In Progress', progress: 95, lead: 'Daedalus' },
    { name: 'eJPT Lab Assessment Mastery', stage: 'Completed', progress: 100, lead: 'Athena' },
    { name: 'Zak\'s Spider Recon Engine', stage: 'Active', progress: 80, lead: 'Ares' },
    { name: 'Consulat Algérie Djeddah Platform', stage: 'Operational', progress: 90, lead: 'Zakarya' }
  ];

  return (
    <div className="h-full flex flex-col p-4 bg-[#080808] text-zinc-200 font-sans">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-white" />
          <span className="text-xs font-mono font-bold text-white uppercase">Active Projects & Engineering Pipeline</span>
        </div>
        <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
          4 Tracked Initiatives
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 font-mono text-xs">
        {projects.map((p) => (
          <div key={p.name} className="p-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-white text-sm">{p.name}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                p.stage === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' :
                p.stage === 'In Progress' ? 'bg-cyan-500/20 text-cyan-400' :
                'bg-purple-500/20 text-purple-400'
              }`}>
                {p.stage}
              </span>
            </div>

            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-2">
              <div
                className="bg-white h-full transition-all duration-500"
                style={{ width: `${p.progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Lead Agent: <strong className="text-zinc-200">{p.lead}</strong></span>
              <span>{p.progress}% Complete</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
