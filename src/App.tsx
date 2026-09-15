import React, { useState } from 'react';
import { DesktopWorkspace } from './components/desktop/DesktopWorkspace';
import { WorkbenchRoot } from './workbench/WorkbenchRoot';

export const App: React.FC = () => {
  // Default to the new Tiling Intent Workbench
  const [useWorkbench, setUseWorkbench] = useState<boolean>(() => {
    const saved = localStorage.getItem('zakos_workbench_mode');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleMode = () => {
    setUseWorkbench((prev) => {
      const next = !prev;
      localStorage.setItem('zakos_workbench_mode', String(next));
      return next;
    });
  };

  if (useWorkbench) {
    return <WorkbenchRoot onToggleLegacyMode={toggleMode} />;
  }

  return (
    <div className="relative w-full h-full">
      <DesktopWorkspace />
      {/* Floating button to switch to Tiling Intent Workbench */}
      <button
        onClick={toggleMode}
        className="fixed bottom-3 right-3 z-50 px-2.5 py-1 rounded bg-black/85 hover:bg-black border border-amber-500/50 text-amber-300 font-mono text-[10px] font-bold shadow-2xl cursor-pointer flex items-center gap-1.5 transition-all"
        title="Switch to Tiling Intent Workbench (BSP Grid + SSH)"
      >
        <span>⚡ TILING WORKBENCH</span>
      </button>
    </div>
  );
};

export default App;
