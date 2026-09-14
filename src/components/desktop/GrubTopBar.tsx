import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  BookOpen, 
  Terminal, 
  Bot, 
  Briefcase, 
  Cpu, 
  HardDrive, 
  Volume2, 
  VolumeX, 
  Bell, 
  Sparkles,
  Wifi
} from 'lucide-react';
import { OperatingSystemId, CrossOsNotification } from '../../types/desktop';
import { soundEngine } from '../../services/soundEffects';

interface GrubTopBarProps {
  activeOs: OperatingSystemId;
  onSwitchOs: (os: OperatingSystemId) => void;
  notifications: CrossOsNotification[];
  badgeCounts: Record<OperatingSystemId, number>;
  activeModel: string;
  onOpenModelRouter?: () => void;
  onOpenVault?: () => void;
  vaultNotesCount: number;
}

export const GrubTopBar: React.FC<GrubTopBarProps> = ({
  activeOs,
  onSwitchOs,
  notifications,
  badgeCounts,
  activeModel,
  onOpenModelRouter,
  onOpenVault,
  vaultNotesCount
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEngine.setEnabled(next);
    if (next) soundEngine.playClick();
  };

  const osList: { id: OperatingSystemId; name: string; icon: React.ReactNode; color: string; activeClass: string }[] = [
    {
      id: 'agentic',
      name: 'AgenticOS',
      icon: <Bot className="w-3.5 h-3.5" />,
      color: 'text-cyan-400',
      activeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
    },
    {
      id: 'cyber',
      name: 'CyberOS',
      icon: <Shield className="w-3.5 h-3.5" />,
      color: 'text-red-400',
      activeClass: 'bg-red-500/20 text-red-300 border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
    },
    {
      id: 'dev',
      name: 'DevOS',
      icon: <Terminal className="w-3.5 h-3.5" />,
      color: 'text-emerald-400',
      activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
    },
    {
      id: 'study',
      name: 'StudyOS',
      icon: <BookOpen className="w-3.5 h-3.5" />,
      color: 'text-purple-400',
      activeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
    },
    {
      id: 'founder',
      name: 'FounderOS',
      icon: <Briefcase className="w-3.5 h-3.5" />,
      color: 'text-zinc-300',
      activeClass: 'bg-white/20 text-white border-white/50 shadow-[0_0_12px_rgba(255,255,255,0.2)]'
    }
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="h-10 bg-[#03060c]/90 backdrop-blur-md border-b border-white/10 px-3 flex items-center justify-between z-50 select-none relative">
      {/* Left: ZakOS Master Emblem & GRUB OS Fast-Switcher */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 mr-2 pr-3 border-r border-white/10">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#06b6d4]" />
          <span className="font-mono text-xs font-black tracking-widest text-white">
            ZAK<span className="text-cyan-400">OS</span> <span className="text-[10px] text-zinc-500 font-normal">v2.0</span>
          </span>
        </div>

        {/* 5 OS Switcher Buttons */}
        <div className="flex items-center gap-1">
          {osList.map((item) => {
            const isActive = activeOs === item.id;
            const count = badgeCounts[item.id] || 0;
            return (
              <button
                key={item.id}
                onClick={() => {
                  soundEngine.playOsSwitch();
                  onSwitchOs(item.id);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium border border-transparent transition-all relative ${
                  isActive ? item.activeClass : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
                {count > 0 && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: System Telemetry, Model Status, Vault Bridge, Clock */}
      <div className="flex items-center gap-2.5 font-mono text-xs text-zinc-400">
        {/* Model Router Status Chip */}
        <button
          onClick={onOpenModelRouter}
          title="Active Model Router (Gemini + Local Ollama Fallback)"
          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 hover:border-cyan-500/40 text-cyan-300 hover:text-white transition-colors"
        >
          <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span className="text-[11px] font-semibold truncate max-w-[130px]">{activeModel || 'Gemini 2.5 Flash'}</span>
        </button>

        {/* Obsidian Vault Status */}
        <button
          onClick={onOpenVault}
          title="Obsidian Vault Connected"
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition-colors"
        >
          <HardDrive className="w-3 h-3 text-purple-400" />
          <span className="text-[11px]">{vaultNotesCount} Notes</span>
        </button>

        {/* Notifications Tray */}
        <div className="relative">
          <button
            onClick={() => {
              soundEngine.playClick();
              setShowNotifications(!showNotifications);
            }}
            title="Cross-OS Notifications"
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white relative transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>

          {/* Notifications Flyout */}
          {showNotifications && (
            <div className="absolute right-0 top-8 w-80 bg-[#090d16] border border-white/10 rounded-xl shadow-2xl p-3 z-50 text-left font-sans select-none">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Cross-OS Feed</span>
                <span className="text-[10px] text-zinc-500">{notifications.length} alerts</span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {notifications.length === 0 ? (
                  <div className="text-xs text-zinc-500 text-center py-4">No active cross-OS notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 text-xs">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                        <span className="font-mono uppercase font-bold text-cyan-400">{n.sourceOs}</span>
                        <span>{n.timestamp}</span>
                      </div>
                      <div className="font-medium text-zinc-200">{n.title}</div>
                      <div className="text-zinc-400 text-[11px] mt-0.5">{n.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Audio Toggle */}
        <button
          onClick={handleToggleSound}
          title={soundEnabled ? "Mute SFX" : "Unmute SFX"}
          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 text-zinc-500" />}
        </button>

        {/* Master Clock */}
        <div className="pl-2 border-l border-white/10 text-white font-mono font-bold tracking-wider">
          {timeStr}
        </div>
      </div>
    </header>
  );
};
