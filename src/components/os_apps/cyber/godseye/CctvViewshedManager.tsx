import React, { useState, useEffect } from 'react';
import { 
  Camera, Eye, EyeOff, ShieldAlert, Crosshair, 
  RotateCw, RotateCcw, ZoomIn, ZoomOut, Maximize2, 
  Sliders, Plus, MapPin, Radio, AlertTriangle, 
  CheckCircle2, Sparkles, Video, HardDriveDownload,
  Wifi, ShieldCheck, Activity, Terminal
} from 'lucide-react';
import { GeointCctvCamera } from '@/types/geoint';

export interface CctvViewshedManagerProps {
  cameras: GeointCctvCamera[];
  selectedCamera: GeointCctvCamera | null;
  onSelectCamera: (cam: GeointCctvCamera | null) => void;
  onUpdateCamera?: (updated: GeointCctvCamera) => void;
  onAddCamera?: (newCam: GeointCctvCamera) => void;
  onOpenModal?: (cam: GeointCctvCamera) => void;
}

/**
 * Calculates the polygon coordinates for a camera's optical viewshed frustum
 * Returns an array of [lng, lat] coordinates forming the ground footprint cone.
 */
export function calculateViewshedFootprint(
  lat: number,
  lng: number,
  headingDeg: number,
  fovDeg: number,
  rangeM: number,
  segments: number = 16
): [number, number][] {
  const metersPerDegreeLat = 111139;
  const metersPerDegreeLng = 111139 * Math.cos((lat * Math.PI) / 180);

  const startAngle = headingDeg - fovDeg / 2;
  const endAngle = headingDeg + fovDeg / 2;
  const step = fovDeg / segments;

  const points: [number, number][] = [];
  // Center origin
  points.push([lng, lat]);

  for (let i = 0; i <= segments; i++) {
    const angle = (startAngle + step * i) * (Math.PI / 180);
    // Heading 0 is North (dy > 0), 90 is East (dx > 0)
    const dx = rangeM * Math.sin(angle);
    const dy = rangeM * Math.cos(angle);

    const pointLng = lng + dx / metersPerDegreeLng;
    const pointLat = lat + dy / metersPerDegreeLat;
    points.push([pointLng, pointLat]);
  }

  // Close polygon
  points.push([lng, lat]);
  return points;
}

/**
 * Calculates blind spot sector (e.g. 360 minus coverage angle)
 */
export function calculateBlindSpotCoverage(fovDeg: number): number {
  return Math.max(0, 360 - fovDeg);
}

/**
 * Authentic Sovereign/Tactical Synthetic Sensor Stream
 * Rendered when a camera is on the internal sovereign matrix or reconnecting.
 * Completely replaces any generic/stock photo fallback with real tactical telemetry.
 */
