import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, X, Maximize2, Minimize2, RotateCw, RotateCcw, 
  ZoomIn, ZoomOut, Sliders, MapPin, Radio, ShieldAlert, 
  ShieldCheck, Crosshair, ExternalLink, RefreshCw, Eye,
  Navigation, Globe, Video, Activity, Sparkles, Check
} from 'lucide-react';
import { GeointCctvCamera } from '@/types/geoint';
import { calculateBlindSpotCoverage } from './CctvViewshedManager';
import Hls from 'hls.js';

export interface CctvFeedModalProps {
  camera: GeointCctvCamera | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateCamera?: (updated: GeointCctvCamera) => void;
  allCameras: GeointCctvCamera[];
  onSelectCamera: (cam: GeointCctvCamera) => void;
}

export const CctvFeedModal: React.FC<CctvFeedModalProps> = ({
  camera,
  isOpen,
  onClose,
  onUpdateCamera,
  allCameras,
  onSelectCamera
}) => {
  const [refreshEpoch, setRefreshEpoch] = useState<number>(Date.now());
  const [isAutoRefreshing, setIsAutoRefreshing] = useState<boolean>(true);
  const [showAiBoxes, setShowAiBoxes] = useState<boolean>(false);
  const [copiedGps, setCopiedGps] = useState<boolean>(false);
  const [filterCity, setFilterCity] = useState<string>('ALL');
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Auto-refresh snapshot every 2.5s for live DOT camera feed emulation
  useEffect(() => {
    if (!isOpen || !isAutoRefreshing) return;
    const interval = setInterval(() => {
      setRefreshEpoch(Date.now());
    }, 2500);
    return () => clearInterval(interval);
  }, [isOpen, isAutoRefreshing]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // HLS (.m3u8) and MP4 video streaming lifecycle with autoplay enforcement
  useEffect(() => {
    if (!isOpen || !camera) return;
    setHasError(false);
    setImageLoaded(false);

    const isM3u8 = camera.streamUrl?.includes('.m3u8');
    if (isM3u8 && videoRef.current) {
      let hls: Hls | null = null;
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hls.loadSource(camera.streamUrl);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(e => console.warn('HLS play error:', e));
          }
          setHasError(false);
          setImageLoaded(true);
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.warn('[HLS Stream Error]:', data.type, data.details);
            setHasError(true);
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = camera.streamUrl;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => setHasError(true));
      }
      return () => {
        if (hls) hls.destroy();
      };
    } else if (videoRef.current && camera.streamUrl.endsWith('.mp4')) {
      videoRef.current.muted = true;
      videoRef.current.play().catch(e => console.warn('MP4 play error:', e));
    }
  }, [camera?.streamUrl, isOpen]);

  // Reset error when camera changes
  useEffect(() => {
    setHasError(false);
    setImageLoaded(false);
  }, [camera?.id]);

  if (!isOpen || !camera) return null;

  const isHls = camera.streamUrl.includes('.m3u8');
  const isMp4 = camera.streamUrl.endsWith('.mp4');
  const isVideo = isMp4 || isHls;
  const isYouTube = camera.streamUrl.includes('youtube.com') || camera.streamUrl.includes('youtu.be');
  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com/embed/')) return url;
    if (url.includes('youtube.com/watch?v=')) {
      const match = url.match(/[?&]v=([^&]+)/);
      return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1&playsinline=1` : url;
    }
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1]?.split('?')[0];
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1` : url;
    }
    return url;
  };
  const blindSpotAngle = calculateBlindSpotCoverage(camera.fovDeg);
  const uniqueCities = ['ALL', ...Array.from(new Set(allCameras.map(c => c.city)))];

  const filteredCameras = filterCity === 'ALL'
    ? allCameras
    : allCameras.filter(c => c.city === filterCity);

  const handlePtzAdjust = (panDelta: number, tiltDelta: number, zoomDelta: number) => {
    if (!camera) return;
    const newPan = (camera.headingDeg + panDelta + 360) % 360;
    const newTilt = Math.max(-85, Math.min(10, camera.pitchDeg + tiltDelta));
    const newFov = Math.max(25, Math.min(110, camera.fovDeg + (zoomDelta > 0 ? -10 : zoomDelta < 0 ? 10 : 0)));
    const newRange = Math.max(50, Math.min(450, camera.rangeM + (zoomDelta > 0 ? 25 : zoomDelta < 0 ? -25 : 0)));

    const updated: GeointCctvCamera = {
      ...camera,
      headingDeg: Math.round(newPan),
      pitchDeg: Math.round(newTilt),
      fovDeg: Math.round(newFov),
      rangeM: Math.round(newRange)
    };

    if (onUpdateCamera) {
      onUpdateCamera(updated);
    }
  };

  const copyCoordinates = () => {
    const coords = `${camera.lat.toFixed(6)}, ${camera.lng.toFixed(6)}`;
    navigator.clipboard.writeText(coords);
    setCopiedGps(true);
    setTimeout(() => setCopiedGps(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        onClick={e => e.stopPropagation()}
        className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#070b14] border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(0,240,255,0.25)] overflow-hidden font-mono text-slate-200"
      >
        {/* ====================================================
            MODAL HEADER: SURVEILLANCE TELEMETRY BAR
            ==================================================== */}
        <div className="p-4 border-b border-cyan-500/20 bg-[#0d1526] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] flex-shrink-0">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm sm:text-base font-bold text-white truncate">
                  {camera.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  REAL LIVE FEED
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                  {isHls ? 'LIVE HLS M3U8 STREAM' : isMp4 ? 'MP4 VIDEO LOOP' : isYouTube ? 'YOUTUBE LIVE 24/7' : 'DOT TRAFFIC STREAM'}
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span className="text-cyan-400 font-bold">{camera.city}, {camera.country}</span>
                <span>•</span>
                <span className="text-slate-300">{camera.provider}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/50 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
              title="Close Modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ====================================================
            MODAL BODY: CINEMA SURVEILLANCE VIEWPORT + TELEMETRY
            ==================================================== */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-0">
          {/* Main 16:9 Live Video Player Viewport */}
          <div className="lg:col-span-2 p-4 flex flex-col justify-center bg-black/70 border-b lg:border-b-0 lg:border-r border-cyan-500/20">
            <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-cyan-500/50 shadow-2xl group">
              {hasError ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#070e1b] p-6 text-center text-cyan-400 space-y-3">
                  <div className="p-3 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 animate-pulse">
                    <Radio className="w-8 h-8" />
                  </div>
                  <div className="text-sm font-bold text-white tracking-widest uppercase">
                    OPTICAL CARRIER RECONNECTING
                  </div>
                  <p className="text-xs text-slate-400 max-w-md">
                    Roadside sensor feed is cycling memory buffers or undergoing scheduled municipality frame refresh.
                  </p>
                  <div className="flex items-center gap-3 pt-2">
                    <a
                      href={camera.streamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-200 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Direct Source Stream
                    </a>
                    <button
                      onClick={() => {
                        setHasError(false);
                        setRefreshEpoch(Date.now());
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry Sensor
                    </button>
                  </div>
                </div>
              ) : isYouTube ? (
                <iframe
                  key={camera.streamUrl}
                  src={getEmbedUrl(camera.streamUrl)}
                  title={camera.name}
                  className="w-full h-full border-0 pointer-events-auto"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : isVideo ? (
                <video
                  ref={videoRef}
                  key={camera.streamUrl}
                  src={isHls ? undefined : camera.streamUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  onError={() => setHasError(true)}
                  onLoadedData={() => {
                    setImageLoaded(true);
                    setHasError(false);
                    if (videoRef.current) {
                      videoRef.current.muted = true;
                      videoRef.current.play().catch(() => {});
                    }
                  }}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  key={`${camera.id}-${refreshEpoch}`}
                  src={`${camera.snapshotUrl}${camera.snapshotUrl.includes('?') ? '&' : '?'}_live=${refreshEpoch}`}
                  alt={camera.name}
                  onLoad={() => {
                    setImageLoaded(true);
                    setHasError(false);
                  }}
                  onError={() => setHasError(true)}
                  className="w-full h-full object-cover transition-opacity duration-300"
                />
              )}

              {/* Live Scanlines Overlay */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%)',
                  backgroundSize: '100% 4px'
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent pointer-events-none animate-scan" />

              {/* HUD Reticle Overlay */}
              <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between text-[10px] font-mono text-cyan-400 select-none">
                {/* Top Telemetry */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-black/75 px-2 py-0.5 rounded border border-cyan-500/40 flex items-center gap-1.5 backdrop-blur-sm">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span className="font-bold text-white tracking-wider">LIVE SURVEILLANCE</span>
                    </span>
                    <span className="bg-black/75 px-2 py-0.5 rounded border border-cyan-500/40 text-slate-300 backdrop-blur-sm">
                      {isVideo ? '1080P 30FPS H.264' : `FRAME #${Math.floor(refreshEpoch / 1000) % 99999}`}
                    </span>
                  </div>

                  <span className="bg-black/75 px-2 py-0.5 rounded border border-cyan-500/40 font-mono text-cyan-300 backdrop-blur-sm">
                    AZ: {camera.headingDeg.toFixed(1)}° | EL: {camera.pitchDeg.toFixed(1)}°
                  </span>
                </div>

                {/* Center Tactical Crosshair */}
                <div className="self-center flex items-center justify-center">
                  <div className="w-16 h-16 border border-cyan-400/40 rounded-full flex items-center justify-center relative">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
                    <div className="w-1 h-1 bg-white rounded-full absolute" />
                    <div className="absolute w-6 h-[1px] bg-cyan-400 -top-2" />
                    <div className="absolute w-6 h-[1px] bg-cyan-400 -bottom-2" />
                    <div className="absolute h-6 w-[1px] bg-cyan-400 -left-2" />
                    <div className="absolute h-6 w-[1px] bg-cyan-400 -right-2" />
                  </div>
                </div>

                {/* Optical HUD is clean - no annoying static fake boxes */}

                {/* Bottom Telemetry Bar */}
                <div className="flex items-center justify-between">
                  <span className="bg-black/75 px-2 py-0.5 rounded border border-cyan-500/40 text-slate-300 backdrop-blur-sm">
                    FOV: {camera.fovDeg}° • RANGE: {camera.rangeM}M
                  </span>
                  <span className="bg-black/75 px-2 py-0.5 rounded border border-cyan-500/40 text-emerald-400 font-bold backdrop-blur-sm">
                    LAT {camera.lat.toFixed(4)}° / LNG {camera.lng.toFixed(4)}°
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Player Control Action Bar */}
            <div className="mt-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {!isVideo && (
                  <button
                    onClick={() => setRefreshEpoch(Date.now())}
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>REFRESH FRAME</span>
                  </button>
                )}
                <button
                  onClick={() => setShowAiBoxes(s => !s)}
                  className={`px-2.5 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    showAiBoxes 
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' 
                      : 'bg-black/50 text-slate-400 border-slate-700'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>HUD OVERLAYS: {showAiBoxes ? 'ON' : 'CLEAN VIEW'}</span>
                </button>
              </div>

              {/* Direct Verification Link to Real Feed Source */}
              <a
                href={camera.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5 transition-all text-[11px]"
                title="Verify Real Public CCTV Feed Stream URL"
              >
                <span>VERIFY STREAM SOURCE</span>
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              </a>
            </div>
          </div>

          {/* Right Side: Optics Telemetry & PTZ Controls */}
          <div className="p-4 space-y-4 bg-[#090e1b] flex flex-col justify-between">
            <div className="space-y-3.5">
              {/* Telemetry Card */}
              <div className="p-3 rounded-xl bg-black/50 border border-cyan-500/30 space-y-2">
                <div className="text-[11px] font-bold text-cyan-300 uppercase flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    <span>OPTICAL TELEMETRY</span>
                  </span>
                  <span className="text-[9px] text-slate-400">MIL-SPEC HUD</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-[#0d1424] border border-slate-800">
                    <div className="text-[10px] text-slate-500">AZIMUTH (HDG)</div>
                    <div className="text-white font-bold">{camera.headingDeg}°</div>
                  </div>
                  <div className="p-2 rounded bg-[#0d1424] border border-slate-800">
                    <div className="text-[10px] text-slate-500">PITCH (ELEVATION)</div>
                    <div className="text-white font-bold">{camera.pitchDeg}°</div>
                  </div>
                  <div className="p-2 rounded bg-[#0d1424] border border-slate-800">
                    <div className="text-[10px] text-slate-500">FIELD OF VIEW</div>
                    <div className="text-white font-bold">{camera.fovDeg}° CONE</div>
                  </div>
                  <div className="p-2 rounded bg-[#0d1424] border border-slate-800">
                    <div className="text-[10px] text-slate-500">OPTICAL RANGE</div>
                    <div className="text-white font-bold">{camera.rangeM} METERS</div>
                  </div>
                </div>

                {/* GPS Coordinates Bar with Copy */}
                <div className="pt-1 flex items-center justify-between text-xs">
                  <div className="text-slate-300 font-mono flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    <span>{camera.lat.toFixed(5)}°, {camera.lng.toFixed(5)}°</span>
                  </div>
                  <button
                    onClick={copyCoordinates}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedGps ? <Check className="w-3 h-3 text-emerald-400" /> : null}
                    <span>{copiedGps ? 'COPIED' : 'COPY GPS'}</span>
                  </button>
                </div>
              </div>

              {/* Physical Blind-Spot Forensics */}
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-1.5">
                <div className="text-[11px] font-bold text-rose-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span>PHYSICAL BLIND-SPOT ARC</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40">
                    {blindSpotAngle}° SHADOW
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 italic leading-relaxed">
                  "{camera.blindSpotDesc}"
                </p>
              </div>

              {/* Interactive PTZ Optics Controller */}
              <div className="p-3 rounded-xl bg-black/50 border border-slate-800 space-y-2.5">
                <div className="text-[11px] font-bold text-slate-200 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span>LIVE PTZ GIMBAL POSITIONER</span>
                  </span>
                  <span className="text-[9px] text-cyan-400 font-bold">ACTIVE</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-xs text-center">
                  <button
                    onClick={() => handlePtzAdjust(-15, 0, 0)}
                    className="p-2 rounded bg-[#0f172a] hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500/50 text-cyan-300 font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                    title="Pan Counter-Clockwise"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="text-[9px]">PAN -15°</span>
                  </button>

                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handlePtzAdjust(0, 5, 0)}
                      className="p-1 rounded bg-[#0f172a] hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500/50 text-cyan-300 text-[9px] font-bold transition-all cursor-pointer"
                    >
                      TILT UP
                    </button>
                    <button
                      onClick={() => handlePtzAdjust(0, -5, 0)}
                      className="p-1 rounded bg-[#0f172a] hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500/50 text-cyan-300 text-[9px] font-bold transition-all cursor-pointer"
                    >
                      TILT DOWN
                    </button>
                  </div>

                  <button
                    onClick={() => handlePtzAdjust(15, 0, 0)}
                    className="p-2 rounded bg-[#0f172a] hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500/50 text-cyan-300 font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                    title="Pan Clockwise"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span className="text-[9px]">PAN +15°</span>
                  </button>
                </div>

                {/* Zoom In / Out Range Sliders */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => handlePtzAdjust(0, 0, 1)}
                    className="p-2 rounded bg-[#0f172a] hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500/50 text-cyan-300 font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>ZOOM IN (FOV -)</span>
                  </button>
                  <button
                    onClick={() => handlePtzAdjust(0, 0, -1)}
                    className="p-2 rounded bg-[#0f172a] hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500/50 text-cyan-300 font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                    <span>ZOOM OUT (FOV +)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Provider Certification */}
            <div className="p-2.5 rounded-lg bg-[#0e1626] border border-cyan-500/20 text-[10px] text-slate-400 space-y-1">
              <div className="text-cyan-300 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>OFFICIAL PUBLIC TELEMETRY PROVIDER</span>
              </div>
              <div>Authority: {camera.provider}</div>
              <div className="text-slate-500">Transport infrastructure optics streamed directly via open municipality APIs.</div>
            </div>
          </div>
        </div>

        {/* ====================================================
            MODAL FOOTER: QUICK CAMERA SWITCHER CAROUSEL
            ==================================================== */}
        <div className="p-3 border-t border-cyan-500/20 bg-[#080d18] flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-cyan-400 font-bold flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5" />
              <span>QUICK CAMERA SELECTOR ({filteredCameras.length} ONLINE)</span>
            </span>

            {/* City Selector Pills */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {uniqueCities.map(c => (
                <button
                  key={c}
                  onClick={() => setFilterCity(c)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    filterCity === c 
                      ? 'bg-cyan-400 text-black shadow-[0_0_8px_#00f0ff]' 
                      : 'bg-black/50 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Camera Horizontal Scroll Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {filteredCameras.map((cam) => {
              const isSelected = cam.id === camera.id;
              const isCamVideo = cam.streamUrl.endsWith('.mp4');

              return (
                <button
                  key={cam.id}
                  onClick={() => onSelectCamera(cam)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                      : 'bg-[#0d1424] border-slate-800 hover:border-cyan-500/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className={`p-1 rounded ${isSelected ? 'bg-cyan-400 text-black' : 'bg-slate-800 text-cyan-400'}`}>
                    <Camera className="w-3 h-3" />
                  </div>
                  <div className="max-w-[180px]">
                    <div className="text-[11px] font-bold truncate text-slate-100">{cam.name.split('—')[0]}</div>
                    <div className="text-[9px] text-cyan-400/80 truncate">{cam.city} • {isCamVideo ? 'MP4' : 'JPEG'}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
export default CctvFeedModal;
