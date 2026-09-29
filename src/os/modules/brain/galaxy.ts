import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface GalaxyNode {
  id: string;
  label: string;
  color: string;
  size: number;
  /** Nodes in the same group are pulled toward one cluster centre on the spiral. */
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

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aState;
  attribute vec3 aColor;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    // state: -1 dimmed, 0 normal, 1 highlighted
    vAlpha = aState < -0.5 ? 0.16 : (aState > 0.5 ? 1.0 : 0.82);
    float boost = aState > 0.5 ? 1.55 : 1.0;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * boost * uScale / max(1.0, -mv.z), 1.5, 90.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    // Bright core with a soft halo: reads as a star rather than a flat disc.
    float core = smoothstep(0.5, 0.05, d);
    float halo = smoothstep(0.5, 0.0, d) * 0.5;
    gl_FragColor = vec4(vColor * (0.55 + core * 0.9), (core + halo) * vAlpha);
  }
`;

const GOLDEN = 2.399963229728653;

export class Galaxy {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private labelLayer: HTMLDivElement;
  private raf = 0;
  private ro: ResizeObserver;

  private nodes: GalaxyNode[] = [];
  private links: GalaxyLink[] = [];
  private index = new Map<string, number>();
  private adj: number[][] = [];
  private pos = new Float32Array(0);
  private vel = new Float32Array(0);
  private center = new Float32Array(0);
  private groupOf: number[] = [];
  private linkIdx = new Uint32Array(0);

  private points: THREE.Points | null = null;
  private lines: THREE.LineSegments | null = null;
  private dust: THREE.Points | null = null;
  private pointAttr: { pos: THREE.BufferAttribute; state: THREE.BufferAttribute } | null = null;
  private lineColor: THREE.BufferAttribute | null = null;
  private baseColors = new Float32Array(0);

  private alpha = 0;
  private selected = -1;
  private hovered = -1;
  private searchHits: Set<number> | null = null;
  private labelEls = new Map<number, HTMLDivElement>();
  private hubs: number[] = [];

  private fly: { from: THREE.Vector3; to: THREE.Vector3; camFrom: THREE.Vector3; camTo: THREE.Vector3; t0: number } | null = null;
  private lastInteraction = 0;
  private pointerDown: { x: number; y: number } | null = null;
  private pendingMove: { x: number; y: number } | null = null;

  constructor(
    private container: HTMLElement,
    private handlers: GalaxyHandlers,
    private reducedMotion: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.labelLayer = document.createElement('div');
    Object.assign(this.labelLayer.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' });
    container.appendChild(this.labelLayer);

    this.camera = new THREE.PerspectiveCamera(55, 1, 1, 4000);
    this.camera.position.set(0, 160, 300);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 1400;
    this.controls.autoRotate = !reducedMotion;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.addEventListener('start', () => {
      this.lastInteraction = performance.now();
      this.controls.autoRotate = false;
      this.fly = null;
    });
    this.controls.addEventListener('end', () => {
      this.lastInteraction = performance.now();
    });

    this.buildDust();

    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointerleave', this.onLeave);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---- data ------------------------------------------------------------------------------------

  setData(nodes: GalaxyNode[], links: GalaxyLink[]) {
    this.clearObjects();
    this.nodes = nodes;
    this.index = new Map(nodes.map((n, i) => [n.id, i]));
    const valid = links.filter((l) => this.index.has(l.source) && this.index.has(l.target) && l.source !== l.target);
    this.links = valid;
    this.linkIdx = new Uint32Array(valid.length * 2);
    this.adj = nodes.map(() => []);
    valid.forEach((l, k) => {
      const a = this.index.get(l.source)!;
      const b = this.index.get(l.target)!;
      this.linkIdx[k * 2] = a;
      this.linkIdx[k * 2 + 1] = b;
      this.adj[a].push(b);
      this.adj[b].push(a);
    });

    // Cluster centres laid out on a golden-angle spiral: the galaxy arms.
    const groups = [...new Set(nodes.map((n) => n.group))];
    const gIndex = new Map(groups.map((g, i) => [g, i]));
    this.groupOf = nodes.map((n) => gIndex.get(n.group)!);
    this.center = new Float32Array(groups.length * 3);
    groups.forEach((_, i) => {
      const r = 46 * Math.sqrt(i + 0.6);
      const a = i * GOLDEN;
      this.center[i * 3] = Math.cos(a) * r;
      this.center[i * 3 + 1] = (Math.random() - 0.5) * 14;
      this.center[i * 3 + 2] = Math.sin(a) * r;
    });

    const n = nodes.length;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const g = this.groupOf[i];
      this.pos[i * 3] = this.center[g * 3] + gauss() * 22;
      this.pos[i * 3 + 1] = this.center[g * 3 + 1] + gauss() * 8;
      this.pos[i * 3 + 2] = this.center[g * 3 + 2] + gauss() * 22;
    }

    this.buildObjects();
    this.hubs = this.pickHubs();
    this.alpha = 1;
    this.selected = -1;
    this.hovered = -1;
    this.searchHits = null;
    this.applyStates();

    // Frame the whole galaxy.
    const radius = 46 * Math.sqrt(groups.length + 1) + 60;
    this.camera.position.set(0, radius * 0.55, radius * 1.05);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private buildObjects() {
    const n = this.nodes.length;

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.pos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const size = new Float32Array(n);
    const state = new Float32Array(n);
    this.baseColors = new Float32Array(n * 3);
    const color = new THREE.Color();
    this.nodes.forEach((nd, i) => {
      size[i] = nd.size;
      color.set(nd.color);
      this.baseColors[i * 3] = color.r;
      this.baseColors[i * 3 + 1] = color.g;
      this.baseColors[i * 3 + 2] = color.b;
    });
    const stateAttr = new THREE.BufferAttribute(state, 1);
    stateAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aState', stateAttr);
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.baseColors, 3));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: 500 } },
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.pointAttr = { pos: posAttr, state: stateAttr };

    const lg = new THREE.BufferGeometry();
    const lpos = new Float32Array(this.links.length * 6);
    const lcol = new Float32Array(this.links.length * 6);
    const lposAttr = new THREE.BufferAttribute(lpos, 3);
    lposAttr.setUsage(THREE.DynamicDrawUsage);
    this.lineColor = new THREE.BufferAttribute(lcol, 3);
    this.lineColor.setUsage(THREE.DynamicDrawUsage);
    lg.setAttribute('position', lposAttr);
    lg.setAttribute('color', this.lineColor);
    this.lines = new THREE.LineSegments(
      lg,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
  }

  private clearObjects() {
    for (const o of [this.points, this.lines]) {
      if (!o) continue;
      this.scene.remove(o);
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
    this.points = null;
    this.lines = null;
    this.pointAttr = null;
    this.lineColor = null;
    this.labelEls.forEach((el) => el.remove());
    this.labelEls.clear();
  }

  private buildDust() {
    const count = 700;
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 700 + Math.random() * 1400;
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      p[i * 3] = r * s * Math.cos(a);
      p[i * 3 + 1] = r * u;
      p[i * 3 + 2] = r * s * Math.sin(a);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8a93a3, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.35, depthWrite: false }));
    this.scene.add(this.dust);
  }

  private pickHubs(): number[] {
    const order = this.nodes.map((_, i) => i).sort((a, b) => this.adj[b].length - this.adj[a].length);
    return order.slice(0, 9);
  }

  // ---- public API -----------------------------------------------------------------------------

  select(id: string | null, fly = true) {
    const i = id ? (this.index.get(id) ?? -1) : -1;
    this.selected = i;
    this.applyStates();
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
        if (n.label.toLowerCase().includes(q)) this.searchHits!.add(i);
      });
    }
    this.applyStates();
    return this.searchHits ? [...this.searchHits].map((i) => this.nodes[i].id) : [];
  }

  resetView() {
    this.select(null, false);
    this.searchHits = null;
    this.applyStates();
    const groups = new Set(this.groupOf).size;
    const radius = 46 * Math.sqrt(groups + 1) + 60;
    this.startFly(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, radius * 0.55, radius * 1.05));
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointerleave', this.onLeave);
    this.controls.dispose();
    this.clearObjects();
    if (this.dust) {
      this.dust.geometry.dispose();
      (this.dust.material as THREE.Material).dispose();
    }
    this.renderer.dispose();
    el.remove();
    this.labelLayer.remove();
  }

  // ---- state / highlighting ------------------------------------------------------------------

  private applyStates() {
    if (!this.pointAttr || !this.lineColor) return;
    const n = this.nodes.length;
    const state = this.pointAttr.state.array as Float32Array;
    const focus = this.selected >= 0 ? this.selected : this.hovered;
    const near = new Set<number>();
    if (focus >= 0) {
      near.add(focus);
      this.adj[focus].forEach((j) => near.add(j));
    }
    for (let i = 0; i < n; i++) {
      if (this.searchHits) state[i] = this.searchHits.has(i) ? 1 : -1;
      else if (focus >= 0) state[i] = near.has(i) ? 1 : -1;
      else state[i] = 0;
    }
    this.pointAttr.state.needsUpdate = true;

    // Link brightness: bright when both ends are lit, faint otherwise (additive blending, so scale the colour).
    const col = this.lineColor.array as Float32Array;
    for (let k = 0; k < this.links.length; k++) {
      const a = this.linkIdx[k * 2];
      const b = this.linkIdx[k * 2 + 1];
      // Dense graphs get fainter links so thousands of edges do not merge into a white haze.
      const base = Math.max(0.07, Math.min(0.22, 330 / Math.max(1, this.links.length)));
      let f = base;
      if (this.searchHits) f = this.searchHits.has(a) && this.searchHits.has(b) ? 0.6 : 0.04;
      else if (focus >= 0) f = a === focus || b === focus ? 0.85 : 0.04;
      for (let e = 0; e < 2; e++) {
        const i = e === 0 ? a : b;
        col[k * 6 + e * 3] = this.baseColors[i * 3] * f;
        col[k * 6 + e * 3 + 1] = this.baseColors[i * 3 + 1] * f;
        col[k * 6 + e * 3 + 2] = this.baseColors[i * 3 + 2] * f;
      }
    }
    this.lineColor.needsUpdate = true;
  }

  // ---- camera --------------------------------------------------------------------------------

  private flyTo(i: number) {
    const p = new THREE.Vector3(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const dist = Math.max(45, Math.min(120, this.camera.position.distanceTo(this.controls.target) * 0.5));
    this.startFly(p, p.clone().add(dir.multiplyScalar(dist)));
  }

  private startFly(target: THREE.Vector3, camTo: THREE.Vector3) {
    this.controls.autoRotate = false;
    this.fly = { from: this.controls.target.clone(), to: target, camFrom: this.camera.position.clone(), camTo, t0: performance.now() };
    if (this.reducedMotion) {
      this.controls.target.copy(target);
      this.camera.position.copy(camTo);
      this.fly = null;
    }
  }

  // ---- pointer -------------------------------------------------------------------------------

  private nearest(x: number, y: number): number {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector3();
    let best = -1;
    let bestD = 14 * 14;
    for (let i = 0; i < this.nodes.length; i++) {
      v.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]).project(this.camera);
      if (v.z > 1 || v.z < -1) continue;
      const sx = (v.x * 0.5 + 0.5) * rect.width;
      const sy = (-v.y * 0.5 + 0.5) * rect.height;
      const dx = sx - x;
      const dy = sy - y;
      // Bigger nodes are easier to hit.
      const d = (dx * dx + dy * dy) / Math.max(0.6, this.nodes[i].size / 3);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  private onMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pendingMove = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  private onDown = (e: PointerEvent) => {
    this.pointerDown = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent) => {
    const d = this.pointerDown;
    this.pointerDown = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return; // a drag, not a click
    const rect = this.renderer.domElement.getBoundingClientRect();
    const i = this.nearest(e.clientX - rect.left, e.clientY - rect.top);
    this.selected = i;
    this.applyStates();
    this.handlers.onSelect(i >= 0 ? this.nodes[i].id : null);
    if (i >= 0) this.flyTo(i);
  };

  private onLeave = () => {
    this.pendingMove = null;
    if (this.hovered !== -1) {
      this.hovered = -1;
      this.applyStates();
      this.handlers.onHover(null);
    }
  };

  // ---- frame loop ----------------------------------------------------------------------------

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const mat = this.points?.material as THREE.ShaderMaterial | undefined;
    if (mat) mat.uniforms.uScale.value = h * 0.62 * this.renderer.getPixelRatio();
  }

  private loop() {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();

    if (this.pendingMove) {
      const { x, y } = this.pendingMove;
      this.pendingMove = null;
      if (!this.pointerDown) {
        const i = this.nearest(x, y);
        if (i !== this.hovered) {
          this.hovered = i;
          this.renderer.domElement.style.cursor = i >= 0 ? 'pointer' : 'grab';
          if (this.selected < 0) this.applyStates();
          this.handlers.onHover(i >= 0 ? this.nodes[i].id : null);
        }
      }
    }

    if (this.alpha > 0.015 && this.nodes.length) {
      // Two layout steps per frame while forming: the galaxy visibly condenses, then settles.
      this.stepLayout();
      this.stepLayout();
      this.writePositions();
    }

    if (this.fly) {
      const t = Math.min(1, (now - this.fly.t0) / 700);
      const k = 1 - Math.pow(1 - t, 3);
      this.controls.target.lerpVectors(this.fly.from, this.fly.to, k);
      this.camera.position.lerpVectors(this.fly.camFrom, this.fly.camTo, k);
      if (t >= 1) this.fly = null;
    } else if (!this.reducedMotion && !this.controls.autoRotate && now - this.lastInteraction > 8000 && this.selected < 0) {
      this.controls.autoRotate = true;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  }

  private stepLayout() {
    const n = this.nodes.length;
    const R = 20;
    const cell = R;
    const grid = new Map<number, number[]>();
    const key = (x: number, y: number, z: number) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
    for (let i = 0; i < n; i++) {
      const k = key(Math.floor(this.pos[i * 3] / cell), Math.floor(this.pos[i * 3 + 1] / cell), Math.floor(this.pos[i * 3 + 2] / cell));
      const arr = grid.get(k);
      if (arr) arr.push(i);
      else grid.set(k, [i]);
    }

    const f = new Float32Array(n * 3);
    // Short-range repulsion through the spatial hash keeps this near-linear.
    for (let i = 0; i < n; i++) {
      const px = this.pos[i * 3];
      const py = this.pos[i * 3 + 1];
      const pz = this.pos[i * 3 + 2];
      const cx = Math.floor(px / cell);
      const cy = Math.floor(py / cell);
      const cz = Math.floor(pz / cell);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            const bucket = grid.get(key(cx + dx, cy + dy, cz + dz));
            if (!bucket) continue;
            for (const j of bucket) {
              if (j <= i) continue;
              const ex = px - this.pos[j * 3];
              const ey = py - this.pos[j * 3 + 1];
              const ez = pz - this.pos[j * 3 + 2];
              const d2 = ex * ex + ey * ey + ez * ez;
              if (d2 >= R * R) continue;
              const d = Math.sqrt(d2) + 0.01;
              const s = (1 - d / R) * 3.2 / d;
              f[i * 3] += ex * s;
              f[i * 3 + 1] += ey * s;
              f[i * 3 + 2] += ez * s;
              f[j * 3] -= ex * s;
              f[j * 3 + 1] -= ey * s;
              f[j * 3 + 2] -= ez * s;
            }
          }
    }

    // Springs along links.
    const L = 14;
    for (let k = 0; k < this.links.length; k++) {
      const a = this.linkIdx[k * 2];
      const b = this.linkIdx[k * 2 + 1];
      const ex = this.pos[b * 3] - this.pos[a * 3];
      const ey = this.pos[b * 3 + 1] - this.pos[a * 3 + 1];
      const ez = this.pos[b * 3 + 2] - this.pos[a * 3 + 2];
      const d = Math.sqrt(ex * ex + ey * ey + ez * ez) + 0.01;
      const s = ((d - L) * 0.018) / d;
      f[a * 3] += ex * s;
      f[a * 3 + 1] += ey * s;
      f[a * 3 + 2] += ez * s;
      f[b * 3] -= ex * s;
      f[b * 3 + 1] -= ey * s;
      f[b * 3 + 2] -= ez * s;
    }

    // Gravity toward the cluster centre, a light pull to the origin, and flattening into a disc.
    for (let i = 0; i < n; i++) {
      const g = this.groupOf[i];
      f[i * 3] += (this.center[g * 3] - this.pos[i * 3]) * 0.012 - this.pos[i * 3] * 0.0008;
      f[i * 3 + 1] += (this.center[g * 3 + 1] - this.pos[i * 3 + 1]) * 0.03;
      f[i * 3 + 2] += (this.center[g * 3 + 2] - this.pos[i * 3 + 2]) * 0.012 - this.pos[i * 3 + 2] * 0.0008;
    }

    const a = this.alpha;
    for (let i = 0; i < n * 3; i++) {
      this.vel[i] = (this.vel[i] + f[i] * a) * 0.82;
      const v = this.vel[i];
      this.pos[i] += Math.max(-6, Math.min(6, v));
    }
    this.alpha *= 0.985;
  }

  private writePositions() {
    if (!this.pointAttr || !this.lines) return;
    this.pointAttr.pos.needsUpdate = true;
    const lp = (this.lines.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    for (let k = 0; k < this.links.length; k++) {
      const a = this.linkIdx[k * 2];
      const b = this.linkIdx[k * 2 + 1];
      lp[k * 6] = this.pos[a * 3];
      lp[k * 6 + 1] = this.pos[a * 3 + 1];
      lp[k * 6 + 2] = this.pos[a * 3 + 2];
      lp[k * 6 + 3] = this.pos[b * 3];
      lp[k * 6 + 4] = this.pos[b * 3 + 1];
      lp[k * 6 + 5] = this.pos[b * 3 + 2];
    }
    (this.lines.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  // ---- labels --------------------------------------------------------------------------------

  private updateLabels() {
    const want = new Set<number>();
    this.nodes.forEach((n, i) => {
      if (n.kind === 'project') want.add(i);
    });
    if (!this.searchHits) this.hubs.forEach((i) => want.add(i));
    if (this.selected >= 0) want.add(this.selected);
    if (this.hovered >= 0) want.add(this.hovered);
    if (this.searchHits && this.searchHits.size <= 12) this.searchHits.forEach((i) => want.add(i));

    for (const [i, el] of this.labelEls) {
      if (!want.has(i)) {
        el.remove();
        this.labelEls.delete(i);
      }
    }

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const v = new THREE.Vector3();

    // Priority: selected, hovered, projects, search hits, then hubs by degree. Lower ones yield on overlap.
    const rank = (i: number) => (i === this.selected ? 0 : i === this.hovered ? 1 : this.nodes[i].kind === 'project' ? 2 : this.searchHits?.has(i) ? 3 : 4);
    const ordered = [...want].sort((a, b) => rank(a) - rank(b) || this.adj[b].length - this.adj[a].length);
    const placed: { x: number; y: number; w: number; h: number }[] = [];

    for (const i of ordered) {
      let el = this.labelEls.get(i);
      if (!el) {
        el = document.createElement('div');
        const nd = this.nodes[i];
        Object.assign(el.style, {
          position: 'absolute',
          left: '0',
          top: '0',
          whiteSpace: 'nowrap',
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontSize: nd.kind === 'project' ? '13px' : '12px',
          fontWeight: nd.kind === 'project' ? '600' : '500',
          color: nd.kind === 'project' ? nd.color : '#e6eaf0',
          textShadow: '0 0 4px #0b0d10, 0 0 8px #0b0d10, 0 1px 2px #0b0d10',
          willChange: 'transform',
        });
        el.textContent = nd.label.length > 42 ? `${nd.label.slice(0, 41)}…` : nd.label;
        this.labelLayer.appendChild(el);
        this.labelEls.set(i, el);
      }
      v.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]).project(this.camera);
      const visible = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      if (!visible) {
        el.style.opacity = '0';
        continue;
      }
      const sx = (v.x * 0.5 + 0.5) * w + 10;
      const sy = (-v.y * 0.5 + 0.5) * h - 8;
      const box = { x: sx, y: sy, w: (el.textContent?.length ?? 8) * 6.6, h: 16 };
      const important = rank(i) <= 2;
      const clash = placed.some((p) => box.x < p.x + p.w && box.x + box.w > p.x && box.y < p.y + p.h && box.y + box.h > p.y);
      if (clash && !important) {
        el.style.opacity = '0';
        continue;
      }
      placed.push(box);
      el.style.opacity = this.searchHits || this.selected >= 0 ? (i === this.selected || this.searchHits?.has(i) ? '1' : '0.45') : '0.92';
      el.style.transform = `translate(${sx}px, ${sy}px)`;
    }
  }
}

function gauss(): number {
  // Sum of uniforms: cheap approximate normal.
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.2;
}
