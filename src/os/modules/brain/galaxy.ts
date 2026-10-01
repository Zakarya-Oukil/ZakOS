/** Shared shapes for the knowledge map. The scene itself lives in neural.ts. */
export interface GalaxyNode {
  id: string;
  label: string;
  color: string;
  size: number;
  /** Nodes in the same group sit together in one cluster on an arm of the spiral. */
  group: string;
  kind: 'note' | 'project' | 'code';
  degree?: number;
}

export interface GalaxyLink {
  source: string;
  target: string;
}

export interface GalaxyHandlers {
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}
