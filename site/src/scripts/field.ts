// The loop field: a toroidal surface of Truchet tiles rendered in one fragment shader.
// Tiles only ever turn. Colour (the "lit" state) travels along connected arcs from agent tiles,
// so it spreads when turning tiles rewire the loops. Swirls deform the plane without cutting it.
import { arcSides, rng } from '../lib/truchet';

export type RGB = [number, number, number];
export type Theme = { ground: RGB; loop: RGB; lit: RGB; agent: RGB };
export const THEMES: Record<string, Theme> = {
  violet: { ground: hex('#2b12b8'), loop: hex('#4f33e6'), lit: hex('#d8ff3c'), agent: hex('#d8ff3c') },
  deep: { ground: hex('#1d0b86'), loop: hex('#3a20c9'), lit: hex('#d8ff3c'), agent: hex('#d8ff3c') },
  paper: { ground: hex('#eeeaff'), loop: hex('#ddd5ff'), lit: hex('#2b12b8'), agent: hex('#2b12b8') },
};
function hex(h: string): RGB { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }

export type Pattern = 'lattice' | 'random' | 'diagonal' | 'weave';
export interface Mode {
  pattern: Pattern; seed: number; density?: number;
  cell: number;            // CSS px per tile
  width?: number;          // stroke width, fraction of a tile
  theme: keyof typeof THEMES;
  agents?: number;         // number of agents to scatter
  ambient?: number;        // idle half-turns per second
  interactive?: boolean;
  fade?: number;           // 0..1 toward ground
  pulse?: number;          // stroke-weight pulse amplitude
  cam?: [number, number];
}

