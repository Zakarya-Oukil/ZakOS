import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { GalaxyHandlers, GalaxyLink, GalaxyNode } from './galaxy';

/**
 * The knowledge map as a galaxy of neurons. Every note is a nerve cell: a glowing soma with dendrites growing out of it.
 * Links are axons, and light travels along them. Clusters of one project sit together on the arms of a slow spiral.
 * Size, position, links and activity all come from the real vault; nothing is decorative data.
 */

export type SizeMode = 'importance' | 'freshness' | 'size';
export type HeightMode = SizeMode;

export interface NeuralNode extends GalaxyNode {
  /** Creation time in ms, when known. Drives the time slider and the freshness size mode. */
  created?: number;
}

const GOLDEN = 2.399963229728653;
const MAX_PULSES = 360;
const LABEL_LIMIT = 12;
const SPACE = 'radial-gradient(ellipse at 50% 42%, #0c1428 0%, #050810 58%, #02030a 100%)';

/** Small deterministic random generator, so the same note always grows the same dendrites. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const gauss = (r: () => number) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const SOMA_VERT = /* glsl */ `
  attribute vec3 iPos;
  attribute vec3 iColor;
  attribute float iScale;
  attribute float iState;
  varying vec3 vColor;
  varying vec3 vN;
  varying vec3 vV;
  varying float vState;
  void main() {
    vColor = iColor;
    vState = iState;
    vec4 mv = modelViewMatrix * vec4(position * iScale + iPos, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const SOMA_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying vec3 vN;
  varying vec3 vV;
  varying float vState;
  void main() {
    float facing = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
    float rim = pow(1.0 - facing, 2.0);
    float core = pow(facing, 3.0);
    float dim = vState < -0.5 ? 0.18 : 1.0;
    float lift = vState > 0.5 ? 1.5 : 1.0;
    vec3 body = vColor * (0.2 + core * 0.62) + vColor * rim * 0.95 + vec3(1.0) * core * core * 0.12;
    gl_FragColor = vec4(body * dim * lift, 1.0);
  }
`;

const HALO_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aState;
  attribute vec3 aColor;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aState < -0.5 ? 0.012 : (aState > 0.5 ? 0.3 : 0.075);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * uScale / max(1.0, -mv.z), 2.0, 220.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const HALO_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float g = pow(1.0 - d * 2.0, 2.4);
    gl_FragColor = vec4(vColor, g * vAlpha);
  }
`;

const LINE_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const LINE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() { gl_FragColor = vec4(vColor, vAlpha); }
`;

const PULSE_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aAlpha;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(uScale / max(1.0, -mv.z), 2.0, 26.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const PULSE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float g = pow(1.0 - d * 2.0, 1.6);
    gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.65), g * vAlpha);
  }
