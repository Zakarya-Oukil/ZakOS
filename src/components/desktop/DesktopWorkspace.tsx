import React, { useState, useEffect, useCallback } from 'react';
import { OperatingSystemId, WindowState, CrossOsNotification, DesktopFolderDefinition } from '../../types/desktop';
import { ALL_APPS, DESKTOP_FOLDERS } from './appRegistry';
import { GrubTopBar } from './GrubTopBar';
import { DynamicWallpaper } from './DynamicWallpaper';
import { ZakWindow } from './ZakWindow';
import { DockTaskbar, renderAppIcon } from './DockTaskbar';
import { DesktopFolderWindow } from './DesktopFolderWindow';
import { soundEngine } from '../../services/soundEffects';
import { api } from '../../services/api';
import { Folder } from 'lucide-react';

export const DesktopWorkspace: React.FC = () => {
  const [activeOs, setActiveOs] = useState<OperatingSystemId>('agentic');
  const [vaultNotesCount, setVaultNotesCount] = useState<number>(155);
  const [windows, setWindows] = useState<WindowState[]>([
    {
      id: 'init-jarvis',
      appId: 'agentic-jarvis',
      title: 'JARVIS Master Core',
      iconName: 'jarvis',
      os: 'agentic',
      isOpen: true,
      isMinimized: false,
      isMaximized: false,
      position: { x: 140, y: 70 },
      size: { width: 720, height: 520 },
      zIndex: 10
    }
  ]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>('init-jarvis');
  const [maxZIndex, setMaxZIndex] = useState(15);
  const [notifications, setNotifications] = useState<CrossOsNotification[]>([
    {
      id: 'notif-1',
      sourceOs: 'cyber',
      title: 'Spider Scan Complete',
      message: 'Subnet 192.168.100.0/24 mapped. Identified .67 as dual-homed gateway.',
      timestamp: '04:12',
      type: 'info',
      read: false,
      actionAppId: 'cyber-target-matrix'
    }
  ]);

  // Load vault notes count
  useEffect(() => {
    api.getNotes()
      .then(notes => {
        if (notes && notes.length > 0) {
          setVaultNotesCount(notes.length);
        }
      })
      .catch(err => console.log('Vault count error:', err));
  }, []);

  // Bring window to front
  const handleFocusWindow = useCallback((id: string) => {
    soundEngine.playClick();
    setActiveWindowId(id);
    setWindows(prev => prev.map(w => w.id === id ? {
      ...w,
      zIndex: maxZIndex + 1,
      isMinimized: false
    } : w));
    setMaxZIndex(prev => prev + 1);
  }, [maxZIndex]);

  // Launch app or folder, or focus if already open
  const handleLaunchApp = useCallback((targetId: string) => {
    // Check if it is a Desktop Folder
    const folderDef = DESKTOP_FOLDERS.find(f => f.id === targetId);
    const appDef = ALL_APPS.find(a => a.id === targetId);

    if (!folderDef && !appDef) return;

    // Check if instance already exists
    const existing = windows.find(w => w.appId === targetId);
    if (existing) {
      if (existing.isMinimized) {
        soundEngine.playWindowOpen();
        setWindows(prev => prev.map(w => w.id === existing.id ? {
          ...w,
          isMinimized: false,
          isOpen: true,
          zIndex: maxZIndex + 1
        } : w));
      }
      handleFocusWindow(existing.id);
      return;
    }

    // Spawn new window for Folder or App
    soundEngine.playWindowOpen();
    const newWinId = `win-${targetId}-${Date.now()}`;
    
    if (folderDef) {
      const newWindow: WindowState = {
        id: newWinId,
        appId: folderDef.id,
        title: folderDef.title,
        iconName: folderDef.iconName,
        os: folderDef.os,
        isOpen: true,
        isMinimized: false,
        isMaximized: false,
        position: { x: 160, y: 100 },
        size: { width: 700, height: 480 },
        zIndex: maxZIndex + 1
      };
      setWindows(prev => [...prev, newWindow]);
    } else if (appDef) {
      const newWindow: WindowState = {
        id: newWinId,
        appId: appDef.id,
        title: appDef.title,
        iconName: appDef.iconName,
        os: appDef.os,
        isOpen: true,
        isMinimized: false,
        isMaximized: false,
        position: { x: appDef.defaultX || 120, y: appDef.defaultY || 80 },
        size: { width: appDef.defaultWidth, height: appDef.defaultHeight },
        zIndex: maxZIndex + 1
      };
      setWindows(prev => [...prev, newWindow]);
    }

    setActiveWindowId(newWinId);
    setMaxZIndex(prev => prev + 1);
  }, [windows, maxZIndex, handleFocusWindow]);

  const handleCloseWindow = (id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
    if (activeWindowId === id) {
      setActiveWindowId(null);
    }
  };

  const handleMinimizeWindow = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
    if (activeWindowId === id) {
      setActiveWindowId(null);
    }
  };

  const handleMaximizeWindow = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMaximized: !w.isMaximized } : w));
  };

  const handleUpdatePosition = (id: string, pos: { x: number; y: number }) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, position: pos } : w));
  };

  const handleUpdateSize = (id: string, size: { width: number; height: number }) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, size } : w));
  };

  const handleToggleWindow = (id: string) => {
    const win = windows.find(w => w.id === id);
    if (!win) return;
    if (win.isMinimized || activeWindowId !== id) {
      handleFocusWindow(id);
    } else {
      handleMinimizeWindow(id);
    }
  };

  // Keyboard Shortcuts (Alt + 1-5 for OS switching)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        if (e.key === '1') { soundEngine.playOsSwitch(); setActiveOs('agentic'); }
        if (e.key === '2') { soundEngine.playOsSwitch(); setActiveOs('cyber'); }
        if (e.key === '3') { soundEngine.playOsSwitch(); setActiveOs('dev'); }
        if (e.key === '4') { soundEngine.playOsSwitch(); setActiveOs('study'); }
        if (e.key === '5') { soundEngine.playOsSwitch(); setActiveOs('founder'); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Desktop items for current OS
  const currentOsFolders = DESKTOP_FOLDERS.filter(folder => folder.os === activeOs);
  const currentOsApps = ALL_APPS.filter(app => app.os === activeOs);

  const badgeCounts: Record<OperatingSystemId, number> = {
    agentic: 0,
    cyber: notifications.filter(n => n.sourceOs === 'cyber' && !n.read).length,
    dev: 0,
    study: 0,
    founder: 0
  };

  const handleOpenActiveVault = () => {
    const vaultMap: Record<OperatingSystemId, string> = {
      cyber: 'cyber-vault',
      study: 'study-vault',
      dev: 'dev-vault',
      founder: 'founder-vault',
      agentic: 'agentic-vault'
    };
    handleLaunchApp(vaultMap[activeOs] || 'agentic-vault');
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-black text-zinc-100 flex flex-col select-none relative font-sans">
      {/* 1. GRUB Top Bar */}
      <GrubTopBar
        activeOs={activeOs}
        onSwitchOs={(os) => setActiveOs(os)}
        notifications={notifications}
        badgeCounts={badgeCounts}
        activeModel="Gemini 2.5 Flash"
        onOpenModelRouter={() => handleLaunchApp('agentic-model-router')}
        onOpenVault={handleOpenActiveVault}
        vaultNotesCount={vaultNotesCount}
      />

      {/* 2. Main Desktop Area */}
      <main className="flex-1 relative overflow-hidden">
        {/* Dynamic Wallpaper */}
        <DynamicWallpaper os={activeOs} />

        {/* Desktop Folders & Apps Grid (Top-Left of active desktop) */}
        <div className="absolute top-6 left-6 grid grid-flow-col grid-rows-6 gap-5 z-10 select-none">
          {/* Desktop Folders First */}
          {currentOsFolders.map((folder) => (
            <button
              key={folder.id}
              onDoubleClick={() => handleLaunchApp(folder.id)}
              onClick={() => soundEngine.playClick()}
              className="flex flex-col items-center gap-1.5 w-24 p-2 rounded-2xl hover:bg-white/10 hover:backdrop-blur-md border border-transparent hover:border-white/10 transition-all group text-center cursor-pointer active:scale-95"
            >
              <div className="relative w-12 h-12 rounded-2xl bg-[#080d1a]/90 border border-white/20 flex items-center justify-center text-amber-400 group-hover:text-amber-200 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-all">
                <Folder className="w-6 h-6 fill-amber-500/20" />
                {/* Mini count badge */}
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-black/80 border border-white/20 rounded-full text-[9px] font-mono text-zinc-300">
                  {folder.appIds.length}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-zinc-100 group-hover:text-white leading-tight line-clamp-2 px-1 rounded drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {folder.title}
              </span>
            </button>
          ))}

          {/* Standalone Desktop Apps */}
          {currentOsApps.map((app) => (
            <button
              key={app.id}
              onDoubleClick={() => handleLaunchApp(app.id)}
              onClick={() => soundEngine.playClick()}
              className="flex flex-col items-center gap-1.5 w-24 p-2 rounded-2xl hover:bg-white/10 hover:backdrop-blur-md border border-transparent hover:border-white/10 transition-all group text-center cursor-pointer active:scale-95"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#040812]/80 border border-white/15 flex items-center justify-center text-cyan-400 group-hover:text-white group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all">
                {renderAppIcon(app.iconName, "w-6 h-6")}
              </div>
              <span className="text-[11px] font-medium text-zinc-200 group-hover:text-white leading-tight line-clamp-2 px-1 rounded drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {app.title}
              </span>
            </button>
          ))}
        </div>

        {/* 3. Floating Windows (ZakWM) */}
        {windows.map((win) => {
          const folderDef = DESKTOP_FOLDERS.find(f => f.id === win.appId);
          const appDef = ALL_APPS.find(a => a.id === win.appId);
          if (!folderDef && !appDef) return null;

          const isActive = activeWindowId === win.id;

          return (
            <ZakWindow
              key={win.id}
              window={win}
              isActive={isActive}
              activeOs={win.os}
              onFocus={handleFocusWindow}
              onClose={handleCloseWindow}
              onMinimize={handleMinimizeWindow}
              onMaximize={handleMaximizeWindow}
              onUpdatePosition={handleUpdatePosition}
              onUpdateSize={handleUpdateSize}
            >
              {folderDef ? (
                <DesktopFolderWindow
                  folder={folderDef}
                  apps={ALL_APPS}
                  onLaunchApp={handleLaunchApp}
                  onClose={() => handleCloseWindow(win.id)}
                />
              ) : appDef ? (
                React.createElement(appDef.component, {
                  windowId: win.id,
                  isActive: isActive,
                  onClose: () => handleCloseWindow(win.id),
                  initialProps: win.initialProps
                })
              ) : null}
            </ZakWindow>
          );
        })}
      </main>

      {/* 4. Bottom Dock Taskbar */}
      <DockTaskbar
        activeOs={activeOs}
        apps={ALL_APPS}
        windows={windows}
        activeWindowId={activeWindowId}
        onLaunchApp={handleLaunchApp}
        onToggleWindow={handleToggleWindow}
      />
    </div>
  );
};

