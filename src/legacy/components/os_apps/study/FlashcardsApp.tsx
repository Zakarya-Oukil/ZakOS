import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  RotateCw, 
  Check, 
  X, 
  ArrowLeft, 
  ArrowRight, 
  BrainCircuit, 
  Plus, 
  Trash2, 
  Edit3, 
  Tag, 
  Sparkles, 
  BookOpen, 
  Sliders 
} from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface FlashcardsAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

interface Flashcard {
  id: string;
  deckId: string;
  category: string;
  front: string;
  back: string;
  box: number; // 1 to 5
}

interface Deck {
  id: string;
  title: string;
  color: string;
}

const DEFAULT_DECKS: Deck[] = [
  { id: 'deck-ejpt', title: 'eJPTv2 / Host & Network', color: 'purple' },
  { id: 'deck-web', title: 'Web App Exploitation & OWASP', color: 'red' },
  { id: 'deck-ad', title: 'Active Directory & Kerberos', color: 'amber' },
  { id: 'deck-systems', title: 'Systems & Distributed Architecture', color: 'emerald' }
];

const DEFAULT_CARDS: Flashcard[] = [
  {
    id: 'c-1',
    deckId: 'deck-ejpt',
    category: 'Network Recon',
    front: 'What is the primary indicator that a Windows host is single-homed when checking DCERPC bindings?',
    back: 'The DCE/RPC endpoint mapper (port 135) reveals all interface UUID protocol sequences bound strictly to a single IP address (e.g. ncacn_ip_tcp:192.168.100.50), with no secondary internal interface bindings.',
    box: 2
  },
  {
    id: 'c-2',
    deckId: 'deck-ejpt',
    category: 'Pivoting & Routing',
    front: 'What is the Metasploit syntax to add an internal subnet route through an active Meterpreter session (session ID 2)?',
    back: 'route add 192.168.0.0 255.255.255.0 2 (or route add 192.168.0.0/24 2)',
    box: 3
  },
  {
    id: 'c-3',
    deckId: 'deck-ejpt',
    category: 'Vulnerability Analysis',
    front: 'What is the vulnerability mechanism in OpenSMTPD (CVE-2020-7247)?',
    back: 'An out-of-bounds read and command injection in the SMTP session handling when parsing a crafted MAIL FROM address containing whitespace and shell metacharacters.',
    box: 4
  },
  {
    id: 'c-4',
    deckId: 'deck-web',
    category: 'Web App Exploitation',
    front: 'Explain the root vulnerability of Drupalgeddon2 (CVE-2018-7600).',
    back: 'An unauthenticated remote code execution flaw in Drupal 7.x/8.x Form API render arrays where user-supplied input is passed to dangerous callbacks (like #pre_render or #lazy_builder) without input sanitation.',
    box: 3
  },
  {
    id: 'c-5',
    deckId: 'deck-web',
    category: 'SQL Injection',
    front: 'What is the difference between Error-Based SQLi and Time-Based Blind SQLi?',
    back: 'Error-Based forces the DBMS to reflect query results directly inside error messages (e.g. via CAST() or extractvalue()). Time-Based infers data 1 bit at a time by triggering deliberate DB sleep delays (e.g. SLEEP(5) or pg_sleep(5)).',
    box: 1
  },
  {
    id: 'c-6',
    deckId: 'deck-ad',
    category: 'Active Directory',
    front: 'How does Kerberoasting work from an attacker perspective?',
    back: 'Any valid domain account requests a TGS ticket for a service principal name (SPN). The ticket is encrypted with the service account NTLM hash. The attacker dumps the ticket offline and cracks it with Hashcat mode 13100.',
    box: 2
  },
  {
    id: 'c-7',
    deckId: 'deck-systems',
    category: 'Concurrency',
    front: 'What is the fundamental difference between Optimistic vs Pessimistic concurrency control?',
    back: 'Pessimistic locking acquires exclusive database locks (SELECT FOR UPDATE) preventing any concurrent writes. Optimistic locking allows concurrent reads and validates a version number (OCC) at commit time, aborting and retrying if conflict occurred.',
    box: 3
  }
];