`;

interface Fly {
  from: THREE.Vector3;
  to: THREE.Vector3;
  camFrom: THREE.Vector3;
  camTo: THREE.Vector3;
  t: number;
}
interface Pulse {
  link: number;
  t: number;
  speed: number;
  forward: boolean;
}

export class Neural {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private labelLayer: HTMLDivElement;
  private ro: ResizeObserver;
  private raf = 0;
  private disposed = false;
  private last = performance.now();

  private nodes: NeuralNode[] = [];
  private links: Array<{ a: number; b: number }> = [];
  private adj: number[][] = [];
  private nodeLinks: number[][] = [];
  private index = new Map<string, number>();
  private pos = new Float32Array(0);
  private radius = new Float32Array(0);
  private visible = new Uint8Array(0);
  private state = new Float32Array(0);

  private soma: THREE.Mesh | null = null;
  private halo: THREE.Points | null = null;
  private dendrites: THREE.LineSegments | null = null;
  private axons: THREE.LineSegments | null = null;
  private pulsePoints: THREE.Points | null = null;
  private stars: THREE.Points | null = null;
  private nebulae = new THREE.Group();
  private dendRange: Array<[number, number]> = [];
  private linkCtrl: Float32Array = new Float32Array(0);
  private linkSegs = 14;
  private pulses: Pulse[] = [];

  private mode: SizeMode = 'importance';
  private time: number | null = null;
  private flat = false;
  private selected = -1;
  private hovered = -1;
  private searchHits: Set<number> | null = null;
  private activeSet = new Set<number>();
  private fly: Fly | null = null;
  private labelEls: HTMLDivElement[] = [];
  private lastInteraction = performance.now();
  private pointer = { x: 0, y: 0, inside: false, down: false, moved: 0 };
  private haloMat: THREE.ShaderMaterial;
  private pulseMat: THREE.ShaderMaterial;
  private somaMat: THREE.ShaderMaterial;
  private lineMat: THREE.ShaderMaterial;
  private disposers: Array<() => void> = [];

  constructor(
    private host: HTMLElement,
    private handlers: GalaxyHandlers,
    private reduced: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setClearColor(0x03050c, 1);
    host.style.background = SPACE;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';

    this.labelLayer = document.createElement('div');
    Object.assign(this.labelLayer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' });
    host.appendChild(this.labelLayer);

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.5, 2000);
    this.camera.position.set(0, 46, 96);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 320;
    this.controls.rotateSpeed = 0.6;
    this.controls.autoRotateSpeed = 0.22;
    this.controls.addEventListener('start', () => {
      this.fly = null;
      this.lastInteraction = performance.now();
    });
    this.controls.addEventListener('change', () => (this.lastInteraction = performance.now()));

    this.somaMat = new THREE.ShaderMaterial({ vertexShader: SOMA_VERT, fragmentShader: SOMA_FRAG });
    this.haloMat = new THREE.ShaderMaterial({ vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 600 } } });
    this.pulseMat = new THREE.ShaderMaterial({ vertexShader: PULSE_VERT, fragmentShader: PULSE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 380 } } });
    this.lineMat = new THREE.ShaderMaterial({ vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.55, 0.5);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.buildBackdrop();
    this.scene.add(this.nebulae);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.bindPointer();
    this.loop();
  }

  // ---------------------------------------------------------------- backdrop

  private buildBackdrop() {
    const r = rng(7);
    const n = 3200;
    const p = new Float32Array(n * 3);
    const c = new Float32Array(n * 3);
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const rad = 260 + r() * 700;
      const th = r() * Math.PI * 2;
      const ph = Math.acos(2 * r() - 1);
      p[i * 3] = rad * Math.sin(ph) * Math.cos(th);
      p[i * 3 + 1] = rad * Math.cos(ph);
      p[i * 3 + 2] = rad * Math.sin(ph) * Math.sin(th);
      const warm = r();
      const col = new THREE.Color().setHSL(warm < 0.2 ? 0.08 : warm < 0.6 ? 0.58 : 0.62, 0.35, 0.65 + r() * 0.3);
      c[i * 3] = col.r;
      c[i * 3 + 1] = col.g;
      c[i * 3 + 2] = col.b;
      s[i] = 1 + r() * 2.2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(c, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(s, 1));
    g.setAttribute('aState', new THREE.BufferAttribute(new Float32Array(n), 1));
    const m = new THREE.ShaderMaterial({ vertexShader: HALO_VERT.replace('0.075)', '0.55)'), fragmentShader: HALO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 520 } } });
    this.stars = new THREE.Points(g, m);
    this.scene.add(this.stars);
    this.disposers.push(() => {
      g.dispose();
      m.dispose();
    });
  }

  private nebulaTexture(): THREE.Texture {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const x = cv.getContext('2d')!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.28)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  }

  // ---------------------------------------------------------------- data

  setData(nodes: NeuralNode[], links: GalaxyLink[]) {
    this.clearScene();
    this.nodes = nodes;
    this.index = new Map(nodes.map((n, i) => [n.id, i]));
    this.links = links.flatMap((l) => (this.index.has(l.source) && this.index.has(l.target) && l.source !== l.target ? [{ a: this.index.get(l.source)!, b: this.index.get(l.target)! }] : [])).slice(0, 7000);
    const n = nodes.length;
    this.adj = nodes.map(() => []);
    this.nodeLinks = nodes.map(() => []);
    this.links.forEach((l, i) => {
      this.adj[l.a].push(l.b);
      this.adj[l.b].push(l.a);
      this.nodeLinks[l.a].push(i);
      this.nodeLinks[l.b].push(i);
    });
    this.visible = new Uint8Array(n).fill(1);
    this.state = new Float32Array(n);
    this.pos = new Float32Array(n * 3);
    this.radius = new Float32Array(n);
    this.layout();
    this.computeRadii();
    this.build();
    this.selected = -1;
    this.hovered = -1;
    this.searchHits = null;
    this.refreshState();
    this.resetView(false);
  }

  private layout() {
    const n = this.nodes.length;
    const groups = [...new Set(this.nodes.map((x) => x.group))];
    const gi = new Map(groups.map((g, i) => [g, i]));
    const count = new Map<string, number>();
    for (const x of this.nodes) count.set(x.group, (count.get(x.group) ?? 0) + 1);
    const centers = groups.map((g, i) => {
      const r = i === 0 ? 0 : 20 + 15 * Math.sqrt(i);
      const a = i * GOLDEN * 0.55 + (i % 3) * 2.094 + r * 0.045;
      const h = rng(hash(g));
      return new THREE.Vector3(Math.cos(a) * r, (h() - 0.5) * 14, Math.sin(a) * r);
    });
    const spread = (g: string) => 3.5 + Math.sqrt(count.get(g) ?? 1) * 1.7;
    for (let i = 0; i < n; i++) {
      const nd = this.nodes[i];
      const c = centers[gi.get(nd.group)!];
      const r = rng(hash(nd.id));
      const s = spread(nd.group);
      this.pos[i * 3] = c.x + gauss(r) * s;
      this.pos[i * 3 + 1] = c.y + gauss(r) * s * 0.55;
      this.pos[i * 3 + 2] = c.z + gauss(r) * s;
    }
    // A short relaxation: notes that link pull together, unrelated ones keep their distance.
    const iters = n > 1100 ? 36 : 90;
    const k = 5.2;
    const fx = new Float32Array(n);
    const fy = new Float32Array(n);
    const fz = new Float32Array(n);
    for (let it = 0; it < iters; it++) {
      fx.fill(0);
      fy.fill(0);
      fz.fill(0);
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          const dx = this.pos[i * 3] - this.pos[j * 3];
          const dy = this.pos[i * 3 + 1] - this.pos[j * 3 + 1];
          const dz = this.pos[i * 3 + 2] - this.pos[j * 3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz + 0.05;
          if (d2 > 140) continue;
          const f = (k * k) / d2;
          fx[i] += dx * f;
          fy[i] += dy * f;
          fz[i] += dz * f;
          fx[j] -= dx * f;
          fy[j] -= dy * f;
          fz[j] -= dz * f;
        }
      for (const l of this.links) {
        const dx = this.pos[l.a * 3] - this.pos[l.b * 3];
        const dy = this.pos[l.a * 3 + 1] - this.pos[l.b * 3 + 1];
        const dz = this.pos[l.a * 3 + 2] - this.pos[l.b * 3 + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
        const pull = (d - 6) * 0.05;
        fx[l.a] -= (dx / d) * pull;
        fy[l.a] -= (dy / d) * pull;
        fz[l.a] -= (dz / d) * pull;
        fx[l.b] += (dx / d) * pull;
        fy[l.b] += (dy / d) * pull;
        fz[l.b] += (dz / d) * pull;
      }
      const cool = 1 - it / iters;
      for (let i = 0; i < n; i++) {
        const c = centers[gi.get(this.nodes[i].group)!];
        fx[i] += (c.x - this.pos[i * 3]) * 0.03;
        fy[i] += (c.y - this.pos[i * 3 + 1]) * 0.06;
        fz[i] += (c.z - this.pos[i * 3 + 2]) * 0.03;
        const m = Math.sqrt(fx[i] * fx[i] + fy[i] * fy[i] + fz[i] * fz[i]) || 1;
        const step = Math.min(m, 1.6 * cool + 0.1) / m;
        this.pos[i * 3] += fx[i] * step;
        this.pos[i * 3 + 1] += fy[i] * step;
        this.pos[i * 3 + 2] += fz[i] * step;
      }
    }
  }

  private computeRadii() {
    const n = this.nodes.length;
    let maxDeg = 1;
    let maxSize = 1;
    let tMin = Infinity;
    let tMax = -Infinity;
    for (const x of this.nodes) {
      maxDeg = Math.max(maxDeg, x.degree ?? 0);
      maxSize = Math.max(maxSize, x.size);
      if (x.created) {
        tMin = Math.min(tMin, x.created);
        tMax = Math.max(tMax, x.created);
      }
    }
    for (let i = 0; i < n; i++) {
      const x = this.nodes[i];
      let v: number;
      if (this.mode === 'importance') v = Math.sqrt((x.degree ?? this.adj[i].length) / maxDeg);
      else if (this.mode === 'size') v = Math.sqrt(x.size / maxSize);
      else v = x.created && tMax > tMin ? (x.created - tMin) / (tMax - tMin) : 0.3;
      const base = x.kind === 'project' ? 2.2 : x.kind === 'code' ? 0.5 : 0.7;
      this.radius[i] = base + v * (x.kind === 'project' ? 1.4 : 1.5);
    }
  }

  private groupHue = new Map<string, THREE.Color>();

  /** Cells take their cluster's colour. Projects keep the colour you gave them. */
  private colorOf(i: number) {
    const n = this.nodes[i];
    if (n.kind === 'project') return new THREE.Color(n.color);
    let c = this.groupHue.get(n.group);
    if (!c) {
      const palette = ['#4fd1c5', '#7aa2ff', '#c792ea', '#ffb454', '#ff7a90', '#8be28b', '#5ad1ff', '#e6d36a'];
      c = new THREE.Color(palette[this.groupHue.size % palette.length]);
      this.groupHue.set(n.group, c);
    }
    return c.clone();
  }

  private build() {
    const n = this.nodes.length;
    if (!n) return;

    // Somas: instanced icospheres shaded as glowing cells.
    const ico = new THREE.IcosahedronGeometry(1, 3);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = ico.index;
    geo.setAttribute('position', ico.getAttribute('position'));
    geo.setAttribute('normal', ico.getAttribute('normal'));
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.pos.slice(), 3));
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const c = this.colorOf(i);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('iColor', new THREE.InstancedBufferAttribute(col, 3));
    geo.setAttribute('iScale', new THREE.InstancedBufferAttribute(this.radius.slice(), 1));
    geo.setAttribute('iState', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    geo.instanceCount = n;
    this.soma = new THREE.Mesh(geo, this.somaMat);
    this.soma.frustumCulled = false;
    this.scene.add(this.soma);

    // Halos: a soft glow around each cell.
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(), 3));
    hg.setAttribute('aColor', new THREE.BufferAttribute(col.slice(), 3));
    hg.setAttribute('aSize', new THREE.BufferAttribute(Float32Array.from(this.radius, (r) => r * 5.2), 1));
    hg.setAttribute('aState', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.halo = new THREE.Points(hg, this.haloMat);
    this.halo.frustumCulled = false;
    this.scene.add(this.halo);

    // Dendrites: a few forked, curved branches growing from each soma.
    const dp: number[] = [];
    const dc: number[] = [];
    const da: number[] = [];
    this.dendRange = [];
    for (let i = 0; i < n; i++) {
      const start = dp.length / 3;
      const r = rng(hash(this.nodes[i].id) ^ 0x9e3779b9);
      const c = this.colorOf(i);
      const count = this.nodes[i].kind === 'project' ? 9 : 3 + Math.floor(r() * 4) + Math.min(2, Math.floor((this.nodes[i].degree ?? 0) / 4));
      const rad = this.radius[i];
      const ox = this.pos[i * 3];
      const oy = this.pos[i * 3 + 1];
      const oz = this.pos[i * 3 + 2];
      const seg = (a: THREE.Vector3, b: THREE.Vector3, fa: number, fb: number) => {
        dp.push(a.x, a.y, a.z, b.x, b.y, b.z);
        dc.push(c.r, c.g, c.b, c.r, c.g, c.b);
        da.push(fa, fb);
      };
      for (let d = 0; d < count; d++) {
        const dir = new THREE.Vector3(gauss(r), gauss(r) * 0.7, gauss(r)).normalize();
        let p = new THREE.Vector3(ox, oy, oz).addScaledVector(dir, rad * 0.9);
        const len = rad * (2.6 + r() * 3.2);
        const steps = 3;
        let fade = 0.9;
        let cur = dir.clone();
        let mid: THREE.Vector3 | null = null;
        for (let s = 0; s < steps; s++) {
          cur = cur.clone().add(new THREE.Vector3(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.38)).normalize();
          const next = p.clone().addScaledVector(cur, len / steps);
          seg(p, next, fade, fade * 0.7);
          fade *= 0.7;
          p = next;
          if (s === 1) mid = p.clone();
        }
        if (mid) {
          for (let t = 0; t < 2; t++) {
            const bd = cur.clone().add(new THREE.Vector3(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.9)).normalize();
            const e1 = mid.clone().addScaledVector(bd, len * 0.28);
            const e2 = e1.clone().addScaledVector(bd.clone().add(new THREE.Vector3(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.4)).normalize(), len * 0.22);
            seg(mid, e1, 0.5, 0.34);
            seg(e1, e2, 0.34, 0.12);
          }
        }
      }
      this.dendRange.push([start, dp.length / 3]);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
    dg.setAttribute('aColor', new THREE.Float32BufferAttribute(dc, 3));
    dg.setAttribute('aAlpha', new THREE.Float32BufferAttribute(da, 1));
    this.baseDend = Float32Array.from(da);
    this.dendrites = new THREE.LineSegments(dg, this.lineMat);
    this.dendrites.frustumCulled = false;
    this.scene.add(this.dendrites);

    // Axons: a gently curved line for every link.
    const m = this.links.length;
    const segs = this.linkSegs;
    this.linkCtrl = new Float32Array(m * 3);
    const lp = new Float32Array(m * segs * 6);
    const lc = new Float32Array(m * segs * 6);
    const la = new Float32Array(m * segs * 2);
    for (let li = 0; li < m; li++) {
      const l = this.links[li];
      const r = rng(hash(`${this.nodes[l.a].id}>${this.nodes[l.b].id}`));
      const a = new THREE.Vector3(this.pos[l.a * 3], this.pos[l.a * 3 + 1], this.pos[l.a * 3 + 2]);
      const b = new THREE.Vector3(this.pos[l.b * 3], this.pos[l.b * 3 + 1], this.pos[l.b * 3 + 2]);
      const ctrl = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(gauss(r), gauss(r), gauss(r)).multiplyScalar(a.distanceTo(b) * 0.16));
      this.linkCtrl.set([ctrl.x, ctrl.y, ctrl.z], li * 3);
      const ca = this.colorOf(l.a);
      const cb = this.colorOf(l.b);
      let prev = a;
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const q = this.bezier(a, ctrl, b, t, new THREE.Vector3());
        const o = (li * segs + (s - 1)) * 6;
        lp.set([prev.x, prev.y, prev.z, q.x, q.y, q.z], o);
        const c1 = ca.clone().lerp(cb, (s - 1) / segs);
        const c2 = ca.clone().lerp(cb, t);
        lc.set([c1.r, c1.g, c1.b, c2.r, c2.g, c2.b], o);
        la[(li * segs + (s - 1)) * 2] = 0.2;
        la[(li * segs + (s - 1)) * 2 + 1] = 0.2;
        prev = q;
      }
    }
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    ag.setAttribute('aColor', new THREE.BufferAttribute(lc, 3));
    ag.setAttribute('aAlpha', new THREE.BufferAttribute(la, 1));
    this.axons = new THREE.LineSegments(ag, this.lineMat);
    this.axons.frustumCulled = false;
    this.scene.add(this.axons);

    // Signals: points of light that travel along the axons.
    const pc = Math.min(MAX_PULSES, Math.max(40, Math.round(m * 0.5)));
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pc * 3), 3));
    pg.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(pc * 3), 3));
    pg.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(pc), 1));
    this.pulsePoints = new THREE.Points(pg, this.pulseMat);
    this.pulsePoints.frustumCulled = false;
    this.scene.add(this.pulsePoints);
    this.pulses = m
      ? Array.from({ length: pc }, () => ({ link: Math.floor(Math.random() * m), t: Math.random(), speed: 0.18 + Math.random() * 0.4, forward: Math.random() > 0.5 }))
      : [];

    // Nebulae behind each cluster give the arms their glow.
    const tex = this.nebulaTexture();
    const groups = new Map<string, { c: THREE.Vector3; n: number; color: THREE.Color }>();
    for (let i = 0; i < n; i++) {
      const g = this.nodes[i].group;
      const e = groups.get(g) ?? { c: new THREE.Vector3(), n: 0, color: this.colorOf(i) };
      e.c.add(new THREE.Vector3(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]));
      e.n++;
      groups.set(g, e);
    }
    for (const e of groups.values()) {
      const mat = new THREE.SpriteMaterial({ map: tex, color: e.color, transparent: true, opacity: 0.055, depthWrite: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(mat);
      sp.position.copy(e.c.multiplyScalar(1 / e.n));
      const sc = 30 + Math.sqrt(e.n) * 11;
      sp.scale.set(sc, sc, 1);
      this.nebulae.add(sp);
    }
    this.nebulaTex = tex;
  }
  private baseDend: Float32Array = new Float32Array(0);
  private nebulaTex: THREE.Texture | null = null;

  private bezier(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) {
    const u = 1 - t;
    return out.set(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z);
  }

  private clearScene() {
    for (const o of [this.soma, this.halo, this.dendrites, this.axons, this.pulsePoints] as Array<THREE.Object3D | null>) {
      if (!o) continue;
      this.scene.remove(o);
      (o as THREE.Mesh).geometry?.dispose();
    }
    this.soma = this.halo = this.dendrites = this.axons = this.pulsePoints = null;
    for (const s of [...this.nebulae.children] as THREE.Sprite[]) {
      s.material.dispose();
      this.nebulae.remove(s);
    }
    this.nebulaTex?.dispose();
    this.nebulaTex = null;
    this.labelEls.forEach((e) => e.remove());
    this.labelEls = [];
  }

  // ---------------------------------------------------------------- state

  private refreshState() {
    const n = this.nodes.length;
    if (!n || !this.soma) return;
    const near = new Set<number>();
    if (this.selected >= 0) {
      near.add(this.selected);
      for (const j of this.adj[this.selected]) near.add(j);
    }
    for (let i = 0; i < n; i++) {
      let s = 0;
      if (!this.visible[i]) s = -2;
      else if (this.selected >= 0) s = i === this.selected ? 1 : near.has(i) ? 0 : -1;
      else if (this.searchHits) s = this.searchHits.has(i) ? 1 : -1;
      if (i === this.hovered && s !== -2) s = 1;
      if (this.activeSet.has(i) && s !== -2 && s !== -1) s = 1;
      this.state[i] = s;
    }
    const iState = (this.soma.geometry as THREE.InstancedBufferGeometry).getAttribute('iState') as THREE.BufferAttribute;
    const hState = this.halo!.geometry.getAttribute('aState') as THREE.BufferAttribute;
    const iScale = (this.soma.geometry as THREE.InstancedBufferGeometry).getAttribute('iScale') as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      const s = this.state[i] === -2 ? -1 : this.state[i];
      iState.setX(i, s);
      hState.setX(i, s);
      iScale.setX(i, this.state[i] === -2 ? 0 : this.radius[i] * (this.state[i] === 1 ? 1.25 : 1));
    }
    iState.needsUpdate = hState.needsUpdate = iScale.needsUpdate = true;

    const dAlpha = this.dendrites!.geometry.getAttribute('aAlpha') as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      const [a, b] = this.dendRange[i];
      const k = this.state[i] === -2 ? 0 : this.state[i] === -1 ? 0.12 : this.state[i] === 1 ? 1.4 : 0.8;
      for (let v = a; v < b; v++) dAlpha.setX(v, this.baseDend[v] * k);
    }
    dAlpha.needsUpdate = true;

    const aAlpha = this.axons!.geometry.getAttribute('aAlpha') as THREE.BufferAttribute;
    const segs = this.linkSegs;
    this.links.forEach((l, li) => {
      let k = 0.2;
      if (this.state[l.a] === -2 || this.state[l.b] === -2) k = 0;
      else if (this.selected >= 0) k = l.a === this.selected || l.b === this.selected ? 0.95 : 0.04;
      else if (this.searchHits) k = this.searchHits.has(l.a) && this.searchHits.has(l.b) ? 0.8 : 0.05;
      else if (this.activeSet.has(l.a) || this.activeSet.has(l.b)) k = 0.7;
      for (let s = 0; s < segs * 2; s++) aAlpha.setX(li * segs * 2 + s, k);
    });
    aAlpha.needsUpdate = true;
  }

  setMode(mode: SizeMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.computeRadii();
    const hs = this.halo?.geometry.getAttribute('aSize') as THREE.BufferAttribute | undefined;
    hs?.copyArray(Float32Array.from(this.radius, (r) => r * 5.2));
    if (hs) hs.needsUpdate = true;
    this.refreshState();
  }

  /** Projects: a project with a running agent pulses and sends more signals. */
  setActive(ids: string[]) {
    this.activeSet = new Set(ids.map((id) => this.index.get(id)).filter((x): x is number => x !== undefined));
    this.refreshState();
  }

  setTime(ms: number | null) {
    this.time = ms;
    for (let i = 0; i < this.nodes.length; i++) this.visible[i] = ms === null || !this.nodes[i].created || this.nodes[i].created! <= ms ? 1 : 0;
    this.refreshState();
  }

  timeRange(): { min: number; max: number } | null {
    const t = this.nodes.map((n) => n.created).filter((x): x is number => !!x);
    return t.length > 1 ? { min: Math.min(...t), max: Math.max(...t) } : null;
  }

  /** The flat view lays the cluster on one plane, like a chart. */
  setFlat(flat: boolean) {
    this.flat = flat;
    if (this.soma) this.scene.scale.y = flat ? 0.12 : 1;
  }

  select(id: string | null, fly = true) {
    const i = id === null ? -1 : (this.index.get(id) ?? -1);
    this.selected = i;
    this.refreshState();
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
      this.refreshState();
      return [];
    }
    const hits = new Set<number>();
    this.nodes.forEach((n, i) => n.label.toLowerCase().includes(q) && hits.add(i));
    this.searchHits = hits;
    this.refreshState();
    return [...hits].map((i) => this.nodes[i].id);
  }

  resetView(animate = true) {
    const target = new THREE.Vector3();
    const cam = new THREE.Vector3(0, 46, 96);
    if (this.nodes.length) {
      const box = new THREE.Box3();
      for (let i = 0; i < this.nodes.length; i++) box.expandByPoint(new THREE.Vector3(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]));
      box.getCenter(target);
      const size = box.getSize(new THREE.Vector3()).length();
      cam.copy(target).add(new THREE.Vector3(0, size * 0.32, size * 0.72));
    }
    if (!animate || this.reduced) {
      this.controls.target.copy(target);
      this.camera.position.copy(cam);
      this.controls.update();
      return;
    }
    this.fly = { from: this.controls.target.clone(), to: target, camFrom: this.camera.position.clone(), camTo: cam, t: 0 };
  }

  private flyTo(i: number) {
    const to = new THREE.Vector3(this.pos[i * 3], this.pos[i * 3 + 1] * this.scene.scale.y, this.pos[i * 3 + 2]);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const dist = Math.max(34, this.radius[i] * 15);
    const camTo = to.clone().addScaledVector(dir, dist);
    if (this.reduced) {
      this.controls.target.copy(to);
      this.camera.position.copy(camTo);
      this.controls.update();
      return;
    }
    this.fly = { from: this.controls.target.clone(), to, camFrom: this.camera.position.clone(), camTo, t: 0 };
  }

  // ---------------------------------------------------------------- input

  private bindPointer() {
    const el = this.renderer.domElement;
    const rect = () => el.getBoundingClientRect();
    const move = (e: PointerEvent) => {
      const r = rect();
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
      this.pointer.inside = true;
      if (this.pointer.down) this.pointer.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
    };
    const down = () => {
      this.pointer.down = true;
      this.pointer.moved = 0;
    };
    const up = () => {
      this.pointer.down = false;
      if (this.pointer.moved < 5) {
        const i = this.pick();
        this.selected = i;
        this.refreshState();
        this.handlers.onSelect(i >= 0 ? this.nodes[i].id : null);
      }
    };
    const leave = () => {
      this.pointer.inside = false;
      this.pointer.down = false;
      if (this.hovered !== -1) {
        this.hovered = -1;
        this.refreshState();
        this.handlers.onHover(null);
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', leave);
    this.disposers.push(() => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      el.removeEventListener('pointerleave', leave);
    });
  }

  private project(i: number, out: THREE.Vector3) {
    out.set(this.pos[i * 3], this.pos[i * 3 + 1] * this.scene.scale.y, this.pos[i * 3 + 2]).project(this.camera);
    return out;
  }

  /** The nearest visible cell to the pointer, within a reach that grows with the cell. */
  private pick(): number {
    if (!this.pointer.inside) return -1;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const v = new THREE.Vector3();
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      if (!this.visible[i]) continue;
      this.project(i, v);
      if (v.z > 1 || v.z < -1) continue;
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      const d = Math.hypot(sx - this.pointer.x, sy - this.pointer.y);
      const dist = this.camera.position.distanceTo(new THREE.Vector3(this.pos[i * 3], this.pos[i * 3 + 1] * this.scene.scale.y, this.pos[i * 3 + 2]));
      const reach = Math.max(12, (this.radius[i] * 520) / Math.max(dist, 1));
      if (d < reach && d < bestD) {
        best = i;
        bestD = d;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- frame

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const k = h / 900;
    this.haloMat.uniforms.uScale.value = 620 * k;
    this.pulseMat.uniforms.uScale.value = 420 * k;
  }

  private ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    if (this.fly) {
      this.fly.t = Math.min(1, this.fly.t + dt / 1.2);
      const k = this.ease(this.fly.t);
      this.controls.target.lerpVectors(this.fly.from, this.fly.to, k);
      this.camera.position.lerpVectors(this.fly.camFrom, this.fly.camTo, k);
      if (this.fly.t >= 1) this.fly = null;
    }
    this.controls.autoRotate = !this.reduced && !this.fly && now - this.lastInteraction > 7000 && this.selected < 0;
    this.controls.update();

    const h = this.pointer.down ? this.hovered : this.pick();
    if (h !== this.hovered && !this.pointer.down) {
      this.hovered = h;
      this.refreshState();
      this.renderer.domElement.style.cursor = h >= 0 ? 'pointer' : 'grab';
      this.handlers.onHover(h >= 0 ? this.nodes[h].id : null);
    }

    if (!this.reduced) this.stepPulses(dt, now);
    if (this.soma && this.activeSet.size && !this.reduced) {
      const sc = (this.soma.geometry as THREE.InstancedBufferGeometry).getAttribute('iScale') as THREE.BufferAttribute;
      const beat = 1 + Math.sin(now / 260) * 0.14;
      for (const i of this.activeSet) if (this.visible[i]) sc.setX(i, this.radius[i] * 1.25 * beat);
      sc.needsUpdate = true;
    }
    if (this.stars && !this.reduced) this.stars.rotation.y += dt * 0.004;

    this.composer.render();
    this.updateLabels();
  };

  private stepPulses(dt: number, now: number) {
    if (!this.pulsePoints || !this.pulses.length) return;
    const m = this.links.length;
    const pos = this.pulsePoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = this.pulsePoints.geometry.getAttribute('aColor') as THREE.BufferAttribute;
    const al = this.pulsePoints.geometry.getAttribute('aAlpha') as THREE.BufferAttribute;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const q = new THREE.Vector3();
    const focus = this.selected >= 0 ? this.nodeLinks[this.selected] : null;
    const active = this.activeSet.size ? [...this.activeSet].flatMap((i) => this.nodeLinks[i]) : null;
    void now;
    this.pulses.forEach((p, idx) => {
      const boost = focus || active ? 1.8 : 1;
      p.t += (p.forward ? 1 : -1) * p.speed * dt * boost;
      if (p.t > 1 || p.t < 0) {
        const pool = focus && focus.length && Math.random() < 0.85 ? focus : active && active.length && Math.random() < 0.6 ? active : null;
        p.link = pool ? pool[Math.floor(Math.random() * pool.length)] : Math.floor(Math.random() * m);
        const l = this.links[p.link];
        p.forward = this.selected >= 0 && l.b === this.selected ? true : this.selected >= 0 && l.a === this.selected ? false : Math.random() > 0.5;
        p.t = p.forward ? 0 : 1;
        p.speed = 0.18 + Math.random() * 0.4;
      }
      const l = this.links[p.link];
      a.set(this.pos[l.a * 3], this.pos[l.a * 3 + 1], this.pos[l.a * 3 + 2]);
      b.set(this.pos[l.b * 3], this.pos[l.b * 3 + 1], this.pos[l.b * 3 + 2]);
      c.set(this.linkCtrl[p.link * 3], this.linkCtrl[p.link * 3 + 1], this.linkCtrl[p.link * 3 + 2]);
      this.bezier(a, c, b, p.t, q);
      pos.setXYZ(idx, q.x, q.y, q.z);
      const cc = this.colorOf(p.forward ? l.b : l.a);
      col.setXYZ(idx, cc.r, cc.g, cc.b);
      const hidden = this.state[l.a] === -2 || this.state[l.b] === -2;
      const dimmed = (this.selected >= 0 && l.a !== this.selected && l.b !== this.selected) || (this.searchHits && !(this.searchHits.has(l.a) && this.searchHits.has(l.b)));
      al.setX(idx, hidden ? 0 : dimmed ? 0.08 : Math.sin(Math.min(1, Math.max(0, p.t)) * Math.PI) * 0.95);
    });
    pos.needsUpdate = col.needsUpdate = al.needsUpdate = true;
  }

  private updateLabels() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const want: Array<{ i: number; strong: boolean }> = [];
    const seen = new Set<number>();
    const add = (i: number, strong: boolean) => {
      if (i >= 0 && !seen.has(i) && this.visible[i] && want.length < LABEL_LIMIT) {
        seen.add(i);
        want.push({ i, strong });
      }
    };
    add(this.selected, true);
    add(this.hovered, true);
    if (this.selected >= 0) for (const j of this.adj[this.selected]) add(j, false);
    if (this.searchHits) for (const j of this.searchHits) add(j, true);
    if (want.length < 8) {
      // Without a focus, name the biggest cells that face the camera.
      const order = [...this.nodes.keys()].sort((a, b) => this.radius[b] - this.radius[a]).slice(0, 40);
      for (const j of order) add(j, false);
    }
    while (this.labelEls.length < want.length) {
      const d = document.createElement('div');
      Object.assign(d.style, { position: 'absolute', transform: 'translate(-50%, 14px)', whiteSpace: 'nowrap', font: '500 12px var(--os-font-sans, system-ui)', color: '#e9eefc', textShadow: '0 0 6px #02030a, 0 0 2px #02030a', pointerEvents: 'none' });
      this.labelLayer.appendChild(d);
      this.labelEls.push(d);
    }
    const v = new THREE.Vector3();
    const placed: Array<[number, number, number]> = [];
    this.labelEls.forEach((el, k) => {
      const t = want[k];
      if (!t) {
        el.style.display = 'none';
        return;
      }
      this.project(t.i, v);
      const lx = (v.x * 0.5 + 0.5) * w;
      const ly = (-v.y * 0.5 + 0.5) * h;
      const width = this.nodes[t.i].label.length * 6.6;
      const clash = placed.some(([x, y, pw]) => Math.abs(x - lx) < (pw + width) / 2 + 6 && Math.abs(y - ly) < 18);
      if (v.z > 1 || lx < 0 || lx > w || ly < 0 || ly > h || (clash && !t.strong)) {
        el.style.display = 'none';
        return;
      }
      placed.push([lx, ly, width]);
      el.style.display = 'block';
      el.textContent = this.nodes[t.i].label;
      el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
      el.style.opacity = t.strong ? '1' : '0.72';
      el.style.fontWeight = t.strong ? '600' : '500';
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.clearScene();
    this.disposers.forEach((d) => d());
    for (const m of [this.somaMat, this.haloMat, this.pulseMat, this.lineMat]) m.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelLayer.remove();
    this.host.style.background = '';
  }
}