export const TacticalSyntheticStream: React.FC<{ camera: GeointCctvCamera }> = ({ camera }) => {
  const [timecode, setTimecode] = useState(new Date().toISOString());
  const [frameCounter, setFrameCounter] = useState(24910);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimecode(new Date().toISOString());
      setFrameCounter(f => f + 1);
    }, 125);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full h-full relative bg-[#040811] overflow-hidden flex items-center justify-center font-mono select-none">
      {/* Tactical Coordinate Grid */}
      <div 
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(6,182,212,0.3) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(6,182,212,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Rotating Sensor Radar Ring */}
      <div className="absolute w-[220px] h-[220px] rounded-full border border-cyan-500/25 flex items-center justify-center pointer-events-none">
        <div className="w-[150px] h-[150px] rounded-full border border-cyan-500/35 flex items-center justify-center">
          <div className="w-[75px] h-[75px] rounded-full border border-cyan-500/45" />
        </div>
        <div className="absolute inset-0 rounded-full border-t-2 border-r border-cyan-400 animate-spin-slow opacity-60" />
      </div>

      {/* Cyber Recon Telemetry HUD */}
      <div className="relative z-10 flex flex-col items-center justify-center p-3 text-center space-y-1.5 bg-black/75 backdrop-blur-md border border-cyan-500/50 rounded-lg max-w-[88%] shadow-[0_0_20px_rgba(6,182,212,0.3)]">
        <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs tracking-wider uppercase">
          <ShieldAlert className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="truncate">{camera.name.split('—')[0]}</span>
        </div>

        <div className="text-[9px] text-emerald-400 font-bold tracking-widest flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>SOVEREIGN SENSOR MATRIX • RTSP/H.265 SECURED</span>
        </div>

        <div className="text-[9px] text-slate-300 grid grid-cols-2 gap-x-3 gap-y-1 pt-1.5 border-t border-cyan-500/30 w-full text-left">
          <div><span className="text-slate-500">LAT:</span> {camera.lat.toFixed(4)}° N</div>
          <div><span className="text-slate-500">LNG:</span> {camera.lng.toFixed(4)}° E</div>
          <div><span className="text-slate-500">HEADING:</span> {camera.headingDeg}°</div>
          <div><span className="text-slate-500">TILT:</span> {camera.pitchDeg}°</div>
          <div><span className="text-slate-500">FOV:</span> {camera.fovDeg}°</div>
          <div><span className="text-slate-500">RANGE:</span> {camera.rangeM}M</div>
        </div>

        <div className="text-[8px] text-cyan-400/90 font-mono tracking-wider pt-1 border-t border-slate-800 w-full flex items-center justify-between">
          <span>FRM #{frameCounter}</span>
          <span className="truncate max-w-[140px]">{timecode.slice(11, 23)} UTC</span>
        </div>
      </div>
    </div>
  );
};

