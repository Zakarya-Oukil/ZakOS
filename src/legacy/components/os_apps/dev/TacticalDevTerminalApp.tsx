import React, { useState, useEffect } from 'react';
import { TacticalTerminalView } from '../../terminal/TacticalTerminalView';
import { api } from '../../../services/api';
import { ProjectInfo } from '../../../types';
import { RefreshCw } from 'lucide-react';

interface TacticalDevTerminalAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
  onOpenProjectInIde?: (project: ProjectInfo) => void;
}

export const TacticalDevTerminalApp: React.FC<TacticalDevTerminalAppProps> = ({ onOpenProjectInIde }) => {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const projs = await api.getProjects();
        setProjects(projs.length > 0 ? projs : [{
          id: 'zak-os',
          name: 'Zak_OS',
          path: 'c:\\Users\\Zakar\\Documents\\Web_Dev\\Zak_OS',
          framework: 'React / TypeScript / Vite',
          description: 'Multi-Desktop Agentic Operating System'
        }]);
      } catch (err) {
        setProjects([{
          id: 'zak-os',
          name: 'Zak_OS',
          path: 'c:\\Users\\Zakar\\Documents\\Web_Dev\\Zak_OS',
          framework: 'React / TypeScript / Vite',
          description: 'Multi-Desktop Agentic Operating System'
        }]);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 bg-[#070c0a] text-zinc-400">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
        <div className="font-mono text-sm tracking-wider">ATTACHING TACTICAL DEV PTY SHELL...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#070c0a] text-zinc-200 overflow-hidden">
      <TacticalTerminalView
        projects={projects}
        onOpenProjectInIde={onOpenProjectInIde}
      />
    </div>
  );
};
