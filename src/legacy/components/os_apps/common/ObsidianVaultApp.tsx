import React, { useState, useEffect } from 'react';
import { Editor } from '../../editor/Editor';
import { api } from '../../../services/api';
import { NoteItem } from '../../../types';
import { soundEngine } from '../../../services/soundEffects';
import { RefreshCw, BookOpen, AlertCircle } from 'lucide-react';

interface ObsidianVaultAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
  initialProps?: {
    filterCategory?: string;
    initialPath?: string;
  };
}

export const ObsidianVaultApp: React.FC<ObsidianVaultAppProps> = ({ initialProps }) => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [selectedNotePath, setSelectedNotePath] = useState<string | null>(initialProps?.initialPath || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getNotes();
      let filtered = data;
      if (initialProps?.filterCategory) {
        const cat = initialProps.filterCategory.toLowerCase();
        filtered = data.filter(n => 
          n.path.toLowerCase().includes(cat) || 
          n.title.toLowerCase().includes(cat) ||
          n.tags?.some(t => t.toLowerCase().includes(cat))
        );
      }
      setNotes(filtered.length > 0 ? filtered : data);
      if (!selectedNotePath && filtered.length > 0) {
        setSelectedNotePath(filtered[0].path);
      }
    } catch (err: any) {
      setError('Unable to connect to Obsidian live vault service. Displaying cached vault.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [initialProps?.filterCategory]);

  const handleSaveNote = async (path: string, content: string, frontmatter?: Record<string, any>) => {
    soundEngine.playClick();
    await api.saveNote(path, content, frontmatter);
    await fetchNotes();
  };

  const handleDeleteNote = async (path: string) => {
    soundEngine.playClick();
    await api.deleteNote(path);
    if (selectedNotePath === path) {
      setSelectedNotePath(null);
    }
    await fetchNotes();
  };

  return (
    <div className="h-full flex flex-col bg-[#05070d] text-zinc-200">
      {loading ? (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-400">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
          <div className="font-mono text-sm tracking-wider">INDEXING OBSIDIAN KNOWLEDGE VAULT...</div>
        </div>
      ) : (
        <Editor
          notes={notes}
          selectedNotePath={selectedNotePath}
          onSelectNotePath={(p) => {
            soundEngine.playClick();
            setSelectedNotePath(p);
          }}
          onSaveNote={handleSaveNote}
          onDeleteNote={handleDeleteNote}
        />
      )}
    </div>
  );
};