export const FlashcardsApp: React.FC<FlashcardsAppProps> = () => {
  const [cards, setCards] = useState<Flashcard[]>(() => {
    const saved = localStorage.getItem('zakos_flashcards_v2');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return DEFAULT_CARDS;
  });

  const [selectedDeckId, setSelectedDeckId] = useState<string>('deck-ejpt');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // New Card Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newCategory, setNewCategory] = useState('Core Concept');

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('zakos_flashcards_v2', JSON.stringify(cards));
  }, [cards]);

  // Current deck cards
  const deckCards = cards.filter(c => c.deckId === selectedDeckId);
  const currentCard = deckCards[currentIndex] || deckCards[0];

  const handleFlip = () => {
    soundEngine.playClick();
    setIsFlipped(!isFlipped);
  };

  const handleNext = (mastered: boolean) => {
    if (!currentCard) return;
    soundEngine.playClick();
    setIsFlipped(false);

    if (mastered) {
      soundEngine.playCyberPing();
    }

    // Update Leitner box: +1 if mastered (max 5), reset to 1 if need review
    setCards(prev => prev.map(c => {
      if (c.id !== currentCard.id) return c;
      const newBox = mastered ? Math.min(5, c.box + 1) : 1;
      return { ...c, box: newBox };
    }));

    if (deckCards.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % deckCards.length);
    }
  };

  const handleCreateCard = () => {
    if (!newFront.trim() || !newBack.trim()) return;
    soundEngine.playClick();
    const newCard: Flashcard = {
      id: `c-${Date.now()}`,
      deckId: selectedDeckId,
      category: newCategory.trim() || 'General',
      front: newFront.trim(),
      back: newBack.trim(),
      box: 1
    };

    setCards(prev => [...prev, newCard]);
    setIsNewModalOpen(false);
    setNewFront('');
    setNewBack('');
    setCurrentIndex(deckCards.length); // point to new card
  };

  const handleDeleteCard = (cardId: string) => {
    soundEngine.playClick();
    setCards(prev => prev.filter(c => c.id !== cardId));
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#080512] text-zinc-200 font-sans select-text">
      {/* 1. Header Bar: Decks & Add Card */}
      <div className="h-12 border-b border-purple-500/20 px-4 bg-[#0d0720]/90 flex items-center justify-between shrink-0 font-mono text-xs">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-5 h-5 text-purple-400 shrink-0" />
          <select
            value={selectedDeckId}
            onChange={(e) => {
              soundEngine.playClick();
              setSelectedDeckId(e.target.value);
              setCurrentIndex(0);
              setIsFlipped(false);
            }}
            className="bg-black/60 border border-purple-500/30 rounded-xl px-2.5 py-1 text-white font-bold font-sans text-xs focus:outline-none focus:border-purple-400"
          >
            {DEFAULT_DECKS.map(d => (
              <option key={d.id} value={d.id}>{d.title}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-purple-300 font-mono hidden sm:inline">
            Card {deckCards.length > 0 ? currentIndex + 1 : 0} / {deckCards.length}
          </span>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="px-3 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-mono font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(168,85,247,0.2)]"
          >
            <Plus className="w-3.5 h-3.5" /> Add Card
          </button>
        </div>
      </div>

      {/* 2. Main Spaced Repetition Area */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-between p-6 overflow-y-auto custom-scrollbar">
        {currentCard ? (
          <>
            {/* Box Level Indicator Ribbon */}
            <div className="flex items-center gap-1.5 mb-2 font-mono text-[10px]">
              <span className="text-zinc-500 mr-1">LEITNER BOX:</span>
              {[1, 2, 3, 4, 5].map((b) => (
                <span
                  key={b}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold border transition-all ${
                    currentCard.box >= b
                      ? 'bg-purple-500/30 text-purple-300 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                      : 'bg-white/5 text-zinc-600 border-white/5'
                  }`}
                >
                  {b}
                </span>
              ))}
            </div>

            {/* 3D Tactile Flip Card */}
            <div
              onClick={handleFlip}
              className="w-full max-w-xl min-h-[280px] rounded-3xl bg-gradient-to-br from-[#180932] via-[#090314] to-black border border-purple-500/40 p-6 flex flex-col justify-between cursor-pointer hover:border-purple-400 hover:shadow-[0_0_35px_rgba(168,85,247,0.25)] transition-all select-none relative group"
            >
              {/* Card Top Category & Actions */}
              <div className="flex items-center justify-between text-[11px] font-mono text-purple-400 border-b border-white/5 pb-3">
                <span className="uppercase font-bold tracking-wider">{currentCard.category}</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-zinc-500 text-[10px]">
                    <RotateCw className="w-3 h-3" /> Click card to flip
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCard(currentCard.id);
                    }}
                    className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                    title="Delete card"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Card Center Prompt / Answer */}
              <div className="py-6 px-2 text-center overflow-y-auto max-h-48 custom-scrollbar">
                <h3 className={`leading-relaxed transition-all ${
                  isFlipped 
                    ? 'text-emerald-300 font-mono text-sm sm:text-base font-medium' 
                    : 'text-white text-base sm:text-lg font-semibold'
                }`}>
                  {isFlipped ? currentCard.back : currentCard.front}
                </h3>
              </div>

              {/* Card Bottom Indicator */}
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-white/5 pt-3">
                <span>Box {currentCard.box} (Mastery Level)</span>
                <span className={isFlipped ? 'text-emerald-400 font-bold' : 'text-purple-400 font-bold'}>
                  {isFlipped ? 'REVERSE / ANSWER' : 'PROMPT / QUESTION'}
                </span>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center gap-4 mt-6">
              <button
                onClick={() => handleNext(false)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-mono font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              >
                <X className="w-4 h-4" />
                <span>Need Review (Box 1)</span>
              </button>

              <button
                onClick={handleFlip}
                className="px-5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-zinc-300 transition-colors"
              >
                Flip Card
              </button>

              <button
                onClick={() => handleNext(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]"
              >
                <Check className="w-4 h-4" />
                <span>Mastered (+1 Box)</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
            <BookOpen className="w-12 h-12 text-purple-400 animate-pulse" />
            <h4 className="text-white font-bold text-sm">No cards in this deck</h4>
            <p className="text-xs text-zinc-400 max-w-sm">
              Click the "Add Card" button above to populate your active recall study deck.
            </p>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-purple-500 text-black font-bold font-mono text-xs"
            >
              Create First Card
            </button>
          </div>
        )}
      </div>

      {/* Modal: Create Card */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#120826] border border-purple-500/40 p-5 space-y-4">
            <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
              <Plus className="w-4 h-4 text-purple-400" /> New Active Recall Card
            </h3>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[10px] text-zinc-400 uppercase block mb-1">Domain Category</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Network Pivoting / PrivEsc"
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 uppercase block mb-1">Front (Prompt / Question)</label>
                <textarea
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder="What is the concept, vulnerability, or command syntax?"
                  rows={3}
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 uppercase block mb-1">Back (Answer / Deep Explanation)</label>
                <textarea
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  placeholder="The concise answer, command execution, or proof of concept..."
                  rows={3}
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-zinc-400 hover:text-white font-mono text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCard}
                className="px-4 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-black font-bold font-mono text-xs shadow-[0_0_12px_rgba(168,85,247,0.4)]"
              >
                Add Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
