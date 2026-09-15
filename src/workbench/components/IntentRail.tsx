import React from 'react';
import { ContextProfileId, ProfileThemeTokens, CONTEXT_PROFILES } from '../types/profileTypes';
import { PaneContentType } from '../types/bspTypes';

interface IntentRailProps {
  currentProfile: ContextProfileId;
  theme: ProfileThemeTokens;
  onSelectProfile: (profile: ContextProfileId) => void;
  onOpenTool: (type: PaneContentType, title: string, glyph: string) => void;
  onOpenCommandPalette: () => void;
  onToggleLegacyMode?: () => void;
}

export const IntentRail: React.FC<IntentRailProps> = ({
  currentProfile,
  theme,
  onSelectProfile,
  onOpenTool,
  onOpenCommandPalette,
  onToggleLegacyMode,
}) => {
  return (
    <div
      className="w-13 h-full flex flex-col items-center justify-between py-3 border-r select-none font-mono z-40 transition-colors"
      style={{
        backgroundColor: theme.bgSecondary,
        borderColor: theme.borderPrimary,
      }}
    >
      {/* Top: ZakOS Core Logo & Profile Selectors */}
      <div className="flex flex-col items-center gap-4 w-full">
        {/* Master Glyph / Brand */}
        <div
          onClick={onOpenCommandPalette}
          className="w-9 h-9 rounded-sm flex items-center justify-center font-black text-xs cursor-pointer border transition-all hover:scale-105"
          style={{
            backgroundColor: theme.bgPrimary,
            borderColor: theme.borderActive,
            color: theme.accentPrimary,
          }}
          title="ZakOS Intent Workbench (Cmd/Ctrl+K or Alt+P)"
        >
          <span>Z//</span>
        </div>

        {/* Profiles Navigation (Alt+1, Alt+2, Alt+3) */}
        <div className="flex flex-col items-center gap-1.5 w-full px-1 pt-2 border-t border-dashed" style={{ borderColor: theme.borderPrimary }}>
          {(['CYBER', 'STUDY', 'DEV'] as ContextProfileId[]).map((pId) => {
            const p = CONTEXT_PROFILES[pId];
            const isSelected = currentProfile === pId;
            return (
              <button
                key={pId}
                onClick={() => onSelectProfile(pId)}
                className={`w-9 h-9 rounded-xs flex flex-col items-center justify-center text-xs font-bold transition-all cursor-pointer relative ${
                  isSelected ? 'border' : 'opacity-45 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: isSelected ? theme.bgPanel : 'transparent',
                  borderColor: isSelected ? theme.borderActive : 'transparent',
                  color: isSelected ? theme.accentPrimary : theme.textMuted,
                }}
                title={`${p.name} (${pId === 'CYBER' ? 'Alt+1' : pId === 'STUDY' ? 'Alt+2' : 'Alt+3'})`}
              >
                <span className="text-xs font-black">{p.glyph}</span>
                <span className="text-[7px] uppercase tracking-tighter mt-0.5">
                  {pId === 'CYBER' ? 'CYB' : pId === 'STUDY' ? 'STU' : 'DEV'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tool Launcher Shortcuts */}
        <div className="flex flex-col items-center gap-2 w-full px-1 pt-3 border-t border-dashed" style={{ borderColor: theme.borderPrimary }}>
          <button
            onClick={() => onOpenTool('SSH_TERMINAL', 'SSH Lab Terminal', '❯_')}
            className="w-8 h-8 rounded-xs flex items-center justify-center text-xs hover:text-white transition-colors cursor-pointer border border-transparent hover:border-neutral-700"
            style={{ color: theme.accentSecondary }}
            title="Launch SSH Terminal"
          >
            ❯_
          </button>

          <button
            onClick={() => onOpenTool('STUDY_NOTION', 'Course & Study Studio', '0x')}
            className="w-8 h-8 rounded-xs flex items-center justify-center text-xs hover:text-white transition-colors cursor-pointer border border-transparent hover:border-neutral-700"
            style={{ color: '#38bdf8' }}
            title="Open Study / Notion Workstation"
          >
            0x
          </button>

          <button
            onClick={() => onOpenTool('BUILD_X', 'Build-Your-Own-X Lab', '⎇')}
            className="w-8 h-8 rounded-xs flex items-center justify-center text-xs hover:text-white transition-colors cursor-pointer border border-transparent hover:border-neutral-700"
            style={{ color: '#f97316' }}
            title="Build Your Own X Blueprint"
          >
            ⎇
          </button>

          <button
            onClick={() => onOpenTool('SYSTEM_DESIGN', 'System Design Studio', '∑')}
            className="w-8 h-8 rounded-xs flex items-center justify-center text-xs hover:text-white transition-colors cursor-pointer border border-transparent hover:border-neutral-700"
            style={{ color: '#a855f7' }}
            title="System Design Architecture Studio"
          >
            ∑
          </button>

          <button
            onClick={() => onOpenTool('API_LAB', 'Live API Directory', '⚡')}
            className="w-8 h-8 rounded-xs flex items-center justify-center text-xs hover:text-white transition-colors cursor-pointer border border-transparent hover:border-neutral-700"
            style={{ color: '#eab308' }}
            title="Public APIs & ApiLab"
          >
            ⚡
          </button>
        </div>
      </div>

      {/* Bottom: Command Palette Trigger & Legacy Mode Toggle */}
      <div className="flex flex-col items-center gap-2.5 w-full">
        <button
          onClick={onOpenCommandPalette}
          className="w-9 h-9 rounded-xs flex items-center justify-center text-[10px] font-bold border border-neutral-800 hover:border-neutral-600 hover:text-white transition-all cursor-pointer"
          style={{ color: theme.textMuted }}
          title="Command Palette (Alt+P / Ctrl+K)"
        >
          ⌘K
        </button>

        {onToggleLegacyMode && (
          <button
            onClick={onToggleLegacyMode}
            className="w-7 h-7 rounded-xs flex items-center justify-center text-[9px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
            title="Switch back to Legacy Floating Desktop"
          >
            ◲
          </button>
        )}
      </div>
    </div>
  );
};
