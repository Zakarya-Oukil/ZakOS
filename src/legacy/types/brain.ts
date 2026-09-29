// ==========================================
// FOUNDER_OS / ZAKOS — EPISTEMIC BRAIN & KNOWLEDGE TYPES
// ==========================================

export type TruthLifecycleStage = 'all' | 'signal' | 'claim' | 'fact' | 'memory';

export interface MemoryNode {
  id: string;
  type: 'folder' | 'page';
  label: string;
  folder: string;
  excerpt: string;
  wordCount: number;
  chunks: number;
  vx: number; // layout coords in the unit disc (-1 to 1 or pixel coords)
  vy: number;
  /** link community (0 = largest, drives cluster color) */
  cluster: number;
  /** degree among kept nodes (wikilink + similar); 0 = orphan on rim halo */
  links: number;
  stage?: 'source' | 'signal' | 'claim' | 'fact' | 'memory';
  path?: string;
  tags?: string[];
  wikilinks?: string[];
}

export interface MemoryEdge {
  source: string;
  target: string;
  type: 'wikilink' | 'member' | 'semantic';
}

export interface MemoryGraph {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  clusters: {
    id: number;
    name: string;
    color: string;
    count: number;
  }[];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BrainDumpPayload {
  title: string;
  content: string;
  stage: 'signal' | 'claim' | 'fact' | 'memory';
  folder?: string;
  tags?: string[];
}
