import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Brain, Search, Sparkles, Filter, CheckCircle2, 
  ExternalLink, Layers, ZoomIn, ZoomOut, RotateCcw, 
  Tag, Link2, FileText, ArrowRight, Zap, Database,
  Eye, RefreshCw, X
} from 'lucide-react';
import { api } from '../../../services/api';
import { NoteItem } from '../../../types';
import { MemoryNode, MemoryGraph, Rect, TruthLifecycleStage } from '../../../types/brain';
import { distillMemoryGraph, CLUSTER_COLORS, lerpRect, cameraRectForNode } from '../../../services/brainCore';
import { soundEngine } from '../../../services/soundEffects';

interface GbrainMemoryAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
  onOpenNote?: (noteId: string) => void;
}

const DEFAULT_RECT: Rect = { x: 0, y: 0, w: 800, h: 800 };

export const GbrainMemoryApp: React.FC<GbrainMemoryAppProps> = ({ onOpenNote }) => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<TruthLifecycleStage>('all');
  const [selectedNode, setSelectedNode] = useState<MemoryNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewRect, setViewRect] = useState<Rect>(DEFAULT_RECT);
  const targetRectRef = useRef<Rect>(DEFAULT_RECT);
  const animFrameRef = useRef<number | null>(null);

  // Load live vault notes
  const loadVaultData = useCallback(() => {
    setLoading(true);
    api.getNotes()
      .then((data) => {
        setNotes(data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load notes for G-Brain:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadVaultData();
  }, [loadVaultData]);

  // Distill memory graph from real notes
  const memoryGraph: MemoryGraph = useMemo(() => {
    if (!notes.length) return { nodes: [], edges: [], clusters: [] };
    return distillMemoryGraph(notes, 140);
  }, [notes]);

  // Filter nodes by stage and search query
  const filteredNodes = useMemo(() => {
    return memoryGraph.nodes.filter((node) => {
      const matchesStage = activeStage === 'all' || node.stage === activeStage;
      const matchesSearch = !searchQuery || 
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.tags && node.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
      return matchesStage && matchesSearch;
    });
  }, [memoryGraph, activeStage, searchQuery]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  // Smooth cinematic camera loop
  useEffect(() => {
    const loop = () => {
      setViewRect((prev) => {
        const target = targetRectRef.current;
        const diff = Math.abs(prev.x - target.x) + Math.abs(prev.y - target.y) + Math.abs(prev.w - target.w);
        if (diff < 0.2) return target;
        return lerpRect(prev, target, 0.12);
      });
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const handleSelectNode = (node: MemoryNode) => {
    soundEngine.playClick();
    setSelectedNode(node);
    targetRectRef.current = cameraRectForNode(node, 800);
  };

  const handleResetCamera = () => {
    soundEngine.playClick();
    setSelectedNode(null);
    targetRectRef.current = DEFAULT_RECT;
  };

  const handleZoom = (delta: number) => {
    soundEngine.playClick();
    const curr = targetRectRef.current;
    const factor = delta > 0 ? 0.75 : 1.33;
    const newW = Math.max(150, Math.min(1200, curr.w * factor));
    const newH = Math.max(150, Math.min(1200, curr.h * factor));
    const cx = curr.x + curr.w / 2;
    const cy = curr.y + curr.h / 2;
    targetRectRef.current = {
      x: cx - newW / 2,
      y: cy - newH / 2,
      w: newW,
      h: newH,
    };
  };

  const counts = useMemo(() => {
    const s = { source: 0, signal: 0, claim: 0, fact: 0, memory: 0 };
    memoryGraph.nodes.forEach(n => {
      if (n.stage && s[n.stage] !== undefined) s[n.stage]++;
    });
    return s;
  }, [memoryGraph]);

  return (
    <div className="h-full flex flex-col bg-[#080808] text-zinc-100 font-sans select-none overflow-hidden">
      {/* Top Telemetry & Lifecycle Header */}
      <div className="px-4 py-2.5 bg-neutral-950/80 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
            <Brain className="w-4 h-4 text-violet-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider text-white uppercase">
                G-Brain Epistemic Core
              </span>
              <span className="px-1.5 py-0.2 text-[9px] font-mono bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded">
                v2.6 CONSTELLATION
              </span>
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              Vault Synced: {notes.length} Notes · {memoryGraph.nodes.length} Nodes Rendered
            </div>
          </div>
        </div>

        {/* Truth Lifecycle Stage Buttons */}
        <div className="flex items-center bg-black/60 border border-white/10 p-0.5 rounded-lg font-mono text-[11px]">
          {(['all', 'signal', 'claim', 'fact', 'memory'] as TruthLifecycleStage[]).map((stage) => {
            const isActive = activeStage === stage;
            const count = stage === 'all' ? memoryGraph.nodes.length : counts[stage as keyof typeof counts];
            return (
              <button
                key={stage}
                onClick={() => {
                  soundEngine.playClick();
                  setActiveStage(stage);
                }}
                className={`px-2.5 py-1 rounded transition-all flex items-center gap-1.5 capitalize ${
                  isActive 
                    ? 'bg-violet-600 text-white font-bold shadow-lg shadow-violet-600/30' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <span>{stage}</span>
                <span className={`text-[9px] px-1 rounded ${isActive ? 'bg-black/40 text-white' : 'bg-white/5 text-zinc-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search vault constellation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 pl-8 pr-3 py-1 bg-black/60 border border-white/10 rounded text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />
          </div>
          <button
            onClick={loadVaultData}
            title="Reload Vault Data"
            className="p-1.5 bg-white/5 border border-white/10 hover:border-white/20 rounded text-zinc-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Workspace (Constellation Canvas + Note Inspector) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Constellation Canvas Viewport */}
        <div className="flex-1 h-full relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-950 via-[#080808] to-black overflow-hidden">
          {/* Subtle Grid / Radar Overlay */}
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:24px_24px]" />

          {/* SVG Constellation */}
          <svg
            className="w-full h-full cursor-crosshair"
            viewBox={`${viewRect.x} ${viewRect.y} ${viewRect.w} ${viewRect.h}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id="haloGrad" cx="50%" cy="50%" r="50%">
                <stop offset="70%" stopColor="#a855f7" stopOpacity="0.03" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.12" />
              </radialGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Core Disc Boundary (400, 400 is center, radius 320) */}
            <circle
              cx="400"
              cy="400"
              r="320"
              fill="url(#haloGrad)"
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="4 4"
            />
            <circle
              cx="400"
              cy="400"
              r="180"
              fill="none"
              stroke="rgba(255,255,255,0.04)"
            />

            {/* Edge Lines */}
            <g opacity="0.25">
              {memoryGraph.edges.map((edge, idx) => {
                const src = memoryGraph.nodes.find(n => n.id === edge.source);
                const tgt = memoryGraph.nodes.find(n => n.id === edge.target);
                if (!src || !tgt) return null;
                const srcVisible = filteredNodeIds.has(src.id);
                const tgtVisible = filteredNodeIds.has(tgt.id);
                const isHighlighted = selectedNode && (selectedNode.id === src.id || selectedNode.id === tgt.id);

                const x1 = (src.vx + 1) * 400;
                const y1 = (src.vy + 1) * 400;
                const x2 = (tgt.vx + 1) * 400;
                const y2 = (tgt.vy + 1) * 400;

                return (
                  <line
                    key={`edge-${idx}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isHighlighted ? '#a855f7' : (srcVisible && tgtVisible ? '#ffffff' : '#333333')}
                    strokeWidth={isHighlighted ? 1.8 : 0.6}
                    strokeOpacity={isHighlighted ? 0.9 : 0.2}
                  />
                );
              })}
            </g>

            {/* Node Stars */}
            <g>
              {memoryGraph.nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const isVisible = filteredNodeIds.has(node.id);
                const px = (node.vx + 1) * 400;
                const py = (node.vy + 1) * 400;
                const radius = isSelected ? 8 : Math.max(3, Math.min(7, 2.5 + node.links * 0.8));
                const nodeColor = CLUSTER_COLORS[node.cluster % CLUSTER_COLORS.length];

                return (
                  <g
                    key={node.id}
                    onClick={() => handleSelectNode(node)}
                    className="cursor-pointer transition-transform duration-200"
                    opacity={isVisible ? 1 : 0.15}
                  >
                    {/* Outer selection ring */}
                    {isSelected && (
                      <circle
                        cx={px}
                        cy={py}
                        r={radius + 6}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        className="animate-spin"
                      />
                    )}

                    {/* Glow aura */}
                    <circle
                      cx={px}
                      cy={py}
                      r={radius * 1.6}
                      fill={nodeColor}
                      opacity={isSelected ? 0.4 : 0.15}
                    />

                    {/* Main star */}
                    <circle
                      cx={px}
                      cy={py}
                      r={radius}
                      fill={nodeColor}
                      filter={isSelected ? 'url(#glow)' : undefined}
                      stroke={isSelected ? '#ffffff' : 'rgba(0,0,0,0.6)'}
                      strokeWidth={1}
                    />

                    {/* Label (for higher degree notes or selected) */}
                    {(isSelected || (node.links > 2 && viewRect.w < 700)) && (
                      <text
                        x={px}
                        y={py + radius + 11}
                        textAnchor="middle"
                        fontSize={isSelected ? "11" : "9"}
                        fill={isSelected ? "#ffffff" : "rgba(255,255,255,0.7)"}
                        fontFamily="monospace"
                        fontWeight={isSelected ? "bold" : "normal"}
                        className="pointer-events-none select-none drop-shadow"
                      >
                        {node.label.length > 22 ? `${node.label.slice(0, 20)}...` : node.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Floating Canvas Controls */}
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-black/80 border border-white/10 p-1 rounded-lg backdrop-blur-md">
            <button
              onClick={() => handleZoom(1)}
              title="Zoom In"
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleZoom(-1)}
              title="Zoom Out"
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetCamera}
              title="Reset View"
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Clusters Legend */}
          <div className="absolute top-4 left-4 bg-black/70 border border-white/10 px-3 py-2 rounded-lg backdrop-blur-md max-w-xs pointer-events-none">
            <div className="text-[10px] font-mono uppercase text-zinc-400 font-bold mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-violet-400" />
              <span>Link Communities</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px]">
              {memoryGraph.clusters.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-zinc-300 truncate">{c.name}</span>
                  <span className="text-zinc-500">({c.count})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Note Detail Inspector (Side Drawer) */}
        {selectedNode && (
          <div className="w-80 h-full border-l border-white/10 bg-neutral-950/90 backdrop-blur-md flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Inspector Header */}
            <div className="p-4 border-b border-white/10 flex items-start justify-between gap-2">
              <div>
                <span className="inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase mb-1.5"
                  style={{
                    backgroundColor: `${CLUSTER_COLORS[selectedNode.cluster % CLUSTER_COLORS.length]}20`,
                    color: CLUSTER_COLORS[selectedNode.cluster % CLUSTER_COLORS.length],
                    border: `1px solid ${CLUSTER_COLORS[selectedNode.cluster % CLUSTER_COLORS.length]}40`
                  }}
                >
                  {selectedNode.stage?.toUpperCase() || 'NOTE'}
                </span>
                <h2 className="text-sm font-bold text-white leading-snug">
                  {selectedNode.label}
                </h2>
                <div className="text-[10px] font-mono text-zinc-500 mt-1">
                  Folder: {selectedNode.folder}
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-zinc-500 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Inspector Metrics */}
            <div className="grid grid-cols-3 p-3 gap-2 border-b border-white/5 font-mono text-center">
              <div className="p-2 rounded bg-white/5">
                <div className="text-[9px] text-zinc-500 uppercase">Degree</div>
                <div className="text-base font-bold text-white mt-0.5">{selectedNode.links}</div>
              </div>
              <div className="p-2 rounded bg-white/5">
                <div className="text-[9px] text-zinc-500 uppercase">Words</div>
                <div className="text-base font-bold text-white mt-0.5">{selectedNode.wordCount}</div>
              </div>
              <div className="p-2 rounded bg-white/5">
                <div className="text-[9px] text-zinc-500 uppercase">Chunks</div>
                <div className="text-base font-bold text-white mt-0.5">{selectedNode.chunks}</div>
              </div>
            </div>

            {/* Note Excerpt & Wikilinks */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 font-mono text-xs">
              <div>
                <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">
                  Semantic Excerpt
                </span>
                <p className="text-zinc-300 bg-black/40 border border-white/5 p-2.5 rounded-lg leading-relaxed text-[11px]">
                  {selectedNode.excerpt || 'No excerpt available.'}
                </p>
              </div>

              {selectedNode.tags && selectedNode.tags.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-cyan-400" />
                    Tags
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-cyan-300">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.wikilinks && selectedNode.wikilinks.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1 flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-violet-400" />
                    Outbound Wikilinks ({selectedNode.wikilinks.length})
                  </span>
                  <div className="space-y-1">
                    {selectedNode.wikilinks.map((link) => (
                      <div
                        key={link}
                        className="px-2.5 py-1 rounded bg-black/50 border border-white/5 text-[11px] text-zinc-300 flex items-center justify-between"
                      >
                        <span className="truncate">{link}</span>
                        <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Inspector Footer Actions */}
            <div className="p-3 border-t border-white/10 bg-black/40 flex items-center gap-2">
              <button
                onClick={() => onOpenNote && onOpenNote(selectedNode.id)}
                className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white font-mono text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-violet-600/20"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Open in Vault</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GbrainMemoryApp;
