import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, FolderOpen, ExternalLink, X, Search, FileText, Calendar, Tag } from 'lucide-react';
import { api } from '../../../services/api';
import { jarvisApi } from '../../../services/jarvisApi';
import { NoteItem } from '../../../types';

interface JarvisVaultModalProps {
  initialNoteQuery?: string;
  onClose: () => void;
}

export const JarvisVaultModal: React.FC<JarvisVaultModalProps> = ({
  initialNoteQuery = '',
  onClose
}) => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [search, setSearch] = useState<string>(initialNoteQuery);
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    api.getNotes()
      .then(data => {
        setNotes(data || []);
        if (data && data.length > 0) {
          if (initialNoteQuery.trim()) {
            const match = data.find(n =>
              n.title.toLowerCase().includes(initialNoteQuery.toLowerCase())
            );
            setSelectedNote(match || data[0]);
          } else {
            setSelectedNote(data[0]);
          }
        }
      })
      .catch(err => console.error('Failed to load notes:', err))
      .finally(() => setLoading(false));
  }, [initialNoteQuery]);

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    (n.content && n.content.toLowerCase().includes(search.toLowerCase()))
  );

  const openInObsidianApp = (note?: NoteItem) => {
    const targetFile = note ? note.title : selectedNote?.title;
    jarvisApi.executePcApp('obsidian', targetFile);
  };

  const openVaultInExplorer = () => {
    jarvisApi.executePcApp('explorer');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 15 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-40 w-full max-w-3xl rounded-2xl border border-white/15 bg-[#07090e]/95 p-5 text-white shadow-2xl backdrop-blur-2xl"
      style={{
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(168, 85, 247, 0.15)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-zinc-100">
              JARVIS Obsidian Knowledge Vault
            </h3>
            <p className="text-[11px] text-zinc-400">
              C:\Users\Zakar\Documents\Obsidian\My_Vault ({notes.length} notes synchronized)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openVaultInExplorer}
            title="Open Vault directory in Windows File Explorer"
            className="flex h-7 items-center gap-1.5 rounded-lg border border-white/10 px-2 text-xs text-zinc-400 transition-colors hover:border-white/25 hover:text-white"
          >
            <FolderOpen className="h-3 w-3" />
            <span>Explorer</span>
          </button>
          <button
            onClick={() => openInObsidianApp()}
            title="Launch native Obsidian desktop app"
            className="flex h-7 items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/20 px-2 text-xs text-purple-300 transition-colors hover:bg-purple-500/30"
          >
            <ExternalLink className="h-3 w-3" />
            <span>Launch Obsidian</span>
          </button>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="mt-3.5 relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vault notes, concepts, cyber writeups..."
          className="w-full rounded-xl border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white placeholder-zinc-500 focus:border-purple-400/50 focus:outline-none"
        />
      </div>

      {/* Split View: Notes list & Preview */}
      <div className="mt-3.5 grid grid-cols-12 gap-3 h-80">
        {/* Left: Notes List */}
        <div className="col-span-5 overflow-y-auto space-y-1.5 pr-1 border-r border-white/5">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-xs text-zinc-500">
              Indexing vault...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-zinc-500">
              No matching notes
            </div>
          ) : (
            filteredNotes.map(n => {
              const isSelected = selectedNote?.id === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setSelectedNote(n)}
                  className={`w-full text-left rounded-lg p-2 transition-all text-xs flex flex-col gap-1 border ${
                    isSelected
                      ? 'border-purple-500/40 bg-purple-500/15 text-white'
                      : 'border-white/5 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="font-medium truncate flex items-center gap-1.5">
                    <FileText className="h-3 w-3 text-purple-400 shrink-0" />
                    <span className="truncate">{n.title}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate">{n.relativePath}</div>
                </button>
              );
            })
          )}
        </div>

        {/* Right: Note Preview & Action */}
        <div className="col-span-7 flex flex-col justify-between overflow-y-auto rounded-xl border border-white/5 bg-black/30 p-3 text-xs">
          {selectedNote ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div>
                  <h4 className="font-semibold text-zinc-100 text-sm">{selectedNote.title}</h4>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(selectedNote.updated).toLocaleDateString()}
                    </span>
                    {selectedNote.tier !== undefined && (
                      <span className="rounded bg-purple-500/20 px-1 py-0.2 text-[9px] text-purple-300">
                        Tier {selectedNote.tier}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => openInObsidianApp(selectedNote)}
                  className="rounded-lg border border-purple-500/30 bg-purple-500/20 px-2.5 py-1 text-[11px] font-medium text-purple-200 transition-colors hover:bg-purple-500/30"
                >
                  Edit in Obsidian
                </button>
              </div>

              <div className="font-mono text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto pr-1">
                {selectedNote.content || '(Note is empty)'}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-500">
              Select a note to inspect
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
