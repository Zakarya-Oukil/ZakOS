import React, { useState, useEffect } from 'react';
import { ProjectsTrackerView } from '../../projects/ProjectsTrackerView';
import { api } from '../../../services/api';
import { soundEngine } from '../../../services/soundEffects';
import { ProjectInfo, ProjectKanbanItem } from '../../../types';

interface ProjectsTrackerAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
  initialProps?: {
    filterCategory?: string;
  };
}

export const ProjectsTrackerApp: React.FC<ProjectsTrackerAppProps> = ({ initialProps }) => {
  const [projects, setProjects] = useState<ProjectKanbanItem[]>([]);
  const [availableProjects, setAvailableProjects] = useState<ProjectInfo[]>([]);

  useEffect(() => {
    // Fetch live projects from backend
    api.getProjects()
      .then((data) => {
        if (data && data.length > 0) {
          setProjects(data);
        }
      })
      .catch(console.error);
  }, []);

  const handleOpenProjectInIde = (project: ProjectInfo | string) => {
    soundEngine.playClick();
    const projectName = typeof project === 'string' ? project : project.name;
    console.log(`[ProjectsTrackerApp] Request to open project in IDE: ${projectName}`);
  };

  const handleOpenNote = (path: string) => {
    soundEngine.playClick();
    console.log(`[ProjectsTrackerApp] Request to open note: ${path}`);
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-y-auto p-4 sm:p-6 bg-[#080b12] text-zinc-200 custom-scrollbar select-text">
      <ProjectsTrackerView
        projects={projects}
        availableProjects={availableProjects}
        onOpenProjectInIde={handleOpenProjectInIde}
        onOpenNote={handleOpenNote}
      />
    </div>
  );
};