const N = 64, M = 64, T = N * M;
const STEP = 0.075;       // seconds per arc of the colour front
const TURN = 0.55;        // seconds per quarter-turn

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uA; uniform sampler2D uB;
uniform vec2 uRes; uniform float uScale; uniform vec2 uCam; uniform float uRot;
uniform float uTime; uniform float uStep; uniform float uW; uniform float uFade;
uniform vec3 uGround; uniform vec3 uLoop; uniform vec3 uLit; uniform vec3 uAgent;
uniform vec4 uSwirl; uniform vec4 uStir; uniform float uPulse;
out vec4 o;
const vec2 G = vec2(${N}.0, ${M}.0);
vec2 swirl(vec2 g, vec4 s){ vec2 d = g - s.xy; float a = s.z * exp(-dot(d,d)/(s.w*s.w)); float c = cos(a), n = sin(a); return s.xy + vec2(c*d.x - n*d.y, n*d.x + c*d.y); }
float fill(float litT, float unlitT, float entry, float u){
  // draining: the colour retreats along the arc (no colour mixing, so no grey in between)
  if (unlitT > litT) { float g = clamp((uTime - unlitT)/0.45, 0.0, 1.0); return 1.0 - smoothstep(1.0 - g - 0.04, 1.0 - g, u); }
  float f = clamp((uTime - litT)/uStep, 0.0, 1.0);
  if (f <= 0.0) return 0.0;
  if (f >= 1.0) return 1.0;
  float uu = entry > 0.5 ? 1.0 - u : u;
  return 1.0 - smoothstep(f - 0.04, f, uu);
}
void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 g = (px - 0.5*uRes) / uScale;
  float cr = cos(uRot), sr = sin(uRot);
  g = vec2(cr*g.x - sr*g.y, sr*g.x + cr*g.y) + uCam;
  g = swirl(g, uSwirl); g = swirl(g, uStir);
  vec2 cid = floor(g); vec2 f = g - cid;
  ivec2 t = ivec2(mod(cid, G));
  vec4 A = texelFetch(uA, t, 0); vec4 B = texelFetch(uB, t, 0);
  float ang = A.x * 1.5707963;
  vec2 d = f - 0.5; float ca = cos(ang), sa = sin(ang);
  vec2 q = vec2(d.x*ca + d.y*sa, -d.x*sa + d.y*ca) + 0.5;
  float px1 = length(fwidth(g));
  float aa = 0.75 * px1;
  // a slow pulse of stroke weight travels out from the camera centre (continuous across tiles)
  float pr = length(g - uCam);
  float hw = 0.5 * uW * (1.0 + uPulse * sin(pr * 0.42 - uTime * 1.3));
  float dA = abs(length(q) - 0.5), dB = abs(length(q - 1.0) - 0.5);
  // edge softness from the distance field's own screen derivative: crisp even where a swirl compresses the plane
  float fA = 0.7 * min(fwidth(dA), 1.5 * px1) + 1e-5, fB = 0.7 * min(fwidth(dB), 1.5 * px1) + 1e-5;
  float cA = (1.0 - smoothstep(hw - fA, hw + fA, dA)) * step(-0.001, min(q.x, q.y));
  float cB = (1.0 - smoothstep(hw - fB, hw + fB, dB)) * step(max(q.x, q.y), 1.001);
  float uA_ = clamp(atan(q.y, q.x) / 1.5707963, 0.0, 1.0);
  float uB_ = clamp((atan(q.y - 1.0, q.x - 1.0) + 3.1415926) / 1.5707963, 0.0, 1.0);
  float ent = A.z; float eA = mod(ent, 2.0); float eB = floor(ent / 2.0);
  float lA = fill(B.x, B.y, eA, uA_), lB = fill(B.z, B.w, eB, uB_);
  vec3 col = uGround;
  col = mix(col, mix(uLoop, uLit, lA), cA);
  col = mix(col, mix(uLoop, uLit, lB), cB);
  // agent: a disc at the centre of its tile and a slow ring
  float ag = A.y;
  if (ag > 0.001) {
    float r = length(f - 0.5);
    float rd = 0.11 * ag;
    float halo = 1.0 - smoothstep(rd + 0.045 - aa, rd + 0.045 + aa, r);
    float disc = 1.0 - smoothstep(rd - aa, rd + aa, r);
    float ph = fract(uTime * 0.45 + A.w);
    float rr = 0.17 + ph * 0.3;
    float ring = (1.0 - smoothstep(0.016 - aa, 0.016 + aa, abs(r - rr))) * (1.0 - ph) * ag;
    col = mix(col, uAgent, ring * 0.9);
    col = mix(col, uGround, halo * ag);
    col = mix(col, uAgent, disc);
  }
  col = mix(col, uGround, uFade);
  o = vec4(col, 1.0);
}`;

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class LoopField {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  prog: WebGLProgram;
  texA: WebGLTexture; texB: WebGLTexture;
  dataA = new Float32Array(T * 4); dataB = new Float32Array(T * 4);
  u: Record<string, WebGLUniformLocation | null> = {};
  // tile state
  kFrom = new Float32Array(T); kTo = new Float32Array(T); t0 = new Float32Array(T); dur = new Float32Array(T);
  extra = new Float32Array(T);            // p-driven turns (story), continuous
  agentT = new Float32Array(T);           // agent target 0/1
  agentA = new Float32Array(T);           // agent displayed amount
  agentPhase = new Float32Array(T);
  settled = new Int8Array(T).fill(-1);
  spinning = new Uint8Array(T);            // 1 while a tile makes a full turn (same connections before and after)
  // arc state (2 per tile)
  lit = new Uint8Array(T * 2); litT = new Float32Array(T * 2).fill(1e9); unlitT = new Float32Array(T * 2).fill(-1e9);
  entry = new Uint8Array(T * 2);
  dirtyB = true; dirtyTopo = true;
  // view (current + target)
  view = { cell: 40, camX: N / 2, camY: M / 2, rot: 0, w: 0.16, fade: 0 };
  viewT = { cell: 40, camX: N / 2, camY: M / 2, rot: 0, w: 0.16, fade: 0 };
  theme: Theme = { ...THEMES.violet }; themeT: Theme = { ...THEMES.violet };
  swirl = [0, 0, 0, 8]; stir = [0, 0, 0, 3];
  ambient = 0.6; interactive = true; pulse = 0; pulseT = 0;
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  start = performance.now(); now = 0; last = 0;
  W = 0; H = 0; dpr = 1;
  pointer = { x: -1, y: -1, vx: 0, vy: 0, inside: false, lastTile: -1 };
  onFrame: ((f: LoopField) => void) | null = null;
  raf = 0; visible = true;

  static create(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    try { return new LoopField(canvas, gl); } catch (e) { console.warn(e); return null; }
  }

  constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas; this.gl = gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    this.prog = p; gl.useProgram(p);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uA', 'uB', 'uRes', 'uScale', 'uCam', 'uRot', 'uTime', 'uStep', 'uW', 'uFade', 'uGround', 'uLoop', 'uLit', 'uAgent', 'uSwirl', 'uStir', 'uPulse']) this.u[n] = gl.getUniformLocation(p, n);
    const mk = (unit: number) => {
      const t = gl.createTexture()!; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, M, 0, gl.RGBA, gl.FLOAT, null);
      return t;
    };
    this.texA = mk(0); this.texB = mk(1);
    gl.uniform1i(this.u.uA, 0); gl.uniform1i(this.u.uB, 1);
    const r = rng(99); for (let i = 0; i < T; i++) this.agentPhase[i] = r();
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('pointermove', (e) => this.move(e), { passive: true });
    document.addEventListener('pointerleave', () => { this.pointer.inside = false; });
    addEventListener('click', (e) => this.click(e));
    document.addEventListener('visibilitychange', () => { this.visible = !document.hidden; if (this.visible) this.loop(); });
    this.loop = this.loop.bind(this);
    this.loop();
  }

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 2 : 1.75);
    this.W = innerWidth; this.H = innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr); this.canvas.height = Math.round(this.H * this.dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  /** Smallest tile size that hides the torus repeat. */
  get minCell() { return Math.max(this.W, this.H) / (N - 6); }

  // ---------- geometry helpers ----------
  /** screen (CSS px) → grid coords, same mapping as the shader */
  toGrid(x: number, y: number) {
    const v = this.view;
    let gx = (x - this.W / 2) / v.cell, gy = (y - this.H / 2) / v.cell;
    const c = Math.cos(v.rot), s = Math.sin(v.rot);
    [gx, gy] = [c * gx - s * gy + v.camX, s * gx + c * gy + v.camY];
    for (const w of [this.swirl, this.stir]) {
      const dx = gx - w[0], dy = gy - w[1], a = w[2] * Math.exp(-(dx * dx + dy * dy) / (w[3] * w[3]));
      const ca = Math.cos(a), sa = Math.sin(a);
      gx = w[0] + ca * dx - sa * dy; gy = w[1] + sa * dx + ca * dy;
    }
    return [gx, gy];
  }
  /** grid coords → screen (ignores swirls) */
  toScreen(gx: number, gy: number) {
    const v = this.view; const dx = gx - v.camX, dy = gy - v.camY;
    const c = Math.cos(-v.rot), s = Math.sin(-v.rot);
    return [(c * dx - s * dy) * v.cell + this.W / 2, (s * dx + c * dy) * v.cell + this.H / 2];
  }
  tileAt(gx: number, gy: number) {
    const i = ((Math.floor(gx) % N) + N) % N, j = ((Math.floor(gy) % M) + M) % M;
    return j * N + i;
  }
  static idx(i: number, j: number) { return (((j % M) + M) % M) * N + (((i % N) + N) % N); }
  static N = N; static M = M;

  angle(t: number) {
    const d = this.dur[t];
    const e = d <= 0 ? 1 : ease((this.now - this.t0[t]) / d);
    return this.kFrom[t] + (this.kTo[t] - this.kFrom[t]) * e + this.extra[t];
  }
  isTurning(t: number) { return this.now < this.t0[t] + this.dur[t]; }

  /** Turn a tile by `n` quarter-turns, starting after `delay` seconds. */
  turn(t: number, n = 1, delay = 0, dur = TURN) {
    const a = this.angle(t) - this.extra[t];
    this.kFrom[t] = a; this.kTo[t] = Math.round(a) + n;
    this.spinning[t] = n % 4 === 0 && Math.abs(a - Math.round(a)) < 0.004 ? 1 : 0;
    this.t0[t] = this.now + delay; this.dur[t] = this.reduced ? 0.0001 : dur;
    if (this.reduced) this.t0[t] = this.now - 1;
  }

  setAgent(t: number, on: boolean) { this.agentT[t] = on ? 1 : 0; this.dirtyTopo = true; }
  clearAgents() { this.agentT.fill(0); this.dirtyTopo = true; }

  /** Target orientation per tile for a pattern. */
  pattern(p: Pattern, seed: number, density = 0.5) {
    const r = rng(seed), k = new Int8Array(T);
    for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
      const t = j * N + i;
      if (p === 'lattice') k[t] = (i + j) % 2;
      else if (p === 'diagonal') k[t] = 0;
      else if (p === 'weave') k[t] = (Math.floor(i / 2) + Math.floor(j / 2)) % 2 === 0 ? (i + j) % 2 : r() < density ? 1 : 0;
      else k[t] = r() < density ? 1 : 0;
    }
    return k;
  }

  /** Reorganise the surface into a new pattern: every tile turns (from the centre outwards) to its new orientation. */
  morphTo(k: Int8Array, opts: { from?: [number, number]; spread?: number; instant?: boolean } = {}) {
    const [cx, cy] = opts.from ?? [this.view.camX, this.view.camY];
    const spread = opts.spread ?? 0.035;
    for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
      const t = j * N + i;
      // bake story turns into the base
      const cur = Math.round(this.angle(t));
      this.extra[t] = 0;
      const cur2 = ((cur % 2) + 2) % 2;
      let n = (k[t] - cur2 + 2) % 2;
      if (opts.instant) { this.kFrom[t] = this.kTo[t] = k[t]; this.dur[t] = 0; continue; }
      if (n === 0) { this.kFrom[t] = this.kTo[t] = cur; this.dur[t] = 0; continue; }
      let dx = Math.abs(i + 0.5 - cx), dy = Math.abs(j + 0.5 - cy);
      dx = Math.min(dx, N - dx); dy = Math.min(dy, M - dy);
      this.kFrom[t] = cur; this.kTo[t] = cur + n; this.spinning[t] = 0;
      this.t0[t] = this.now + Math.hypot(dx, dy) * spread + (i * 7 + j * 13) % 5 * 0.02;
      this.dur[t] = this.reduced ? 0.0001 : TURN;
      if (this.reduced) this.t0[t] = this.now - 1;
    }
    this.dirtyTopo = true;
  }

  apply(mode: Mode, opts: { instant?: boolean } = {}) {
    const k = this.pattern(mode.pattern, mode.seed, mode.density);
    this.morphTo(k, { instant: opts.instant });
    this.clearAgents();
    if (mode.agents) {
      const r = rng(mode.seed * 7 + 3);
      for (let a = 0; a < mode.agents; a++) this.setAgent(Math.floor(r() * T), true);
    }
    const cell = Math.max(mode.cell, this.minCell);
    Object.assign(this.viewT, { cell, w: mode.width ?? 0.16, fade: mode.fade ?? 0, rot: 0 });
    if (mode.cam) Object.assign(this.viewT, { camX: mode.cam[0], camY: mode.cam[1] });
    this.themeT = { ...THEMES[mode.theme] };
    this.ambient = this.reduced ? 0 : mode.ambient ?? 0.5;
    this.interactive = mode.interactive ?? true;
    this.pulseT = mode.pulse ?? 0.18;
    this.swirl[2] = 0;
    if (opts.instant) { Object.assign(this.view, this.viewT); this.theme = { ...this.themeT }; }
  }

  // ---------- interaction ----------
  move(e: PointerEvent) {
    const p = this.pointer;
    if (p.x >= 0) { p.vx = lerp(p.vx, e.clientX - p.x, 0.5); p.vy = lerp(p.vy, e.clientY - p.y, 0.5); }
    p.x = e.clientX; p.y = e.clientY; p.inside = true;
    if (!this.interactive || this.reduced || e.pointerType === 'touch') return;
    const [gx, gy] = this.toGrid(p.x, p.y);
    const t = this.tileAt(gx, gy);
    if (t !== p.lastTile) {
      p.lastTile = t;
      if (!this.isTurning(t)) this.turn(t, 1);
    }
  }
  click(e: MouseEvent) {
    if (!this.interactive) return;
    const el = e.target as HTMLElement;
    if (el.closest('a,button,input,textarea,select,label,[data-no-field]')) return;
    if (getSelection()?.toString()) return;
    const [gx, gy] = this.toGrid(e.clientX, e.clientY);
    const t = this.tileAt(gx, gy);
    this.setAgent(t, this.agentT[t] < 0.5);
  }

  // ---------- topology + colour ----------
  recompute() {
    const nodes = N * M * 2;
    const nodeArcs = new Int32Array(nodes * 2).fill(-1);
    const arcNodes = new Int32Array(T * 4).fill(-1);
    const side = (i: number, j: number, s: number) =>
      s === 0 ? N * M + j * N + i : s === 1 ? j * N + ((i + 1) % N) : s === 2 ? N * M + ((j + 1) % M) * N + i : j * N + i;
    for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
      const t = j * N + i, k = this.settled[t];
      if (k < 0) continue;
      for (const a of [0, 1] as const) {
        const [s0, s1] = arcSides(k, a);
        const n0 = side(i, j, s0), n1 = side(i, j, s1), arc = t * 2 + a;
        arcNodes[arc * 2] = n0; arcNodes[arc * 2 + 1] = n1;
        for (const nd of [n0, n1]) { if (nodeArcs[nd * 2] < 0) nodeArcs[nd * 2] = arc; else nodeArcs[nd * 2 + 1] = arc; }
      }
    }
    // phase 1: reachability from agents
    const reach = new Uint8Array(T * 2), queue = new Int32Array(T * 2);
    let qh = 0, qt = 0;
    for (let t = 0; t < T; t++) if (this.agentA[t] > 0.5 && this.settled[t] >= 0) for (const a of [0, 1]) { const arc = t * 2 + a; reach[arc] = 1; queue[qt++] = arc; }
    const sources = qt;
    while (qh < qt) {
      const arc = queue[qh++];
      for (let e = 0; e < 2; e++) {
        const nd = arcNodes[arc * 2 + e]; if (nd < 0) continue;
        for (let s = 0; s < 2; s++) { const b = nodeArcs[nd * 2 + s]; if (b >= 0 && !reach[b]) { reach[b] = 1; queue[qt++] = b; } }
      }
    }
    // phase 2: the colour front starts from arcs already lit (or agents) and walks into the newly reached ones
    const arrive = new Float32Array(T * 2).fill(-1);
    qh = 0; qt = 0;
    for (let arc = 0; arc < T * 2; arc++) {
      if (!reach[arc]) continue;
      const t = arc >> 1;
      if (this.lit[arc] || this.agentA[t] > 0.5) {
        if (!this.lit[arc]) { this.lit[arc] = 1; this.litT[arc] = this.now; this.entry[arc] = 0; }
        arrive[arc] = Math.max(this.now, this.litT[arc]); queue[qt++] = arc;
      }
    }
    while (qh < qt) {
      const arc = queue[qh++];
      for (let e = 0; e < 2; e++) {
        const nd = arcNodes[arc * 2 + e]; if (nd < 0) continue;
        for (let s = 0; s < 2; s++) {
          const b = nodeArcs[nd * 2 + s];
          if (b < 0 || b === arc || !reach[b] || arrive[b] >= 0) continue;
          arrive[b] = arrive[arc] + (this.reduced ? 0 : STEP);
          this.lit[b] = 1; this.litT[b] = arrive[b];
          this.entry[b] = arcNodes[b * 2] === nd ? 0 : 1;
          queue[qt++] = b;
        }
      }
    }
    void sources;
    // drain what lost its connection (turning tiles keep their state until they land)
    for (let arc = 0; arc < T * 2; arc++) {
      if (this.lit[arc] && !reach[arc] && this.settled[arc >> 1] >= 0) { this.lit[arc] = 0; this.unlitT[arc] = this.now; }
    }
    this.dirtyB = true;
  }

  litFraction() { let n = 0; for (let i = 0; i < T * 2; i++) n += this.lit[i]; return n / (T * 2); }

  // ---------- frame ----------
  loop() {
    cancelAnimationFrame(this.raf);
    if (!this.visible) return;
    this.raf = requestAnimationFrame(this.loop);
    this.frame();
  }

  frame() {
    const nowMs = performance.now();
    this.now = (nowMs - this.start) / 1000;
    const dt = Math.min(0.05, this.now - this.last || 0.016); this.last = this.now;
    this.onFrame?.(this);
    // view easing
    const k = this.reduced ? 1 : 1 - Math.exp(-dt * 4.5);
    const v = this.view, vt = this.viewT;
    for (const key of ['cell', 'camX', 'camY', 'rot', 'w', 'fade'] as const) v[key] = lerp(v[key], vt[key], key === 'fade' ? (this.reduced ? 1 : 1 - Math.exp(-dt * 7)) : k);
    for (const key of ['ground', 'loop', 'lit', 'agent'] as const) for (let c = 0; c < 3; c++) this.theme[key][c] = lerp(this.theme[key][c], this.themeT[key][c], this.reduced ? 1 : 1 - Math.exp(-dt * 3.5));
    // pointer stir: moving the pointer twists the plane around it (an isotopy; nothing is cut)
    const p = this.pointer;
    if (!this.reduced && p.inside && this.interactive) {
      const [gx, gy] = this.toGridNoStir(p.x, p.y);
      this.stir[0] = lerp(this.stir[0], gx, 0.35); this.stir[1] = lerp(this.stir[1], gy, 0.35);
      const speed = Math.hypot(p.vx, p.vy);
      this.stir[2] = lerp(this.stir[2], Math.min(1.1, speed * 0.018) * Math.sign(p.vx + 0.0001), 0.08);
      this.stir[3] = 150 / v.cell + 1.2;
    } else this.stir[2] *= 0.92;
    p.vx *= 0.9; p.vy *= 0.9;
    // ambient: random tiles spin a full turn (same connections before and after)
    if (this.ambient > 0) {
      const n = this.ambient * dt; let c = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
      while (c--) {
        const [gx, gy] = this.toGrid(Math.random() * this.W, Math.random() * this.H);
        const t = this.tileAt(gx, gy);
        if (!this.isTurning(t) && this.extra[t] === Math.round(this.extra[t])) this.turn(t, 4, 0, 1.6);
      }
    }
    // agents
    for (let t = 0; t < T; t++) {
      const a = this.agentA[t], target = this.agentT[t];
      if (a !== target) {
        const na = this.reduced ? target : Math.abs(target - a) < 0.01 ? target : lerp(a, target, 1 - Math.exp(-dt * 6));
        if ((a > 0.5) !== (na > 0.5)) this.dirtyTopo = true;
        this.agentA[t] = na;
      }
    }
    // tile angles + settled topology
    const A = this.dataA;
    for (let t = 0; t < T; t++) {
      const ang = this.angle(t);
      const r = Math.round(ang);
      let s = Math.abs(ang - r) < 0.004 ? (((r % 4) + 4) % 4) : -1;
      // a full spin keeps the tile's connections (and the colour flowing through it)
      if (s < 0 && this.spinning[t] && this.settled[t] >= 0 && Math.abs(this.extra[t] - Math.round(this.extra[t])) < 0.004) s = this.settled[t];
      if (s !== this.settled[t]) {
        this.dirtyTopo = true;
        this.settled[t] = s as number;
      }
      A[t * 4] = ang; A[t * 4 + 1] = this.agentA[t]; A[t * 4 + 2] = this.entry[t * 2] + 2 * this.entry[t * 2 + 1]; A[t * 4 + 3] = this.agentPhase[t];
    }
    if (this.dirtyTopo) {
      this.recompute(); this.dirtyTopo = false;
      for (let t = 0; t < T; t++) A[t * 4 + 2] = this.entry[t * 2] + 2 * this.entry[t * 2 + 1];
    }
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texA);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, M, gl.RGBA, gl.FLOAT, A);
    if (this.dirtyB) {
      const B = this.dataB;
      for (let t = 0; t < T; t++) { B[t * 4] = this.litT[t * 2]; B[t * 4 + 1] = this.unlitT[t * 2]; B[t * 4 + 2] = this.litT[t * 2 + 1]; B[t * 4 + 3] = this.unlitT[t * 2 + 1]; }
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texB);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, M, gl.RGBA, gl.FLOAT, B);
      this.dirtyB = false;
    }
    const u = this.u, th = this.theme;
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uScale, v.cell * this.dpr);
    gl.uniform2f(u.uCam, v.camX, v.camY);
    gl.uniform1f(u.uRot, v.rot);
    gl.uniform1f(u.uTime, this.now);
    gl.uniform1f(u.uStep, this.reduced ? 0.0001 : STEP);
    gl.uniform1f(u.uW, v.w);
    gl.uniform1f(u.uFade, v.fade);
    gl.uniform3fv(u.uGround, th.ground); gl.uniform3fv(u.uLoop, th.loop); gl.uniform3fv(u.uLit, th.lit); gl.uniform3fv(u.uAgent, th.agent);
    gl.uniform4fv(u.uSwirl, this.swirl); gl.uniform4fv(u.uStir, this.stir);
    this.pulse = lerp(this.pulse, this.reduced ? 0 : this.pulseT, 1 - Math.exp(-dt * 2));
    gl.uniform1f(u.uPulse, this.pulse);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  toGridNoStir(x: number, y: number) { const s = this.stir[2]; this.stir[2] = 0; const g = this.toGrid(x, y); this.stir[2] = s; return g; }
}
