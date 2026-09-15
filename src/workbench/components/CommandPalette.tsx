import React, { useState, useEffect, useRef } from 'react';
import { ProfileThemeTokens } from '../types/profileTypes';
import { PaneContentType } from '../types/bspTypes';

export interface CommandAction {
  id: string;
  category: 'NAVIGATION' | 'WINDOW_MANAGER' | 'TOOLS' | 'PROFILE';
  title: string;
  shortcut?: string;
  glyph: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  theme: ProfileThemeTokens;
  onClose: () => void;
  actions: CommandAction[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  theme,
  onClose,
  actions,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = actions.filter((act) =>
    act.title.toLowerCase().includes(query.toLowerCase()) ||
    act.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-start justify-center pt-24 font-mono select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-sm border shadow-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: theme.bgSecondary,
          borderColor: theme.borderActive,
          color: theme.textPrimary,
        }}
      >
        {/* Search Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: theme.borderPrimary }}
        >
          <span style={{ color: theme.accentPrimary }} className="text-sm font-black">
            ❯
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or launch a tool (e.g. 'split', 'ssh', 'study', 'build')..."
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-neutral-500 font-mono"
          />
          <span className="text-[10px] text-neutral-500 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
            ESC to close
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-neutral-900/40 p-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-neutral-500">
              No matching commands or tools found.
            </div>
          ) : (
            filtered.map((act, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={act.id}
                  onClick={() => {
                    act.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                    isSelected ? 'rounded-xs' : ''
                  }`}
                  style={{
                    backgroundColor: isSelected ? theme.bgPanel : 'transparent',
                    color: isSelected ? theme.textPrimary : theme.textMuted,
                    borderLeft: isSelected ? `2px solid ${theme.accentPrimary}` : '2px solid transparent',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      style={{ color: isSelected ? theme.accentPrimary : theme.textMuted }}
                      className="font-bold text-xs"
                    >
                      {act.glyph}
                    </span>
                    <span className="font-bold">{act.title}</span>
                    <span className="text-[9px] uppercase tracking-wider text-neutral-500 bg-neutral-900/60 px-1 rounded border border-neutral-800">
                      {act.category}
                    </span>
                  </div>

                  {act.shortcut && (
                    <span
                      style={{ color: theme.accentSecondary }}
                      className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-black/50 border border-neutral-800"
                    >
                      {act.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div
          className="flex items-center justify-between px-3 py-1.5 border-t text-[10px] text-neutral-500 bg-black/40"
          style={{ borderColor: theme.borderPrimary }}
        >
          <span>↑↓ to navigate • ↵ to execute</span>
          <span className="font-bold" style={{ color: theme.accentPrimary }}>
            {theme.name}
          </span>
        </div>
      </div>
    </div>
  );
};
