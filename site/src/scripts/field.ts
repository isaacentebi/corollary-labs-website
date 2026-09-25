// The loop field: a toroidal surface of Truchet tiles rendered in one fragment shader.
// Tiles only ever turn. A turn is drawn as a morph that keeps every line attached to its neighbours
// (arcs straighten into a crossing, then bend the other way). Colour (the "lit" state) travels along
// connected arcs from agent tiles, so it spreads when turning tiles rewire the loops.
// Swirls deform the plane without cutting it. Content panels are painted by the shader on whole tiles.
import { arcSides, rng, components } from '../lib/truchet';

export type RGB = [number, number, number];
export type Theme = { ground: RGB; loop: RGB; lit: RGB; agent: RGB };
export const THEMES: Record<string, Theme> = {
  violet: { ground: hex('#22158a'), loop: hex('#3a2bb8'), lit: hex('#d8ff3c'), agent: hex('#d8ff3c') },
  deep: { ground: hex('#170f5e'), loop: hex('#2d2296'), lit: hex('#d8ff3c'), agent: hex('#d8ff3c') },
  paper: { ground: hex('#eeeaff'), loop: hex('#dcd4ff'), lit: hex('#3b27c4'), agent: hex('#3b27c4') },
};
function hex(h: string): RGB { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }

export type Pattern = 'lattice' | 'random' | 'diagonal' | 'mixed';
export interface Mode {
  pattern: Pattern; seed: number; density?: number;
  cell: number;            // CSS px per tile
  width?: number;          // stroke width, fraction of a tile
  theme: keyof typeof THEMES;
  agents?: number;         // number of agents to scatter
  ambient?: number;        // quarter-turns per second while the page is live
  interactive?: boolean;
  cam?: [number, number];
}

