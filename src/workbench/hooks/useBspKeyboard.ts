import { useEffect } from 'react';
import { NavigationDirection, SplitDirection } from '../types/bspTypes';
import { ContextProfileId } from '../types/profileTypes';

interface UseBspKeyboardOptions {
  onNavigate: (dir: NavigationDirection) => void;
  onSplit: (dir: SplitDirection) => void;
  onClose: () => void;
  onToggleMaximize: () => void;
  onSwitchProfile: (profile: ContextProfileId) => void;
  onOpenCommandPalette: () => void;
}

export function useBspKeyboard({
  onNavigate,
  onSplit,
  onClose,
  onToggleMaximize,
  onSwitchProfile,
  onOpenCommandPalette,
}: UseBspKeyboardOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Ctrl+K or Cmd+K for command palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      // Check Alt modifier key ($mod)
      if (e.altKey) {
        const key = e.key.toLowerCase();

        // 1. Profile Switching: Alt + 1 / 2 / 3
        if (key === '1') {
          e.preventDefault();
          onSwitchProfile('CYBER');
          return;
        }
        if (key === '2') {
          e.preventDefault();
          onSwitchProfile('STUDY');
          return;
        }
        if (key === '3') {
          e.preventDefault();
          onSwitchProfile('DEV');
          return;
        }

        // 2. Command Palette: Alt + P
        if (key === 'p') {
          e.preventDefault();
          onOpenCommandPalette();
          return;
        }

        // 3. Directional Navigation: Alt + H/J/K/L or Alt + Arrows
        if (key === 'h' || e.key === 'ArrowLeft') {
          e.preventDefault();
          onNavigate('LEFT');
          return;
        }
        if (key === 'l' || e.key === 'ArrowRight') {
          e.preventDefault();
          onNavigate('RIGHT');
          return;
        }
        if (key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault();
          onNavigate('UP');
          return;
        }
        if (key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault();
          onNavigate('DOWN');
          return;
        }

        // 4. Split Creation: Alt + V (vertical/side-by-side) or Alt + S (horizontal/stacked)
        if (key === 'v') {
          e.preventDefault();
          onSplit('vertical');
          return;
        }
        if (key === 's') {
          e.preventDefault();
          onSplit('horizontal');
          return;
        }

        // 5. Close Active Pane: Alt + Q
        if (key === 'q') {
          e.preventDefault();
          onClose();
          return;
        }

        // 6. Maximize/Restore Pane: Alt + F
        if (key === 'f') {
          e.preventDefault();
          onToggleMaximize();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate, onSplit, onClose, onToggleMaximize, onSwitchProfile, onOpenCommandPalette]);
}
