import React from 'react';
import { OperatingSystemId } from '../../types/desktop';

interface DynamicWallpaperProps {
  os: OperatingSystemId;
}

export const DynamicWallpaper: React.FC<DynamicWallpaperProps> = ({ os }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none transition-all duration-700">
      {/* Agentic OS - Holographic Quantum Grid */}
      {os === 'agentic' && (
        <div className="absolute inset-0 bg-[#030712]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(6,182,212,0.12),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(99,102,241,0.08),transparent_50%)]" />
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#06b6d4_1px,transparent_1px),linear-gradient(to_bottom,#06b6d4_1px,transparent_1px)] bg-[size:3.5rem_3.5rem]" />
          {/* Arc Center Rings */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-cyan-500/10 animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full border border-cyan-400/15 border-dashed animate-[spin_60s_linear_infinite]" />
          <div className="absolute bottom-10 right-10 text-[100px] font-mono font-black text-cyan-500/[0.03] tracking-tighter">
            JARVIS_CORE
          </div>
        </div>
      )}

      {/* Cyber OS - BlackArch / Red Team Grid */}
      {os === 'cyber' && (
        <div className="absolute inset-0 bg-[#06080d]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(239,68,68,0.12),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(168,85,247,0.08),transparent_50%)]" />
          <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(to_right,#ef4444_1px,transparent_1px),linear-gradient(to_bottom,#ef4444_1px,transparent_1px)] bg-[size:2.5rem_2.5rem]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-red-500/10 border-dotted animate-[spin_45s_linear_infinite]" />
          <div className="absolute bottom-10 left-10 text-[110px] font-mono font-black text-red-500/[0.03] tracking-widest leading-none">
            ZAK_SPIDER // 0x7F
          </div>
        </div>
      )}

      {/* Dev OS - Deep Slate Workbench */}
      {os === 'dev' && (
        <div className="absolute inset-0 bg-[#090d16]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.1),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_90%,rgba(59,130,246,0.08),transparent_50%)]" />
          <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,#10b981_1px,transparent_1px),linear-gradient(to_bottom,#10b981_1px,transparent_1px)] bg-[size:4rem_4rem]" />
          <div className="absolute top-1/3 right-10 text-[90px] font-mono font-black text-emerald-500/[0.03] leading-none">
            DEVOPS_STACK
          </div>
        </div>
      )}

      {/* Study OS - Academic Aurora Glass */}
      {os === 'study' && (
        <div className="absolute inset-0 bg-[#0a0714]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(168,85,247,0.12),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(236,72,153,0.08),transparent_50%)]" />
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#a855f7_1px,transparent_1px),linear-gradient(to_bottom,#a855f7_1px,transparent_1px)] bg-[size:3rem_3rem]" />
          <div className="absolute bottom-12 right-12 text-[100px] font-serif italic text-purple-400/[0.03]">
            Socrates
          </div>
        </div>
      )}

      {/* Founder OS - Monolith Executive */}
      {os === 'founder' && (
        <div className="absolute inset-0 bg-[#080808]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.04),transparent_60%)]" />
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:5rem_5rem]" />
          <div className="absolute bottom-8 left-8 text-xs font-mono tracking-[0.3em] text-zinc-500/30 uppercase">
            FOUNDER_OS // SINGLE-OPERATOR COMMAND MATRIX
          </div>
        </div>
      )}

      {/* CRT Scanline & Grain Texture */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-15 pointer-events-none" />
    </div>
  );
};
