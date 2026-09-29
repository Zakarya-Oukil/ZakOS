import React from 'react';
import { ContextProfileId, ProfileThemeTokens, CONTEXT_PROFILES } from '../types/profileTypes';
import { PaneContentType } from '../types/bspTypes';
import { AppLogo } from '../../components/common/AppLogo';

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
      <div className="flex flex-col items-center gap-3 w-full">
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

        {/* Tool Launcher Shortcuts with Authentic Brand Logos */}
        <div className="flex flex-col items-center gap-2.5 w-full px-1 pt-3 border-t border-dashed overflow-y-auto max-h-[50vh]" style={{ borderColor: theme.borderPrimary }}>
          {/* 1. SSH Terminal */}
          <button
            onClick={() => onOpenTool('SSH_TERMINAL', 'SSH Lab Terminal', '❯_')}
            className="w-8 h-8 rounded-sm flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
            title="Native Web SSH Terminal Lab (Alt+V / Alt+S)"
          >
            <AppLogo name="terminal" className="w-5 h-5" />
          </button>

          {/* 2. Digital Forensics Lab */}
          <button
            onClick={() => onOpenTool('FORENSICS_LAB', 'Forensics & PCAP Lab', '🦈')}
            className="w-8 h-8 rounded-sm flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
            title="Digital Forensics & PCAP Packet Dissector"
          >
            <AppLogo name="wireshark" className="w-5 h-5" />
          </button>

          {/* 3. Payloads Forge */}
          <button
            onClick={() => onOpenTool('PAYLOAD_MATRIX', 'Payloads & SecLists Forge', '⚡')}
            className="w-8 h-8 rounded-sm flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
            title="PayloadsAllTheThings & SecLists Knowledge Engine"
          >
            <AppLogo name="payload" className="w-5 h-5" />
          </button>

          {/* 4. Study / Notion Workstation */}
          <button
            onClick={() => onOpenTool('STUDY_NOTION', 'Course & Study Studio', '0x')}
            className="w-8 h-8 rounded-sm flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
            title="Study & Notion Workstation (Editable Markdown)"
          >
            <AppLogo name="notion" className="w-5 h-5" />
          </button>

          {/* 5. TheAlgorithms CS Playground */}
          <button
            onClick={() => onOpenTool('THE_ALGORITHMS', 'TheAlgorithms & CS Visualizer', '🐍')}
            className="w-8 h-8 rounded-sm flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
            title="TheAlgorithms & CS Interactive Sandbox"
          >
            <AppLogo name="python" className="w-5 h-5" />
          </button>

          {/* 6. Build-Your-Own-X */}
          <button
            onClick={() => onOpenTool('BUILD_X', 'Build-Your-Own-X Lab', '⎇')}
            className="w-8 h-8 rounded-sm flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
            title="Build-Your-Own-X Systems Blueprints"
          >
            <AppLogo name="redis" className="w-5 h-5" />
          </button>

          {/* 7. System Design Primer */}
          <button
            onClick={() => onOpenTool('SYSTEM_DESIGN', 'System Design Studio', '∑')}
            className="w-8 h-8 rounded-sm flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
            title="System Design Architecture Studio"
          >
            <AppLogo name="sysdesign" className="w-5 h-5" />
          </button>

          {/* 8. API Lab & Directory */}
          <button
            onClick={() => onOpenTool('API_LAB', 'Live API Directory', '⚡')}
            className="w-8 h-8 rounded-sm flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
            title="Public APIs Directory & ApiLab"
          >
            <AppLogo name="postman" className="w-5 h-5" />
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
