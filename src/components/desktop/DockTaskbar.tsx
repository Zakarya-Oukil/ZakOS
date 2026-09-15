import React, { useState } from 'react';
import { LayoutGrid, Bot, Shield, Terminal, BookOpen, Briefcase, Sparkles, Folder, TerminalSquare, Activity, Compass, Cpu, FileText, Globe } from 'lucide-react';
import { AppDefinition, WindowState, OperatingSystemId } from '../../types/desktop';
import { soundEngine } from '../../services/soundEffects';

interface DockTaskbarProps {
  activeOs: OperatingSystemId;
  apps: AppDefinition[];
  windows: WindowState[];
  activeWindowId: string | null;
  onLaunchApp: (appId: string) => void;
  onToggleWindow: (windowId: string) => void;
}

// Icon resolver helper
export const renderAppIcon = (iconName: string, className: string = "w-5 h-5") => {
  switch (iconName) {
    case 'Globe':
    case 'globe':
    case 'geoint':
    case 'godseye':
      return <Globe className={className} />;
    case 'Shield':
    case 'spider':
    case 'recon':
      return <Shield className={className} />;
    case 'Terminal':
    case 'terminal':
      return <Terminal className={className} />;
    case 'BookOpen':
    case 'study':
    case 'socrates':
      return <BookOpen className={className} />;
    case 'Bot':
    case 'agent':
    case 'jarvis':
      return <Bot className={className} />;
    case 'Briefcase':
    case 'founder':
    case 'projects':
      return <Briefcase className={className} />;
    case 'Sparkles':
    case 'ai':
      return <Sparkles className={className} />;
    case 'Folder':
    case 'vault':
      return <Folder className={className} />;
    case 'Activity':
    case 'telemetry':
      return <Activity className={className} />;
    case 'Compass':
      return <Compass className={className} />;
    case 'FileText':
    case 'notes':
      return <FileText className={className} />;
    default:
      return <Cpu className={className} />;
  }
};

export const DockTaskbar: React.FC<DockTaskbarProps> = ({
  activeOs,
  apps,
  windows,
  activeWindowId,
  onLaunchApp,
  onToggleWindow
}) => {
  const [showLauncher, setShowLauncher] = useState(false);

  // Current OS apps
  const osApps = apps.filter(app => app.os === activeOs);

  const getOsColor = () => {
    switch (activeOs) {
      case 'cyber': return 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.25)]';
      case 'dev': return 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.25)]';
      case 'study': return 'border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.25)]';
      case 'founder': return 'border-zinc-500/40 shadow-[0_0_20px_rgba(255,255,255,0.15)]';
      case 'agentic':
      default: return 'border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.25)]';
    }
  };

  return (
    <>
      {/* App Launcher Modal (Start Menu style) */}
      {showLauncher && (
        <div 
          onClick={() => setShowLauncher(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-16 left-6 w-96 max-h-[500px] bg-[#070b14]/95 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl text-left select-none animate-in fade-in slide-in-from-bottom-4 duration-200"
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                  {activeOs} Applications
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">{osApps.length} Ready</span>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1">
              {osApps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => {
                    soundEngine.playWindowOpen();
                    onLaunchApp(app.id);
                    setShowLauncher(false);
                  }}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 text-left group transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-cyan-400 group-hover:text-white group-hover:scale-110 transition-all">
                    {renderAppIcon(app.iconName, "w-4 h-4")}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate">
                      {app.title}
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      {app.category}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Dock */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 select-none">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#03060c]/85 backdrop-blur-2xl border ${getOsColor()} transition-all duration-300`}>
          {/* Launcher Button */}
          <button
            onClick={() => {
              soundEngine.playClick();
              setShowLauncher(!showLauncher);
            }}
            title="Open Application Launcher"
            className="w-10 h-10 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 hover:text-cyan-200 hover:scale-105 active:scale-95 transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)]"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* OS Pinned/Available Apps */}
          <div className="flex items-center gap-1.5">
            {osApps.map((app) => {
              const openWin = windows.find(w => w.appId === app.id && w.isOpen);
              const isRunning = !!openWin;
              const isFocused = openWin && activeWindowId === openWin.id && !openWin.isMinimized;

              return (
                <button
                  key={app.id}
                  onClick={() => {
                    if (openWin) {
                      soundEngine.playClick();
                      onToggleWindow(openWin.id);
                    } else {
                      soundEngine.playWindowOpen();
                      onLaunchApp(app.id);
                    }
                  }}
                  title={app.title}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-all group ${
                    isFocused 
                      ? 'bg-white/20 border border-white/30 text-white scale-105'
                      : isRunning 
                        ? 'bg-white/10 border border-white/10 text-zinc-200 hover:bg-white/15' 
                        : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200 hover:scale-105'
                  }`}
                >
                  {renderAppIcon(app.iconName, "w-5 h-5")}

                  {/* Active running indicator dot */}
                  {isRunning && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_#06b6d4]" />
                  )}

                  {/* Tooltip on hover */}
                  <span className="absolute -top-9 px-2 py-0.5 rounded-md bg-black/90 border border-white/10 text-[11px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
                    {app.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};
