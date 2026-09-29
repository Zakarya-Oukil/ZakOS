import React, { useRef, useState, useCallback, useEffect } from 'react';
import Spline from '@splinetool/react-spline';
import '@splinetool/runtime';
import {
  motion,
  useMotionValue,
  useSpring,
  AnimatePresence
} from 'framer-motion';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Activity,
  CloudSun,
  Video,
  BookOpen,
  ShieldAlert,
  Globe,
  Monitor,
  Terminal,
  Cpu,
  Radio,
  Maximize2,
  Minimize2,
  X,
  Volume2
} from 'lucide-react';
import { useJarvisVoice } from '../../hooks/useJarvisVoice';
import { jarvisApi } from '../../services/jarvisApi';
import { soundEngine } from '../../services/soundEffects';

// Draggable Holographic Spatial HUD Modals
import { JarvisTelemetryModal } from './modals/JarvisTelemetryModal';
import { JarvisWeatherModal } from './modals/JarvisWeatherModal';
import { JarvisYouTubeModal } from './modals/JarvisYouTubeModal';
import { JarvisVaultModal } from './modals/JarvisVaultModal';
import { JarvisCyberModal } from './modals/JarvisCyberModal';
import { JarvisSpiderReconModal } from './modals/JarvisSpiderReconModal';

const SCENE_URL = 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode';

interface JarvisHeroProps {
  onToggleDesktopWorkspace?: () => void;
  onOpenApp?: (appId: string) => void;
}

