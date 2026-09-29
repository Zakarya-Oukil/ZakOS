import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Search, ScanEye } from 'lucide-react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { projectsApi, type ProjectGraph, type ProjectInfo } from '../../lib/projectsApi';
import { usePrefersReducedMotion } from '../../theme/motion';
import { IconButton } from '../../ui';
import { cx } from '../../ui/cx';
import { Galaxy, type GalaxyLink, type GalaxyNode } from './galaxy';
import { NoteReader, PanelShell } from './NotePanel';

interface VaultNode {
  id: string;
  label: string;
  path: string;
  branch?: string;
  category?: string;
  linkCount?: number;
}
interface VaultGraph {
  nodes: VaultNode[];
  links: { source: string; target: string }[];
}

// Notes stay cool and quiet so each project's own colour reads at a glance.
const NOTE_TONES = ['#8ea2bd', '#7f9db0', '#93a4c9', '#8fb0b8', '#a6b1c4', '#7d93a8'];

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Community colour: the project's own hue, shifted per community, so a project view stays "its" colour. */
function communityColor(base: string, community: number): string {
  const c = base.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const d = max - min;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + 360) % 360;
  const shifted = (h + ((community * 47) % 110) - 55 + 360) % 360;
  return hslToHex(shifted, 0.68, (58 + ((community * 7) % 12)) / 100);
}

/** three.js does not parse the space-separated CSS hsl() form, so hand it a hex colour. */
function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

/** graphify's Obsidian export lives in each project's `Graph/` folder. Those are a project's own graph. */
const isGraphExport = (n: VaultNode) => n.path.split('/').includes('Graph');

function buildGlobal(vault: VaultGraph, projects: ProjectInfo[]): { nodes: GalaxyNode[]; links: GalaxyLink[] } {
  const notes = vault.nodes.filter((n) => !isGraphExport(n));
  const kept = new Set(notes.map((n) => n.id));
  const nodes: GalaxyNode[] = notes.map((n) => ({
    id: n.id,
    label: n.label,
    color: NOTE_TONES[hash(n.branch || n.category || 'notes') % NOTE_TONES.length],
    size: 2.1 + Math.sqrt(n.linkCount ?? 0) * 0.55,
    group: n.branch || n.category || 'notes',
    kind: 'note',
    degree: n.linkCount,
  }));
  const links: GalaxyLink[] = vault.links.filter((l) => kept.has(l.source) && kept.has(l.target)).map((l) => ({ source: l.source, target: l.target }));

  // A project star is tied to the notes stored in a folder of the same name.
  for (const p of projects) {
    // Folder names rarely match exactly ("Zak_OS" vs "Zak OS Fullstack"), so compare squashed names.
    const key = squash(p.name);
    const related = notes.filter((n) =>
      n.path.split('/').slice(0, -1).some((seg) => {
        const s = squash(seg);
        return key.length >= 4 && s.length >= 4 && (s.includes(key) || key.includes(s));
      }),
    );
    const groups = new Map<string, number>();
    related.forEach((n) => groups.set(n.branch || 'notes', (groups.get(n.branch || 'notes') ?? 0) + 1));
    const home = [...groups.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'projects';
    const id = `project:${p.id}`;
    nodes.push({ id, label: p.name, color: p.color, size: 10, group: home, kind: 'project', degree: related.length });
    related.forEach((n) => links.push({ source: id, target: n.id }));
  }
  return { nodes, links };
}

function buildProject(graph: ProjectGraph, project: ProjectInfo): { nodes: GalaxyNode[]; links: GalaxyLink[] } {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      color: communityColor(project.color, n.community),
      size: 1.6 + Math.min(n.degree, 30) * 0.24,
      group: `c${n.community}`,
      kind: 'code',
      degree: n.degree,
    })),
    links: graph.links.map((l) => ({ source: l.source, target: l.target })),
  };
}

