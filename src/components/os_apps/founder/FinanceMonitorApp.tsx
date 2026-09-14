import React from 'react';
import { DollarSign, Server, CreditCard, TrendingUp, Cpu, HardDrive } from 'lucide-react';

interface FinanceMonitorAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

export const FinanceMonitorApp: React.FC<FinanceMonitorAppProps> = () => {
  const expenses = [
    { service: 'Google Cloud Platform (Gemini 2.5/3.7)', type: 'AI Inference', cost: '$12.40 / mo', status: 'Optimal' },
    { service: 'Local GPU Workstation (RTX 2070 / Ollama)', type: 'Local Compute', cost: '$0.00 / mo', status: 'Free' },
    { service: 'Domain & Vercel / Railway Hosting', type: 'Infrastructure', cost: '$20.00 / mo', status: 'Active' },
    { service: 'INE / eJPT Penetration Testing Labs', type: 'Education & Certs', cost: '$39.00 / mo', status: 'Subscribed' }
  ];

  return (
    <div className="h-full flex flex-col p-4 bg-[#080808] text-zinc-200 font-sans">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-white" />
          <span className="text-xs font-mono font-bold text-white uppercase">
            Finances & Infrastructure Cost Matrix
          </span>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded">
          Runway: 24+ Months
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 font-mono text-xs">
        {expenses.map((e) => (
          <div key={e.service} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
            <div>
              <div className="font-bold text-white text-sm">{e.service}</div>
              <div className="text-[10px] text-zinc-400">{e.type}</div>
            </div>
            <div className="text-right">
              <div className="text-white font-bold">{e.cost}</div>
              <div className="text-[10px] text-zinc-500">{e.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
