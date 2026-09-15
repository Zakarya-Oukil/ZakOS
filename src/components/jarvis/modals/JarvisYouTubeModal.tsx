import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Video, X, Search, ExternalLink, Play } from 'lucide-react';
import { jarvisApi } from '../../../services/jarvisApi';

interface JarvisYouTubeModalProps {
  initialQuery?: string;
  onClose: () => void;
}

export const JarvisYouTubeModal: React.FC<JarvisYouTubeModalProps> = ({
  initialQuery = 'Cybersecurity Red Team',
  onClose
}) => {
  const [query, setQuery] = useState<string>(initialQuery);
  const [activeQuery, setActiveQuery] = useState<string>(initialQuery);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setActiveQuery(query.trim());
    }
  };

  const openInBrowser = () => {
    jarvisApi.executePcApp('browser', `https://www.youtube.com/results?search_query=${encodeURIComponent(activeQuery)}`);
  };

  const quickPicks = [
    'Black Hat Conference 2025',
    'Active Directory Pentesting',
    'Iron Man Jarvis HUD Ambience',
    'Wireshark Packet Analysis',
    'Buffer Overflow Exploit Tutorial'
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 15 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-40 w-full max-w-2xl rounded-2xl border border-white/15 bg-[#07090e]/95 p-5 text-white shadow-2xl backdrop-blur-2xl"
      style={{
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.15)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400">
            <Video className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-zinc-100">
              JARVIS Visual Feed & Media Player
            </h3>
            <p className="text-[11px] text-zinc-400">Querying YouTube Stream: "{activeQuery}"</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openInBrowser}
            title="Open in native desktop browser"
            className="flex h-7 items-center gap-1.5 rounded-lg border border-white/10 px-2 text-xs text-zinc-400 transition-colors hover:border-white/25 hover:text-white"
          >
            <ExternalLink className="h-3 w-3" />
            <span>Open Browser</span>
          </button>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mt-3.5 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search YouTube or enter video query..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white placeholder-zinc-500 focus:border-red-400/50 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/30"
        >
          <Play className="h-3 w-3 fill-current" />
          <span>Stream</span>
        </button>
      </form>

      {/* Embedded Player */}
      <div className="mt-3.5 overflow-hidden rounded-xl border border-white/10 bg-black aspect-video">
        <iframe
          key={activeQuery}
          src={`https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(
            activeQuery
          )}&autoplay=1&mute=0`}
          title="YouTube Video Player"
          className="h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      {/* Quick Picks */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Tactical Feeds:
        </span>
        {quickPicks.map((pick, i) => (
          <button
            key={i}
            onClick={() => {
              setQuery(pick);
              setActiveQuery(pick);
            }}
            className="rounded-lg border border-white/5 bg-white/[0.04] px-2 py-0.5 text-zinc-400 transition-colors hover:border-white/20 hover:text-white"
          >
            {pick}
          </button>
        ))}
      </div>
    </motion.div>
  );
};
