import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GalaxyHandlers, GalaxyLink, GalaxyNode } from './galaxy';

/**
 * Knowledge terrain: every note is a peak on one shared height field. Contour lines and hill shading
 * are computed in the fragment shader, so the whole map is a single mesh. Projects are summits with flags.
 */

export type HeightMode = 'importance' | 'freshness' | 'size';

export interface TerrainNode extends GalaxyNode {
  /** Creation time in ms, when known. Drives the time slider and the freshness height mode. */
  created?: number;
}

const WORLD = 100; // the map is a WORLD x WORLD square centred on the origin
const GRID = 200; // height-field resolution
const HEIGHT = 15; // world units of relief at a normalised height of 1
const LABEL_LIMIT = 14;

const PALETTE = {
  dark: {
    low: '#0c1a17',
    mid: '#173a31',
    high: '#4a7a5c',
    peak: '#d9e8d5',
    line: '#2f5a4a',
    note: '#cfe0d4',
    shade: 0.5,
  },
  light: {
    low: '#e6ebe3',
    mid: '#cdddd0',
    high: '#93b39b',
    peak: '#fbfcf8',
    line: '#7e9a86',
    note: '#1d3a30',
    shade: 0.6,
  },
};

const TERRAIN_VERT = /* glsl */ `
  attribute float aH;
  uniform float uDisp;
  uniform float uHeight;
  varying float vH;
  varying vec3 vPos;
  void main() {
    vH = aH;
    vec3 p = position;
    p.y = aH * uHeight * uDisp;
    vPos = p;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const TERRAIN_FRAG = /* glsl */ `
  uniform vec3 uLow;
  uniform vec3 uMid;
  uniform vec3 uHigh;
  uniform vec3 uPeak;
  uniform vec3 uLine;
  uniform vec3 uAccent;
  uniform float uLevels;
  uniform float uShade;
  uniform float uHalf;
  varying float vH;
  varying vec3 vPos;

  float contour(float v) {
    float w = fwidth(v);
    float f = abs(fract(v - 0.5) - 0.5);
    float line = 1.0 - smoothstep(0.0, max(w * 1.2, 0.0001), f);
    // far or grazing slopes pack many levels into a pixel: fade instead of smearing
    return line * (1.0 - smoothstep(0.3, 0.6, w));
  }

  void main() {
    float h = clamp(vH, 0.0, 1.0);
    vec3 col = mix(uLow, uMid, smoothstep(0.0, 0.4, h));
    col = mix(col, uHigh, smoothstep(0.32, 0.78, h));
    col = mix(col, uPeak, smoothstep(0.74, 1.0, h));

    vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
    if (n.y < 0.0) n = -n;
    float shade = dot(n, normalize(vec3(-0.55, 0.75, 0.35)));
    col *= (1.0 - uShade * 0.5) + uShade * shade * 0.9;

    float ground = smoothstep(0.035, 0.09, h);
    float minor = contour(h * uLevels) * ground;
    float major = contour(h * uLevels / 4.0) * ground;
    col = mix(col, uLine, minor * 0.45);
    col = mix(col, mix(uLine, uPeak, 0.55), major * 0.8);

    float edge = 1.0 - smoothstep(uHalf - 14.0, uHalf - 1.0, max(abs(vPos.x), abs(vPos.z)));
    gl_FragColor = vec4(col, edge);
  }
`;

const POINT_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aState;
  attribute vec3 aColor;
  uniform float uDisp;
  uniform float uHeight;
  uniform float uPx;
  varying vec3 vColor;
  varying float vState;
  void main() {
    vColor = aColor;
    vState = aState;
    vec3 p = position;
    p.y = position.y * uHeight * uDisp + 0.35;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float boost = aState > 0.5 ? 1.7 : 1.0;
    gl_PointSize = clamp(aSize * boost * uPx / max(1.0, -mv.z), 2.0, 60.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const POINT_FRAG = /* glsl */ `
  uniform vec3 uAccent;
  varying vec3 vColor;
  varying float vState;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float ring = smoothstep(0.5, 0.38, d) * (1.0 - smoothstep(0.3, 0.2, d));
    float core = 1.0 - smoothstep(0.18, 0.26, d);
    vec3 col = vState > 0.5 ? uAccent : vColor;
    float a = vState < -0.5 ? 0.22 : 1.0;
    gl_FragColor = vec4(col, (max(ring, core)) * a);
  }
