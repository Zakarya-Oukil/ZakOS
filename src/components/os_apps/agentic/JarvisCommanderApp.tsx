import React, { useState } from 'react';
import { Bot, Mic, MicOff, Send, Sparkles, Volume2, Shield, Activity, Terminal } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

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
      text: 'Good day, Commander Zakarya. All 5 Operating Systems are online and synchronized. The Model Router is active with Google Gemini 2.5 Flash as primary and Ollama (Qwen 2.5 14B & DeepSeek R1) ready on fallback. Awaiting your directive.',
      time: '04:11'
    }
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSend = () => {
    if (!input.trim() || isProcessing) return;
    soundEngine.playClick();

    const userText = input;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userText, time: now }]);
    setInput('');
    setIsProcessing(true);

    setTimeout(() => {
      soundEngine.playCyberPing();
      setIsProcessing(false);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'jarvis',
          text: `Executing autonomous directive: "${userText}". Coordinating with Ares on CyberOS targets and Socrates on concept review. Live telemetry updated on top bar.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }, 1100);
  };

  const toggleMic = () => {
    soundEngine.playClick();
    setIsListening(!isListening);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#040814] text-zinc-200 font-sans">
      {/* Arc Reactor Central Hologram */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center relative shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <Bot className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          </div>
          <div>
            <div className="text-xs font-bold text-white font-mono tracking-wider">JARVIS // MASTER CORE</div>
            <div className="text-[10px] text-cyan-400 font-mono">Agentic Command & Realtime Voice HUD</div>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
            AUTONOMOUS FLEET: READY
          </span>
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
              <span className={m.role === 'jarvis' ? 'text-cyan-400 font-bold' : ''}>
                {m.role === 'user' ? 'Commander' : 'JARVIS'}
              </span>
              <span>•</span>
              <span>{m.time}</span>
            </div>
            <div
              className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-cyan-600/30 border border-cyan-500/40 text-cyan-100 rounded-br-none'
                  : 'bg-white/5 border border-white/10 text-zinc-200 rounded-bl-none font-mono text-[12px]'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 p-2 animate-pulse">
            <Sparkles className="w-4 h-4" />
            <span>JARVIS is synthesizing tactical directive across agent fleet...</span>
          </div>
        )}
      </div>

      {/* Input Prompt & Voice Controller */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-black/50 border border-white/10 focus-within:border-cyan-500/50">
        <button
          onClick={toggleMic}
          className={`p-2 rounded-xl transition-all ${
            isListening
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
              : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5'
          }`}
        >
          {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Speak or type master directive to JARVIS..."
          className="flex-1 bg-transparent px-2 text-xs text-white focus:outline-none font-mono"
        />

        <button
          onClick={handleSend}
          disabled={!input.trim() || isProcessing}
          className="p-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-all disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
