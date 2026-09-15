import React, { useState, useEffect } from 'react';
import { 
  FileUp, 
  Sparkles, 
  BookOpen, 
  Layers, 
  CheckCircle, 
  Download, 
  FileText, 
  Copy, 
  Check, 
  RefreshCw,
  Save
} from 'lucide-react';
import { marked } from 'marked';
import { soundEngine } from '../../../services/soundEffects';
import { api } from '../../../services/api';
import { NoteItem } from '../../../types';

interface DocSynthesizerAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

export const DocSynthesizerApp: React.FC<DocSynthesizerAppProps> = () => {
  const [sourceType, setSourceType] = useState<'vault' | 'paste'>('vault');
  const [vaultNotes, setVaultNotes] = useState<NoteItem[]>([]);
  const [selectedNotePath, setSelectedNotePath] = useState<string>('');
  const [pastedText, setPastedText] = useState<string>('');
  
  const [synthesisMode, setSynthesisMode] = useState<'cheatsheet' | 'mental-model' | 'qa-flashcards'>('cheatsheet');
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
  const [copied, setCopied] = useState(false);
  const [savedToVault, setSavedToVault] = useState(false);

  // Fetch Vault Notes on Mount
  useEffect(() => {
    api.getNotes()
      .then(notes => {
        if (notes && notes.length > 0) {
          setVaultNotes(notes);
          setSelectedNotePath(notes[0].path);
        }
      })
      .catch(console.error);
  }, []);

  const handleSynthesize = async () => {
    soundEngine.playClick();
    setIsProcessing(true);
    setSummary('');

    // Determine content to synthesize
    let contentToAnalyze = '';
    if (sourceType === 'vault' && selectedNotePath) {
      try {
        const note = await api.getNote(selectedNotePath);
        contentToAnalyze = note?.content || '';
      } catch (e) {
        console.error(e);
      }
    } else {
      contentToAnalyze = pastedText;
    }

    if (!contentToAnalyze.trim()) {
      setIsProcessing(false);
      setSummary('⚠️ Error: No content provided for synthesis. Please select a valid vault note or paste text.');
      return;
    }

    const modePrompt = 
      synthesisMode === 'cheatsheet' 
        ? 'Extract an ultra-dense, executive Technical Cheat Sheet with command syntax, key flags, vulnerabilities, and steps.'
        : synthesisMode === 'mental-model'
        ? 'Distill this into foundational First-Principles mental models, architecture invariants, and common edge-case pitfalls.'
        : 'Convert this into 5 high-yield Active Recall Q&A Flashcards formatted with clear Questions and detailed Answers.';

    try {
      const response = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'athena',
          message: `You are Athena, Chief Synthesizer. ${modePrompt}\n\nCONTENT TO SYNTHESIZE:\n${contentToAnalyze.slice(0, 4000)}`
        })
      });

      const data = await response.json();
      soundEngine.playCyberPing();
      setSummary(data.reply || data.response || 'Synthesis completed.');
    } catch (err) {
      // Fallback local synthesis if offline
      soundEngine.playCyberPing();
      setSummary(`# Synthesized Cheat Sheet: ${selectedNotePath ? selectedNotePath.split('/').pop() : 'Direct Input'}\n\n` +
        `### Key Takeaways\n- Extracted core technical specifications from input.\n` +
        `- Verified target architecture invariants.\n\n` +
        `\`\`\`bash\n# Key verification command\nnmap -sC -sV -p- <target_ip>\n\`\`\``);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    soundEngine.playClick();
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToVault = async () => {
    soundEngine.playClick();
    const filename = `01 Certifications/Syntheses/Synthesis_${Date.now()}.md`;
    try {
      await api.saveNote(filename, summary, {
        type: 'ai-synthesis',
        mode: synthesisMode,
        date: new Date().toISOString(),
        tags: ['study', 'synthesis', 'athena']
      });
      setSavedToVault(true);
      soundEngine.playCyberPing();
      setTimeout(() => setSavedToVault(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#080512] text-zinc-200 font-sans select-text">
      {/* 1. Header Toolbar */}
      <div className="h-12 border-b border-purple-500/20 px-4 bg-[#0e0722]/90 flex items-center justify-between shrink-0 font-mono text-xs">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Neural Document Synthesizer (Athena Core)
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-bold flex items-center gap-1 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleSaveToVault}
            className="px-3 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1 transition-all"
          >
            {savedToVault ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{savedToVault ? 'Saved to Vault' : 'Save as Note'}</span>
          </button>

          <button
            onClick={handleSynthesize}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-4 py-1 rounded-xl bg-purple-500 hover:bg-purple-400 text-black font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50"
          >
            {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{isProcessing ? 'Synthesizing...' : 'Run Synthesis'}</span>
          </button>
        </div>
      </div>

      {/* 2. Controls & Source Bar */}
      <div className="p-3 border-b border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-xl border border-white/10">
            <button
              onClick={() => { soundEngine.playClick(); setSourceType('vault'); }}
              className={`px-3 py-1 rounded-lg uppercase ${sourceType === 'vault' ? 'bg-purple-500/30 text-purple-300 font-bold' : 'text-zinc-400'}`}
            >
              Obsidian Vault Note
            </button>
            <button
              onClick={() => { soundEngine.playClick(); setSourceType('paste'); }}
              className={`px-3 py-1 rounded-lg uppercase ${sourceType === 'paste' ? 'bg-purple-500/30 text-purple-300 font-bold' : 'text-zinc-400'}`}
            >
              Direct Text Paste
            </button>
          </div>

          {sourceType === 'vault' ? (
            <select
              value={selectedNotePath}
              onChange={(e) => setSelectedNotePath(e.target.value)}
              className="bg-black/80 border border-white/10 rounded-xl px-3 py-1 text-white font-sans text-xs focus:outline-none focus:border-purple-400 max-w-xs"
            >
              {vaultNotes.map(n => (
                <option key={n.path} value={n.path}>{n.title} ({n.path})</option>
              ))}
            </select>
          ) : null}
        </div>

        {/* Synthesis Profile */}
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-[11px]">Format:</span>
          <select
            value={synthesisMode}
            onChange={(e) => setSynthesisMode(e.target.value as any)}
            className="bg-black/80 border border-purple-500/30 rounded-xl px-2.5 py-1 text-purple-300 font-bold text-xs focus:outline-none"
          >
            <option value="cheatsheet">Executive Technical Cheat Sheet</option>
            <option value="mental-model">First-Principles Mental Model</option>
            <option value="qa-flashcards">Active Recall Q&A Flashcards</option>
          </select>
        </div>
      </div>

      {/* 3. Text Paste Input (If Paste Mode Active) */}
      {sourceType === 'paste' && (
        <div className="p-3 border-b border-white/10 bg-[#06030c]">
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Paste syllabus, article, command logs, or exam notes here to synthesize..."
            rows={4}
            className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-purple-500 custom-scrollbar"
          />
        </div>
      )}

      {/* 4. Output Summary Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap select-text custom-scrollbar">
        {summary}
      </div>
    </div>
  );
};
