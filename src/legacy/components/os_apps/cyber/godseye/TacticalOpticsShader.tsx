import React, { useEffect, useState } from 'react';
import { 
  Eye, Flame, Moon, Monitor, Crosshair, 
  Compass, Radio, Shield, Sparkles, AlertCircle
} from 'lucide-react';

export type TacticalOpticMode = 'NORMAL' | 'FLIR_THERMAL' | 'NVG_NIGHT_VISION' | 'CRT_RECON' | 'MIL_SPEC_HUD' | 'NOIR' | 'SNOW';

interface TacticalOpticsShaderProps {
  mode: TacticalOpticMode;
  onModeChange: (mode: TacticalOpticMode) => void;
  targetName?: string;
  coords?: [number, number]; // [lat, lng]
  elevationM?: number;
  hideHudOverlay?: boolean;
  children: React.ReactNode;
}

export const TacticalOpticsShader: React.FC<TacticalOpticsShaderProps> = ({
  mode,
  onModeChange,
  targetName = 'SECTOR TARGET ALPHA',
  coords = [36.7538, 3.0588],
  elevationM = 450,
  hideHudOverlay = false,
  children,
}) => {
  const [zuluTime, setZuluTime] = useState<string>('');
  const [azimuth, setAzimuth] = useState<number>(342);

  // Update Zulu Time and slight compass jitter
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const iso = d.toISOString().replace('T', ' ').slice(0, 23) + 'Z';
      setZuluTime(iso);
    };
    updateTime();
    const interval = setInterval(updateTime, 100);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut listener: 1-7 / H
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
        return;
      }
      if (e.key === '1') onModeChange('NORMAL');
      else if (e.key === '2') onModeChange('FLIR_THERMAL');
      else if (e.key === '3') onModeChange('NVG_NIGHT_VISION');
      else if (e.key === '4') onModeChange('CRT_RECON');
      else if (e.key === '5' || e.key.toLowerCase() === 'h') onModeChange('MIL_SPEC_HUD');
      else if (e.key === '6') onModeChange('NOIR');
      else if (e.key === '7') onModeChange('SNOW');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onModeChange]);

  // Convert decimal coords to MGRS representation string
  const formatMgrs = (lat: number, lng: number) => {
    const latHemi = lat >= 0 ? 'N' : 'S';
    const lngHemi = lng >= 0 ? 'E' : 'W';
    const zone = Math.floor((lng + 180) / 6) + 1;
    const latMin = ((Math.abs(lat) % 1) * 60).toFixed(3);
    const lngMin = ((Math.abs(lng) % 1) * 60).toFixed(3);
    return `${zone}${latHemi} ${Math.floor(Math.abs(lat))}°${latMin}' ${Math.floor(Math.abs(lng))}°${lngMin}' ${lngHemi}`;
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none font-mono">
      {/* ----------------------------------------------------
          1. OPTICAL FILTER STACK OVER CHILDREN
          ---------------------------------------------------- */}
      <div
        className={`w-full h-full transition-all duration-300 relative ${
          mode === 'FLIR_THERMAL'
            ? 'filter contrast-[160%] saturate-[280%] hue-rotate-[-50deg] invert-[0.15]'
            : mode === 'NVG_NIGHT_VISION'
            ? 'filter brightness-[115%] contrast-[240%] sepia-[100%] hue-rotate-[85deg] saturate-[350%]'
            : mode === 'CRT_RECON'
            ? 'filter contrast-[130%] brightness-[110%] saturate-[140%]'
            : mode === 'NOIR'
            ? 'filter grayscale contrast-[180%] brightness-[90%]'
            : mode === 'SNOW'
            ? 'filter contrast-[120%] brightness-[140%] saturate-[25%]'
            : ''
        }`}
      >
        {children}
      </div>

      {/* ----------------------------------------------------
          2. FLIR THERMAL IRONBOW COLOR OVERLAY
          ---------------------------------------------------- */}
      {mode === 'FLIR_THERMAL' && (
        <div className="pointer-events-none absolute inset-0 z-20 mix-blend-color animate-pulse opacity-40 bg-gradient-to-tr from-[#020024] via-[#4d0979] via-[#d6004b] to-[#ffeb3b]" />
      )}

      {/* ----------------------------------------------------
          3. NVG PHOSPHOR NOISE & VIGNETTE OVERLAY
          ---------------------------------------------------- */}
      {mode === 'NVG_NIGHT_VISION' && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {/* Circular Optic Vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,30,0,0.85)_80%,rgba(0,10,0,0.98)_100%)]" />
          {/* Phosphor Noise Screen */}
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(rgba(0,255,100,0.4) 1px, transparent 0)',
              backgroundSize: '4px 4px',
            }}
          />
          {/* Phosphor Gain Scanline */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,255,0,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]" />
          {/* Green Status Tag */}
          <div className="absolute top-4 left-4 flex items-center gap-2 px-2.5 py-1 rounded bg-black/80 border border-emerald-500/60 text-emerald-400 text-[10px] font-bold tracking-widest uppercase shadow-[0_0_12px_rgba(16,185,129,0.5)]">
            <Moon className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>NVG GEN-IV PHOSPHOR // HIGH GAIN ACTIVE</span>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          4. CRT SURVEILLANCE SCANLINES & BARREL CURVATURE
          ---------------------------------------------------- */}
      {mode === 'CRT_RECON' && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {/* Scanline bars */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px]" />
          {/* CRT Radial Vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_60%,rgba(0,0,0,0.9)_100%)] shadow-[inset_0_0_100px_rgba(0,0,0,0.9)]" />
          {/* Sweeping phosphor beam */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent h-24 animate-[scanline_6s_linear_infinite]" />
          {/* CRT Tag */}
          <div className="absolute top-4 left-4 flex items-center gap-2 px-2.5 py-1 rounded bg-black/80 border border-amber-500/60 text-amber-400 text-[10px] font-bold tracking-widest uppercase">
            <Monitor className="w-3.5 h-3.5 text-amber-400" />
            <span>REC // CH-04 SURVEILLANCE FEED 50Hz</span>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          5. MIL-SPEC HUD (HEADS-UP DISPLAY) OVERLAY
          ---------------------------------------------------- */}
      {/* ----------------------------------------------------
          5. MIL-SPEC HUD (HEADS-UP DISPLAY) OVERLAY
          ---------------------------------------------------- */}
      {!hideHudOverlay && (mode === 'MIL_SPEC_HUD' || mode === 'NORMAL') && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-3 sm:p-4 text-cyan-400/90 text-xs">
          {/* TOP HUD BAR: COMPASS AZIMUTH RIBBON */}
          <div className="flex items-center justify-between gap-4 border-b border-cyan-500/25 pb-2 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-cyan-400 animate-spin" />
              <div className="text-[10px] tracking-wider uppercase font-black">
                <span className="text-white">GEOSPATIAL SIGINT COCKPIT</span>
                <span className="text-cyan-400 mx-1.5">//</span>
                <span className="text-emerald-400">TRACKING: {targetName}</span>
              </div>
            </div>

            {/* COMPASS RIBBON */}
            <div className="hidden md:flex items-center gap-3 px-4 py-1 rounded-full bg-slate-950/80 border border-cyan-500/30 text-[10px] tracking-widest font-mono">
              <span className="opacity-40">300° W</span>
              <span className="opacity-60">320°</span>
              <span className="text-cyan-300 font-bold border-b border-cyan-400 px-1">
                {azimuth}° NNW
              </span>
              <span className="opacity-60">000° N</span>
              <span className="opacity-40">020°</span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[10px] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{zuluTime}</span>
            </div>
          </div>

          {/* CENTER RETICLE (MIL-SPEC CROSSHAIRS & PITCH LADDER) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Rangefinder Brackets */}
            <div className="relative w-48 h-48 sm:w-64 sm:h-64 border border-cyan-500/20 rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
              
              {/* Corner target brackets */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400/70" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400/70" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400/70" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400/70" />

              {/* Pitch Ladder Marks */}
              <div className="absolute -top-6 text-[9px] text-cyan-500/80 font-mono tracking-wider">+10° UP</div>
              <div className="absolute -bottom-6 text-[9px] text-cyan-500/80 font-mono tracking-wider">-10° DN</div>
            </div>
          </div>

          {/* Geographic Coordinates & Grid */}
          <div className="text-[10px] space-y-0.5 font-mono bg-black/80 p-1.5 rounded-none border border-neutral-800 max-w-xs shadow-lg">
            <div className="flex items-center gap-2 text-neutral-300">
              <span className="text-cyan-400 font-bold">LAT/LON:</span>
              <span>{coords[0].toFixed(5)}°, {coords[1].toFixed(5)}°</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-400">
              <span className="text-cyan-400 font-bold">MGRS:</span>
              <span>{formatMgrs(coords[0], coords[1])}</span>
              <span className="text-neutral-600">|</span>
              <span>ELEV: {elevationM}m MSL</span>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          6. PERSISTENT OPTICS SELECTOR CONTROLS (ALWAYS INTERACTIVE, BOTTOM-LEFT)
          ---------------------------------------------------- */}
      <div className="pointer-events-auto absolute bottom-3 left-3 z-40 flex items-center gap-1 bg-black/90 border border-neutral-800 rounded-none p-1 shadow-2xl backdrop-blur-md font-mono">
        <button
          onClick={() => onModeChange('NORMAL')}
          className={`px-2 py-0.5 rounded-none text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
            mode === 'NORMAL'
              ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(0,240,255,0.6)]'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
          title="Normal Satellite View (Hotkey 1)"
        >
          <Eye className="w-3 h-3" />
          <span>1: NORM</span>
        </button>

        <button
          onClick={() => onModeChange('FLIR_THERMAL')}
          className={`px-2 py-0.5 rounded-none text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
            mode === 'FLIR_THERMAL'
              ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-amber-400 text-white shadow-[0_0_10px_rgba(236,72,153,0.7)]'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
          title="FLIR Ironbow Thermal View (Hotkey 2)"
        >
          <Flame className="w-3 h-3 text-amber-400" />
          <span>2: FLIR</span>
        </button>

        <button
          onClick={() => onModeChange('NVG_NIGHT_VISION')}
          className={`px-2 py-0.5 rounded-none text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
            mode === 'NVG_NIGHT_VISION'
              ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.8)]'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
          title="Night Vision Goggles (Hotkey 3)"
        >
          <Moon className="w-3 h-3" />
          <span>3: NVG</span>
        </button>

        <button
          onClick={() => onModeChange('CRT_RECON')}
          className={`px-2 py-0.5 rounded-none text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
            mode === 'CRT_RECON'
              ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.7)]'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
          title="CRT Surveillance Feed (Hotkey 4)"
        >
          <Monitor className="w-3 h-3" />
          <span>4: CRT</span>
        </button>

        <button
          onClick={() => onModeChange('MIL_SPEC_HUD')}
          className={`px-2 py-0.5 rounded-none text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
            mode === 'MIL_SPEC_HUD'
              ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.7)]'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
          title="Mil-Spec Tactical HUD (Hotkey 5 or H)"
        >
          <Crosshair className="w-3 h-3" />
          <span>5: HUD</span>
        </button>

        <button
          onClick={() => onModeChange('NOIR')}
          className={`px-2 py-0.5 rounded-none text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
            mode === 'NOIR'
              ? 'bg-zinc-200 text-black shadow-[0_0_10px_rgba(255,255,255,0.7)]'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
          title="Noir Monochrome (Hotkey 6)"
        >
          <Radio className="w-3 h-3" />
          <span>6: NOIR</span>
        </button>

        <button
          onClick={() => onModeChange('SNOW')}
          className={`px-2 py-0.5 rounded-none text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
            mode === 'SNOW'
              ? 'bg-sky-200 text-black shadow-[0_0_10px_rgba(186,230,253,0.7)]'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
          title="Snow High-Contrast (Hotkey 7)"
        >
          <Sparkles className="w-3 h-3 text-sky-400" />
          <span>7: SNOW</span>
        </button>
      </div>
    </div>
  );
};
export default TacticalOpticsShader;
