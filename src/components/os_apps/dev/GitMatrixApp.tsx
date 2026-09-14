import React, { useState } from 'react';
import { GitBranch, GitCommit, GitPullRequest, Check, RefreshCw, Layers } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface GitMatrixAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

export const GitMatrixApp: React.FC<GitMatrixAppProps> = () => {
  const [activeBranch, setActiveBranch] = useState('v2-multi-desktop');
  const [branches, setBranches] = useState(['main', 'legacy-v1', 'v2-multi-desktop']);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  const commits = [
    { hash: '7f9a2b1', message: 'feat: add ZakOS v2.0 multi-desktop & window manager foundation', author: 'Zakarya Oukil', time: 'Just now' },
    { hash: 'c3e4198', message: 'backup: create legacy-v1 safety snapshot', author: 'Zakarya Oukil', time: '10m ago' },
    { hash: '1a90f42', message: 'feat: integrate obsidian vault deep sync & eJPT lab assessment', author: 'Zakarya Oukil', time: '2h ago' }
  ];

  const handleCommit = () => {
    if (!commitMessage.trim()) return;
    soundEngine.playClick();
    setIsCommitting(true);
    setTimeout(() => {
      soundEngine.playCyberPing();
      setIsCommitting(false);
      setCommitMessage('');
    }, 1000);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#070e0a] text-zinc-200 font-sans">
      {/* Branch Switcher & Actions */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 font-mono text-xs">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-emerald-400" />
          <span className="text-zinc-500">Branch:</span>
          <select
            value={activeBranch}
            onChange={(e) => {
              soundEngine.playClick();
              setActiveBranch(e.target.value);
            }}
            className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1 text-emerald-300 font-bold focus:outline-none"
          >
            {branches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
            CLEAN WORKTREE
          </span>
        </div>
      </div>

      {/* Commit Input Box */}
      <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/10 mb-3">
        <input
          type="text"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message (e.g. feat: upgrade spider module)..."
          className="flex-1 bg-transparent px-2 text-xs font-mono text-white focus:outline-none"
        />
        <button
          onClick={handleCommit}
          disabled={!commitMessage.trim() || isCommitting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-all disabled:opacity-40"
        >
          <GitCommit className="w-3.5 h-3.5" />
          <span>{isCommitting ? 'Committing...' : 'Commit & Stage'}</span>
        </button>
      </div>

      {/* Commit Log Stream */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold block mb-1">Commit Timeline</span>
        {commits.map((c) => (
          <div key={c.hash} className="p-3 rounded-xl bg-white/5 border border-white/5 font-mono text-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                {c.hash}
              </span>
              <span className="text-white">{c.message}</span>
            </div>
            <div className="text-[11px] text-zinc-500">{c.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