export const JarvisHero: React.FC<JarvisHeroProps> = ({
  onToggleDesktopWorkspace,
  onOpenApp
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sceneLoaded, setSceneLoaded] = useState(false);

  // Active Multi-Window Draggable HUD Modals
  const [activeModals, setActiveModals] = useState<{
    telemetry?: boolean;
    weather?: boolean;
    youtube?: boolean;
    vault?: boolean;
    cyber?: boolean;
    spider?: boolean;
  }>({});

  const [modalPayloads, setModalPayloads] = useState<{
    weatherCity?: string;
    youtubeQuery?: string;
    vaultNote?: string;
    cyberQuery?: string;
    spiderTarget?: string;
  }>({});

  // Chat / Query State
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [jarvisDialogue, setJarvisDialogue] = useState<string>(
    'Systems online and synchronized, Commander Zakarya. I am monitoring hardware telemetry and tactical feeds. How may I assist you today, sir?'
  );

  // Clock
  const [currentTime, setCurrentTime] = useState<string>('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Spring cursor light
  const cursorX = useMotionValue(-500);
  const cursorY = useMotionValue(-500);

  const smoothX = useSpring(cursorX, {
    stiffness: 130,
    damping: 25,
    mass: 0.25,
  });

  const smoothY = useSpring(cursorY, {
    stiffness: 130,
    damping: 25,
    mass: 0.25,
  });

  // 3D Robot Head & Visor Parallax Tracking
  const headParallaxX = useMotionValue(0);
  const headParallaxY = useMotionValue(0);
  const smoothHeadX = useSpring(headParallaxX, { stiffness: 120, damping: 22 });
  const smoothHeadY = useSpring(headParallaxY, { stiffness: 120, damping: 22 });

  const splineAppRef = useRef<any>(null);
  const dispatchActionRef = useRef<(cmd: string) => void>(() => {});

  // Voice Engine hook (Defined before dispatchAction to ensure direct access to speak)
  const {
    isMuted,
    isListening,
    isSpeaking,
    transcript,
    interimText,
    toggleMute,
    speak,
    stopSpeaking
  } = useJarvisVoice({
    onCommandDetected: (cmd) => {
      dispatchActionRef.current(cmd);
    }
  });

  // Synchronize Spline 3D Scene Variables and Materials with Speaking state
  useEffect(() => {
    if (!splineAppRef.current) return;
    try {
      const app = splineAppRef.current;
      if (typeof app.setVariable === 'function') {
        app.setVariable('isSpeaking', isSpeaking);
        app.setVariable('speaking', isSpeaking);
        app.setVariable('talking', isSpeaking);
        app.setVariable('blueEyes', isSpeaking);
        app.setVariable('eyeGlow', isSpeaking ? 1 : 0);
      }
      if (typeof app.emitEvent === 'function') {
        app.emitEvent(isSpeaking ? 'startSpeaking' : 'stopSpeaking');
      }

      // Check scene objects for emissive or color properties
      const allObjs = typeof app.getAllObjects === 'function' ? app.getAllObjects() : [];
      allObjs.forEach((o: any) => {
        const n = (o?.name || '').toLowerCase();
        if (n.includes('eye') || n.includes('visor') || n.includes('glow') || n.includes('light')) {
          if (o.material) {
            if (isSpeaking) {
              o.material.color?.set?.('#00f0ff');
              o.material.emissive?.set?.('#00f0ff');
              if ('emissiveIntensity' in o.material) o.material.emissiveIntensity = 2.5;
            } else {
              o.material.color?.set?.('#111827');
              o.material.emissive?.set?.('#000000');
              if ('emissiveIntensity' in o.material) o.material.emissiveIntensity = 0;
            }
          }
        }
      });
    } catch (err) {
      console.log('[JarvisHero] Spline eye sync:', err);
    }
  }, [isSpeaking]);

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const container = containerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const mouseX = event.clientX - bounds.left;
    const mouseY = event.clientY - bounds.top;
    cursorX.set(mouseX);
    cursorY.set(mouseY);

    // Compute normalized coordinates relative to center (-1 to +1)
    const normX = ((mouseX / bounds.width) - 0.5) * 2;
    const normY = ((mouseY / bounds.height) - 0.5) * 2;
    // Parallax tracking with the 3D robot head turn
    headParallaxX.set(normX * 10);
    headParallaxY.set(normY * 6);
  }

  const toggleModal = (modalKey: 'telemetry' | 'weather' | 'youtube' | 'vault' | 'cyber' | 'spider') => {
    soundEngine.playClick();
    setActiveModals(prev => ({
      ...prev,
      [modalKey]: !prev[modalKey]
    }));
  };

  const closeModal = (modalKey: 'telemetry' | 'weather' | 'youtube' | 'vault' | 'cyber' | 'spider') => {
    setActiveModals(prev => ({
      ...prev,
      [modalKey]: false
    }));
  };

  // Smart Intent & Action Dispatcher with Live Data Grounding
  const dispatchAction = useCallback(
    async (prompt: string) => {
      setIsProcessing(true);
      soundEngine.playCyberPing();

      try {
        // 1. Fast Intent Analysis
        const action = await jarvisApi.parseIntent(prompt);
        let directSpokenReply = '';

        if (action.type === 'open_weather') {
          const cityQuery = action.payload?.city || '';
          setModalPayloads(p => ({ ...p, weatherCity: cityQuery }));
          setActiveModals(prev => ({ ...prev, weather: true }));

          // Ground with real weather data
          try {
            const weather = await jarvisApi.getWeather(cityQuery || undefined);
            if (weather && weather.current) {
              const temp = Math.round(weather.current.temperature_2m ?? 20);
              const humidity = weather.current.relative_humidity_2m ?? 50;
              const wind = weather.current.wind_speed_10m ?? 10;
              directSpokenReply = `Currently in ${weather.city}, the temperature is ${temp}°C, humidity is at ${humidity}% with winds at ${wind} km/h, sir. Atmospheric radar deployed on your HUD.`;
            }
          } catch (e) {}
        } else if (action.type === 'open_telemetry') {
          setActiveModals(prev => ({ ...prev, telemetry: true }));

          // Ground with real hardware stats
          try {
            const telemetry = await jarvisApi.getTelemetry();
            if (telemetry && telemetry.cpu) {
              const cpuLoad = telemetry.cpu.currentLoad;
              const ramUsed = (telemetry.mem.used / (1024 * 1024 * 1024)).toFixed(1);
              const ramTotal = (telemetry.mem.total / (1024 * 1024 * 1024)).toFixed(1);
              directSpokenReply = `Host CPU load is running at ${cpuLoad}% across your ${telemetry.cpu.cores} cores, with ${ramUsed} GB of RAM in active use out of ${ramTotal} GB, sir. Hardware thermal margins are optimal.`;
            }
          } catch (e) {}
        } else if (action.type === 'open_spider') {
          const target = action.payload?.target || '192.168.100.52';
          setModalPayloads(p => ({ ...p, spiderTarget: target }));
          setActiveModals(prev => ({ ...prev, spider: true }));
          directSpokenReply = `Engaging Spider Reconnaissance and OSINT suite for target ${target}, sir. Initializing DNS enumeration, port scanning, and vulnerability discovery.`;
        } else if (action.type === 'open_vault') {
          const note = action.payload?.note || '';
          setModalPayloads(p => ({ ...p, vaultNote: note }));
          setActiveModals(prev => ({ ...prev, vault: true }));
          directSpokenReply = `Accessing your Obsidian knowledge vault at C:\\Users\\Zakar\\Documents\\Obsidian\\My_Vault, sir. 156 markdown notes indexed and ready.`;
        } else if (action.type === 'open_youtube') {
          const query = action.payload?.query || 'Cybersecurity Red Team';
          setModalPayloads(p => ({ ...p, youtubeQuery: query }));
          setActiveModals(prev => ({ ...prev, youtube: true }));
          directSpokenReply = `Deploying holographic YouTube stream for "${query}", sir.`;
        } else if (action.type === 'open_cyber') {
          setModalPayloads(p => ({ ...p, cyberQuery: action.payload?.query || prompt }));
          setActiveModals(prev => ({ ...prev, cyber: true }));
          directSpokenReply = `SecOps tactical radar engaged, sir. Monitoring active network vectors and MITRE attack matrix.`;
        } else if (action.type === 'exec_pc') {
          const appName = action.payload?.app || '';
          await jarvisApi.executePcApp(appName);
          directSpokenReply = `Dispatched application "${appName}" directly to your Windows system, sir.`;
        }

        // If no direct data reply was synthesized, query the AI Core
        let reply = directSpokenReply;
        if (!reply) {
          try {
            const aiText = await jarvisApi.askJarvis(prompt);
            if (aiText && aiText.trim()) {
              reply = aiText.trim();
            }
          } catch (e) {}
        }

        if (!reply) {
          reply = `Acknowledged, Commander Zakarya. Executing your tactical directive: "${prompt}". Operating parameters are optimal, sir.`;
        }

        setJarvisDialogue(reply);
        speak(reply);
      } catch (err: any) {
        console.error('Action error:', err);
        const fallback = `I have received your directive, sir. Interfacing directly with local subsystem.`;
        setJarvisDialogue(fallback);
        speak(fallback);
      } finally {
        setIsProcessing(false);
      }
    },
    [speak]
  );

  dispatchActionRef.current = dispatchAction;

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing) return;
    const prompt = textInput.trim();
    setTextInput('');
    dispatchAction(prompt);
  };

  return (
    <main className="relative w-full h-full min-h-screen overflow-hidden bg-[#040711] text-white select-none font-sans">
      {/* Sci-Fi Ambient Spring Cursor Light */}
      <motion.div
        className="cursor-light pointer-events-none absolute -top-[250px] -left-[250px] z-10 h-[500px] w-[500px] rounded-full opacity-60 filter blur-[20px] mix-blend-screen"
        style={{
          x: smoothX,
          y: smoothY,
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.16), rgba(168, 85, 247, 0.08) 35%, transparent 70%)'
        }}
      />

      {/* Cyber Grid Background & Subtle Vignette */}
      <div 
        className="absolute inset-0 z-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      {/* 3D Spline Robot Layer (Dead Center, Matching Image 2) */}
      <motion.div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="absolute inset-0 z-1 flex items-center justify-center overflow-hidden"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      >
        {!sceneLoaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#040711]">
            <div className="h-9 w-9 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <span className="font-mono text-[10px] tracking-widest text-cyan-400/80 uppercase">
              Initializing J.A.R.V.I.S. Neural Hologram
            </span>
          </div>
        )}

        <Spline
          scene={SCENE_URL}
          className="w-full h-full flex items-center justify-center"
          style={{
            transform: 'scale(1.08) translateY(2%)',
            transformOrigin: 'center center'
          }}
          onLoad={(app) => {
            splineAppRef.current = app;
            setSceneLoaded(true);
          }}
        />

        {/* Holographic Glowing Blue Eyes & Visor Optical Matrix (Active When Talking) */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.3 } }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="pointer-events-none absolute z-15 flex flex-col items-center justify-center select-none"
              style={{
                top: '42.8%',
                left: '50%',
                x: '-50%',
                y: '-50%',
                translateX: smoothHeadX,
                translateY: smoothHeadY,
              }}
            >
              {/* Radial Cyan-Blue Visor Aura Field */}
              <motion.div
                animate={{
                  opacity: [0.75, 1, 0.7, 0.95],
                  scale: [0.95, 1.06, 0.98, 1.04]
                }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
                className="absolute h-28 w-80 rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(0,240,255,0.5)_0%,_rgba(6,182,212,0.22)_45%,_transparent_75%)] blur-xl mix-blend-screen"
              />

              {/* Horizontal Visor Anamorphic Optical Laser Flare */}
              <motion.div
                animate={{
                  opacity: [0.7, 1, 0.75, 0.95],
                  scaleX: [0.9, 1.12, 0.95, 1.06]
                }}
                transition={{ repeat: Infinity, duration: 0.7, ease: 'easeInOut' }}
                className="absolute h-[2.5px] w-64 bg-gradient-to-r from-transparent via-cyan-200 to-transparent blur-[0.5px] shadow-[0_0_20px_#00f0ff,0_0_40px_#0284c7]"
              />

              {/* Secondary Thinner Blue Beam */}
              <motion.div
                animate={{
                  opacity: [0.5, 0.9, 0.6, 0.85],
                  scaleX: [1, 1.2, 0.95, 1.15]
                }}
                transition={{ repeat: Infinity, duration: 0.5, ease: 'easeInOut' }}
                className="absolute h-[1px] w-80 bg-gradient-to-r from-transparent via-sky-300 to-transparent shadow-[0_0_15px_#38bdf8]"
              />

              {/* Visor Slit Core / Ocular Eyes Matrix */}
              <div className="relative flex items-center justify-center gap-10 py-1 px-4">
                {/* Left Glowing Blue Eye Aperture */}
                <div className="relative flex items-center justify-center">
                  {/* Outer Cyber Reticle Bracket */}
                  <div className="absolute -inset-1.5 rounded-sm border border-cyan-400/50 opacity-80 animate-pulse" />
                  
                  {/* Left Eye Glowing Blue Core */}
                  <motion.div
                    animate={{
                      scale: [1, 1.15, 0.95, 1.1],
                      boxShadow: [
                        '0 0 16px #00f0ff, 0 0 32px #00d2ff, 0 0 50px #0284c7',
                        '0 0 25px #00f0ff, 0 0 45px #00d2ff, 0 0 70px #0284c7',
                        '0 0 18px #00f0ff, 0 0 34px #00d2ff, 0 0 55px #0284c7'
                      ]
                    }}
                    transition={{ repeat: Infinity, duration: 0.55, ease: 'easeInOut' }}
                    className="h-3 w-8 rounded-full bg-cyan-200 border border-white shadow-[0_0_20px_#00f0ff,0_0_40px_#00d2ff] transform -rotate-[5deg]"
                  />
                  {/* White-Hot Pupil Flare Core */}
                  <span className="absolute h-1.5 w-4 rounded-full bg-white blur-[0.3px]" />
                </div>

                {/* Center Helmet Visor Seam Divider */}
                <div className="flex flex-col items-center gap-1 opacity-70">
                  <span className="h-3 w-0.5 bg-cyan-300 shadow-[0_0_10px_#00f0ff]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_8px_#00f0ff]" />
                </div>

                {/* Right Glowing Blue Eye Aperture */}
                <div className="relative flex items-center justify-center">
                  {/* Outer Cyber Reticle Bracket */}
                  <div className="absolute -inset-1.5 rounded-sm border border-cyan-400/50 opacity-80 animate-pulse" />
                  
                  {/* Right Eye Glowing Blue Core */}
                  <motion.div
                    animate={{
                      scale: [1, 1.15, 0.95, 1.1],
                      boxShadow: [
                        '0 0 16px #00f0ff, 0 0 32px #00d2ff, 0 0 50px #0284c7',
                        '0 0 25px #00f0ff, 0 0 45px #00d2ff, 0 0 70px #0284c7',
                        '0 0 18px #00f0ff, 0 0 34px #00d2ff, 0 0 55px #0284c7'
                      ]
                    }}
                    transition={{ repeat: Infinity, duration: 0.55, ease: 'easeInOut' }}
                    className="h-3 w-8 rounded-full bg-cyan-200 border border-white shadow-[0_0_20px_#00f0ff,0_0_40px_#00d2ff] transform rotate-[5deg]"
                  />
                  {/* White-Hot Pupil Flare Core */}
                  <span className="absolute h-1.5 w-4 rounded-full bg-white blur-[0.3px]" />
                </div>
              </div>

              {/* Lateral Cranial / Audio Node Flares (Ear Nodes) */}
              <div className="absolute top-1/2 -translate-y-1/2 w-[250px] flex justify-between pointer-events-none px-1">
                <motion.div
                  animate={{
                    opacity: [0.4, 0.95, 0.5, 0.9],
                    scale: [0.9, 1.2, 0.95, 1.15]
                  }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut' }}
                  className="h-5 w-5 rounded-full border border-cyan-300 bg-cyan-400/40 shadow-[0_0_20px_#00f0ff,0_0_35px_#0284c7]"
                />
                <motion.div
                  animate={{
                    opacity: [0.4, 0.95, 0.5, 0.9],
                    scale: [0.9, 1.2, 0.95, 1.15]
                  }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut' }}
                  className="h-5 w-5 rounded-full border border-cyan-300 bg-cyan-400/40 shadow-[0_0_20px_#00f0ff,0_0_35px_#0284c7]"
                />
              </div>

              {/* Holographic Vocal Comm-Link Subtitle */}
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 0.85, y: 0 }}
                className="mt-3 font-mono text-[9px] tracking-widest text-cyan-300 drop-shadow-[0_0_10px_#00f0ff] uppercase flex items-center gap-1.5"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span>OCULAR COMM-LINK // VOCAL SYNTHESIS ACTIVE</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Sci-Fi HUD Corner Brackets & Frame (Directly matching Image 2) */}
      <div className="pointer-events-none absolute inset-4 z-20 flex flex-col justify-between">
        {/* Top Corners */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 font-mono text-[10px] text-cyan-400/80 tracking-wider">
            <span className="text-cyan-400 font-bold">┌───</span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span>JARVIS CORE // MK-85</span>
            </span>
            <span className="text-zinc-500">SYS: OPTIMAL</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] text-cyan-400/80 tracking-wider">
            <span className="text-zinc-500">DEFCON: 1 // SEC-OPS</span>
            <span className="px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-300">
              {currentTime || '01:50:00'}
            </span>
            <span className="text-cyan-400 font-bold">───┐</span>
          </div>
        </div>

        {/* Bottom Corners */}
        <div className="flex justify-between items-end">
          <div className="flex items-center gap-2 font-mono text-[10px] text-cyan-400/80 tracking-wider">
            <span className="text-cyan-400 font-bold">└───</span>
            <span className="text-zinc-400">HOST: WINDOWS 11 // 12-CORE CPU</span>
            <span className="text-zinc-600">// LATENCY: 2ms</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] text-cyan-400/80 tracking-wider">
            <span className="text-zinc-400">ENCRYPTION: AES-256-GCM</span>
            <span className="text-cyan-400 font-bold">───┘</span>
          </div>
        </div>
      </div>

      {/* Top Floating Holographic Control Deck */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-2xl border border-cyan-500/30 bg-[#060a14]/85 px-3 py-1.5 backdrop-blur-xl shadow-2xl">
        {/* Quick Launch Holographic Action Buttons */}
        <button
          onClick={() => toggleModal('spider')}
          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-xs transition-all ${
            activeModals.spider
              ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
          title="Spider Reconnaissance & Vulnerability Scanner"
        >
          <Globe className="h-3.5 w-3.5 text-cyan-400" />
          <span>SPIDER RECON</span>
        </button>

        <button
          onClick={() => toggleModal('telemetry')}
          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-xs transition-all ${
            activeModals.telemetry
              ? 'bg-purple-500/30 text-purple-200 border border-purple-400 font-bold shadow-[0_0_15px_rgba(168,85,247,0.4)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
          title="Hardware Telemetry Diagnostic"
        >
          <Activity className="h-3.5 w-3.5 text-purple-400" />
          <span>TELEMETRY</span>
        </button>

        <button
          onClick={() => toggleModal('weather')}
          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-xs transition-all ${
            activeModals.weather
              ? 'bg-sky-500/30 text-sky-200 border border-sky-400 font-bold shadow-[0_0_15px_rgba(56,189,248,0.4)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
          title="Live Atmospheric Weather Radar"
        >
          <CloudSun className="h-3.5 w-3.5 text-sky-400" />
          <span>WEATHER</span>
        </button>

        <button
          onClick={() => toggleModal('vault')}
          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-xs transition-all ${
            activeModals.vault
              ? 'bg-purple-500/30 text-purple-200 border border-purple-400 font-bold shadow-[0_0_15px_rgba(168,85,247,0.4)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
          title="Obsidian Knowledge Vault"
        >
          <BookOpen className="h-3.5 w-3.5 text-purple-400" />
          <span>VAULT</span>
        </button>

        <button
          onClick={() => toggleModal('youtube')}
          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-xs transition-all ${
            activeModals.youtube
              ? 'bg-red-500/30 text-red-200 border border-red-400 font-bold shadow-[0_0_15px_rgba(239,68,68,0.4)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
          title="Tactical YouTube Feed"
        >
          <Video className="h-3.5 w-3.5 text-red-400" />
          <span>YOUTUBE</span>
        </button>

        <button
          onClick={() => toggleModal('cyber')}
          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-xs transition-all ${
            activeModals.cyber
              ? 'bg-red-500/30 text-red-200 border border-red-400 font-bold shadow-[0_0_15px_rgba(239,68,68,0.4)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
          title="SecOps Tactical Radar"
        >
          <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
          <span>CYBER C2</span>
        </button>

        <div className="h-4 w-px bg-white/10 mx-1" />

        {/* Audio Frequency Waveform Visualizer */}
        <button
          onClick={() => {
            if (isSpeaking) {
              stopSpeaking();
            } else {
              speak('Commander Zakarya, J.A.R.V.I.S. neural ocular link is active. Glowing blue eyes and vocal synthesis are fully engaged, sir.');
            }
          }}
          className="flex items-center gap-0.5 px-2 cursor-pointer hover:opacity-90 transition rounded p-0.5"
          title="Click to test vocal synthesis & glowing blue eyes"
        >
          {[40, 75, 100, 60, 85, 45, 90, 30].map((h, i) => (
            <span
              key={i}
              className={`w-1 rounded-full transition-all duration-200 ${
                isSpeaking
                  ? 'bg-cyan-400 animate-pulse'
                  : isListening
                  ? 'bg-emerald-400 animate-bounce'
                  : 'bg-cyan-500/30'
              }`}
              style={{
                height: `${(isSpeaking || isListening ? (h * 0.22) : 4)}px`,
                animationDelay: `${i * 0.1}s`
              }}
            />
          ))}
        </button>
      </div>

      {/* Center-Bottom Cyber Command Prompt Deck */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-4 pointer-events-auto">
        <div className="rounded-2xl border border-cyan-500/30 bg-[#060a14]/90 p-3.5 backdrop-blur-2xl shadow-2xl">
          {/* Header row: Mic + JARVIS Status */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2.5">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMute}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
                  isMuted
                    ? 'border-red-500/40 bg-red-500/15 text-red-400'
                    : isSpeaking
                    ? 'border-cyan-400/60 bg-cyan-500/25 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                    : isListening
                    ? 'border-emerald-400/60 bg-emerald-500/25 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                    : 'border-cyan-500/20 bg-white/5 text-zinc-300'
                }`}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 animate-pulse" />}
                {!isMuted && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                )}
              </button>

              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-white font-mono">
                  <span>J.A.R.V.I.S. TACTICAL CORE</span>
                  <button
                    onClick={() => {
                      if (isSpeaking) {
                        stopSpeaking();
                      } else {
                        speak('Commander Zakarya, J.A.R.V.I.S. voice and ocular matrix are online. Blue glowing eyes and subsystems are fully operational, sir.');
                      }
                    }}
                    className={`rounded px-1.5 py-0.5 text-[9px] font-mono border transition cursor-pointer ${
                      isSpeaking
                        ? 'bg-cyan-400 text-black font-bold border-cyan-300 shadow-[0_0_12px_#00f0ff]'
                        : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/40'
                    }`}
                    title="Click to test vocal synthesis & ocular blue eyes"
                  >
                    {isSpeaking ? '● TALKING (STOP)' : 'VOICE ONLINE (TEST)'}
                  </button>
                </div>
                <div className="text-[10px] text-cyan-400/80 font-mono">
                  {isSpeaking
                    ? 'Transmitting tactical synthesis (Blue Eyes Active)...'
                    : isMuted
                    ? 'Microphone Standby (Muted)'
                    : isListening
                    ? 'Monitoring voice directives...'
                    : 'Tactical Standby'}
                </div>
              </div>
            </div>

            {/* Switch to Legacy Desktop */}
            {onToggleDesktopWorkspace && (
              <button
                onClick={onToggleDesktopWorkspace}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-mono text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
                title="Switch to ZakOS Multi-Window Desktop"
              >
                <Monitor className="h-3 w-3 text-cyan-400" />
                <span>ZakOS Desktop</span>
              </button>
            )}
          </div>

          {/* Dialogue Display Box */}
          <div className={`font-mono text-xs leading-relaxed text-zinc-200 bg-black/50 rounded-xl p-3 border transition-all duration-300 max-h-24 overflow-y-auto ${
            isSpeaking ? 'border-cyan-400/60 shadow-[0_0_20px_rgba(0,240,255,0.25)]' : 'border-white/5'
          }`}>
            <span className={`font-bold mr-2 transition-colors ${isSpeaking ? 'text-cyan-300 drop-shadow-[0_0_8px_#00f0ff]' : 'text-cyan-400'}`}>
              [JARVIS]:
            </span>
            {jarvisDialogue}
            {interimText && (
              <div className="text-emerald-400/90 italic text-[11px] mt-1 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>"{interimText}"</span>
              </div>
            )}
          </div>

          {/* Input & Execution Bar */}
          <form onSubmit={handleTextSubmit} className="mt-2.5 flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ask JARVIS (e.g., 'Scan target 192.168.100.52', 'Show CPU load', 'Weather in London', 'Open Obsidian')..."
              className="w-full rounded-xl border border-cyan-500/30 bg-black/50 px-3.5 py-2 font-mono text-xs text-cyan-100 placeholder-zinc-500 focus:border-cyan-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isProcessing}
              className="flex items-center justify-center rounded-xl border border-cyan-400/50 bg-cyan-500/25 px-4 text-cyan-200 transition-all hover:bg-cyan-500/40 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          {/* Quick Prompt Suggestions */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-zinc-400">
            <span className="text-zinc-500 uppercase">Directives:</span>
            {[
              'Scan target 192.168.100.52',
              'Show CPU telemetry',
              'Weather today',
              'Open Obsidian vault',
              'Open Wireshark'
            ].map((q, i) => (
              <button
                key={i}
                onClick={() => dispatchAction(q)}
                className="rounded border border-white/5 bg-white/[0.03] px-2 py-0.5 text-zinc-400 hover:border-cyan-500/30 hover:text-cyan-300 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Draggable Holographic Spatial Windows Layer (Non-Blocking, Moveable Anywhere) */}
      <AnimatePresence>
        {activeModals.spider && (
          <div className="fixed top-16 left-24 z-50 pointer-events-auto">
            <JarvisSpiderReconModal
              initialTarget={modalPayloads.spiderTarget}
              onClose={() => closeModal('spider')}
            />
          </div>
        )}

        {activeModals.telemetry && (
          <div className="fixed top-20 left-12 z-50 pointer-events-auto">
            <JarvisTelemetryModal onClose={() => closeModal('telemetry')} />
          </div>
        )}

        {activeModals.weather && (
          <div className="fixed top-20 right-12 z-50 pointer-events-auto">
            <JarvisWeatherModal
              initialCity={modalPayloads.weatherCity}
              onClose={() => closeModal('weather')}
            />
          </div>
        )}

        {activeModals.vault && (
          <div className="fixed bottom-24 left-16 z-50 pointer-events-auto">
            <JarvisVaultModal
              initialNoteQuery={modalPayloads.vaultNote}
              onClose={() => closeModal('vault')}
            />
          </div>
        )}

        {activeModals.youtube && (
          <div className="fixed bottom-24 right-16 z-50 pointer-events-auto">
            <JarvisYouTubeModal
              initialQuery={modalPayloads.youtubeQuery}
              onClose={() => closeModal('youtube')}
            />
          </div>
        )}

        {activeModals.cyber && (
          <div className="fixed top-28 left-1/4 z-50 pointer-events-auto">
            <JarvisCyberModal
              initialTarget={modalPayloads.cyberQuery}
              onClose={() => closeModal('cyber')}
              onOpenApp={onOpenApp}
            />
          </div>
        )}
      </AnimatePresence>
    </main>
  );
};
