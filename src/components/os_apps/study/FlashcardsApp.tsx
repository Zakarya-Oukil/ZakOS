import React, { useState } from 'react';
import { Layers, RotateCw, Check, X, ArrowLeft, ArrowRight, BrainCircuit } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface FlashcardsAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

interface Flashcard {
  id: number;
  category: string;
  front: string;
  back: string;
  box: number;
}

export const FlashcardsApp: React.FC<FlashcardsAppProps> = () => {
  const [cards, setCards] = useState<Flashcard[]>([
    {
      id: 1,
      category: 'eJPT / Network Security',
      front: 'What is the primary indicator that a Windows host is single-homed when checking DCERPC bindings?',
      back: 'The DCE/RPC endpoint mapper (port 135) reveals all interface UUID protocol sequences bound strictly to a single IP address (e.g. ncacn_ip_tcp:192.168.100.50), with no secondary internal interface bindings.',
      box: 1
    },
    {
      id: 2,
      category: 'Web App Exploitation',
      front: 'Explain the root vulnerability of Drupalgeddon2 (CVE-2018-7600).',
      back: 'An unauthenticated remote code execution flaw in Drupal 7.x/8.x Form API render arrays where user-supplied input is passed to dangerous callbacks (like #pre_render or #lazy_builder) without input sanitation.',
      box: 2
    },
    {
      id: 3,
      category: 'Pivoting & Routing',
      front: 'What is the Metasploit syntax to add an internal subnet route through an active Meterpreter session (session ID 2)?',
      back: 'route add 192.168.0.0 255.255.255.0 2 (or route add 192.168.0.0/24 2)',
      box: 3
    }
  ]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const currentCard = cards[currentIndex];

  const handleFlip = () => {
    soundEngine.playClick();
    setIsFlipped(!isFlipped);
  };

  const handleNext = (learned: boolean) => {
    soundEngine.playClick();
    setIsFlipped(false);
    if (learned) {
      soundEngine.playCyberPing();
    }
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#090612] text-zinc-200 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-mono font-bold text-white uppercase">
            Leitner Spaced Repetition // Deck: Active Certs
          </span>
        </div>
        <span className="text-xs font-mono text-purple-300">
          Card {currentIndex + 1} / {cards.length}
        </span>
      </div>

      {/* 3D Flip Card Container */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          onClick={handleFlip}
          className="w-full max-w-lg h-72 rounded-2xl bg-gradient-to-br from-purple-900/20 to-black/60 border border-purple-500/30 p-6 flex flex-col justify-between cursor-pointer hover:border-purple-400/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] transition-all select-none relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-purple-400">
            <span className="uppercase font-bold tracking-wider">{currentCard.category}</span>
            <span className="flex items-center gap-1 text-zinc-500">
              <RotateCw className="w-3 h-3" /> Click to flip
            </span>
          </div>

          <div className="text-center px-4 overflow-y-auto max-h-40">
            <h3 className={`text-base font-semibold leading-relaxed transition-all ${isFlipped ? 'text-emerald-300 font-mono text-sm' : 'text-white'}`}>
              {isFlipped ? currentCard.back : currentCard.front}
            </h3>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-white/10 pt-2">
            <span>Box {currentCard.box} (Leitner)</span>
            <span className="text-purple-300">{isFlipped ? 'REVERSE / ANSWER' : 'PROMPT / QUESTION'}</span>
          </div>
        </div>
      </div>

      {/* Bottom Response Controls */}
      <div className="flex items-center justify-center gap-4 pt-2 border-t border-white/10">
        <button
          onClick={() => handleNext(false)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-mono font-bold transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          <span>Need Review</span>
        </button>

        <button
          onClick={handleFlip}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-zinc-300 transition-colors"
        >
          Flip Card
        </button>

        <button
          onClick={() => handleNext(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)]"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Mastered</span>
        </button>
      </div>
    </div>
  );
};
