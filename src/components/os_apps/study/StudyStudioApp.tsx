import React, { useState } from 'react';
import { FileText, Save, Folder, Eye, Edit3, Check } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface StudyStudioAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

export const StudyStudioApp: React.FC<StudyStudioAppProps> = () => {
  const [activeNote, setActiveNote] = useState('eJPT Lab Assessment — DMZ Network Exploitation.md');
  const [content, setContent] = useState<string>(`# eJPT Lab Assessment — DMZ Network Exploitation

**Status:** Completed
**Target Subnet:** 192.168.100.0/24
**Gateway:** 192.168.100.1
**Attacker IP:** 192.168.100.5

## Key Findings:
- **192.168.100.50 (WINSERVER-01):** WordPress 5.9.3, 245 HotFixes, \`mike:diamond\`.
- **192.168.100.51 (WINSERVER-02):** IIS 8.5 WebDAV PUT RCE (\`cmdasp.aspx\`), pivot to 192.168.0.0/24.
- **192.168.100.52 (Ubuntu App Server):** Drupal 7.57 Drupalgeddon2 CVE-2018-7600, OpenSMTPD CVE-2020-7247.
- **192.168.100.55 (WINSERVER-03):** Windows Server 2019, \`Administrator:swordfish\`, \`mary:hotmama\`.
- **192.168.100.67 (Bastion):** Dedicated dual-homed Linux Gateway.
`);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    soundEngine.playClick();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#080512] text-zinc-200 font-sans">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2 font-mono text-xs text-purple-300">
          <Folder className="w-4 h-4 text-purple-400" />
          <span className="text-white font-bold">{activeNote}</span>
          <span className="text-[10px] text-zinc-500">Obsidian Vault Synced</span>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
            isSaved
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
          }`}
        >
          {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          <span>{isSaved ? 'SAVED TO VAULT' : 'SAVE NOTE'}</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col rounded-xl bg-black/40 border border-white/10 overflow-hidden">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 w-full p-4 bg-transparent text-xs font-mono text-zinc-200 focus:outline-none resize-none leading-relaxed select-text"
          placeholder="Write your study notes, revision guides, or markdown..."
        />
      </div>
    </div>
  );
};
