import React, { useState, useEffect } from 'react';
import { IdeWorkspace } from '../../ide/IdeWorkspace';
import { api } from '../../../services/api';
import { ProjectInfo, ModelOption } from '../../../types';
import { RefreshCw, Code } from 'lucide-react';

interface MonacoIdeAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
  initialProps?: {
    projectId?: string;
  };
}

export const MonacoIdeApp: React.FC<MonacoIdeAppProps> = ({ initialProps }) => {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projList, modelList] = await Promise.all([
        api.getProjects(),
        api.getModels()
      ]);
      setProjects(projList);
      setModels(modelList);
      
      const targetProj = (initialProps?.projectId && projList.find(p => p.id === initialProps.projectId)) || projList[0] || {
        id: 'zak-os',
        name: 'Zak_OS Multi-Desktop',
        path: 'c:\\Users\\Zakar\\Documents\\Web_Dev\\Zak_OS',
        framework: 'React / Vite / TypeScript',
        description: 'Autonomous AI Operating System with 5 Desktop Environments'
      };
      setSelectedProject(targetProj);
    } catch (err) {
      console.error('Failed to load IDE data:', err);
      // Fallback workspace
      const fallback: ProjectInfo = {
        id: 'zak-os',
        name: 'Zak_OS Multi-Desktop',
        path: 'c:\\Users\\Zakar\\Documents\\Web_Dev\\Zak_OS',
        framework: 'React / Vite / TypeScript',
        description: 'Autonomous AI Operating System with 5 Desktop Environments'
      };
      setProjects([fallback]);
      setSelectedProject(fallback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [initialProps?.projectId]);

  if (loading || !selectedProject) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 bg-[#080c14] text-zinc-400">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
        <div className="font-mono text-sm tracking-wider">INITIALIZING MONACO IDE WORKSPACE...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#080c14] text-zinc-200 overflow-hidden">
      <IdeWorkspace
        project={selectedProject}
        allProjects={projects}
        models={models}
        onSwitchProject={(p) => setSelectedProject(p)}
        onRefreshProjects={loadData}
      />
    </div>
  );
};