export default function BrainPage({ route, navigate }: ModuleProps) {
  const projectId = route[0];
  const reduced = usePrefersReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const galaxy = useRef<Galaxy | null>(null);

  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [vault, setVault] = useState<VaultGraph | null>(null);
  const [projectGraph, setProjectGraph] = useState<{ project: ProjectInfo; graph: ProjectGraph } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [webglError, setWebglError] = useState(false);

  // ---- data ----
  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setSelectedId(null);
    setQuery('');
    if (projectId) {
      setProjectGraph(null);
      projectsApi
        .graph(projectId)
        .then((d) => live && setProjectGraph(d))
        .catch((e: Error) => live && setError(e.message))
        .finally(() => live && setLoading(false));
    } else {
      fetch('/api/vault/graph')
        .then((r) => r.json())
        .then((d) => {
          if (!live) return;
          if (d.success) setVault(d.graph);
          else setError(d.error || 'Could not load the vault graph');
        })
        .catch((e: Error) => live && setError(e.message))
        .finally(() => live && setLoading(false));
    }
    return () => {
      live = false;
    };
  }, [projectId]);

  const data = useMemo(() => {
    if (projectId) return projectGraph ? buildProject(projectGraph.graph, projectGraph.project) : null;
    return vault ? buildGlobal(vault, projects) : null;
  }, [projectId, projectGraph, vault, projects]);

  const nodeById = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.id, n])), [data]);

  // ---- scene lifecycle ----
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    try {
      galaxy.current = new Galaxy(el, { onSelect: setSelectedId, onHover: setHoverId }, reduced);
    } catch {
      setWebglError(true);
      return;
    }
    return () => {
      galaxy.current?.dispose();
      galaxy.current = null;
    };
  }, [reduced]);

  useEffect(() => {
    if (data && galaxy.current) galaxy.current.setData(data.nodes, data.links);
  }, [data, reduced]);

  useEffect(() => {
    galaxy.current?.select(selectedId, true);
  }, [selectedId]);

  const onSearch = (q: string) => {
    setQuery(q);
    galaxy.current?.search(q);
  };

  const submitSearch = () => {
    const hits = galaxy.current?.search(query) ?? [];
    if (hits.length) setSelectedId(hits[0]);
  };

  const closePanel = useCallback(() => setSelectedId(null), []);

  // ---- derived UI ----
  const currentProject = projectId ? (projectGraph?.project ?? projects.find((p) => p.id === projectId)) : undefined;
  const selected = selectedId ? nodeById.get(selectedId) : undefined;
  const hover = hoverId && hoverId !== selectedId ? nodeById.get(hoverId) : undefined;
  const noteById = useMemo(() => new Map((vault?.nodes ?? []).map((n) => [n.id, n])), [vault]);
  const noteCount = useMemo(() => (vault ? vault.nodes.filter((n) => !isGraphExport(n)).length : 0), [vault]);
  const stats = data
    ? projectId
      ? `${data.nodes.length} symbols, ${data.links.length} links`
      : `${noteCount} notes, ${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`
    : '';

  return (
    <PageFrame
      title="Brain"
      leading={
        projectId ? (
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => navigate('brain')}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--os-radius)] px-2 py-1 text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
            >
              <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
              All
            </button>
            {currentProject && (
              <span className="flex min-w-0 items-center gap-2 text-os-text">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: currentProject.color }} aria-hidden />
                <span className="truncate font-medium">{currentProject.name}</span>
              </span>
            )}
          </span>
        ) : (
          <span className="hidden text-sm text-os-muted sm:inline">{stats}</span>
        )
      }
      actions={
        <>
          <div className="relative hidden sm:block">
            <label htmlFor="brain-search" className="sr-only">
              Search the graph
            </label>
            <Search size={14} strokeWidth={1.75} className="pointer-events-none absolute left-2 top-2 text-os-muted" aria-hidden />
            <input
              id="brain-search"
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
              placeholder="Search"
              className="h-7 w-48 rounded-[var(--os-radius)] border border-os-line bg-os-bg pl-7 pr-2 text-sm text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
            />
          </div>
          <IconButton aria-label="Reset the view" onClick={() => galaxy.current?.resetView()}>
            <ScanEye size={16} strokeWidth={1.75} />
          </IconButton>
        </>
      }
    >
      <div className="relative h-full overflow-hidden bg-os-bg">
        <div ref={host} className="absolute inset-0" aria-label="Interactive 3D graph" role="img" />

        {loading && (
          <p role="status" className="absolute left-4 top-4 text-sm text-os-muted">
            Loading the graph
          </p>
        )}
        {webglError && (
          <p role="alert" className="absolute left-4 top-4 max-w-sm text-sm text-os-danger">
            This browser cannot run WebGL, so the 3D view is unavailable.
          </p>
        )}
        {error && (
          <div role="alert" className="absolute left-4 top-4 max-w-md text-sm">
            <p className="text-os-danger">{error}</p>
            {projectId && (
              <a href="#/projects" className="mt-1 inline-block text-os-cyan underline underline-offset-2">
                Go to Projects to build it
              </a>
            )}
          </div>
        )}
        {data && data.nodes.length === 0 && !loading && <p className="absolute left-4 top-4 text-sm text-os-muted">This graph has no nodes yet.</p>}

        {/* Project legend: one colour per project; click to open its own graph. */}
        {!projectId && projects.length > 0 && (
          <nav aria-label="Projects" className="absolute bottom-4 left-4 z-[5] max-h-[40%] w-56 overflow-y-auto rounded-[var(--os-radius)] border border-os-line bg-os-surface p-1.5">
            <p className="px-2 pb-1 pt-1 text-xs text-os-muted">Projects</p>
            <ul className="grid gap-0.5">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => navigate('brain', p.id)}
                    className="flex w-full items-center gap-2 rounded-[var(--os-radius-sm)] px-2 py-1.5 text-left text-sm text-os-text hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {!p.hasGraph && <span className="text-xs text-os-muted">no graph</span>}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {!projectId && projects.length === 0 && !loading && (
          <p className="absolute bottom-4 left-4 z-[5] max-w-xs text-sm text-os-muted">
            Add projects to see each one as its own coloured star.{' '}
            <a href="#/projects" className="text-os-cyan underline underline-offset-2">
              Open Projects
            </a>
          </p>
        )}

        {hover && !selected && (
          <p className="pointer-events-none absolute bottom-4 right-4 z-[5] max-w-xs truncate rounded-[var(--os-radius)] border border-os-line bg-os-surface px-2.5 py-1 text-sm text-os-text">
            {hover.label}
          </p>
        )}

        {/* Details for the selected star. */}
        {selected && !projectId && selected.kind === 'note' && noteById.get(selected.id) && (
          <NoteReader path={noteById.get(selected.id)!.path} onClose={closePanel} />
        )}
        {selected && !projectId && selected.kind === 'project' && (
          <ProjectCard
            node={selected}
            project={projects.find((p) => `project:${p.id}` === selected.id)}
            onOpen={(id) => navigate('brain', id)}
            onClose={closePanel}
          />
        )}
        {selected && projectId && (
          <PanelShell title={selected.label} subtitle={`${selected.degree ?? 0} connections`} onClose={closePanel}>
            <SymbolDetails
              id={selected.id}
              graph={projectGraph?.graph}
              onPick={(id) => setSelectedId(id)}
            />
          </PanelShell>
        )}
      </div>
    </PageFrame>
  );
}

