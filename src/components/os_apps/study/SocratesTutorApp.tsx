import React, { useState } from 'react';
import { Bot, Send, Sparkles, BookOpen, RefreshCw, UserCheck, HelpCircle, Flame, Lightbulb } from 'lucide-react';
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
      text: "Greetings, Zakarya. I am Socrates, your academic mentor and oral board examiner. What technical domain shall we master today? Present a hypothesis or concept — from network pivoting and Linux kernel internals to distributed state machines — and let us test your foundational understanding.",
      timestamp: '04:10'
    }
  ]);
  const [input, setInput] = useState('');
  const [topic, setTopic] = useState<'cyber' | 'dev' | 'algorithms' | 'architecture'>('cyber');
  const [isThinking, setIsThinking] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    soundEngine.playClick();

    const userText = input;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'user', text: userText, timestamp: now }]);
    setInput('');
    setIsThinking(true);

    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'socrates',
          message: `Topic: ${topic}. User says: "${userText}". Act as the philosophical, rigorous, and technical Socratic mentor. Challenge their logic, ask probing questions, give a hint if necessary, and guide them to first principles.`
        })
      });
      const data = await res.json();
      soundEngine.playCyberPing();
      setMessages(prev => [
        ...prev,
        {
          sender: 'socrates',
          text: data.reply || `A thoughtful assertion regarding "${userText}". But consider: If you claim that mechanism holds true, what boundary conditions would cause it to fail? Explain how memory addresses or routing protocols behave under those exact constraints.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch {
      soundEngine.playCyberPing();
      setMessages(prev => [
        ...prev,
        {
          sender: 'socrates',
          text: `A compelling perspective on "${userText}". But consider this: If the default gateway strictly isolates host-to-host broadcasts, why did the DCE/RPC endpoint mapper queries allow us to definitively prove single-homed status without needing root execution first? Explain the fundamental mechanism at play.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleQuickQuestion = (q: string) => {
    setInput(q);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#0a0614] text-zinc-200 font-sans">
      {/* Header & Modes */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 font-serif italic text-sm shadow-[0_0_12px_rgba(168,85,247,0.3)]">
            Σ
          </div>
          <div>
            <div className="text-xs font-bold text-white font-serif tracking-wide">Socrates — Socratic AI Master Tutor</div>
            <div className="text-[10px] text-purple-400 font-mono">Epistemic Active Recall & Oral Board</div>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 font-mono text-[11px]">
          {(['cyber', 'dev', 'algorithms', 'architecture'] as const).map((t) => (
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

      {/* Suggested Socratic Inquiries */}
      <div className="flex items-center gap-1.5 pb-2 mb-2 overflow-x-auto select-none font-mono text-[10px]">
        <span className="text-zinc-500 uppercase flex items-center gap-1 shrink-0"><Lightbulb className="w-3 h-3 text-amber-400" /> Prompts:</span>
        <button
          onClick={() => handleQuickQuestion("Why does Drupalgeddon2 allow RCE through unauthenticated Form API render arrays?")}
          className="px-2 py-0.5 rounded bg-white/5 hover:bg-purple-500/20 text-zinc-400 hover:text-purple-300 border border-white/5 whitespace-nowrap transition-all"
        >
          Drupalgeddon2 Architecture
        </button>
        <button
          onClick={() => handleQuickQuestion("Explain how Chisel socks5 proxying routes TCP traffic through an HTTP tunnel.")}
          className="px-2 py-0.5 rounded bg-white/5 hover:bg-purple-500/20 text-zinc-400 hover:text-purple-300 border border-white/5 whitespace-nowrap transition-all"
        >
          Chisel Tunneling
        </button>
        <button
          onClick={() => handleQuickQuestion("What are the trade-offs of using optimistic locking vs pessimistic locking in high concurrency?")}
          className="px-2 py-0.5 rounded bg-white/5 hover:bg-purple-500/20 text-zinc-400 hover:text-purple-300 border border-white/5 whitespace-nowrap transition-all"
        >
          Database Concurrency
        </button>
      </div>

      {/* Dialogue Message Stream */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3 custom-scrollbar">
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
              className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-purple-600/30 border border-purple-500/40 text-purple-100 rounded-br-none shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                  : 'bg-black/60 border border-white/10 text-zinc-200 rounded-bl-none'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex items-center gap-2 text-xs text-purple-400 font-mono py-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Socrates is formulating a dialectical counter-examination...</span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-black/60 border border-white/10 focus-within:border-purple-500">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Answer Socrates or present a technical claim..."
          className="flex-1 bg-transparent px-2 text-xs text-white focus:outline-none font-sans"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isThinking}
          className="px-3.5 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-black font-bold font-mono text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(168,85,247,0.3)] disabled:opacity-40"
        >
          <Send className="w-3 h-3" />
          Send
        </button>
      </div>
    </div>
  );
};
