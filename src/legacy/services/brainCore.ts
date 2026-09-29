import { MemoryNode, MemoryEdge, MemoryGraph, Rect } from '../types/brain';
import { NoteItem } from '../types';

/**
 * Cluster color palette for link communities (Monolith high-contrast cyber theme)
 */
export const CLUSTER_COLORS = [
  '#06b6d4', // 0: Cyan (Primary / GEOINT / Tech)
  '#10b981', // 1: Emerald (Verified Facts / Target Intel)
  '#a855f7', // 2: Purple / Violet (Agentic AI / Master Root)
  '#f59e0b', // 3: Amber (Signals / Claims / eJPT)
  '#ec4899', // 4: Pink (Templates / Methodology)
  '#3b82f6', // 5: Blue (Coding Projects / Systems)
  '#ef4444', // 6: Crimson (Vulnerability / CVEs / Exploits)
  '#71717a', // 7: Zinc (Orphans / Rim halo)
];

export const AGENT_BRAIN_SCOPES: Record<string, string[]> = {
  conductor: ['*'],
  jarvis: ['*'],
  ares: ['certs', 'targets', '01 Certifications'],
  daedalus: ['coding', '02 Coding Projects', 'dev'],
  socrates: ['study', '04 Knowledge Base', 'philosophy'],
  athena: ['aios', '03 AI OS', 'strategy'],
  founder: ['companies', 'projects', 'finances', 'vault']
};

/**
 * Split text into ~120 word semantic chunks (matching FounderOS pipeline)
 */
