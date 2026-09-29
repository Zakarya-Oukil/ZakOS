export type SplitDirection = 'horizontal' | 'vertical';
export type NavigationDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface BspNode {
  id: string;
  split?: SplitDirection;
  ratio?: number; // 0.0 to 1.0 (default: 0.5)
  first?: BspNode;
  second?: BspNode;
  paneId?: string; // leaf node id if it's a pane
}

export interface BspTree {
  root: BspNode;
  activePaneId: string;
  maximizedPaneId: string | null;
}

export interface LayoutRect {
  x: number; // percentage 0 to 100
  y: number; // percentage 0 to 100
  width: number; // percentage 0 to 100
  height: number; // percentage 0 to 100
}

export interface DividerInfo {
  id: string; // nodeId representing the split
  nodeId: string;
  direction: SplitDirection;
  x: number;
  y: number;
  length: number; // width if horizontal, height if vertical
}

export type PaneContentType = 
  | 'SSH_TERMINAL'
  | 'STUDY_NOTION'
  | 'DEV_MONACO'
  | 'CYBER_C2'
  | 'API_LAB'
  | 'BUILD_X'
  | 'SYSTEM_DESIGN'
  | 'ROADMAP_MATRIX'
  | 'FORENSICS_LAB'
  | 'PAYLOAD_MATRIX'
  | 'THE_ALGORITHMS';

export interface PaneDefinition {
  id: string;
  title: string;
  type: PaneContentType;
  glyph: string;
  params?: Record<string, any>;
  isPinned?: boolean;
}
