import React, { useState, useMemo, useCallback } from 'react';
import { BspTree, PaneDefinition, PaneContentType, SplitDirection, NavigationDirection } from './types/bspTypes';
import { ContextProfileId, CONTEXT_PROFILES } from './types/profileTypes';
import { 
  createInitialTree, 
  splitPane, 
  closePane, 
  updateNodeRatio, 
  calculateLayout, 
  getDirectionalNeighbor, 
  generateNodeId 
} from './bsp/bspEngine';
import { BspGrid } from './components/BspGrid';
import { IntentRail } from './components/IntentRail';
import { CommandPalette, CommandAction } from './components/CommandPalette';
import { useBspKeyboard } from './hooks/useBspKeyboard';

// Native Workbench Panes
import { SshTerminalPane } from './terminal/SshTerminalPane';
import { StudyNotionPane } from './panes/StudyNotionPane';
import { BuildYourOwnXPane } from './panes/BuildYourOwnXPane';
import { SystemDesignPane } from './panes/SystemDesignPane';
import { ApiLabPane } from './panes/ApiLabPane';
import { CyberAdminApp } from '../components/os_apps/cyber/CyberAdminApp';

interface WorkbenchRootProps {
  onToggleLegacyMode?: () => void;
}

export const WorkbenchRoot: React.FC<WorkbenchRootProps> = ({ onToggleLegacyMode }) => {
  // 1. Context Profile State (CYBER by default)
  const [profileId, setProfileId] = useState<ContextProfileId>('CYBER');
  const theme = CONTEXT_PROFILES[profileId];

  // 2. Command Palette State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // 3. Panes Registry (Flat storage to guarantee persistent mount and zero socket teardown)
  const [panes, setPanes] = useState<Map<string, PaneDefinition>>(() => {
    const map = new Map<string, PaneDefinition>();
    map.set('pane-term-1', {
      id: 'pane-term-1',
      title: 'SSH Terminal Lab [localhost]',
      type: 'SSH_TERMINAL',
      glyph: '❯_',
    });
    map.set('pane-study-1', {
      id: 'pane-study-1',
      title: 'CS & Study Studio [OSSU Curriculum]',
      type: 'STUDY_NOTION',
      glyph: '0x',
    });
    return map;
  });

  // 4. BSP Tree Layout State (Default 50/50 vertical split: Terminal on left, Study on right)
  const [tree, setTree] = useState<BspTree>(() => {
    const root = splitPane(createInitialTree('pane-term-1'), 'pane-term-1', 'vertical', 'pane-study-1', 0.5);
    return {
      root,
      activePaneId: 'pane-term-1',
      maximizedPaneId: null,
    };
  });

  // Spatial layout calculation for directional navigation
  const layout = useMemo(() => calculateLayout(tree.root), [tree.root]);

  // 5. Directional Focus Navigation (Alt+H/J/K/L or Alt+Arrows)
  const handleNavigate = useCallback(
    (dir: NavigationDirection) => {
      const neighborId = getDirectionalNeighbor(layout.paneRects, tree.activePaneId, dir);
      if (neighborId) {
        setTree((prev) => ({ ...prev, activePaneId: neighborId }));
      }
    },
    [layout.paneRects, tree.activePaneId]
  );

  // 6. Split Pane (Alt+V for Vertical, Alt+S for Horizontal)
  const handleSplit = useCallback(
    (direction: SplitDirection) => {
      const newPaneId = 'pane-' + generateNodeId();

      // Cycle tool types based on profile context
      const newType: PaneContentType =
        profileId === 'CYBER' ? 'SSH_TERMINAL' : profileId === 'STUDY' ? 'STUDY_NOTION' : 'BUILD_X';

      const newTitle =
        newType === 'SSH_TERMINAL'
          ? 'SSH Terminal Lab'
          : newType === 'STUDY_NOTION'
          ? 'Study & Notes'
          : 'Build-Your-Own-X Lab';

      const newGlyph = newType === 'SSH_TERMINAL' ? '❯_' : newType === 'STUDY_NOTION' ? '0x' : '⎇';

      setPanes((prev) => {
        const next = new Map(prev);
        next.set(newPaneId, {
          id: newPaneId,
          title: newTitle,
          type: newType,
          glyph: newGlyph,
        });
        return next;
      });

      setTree((prev) => ({
        ...prev,
        root: splitPane(prev.root, prev.activePaneId, direction, newPaneId, 0.5),
        activePaneId: newPaneId,
      }));
    },
    [profileId, tree.activePaneId]
  );

  // 7. Close Active Pane (Alt+Q)
  const handleClosePane = useCallback(
    (targetId?: string) => {
      const idToClose = targetId || tree.activePaneId;
      if (panes.size <= 1) return; // Keep at least one pane active

      const remainingPanes = Array.from(panes.keys()).filter((id) => id !== idToClose);
      const nextActiveId = remainingPanes[0];

      setPanes((prev) => {
        const next = new Map(prev);
        next.delete(idToClose);
        return next;
      });

      setTree((prev) => ({
        ...prev,
        root: closePane(prev.root, idToClose),
        activePaneId: nextActiveId,
        maximizedPaneId: prev.maximizedPaneId === idToClose ? null : prev.maximizedPaneId,
      }));
    },
    [panes.size, tree.activePaneId]
  );

  // 8. Maximize Active Pane (Alt+F)
  const handleToggleMaximize = useCallback(() => {
    setTree((prev) => ({
      ...prev,
      maximizedPaneId: prev.maximizedPaneId ? null : prev.activePaneId,
    }));
  }, []);

  // 9. Divider Ratio Drag Adjust
  const handleRatioChange = useCallback((nodeId: string, newRatio: number) => {
    setTree((prev) => ({
      ...prev,
      root: updateNodeRatio(prev.root, nodeId, newRatio),
    }));
  }, []);

  // 10. Direct Tool Launch from Intent Rail / Command Palette
  const handleOpenTool = useCallback(
    (type: PaneContentType, title: string, glyph: string) => {
      const newPaneId = 'pane-' + generateNodeId();
      setPanes((prev) => {
        const next = new Map(prev);
        next.set(newPaneId, {
          id: newPaneId,
          title,
          type,
          glyph,
        });
        return next;
      });

      setTree((prev) => ({
        ...prev,
        root: splitPane(prev.root, prev.activePaneId, 'vertical', newPaneId, 0.5),
        activePaneId: newPaneId,
      }));
    },
    [tree.activePaneId]
  );

  // 11. Global Keyboard Routing Hook
  useBspKeyboard({
    onNavigate: handleNavigate,
    onSplit: handleSplit,
    onClose: () => handleClosePane(),
    onToggleMaximize: handleToggleMaximize,
    onSwitchProfile: setProfileId,
    onOpenCommandPalette: () => setIsCommandPaletteOpen(true),
  });

  // 12. Actions for Command Palette
  const commandActions: CommandAction[] = useMemo(
    () => [
      {
        id: 'split-v',
        category: 'WINDOW_MANAGER',
        title: 'Split Pane Vertically (Side-by-Side)',
        shortcut: 'Alt+V',
        glyph: '[|]',
        action: () => handleSplit('vertical'),
      },
      {
        id: 'split-h',
        category: 'WINDOW_MANAGER',
        title: 'Split Pane Horizontally (Stacked)',
        shortcut: 'Alt+S',
        glyph: '[-]',
        action: () => handleSplit('horizontal'),
      },
      {
        id: 'close-pane',
        category: 'WINDOW_MANAGER',
        title: 'Close Active Pane',
        shortcut: 'Alt+Q',
        glyph: '[x]',
        action: () => handleClosePane(),
      },
      {
        id: 'toggle-max',
        category: 'WINDOW_MANAGER',
        title: 'Toggle Maximize / Fullscreen Active Pane',
        shortcut: 'Alt+F',
        glyph: '[^]',
        action: handleToggleMaximize,
      },
      {
        id: 'prof-cyber',
        category: 'PROFILE',
        title: 'Switch to Cyber Operations Profile',
        shortcut: 'Alt+1',
        glyph: '❯_',
        action: () => setProfileId('CYBER'),
      },
      {
        id: 'prof-study',
        category: 'PROFILE',
        title: 'Switch to Study & Academics Profile',
        shortcut: 'Alt+2',
        glyph: '0x',
        action: () => setProfileId('STUDY'),
      },
      {
        id: 'prof-dev',
        category: 'PROFILE',
        title: 'Switch to Systems Engineering Profile',
        shortcut: 'Alt+3',
        glyph: '⎇',
        action: () => setProfileId('DEV'),
      },
      {
        id: 'launch-ssh',
        category: 'TOOLS',
        title: 'Launch Native Web SSH Terminal Lab',
        glyph: '❯_',
        action: () => handleOpenTool('SSH_TERMINAL', 'SSH Lab Terminal', '❯_'),
      },
      {
        id: 'launch-study',
        category: 'TOOLS',
        title: 'Launch Course & Study Workstation (Notion style)',
        glyph: '0x',
        action: () => handleOpenTool('STUDY_NOTION', 'Course & Study Studio', '0x'),
      },
      {
        id: 'launch-buildx',
        category: 'TOOLS',
        title: 'Launch Build-Your-Own-X Blueprint Lab',
        glyph: '⎇',
        action: () => handleOpenTool('BUILD_X', 'Build-Your-Own-X Lab', '⎇'),
      },
      {
        id: 'launch-sysdesign',
        category: 'TOOLS',
        title: 'Launch System Design & Scalability Studio',
        glyph: '∑',
        action: () => handleOpenTool('SYSTEM_DESIGN', 'System Design Studio', '∑'),
      },
      {
        id: 'launch-api',
        category: 'TOOLS',
        title: 'Launch Public APIs Directory & ApiLab',
        glyph: '⚡',
        action: () => handleOpenTool('API_LAB', 'Live API Directory', '⚡'),
      },
      {
        id: 'launch-c2',
        category: 'TOOLS',
        title: 'Launch Cyber Operations & Admin C2 Console',
        glyph: '🛡️',
        action: () => handleOpenTool('CYBER_C2', 'Cyber Admin C2 Hub', '🛡️'),
      },
    ],
    [handleSplit, handleClosePane, handleToggleMaximize, handleOpenTool]
  );

  // 13. Render Content for Each Pane
  const renderPaneContent = useCallback(
    (pane: PaneDefinition) => {
      switch (pane.type) {
        case 'SSH_TERMINAL':
          return <SshTerminalPane theme={theme} />;
        case 'STUDY_NOTION':
          return <StudyNotionPane theme={theme} />;
        case 'BUILD_X':
          return <BuildYourOwnXPane theme={theme} />;
        case 'SYSTEM_DESIGN':
          return <SystemDesignPane theme={theme} />;
        case 'API_LAB':
          return <ApiLabPane theme={theme} />;
        case 'CYBER_C2':
          return <CyberAdminApp windowId={pane.id} isActive={true} onClose={() => handleClosePane(pane.id)} />;
        default:
          return (
            <div className="p-4 text-xs text-neutral-400 font-mono">
              Unknown tool content type: {pane.type}
            </div>
          );
      }
    },
    [theme, handleClosePane]
  );

  return (
    <div
      className="flex w-screen h-screen overflow-hidden select-none"
      style={{
        backgroundColor: theme.bgPrimary,
        color: theme.textPrimary,
      }}
    >
      {/* Left Intent Rail */}
      <IntentRail
        currentProfile={profileId}
        theme={theme}
        onSelectProfile={setProfileId}
        onOpenTool={handleOpenTool}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onToggleLegacyMode={onToggleLegacyMode}
      />

      {/* Main BSP Tiling Grid */}
      <div className="flex-1 h-full overflow-hidden">
        <BspGrid
          tree={tree}
          panes={panes}
          theme={theme}
          onSelectPane={(paneId) => setTree((prev) => ({ ...prev, activePaneId: paneId }))}
          onClosePane={handleClosePane}
          onSplitPane={(paneId, dir) => {
            setTree((prev) => ({ ...prev, activePaneId: paneId }));
            handleSplit(dir);
          }}
          onToggleMaximize={handleToggleMaximize}
          onRatioChange={handleRatioChange}
          renderPaneContent={renderPaneContent}
        />
      </div>

      {/* Keyboard-driven Command Palette (Alt+P / Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        theme={theme}
        onClose={() => setIsCommandPaletteOpen(false)}
        actions={commandActions}
      />
    </div>
  );
};
export default WorkbenchRoot;
