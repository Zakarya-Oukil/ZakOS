import fs from 'node:fs';
import path from 'node:path';
import * as projects from '../projects/store';

/**
 * Graph history. graphify keeps its own dated backups inside `graphify-out/`, and Zak OS saves a
 * snapshot of the current graph before every rebuild it runs, so two points in time can be compared.
 */
const SNAP_ROOT = path.resolve(process.cwd(), 'data', 'graph-snapshots');
const KEEP = 12;

export interface Snapshot {
  /** `current`, `app:<file>` or `graphify:<folder>`. */
  id: string;
  label: string;
  ts: number;
  nodes: number;
  edges: number;
}

interface RawGraph {
  nodes?: Array<Record<string, any>>;
  links?: Array<Record<string, any>>;
  edges?: Array<Record<string, any>>;
}

const read = (file: string): RawGraph | undefined => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
};
const edgesOf = (g: RawGraph) => g.links ?? g.edges ?? [];
const currentFile = (projectPath: string) => path.join(projectPath, 'graphify-out', 'graph.json');

/** Copies the current graph aside. Called just before a rebuild, so the old shape is never lost. */
export function snapshotBeforeRebuild(projectId: string, projectPath: string) {
  const src = currentFile(projectPath);
  if (!fs.existsSync(src)) return;
  const dir = path.join(SNAP_ROOT, projectId);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, path.join(dir, `${Date.now()}.json`));
  const all = fs.readdirSync(dir).sort();
  for (const old of all.slice(0, Math.max(0, all.length - KEEP))) fs.rmSync(path.join(dir, old), { force: true });
}

function resolveSnapshot(projectId: string, projectPath: string, id: string): { file: string; ts: number; label: string } | undefined {
  if (id === 'current') {
    const f = currentFile(projectPath);
    return fs.existsSync(f) ? { file: f, ts: fs.statSync(f).mtimeMs, label: 'Now' } : undefined;
  }
  const [kind, name] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
  // Names come from the client, so only plain file or folder names are accepted.
  if (!/^[\w.-]+$/.test(name)) return undefined;
  if (kind === 'app') {
    const f = path.join(SNAP_ROOT, projectId, name);
    return fs.existsSync(f) ? { file: f, ts: Number(name.replace('.json', '')) || fs.statSync(f).mtimeMs, label: 'Before a rebuild' } : undefined;
  }
  if (kind === 'graphify') {
    const f = path.join(projectPath, 'graphify-out', name, 'graph.json');
    return fs.existsSync(f) ? { file: f, ts: fs.statSync(f).mtimeMs, label: `graphify backup ${name}` } : undefined;
  }
  return undefined;
}

export function listSnapshots(projectId: string): Snapshot[] {
  const p = projects.getProject(projectId);
  if (!p) throw new Error('Project not found');
  const out: Snapshot[] = [];
  const add = (id: string) => {
    const s = resolveSnapshot(projectId, p.path, id);
    const g = s && read(s.file);
    if (s && g) out.push({ id, label: s.label, ts: s.ts, nodes: g.nodes?.length ?? 0, edges: edgesOf(g).length });
  };
  add('current');
  try {
    for (const f of fs.readdirSync(path.join(SNAP_ROOT, projectId))) add(`app:${f}`);
  } catch {
    /* no rebuilds recorded yet */
  }
  try {
    for (const e of fs.readdirSync(path.join(p.path, 'graphify-out'), { withFileTypes: true })) {
      if (e.isDirectory() && /^\d{4}-\d{2}-\d{2}/.test(e.name)) add(`graphify:${e.name}`);
    }
  } catch {
    /* no graphify backups */
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export interface GraphDiff {
  from: Snapshot;
  to: Snapshot;
  addedCount: number;
  removedCount: number;
  added: Array<{ label: string; file?: string }>;
  removed: Array<{ label: string; file?: string }>;
  edgesAdded: number;
  edgesRemoved: number;
  /** Files whose symbols changed the most, biggest first. */
  hotFiles: Array<{ file: string; added: number; removed: number }>;
  truncated: boolean;
}

export function diffGraphs(projectId: string, fromId: string, toId: string): GraphDiff {
  const p = projects.getProject(projectId);
  if (!p) throw new Error('Project not found');
  const a = resolveSnapshot(projectId, p.path, fromId);
  const b = resolveSnapshot(projectId, p.path, toId);
  if (!a || !b) throw new Error('That snapshot no longer exists');
  const ga = read(a.file);
  const gb = read(b.file);
  if (!ga || !gb) throw new Error('A graph file could not be read');

  const nodesA = new Map((ga.nodes ?? []).map((n) => [String(n.id), n]));
  const nodesB = new Map((gb.nodes ?? []).map((n) => [String(n.id), n]));
  const edgeKey = (e: Record<string, any>) => `${e.source}\u0000${e.target}\u0000${e.relation ?? ''}`;
  const edgesA = new Set(edgesOf(ga).map(edgeKey));
  const edgesB = new Set(edgesOf(gb).map(edgeKey));

  const describe = (n: Record<string, any>) => ({ label: String(n.label ?? n.id), file: typeof n.source_file === 'string' ? n.source_file : undefined });
  const added = [...nodesB.entries()].filter(([id]) => !nodesA.has(id)).map(([, n]) => describe(n));
  const removed = [...nodesA.entries()].filter(([id]) => !nodesB.has(id)).map(([, n]) => describe(n));

  const byFile = new Map<string, { added: number; removed: number }>();
  const bump = (file: string | undefined, key: 'added' | 'removed') => {
    if (!file) return;
    const row = byFile.get(file) ?? { added: 0, removed: 0 };
    row[key]++;
    byFile.set(file, row);
  };
  added.forEach((n) => bump(n.file, 'added'));
  removed.forEach((n) => bump(n.file, 'removed'));

  const snap = (s: { ts: number; label: string }, id: string, g: RawGraph): Snapshot => ({ id, label: s.label, ts: s.ts, nodes: g.nodes?.length ?? 0, edges: edgesOf(g).length });
  return {
    from: snap(a, fromId, ga),
    to: snap(b, toId, gb),
    addedCount: added.length,
    removedCount: removed.length,
    added: added.slice(0, 200),
    removed: removed.slice(0, 200),
    edgesAdded: [...edgesB].filter((e) => !edgesA.has(e)).length,
    edgesRemoved: [...edgesA].filter((e) => !edgesB.has(e)).length,
    hotFiles: [...byFile.entries()].map(([file, v]) => ({ file, ...v })).sort((x, y) => y.added + y.removed - (x.added + x.removed)).slice(0, 12),
    truncated: added.length > 200 || removed.length > 200,
  };
}
