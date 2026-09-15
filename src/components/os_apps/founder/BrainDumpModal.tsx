import React, { useState } from 'react';
import { 
  Zap, X, Sparkles, Tag, Link2, Check, 
  Folder, Shield, FileText, Loader2, ArrowRight
} from 'lucide-react';
import { api } from '../../../services/api';
import { soundEngine } from '../../../services/soundEffects';
import { extractLinksAndTags } from '../../../services/brainCore';

interface BrainDumpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const BrainDumpModal: React.FC<BrainDumpModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [stage, setStage] = useState<'signal' | 'claim' | 'fact' | 'memory'>('signal');
  const [folder, setFolder] = useState('04 Knowledge Base');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const { wikilinks, tags } = extractLinksAndTags(content);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    soundEngine.playClick();

    const noteTitle = title.trim() || `Brain Dump ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
    const fileName = `${noteTitle.replace(/[^a-zA-Z0-9_\- ]/g, '')}.md`;
    const targetPath = `${folder}/${fileName}`;

    const frontmatter = {
      title: noteTitle,
      created: new Date().toISOString(),
      stage,
      tags,
      wikilinks,
      source: 'ZakOS Brain Dump Terminal'
    };

    try {
      await api.saveNote(targetPath, content, frontmatter);
      soundEngine.playNotification();
      setSaving(false);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setTitle('');
        setContent('');
        onClose();
        if (onSuccess) onSuccess();
      }, 900);
    } catch (err) {
      console.error('Failed to save brain dump:', err);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#0d0d0d] border border-violet-500/30 rounded-xl shadow-2xl shadow-violet-950/40 flex flex-col overflow-hidden font-sans">
        {/* Header */}
        <div className="px-5 py-3.5 bg-neutral-900/60 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/40 flex items-center justify-center">
              <Zap className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Brain Dump Quick Capture</span>
                <span className="text-[9px] bg-violet-500/20 text-violet-300 px-1.5 py-0.2 rounded border border-violet-500/30">
                  Epistemic Ingestion
                </span>
              </div>
              <div className="text-[10px] font-mono text-zinc-400">
                Direct ingestion into Obsidian Vault & Constellation Core
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 font-mono text-xs">
          {/* Note Title */}
          <div>
            <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
              Title / Subject (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Subnet Pivot Vector or SaaS Monetization Blueprint..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Target Folder & Stage Selector */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1 flex items-center gap-1">
                <Folder className="w-3 h-3 text-cyan-400" />
                Target Vault Folder
              </label>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="w-full px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-500"
              >
                <option value="04 Knowledge Base">04 Knowledge Base</option>
                <option value="01 Certifications">01 Certifications (eJPT)</option>
                <option value="targets">targets (Target Dossiers)</option>
                <option value="02 Coding Projects">02 Coding Projects</option>
                <option value="03 AI OS">03 AI OS</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Truth Lifecycle Stage
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-500 capitalize"
              >
                <option value="signal">Signal (Raw Detection)</option>
                <option value="claim">Claim (Hypothesis)</option>
                <option value="fact">Fact (Verified Intel)</option>
                <option value="memory">Memory (Durable Core)</option>
              </select>
            </div>
          </div>

          {/* Thought Content Area */}
          <div>
            <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
              Markdown Body (supports [[wikilinks]] and #tags)
            </label>
            <textarea
              rows={6}
              placeholder="Dump thoughts, code snippets, reconnaissance endpoints, or strategies here...&#10;&#10;Example: Identified gateway .67 connecting to [[Internal Subnet 192.168.100.0/24]] with open SMB #pentest"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 leading-relaxed resize-none"
            />
          </div>

          {/* Live Tag & Wikilink Preview */}
          {(wikilinks.length > 0 || tags.length > 0) && (
            <div className="p-3 bg-white/5 border border-white/10 rounded-lg space-y-2">
              <span className="text-[9px] uppercase text-zinc-500 font-bold block">
                Auto-Detected Epistemic Links:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10px]">
                    #{t}
                  </span>
                ))}
                {wikilinks.map((l) => (
                  <span key={l} className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/30 text-[10px] flex items-center gap-1">
                    <Link2 className="w-2.5 h-2.5" />
                    [[{l}]]
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-neutral-950/80 border-t border-white/10 flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-500">
            {content.split(/\s+/).filter(Boolean).length} words
          </span>
          <div className="flex items-center gap-2 font-mono">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !content.trim()}
              className={`px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg ${
                saved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/30 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Ingesting...</span>
                </>
              ) : saved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Persisted!</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Commit to Brain</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrainDumpModal;
