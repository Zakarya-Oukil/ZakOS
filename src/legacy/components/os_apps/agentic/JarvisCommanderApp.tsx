import React, { useState } from 'react';
import { Bot, Mic, MicOff, Send, Sparkles, Activity, Shield, Terminal, ExternalLink, Cpu } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';
import { jarvisApi } from '../../../services/jarvisApi';
import { useJarvisVoice } from '../../../hooks/useJarvisVoice';

interface JarvisCommanderAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'jarvis' | 'user';
  text: string;
  time: string;
}

export const JarvisCommanderApp: React.FC<JarvisCommanderAppProps> = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'jarvis',
      text: 'Good day, Commander Zakarya. All tactical systems are online and synchronized. The 3D Spline neural core and voice synthesis are active. Awaiting your directive, sir.',
      time: '04:11'
    }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSendPrompt = async (promptText: string) => {
    if (!promptText.trim() || isProcessing) return;
    soundEngine.playClick();

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: promptText, time: now }]);
    setInput('');
    setIsProcessing(true);

    try {
      // 1. Check intent for PC app execution
      const action = await jarvisApi.parseIntent(promptText);
      if (action.type === 'exec_pc') {
        await jarvisApi.executePcApp(action.payload?.app);
      }

      // 2. Query AI
      const reply = await jarvisApi.askJarvis(promptText);
      const answer = reply || `Very well, sir. Executing directive: "${promptText}".`;

      soundEngine.playCyberPing();
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'jarvis',
          text: answer,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      speak(answer);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'jarvis',
          text: `Acknowledge, sir. Executed local directive: "${promptText}".`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const { isMuted, isListening, toggleMute, speak } = useJarvisVoice({
    onCommandDetected: (cmd) => {
      handleSendPrompt(cmd);
    }
  });

  const launchFull3dHero = () => {
    localStorage.setItem('zakos_view_mode', 'jarvis');
    window.location.reload();
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#040814] text-zinc-200 font-sans">
      {/* Arc Reactor Central Hologram Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-400/40 flex items-center justify-center relative shadow-[0_0_20px_rgba(168,85,247,0.3)]">
            <Bot className="w-5 h-5 text-purple-400 animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping" />
          </div>
          <div>
            <div className="text-xs font-bold text-white font-mono tracking-wider flex items-center gap-2">
              <span>JARVIS // MASTER CORE</span>
              <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px]">
                SecOps & PC Control
              </span>
            </div>
            <div className="text-[10px] text-purple-400 font-mono">
              Realtime Voice & Interactive 3D Interface
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={launchFull3dHero}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 font-bold border border-purple-500/40 text-[11px] transition-all cursor-pointer"
            title="Expand to Full-Screen 3D Interactive Spline Hero"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>EXPAND 3D HERO</span>
          </button>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mb-1 font-mono">
              <span className={m.role === 'jarvis' ? 'text-purple-400 font-bold' : ''}>
                {m.role === 'user' ? 'Commander' : 'JARVIS'}
              </span>
              <span>•</span>
              <span>{m.time}</span>
            </div>
            <div
              className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-purple-600/30 border border-purple-500/40 text-purple-100 rounded-br-none'
                  : 'bg-white/5 border border-white/10 text-zinc-200 rounded-bl-none font-mono text-[12px]'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs font-mono text-purple-400 p-2 animate-pulse">
            <Sparkles className="w-4 h-4" />
            <span>JARVIS is analyzing directive and coordinating tactical subsystems...</span>
          </div>
        )}
      </div>

      {/* Input Prompt & Voice Controller */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-black/50 border border-white/10 focus-within:border-purple-500/50">
        <button
          onClick={toggleMute}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`p-2 rounded-xl transition-all ${
            isMuted
              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
              : isListening
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
              : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5'
          }`}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt(input)}
          placeholder="Speak or type directive (e.g., 'Open Obsidian', 'Show CPU telemetry', 'Weather in London')..."
          className="flex-1 bg-transparent px-2 text-xs text-white focus:outline-none font-mono"
        />

        <button
          onClick={() => handleSendPrompt(input)}
          disabled={!input.trim() || isProcessing}
          className="p-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 transition-all disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