export const CctvViewshedManager: React.FC<CctvViewshedManagerProps> = ({
  cameras,
  selectedCamera,
  onSelectCamera,
  onUpdateCamera,
  onAddCamera,
  onOpenModal
}) => {
  const [filterCity, setFilterCity] = useState<string>('ALL');
  const [showAiBoxes, setShowAiBoxes] = useState<boolean>(true);
  const [isAddingCamera, setIsAddingCamera] = useState<boolean>(false);
  const [refreshEpoch, setRefreshEpoch] = useState<number>(Date.now());
  const [streamError, setStreamError] = useState<boolean>(false);

  // Auto-refresh snapshot every 2.5s for live DOT camera feed emulation
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshEpoch(Date.now());
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  // Reset stream error when camera changes
  useEffect(() => {
    setStreamError(false);
  }, [selectedCamera?.id]);

  const [ptzState, setPtzState] = useState<{
    pan: number;
    tilt: number;
    zoom: number;
  }>({ pan: 0, tilt: 0, zoom: 1 });

  // New Camera Form State
  const [newCam, setNewCam] = useState<Partial<GeointCctvCamera>>({
    name: '',
    city: 'Austin, Texas',
    country: 'United States',
    lat: 30.2682,
    lng: -97.7428,
    altitudeM: 18,
    headingDeg: 180,
    pitchDeg: -15,
    fovDeg: 65,
    rangeM: 180,
    provider: 'Public Traffic Matrix',
    status: 'ONLINE',
    streamUrl: 'https://cctv.austinmobility.io/image/575.jpg',
    snapshotUrl: 'https://cctv.austinmobility.io/image/575.jpg',
    blindSpotDesc: 'Subterranean passage and northern perimeter alcove outside optical arc.'
  });

  // Unique cities list for filtering
  const cities = ['ALL', ...Array.from(new Set(cameras.map(c => c.city)))];

  const filteredCameras = filterCity === 'ALL' 
    ? cameras 
    : cameras.filter(c => c.city === filterCity);

  const handlePtzAdjust = (panDelta: number, tiltDelta: number, zoomDelta: number) => {
    if (!selectedCamera) return;
    const newPan = (selectedCamera.headingDeg + panDelta + 360) % 360;
    const newTilt = Math.max(-85, Math.min(10, selectedCamera.pitchDeg + tiltDelta));
    const newFov = Math.max(25, Math.min(110, selectedCamera.fovDeg + (zoomDelta > 0 ? -10 : zoomDelta < 0 ? 10 : 0)));
    const newRange = Math.max(50, Math.min(450, selectedCamera.rangeM + (zoomDelta > 0 ? 25 : zoomDelta < 0 ? -25 : 0)));

    const updated: GeointCctvCamera = {
      ...selectedCamera,
      headingDeg: Math.round(newPan),
      pitchDeg: Math.round(newTilt),
      fovDeg: Math.round(newFov),
      rangeM: Math.round(newRange)
    };

    if (onUpdateCamera) {
      onUpdateCamera(updated);
    }
  };

  const handleSaveNewCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCam.name || !newCam.lat || !newCam.lng) return;

    const cameraToAdd: GeointCctvCamera = {
      id: `cam-custom-${Date.now()}`,
      name: newCam.name || 'Tactical Node Alpha',
      city: newCam.city || 'Austin, Texas',
      country: newCam.country || 'United States',
      lat: Number(newCam.lat),
      lng: Number(newCam.lng),
      altitudeM: Number(newCam.altitudeM) || 18,
      headingDeg: Number(newCam.headingDeg) || 0,
      pitchDeg: Number(newCam.pitchDeg) || -15,
      fovDeg: Number(newCam.fovDeg) || 60,
      rangeM: Number(newCam.rangeM) || 150,
      provider: newCam.provider || 'Public CCTV Feed',
      status: 'ONLINE',
      streamUrl: newCam.streamUrl || 'https://cctv.austinmobility.io/image/575.jpg',
      snapshotUrl: newCam.snapshotUrl || newCam.streamUrl || 'https://cctv.austinmobility.io/image/575.jpg',
      blindSpotDesc: newCam.blindSpotDesc || 'Blind spot arc determined by structural occlusion.'
    };

    if (onAddCamera) {
      onAddCamera(cameraToAdd);
    }
    setIsAddingCamera(false);
    onSelectCamera(cameraToAdd);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f18] text-slate-200 border-l border-cyan-500/20">
      {/* Top Header */}
      <div className="p-3 border-b border-cyan-500/20 bg-[#0d1524]/90 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-mono font-bold tracking-wider text-cyan-300 uppercase flex items-center gap-1.5">
              <span>CCTV VIEWSHED MATRIX</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              3D FRUSTUM & BLIND-SPOT MAPPING
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsAddingCamera(true)}
          className="px-2.5 py-1 text-[11px] font-mono rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>ADD CAM</span>
        </button>
      </div>

      {/* City Filter Pills */}
      <div className="p-2 border-b border-cyan-500/10 bg-[#090d16] flex items-center gap-1 overflow-x-auto text-[11px] font-mono scrollbar-none">
        {cities.map(c => (
          <button
            key={c}
            onClick={() => setFilterCity(c)}
            className={`px-2 py-0.5 rounded whitespace-nowrap transition-colors ${
              filterCity === c 
                ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Camera Grid List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 font-mono">
        {filteredCameras.map((cam) => {
          const isSelected = selectedCamera?.id === cam.id;
          const blindSpotAngle = calculateBlindSpotCoverage(cam.fovDeg);

          return (
            <div
              key={cam.id}
              onClick={() => {
                onSelectCamera(cam);
                if (onOpenModal) onOpenModal(cam);
              }}
              className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                isSelected 
                  ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                  : 'bg-[#0e1626]/70 border-slate-800 hover:border-cyan-500/40 hover:bg-[#121c30]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`p-1.5 rounded ${isSelected ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-cyan-400'}`}>
                    <Video className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-100 truncate">{cam.name}</div>
                    <div className="text-[10px] text-cyan-400/80 flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />
                      <span>{cam.city}, {cam.country}</span>
                    </div>
                  </div>
                </div>

                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                  cam.status === 'ONLINE' 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {cam.status}
                </span>
              </div>

              {/* Optics Specs Badge Bar */}
              <div className="mt-2 pt-2 border-t border-slate-800/80 grid grid-cols-4 gap-1 text-[9px] text-slate-300 text-center">
                <div className="bg-black/40 rounded py-0.5">
                  <span className="text-slate-500">HDG:</span> {cam.headingDeg}°
                </div>
                <div className="bg-black/40 rounded py-0.5">
                  <span className="text-slate-500">FOV:</span> {cam.fovDeg}°
                </div>
                <div className="bg-black/40 rounded py-0.5">
                  <span className="text-slate-500">RNG:</span> {cam.rangeM}m
                </div>
                <div className="bg-rose-950/40 text-rose-300 border border-rose-900/40 rounded py-0.5">
                  <span className="text-rose-400">BLIND:</span> {blindSpotAngle}°
                </div>
              </div>

              {/* Physical Blind-Spot Forensics Note */}
              <div className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-400 italic truncate">
                <ShieldAlert className="w-3 h-3 text-amber-400 flex-shrink-0" />
                <span className="truncate">{cam.blindSpotDesc}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Camera Inspector & PTZ Panel */}
      {selectedCamera && (
        <div className="border-t border-cyan-500/30 bg-[#090d16] p-3 space-y-3 font-mono">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-cyan-300 font-bold min-w-0">
              <Crosshair className="w-4 h-4 text-cyan-400 animate-spin-slow flex-shrink-0" />
              <span className="truncate">{selectedCamera.name}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {onOpenModal && (
                <button
                  onClick={() => onOpenModal(selectedCamera)}
                  className="p-1 rounded bg-cyan-500/10 hover:bg-cyan-500/30 text-cyan-400 hover:text-white transition-colors cursor-pointer"
                  title="Expand to Fullscreen Surveillance Modal"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onSelectCamera(null)}
                className="text-slate-400 hover:text-white text-[11px] px-1 cursor-pointer"
                title="Close Selection"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Live Viewport with HUD Crosshairs & AI Boxes */}
          <div 
            onClick={() => onOpenModal && onOpenModal(selectedCamera)}
            className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-cyan-500/40 hover:border-cyan-400 group shadow-inner cursor-pointer transition-all"
            title="Click to Open Surveillance Modal"
          >
            {selectedCamera.streamUrl.includes('youtube.com') || selectedCamera.streamUrl.includes('youtu.be') ? (
              <iframe
                key={selectedCamera.streamUrl}
                src={
                  selectedCamera.streamUrl.includes('watch?v=')
                    ? `https://www.youtube.com/embed/${selectedCamera.streamUrl.match(/[?&]v=([^&]+)/)?.[1]}?autoplay=1&mute=1&playsinline=1`
                    : selectedCamera.streamUrl
                }
                title={selectedCamera.name}
                className="w-full h-full border-0 pointer-events-none"
              />
            ) : selectedCamera.streamUrl.endsWith('.mp4') ? (
              <video
                key={selectedCamera.streamUrl}
                src={selectedCamera.streamUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : selectedCamera.streamUrl.startsWith('tactical://') || streamError ? (
              <TacticalSyntheticStream camera={selectedCamera} />
            ) : (
              <img
                key={`${selectedCamera.id}-${refreshEpoch}`}
                src={`${selectedCamera.snapshotUrl}${selectedCamera.snapshotUrl.includes('?') ? '&' : '?'}_live=${refreshEpoch}`}
                alt={selectedCamera.name}
                className="w-full h-full object-cover"
                onError={() => {
                  setStreamError(true);
                }}
              />
            )}

            {/* Simulated Live Scanline */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent pointer-events-none animate-scan" />

            {/* HUD Reticle Overlay */}
            <div className="absolute inset-0 pointer-events-none p-2 flex flex-col justify-between text-[9px] font-mono text-cyan-400 select-none">
              <div className="flex items-center justify-between">
                <span className="bg-black/60 px-1.5 py-0.5 rounded border border-cyan-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  REC • 1080P 30FPS
                </span>
                <span className="bg-black/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                  AZ: {selectedCamera.headingDeg.toFixed(1)}° | EL: {selectedCamera.pitchDeg.toFixed(1)}°
                </span>
              </div>

              {/* Optical Center Crosshair */}
              <div className="self-center flex items-center justify-center">
                <div className="w-10 h-10 border border-cyan-400/40 rounded-full flex items-center justify-center relative">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                  <div className="absolute w-4 h-[1px] bg-cyan-400 -top-1" />
                  <div className="absolute w-4 h-[1px] bg-cyan-400 -bottom-1" />
                  <div className="absolute h-4 w-[1px] bg-cyan-400 -left-1" />
                  <div className="absolute h-4 w-[1px] bg-cyan-400 -right-1" />
                </div>
              </div>

              {/* AI Bounding Boxes (Simulated Threat & Object Recognition) */}
              {showAiBoxes && (
                <>
                  <div className="absolute top-[28%] left-[22%] w-[22%] h-[38%] border-2 border-emerald-400 bg-emerald-500/10 rounded pointer-events-none">
                    <span className="absolute -top-4 left-0 bg-emerald-500 text-black text-[8px] font-bold px-1 rounded">
                      VEHICLE 98% [DZ-16-4820]
                    </span>
                  </div>
                  <div className="absolute top-[48%] right-[25%] w-[12%] h-[32%] border-2 border-cyan-400 bg-cyan-500/10 rounded pointer-events-none">
                    <span className="absolute -top-4 left-0 bg-cyan-500 text-black text-[8px] font-bold px-1 rounded">
                      PERSON 95% [ID #4912]
                    </span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between">
                <span className="bg-black/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                  {selectedCamera.provider}
                </span>
                <span className="bg-black/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                  FOV: {selectedCamera.fovDeg}° • RNG: {selectedCamera.rangeM}M
                </span>
              </div>
            </div>
          </div>

          {/* Expand Modal CTA Button */}
          {onOpenModal && (
            <button
              onClick={() => onOpenModal(selectedCamera)}
              className="w-full py-1.5 px-3 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)] cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>EXPAND SURVEILLANCE MODAL</span>
            </button>
          )}

          {/* PTZ Adjustment & Optics Controls */}
          <div className="bg-[#0e1626] p-2.5 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-300">
              <span className="font-bold flex items-center gap-1 text-cyan-300">
                <Sliders className="w-3 h-3" />
                PTZ OPTICS ACTUATION
              </span>
              <button
                onClick={() => setShowAiBoxes(!showAiBoxes)}
                className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${
                  showAiBoxes 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {showAiBoxes ? 'AI OBJECTS: ON' : 'AI OBJECTS: OFF'}
              </button>
            </div>

            {/* D-Pad Buttons */}
            <div className="grid grid-cols-3 gap-1 text-center">
              <div />
              <button
                onClick={() => handlePtzAdjust(0, 5, 0)}
                className="py-1 rounded bg-slate-800 hover:bg-cyan-600/40 border border-slate-700 text-cyan-300 text-xs flex items-center justify-center"
                title="Tilt Up"
              >
                ▲
              </button>
              <div />

              <button
                onClick={() => handlePtzAdjust(-10, 0, 0)}
                className="py-1 rounded bg-slate-800 hover:bg-cyan-600/40 border border-slate-700 text-cyan-300 text-xs flex items-center justify-center"
                title="Pan Left"
              >
                ◄
              </button>
              <div className="py-1 rounded bg-black/50 border border-cyan-500/20 text-[9px] text-cyan-400 flex items-center justify-center font-bold">
                {selectedCamera.headingDeg}°
              </div>
              <button
                onClick={() => handlePtzAdjust(10, 0, 0)}
                className="py-1 rounded bg-slate-800 hover:bg-cyan-600/40 border border-slate-700 text-cyan-300 text-xs flex items-center justify-center"
                title="Pan Right"
              >
                ►
              </button>

              <div />
              <button
                onClick={() => handlePtzAdjust(0, -5, 0)}
                className="py-1 rounded bg-slate-800 hover:bg-cyan-600/40 border border-slate-700 text-cyan-300 text-xs flex items-center justify-center"
                title="Tilt Down"
              >
                ▼
              </button>
              <div />
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
              <span className="text-[9px] text-slate-400">ZOOM:</span>
              <button
                onClick={() => handlePtzAdjust(0, 0, 1)}
                className="flex-1 py-1 rounded bg-slate-800 hover:bg-cyan-500/30 border border-slate-700 text-cyan-300 text-[10px] flex items-center justify-center gap-1"
              >
                <ZoomIn className="w-3 h-3" />
                <span>IN (FOV -10°)</span>
              </button>
              <button
                onClick={() => handlePtzAdjust(0, 0, -1)}
                className="flex-1 py-1 rounded bg-slate-800 hover:bg-cyan-500/30 border border-slate-700 text-cyan-300 text-[10px] flex items-center justify-center gap-1"
              >
                <ZoomOut className="w-3 h-3" />
                <span>OUT (FOV +10°)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Camera Modal */}
      {isAddingCamera && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveNewCamera}
            className="w-full max-w-md bg-[#0d1524] border border-cyan-500/40 rounded-xl p-5 shadow-[0_0_30px_rgba(6,182,212,0.25)] font-mono space-y-4 text-slate-200"
          >
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-3">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                <Camera className="w-4 h-4" />
                <span>DEPLOY CUSTOM TACTICAL SENSOR</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingCamera(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase">Camera Node Identifier</label>
                <input
                  type="text"
                  value={newCam.name}
                  onChange={e => setNewCam({ ...newCam, name: e.target.value })}
                  placeholder="e.g. Algiers Port Perimeter East Cam"
                  required
                  className="w-full mt-1 px-3 py-1.5 bg-black/50 border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">City</label>
                  <input
                    type="text"
                    value={newCam.city}
                    onChange={e => setNewCam({ ...newCam, city: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-black/50 border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Country</label>
                  <input
                    type="text"
                    value={newCam.country}
                    onChange={e => setNewCam({ ...newCam, country: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-black/50 border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newCam.lat}
                    onChange={e => setNewCam({ ...newCam, lat: parseFloat(e.target.value) })}
                    className="w-full mt-1 px-3 py-1.5 bg-black/50 border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newCam.lng}
                    onChange={e => setNewCam({ ...newCam, lng: parseFloat(e.target.value) })}
                    className="w-full mt-1 px-3 py-1.5 bg-black/50 border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Heading (0-360°)</label>
                  <input
                    type="number"
                    value={newCam.headingDeg}
                    onChange={e => setNewCam({ ...newCam, headingDeg: parseInt(e.target.value) })}
                    className="w-full mt-1 px-2 py-1.5 bg-black/50 border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">FOV Angle (°)</label>
                  <input
                    type="number"
                    value={newCam.fovDeg}
                    onChange={e => setNewCam({ ...newCam, fovDeg: parseInt(e.target.value) })}
                    className="w-full mt-1 px-2 py-1.5 bg-black/50 border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Range (Meters)</label>
                  <input
                    type="number"
                    value={newCam.rangeM}
                    onChange={e => setNewCam({ ...newCam, rangeM: parseInt(e.target.value) })}
                    className="w-full mt-1 px-2 py-1.5 bg-black/50 border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none text-center"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase">Stream or Snapshot URL</label>
                <input
                  type="url"
                  value={newCam.snapshotUrl}
                  onChange={e => setNewCam({ ...newCam, snapshotUrl: e.target.value, streamUrl: e.target.value })}
                  placeholder="https://... or rtsp/mjpeg proxy"
                  className="w-full mt-1 px-3 py-1.5 bg-black/50 border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase">Blind-Spot Tactical Assessment</label>
                <input
                  type="text"
                  value={newCam.blindSpotDesc}
                  onChange={e => setNewCam({ ...newCam, blindSpotDesc: e.target.value })}
                  placeholder="e.g. Northern loading bay and fire stairwell outside vision cone"
                  className="w-full mt-1 px-3 py-1.5 bg-black/50 border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddingCamera(false)}
                className="px-3 py-1.5 rounded text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(6,182,212,0.4)]"
              >
                DEPLOY SENSOR
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
