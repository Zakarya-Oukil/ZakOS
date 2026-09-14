import React, { useState, useEffect } from 'react';
import { Compass, RefreshCw } from 'lucide-react';
import { NeuralBrainGalaxy } from '../../galaxy/NeuralBrainGalaxy';
import { api } from '../../../services/api';
import { GraphData, NoteItem } from '../../../types';
import { soundEngine } from '../../../services/soundEffects';

interface UniverseGraphAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
  onOpenNote?: (notePath: string) => void;
}

export const UniverseGraphApp: React.FC<UniverseGraphAppProps> = ({ onOpenNote }) => {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGraph = async () => {
      try {
        setLoading(true);
        const [gData, nData] = await Promise.all([
          api.getGraph(),
          api.getNotes()
        ]);
        setGraphData(gData);
        setNotes(nData);
      } catch (err) {
        console.error('Failed to load galaxy graph:', err);
      } finally {
        setLoading(false);
      }
    };
    loadGraph();
  }, []);

  const handleOpenNote = (path: string) => {
    soundEngine.playClick();
    if (onOpenNote) {
      onOpenNote(path);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#030712] text-zinc-200 font-sans relative overflow-hidden">
      {loading ? (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-400">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
          <div className="font-mono text-sm tracking-wider">COMPUTING 3D NEURAL GALAXY TOPOLOGY...</div>
        </div>
      ) : (
        <NeuralBrainGalaxy
          graphData={graphData}
          notes={notes}
          onOpenNote={handleOpenNote}
          height="100%"
        />
      )}
    </div>
  );
};