const N = 64, M = 64, T = N * M, MAXR = 24;
const STEP = 0.075;       // seconds per arc of the colour front
const TURN = 0.42;        // seconds per quarter-turn (morph)
const WAVE = 0.022;       // seconds per tile of distance (fallback)
const SWEEP = 1.1;        // seconds for a page wave to cross from the centre to a corner
const QUICK = 0.2;        // seconds per turn inside a page wave

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uA; uniform sampler2D uB;
uniform vec2 uRes; uniform float uScale; uniform vec2 uCam; uniform float uRot;
uniform float uTime; uniform float uStep; uniform float uW; uniform float uLive; uniform float uPulse;
uniform vec3 uT0[4]; uniform vec3 uT1[4]; uniform vec4 uWave;
uniform vec4 uSwirl; uniform vec4 uStir;
uniform vec4 uRects[${MAXR}]; uniform int uNR;
out vec4 o;
const vec2 G = vec2(${N}.0, ${M}.0);
const float PI = 3.14159265;
vec2 swirl(vec2 g, vec4 s){ vec2 d = g - s.xy; float a = s.z * exp(-dot(d,d)/(s.w*s.w)); float c = cos(a), n = sin(a); return s.xy + vec2(c*d.x - n*d.y, n*d.x + c*d.y); }
vec2 corner(int c){ return c == 0 ? vec2(0.) : c == 1 ? vec2(1.,0.) : c == 2 ? vec2(1.) : vec2(0.,1.); }
float arcD(vec2 f, int c){ return abs(length(f - corner(c)) - 0.5); }
// position along the arc on corner c: 0 at side c, 1 at side c-1
float arcU(vec2 f, int c){ vec2 d = f - corner(c); float ph = atan(d.y, d.x) / (2.0*PI); return clamp(fract(ph - float(c)/4.0) * 4.0, 0.0, 1.0); }
float fill(float litT, float unlitT, float entry, float u){
  if (unlitT > litT) { float g = clamp((uTime - unlitT)/0.45, 0.0, 1.0); return 1.0 - smoothstep(1.0 - g - 0.04, 1.0 - g, u); }
  float f = clamp((uTime - litT)/uStep, 0.0, 1.0);
  if (f <= 0.0) return 0.0;
  if (f >= 1.0) return 1.0;
  float uu = entry > 0.5 ? 1.0 - u : u;
  return 1.0 - smoothstep(f - 0.04, f, uu);
}
// a short bright band that travels along lit loops, away from the agents
float band(float litT, float entry, float u){
  float s = litT + (entry > 0.5 ? 1.0 - u : u) * uStep;
  float x = fract((uTime - s) / 2.4);
  return smoothstep(0.0, 0.012, x) * (1.0 - smoothstep(0.012, 0.06, x)) * uLive;
}
void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 g = (px - 0.5*uRes) / uScale;
  float cr = cos(uRot), sr = sin(uRot);
  g = vec2(cr*g.x - sr*g.y, sr*g.x + cr*g.y) + uCam;
  vec2 g0 = g;
  g = swirl(g, uSwirl); g = swirl(g, uStir);
  vec2 cid = floor(g); vec2 f = g - cid;
  ivec2 t = ivec2(mod(cid, G));
  vec4 A = texelFetch(uA, t, 0); vec4 B = texelFetch(uB, t, 0);
  // theme: changes tile by tile, as a wave from the page's centre
  float wm = step(uWave.x + length(floor(g0) + 0.5 - uWave.yz) * uWave.w, uTime);
  vec3 ground = mix(uT0[0], uT1[0], wm), loop = mix(uT0[1], uT1[1], wm), lit = mix(uT0[2], uT1[2], wm), agentC = mix(uT0[3], uT1[3], wm);
  // content panels: whole tiles of ground
  for (int i = 0; i < ${MAXR}; i++) {
    if (i >= uNR) break;
    vec4 r = uRects[i];
    if (g0.x >= r.x && g0.x < r.z && g0.y >= r.y && g0.y < r.w) { o = vec4(ground, 1.0); return; }
  }
  // morph between orientation k0 and k0+1
  float a = A.x; float k0 = floor(a + 0.0005); float m = clamp(a - k0, 0.0, 1.0);
  int c0 = int(mod(k0, 4.0));
  float dA0 = arcD(f, c0), dB0 = arcD(f, (c0 + 2) % 4), dA1 = arcD(f, (c0 + 1) % 4), dB1 = arcD(f, (c0 + 3) % 4);
  float w = sin(PI * m);
  float dPlus = min(abs(f.x - 0.5), abs(f.y - 0.5));
  float dAm = mix(dA0, dA1, m), dBm = mix(dB0, dB1, m);
  float dA = mix(dAm, dPlus, w), dB = mix(dBm, dPlus, w);
  bool isA = dAm <= dBm;
  float d = isA ? dA : dB;
  float px1 = length(fwidth(g));
  float pr = length(g - uCam);
  // stirring the plane thickens the lines it twists (colour stays either loop or acid)
  vec2 sd = g0 - uStir.xy;
  float wake = clamp(abs(uStir.z) / 1.6, 0.0, 1.0) * exp(-dot(sd, sd) / (uStir.w * uStir.w));
  float hw = 0.5 * uW * (1.0 + uPulse * sin(pr * 0.42 - uTime * 1.3)) * (1.0 + 0.7 * wake);
  float fe = 0.7 * min(fwidth(d), 1.5 * px1) + 1e-5;
  float cov = 1.0 - smoothstep(hw - fe, hw + fe, d);
  float ent = A.z; float eA = mod(ent, 2.0); float eB = floor(ent / 2.0);
  float lv, bd;
  if (m < 0.001) {
    float u = isA ? arcU(f, c0) : arcU(f, (c0 + 2) % 4);
    lv = isA ? fill(B.x, B.y, eA, u) : fill(B.z, B.w, eB, u);
    lv = step(0.5, lv);
    bd = lv > 0.99 ? (isA ? band(B.x, eA, u) : band(B.z, eB, u)) : 0.0;
  } else {
    lv = step(0.5, isA ? fill(B.x, B.y, eA, 0.5) : fill(B.z, B.w, eB, 0.5)); bd = 0.0;
  }
  vec3 line = mix(loop, lit, step(0.5, lv));
  line = mix(line, vec3(1.0), step(0.5, bd) * 0.8);
  vec3 col = mix(ground, line, cov);
  // agent: a disc at the centre of its tile, a halo of ground, and a slow ring while live
  float ag = A.y;
  if (ag > 0.001) {
    float r = length(f - 0.5);
    float aa = 0.75 * px1;
    float rd = 0.11 * ag;
    float halo = 1.0 - smoothstep(rd + 0.045 - aa, rd + 0.045 + aa, r);
    float disc = 1.0 - smoothstep(rd - aa, rd + aa, r);
    float ph = fract(uTime * 0.45 + A.w);
    float rr = 0.17 + ph * 0.3;
    float ring = (1.0 - smoothstep(0.016 - aa, 0.016 + aa, abs(r - rr))) * (1.0 - ph) * ag * uLive;
    col = mix(col, agentC, ring * 0.9);
    col = mix(col, ground, halo * ag);
    col = mix(col, agentC, disc);
  }
  o = vec4(col, 1.0);
}`;

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const copyTheme = (t: Theme): Theme => ({ ground: [...t.ground] as RGB, loop: [...t.loop] as RGB, lit: [...t.lit] as RGB, agent: [...t.agent] as RGB });

export class LoopField {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
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
  protect = new Uint8Array(T);            // tiles the ambient turns leave alone
  covered = new Uint8Array(T); coverKey = '';
  // arc state (2 per tile)
  lit = new Uint8Array(T * 2); litT = new Float32Array(T * 2).fill(1e9); unlitT = new Float32Array(T * 2).fill(-1e9);
  entry = new Uint8Array(T * 2);
  dirtyB = true; dirtyTopo = true; fillUntil = 0;
  // view (current + target)
  view = { cell: 40, camX: N / 2, camY: M / 2, rot: 0, w: 0.16 };
  viewT = { cell: 40, camX: N / 2, camY: M / 2, rot: 0, w: 0.16 };
  scrollPx: () => number = () => scrollY;   // the camera follows the page scroll (panels stay on the grid)
  camYe = M / 2;
  theme0: Theme = copyTheme(THEMES.violet); theme1: Theme = copyTheme(THEMES.violet);
  wave = [-100, N / 2, M / 2, WAVE];
  swirl = [0, 0, 0, 8]; stir = [0, 0, 0, 3];
  ambient = 0; interactive = true; alwaysLive = false; liveUntil = 0; liveA = 0;
  pulse = 0; pulseT = 0;
  rectEls: () => Element[] = () => [];
  rects = new Float32Array(MAXR * 4); nRects = 0;
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  start = performance.now(); now = 0; last = 0;
  W = 0; H = 0; dpr = 1;
  pointer = { x: -1, y: -1, vx: 0, vy: 0, inside: false, lastTile: -1, down: false };
  onFrame: ((f: LoopField) => void) | null = null;
  raf = 0; running = false; idle = 0; visible = true; keepAwake = false;

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
    gl.useProgram(p);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uA', 'uB', 'uRes', 'uScale', 'uCam', 'uRot', 'uTime', 'uStep', 'uW', 'uLive', 'uPulse', 'uT0', 'uT1', 'uWave', 'uSwirl', 'uStir', 'uRects', 'uNR']) this.u[n] = gl.getUniformLocation(p, n);
    const mk = (unit: number) => {
      const t = gl.createTexture()!; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, M, 0, gl.RGBA, gl.FLOAT, null);
      return t;
    };
    this.texA = mk(0); this.texB = mk(1);
    gl.uniform1i(this.u.uA, 0); gl.uniform1i(this.u.uB, 1);
    const r = rng(99); for (let i = 0; i < T; i++) this.agentPhase[i] = r();
    this.loop = this.loop.bind(this);
    this.resize();
    addEventListener('resize', () => { this.resize(); this.wake(); });
    addEventListener('scroll', () => this.wake(), { passive: true });
    addEventListener('pointermove', (e) => this.move(e), { passive: true });
    addEventListener('pointerdown', (e) => { this.pointer.down = true; this.pointer.x = e.clientX; this.pointer.y = e.clientY; });
    addEventListener('pointerup', () => { this.pointer.down = false; });
    document.addEventListener('pointerleave', () => { this.pointer.inside = false; this.wake(); });
    addEventListener('click', (e) => this.click(e));
    document.addEventListener('visibilitychange', () => { this.visible = !document.hidden; if (this.visible) this.wake(); });
    this.wake();
  }

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 2 : 1.75);
    this.W = innerWidth; this.H = innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr); this.canvas.height = Math.round(this.H * this.dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  /** Smallest tile size that hides the torus repeat. */
  get minCell() { return Math.max(this.W, this.H) / (N - 6); }
  /** seconds per tile so that a wave crosses the screen (centre → corner) in SWEEP seconds */
  spread() { return SWEEP / Math.max(4, Math.hypot(this.W, this.H) / 2 / this.viewT.cell); }
  waveDur = 0; themeChanged = false;
  get live() { return !this.reduced && (this.alwaysLive || this.now < this.liveUntil); }

  // ---------- geometry helpers ----------
  /** screen (CSS px) → grid coords before any swirl */
  toGrid0(x: number, y: number) {
    const v = this.view;
    const gx = (x - this.W / 2) / v.cell, gy = (y - this.H / 2) / v.cell;
    const c = Math.cos(v.rot), s = Math.sin(v.rot);
    return [c * gx - s * gy + v.camX, s * gx + c * gy + this.camYe];
  }
  /** screen (CSS px) → grid coords, same mapping as the shader */
  toGrid(x: number, y: number, withStir = true) {
    let [gx, gy] = this.toGrid0(x, y);
    for (const w of withStir ? [this.swirl, this.stir] : [this.swirl]) {
      const dx = gx - w[0], dy = gy - w[1], a = w[2] * Math.exp(-(dx * dx + dy * dy) / (w[3] * w[3]));
      const ca = Math.cos(a), sa = Math.sin(a);
      gx = w[0] + ca * dx - sa * dy; gy = w[1] + sa * dx + ca * dy;
    }
    return [gx, gy];
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
  /** the orientation the tile is heading to (0..3) */
  target(t: number) { return ((Math.round(this.kTo[t] + this.extra[t]) % 4) + 4) % 4; }
  isTurning(t: number) { return this.now < this.t0[t] + this.dur[t]; }

  /** Turn a tile by `n` quarter-turns, starting after `delay` seconds. */
  turn(t: number, n = 1, delay = 0, dur = TURN) {
    const a = this.angle(t) - this.extra[t];
    this.kFrom[t] = a; this.kTo[t] = Math.round(a) + n;
    this.t0[t] = this.now + delay; this.dur[t] = this.reduced ? 0.0001 : dur;
    if (this.reduced) this.t0[t] = this.now - 1;
    this.wake();
  }

  setAgent(t: number, on: boolean) { this.agentT[t] = on ? 1 : 0; this.dirtyTopo = true; this.wake(); }
  clearAgents() { this.agentT.fill(0); this.dirtyTopo = true; }

  /**
   * Which tiles near `t` should turn so that the agent's loop becomes as large as possible
   * (greedy, on a (2R+3)² patch of the current orientations). Returns [tile, dx, dy][].
   */
  plan(t: number, R = 2, k?: (t: number) => number): [number, number, number][] {
    const ti = t % N, tj = Math.floor(t / N), n = 2 * R + 3, o = R + 1;
    const orient = k ?? ((x: number) => this.target(x));
    const base: number[] = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) base.push(orient(LoopField.idx(ti + i - o, tj + j - o)));
    const flip = new Uint8Array(n * n);
    const size = () => {
      const kk = base.map((b, i) => b + flip[i]);
      const { comp, size } = components(n, n, kk);
      const c = o * n + o, a = comp[c * 2], b = comp[c * 2 + 1];
      return (size.get(a) || 0) + (a === b ? 6 : size.get(b) || 0);
    };
    let best = size();
    for (let pass = 0; pass < 4; pass++) {
      let improved = false;
      for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
        if (i === o && j === o) continue;
        const q = j * n + i;
        flip[q] ^= 1;
        const s = size();
        if (s > best) { best = s; improved = true; } else flip[q] ^= 1;
      }
      if (!improved) break;
    }
    const out: [number, number, number][] = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (flip[j * n + i]) out.push([LoopField.idx(ti + i - o, tj + j - o), i - o, j - o]);
    return out;
  }

  /** An agent enters at `t`: the tiles around it turn, one after another, so its loop grows. */
  enter(t: number, R = 2) {
    this.setAgent(t, true);
    const moves = this.plan(t, R).sort((a, b) => Math.hypot(a[1], a[2]) - Math.hypot(b[1], b[2]));
    moves.forEach(([q], i) => { if (!this.isTurning(q)) this.turn(q, 1, 0.25 + i * 0.09); });
  }

  /** Target orientation per tile for a pattern. */
  pattern(p: Pattern, seed: number, density = 0.5) {
    const r = rng(seed), k = new Int8Array(T);
    for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
      const t = j * N + i;
      if (p === 'lattice') k[t] = (i + j) % 2;
      else if (p === 'diagonal') k[t] = 0;
      else if (p === 'mixed') k[t] = r() < density ? (r() < 0.5 ? 1 : 0) : (i + j) % 2;
      else k[t] = r() < density ? 1 : 0;
    }
    return k;
  }

  /** Reorganise the surface into a new pattern: tiles turn (from the centre outwards) to their new orientation. */
  morphTo(k: Int8Array, opts: { from?: [number, number]; instant?: boolean } = {}) {
    const [cx, cy] = opts.from ?? [this.view.camX, this.camYe];
    for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
      const t = j * N + i;
      const cur = Math.round(this.angle(t));
      this.extra[t] = 0;
      const n = (k[t] - (((cur % 2) + 2) % 2) + 2) % 2;
      if (opts.instant) { this.kFrom[t] = this.kTo[t] = k[t]; this.dur[t] = 0; continue; }
      if (n === 0) { this.kFrom[t] = this.kTo[t] = cur; this.dur[t] = 0; continue; }
      let dx = Math.abs(i + 0.5 - cx), dy = Math.abs(j + 0.5 - cy);
      dx = Math.min(dx, N - dx); dy = Math.min(dy, M - dy);
      this.kFrom[t] = cur; this.kTo[t] = cur + n;
      // neighbours never start together: a checkerboard offset inside the wave
      this.t0[t] = this.now + Math.hypot(dx, dy) * this.spread() + ((i + j) % 2) * 0.1;
      this.dur[t] = this.reduced ? 0.0001 : QUICK;
      if (this.reduced) this.t0[t] = this.now - 1;
    }
    this.dirtyTopo = true;
  }

  apply(mode: Mode, opts: { instant?: boolean } = {}) {
    const cell = Math.max(mode.cell, this.minCell);
    this.viewT.cell = cell;
    if (mode.cam) Object.assign(this.viewT, { camX: mode.cam[0], camY: mode.cam[1] });
    Object.assign(this.viewT, { cell, w: mode.width ?? 0.16, rot: 0 });
    if (opts.instant) { Object.assign(this.view, this.viewT); }
    this.camYe = this.view.camY + this.scrollPx() / this.view.cell;
    const k = this.pattern(mode.pattern, mode.seed, mode.density);
    this.morphTo(k, { instant: opts.instant });
    this.clearAgents(); this.protect.fill(0);
    if (mode.agents) {
      const r = rng(mode.seed * 7 + 3);
      for (let a = 0; a < mode.agents; a++) this.setAgent(Math.floor(r() * T), true);
    }
    // colours change tile by tile, with the same wave as the turns
    const next = copyTheme(THEMES[mode.theme]);
    if (opts.instant || this.reduced) { this.theme0 = copyTheme(next); this.wave[0] = -100; }
    else {
      this.theme0 = this.theme1;
      const sp = this.spread() * 0.45;
      this.wave = [this.now, this.view.camX, this.camYe, sp];
      this.waveDur = SWEEP * 0.45 + 0.05;
    }
    this.themeChanged = next.ground.join() !== this.theme1.ground.join();
    this.theme1 = next;
    this.ambient = this.reduced ? 0 : mode.ambient ?? 0;
    this.interactive = mode.interactive ?? true;
    this.pulseT = 0; this.alwaysLive = false;
    this.swirl[2] = 0;
    this.wake();
  }

  // ---------- interaction ----------
  move(e: PointerEvent) {
    const p = this.pointer;
    if (p.x >= 0) { p.vx = lerp(p.vx, e.clientX - p.x, 0.5); p.vy = lerp(p.vy, e.clientY - p.y, 0.5); }
    p.x = e.clientX; p.y = e.clientY; p.inside = true;
    if (!this.interactive || this.reduced) return;
    this.liveUntil = this.now + 3;
    this.wake();
    if (e.pointerType === 'touch' && !p.down) return;
    const [gx, gy] = this.toGrid(p.x, p.y);
    const t = this.tileAt(gx, gy);
    if (t !== p.lastTile) {
      p.lastTile = t;
      if (!this.isTurning(t) && !this.overPanel(p.x, p.y)) this.turn(t, 1);
    }
  }
  overPanel(x: number, y: number) {
    const [gx, gy] = this.toGrid0(x, y);
    for (let i = 0; i < this.nRects; i++) {
      const r = this.rects;
      if (gx >= r[i * 4] && gx < r[i * 4 + 2] && gy >= r[i * 4 + 1] && gy < r[i * 4 + 3]) return true;
    }
    return false;
  }
  click(e: MouseEvent) {
    if (!this.interactive) return;
    const el = e.target as HTMLElement;
    if (el.closest('a,button,input,textarea,select,label,.cut,.top,[data-no-field]')) return;
    if (getSelection()?.toString()) return;
    const [gx, gy] = this.toGrid(e.clientX, e.clientY);
    const t = this.tileAt(gx, gy);
    if (this.agentT[t] > 0.5) this.setAgent(t, false); else this.enter(t);
    this.liveUntil = this.now + 4;
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
      if (k < 0 || this.covered[t]) continue;
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
    for (let t = 0; t < T; t++) if (this.agentA[t] > 0.5 && this.settled[t] >= 0 && !this.covered[t]) for (const a of [0, 1]) { const arc = t * 2 + a; reach[arc] = 1; queue[qt++] = arc; }
    while (qh < qt) {
      const arc = queue[qh++];
      for (let e = 0; e < 2; e++) {
        const nd = arcNodes[arc * 2 + e]; if (nd < 0) continue;
        for (let s = 0; s < 2; s++) { const b = nodeArcs[nd * 2 + s]; if (b >= 0 && !reach[b]) { reach[b] = 1; queue[qt++] = b; } }
      }
    }
    // phase 2: the colour front starts from arcs already lit (or agents) and walks into the newly reached ones
    const arrive = new Float32Array(T * 2).fill(-1), depth = new Float32Array(T * 2);
    qh = 0; qt = 0;
    for (let arc = 0; arc < T * 2; arc++) {
      if (!reach[arc]) continue;
      const t = arc >> 1;
      if (this.lit[arc] || this.agentA[t] > 0.5) {
        if (!this.lit[arc]) { this.lit[arc] = 1; this.litT[arc] = this.now; this.entry[arc] = 0; }
        arrive[arc] = Math.max(this.now, this.litT[arc]); queue[qt++] = arc;
      }
    }
    let until = this.now;
    while (qh < qt) {
      const arc = queue[qh++];
      for (let e = 0; e < 2; e++) {
        const nd = arcNodes[arc * 2 + e]; if (nd < 0) continue;
        for (let s = 0; s < 2; s++) {
          const b = nodeArcs[nd * 2 + s];
          if (b < 0 || b === arc || !reach[b] || arrive[b] >= 0) continue;
          // the front starts at STEP per arc and speeds up with distance, so any loop fills within ~3 s
          depth[b] = depth[arc] + 1;
          arrive[b] = arrive[arc] + (this.reduced ? 0 : STEP * Math.exp(-depth[arc] * STEP / 2.6));
          if (!this.lit[b] || this.unlitT[b] > this.litT[b]) {
            this.lit[b] = 1; this.litT[b] = arrive[b];
            this.entry[b] = arcNodes[b * 2] === nd ? 0 : 1;
            until = Math.max(until, arrive[b] + STEP);
          }
          queue[qt++] = b;
        }
      }
    }
    // drain what lost its connection (turning tiles keep their state until they land)
    for (let arc = 0; arc < T * 2; arc++) {
      if (this.lit[arc] && !reach[arc] && (this.settled[arc >> 1] >= 0 || this.covered[arc >> 1])) { this.lit[arc] = 0; this.unlitT[arc] = this.now; until = Math.max(until, this.now + 0.5); }
    }
    this.fillUntil = Math.max(this.fillUntil, until);
    this.dirtyB = true;
  }

  litFraction() { let n = 0; for (let i = 0; i < T * 2; i++) n += this.lit[i]; return n / (T * 2); }

  // ---------- frame (on demand) ----------
  wake() {
    this.idle = 0;
    if (this.running || !this.visible) return;
    this.running = true;
    this.raf = requestAnimationFrame(this.loop);
  }
  loop() {
    if (!this.visible) { this.running = false; return; }
    const busy = this.frame();
    this.idle = busy ? 0 : this.idle + 1;
    if (this.idle > 3) { this.running = false; return; }
    this.raf = requestAnimationFrame(this.loop);
  }

  measureRects() {
    const els = this.rectEls();
    let n = 0;
    const v = this.view;
    if (Math.abs(v.rot) < 0.002) for (const el of els) {
      if (n >= MAXR) break;
      const b = el.getBoundingClientRect();
      if (b.bottom < -40 || b.top > this.H + 40 || b.width === 0) continue;
      const out = (el as HTMLElement).dataset.snap === 'out';
      const [x0, y0] = this.toGrid0(b.left, b.top), [x1, y1] = this.toGrid0(b.right, b.bottom);
      const s0 = out ? Math.floor : Math.round, s1 = out ? Math.ceil : Math.round;
      let a = s0(x0), c = s1(x1), bb = s0(y0), d = s1(y1);
      if (c <= a) c = a + 1; if (d <= bb) d = bb + 1;
      this.rects.set([a, bb, c, d], n * 4); n++;
    }
    this.nRects = n;
    // which tiles are fully under a panel (only the visible range matters)
    const [vx0, vy0] = this.toGrid0(0, 0), [vx1, vy1] = this.toGrid0(this.W, this.H);
    let key = '';
    const parts: number[][] = [];
    for (let r = 0; r < n; r++) {
      const a = Math.max(this.rects[r * 4], Math.floor(vx0) - 1), b = Math.max(this.rects[r * 4 + 1], Math.floor(vy0) - 1);
      const c = Math.min(this.rects[r * 4 + 2], Math.ceil(vx1) + 1), d = Math.min(this.rects[r * 4 + 3], Math.ceil(vy1) + 1);
      if (c > a && d > b) { parts.push([a, b, c, d]); key += `${a},${b},${c},${d};`; }
    }
    if (key !== this.coverKey) {
      this.coverKey = key; this.covered.fill(0);
      for (const [a, b, c, d] of parts) for (let j = b; j < d; j++) for (let i = a; i < c; i++) this.covered[LoopField.idx(i, j)] = 1;
      this.dirtyTopo = true;
    }
  }

  frame(): boolean {
    const nowMs = performance.now();
    this.now = (nowMs - this.start) / 1000;
    const dt = Math.min(0.05, this.now - this.last || 0.016); this.last = this.now;
    let busy = false;
    this.keepAwake = false;
    this.onFrame?.(this);
    if (this.keepAwake) busy = true;
    // view easing
    const k = this.reduced ? 1 : 1 - Math.exp(-dt * 4.5);
    const v = this.view, vt = this.viewT;
    for (const key of ['cell', 'camX', 'camY', 'rot', 'w'] as const) {
      const d = vt[key] - v[key];
      if (Math.abs(d) > (key === 'cell' ? 0.01 : 0.0005)) { v[key] += d * k; busy = true; } else v[key] = vt[key];
    }
    this.camYe = v.camY + this.scrollPx() / v.cell;
    if (this.now < this.wave[0] + 2.2) busy = true;
    const live = this.live;
    this.liveA = lerp(this.liveA, live ? 1 : 0, 1 - Math.exp(-dt * 4));
    if (live || this.liveA > 0.01) busy = true;
    // pointer stir: moving (or dragging) the pointer twists the plane around it
    const p = this.pointer;
    if (!this.reduced && p.inside && this.interactive) {
      const [gx, gy] = this.toGrid(p.x, p.y, false);
      this.stir[0] = lerp(this.stir[0], gx, 0.3); this.stir[1] = lerp(this.stir[1], gy, 0.3);
      const speed = Math.hypot(p.vx, p.vy);
      const max = p.down ? 2.4 : 1.1, gain = p.down ? 0.04 : 0.016;
      const target = Math.min(max, speed * gain) * Math.sign(p.vx - p.vy + 0.0001);
      if (Math.abs(target) > Math.abs(this.stir[2])) this.stir[2] = lerp(this.stir[2], target, p.down ? 0.2 : 0.08);
      else this.stir[2] *= Math.exp(-dt * 1.6);
      this.stir[3] = (p.down ? 230 : 150) / v.cell + 1.2;
    } else this.stir[2] *= Math.exp(-dt * 1.6);
    if (Math.abs(this.stir[2]) > 0.003) busy = true; else this.stir[2] = 0;
    p.vx *= 0.9; p.vy *= 0.9;
    // ambient: while live, a tile somewhere in view makes a quarter-turn every few hundred ms
    if (live && this.ambient > 0) {
      const n = this.ambient * dt; let c = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
      while (c--) {
        const [gx, gy] = this.toGrid(Math.random() * this.W, Math.random() * this.H);
        const t = this.tileAt(gx, gy);
        if (!this.isTurning(t) && !this.protect[t] && this.agentT[t] < 0.5 && this.extra[t] === Math.round(this.extra[t])) this.turn(t, 1);
      }
    }
    // agents
    for (let t = 0; t < T; t++) {
      const a = this.agentA[t], target = this.agentT[t];
      if (a !== target) {
        const na = this.reduced ? target : Math.abs(target - a) < 0.01 ? target : lerp(a, target, 1 - Math.exp(-dt * 6));
        if ((a > 0.5) !== (na > 0.5)) this.dirtyTopo = true;
        this.agentA[t] = na; busy = true;
      }
    }
    this.measureRects();
    // tile angles + settled topology
    const A = this.dataA;
    for (let t = 0; t < T; t++) {
      const ang = this.angle(t);
      const r = Math.round(ang);
      const s = Math.abs(ang - r) < 0.004 ? (((r % 4) + 4) % 4) : -1;
      if (s < 0) busy = true;
      if (s !== this.settled[t]) { this.dirtyTopo = true; this.settled[t] = s; }
      if (this.isTurning(t) || this.now < this.t0[t]) busy = true;
      A[t * 4] = s >= 0 ? r : ang; A[t * 4 + 1] = this.agentA[t]; A[t * 4 + 2] = this.entry[t * 2] + 2 * this.entry[t * 2 + 1]; A[t * 4 + 3] = this.agentPhase[t];
    }
    if (this.dirtyTopo) {
      this.recompute(); this.dirtyTopo = false;
      for (let t = 0; t < T; t++) A[t * 4 + 2] = this.entry[t * 2] + 2 * this.entry[t * 2 + 1];
    }
    if (this.now < this.fillUntil) busy = true;
    this.pulse = lerp(this.pulse, live ? this.pulseT : 0, 1 - Math.exp(-dt * 2));
    this.draw();
    return busy;
  }

  draw() {
    const gl = this.gl, v = this.view, u = this.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texA);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, M, gl.RGBA, gl.FLOAT, this.dataA);
    if (this.dirtyB) {
      const B = this.dataB;
      for (let t = 0; t < T; t++) { B[t * 4] = this.litT[t * 2]; B[t * 4 + 1] = this.unlitT[t * 2]; B[t * 4 + 2] = this.litT[t * 2 + 1]; B[t * 4 + 3] = this.unlitT[t * 2 + 1]; }
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texB);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, M, gl.RGBA, gl.FLOAT, B);
      this.dirtyB = false;
    }
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uScale, v.cell * this.dpr);
    gl.uniform2f(u.uCam, v.camX, this.camYe);
    gl.uniform1f(u.uRot, v.rot);
    gl.uniform1f(u.uTime, this.now);
    gl.uniform1f(u.uStep, this.reduced ? 0.0001 : STEP);
    gl.uniform1f(u.uW, v.w);
    gl.uniform1f(u.uLive, this.liveA);
    gl.uniform1f(u.uPulse, this.pulse);
    const flat = (t: Theme) => [...t.ground, ...t.loop, ...t.lit, ...t.agent];
    gl.uniform3fv(u.uT0, flat(this.theme0)); gl.uniform3fv(u.uT1, flat(this.theme1));
    gl.uniform4fv(u.uWave, this.wave);
    gl.uniform4fv(u.uSwirl, this.swirl); gl.uniform4fv(u.uStir, this.stir);
    gl.uniform4fv(u.uRects, this.rects); gl.uniform1i(u.uNR, this.nRects);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