export function chunkText(text: string): string[] {
  const CHUNK_WORDS = 120;
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  let words = 0;
  for (const p of paragraphs) {
    const w = p.split(/\s+/).length;
    if (words > 0 && words + w > CHUNK_WORDS) {
      chunks.push(current);
      current = '';
      words = 0;
    }
    current = current ? `${current}\n\n${p}` : p;
    words += w;
    while (words > CHUNK_WORDS) {
      const all = current.split(/\s+/);
      chunks.push(all.slice(0, CHUNK_WORDS).join(' '));
      current = all.slice(CHUNK_WORDS).join(' ');
      words = current ? current.split(/\s+/).length : 0;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Extract [[wikilinks]] and #tags from markdown text
 */
export function extractLinksAndTags(text: string): { wikilinks: string[]; tags: string[] } {
  const wikilinks: string[] = [];
  const tags: string[] = [];

  const wikiRegex = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = wikiRegex.exec(text)) !== null) {
    wikilinks.push(match[1].trim());
  }

  const tagRegex = /(?:^|\s)#([a-z0-9][\w/-]*)/gi;
  while ((match = tagRegex.exec(text)) !== null) {
    tags.push(match[1].trim());
  }

  return { wikilinks, tags };
}

/**
 * Distill Vault notes into an interactive memory constellation graph
 */
export function distillMemoryGraph(notes: NoteItem[], maxNodes = 120): MemoryGraph {
  const nodeMap = new Map<string, NoteItem>();
  const idToTitle = new Map<string, string>();
  const titleToId = new Map<string, string>();

  notes.forEach((n) => {
    nodeMap.set(n.id, n);
    idToTitle.set(n.id, n.title.toLowerCase());
    titleToId.set(n.title.toLowerCase(), n.id);
  });

  // Calculate degrees & edges from outbound links
  const degreeMap = new Map<string, number>();
  const rawEdges: MemoryEdge[] = [];

  notes.forEach((n) => {
    const outbound: string[] = n.links || [];
    outbound.forEach((targetTitle: string) => {
      const targetId = titleToId.get(targetTitle.toLowerCase());
      if (targetId && targetId !== n.id) {
        rawEdges.push({ source: n.id, target: targetId, type: 'wikilink' });
        degreeMap.set(n.id, (degreeMap.get(n.id) ?? 0) + 1);
        degreeMap.set(targetId, (degreeMap.get(targetId) ?? 0) + 1);
      }
    });
  });

  // Rank notes by degree, then word count, then tier
  const ranked = [...notes].sort((a, b) => {
    const degA = degreeMap.get(a.id) ?? 0;
    const degB = degreeMap.get(b.id) ?? 0;
    if (degB !== degA) return degB - degA;
    return (b.wordCount || 0) - (a.wordCount || 0);
  });

  const keptNotes = ranked.slice(0, maxNodes);
  const keptIds = new Set(keptNotes.map((n) => n.id));

  // Filter edges to kept notes
  const edges = rawEdges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target));

  // Determine clusters (by branch or link community)
  const branchClusters: Record<string, number> = {
    nucleus: 2, // Violet
    certs: 1,   // Emerald
    coding: 5,  // Blue
    aios: 2,    // Purple
    kb: 3,      // Amber
    templates: 4, // Pink
    other: 0,   // Cyan
  };

  // Organic circular force layout simulation (Deterministic)
  const N = keptNotes.length;
  const memoryNodes: MemoryNode[] = keptNotes.map((note, index) => {
    const deg = degreeMap.get(note.id) ?? 0;
    const isOrphan = deg === 0;

    // Center higher-degree notes, push orphans to outer rim halo
    let radius = 0.2 + (index / N) * 0.65;
    if (isOrphan) radius = 0.85 + (index % 10) * 0.015;

    const angle = (index * 2.39996323) % (2 * Math.PI); // Golden angle distribution
    const vx = Math.cos(angle) * radius;
    const vy = Math.sin(angle) * radius;

    const cluster = branchClusters[note.branch || 'other'] ?? 0;

    // Deduce lifecycle stage
    let stage: 'source' | 'signal' | 'claim' | 'fact' | 'memory' = 'source';
    if (deg > 4 || note.branch === 'nucleus') stage = 'memory';
    else if (deg > 2) stage = 'fact';
    else if (deg === 1) stage = 'claim';
    else if (note.frontmatter?.status === 'signal') stage = 'signal';

    return {
      id: note.id,
      type: 'page',
      label: note.title,
      folder: note.relativePath?.split(/[\/\\]/)[0] || note.category || note.branch || 'root',
      excerpt: (note.content ? note.content.replace(/^#+\s.*$/gm, '').replace(/\[\[.*?\]\]/g, '').trim().slice(0, 160) : '') || 'No excerpt available.',
      wordCount: note.wordCount || 0,
      chunks: Math.ceil((note.wordCount || 50) / 120),
      vx,
      vy,
      cluster,
      links: deg,
      stage,
      path: note.path,
      tags: note.tags || [],
      wikilinks: note.links || [],
    };
  });

  const clusters = [
    { id: 0, name: 'Cyber & Recon', color: CLUSTER_COLORS[0], count: memoryNodes.filter((n) => n.cluster === 0).length },
    { id: 1, name: 'Verified Lab Intel', color: CLUSTER_COLORS[1], count: memoryNodes.filter((n) => n.cluster === 1).length },
    { id: 2, name: 'Master Nucleus & AI', color: CLUSTER_COLORS[2], count: memoryNodes.filter((n) => n.cluster === 2).length },
    { id: 3, name: 'Knowledge Base', color: CLUSTER_COLORS[3], count: memoryNodes.filter((n) => n.cluster === 3).length },
    { id: 4, name: 'Templates', color: CLUSTER_COLORS[4], count: memoryNodes.filter((n) => n.cluster === 4).length },
    { id: 5, name: 'Software Systems', color: CLUSTER_COLORS[5], count: memoryNodes.filter((n) => n.cluster === 5).length },
  ];

  return {
    nodes: memoryNodes,
    edges,
    clusters,
  };
}

/**
 * Camera ViewBox Lerp Math (FounderOS cinematic camera)
 */
export function lerpRect(from: Rect, to: Rect, factor: number): Rect {
  return {
    x: from.x + (to.x - from.x) * factor,
    y: from.y + (to.y - from.y) * factor,
    w: from.w + (to.w - from.w) * factor,
    h: from.h + (to.h - from.h) * factor,
  };
}

export function cameraRectForNode(node: MemoryNode, viewBoxBase = 800): Rect {
  const nodePixelX = (node.vx + 1) * (viewBoxBase / 2);
  const nodePixelY = (node.vy + 1) * (viewBoxBase / 2);
  const zoomSize = viewBoxBase * 0.35; // 35% focused frame
  return {
    x: nodePixelX - zoomSize / 2,
    y: nodePixelY - zoomSize / 2,
    w: zoomSize,
    h: zoomSize,
  };
}
