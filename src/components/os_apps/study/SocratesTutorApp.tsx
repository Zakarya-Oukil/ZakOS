import React, { useState } from 'react';
import { Bot, Send, Sparkles, BookOpen, RefreshCw, UserCheck, HelpCircle } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface SocratesTutorAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

interface Message {
  sender: 'socrates' | 'user';
  text: string;
  timestamp: string;
}

export const SocratesTutorApp: React.FC<SocratesTutorAppProps> = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'socrates',
      text: "Greetings, Zakarya. I am Socrates, your philosophical and technical mentor. What core concept or certification domain shall we challenge today? Whether it is pivoting across DMZ boundaries, active recall on networking subnets, or deep distributed systems architecture — convince me you truly understand the foundation.",
      timestamp: '04:10'
    }
  ]);
  const [input, setInput] = useState('');
  const [topic, setTopic] = useState<'cyber' | 'dev' | 'algorithms'>('cyber');
  const [isThinking, setIsThinking] = useState(false);

  const handleSend = () => {
    if (!input.trim() || isThinking) return;
    soundEngine.playClick();

    const userText = input;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'user', text: userText, timestamp: now }]);
    setInput('');
    setIsThinking(true);

    setTimeout(() => {
      soundEngine.playCyberPing();
      setIsThinking(false);
      setMessages(prev => [
        ...prev,
        {
          sender: 'socrates',
          text: `A compelling perspective on "${userText}". But consider this: If the default gateway strictly isolates host-to-host broadcasts, why did the DCE/RPC endpoint mapper queries allow us to definitively prove single-homed status on WINSERVER-01 without needing root execution first? Explain the fundamental mechanism at play.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }, 1200);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#0a0614] text-zinc-200 font-sans">
      {/* Header & Modes */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 font-serif italic text-sm">
            Σ
          </div>
          <div>
            <div className="text-xs font-bold text-white font-serif">Socrates — Socratic AI Mentor</div>
            <div className="text-[10px] text-purple-400 font-mono">Epistemic Active Recall & Oral Board</div>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 font-mono text-[11px]">
          {(['cyber', 'dev', 'algorithms'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                soundEngine.playClick();
                setTopic(t);
              }}
              className={`px-2.5 py-0.5 rounded-lg uppercase transition-all ${
                topic === t ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Dialogue Message Stream */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mb-1 font-mono">
              <span>{m.sender === 'user' ? 'Zakarya' : 'Socrates'}</span>
              <span>•</span>
              <span>{m.timestamp}</span>
            </div>
            <div
              className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-purple-600/30 border border-purple-500/40 text-purple-100 rounded-br-none'
                  : 'bg-white/5 border border-white/10 text-zinc-200 rounded-bl-none font-serif text-[13px]'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center gap-2 text-xs font-mono text-purple-400 p-2 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Socrates is formulating a counter-inquiry...</span>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-black/40 border border-white/10 focus-within:border-purple-500/50">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Answer Socrates or ask for a rigorous conceptual quiz..."
          className="flex-1 bg-transparent px-3 py-1.5 text-xs text-white focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isThinking}
          className="p-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 transition-colors disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
