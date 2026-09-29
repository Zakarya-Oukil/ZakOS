import React, { useState } from 'react';
import { AppDefinition, DesktopFolderDefinition } from '../../types/desktop';
import { renderAppIcon } from './DockTaskbar';
import { soundEngine } from '../../services/soundEffects';
import { Search, Play, Sparkles, Folder, ExternalLink } from 'lucide-react';

interface DesktopFolderWindowProps {
  folder: DesktopFolderDefinition;
  apps: AppDefinition[];
  onLaunchApp: (appId: string) => void;
  onClose: () => void;
}

export const DesktopFolderWindow: React.FC<DesktopFolderWindowProps> = ({
  folder,
  apps,
  onLaunchApp,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const folderApps = apps.filter(app => folder.appIds.includes(app.id));

  const filteredApps = folderApps.filter(app =>
    app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getThemeColor = () => {
    switch (folder.os) {
      case 'cyber': return {
        accent: 'text-red-400',
        bgAccent: 'bg-red-500/10 border-red-500/30 text-red-400',
        btnBg: 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30',
        glow: 'shadow-[0_0_15px_rgba(239,68,68,0.2)]'
      };
      case 'dev': return {
        accent: 'text-emerald-400',
        bgAccent: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        btnBg: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30',
        glow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]'
      };
      case 'study': return {
        accent: 'text-purple-400',
        bgAccent: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
        btnBg: 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-purple-500/30',
        glow: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]'
      };
      case 'founder': return {
        accent: 'text-amber-400',
        bgAccent: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        btnBg: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30',
        glow: 'shadow-[0_0_15px_rgba(245,158,11,0.2)]'
      };
      case 'agentic':
      default: return {
        accent: 'text-cyan-400',
        bgAccent: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
        btnBg: 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/30',
        glow: 'shadow-[0_0_15px_rgba(6,182,212,0.2)]'
      };
    }
  };

  const theme = getThemeColor();

  return (
    <div className="h-full flex flex-col bg-[#040810]/95 text-zinc-100 select-none overflow-hidden">
      {/* Folder Header Toolbar */}
      <div className="px-5 py-3 border-b border-white/10 bg-black/40 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${theme.bgAccent} ${theme.glow}`}>
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              {folder.title}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 border border-white/5">
                {folderApps.length} Apps
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400 truncate max-w-xs">{folder.description}</p>
          </div>
        </div>

        {/* Search within folder */}
        <div className="relative w-48">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search applications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-white/30"
          />
        </div>
      </div>

      {/* Grid of Apps inside folder */}
      <div className="flex-1 p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 content-start">
        {filteredApps.map((app) => (
          <div
            key={app.id}
            onDoubleClick={() => {
              soundEngine.playWindowOpen();
              onLaunchApp(app.id);
            }}
            className="group relative flex flex-col justify-between p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/20 transition-all shadow-sm hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className={`w-11 h-11 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center ${theme.accent} group-hover:scale-110 transition-all ${theme.glow}`}>
                  {renderAppIcon(app.iconName, "w-6 h-6")}
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 text-zinc-400 border border-white/5">
                  {app.category}
                </span>
              </div>

              <h4 className="font-semibold text-xs text-zinc-100 group-hover:text-white transition-colors mb-1">
                {app.title}
              </h4>
              <p className="text-[11px] text-zinc-400 leading-snug line-clamp-2 mb-3">
                {app.description}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-auto">
              <span className="text-[10px] text-zinc-500 font-mono">
                {app.defaultWidth}×{app.defaultHeight}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.playWindowOpen();
                  onLaunchApp(app.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-all ${theme.btnBg} active:scale-95`}
              >
                <Play className="w-3 h-3 fill-current" />
                Launch
              </button>
            </div>
          </div>
        ))}

        {filteredApps.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center text-zinc-500">
            <Sparkles className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm font-medium">No applications found matching "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-5 py-2.5 bg-black/40 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <span>OS: {folder.os.toUpperCase()} ENVIRONMENT</span>
        <span>DOUBLE CLICK ICON TO LAUNCH</span>
      </div>
    </div>
  );
};
