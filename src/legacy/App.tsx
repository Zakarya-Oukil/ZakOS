import React, { useState } from 'react';
import { DesktopWorkspace } from './components/desktop/DesktopWorkspace';
import { WorkbenchRoot } from './workbench/WorkbenchRoot';
import { JarvisHero } from './components/jarvis/JarvisHero';
import { Bot, Monitor, Terminal } from 'lucide-react';

export type AppMode = 'jarvis' | 'legacy' | 'workbench';

export const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>(() => {
    const saved = localStorage.getItem('zakos_view_mode') as AppMode | null;
    if (saved && (saved === 'jarvis' || saved === 'legacy' || saved === 'workbench')) {
      return saved;
    }
    // Check legacy workbench flag if present
    const legacyWorkbench = localStorage.getItem('zakos_workbench_mode');
    if (legacyWorkbench === 'false') return 'legacy';
    return 'jarvis'; // Default to the 3D JARVIS Hero experience!
  });

  const switchMode = (mode: AppMode) => {
    setAppMode(mode);
    localStorage.setItem('zakos_view_mode', mode);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#050506]">
      {/* 1. 3D JARVIS Immersive Hero Mode */}
      {appMode === 'jarvis' && (
        <JarvisHero
          onToggleDesktopWorkspace={() => switchMode('legacy')}
        />
      )}

      {/* 2. Legacy Windowed Desktop OS Workspace */}
      {appMode === 'legacy' && (
        <div className="relative w-full h-full">
          <DesktopWorkspace />
        </div>
      )}

      {/* 3. Tiling Intent Workbench */}
      {appMode === 'workbench' && (
        <WorkbenchRoot onToggleLegacyMode={() => switchMode('legacy')} />
      )}

      {/* Floating Mode Switcher Switchboard in bottom-right */}
      <div className="fixed bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/85 p-1 backdrop-blur-xl shadow-2xl">
        <button
          onClick={() => switchMode('jarvis')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
            appMode === 'jarvis'
              ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title="3D Spline Robot Hero & Voice HUD"
        >
          <Bot className="w-3 h-3" />
          <span>JARVIS 3D</span>
        </button>

        <button
          onClick={() => switchMode('legacy')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
            appMode === 'legacy'
              ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title="ZakOS Legacy Desktop (Window Manager & Multi-OS)"
        >
          <Monitor className="w-3 h-3" />
          <span>LEGACY OS</span>
        </button>

        <button
          onClick={() => switchMode('workbench')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
            appMode === 'workbench'
              ? 'bg-amber-600 text-white shadow-[0_0_15px_rgba(217,119,6,0.5)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title="Tiling Intent Workbench (BSP Grid & SSH)"
        >
          <Terminal className="w-3 h-3" />
          <span>WORKBENCH</span>
        </button>
      </div>
    </div>
  );
};

export default App;