`;

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function isLight(): boolean {
  return document.documentElement.dataset.theme === 'light';
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface Fly {
  t0: number;
  dur: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
}

export class Terrain {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private labelLayer: HTMLDivElement;
  private ro: ResizeObserver;
  private mo: MutationObserver;
  private raf = 0;
  private disposed = false;

  private nodes: TerrainNode[] = [];
  private adj: number[][] = [];
  private index = new Map<string, number>();
  private px: Float32Array = new Float32Array(0);
  private pz: Float32Array = new Float32Array(0);
  private amp: Float32Array = new Float32Array(0);
  private sigma: Float32Array = new Float32Array(0);
  private visible: Uint8Array = new Uint8Array(0);
  private field = new Float32Array((GRID + 1) * (GRID + 1));
  private nodeH: Float32Array = new Float32Array(0);

  private mesh: THREE.Mesh | null = null;
  private points: THREE.Points | null = null;
  private flags = new THREE.Group();
  private trail: THREE.LineSegments | null = null;
  private beacon: THREE.Line | null = null;
  private terrainMat: THREE.ShaderMaterial;
  private pointMat: THREE.ShaderMaterial;

  private mode: HeightMode = 'importance';
  private time: number | null = null;
  private selected = -1;
  private hovered = -1;
  private searchHits: Set<number> | null = null;
  private dispTarget = 1;
  private disp = 1;
  private fly: Fly | null = null;
  private labelEls = new Map<number, HTMLDivElement>();
  private lastInteraction = performance.now();
  private pointer = { x: 0, y: 0, inside: false, down: false, moved: 0 };

  constructor(
    private host: HTMLElement,
    private handlers: GalaxyHandlers,
    private reduced: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';

    this.labelLayer = document.createElement('div');
    Object.assign(this.labelLayer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' });
    host.appendChild(this.labelLayer);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 600);
    this.camera.position.set(0, 58, 76);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minDistance = 14;
    this.controls.maxDistance = 190;
    this.controls.screenSpacePanning = false;
    this.controls.target.set(0, 0, 0);
    this.controls.addEventListener('start', () => {
      this.fly = null;
      this.lastInteraction = performance.now();
    });
    this.controls.addEventListener('change', () => (this.lastInteraction = performance.now()));

    this.terrainMat = new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERT,
      fragmentShader: TERRAIN_FRAG,
      transparent: true,
      uniforms: {
        uDisp: { value: 1 },
        uHeight: { value: HEIGHT },
        uLow: { value: new THREE.Color() },
        uMid: { value: new THREE.Color() },
        uHigh: { value: new THREE.Color() },
        uPeak: { value: new THREE.Color() },
        uLine: { value: new THREE.Color() },
        uAccent: { value: new THREE.Color() },
        uLevels: { value: 16 },
        uShade: { value: 0.5 },
        uHalf: { value: WORLD / 2 },
      },
    });
    this.pointMat = new THREE.ShaderMaterial({
      vertexShader: POINT_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uDisp: { value: 1 },
        uHeight: { value: HEIGHT },
        uPx: { value: 600 },
        uAccent: { value: new THREE.Color() },
      },
    });
    this.scene.add(this.flags);
    this.applyTheme();

    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerleave', this.onLeave);
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointerup', this.onUp);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.mo = new MutationObserver(() => this.applyTheme());
    this.mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    this.resize();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---------------------------------------------------------------- data

  setData(nodes: TerrainNode[], links: GalaxyLink[]) {
    this.nodes = nodes;
    this.index = new Map(nodes.map((n, i) => [n.id, i]));
    this.adj = nodes.map(() => []);
    const edges: [number, number][] = [];
    for (const l of links) {
      const a = this.index.get(l.source);
      const b = this.index.get(l.target);
      if (a === undefined || b === undefined || a === b) continue;
      this.adj[a].push(b);
      this.adj[b].push(a);
      edges.push([a, b]);
    }
    this.layout(edges);
    this.visible = new Uint8Array(nodes.length).fill(1);
    this.selected = -1;
    this.hovered = -1;
    this.searchHits = null;
    this.buildMesh();
    this.rebuildMarkers();
    this.recompute();
    this.resetView();
  }

  setMode(mode: HeightMode) {
    this.mode = mode;
    this.recompute();
  }

  /** Show only notes created on or before `ms`; null shows everything. */
  setTime(ms: number | null) {
    this.time = ms;
    this.recompute();
  }

  timeRange(): { min: number; max: number } | null {
    const t = this.nodes.map((n) => n.created).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (t.length < 2) return null;
    return { min: Math.min(...t), max: Math.max(...t) };
  }

  /** Flatten to a top-down contour map (also the reduced-motion presentation). */
  setFlat(flat: boolean) {
    this.dispTarget = flat ? 0 : 1;
    this.controls.enableRotate = !flat;
    this.controls.maxPolarAngle = flat ? 0.0001 : Math.PI * 0.47;
    if (flat) {
      this.startFly(new THREE.Vector3(0, 125, 0.01), new THREE.Vector3(0, 0, 0));
    } else {
      this.resetView();
    }
    if (this.reduced) this.disp = this.dispTarget;
  }

  select(id: string | null, fly = true) {
    const i = id ? (this.index.get(id) ?? -1) : -1;
    this.selected = i;
    this.refreshStates();
    if (i >= 0 && fly) this.flyTo(i);
  }

  neighborsOf(id: string): string[] {
    const i = this.index.get(id);
    return i === undefined ? [] : this.adj[i].map((j) => this.nodes[j].id);
  }

  search(query: string): string[] {
    const q = query.trim().toLowerCase();
    if (!q) {
      this.searchHits = null;
    } else {
      this.searchHits = new Set();
      this.nodes.forEach((n, i) => {
        if (this.visible[i] && n.label.toLowerCase().includes(q)) this.searchHits!.add(i);
      });
    }
    this.refreshStates();
    return this.searchHits ? [...this.searchHits].map((i) => this.nodes[i].id) : [];
  }

  resetView() {
    this.selected = -1;
    this.searchHits = null;
    this.refreshStates();
    if (this.dispTarget === 0) {
      this.startFly(new THREE.Vector3(0, 125, 0.01), new THREE.Vector3(0, 0, 0));
    } else {
      this.startFly(new THREE.Vector3(0, 58, 76), new THREE.Vector3(0, 2, 0));
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.mo.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerleave', this.onLeave);
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointerup', this.onUp);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
    });
    this.terrainMat.dispose();
    this.pointMat.dispose();
    this.renderer.dispose();
    el.remove();
    this.labelLayer.remove();
  }

  // ---------------------------------------------------------------- layout

  /** Cluster by group on a spiral, then relax links so connected notes share a hillside. */
  private layout(edges: [number, number][]) {
    const n = this.nodes.length;
    this.px = new Float32Array(n);
    this.pz = new Float32Array(n);
    const groups = [...new Set(this.nodes.map((d) => d.group))];
    const gIndex = new Map(groups.map((g, i) => [g, i]));
    const GOLDEN = 2.399963229728653;
    const spread = 30;
    this.nodes.forEach((node, i) => {
      const gi = gIndex.get(node.group) ?? 0;
      const r = spread * Math.sqrt((gi + 0.5) / Math.max(1, groups.length));
      const a = gi * GOLDEN;
      const rand = rng(strHash(node.id));
      const jr = 8 + rand() * 8;
      const ja = rand() * Math.PI * 2;
      this.px[i] = Math.cos(a) * r + Math.cos(ja) * jr;
      this.pz[i] = Math.sin(a) * r + Math.sin(ja) * jr;
    });

    const cell = 6;
    for (let iter = 0; iter < 70; iter++) {
      const fx = new Float32Array(n);
      const fz = new Float32Array(n);
      for (const [a, b] of edges) {
        const dx = this.px[b] - this.px[a];
        const dz = this.pz[b] - this.pz[a];
        const d = Math.hypot(dx, dz) || 0.01;
        const k = (d - 5) * 0.02;
        fx[a] += (dx / d) * k;
        fz[a] += (dz / d) * k;
        fx[b] -= (dx / d) * k;
        fz[b] -= (dz / d) * k;
      }
      const grid = new Map<number, number[]>();
      for (let i = 0; i < n; i++) {
        const key = Math.floor(this.px[i] / cell) * 4096 + Math.floor(this.pz[i] / cell);
        const list = grid.get(key);
        if (list) list.push(i);
        else grid.set(key, [i]);
      }
      for (let i = 0; i < n; i++) {
        const cx = Math.floor(this.px[i] / cell);
        const cz = Math.floor(this.pz[i] / cell);
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          for (let gz = cz - 1; gz <= cz + 1; gz++) {
            const list = grid.get(gx * 4096 + gz);
            if (!list) continue;
            for (const j of list) {
              if (j <= i) continue;
              const dx = this.px[j] - this.px[i];
              const dz = this.pz[j] - this.pz[i];
              const d2 = dx * dx + dz * dz + 0.01;
              if (d2 > cell * cell) continue;
              const d = Math.sqrt(d2);
              const k = (1.4 / d2) * 0.5;
              fx[i] -= (dx / d) * k;
              fz[i] -= (dz / d) * k;
              fx[j] += (dx / d) * k;
              fz[j] += (dz / d) * k;
            }
          }
        }
        // a gentle pull to the middle keeps the map on the sheet
        fx[i] -= this.px[i] * 0.0008;
        fz[i] -= this.pz[i] * 0.0008;
      }
      for (let i = 0; i < n; i++) {
        const m = Math.hypot(fx[i], fz[i]);
        const cap = 1.6;
        const s = m > cap ? cap / m : 1;
        this.px[i] += fx[i] * s;
        this.pz[i] += fz[i] * s;
      }
    }

    // fit into the sheet
    let maxR = 1;
    for (let i = 0; i < n; i++) maxR = Math.max(maxR, Math.abs(this.px[i]), Math.abs(this.pz[i]));
    const scale = 40 / maxR;
    for (let i = 0; i < n; i++) {
      this.px[i] *= scale;
      this.pz[i] *= scale;
    }
  }

  // ---------------------------------------------------------------- build

  private buildMesh() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    const geo = new THREE.PlaneGeometry(WORLD, WORLD, GRID, GRID);
    geo.rotateX(-Math.PI / 2);
    geo.setAttribute('aH', new THREE.BufferAttribute(new Float32Array((GRID + 1) * (GRID + 1)), 1));
    this.mesh = new THREE.Mesh(geo, this.terrainMat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  private rebuildMarkers() {
    if (this.points) {
      this.scene.remove(this.points);
      this.points.geometry.dispose();
      this.points = null;
    }
    const n = this.nodes.length;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
    geo.setAttribute('aState', new THREE.BufferAttribute(new Float32Array(n), 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.points = new THREE.Points(geo, this.pointMat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.applyNodeColors();

    for (const child of [...this.flags.children]) {
      this.flags.remove(child);
      (child as THREE.Mesh).geometry?.dispose?.();
    }
    this.nodes.forEach((node, i) => {
      if (node.kind !== 'project') return;
      const color = new THREE.Color(node.color);
      const group = new THREE.Group();
      group.userData.node = i;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(cssVar('--os-text', '#e8efe9')) }));
      pole.position.y = 2.5;
      const flag = new THREE.Mesh(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(2.6, -0.7, 0), new THREE.Vector3(0, -1.5, 0)]),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
      );
      flag.position.y = 5;
      group.add(pole, flag);
      this.flags.add(group);
    });
  }

  private applyNodeColors() {
    if (!this.points) return;
    const note = new THREE.Color(PALETTE[isLight() ? 'light' : 'dark'].note);
    const col = this.points.geometry.getAttribute('aColor') as THREE.BufferAttribute;
    const size = this.points.geometry.getAttribute('aSize') as THREE.BufferAttribute;
    this.nodes.forEach((node, i) => {
      const c = node.kind === 'project' ? new THREE.Color(node.color) : note;
      col.setXYZ(i, c.r, c.g, c.b);
      size.setX(i, node.kind === 'project' ? 2.4 : 0.55 + Math.min(0.9, Math.sqrt(node.degree ?? 0) * 0.14));
    });
    col.needsUpdate = true;
    size.needsUpdate = true;
  }

  private applyTheme() {
    const p = PALETTE[isLight() ? 'light' : 'dark'];
    const u = this.terrainMat.uniforms;
    u.uLow.value.set(p.low);
    u.uMid.value.set(p.mid);
    u.uHigh.value.set(p.high);
    u.uPeak.value.set(p.peak);
    u.uLine.value.set(p.line);
    u.uAccent.value.set(cssVar('--os-cyan', '#ff6a3d'));
    u.uShade.value = p.shade;
    this.pointMat.uniforms.uAccent.value.set(cssVar('--os-cyan', '#ff6a3d'));
    this.applyNodeColors();
    const text = new THREE.Color(cssVar('--os-text', '#e8efe9'));
    this.flags.children.forEach((g) => ((g.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.copy(text));
  }

  // ---------------------------------------------------------------- field

  private weight(i: number): number {
    const n = this.nodes[i];
    if (this.mode === 'freshness') {
      const r = this.timeRange();
      if (r && n.created !== undefined) return 0.15 + 0.85 * ((n.created - r.min) / Math.max(1, r.max - r.min)) ** 1.4;
      return 0.3;
    }
    if (this.mode === 'size') return Math.min(1, 0.12 + (n.size - 1.5) / 9);
    return Math.min(1, 0.14 + Math.sqrt(n.degree ?? 0) * 0.17);
  }

  private recompute() {
    const n = this.nodes.length;
    this.amp = new Float32Array(n);
    this.sigma = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const node = this.nodes[i];
      const shown = this.time === null || node.created === undefined || node.created <= this.time;
      this.visible[i] = shown ? 1 : 0;
      const w = this.weight(i);
      this.amp[i] = shown ? w * (node.kind === 'project' ? 1.25 : 0.62) : 0;
      this.sigma[i] = 1.5 + w * 1.8 + (node.kind === 'project' ? 1.2 : 0);
    }
    this.field.fill(0);
    const cellSize = WORLD / GRID;
    const stride = GRID + 1;
    for (let i = 0; i < n; i++) {
      if (!this.amp[i]) continue;
      const s = this.sigma[i];
      const cx = (this.px[i] + WORLD / 2) / cellSize;
      const cz = (this.pz[i] + WORLD / 2) / cellSize;
      const rad = Math.ceil((s * 3) / cellSize);
      const inv = 1 / (2 * s * s);
      for (let z = Math.max(0, Math.floor(cz - rad)); z <= Math.min(GRID, Math.ceil(cz + rad)); z++) {
        const dz = (z - cz) * cellSize;
        for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(GRID, Math.ceil(cx + rad)); x++) {
          const dx = (x - cx) * cellSize;
          this.field[z * stride + x] += this.amp[i] * Math.exp(-(dx * dx + dz * dz) * inv);
        }
      }
    }
    const attr = this.mesh?.geometry.getAttribute('aH') as THREE.BufferAttribute | undefined;
    if (attr) {
      const arr = attr.array as Float32Array;
      for (let z = 0; z <= GRID; z++) {
        for (let x = 0; x <= GRID; x++) {
          const wx = x * cellSize - WORLD / 2;
          const wz = z * cellSize - WORLD / 2;
          // faint rolling ground so empty areas are not a flat plate
          const base = 0.03 + 0.016 * (Math.sin(wx * 0.11 + 0.7) + Math.sin(wz * 0.09 + 2.1) + Math.sin((wx + wz) * 0.05));
          arr[z * stride + x] = 1 - Math.exp(-1.35 * (this.field[z * stride + x] + Math.max(0, base)));
        }
      }
      attr.needsUpdate = true;
    }
    this.nodeH = new Float32Array(n);
    const pos = this.points?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    for (let i = 0; i < n; i++) {
      const gx = Math.round((this.px[i] + WORLD / 2) / cellSize);
      const gz = Math.round((this.pz[i] + WORLD / 2) / cellSize);
      const h = attr ? (attr.array as Float32Array)[Math.min(GRID, gz) * stride + Math.min(GRID, gx)] : 0;
      this.nodeH[i] = h;
      pos?.setXYZ(i, this.px[i], h, this.pz[i]);
    }
    if (pos) pos.needsUpdate = true;
    this.flags.children.forEach((g) => {
      const i = g.userData.node as number;
      g.visible = !!this.visible[i];
    });
    this.refreshStates();
  }

  private refreshStates() {
    if (!this.points) return;
    const st = this.points.geometry.getAttribute('aState') as THREE.BufferAttribute;
    const focus = new Set<number>();
    if (this.selected >= 0) {
      focus.add(this.selected);
      this.adj[this.selected].forEach((j) => focus.add(j));
    }
    for (let i = 0; i < this.nodes.length; i++) {
      let s = 0;
      if (!this.visible[i]) s = -2;
      else if (this.searchHits) s = this.searchHits.has(i) ? 1 : -1;
      else if (this.selected >= 0) s = i === this.selected ? 1 : focus.has(i) ? 0 : -1;
      st.setX(i, s < -1 ? -1 : s);
    }
    st.needsUpdate = true;
    this.drawTrail();
  }

  /** Ridgelines: paths along the surface from the selected peak to the notes it links to. */
  private drawTrail() {
    if (this.trail) {
      this.scene.remove(this.trail);
      this.trail.geometry.dispose();
      this.trail = null;
    }
    if (this.beacon) {
      this.scene.remove(this.beacon);
      this.beacon.geometry.dispose();
      this.beacon = null;
    }
    const s = this.selected;
    if (s < 0 || !this.mesh) return;
    const attr = (this.mesh.geometry.getAttribute('aH') as THREE.BufferAttribute).array as Float32Array;
    const cellSize = WORLD / GRID;
    const stride = GRID + 1;
    const sample = (x: number, z: number) => {
      const gx = Math.min(GRID, Math.max(0, Math.round((x + WORLD / 2) / cellSize)));
      const gz = Math.min(GRID, Math.max(0, Math.round((z + WORLD / 2) / cellSize)));
      return attr[gz * stride + gx];
    };
    const pts: number[] = [];
    const steps = 28;
    for (const j of this.adj[s].slice(0, 40)) {
      if (!this.visible[j]) continue;
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps;
        const t1 = (k + 1) / steps;
        for (const t of [t0, t1]) {
          const x = this.px[s] + (this.px[j] - this.px[s]) * t;
          const z = this.pz[s] + (this.pz[j] - this.pz[s]) * t;
          pts.push(x, sample(x, z), z);
        }
      }
    }
    if (pts.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
      this.trail = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(cssVar('--os-cyan', '#ff6a3d')), transparent: true, opacity: 0.85 }));
      this.trail.frustumCulled = false;
      this.scene.add(this.trail);
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([this.px[s], this.nodeH[s], this.pz[s], this.px[s], this.nodeH[s] + 0.5, this.pz[s]]), 3));
    this.beacon = new THREE.Line(bg, new THREE.LineBasicMaterial({ color: new THREE.Color(cssVar('--os-cyan', '#ff6a3d')) }));
    this.beacon.frustumCulled = false;
    this.scene.add(this.beacon);
  }

  /** The beacon is stored in world units, so re-seat it whenever the relief is flattened or restored. */
  private syncBeacon() {
    const s = this.selected;
    if (!this.beacon || s < 0) return;
    const arr = this.beacon.geometry.getAttribute('position') as THREE.BufferAttribute;
    const y = this.nodeH[s] * HEIGHT * this.disp;
    arr.setXYZ(0, this.px[s], y, this.pz[s]);
    arr.setXYZ(1, this.px[s], y + 9, this.pz[s]);
    arr.needsUpdate = true;
  }

  // ---------------------------------------------------------------- camera

  private worldY(i: number): number {
    return this.nodeH[i] * HEIGHT * this.disp;
  }

  private flyTo(i: number) {
    const target = new THREE.Vector3(this.px[i], this.worldY(i), this.pz[i]);
    const flat = this.dispTarget === 0;
    const offset = flat ? new THREE.Vector3(0, 55, 0.01) : new THREE.Vector3(0, 26, 34);
    this.startFly(target.clone().add(offset), target);
  }

  private startFly(toPos: THREE.Vector3, toTarget: THREE.Vector3) {
    if (this.reduced) {
      this.camera.position.copy(toPos);
      this.controls.target.copy(toTarget);
      this.controls.update();
      return;
    }
    this.fly = {
      t0: performance.now(),
      dur: 1100,
      fromPos: this.camera.position.clone(),
      toPos,
      fromTarget: this.controls.target.clone(),
      toTarget,
    };
  }

  // ---------------------------------------------------------------- input

  private screenOf(i: number, out: THREE.Vector3): THREE.Vector3 {
    out.set(this.px[i], this.worldY(i) + 0.35, this.pz[i]).project(this.camera);
    return out;
  }

  private pick(clientX: number, clientY: number): number {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const v = new THREE.Vector3();
    let best = -1;
    let bestD = 18;
    for (let i = 0; i < this.nodes.length; i++) {
      if (!this.visible[i]) continue;
      this.screenOf(i, v);
      if (v.z > 1) continue;
      const sx = (v.x * 0.5 + 0.5) * rect.width;
      const sy = (-v.y * 0.5 + 0.5) * rect.height;
      const d = Math.hypot(sx - mx, sy - my);
      const bias = this.nodes[i].kind === 'project' ? 8 : 0;
      if (d - bias < bestD) {
        bestD = d - bias;
        best = i;
      }
    }
    return best;
  }

  private onMove = (e: PointerEvent) => {
    this.pointer.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
    if (this.pointer.down) return;
    const i = this.pick(e.clientX, e.clientY);
    if (i !== this.hovered) {
      this.hovered = i;
      this.renderer.domElement.style.cursor = i >= 0 ? 'pointer' : 'grab';
      this.handlers.onHover(i >= 0 ? this.nodes[i].id : null);
    }
  };

  private onLeave = () => {
    this.hovered = -1;
    this.handlers.onHover(null);
  };

  private onDown = () => {
    this.pointer.down = true;
    this.pointer.moved = 0;
  };

  private onUp = (e: PointerEvent) => {
    const wasDrag = this.pointer.moved > 6;
    this.pointer.down = false;
    if (wasDrag) return;
    const i = this.pick(e.clientX, e.clientY);
    this.selected = i;
    this.refreshStates();
    this.handlers.onSelect(i >= 0 ? this.nodes[i].id : null);
    if (i >= 0) this.flyTo(i);
  };

  // ---------------------------------------------------------------- frame

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.pointMat.uniforms.uPx.value = (h / (2 * Math.tan((this.camera.fov * Math.PI) / 360))) * this.renderer.getPixelRatio();
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);

    if (this.disp !== this.dispTarget) {
      this.disp += (this.dispTarget - this.disp) * 0.12;
      if (Math.abs(this.disp - this.dispTarget) < 0.002) this.disp = this.dispTarget;
      this.terrainMat.uniforms.uDisp.value = this.disp;
      this.pointMat.uniforms.uDisp.value = this.disp;
      this.flags.children.forEach((g) => {
        const i = g.userData.node as number;
        g.position.set(this.px[i], this.worldY(i), this.pz[i]);
        g.scale.setScalar(Math.max(0.001, this.disp));
      });
    } else if (this.flags.children.length && !this.flagsPlaced) {
      this.placeFlags();
    }

    if (this.fly) {
      const t = Math.min(1, (now - this.fly.t0) / this.fly.dur);
      const e = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(this.fly.fromPos, this.fly.toPos, e);
      this.controls.target.lerpVectors(this.fly.fromTarget, this.fly.toTarget, e);
      if (t >= 1) this.fly = null;
    } else if (!this.reduced && this.dispTarget === 1 && now - this.lastInteraction > 9000 && this.selected < 0) {
      // slow survey drift while nobody is touching the map
      const a = 0.00012 * 16;
      const dx = this.camera.position.x - this.controls.target.x;
      const dz = this.camera.position.z - this.controls.target.z;
      this.camera.position.x = this.controls.target.x + dx * Math.cos(a) - dz * Math.sin(a);
      this.camera.position.z = this.controls.target.z + dx * Math.sin(a) + dz * Math.cos(a);
    }
    this.controls.update();

    this.syncBeacon();
    if (this.trail) this.trail.scale.y = HEIGHT * this.disp;

    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  };

  private flagsPlaced = false;
  private placeFlags() {
    this.flags.children.forEach((g) => {
      const i = g.userData.node as number;
      g.position.set(this.px[i], this.worldY(i), this.pz[i]);
      g.scale.setScalar(Math.max(0.001, this.disp));
    });
    this.flagsPlaced = true;
  }

  private updateLabels() {
    const want: number[] = [];
    const seen = new Set<number>();
    const add = (i: number) => {
      if (i >= 0 && !seen.has(i) && this.visible[i]) {
        seen.add(i);
        want.push(i);
      }
    };
    add(this.selected);
    add(this.hovered);
    this.nodes.forEach((n, i) => n.kind === 'project' && add(i));
    if (this.searchHits) [...this.searchHits].slice(0, 8).forEach(add);
    else {
      const ranked = this.nodes
        .map((_, i) => i)
        .filter((i) => this.visible[i] && this.nodes[i].kind !== 'project')
        .sort((a, b) => this.amp[b] - this.amp[a])
        .slice(0, LABEL_LIMIT);
      ranked.forEach(add);
    }

    const rect = this.host.getBoundingClientRect();
    const v = new THREE.Vector3();
    const placed: [number, number][] = [];
    const live = new Set<number>();
    for (const i of want) {
      this.screenOf(i, v);
      if (v.z > 1) continue;
      const x = (v.x * 0.5 + 0.5) * rect.width;
      const y = (-v.y * 0.5 + 0.5) * rect.height;
      const priority = i === this.selected || i === this.hovered || this.nodes[i].kind === 'project';
      if (!priority && placed.some(([px, py]) => Math.abs(px - x) < 120 && Math.abs(py - y) < 20)) continue;
      placed.push([x, y]);
      live.add(i);
      let el = this.labelEls.get(i);
      if (!el) {
        el = document.createElement('div');
        el.textContent = this.nodes[i].label;
        Object.assign(el.style, {
          position: 'absolute',
          left: '0',
          top: '0',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--os-font-sans)',
          fontSize: '12px',
          fontWeight: '600',
          color: 'var(--os-text)',
          textShadow: '0 0 6px var(--os-bg), 0 0 2px var(--os-bg)',
          maxWidth: '220px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        });
        this.labelLayer.appendChild(el);
        this.labelEls.set(i, el);
      }
      const big = priority;
      el.style.opacity = big ? '1' : '0.78';
      el.style.fontSize = this.nodes[i].kind === 'project' ? '13px' : '12px';
      el.style.transform = `translate(${Math.round(x + 9)}px, ${Math.round(y - 20)}px)`;
      el.style.display = 'block';
    }
    for (const [i, el] of this.labelEls) {
      if (!live.has(i)) {
        el.remove();
        this.labelEls.delete(i);
      }
    }
  }
}
