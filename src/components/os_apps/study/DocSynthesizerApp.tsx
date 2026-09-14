import React, { useState } from 'react';
import { FileUp, Sparkles, BookOpen, Layers, CheckCircle, Download, FileText } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface DocSynthesizerAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

export const DocSynthesizerApp: React.FC<DocSynthesizerAppProps> = () => {
  const [docTitle, setDocTitle] = useState('INE_eJPT_Penetration_Testing_Cheatsheet.pdf');
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<string>(`# Synthesis: DMZ Penetration Testing & Routing Methodology

### 1. Dual-Homed vs. Single-Homed Host Verification
- **Windows Target Identification**: Execute DCE/RPC protocol sequence dumps (port 135) to inspect bound network interfaces without requiring high-privilege credentials.
- **Linux Target Identification**: Check active network adapters with \`ip a\` and routing tables with \`route -n\`. Distinguish local Docker bridge subnets (\`172.17.0.1/16\`) from physical multi-homed interfaces.

### 2. Multi-Stage Pivoting Configuration
- **Pivot Establishment**:
  \`\`\`bash
  # Inside active Meterpreter on pivot host:
  route add 192.168.0.0 255.255.255.0 <session_id>
  \`\`\`
- **Traffic Routing**: Auxiliary scanners and exploit modules will seamlessly traverse the Meterpreter tunnel into the internal target enclave.
`);

  const handleSynthesize = () => {
    soundEngine.playClick();
    setIsProcessing(true);
    setTimeout(() => {
      soundEngine.playCyberPing();
      setIsProcessing(false);
    }, 1200);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#0a0614] text-zinc-200 font-sans">
      {/* Upload / Doc Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-mono font-bold text-white uppercase">Document Synthesizer & Mental Models</span>
        </div>
        <button
          onClick={handleSynthesize}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-mono font-bold transition-all shadow-[0_0_12px_rgba(168,85,247,0.2)] disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isProcessing ? 'Synthesizing...' : 'Generate Cheat Sheet'}</span>
        </button>
      </div>

      {/* Selected File Card */}
      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 mb-3">
        <div className="flex items-center gap-2.5 font-mono text-xs">
          <FileText className="w-4 h-4 text-purple-400" />
          <span className="text-white font-medium">{docTitle}</span>
          <span className="text-[10px] text-zinc-500">2.4 MB • 42 Pages</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
          Ready
        </span>
      </div>

      {/* Output Content */}
      <div className="flex-1 overflow-y-auto rounded-xl bg-black/40 border border-white/10 p-4 font-mono text-xs text-zinc-300 leading-relaxed select-text whitespace-pre-wrap">
        {summary}
      </div>
    </div>
  );
};
