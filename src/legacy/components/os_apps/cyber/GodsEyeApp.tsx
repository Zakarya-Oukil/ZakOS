import React from 'react';
import { GodsEyeCockpit } from './godseye/GodsEyeCockpit';

interface GodsEyeAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

export const GodsEyeApp: React.FC<GodsEyeAppProps> = () => {
  return (
    <div className="w-full h-full flex flex-col bg-black text-white overflow-hidden select-none">
      <div className="flex-1 w-full h-full relative overflow-hidden">
        <GodsEyeCockpit />
      </div>
    </div>
  );
};

export default GodsEyeApp;
