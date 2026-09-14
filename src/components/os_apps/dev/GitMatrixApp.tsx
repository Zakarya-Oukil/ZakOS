import React from 'react';
import { GitHubWorkspaceView } from '../../github/GitHubWorkspaceView';

interface GitMatrixAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
  onOpenInLocalIde?: (repoName: string) => void;
}

export const GitMatrixApp: React.FC<GitMatrixAppProps> = ({ onOpenInLocalIde }) => {
  return (
    <div className="h-full flex flex-col bg-[#070e0a] text-zinc-200 overflow-hidden">
      <GitHubWorkspaceView
        theme="dark"
        onOpenInLocalIde={onOpenInLocalIde}
      />
    </div>
  );
};