function ProjectCard({ node, project, onOpen, onClose }: { node: GalaxyNode; project?: ProjectInfo; onOpen: (id: string) => void; onClose: () => void }) {
  return (
    <PanelShell title={node.label} subtitle="Project" onClose={onClose}>
      <div className="grid gap-4 text-sm">
        {project && (
          <p className="break-all font-os-mono text-xs text-os-muted">{project.path}</p>
        )}
        <p className="max-w-[55ch] leading-relaxed text-os-muted">
          {node.degree ? `${node.degree} vault notes mention this project.` : 'No vault notes are filed under this project yet.'}
        </p>
        {project?.hasGraph ? (
          <button
            type="button"
            onClick={() => onOpen(project.id)}
            className={cx(
              'inline-flex h-9 items-center justify-center rounded-[var(--os-radius)] border border-os-cyan bg-os-surface-2 px-4 text-sm text-os-text',
              'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]',
            )}
          >
            Open this project's graph
          </button>
        ) : (
          <p className="text-os-muted">
            No graph yet.{' '}
            <a href="#/projects" className="text-os-cyan underline underline-offset-2">
              Build it in Projects
            </a>
          </p>
        )}
      </div>
    </PanelShell>
  );
}

function SymbolDetails({ id, graph, onPick }: { id: string; graph?: ProjectGraph; onPick: (id: string) => void }) {
  const node = graph?.nodes.find((n) => n.id === id);
  const neighbors = useMemo(() => {
    if (!graph) return [];
    const ids = new Set<string>();
    graph.links.forEach((l) => {
      if (l.source === id) ids.add(l.target);
      if (l.target === id) ids.add(l.source);
    });
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    return [...ids].map((i) => byId.get(i)!).filter(Boolean).sort((a, b) => b.degree - a.degree);
  }, [graph, id]);

  if (!node) return null;
  return (
    <div className="grid gap-4 text-sm">
      {node.file && <p className="break-all font-os-mono text-xs text-os-muted">{node.file}</p>}
      {node.communityName && <p className="text-os-muted">Cluster: {node.communityName}</p>}
      <div>
        <h3 className="mb-1.5 text-xs text-os-muted">Connected to</h3>
        {neighbors.length === 0 ? (
          <p className="text-os-muted">Nothing else is linked to this one.</p>
        ) : (
          <ul className="grid gap-0.5">
            {neighbors.slice(0, 40).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onPick(n.id)}
                  className="w-full truncate rounded-[var(--os-radius-sm)] px-2 py-1 text-left text-os-text hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
                >
                  {n.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
