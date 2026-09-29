import React, { useRef } from 'react';
import { BspTree, DividerInfo, LayoutRect, PaneDefinition, SplitDirection } from '../types/bspTypes';
import { ProfileThemeTokens } from '../types/profileTypes';
import { calculateLayout } from '../bsp/bspEngine';
import { BspDivider } from './BspDivider';
import { AppLogo } from '../../components/common/AppLogo';

interface BspGridProps {
  tree: BspTree;
  panes: Map<string, PaneDefinition>;
  theme: ProfileThemeTokens;
  onSelectPane: (paneId: string) => void;
  onClosePane: (paneId: string) => void;
  onSplitPane: (paneId: string, direction: SplitDirection) => void;
  onToggleMaximize: () => void;
  onRatioChange: (nodeId: string, newRatio: number) => void;
  renderPaneContent: (pane: PaneDefinition) => React.ReactNode;
}

export const BspGrid: React.FC<BspGridProps> = ({
  tree,
  panes,
  theme,
  onSelectPane,
  onClosePane,
  onSplitPane,
  onToggleMaximize,
  onRatioChange,
  renderPaneContent,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute exact layout rectangles and dividers from the BSP tree
  const { paneRects, dividers } = calculateLayout(tree.root);

  const isMaximized = Boolean(tree.maximizedPaneId);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none font-mono"
      style={{
        backgroundColor: theme.bgPrimary,
        color: theme.textPrimary,
      }}
    >
      {/* ----------------------------------------------------
          1. PERSISTENT PANES (Zero remounting to preserve WebSockets & state)
          ---------------------------------------------------- */}
      {Array.from(panes.values()).map((pane) => {
        const rect: LayoutRect = paneRects.get(pane.id) || { x: 0, y: 0, width: 0, height: 0 };
        const isActive = tree.activePaneId === pane.id;
        const isThisMaximized = tree.maximizedPaneId === pane.id;

        // If something is maximized and it's not this pane, hide it visually but keep mounted
        if (isMaximized && !isThisMaximized) {
          return (
            <div key={pane.id} style={{ display: 'none' }}>
              {renderPaneContent(pane)}
            </div>
          );
        }

        const paneStyle: React.CSSProperties = isThisMaximized
          ? {
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              zIndex: 30,
              borderRadius: theme.borderRadius,
              border: `1px solid ${theme.borderActive}`,
            }
          : {
              position: 'absolute',
              left: `${rect.x}%`,
              top: `${rect.y}%`,
              width: `${rect.width}%`,
              height: `${rect.height}%`,
              borderRadius: theme.borderRadius,
              border: `1px solid ${isActive ? theme.borderActive : theme.borderPrimary}`,
              transition: 'border-color 100ms ease',
            };

        return (
          <div
            key={pane.id}
            onClick={() => onSelectPane(pane.id)}
            style={paneStyle}
            className="flex flex-col overflow-hidden shadow-sm"
          >
            {/* Minimalist 1px Tactile Pane Header */}
            <div
              className="flex items-center justify-between px-2.5 py-1 text-[11px] font-bold border-b transition-colors cursor-pointer"
              style={{
                backgroundColor: isActive ? theme.bgSecondary : theme.bgPanel,
                borderColor: isActive ? theme.borderActive : theme.borderPrimary,
                color: isActive ? theme.textPrimary : theme.textMuted,
                fontFamily: theme.fontHeader,
              }}
            >
              <div className="flex items-center gap-2 truncate">
                <AppLogo
                  name={
                    pane.type === 'SSH_TERMINAL'
                      ? 'terminal'
                      : pane.type === 'FORENSICS_LAB'
                      ? 'wireshark'
                      : pane.type === 'PAYLOAD_MATRIX'
                      ? 'payload'
                      : pane.type === 'THE_ALGORITHMS'
                      ? 'python'
                      : pane.type === 'BUILD_X'
                      ? 'redis'
                      : pane.type === 'SYSTEM_DESIGN'
                      ? 'sysdesign'
                      : pane.type === 'API_LAB'
                      ? 'postman'
                      : pane.type === 'CYBER_C2'
                      ? 'kali'
                      : 'notion'
                  }
                  className="w-3.5 h-3.5"
                />
                <span className="truncate tracking-wide uppercase text-[10px]">
                  {pane.title}
                </span>
                {isThisMaximized && (
                  <span
                    style={{
                      backgroundColor: `${theme.accentPrimary}25`,
                      color: theme.accentPrimary,
                      borderColor: `${theme.accentPrimary}50`,
                    }}
                    className="px-1.5 py-0.2 rounded-xs text-[8px] border uppercase font-mono"
                  >
                    MAXIMIZED (Alt+F)
                  </span>
                )}
              </div>

              {/* Action Glyphs: Split H, Split V, Maximize, Close */}
              <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 font-mono text-[10px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSplitPane(pane.id, 'vertical');
                  }}
                  className="hover:text-white px-1 transition-colors cursor-pointer"
                  title="Split Vertically (Alt+V)"
                >
                  [|]
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSplitPane(pane.id, 'horizontal');
                  }}
                  className="hover:text-white px-1 transition-colors cursor-pointer"
                  title="Split Horizontally (Alt+S)"
                >
                  [-]
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMaximize();
                  }}
                  className="hover:text-white px-1 transition-colors cursor-pointer"
                  title="Maximize / Restore (Alt+F)"
                >
                  {isThisMaximized ? '[v]' : '[^]'}
                </button>
                {panes.size > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClosePane(pane.id);
                    }}
                    className="hover:text-rose-400 px-1 transition-colors cursor-pointer"
                    title="Close Pane (Alt+Q)"
                  >
                    [x]
                  </button>
                )}
              </div>
            </div>

            {/* Pane Body Content */}
            <div
              className="flex-1 w-full h-full overflow-hidden"
              style={{ backgroundColor: theme.bgPanel }}
            >
              {renderPaneContent(pane)}
            </div>
          </div>
        );
      })}

      {/* ----------------------------------------------------
          2. DRAGGABLE 1PX DIVIDERS (Hidden during maximize)
          ---------------------------------------------------- */}
      {!isMaximized &&
        dividers.map((div) => (
          <BspDivider
            key={div.id}
            divider={div}
            parentRef={containerRef}
            currentRatio={0.5}
            theme={theme}
            onRatioChange={onRatioChange}
          />
        ))}
    </div>
  );
};
