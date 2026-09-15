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
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  Activity,
  CloudSun,
  Video,
  BookOpen,
  ShieldAlert,
  ArrowRight,
  Maximize2,
  Minimize2,
  Radio,
  Sliders
} from 'lucide-react';
import { useJarvisVoice } from '../../hooks/useJarvisVoice';
import { jarvisApi } from '../../services/jarvisApi';
import { soundEngine } from '../../services/soundEffects';

// HUD Modals
import { JarvisTelemetryModal } from './modals/JarvisTelemetryModal';
import { JarvisWeatherModal } from './modals/JarvisWeatherModal';
import { JarvisYouTubeModal } from './modals/JarvisYouTubeModal';
import { JarvisVaultModal } from './modals/JarvisVaultModal';
import { JarvisCyberModal } from './modals/JarvisCyberModal';

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

  // Active Modals
  const [activeModal, setActiveModal] = useState<
    'telemetry' | 'weather' | 'youtube' | 'vault' | 'cyber' | null
  >(null);
  const [modalPayload, setModalPayload] = useState<any>({});

  // Chat / Query State
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [jarvisDialogue, setJarvisDialogue] = useState<string>(
    'Systems online and synchronized, Commander Zakarya. I am monitoring hardware telemetry and tactical feeds. How may I assist you today, sir?'
  );

  // Spring mouse cursor glow
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

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const container = containerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    cursorX.set(event.clientX - bounds.left);
    cursorY.set(event.clientY - bounds.top);
  }

  // Handle Intent / Action Dispatching
  const dispatchAction = useCallback(
    async (prompt: string) => {
      setIsProcessing(true);
      soundEngine.playCyberPing();

      try {
        // 1. Fast Intent Analysis
        const action = await jarvisApi.parseIntent(prompt);

        if (action.type === 'open_telemetry') {
          setActiveModal('telemetry');
        } else if (action.type === 'open_weather') {
          setModalPayload({ city: action.payload?.city || '' });
          setActiveModal('weather');
        } else if (action.type === 'open_youtube') {
          setModalPayload({ query: action.payload?.query || '' });
          setActiveModal('youtube');
        } else if (action.type === 'open_vault') {
          setModalPayload({ note: action.payload?.note || '' });
          setActiveModal('vault');
        } else if (action.type === 'open_cyber') {
          setModalPayload({ query: action.payload?.query || '' });
          setActiveModal('cyber');
        } else if (action.type === 'exec_pc') {
          const appName = action.payload?.app || '';
          await jarvisApi.executePcApp(appName);
        }

        // 2. Query JARVIS AI Intelligence Core
        const responseText = await jarvisApi.askJarvis(prompt);
        const reply =
          responseText ||
          `Very well, sir. Executing your directive: "${prompt}". Operating parameters are optimal.`;

        setJarvisDialogue(reply);
        speak(reply);
      } catch (err: any) {
        console.error('Action error:', err);
        const fallback = `I have received your instruction, sir. Accessing local subsystem directly.`;
        setJarvisDialogue(fallback);
        speak(fallback);
      } finally {
        setIsProcessing(false);
      }
    },
    [] // dependency-free or updated
  );

  // Voice Engine hook
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
      dispatchAction(cmd);
    }
  });

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing) return;
    const prompt = textInput.trim();
    setTextInput('');
    dispatchAction(prompt);
  };

  return (
    <main className="page select-none">
      <motion.section
        ref={containerRef}
        className="hero"
        onMouseMove={handleMouseMove}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: 0.8,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {/* Spring Cursor Radial Light */}
        <motion.div
          className="cursor-light"
          style={{
            x: smoothX,
            y: smoothY,
          }}
        />

        <div className="content">
          {/* Full-Screen Spline 3D Robot Layer */}
          <motion.div
            className="scene-area"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 1,
              delay: 0.15,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {!sceneLoaded && (
              <div className="loader-container">
                <span className="loader" />
                <p>Loading 3D scene</p>
              </div>
            )}

            <Spline
              scene={SCENE_URL}
              className="spline"
              onLoad={() => setSceneLoaded(true)}
            />

            {/* Floating Live Environment Status Badge in Bottom-Right */}
            <motion.div
              className="live-label"
              animate={{
                y: [0, -5, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <span className="live-icon">
                <span />
              </span>

              <div>
                <strong>Live environment</strong>
                <small>Move your cursor to interact</small>
              </div>
            </motion.div>
          </motion.div>

          {/* Transparent Left Content Layer */}
          <motion.div
            className="text-area"
            initial={{ opacity: 0, x: -35 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.15,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {/* Top Eyebrow Badge */}
            <div className="eyebrow">
              <span />
              IMMERSIVE DIGITAL EXPERIENCE
            </div>

            {/* Main Typography */}
            <h1>
              Interactive
              <span className="gradient-text">3D.</span>
            </h1>

            <p>
              Bring your interface to life with an interactive
              three-dimensional experience designed to capture
              attention and make your product unforgettable.
            </p>

            {/* Buttons Row */}
            <div className="buttons">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setActiveModal('telemetry');
                }}
                className="primary-button"
              >
                Explore experience
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12H19M13 6L19 12L13 18" />
                </svg>
              </button>

              <button
                onClick={() => {
                  soundEngine.playClick();
                  if (onToggleDesktopWorkspace) {
                    onToggleDesktopWorkspace();
                  } else {
                    setActiveModal('cyber');
                  }
                }}
                className="secondary-button"
              >
                {onToggleDesktopWorkspace ? 'ZakOS Workspace' : 'View details'}
              </button>
            </div>

            {/* Features Row */}
            <div className="features">
              <div>
                <strong>Realtime</strong>
                <span>3D rendering</span>
              </div>

              <i />

              <div>
                <strong>Interactive</strong>
                <span>Mouse controls</span>
              </div>
            </div>

            {/* JARVIS Live Dialogue Banner & Tactical Voice Bar */}
            <div className="mt-6 w-full max-w-[530px] rounded-2xl border border-white/10 bg-[#090b12]/80 p-3.5 backdrop-blur-xl pointer-events-auto shadow-2xl">
              {/* Voice / Mic Indicator Bar */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    className={`relative flex h-8 w-8 items-center justify-center rounded-xl border transition-all ${
                      isMuted
                        ? 'border-red-500/40 bg-red-500/15 text-red-400'
                        : isSpeaking
                        ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                        : isListening
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                        : 'border-white/15 bg-white/5 text-zinc-300'
                    }`}
                  >
                    {isMuted ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4 animate-pulse" />
                    )}
                    {!isMuted && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                    )}
                  </button>

                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                      <span>J.A.R.V.I.S. Core</span>
                      <span className="rounded bg-purple-500/20 px-1 py-0.2 text-[9px] font-mono text-purple-300">
                        SecOps AI
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {isSpeaking
                        ? 'Synthesizing voice transmission...'
                        : isMuted
                        ? 'Mic Standby (Muted)'
                        : isListening
                        ? 'Listening for voice directives...'
                        : 'Active Standby'}
                    </div>
                  </div>
                </div>

                {/* Quick HUD Shortcuts */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveModal('telemetry')}
                    title="System Telemetry"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:border-purple-500/40 hover:text-purple-300"
                  >
                    <Activity className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setActiveModal('weather')}
                    title="Atmospheric Weather"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:border-sky-500/40 hover:text-sky-300"
                  >
                    <CloudSun className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setActiveModal('youtube')}
                    title="YouTube Visual Feed"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:border-red-500/40 hover:text-red-400"
                  >
                    <Video className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setActiveModal('vault')}
                    title="Obsidian Knowledge Vault"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:border-purple-500/40 hover:text-purple-300"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setActiveModal('cyber')}
                    title="Tactical Cyber Radar"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:border-red-500/40 hover:text-red-400"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Dialogue Box */}
              <div className="font-mono text-xs leading-relaxed text-zinc-300 bg-black/40 rounded-xl p-2.5 border border-white/5 max-h-24 overflow-y-auto">
                <span className="text-purple-400 font-semibold mr-1.5">[JARVIS]:</span>
                {jarvisDialogue}
                {interimText && (
                  <div className="text-emerald-400/80 italic text-[11px] mt-1">
                    "{interimText}"
                  </div>
                )}
              </div>

              {/* Text Input Prompt */}
              <form onSubmit={handleTextSubmit} className="mt-2.5 flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Ask JARVIS (e.g. 'Show CPU load', 'Weather today', 'Open Obsidian')..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-purple-400/50 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex items-center justify-center rounded-xl border border-purple-500/40 bg-purple-500/20 px-3 text-purple-200 transition-all hover:bg-purple-500/30 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </motion.div>
        </div>

        {/* Spatial Floating Modals (Rendered without obscuring the 3D Robot) */}
        <AnimatePresence>
          {activeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm pointer-events-auto">
              <div className="relative">
                {activeModal === 'telemetry' && (
                  <JarvisTelemetryModal onClose={() => setActiveModal(null)} />
                )}
                {activeModal === 'weather' && (
                  <JarvisWeatherModal
                    initialCity={modalPayload?.city}
                    onClose={() => setActiveModal(null)}
                  />
                )}
                {activeModal === 'youtube' && (
                  <JarvisYouTubeModal
                    initialQuery={modalPayload?.query}
                    onClose={() => setActiveModal(null)}
                  />
                )}
                {activeModal === 'vault' && (
                  <JarvisVaultModal
                    initialNoteQuery={modalPayload?.note}
                    onClose={() => setActiveModal(null)}
                  />
                )}
                {activeModal === 'cyber' && (
                  <JarvisCyberModal
                    initialTarget={modalPayload?.query}
                    onClose={() => setActiveModal(null)}
                    onOpenApp={onOpenApp}
                  />
                )}
              </div>
            </div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Hero Styles matching exact prompt requirements */}
      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          width: 100%;
          height: 100%;
          min-height: 100%;
          margin: 0;
        }

        body {
          overflow: hidden;
          background: #050506;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        button {
          font: inherit;
        }

        .page {
          width: 100%;
          height: 100vh;
          height: 100svh;
          height: 100dvh;
          margin: 0;
          padding: 0;
          overflow: hidden;
          color: white;
          background: #050506;
        }

        .hero {
          position: relative;
          isolation: isolate;
          width: 100%;
          height: 100%;
          min-height: 0;
          overflow: hidden;
          background: #050506;
        }

        .cursor-light {
          position: absolute;
          top: -250px;
          left: -250px;
          z-index: 20;
          width: 500px;
          height: 500px;
          pointer-events: none;
          border-radius: 50%;
          opacity: 0.65;
          filter: blur(16px);
          mix-blend-mode: screen;
          background: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.12),
            rgba(135, 101, 255, 0.07) 30%,
            transparent 70%
          );
        }

        .content {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 0;
          overflow: hidden;
          background: #050506;
        }

        .scene-area {
          position: absolute;
          inset: 0;
          z-index: 2;
          width: 100%;
          height: 100%;
          min-width: 0;
          min-height: 0;
          overflow: visible;
          background: #050506;
        }

        .spline {
          position: absolute !important;
          inset: 0;
          width: 100% !important;
          height: 100% !important;
          background: #050506;
          transform: translateX(15%) scale(1.08);
          transform-origin: center center;
        }

        .spline canvas {
          width: 100% !important;
          height: 100% !important;
          background: #050506 !important;
        }

        .text-area {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          z-index: 10;
          display: flex;
          width: 50%;
          min-width: 0;
          min-height: 0;
          flex-direction: column;
          justify-content: center;
          padding:
            clamp(30px, 6vh, 70px)
            clamp(40px, 7vw, 120px);
          padding-right: 20px;
          pointer-events: none;
          background: transparent;
        }

        .text-area button,
        .text-area input,
        .text-area form {
          pointer-events: auto;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          width: fit-content;
          margin-bottom: clamp(15px, 2.6vh, 25px);
          padding: 8px 13px;
          color: rgba(255, 255, 255, 0.65);
          font-size: 10px;
          font-weight: 650;
          letter-spacing: 0.17em;
          text-transform: uppercase;
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.035);
          backdrop-filter: blur(14px);
        }

        .eyebrow > span {
          width: 6px;
          height: 6px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #a78bfa;
          box-shadow:
            0 0 10px #a78bfa,
            0 0 20px rgba(167, 139, 250, 0.7);
        }

        h1 {
          max-width: 620px;
          margin: 0;
          color: #f5f5f7;
          font-size: clamp(58px, min(7vw, 13vh), 108px);
          font-weight: 590;
          line-height: 0.88;
          letter-spacing: -0.075em;
        }

        .gradient-text {
          display: block;
          padding-bottom: clamp(5px, 1.2vh, 12px);
          color: transparent;
          background: linear-gradient(
            135deg,
            #ffffff,
            #b8a5ff 48%,
            #7565ff
          );
          background-clip: text;
          -webkit-background-clip: text;
        }

        .text-area > p {
          max-width: 530px;
          margin: clamp(15px, 2.8vh, 26px) 0 0;
          color: rgba(255, 255, 255, 0.5);
          font-size: clamp(13px, 1.3vw, 17px);
          line-height: 1.7;
        }

        .buttons {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: clamp(18px, 3.5vh, 33px);
        }

        .primary-button,
        .secondary-button {
          height: clamp(45px, 6vh, 52px);
          padding: 0 21px;
          cursor: pointer;
          border-radius: 999px;
          transition:
            transform 220ms ease,
            background 220ms ease,
            border-color 220ms ease,
            box-shadow 220ms ease;
        }

        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #090909;
          font-size: 14px;
          font-weight: 650;
          border: 0;
          background: #ffffff;
          box-shadow: 0 12px 30px rgba(255, 255, 255, 0.13);
        }

        .primary-button svg {
          width: 18px;
          height: 18px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
          transition: transform 220ms ease;
        }

        .primary-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 38px rgba(255, 255, 255, 0.19);
        }

        .primary-button:hover svg {
          transform: translateX(3px);
        }

        .secondary-button {
          color: rgba(255, 255, 255, 0.72);
          font-size: 14px;
          font-weight: 550;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.035);
          backdrop-filter: blur(14px);
        }

        .secondary-button:hover {
          transform: translateY(-2px);
          color: white;
          border-color: rgba(255, 255, 255, 0.23);
          background: rgba(255, 255, 255, 0.07);
        }

        .features {
          display: flex;
          align-items: center;
          gap: 25px;
          margin-top: clamp(20px, 4.5vh, 44px);
        }

        .features div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .features strong {
          color: rgba(255, 255, 255, 0.88);
          font-size: 12px;
          font-weight: 600;
        }

        .features span {
          color: rgba(255, 255, 255, 0.31);
          font-size: 11px;
        }

        .features i {
          width: 1px;
          height: 28px;
          background: rgba(255, 255, 255, 0.12);
        }

        .loader-container {
          position: absolute;
          inset: 0;
          z-index: 3;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 13px;
          color: rgba(255, 255, 255, 0.4);
          font-size: 10px;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          background: #050506;
        }

        .loader-container p {
          margin: 0;
        }

        .loader {
          width: 34px;
          height: 34px;
          border: 2px solid rgba(255, 255, 255, 0.12);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .live-label {
          position: absolute;
          right: clamp(18px, 2.5vw, 35px);
          bottom: max(
            clamp(20px, 3.5vh, 35px),
            env(safe-area-inset-bottom)
          );
          z-index: 30;
          display: flex;
          align-items: center;
          gap: 12px;
          max-width: calc(100% - 36px);
          padding: 12px 14px;
          pointer-events: none;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          background: rgba(8, 8, 10, 0.72);
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(18px);
        }

        .live-icon {
          display: grid;
          place-items: center;
          width: 31px;
          height: 31px;
          flex-shrink: 0;
          border: 1px solid rgba(158, 130, 255, 0.2);
          border-radius: 10px;
          background: rgba(139, 107, 255, 0.14);
        }

        .live-icon span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #a78bfa;
          box-shadow:
            0 0 10px #a78bfa,
            0 0 20px rgba(167, 139, 250, 0.8);
        }

        .live-label > div {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 3px;
        }

        .live-label strong {
          color: rgba(255, 255, 255, 0.88);
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .live-label small {
          color: rgba(255, 255, 255, 0.38);
          font-size: 9px;
          white-space: nowrap;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (min-width: 901px) and (max-height: 760px) {
          .text-area {
            padding-top: 28px;
            padding-bottom: 28px;
          }

          .eyebrow {
            margin-bottom: 14px;
            padding: 7px 12px;
          }

          h1 {
            font-size: clamp(55px, 11.5vh, 82px);
          }

          .text-area > p {
            margin-top: 14px;
            font-size: 14px;
            line-height: 1.55;
          }

          .buttons {
            margin-top: 18px;
          }

          .primary-button,
          .secondary-button {
            height: 44px;
          }

          .features {
            margin-top: 20px;
          }

          .live-label {
            bottom: 20px;
            padding: 10px 12px;
          }
        }

        @media (min-width: 901px) and (max-height: 650px) {
          .text-area {
            padding-top: 20px;
            padding-bottom: 20px;
          }

          .eyebrow {
            margin-bottom: 11px;
            font-size: 8px;
          }

          h1 {
            font-size: clamp(50px, 11vh, 70px);
          }

          .text-area > p {
            max-width: 480px;
            margin-top: 10px;
            font-size: 13px;
            line-height: 1.45;
          }

          .buttons {
            margin-top: 14px;
          }

          .primary-button,
          .secondary-button {
            height: 40px;
            font-size: 12px;
          }

          .features {
            margin-top: 14px;
          }

          .features i {
            height: 22px;
          }

          .live-label {
            right: 18px;
            bottom: 16px;
            padding: 9px 11px;
          }

          .live-icon {
            width: 27px;
            height: 27px;
          }
        }

        @media (max-width: 900px) {
          body {
            overflow-y: auto;
          }

          .page {
            min-height: 100vh;
            height: auto;
            overflow: visible;
          }

          .hero {
            min-height: 100vh;
            height: auto;
            overflow: hidden;
          }

          .content {
            display: grid;
            grid-template-columns: 1fr;
            grid-template-rows: auto minmax(460px, 1fr);
            min-height: 100vh;
            overflow: visible;
          }

          .text-area {
            position: relative;
            inset: auto;
            width: 100%;
            height: auto;
            padding: 75px 35px 20px;
          }

          .scene-area {
            position: relative;
            inset: auto;
            width: 100%;
            min-height: 460px;
            overflow: hidden;
          }

          .spline {
            transform: none;
          }

          h1 {
            font-size: clamp(58px, 14vw, 86px);
          }
        }

        @media (max-width: 580px) {
          .content {
            grid-template-rows: auto minmax(410px, 1fr);
          }

          .text-area {
            padding: 58px 22px 5px;
          }

          .eyebrow {
            margin-bottom: 19px;
            font-size: 8px;
          }

          h1 {
            font-size: clamp(53px, 17vw, 72px);
          }

          .text-area > p {
            margin-top: 19px;
            font-size: 14px;
            line-height: 1.65;
          }

          .buttons {
            flex-direction: column;
            align-items: stretch;
            margin-top: 26px;
          }

          .primary-button,
          .secondary-button {
            width: 100%;
          }

          .features {
            display: none;
          }

          .scene-area {
            min-height: 410px;
          }

          .live-label {
            right: 18px;
            bottom: 18px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
};
