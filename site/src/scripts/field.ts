// The diffusion field — Corollary Labs' native motif.
// A population of nodes on an old rectilinear lattice. Adoption spreads from seeds along neighbour
// links (innovation p + imitation q · adopted-neighbour share, with resistant pockets). Adoption
// times are precomputed once, so any time t can be rendered (scroll-reversible). As the front
// passes, lattice segments dissolve and the new network (who-adopted-from-whom) grows in.
// The pointer is a local accelerator; the whole thing drifts so it is never static.

import { sampleWord, loadWordFonts } from './wordmask';

type Mode = 'auto' | 'progress';
export interface FieldOptions {
  mode?: Mode;
  spacing?: number; // px between nodes
  seeds?: Array<[number, number]>; // normalised positions
  autoSpeed?: number; // t per second in auto mode
  autoMax?: number;
  staticT?: number; // t for reduced motion
  curve?: false | 'bottom' | 'full'; // draw aggregate adoption curve overlay
  lattice?: number; // lattice cell = spacing * lattice
  seed?: number;
  pointer?: boolean;
  label?: boolean;
  curveRect?: [number, number, number, number] | null; // x, y(bottom), w, h as fractions
  word?: boolean; // the name lives in the field, revealed by the cursor's heat trail
  wordLayout?: import('./wordmask').WordLayout;
  wordBase?: number; // resting visibility of the word
  global?: boolean; // listen to the pointer on window (for a fixed full-screen stage behind content)
  sleepAfter?: number; // seconds of stillness after which the loop stops (0 = never); pointer/click wakes it
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; };
}

export class DiffusionField {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  o: Required<FieldOptions>;
  w = 0; h = 0; dpr = 1;
  nx: Float32Array = new Float32Array(); ny: Float32Array = new Float32Array();
  T: Float32Array = new Float32Array(); parent: Int32Array = new Int32Array(); phase: Float32Array = new Float32Array();
  n = 0;
  segs: Float32Array = new Float32Array(); segT: Float32Array = new Float32Array(); nseg = 0;
  sortedT: Float32Array = new Float32Array();
  t = 0.05; target = 0.05; clock = 0;
  px = -1e4; py = -1e4; pEnergy = 0; pBoost: Float32Array = new Float32Array();
  running = false; visible = false; raf = 0; last = 0;
  colors = { ink: '#0d0d0c', ink3: '#8e8e86', rule: '#d9d9d3', signal: '#00a15c', paper: '#fafaf8', ink2: '#56564f' };
  io?: IntersectionObserver; ro?: ResizeObserver;
  onFrame?: (f: DiffusionField) => void;
  static reduced = false;
  // name layer
  wp: Float32Array = new Float32Array(); wl: Uint32Array = new Uint32Array(); wph: Float32Array = new Float32Array(); wstep = 4;
  heat: Float32Array = new Float32Array(); dheat: Float32Array = new Float32Array(); hc = 0; hr = 0; HC = 22;
  base = 0; // faint permanent presence of the name
  // scene controls (home): rupture turbulence, re-knit into a new lattice, camera, click pulses
  camFocus: [number, number] | null = null; camTo: [number, number] | null = null;
  storm = 0; settle = 0; camScale = 1; camRot = 0; wordMul = 1; kick = 0;
  cols = 0; rows = 0; sp = 26;
  tx: Float32Array = new Float32Array(); ty: Float32Array = new Float32Array(); hex: Uint32Array = new Uint32Array(); hexFresh: Uint8Array = new Uint8Array();
  pulses: Array<{ x: number; y: number; t0: number }> = []; pulseB: Float32Array = new Float32Array();
  enabled = true; // the owner can hold the loop off while the canvas is hidden
  reveal = 0; sweep = -1; // intro: full name at `reveal`, dissolving left→right behind `sweep` (px)

  constructor(canvas: HTMLCanvasElement, opts: FieldOptions = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.o = {
      mode: 'auto', spacing: 26, seeds: [[0.18, 0.62], [0.52, 0.3], [0.8, 0.72]], autoSpeed: 0.012, autoMax: 0.24,
      staticT: 0.35, curve: false, lattice: 4, seed: 7, pointer: true, label: false, curveRect: null, word: false, wordLayout: {}, wordBase: 0.2, global: false, sleepAfter: 0, ...opts,
    } as Required<FieldOptions>;
    this.colors = { ink: css('--ink'), ink3: css('--ink-3'), rule: css('--rule'), signal: css('--signal'), paper: css('--paper'), ink2: css('--ink-2') };
    this.build();
    this.ro = new ResizeObserver(() => { const r = canvas.getBoundingClientRect(); if (Math.abs(r.width - this.w) > 2 || Math.abs(r.height - this.h) > 2) { this.build(); this.draw(); } });
    this.ro.observe(canvas);
    this.io = new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; this.visible ? this.start() : this.stop(); }, { rootMargin: '10% 0px' });
    this.io.observe(canvas);
    if (this.o.pointer) {
      const host: any = this.o.global ? window : canvas.parentElement || canvas;
      host.addEventListener('pointermove', this.onPointer, { passive: true });
      host.addEventListener(this.o.global ? 'blur' : 'pointerleave', this.onLeave, { passive: true });
      if (this.o.global) { addEventListener('pointerdown', this.onDown); document.addEventListener('mouseleave', this.onLeave); }
    }
    if (DiffusionField.reduced) { this.t = this.target = this.o.staticT; this.draw(); }
  }

  onPointer = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    const nx = e.clientX - r.left, ny = e.clientY - r.top;
    const d = Math.hypot(nx - this.px, ny - this.py);
    this.px = nx; this.py = ny;
    this.pEnergy = Math.min(1, this.pEnergy + (isFinite(d) ? d / 400 : 0));
    this.idle = 0;
    if (!this.running && this.visible) this.start();
    if (this.o.word && isFinite(d)) this.addHeat(nx, ny, Math.min(0.5, 0.06 + d / 120));
  };
  idle = 99;
  onLeave = () => { this.px = -1e4; this.py = -1e4; };
  onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement)?.closest?.('a, button, input, textarea, [data-no-seed]')) return;
    const r = this.canvas.getBoundingClientRect();
    this.seedAt(e.clientX - r.left, e.clientY - r.top);
  };
  /** plant a seed: a wave of adoption + a shockwave ripple through the structure */
  seedAt(x: number, y: number) {
    this.pulses.push({ x, y, t0: this.clock });
    if (this.pulses.length > 6) this.pulses.shift();
    this.kick = 1;
    if (this.o.word) this.addHeat(x, y, 0.8);
    if (!this.running && this.visible) this.start();
  }

  build() {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    const rand = rng(this.o.seed);
    let s = this.o.spacing;
    // keep node count bounded
    while ((this.w / s) * (this.h / s) > 2600) s *= 1.12;
    const cols = Math.ceil(this.w / s) + 1, rows = Math.ceil(this.h / s) + 1;
    const N = cols * rows;
    const nx = new Float32Array(N), ny = new Float32Array(N);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      nx[k] = (i + 0.5 + (rand() - 0.5) * 0.72) * s - s * 0.5;
      ny[k] = (j + 0.5 + (rand() - 0.5) * 0.72) * s - s * 0.5;
    }
    // neighbours: grid adjacency (8-neighbourhood) — cheap and stable
    const nb = (k: number) => {
      const i = k % cols, j = (k / cols) | 0, out: number[] = [];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = i + di, b = j + dj;
        if (a >= 0 && b >= 0 && a < cols && b < rows) out.push(b * cols + a);
      }
      return out;
    };
    // resistance pockets: the future arrives unevenly
    const pockets = Array.from({ length: 4 }, () => [rand() * this.w, rand() * this.h, (0.12 + rand() * 0.16) * Math.max(this.w, this.h)]);
    const resist = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      let r0 = 1;
      for (const [px, py, pr] of pockets) { const d = Math.hypot(nx[k] - px, ny[k] - py); if (d < pr) r0 = Math.min(r0, 0.18 + 0.82 * (d / pr) ** 2); }
      resist[k] = r0;
    }
    // simulate (discrete Bass-like process on the lattice graph)
    const T = new Float32Array(N).fill(Infinity), parent = new Int32Array(N).fill(-1);
    const seeds = this.o.seeds.map(([sx, sy]) => {
      const i = Math.min(cols - 1, Math.max(0, Math.round(sx * (cols - 1)))), j = Math.min(rows - 1, Math.max(0, Math.round(sy * (rows - 1))));
      return j * cols + i;
    });
    seeds.forEach((k, i) => (T[k] = i * 2));
    const p = 0.00025, q = 0.34;
    let adopted = seeds.length, step = 0;
    const nbs: number[][] = Array.from({ length: N }, (_, k) => nb(k));
    while (adopted < N && step < 900) {
      step++;
      const newly: Array<[number, number]> = [];
      for (let k = 0; k < N; k++) {
        if (T[k] !== Infinity) continue;
        const ns = nbs[k];
        let a = 0, from = -1;
        for (const m of ns) if (T[m] < step) { a++; if (from < 0 || rand() < 0.4) from = m; }
        const hazard = (p + q * (a / ns.length)) * resist[k];
        if (rand() < hazard) newly.push([k, from]);
      }
      for (const [k, from] of newly) { T[k] = step + rand(); parent[k] = from; adopted++; }
    }
    // normalise to [0,1] using the 99th percentile
    const sorted = Float32Array.from(T).map((v) => (isFinite(v) ? v : step + 1)).sort();
    const tmax = sorted[Math.floor(N * 0.99)] || 1;
    for (let k = 0; k < N; k++) T[k] = (isFinite(T[k]) ? T[k] : step + 1) / tmax;
    this.sortedT = Float32Array.from(T).sort();
    this.nx = nx; this.ny = ny; this.T = T; this.parent = parent; this.n = N;
    this.phase = Float32Array.from({ length: N }, () => rand() * Math.PI * 2);
    this.pBoost = new Float32Array(N);
    // lattice (old structure): segments + their dissolve time (median T of nodes nearby)
    const L = s * this.o.lattice;
    const segs: number[] = [], segT: number[] = [];
    const tNear = (x: number, y: number) => {
      const i = Math.round(x / s), j = Math.round(y / s), vals: number[] = [];
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < cols && b < rows) vals.push(T[b * cols + a]);
      }
      vals.sort((a, b) => a - b); return vals[(vals.length / 2) | 0] ?? 1;
    };
    for (let y = L * 0.5; y < this.h + L; y += L) for (let x = L * 0.5; x < this.w + L; x += L) {
      segs.push(x, y, x + L, y); segT.push(tNear(x + L / 2, y));
      segs.push(x, y, x, y + L); segT.push(tNear(x, y + L / 2));
    }
    this.segs = Float32Array.from(segs); this.segT = Float32Array.from(segT); this.nseg = segT.length;
    // the new order: a rotated hexagonal lattice every node will re-knit into
    this.cols = cols; this.rows = rows; this.sp = s;
    const tx = new Float32Array(N), ty = new Float32Array(N), cx = this.w / 2, cy = this.h / 2, rot = -0.14, hs = s * 1.12;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i, x = (i - cols / 2 + (j % 2) * 0.5) * hs, y = (j - rows / 2) * hs * 0.866;
      const cover = 1.28; tx[k] = cx + (x * Math.cos(rot) - y * Math.sin(rot)) * cover; ty[k] = cy + (x * Math.sin(rot) + y * Math.cos(rot)) * cover;
    }
    const hx: number[] = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      if (i < cols - 1) hx.push(k, k + 1);
      if (j < rows - 1) { hx.push(k, k + cols); const d = j % 2 ? i + 1 : i - 1; if (d >= 0 && d < cols) hx.push(k, (j + 1) * cols + d); }
    }
    this.tx = tx; this.ty = ty; this.hex = Uint32Array.from(hx);
    this.hexFresh = Uint8Array.from({ length: hx.length / 2 }, () => (rand() < 0.14 ? 1 : 0));
    this.pulseB = new Float32Array(N);
    if (this.o.word) { const seed = this.o.seed; loadWordFonts().then(() => this.buildWord(rng(seed + 99))); }
  }

  buildWord(rand: () => number) {
    const { pts, step } = sampleWord(this.w, this.h, this.o.wordLayout);
    this.wp = pts; this.wstep = step;
    const n = pts.length / 2, links: number[] = [];
    // sparse links to a near neighbour: the letters read as a small network, not as a font
    const cell = new Map<number, number[]>(), key = (x: number, y: number) => Math.floor(y / (step * 2)) * 100000 + Math.floor(x / (step * 2));
    for (let i = 0; i < n; i++) { const k = key(pts[i * 2], pts[i * 2 + 1]); (cell.get(k) || cell.set(k, []).get(k)!).push(i); }
    for (let i = 0; i < n; i++) {
      if (rand() > 0.42) continue;
      const x = pts[i * 2], y = pts[i * 2 + 1], cx = Math.floor(x / (step * 2)), cy = Math.floor(y / (step * 2));
      let best = -1, bd = 1e9;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const j of cell.get((cy + dy) * 100000 + cx + dx) || []) {
        if (j === i) continue; const d = (pts[j * 2] - x) ** 2 + (pts[j * 2 + 1] - y) ** 2;
        if (d > step * step * 0.8 && d < step * step * 9 && d < bd && rand() < 0.7) { bd = d; best = j; }
      }
      if (best >= 0) links.push(i, best);
    }
    this.wl = Uint32Array.from(links);
    this.wph = Float32Array.from({ length: n }, () => rand() * Math.PI * 2);
    this.hc = Math.ceil(this.w / this.HC) + 1; this.hr = Math.ceil(this.h / this.HC) + 1;
    this.heat = new Float32Array(this.hc * this.hr); this.dheat = new Float32Array(this.hc * this.hr);
  }

  /** deposit heat along the pointer path (gaussian, r ≈ 150px) */
  addHeat(x: number, y: number, amt: number) {
    const r = 190, HC = this.HC, ci = Math.round(x / HC), cj = Math.round(y / HC), rc = Math.ceil(r / HC);
    for (let j = cj - rc; j <= cj + rc; j++) for (let i = ci - rc; i <= ci + rc; i++) {
      if (i < 0 || j < 0 || i >= this.hc || j >= this.hr) continue;
      const d2 = (i * HC - x) ** 2 + (j * HC - y) ** 2; if (d2 > r * r) continue;
      const k = j * this.hc + i, v = amt * Math.exp(-d2 / (r * r * 0.28));
      this.heat[k] = Math.min(1, this.heat[k] + v); this.dheat[k] = Math.max(this.dheat[k], v);
    }
  }

  drawWord(dt: number) {
    const { ctx, colors } = this, n = this.wp.length / 2; if (!n) return;
    // heat decays (≈1.6 s half-life feel)
    const dec = Math.exp(-dt * 0.6), ddec = Math.exp(-dt * 6);
    for (let k = 0; k < this.heat.length; k++) { this.heat[k] *= dec; this.dheat[k] *= ddec; }
    const P = this.wp, clk = this.clock, HC = this.HC, hc = this.hc;
    const alpha = new Float32Array(n), hot = new Uint8Array(n);
    let any = false;
    for (let i = 0; i < n; i++) {
      const x = P[i * 2], y = P[i * 2 + 1], k = Math.min(this.heat.length - 1, Math.round(y / HC) * hc + Math.round(x / HC));
      let a = Math.max(this.heat[k] * 1.3, this.base);
      if (this.reveal > 0) { const sw = this.sweep < 0 ? 1 : Math.min(1, Math.max(0, (x - this.sweep) / 220)); a = Math.max(a, this.reveal * sw); }
      a = Math.min(1, a) * this.wordMul;
      alpha[i] = a; if (a > 0.03) any = true;
      if (this.dheat[k] > 0.02 && a > 0.15 && a < 0.8) hot[i] = 1;
      if (this.sweep >= 0 && this.reveal > 0 && x > this.sweep - 30 && x < this.sweep + 40) hot[i] = 1;
    }
    if (!any) return;
    // links
    const lb = [new Path2D(), new Path2D(), new Path2D()];
    for (let q = 0; q < this.wl.length; q += 2) {
      const a = this.wl[q], b = this.wl[q + 1], al = Math.min(alpha[a], alpha[b]); if (al < 0.08) continue;
      const bi = Math.min(2, (al * 3) | 0);
      lb[bi].moveTo(P[a * 2], P[a * 2 + 1]); lb[bi].lineTo(P[b * 2], P[b * 2 + 1]);
    }
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 0.8;
    lb.forEach((p, i) => { ctx.globalAlpha = 0.18 + i * 0.16; ctx.stroke(p); });
    // points (drift a little; unrevealed ones are simply absent)
    const s = Math.max(1.6, this.wstep * 0.5);
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? colors.signal : colors.ink;
      for (let i = 0; i < n; i++) {
        const a = alpha[i]; if (a < 0.03 || (pass === 1) !== !!hot[i]) continue;
        ctx.globalAlpha = pass ? 1 : a;
        const j = (1 - a) * 5, ph = this.wph[i];
        ctx.fillRect(P[i * 2] + Math.cos(clk * 1.4 + ph) * j - s / 2, P[i * 2 + 1] + Math.sin(clk * 1.2 + ph) * j - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** the node nearest to (x, y) in canvas space */
  nearest(x: number, y: number) {
    let best = 0, bd = 1e12;
    for (let k = 0; k < this.n; k++) { const d = (this.nx[k] - x) ** 2 + (this.ny[k] - y) ** 2; if (d < bd) { bd = d; best = k; } }
    return { k: best, x: this.nx[best], y: this.ny[best] };
  }

  /** Share adopted at time t (0..1). */
  share(t = this.t) {
    const a = this.sortedT; let lo = 0, hi = a.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= t) lo = m + 1; else hi = m; }
    return lo / a.length;
  }

  setProgress(t: number) { this.target = t; if (DiffusionField.reduced) { this.t = this.o.staticT; this.draw(); } else if (!this.running && this.visible) this.start(); }

  start() {
    if (this.running || DiffusionField.reduced || !this.enabled) return;
    this.running = true; this.last = performance.now(); this.idle = 0;
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.clock += dt;
      if (this.o.mode === 'auto') this.target = Math.min(this.o.autoMax, this.target + this.o.autoSpeed * dt);
      this.t += (this.target - this.t) * (1 - Math.exp(-dt * 6));
      this.pEnergy *= Math.exp(-dt * 1.6);
      this.kick *= Math.exp(-dt * 2.5);
      for (let k = 0; k < this.n; k++) this.pulseB[k] *= Math.exp(-dt * 0.35);
      this.pulses = this.pulses.filter((p) => (this.clock - p.t0) * 620 < Math.hypot(this.w, this.h) + 200);
      this.draw();
      if (this.o.word) {
        this.base += ((this.reveal > 0 ? 0 : this.o.wordBase * this.wordMul) - this.base) * (1 - Math.exp(-dt * 0.8));
        this.idle += dt;
        // when nobody is steering, a slow ghost wanders through the name so it can still be found
        if (this.idle > 2.5 && this.reveal === 0 && this.wordMul > 0.5) {
          const g = this.clock * 0.23;
          this.addHeat(this.w * (0.5 + 0.42 * Math.sin(g * 1.3)), this.h * (0.5 + 0.2 * Math.sin(g * 2.1 + 1)), 0.06);
        }
        this.drawWord(dt);
      }
      this.onFrame?.(this);
      if (!this.o.word) this.idle += dt;
      // render on demand: once nothing is moving, stop drawing until the pointer, a click or the scroll wakes it
      const settled = Math.abs(this.target - this.t) < 1e-3 && (this.o.mode !== 'auto' || this.target >= this.o.autoMax);
      if (this.o.sleepAfter > 0 && this.idle > this.o.sleepAfter && settled && !this.pulses.length && this.kick < 0.01 && this.pEnergy < 0.02 && this.reveal === 0) { this.running = false; return; }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  destroy() {
    this.stop(); this.io?.disconnect(); this.ro?.disconnect();
    const host: any = this.o.global ? window : this.canvas.parentElement || this.canvas;
    host.removeEventListener('pointermove', this.onPointer); host.removeEventListener('pointerleave', this.onLeave); host.removeEventListener('blur', this.onLeave);
    removeEventListener('pointerdown', this.onDown); document.removeEventListener('mouseleave', this.onLeave);
  }

  draw() {
    const { ctx, dpr, n, nx, ny, T, parent, phase, colors } = this;
    const t = this.t, clk = this.clock;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    // camera: zoom about a focus point, carrying it toward camTo (used for the dive into a single node)
    if (this.camScale !== 1 || this.camRot !== 0 || this.camFocus) {
      const fx = this.camFocus?.[0] ?? this.w / 2, fy = this.camFocus?.[1] ?? this.h / 2;
      const tx = this.camTo?.[0] ?? fx, ty = this.camTo?.[1] ?? fy;
      const c = Math.cos(this.camRot) * this.camScale, sn = Math.sin(this.camRot) * this.camScale;
      ctx.setTransform(dpr * c, dpr * sn, -dpr * sn, dpr * c, dpr * (tx - c * fx + sn * fy), dpr * (ty - sn * fx - c * fy));
    }
    const R = 150, R2 = R * R, px = this.px, py = this.py, pe = 0.25 + this.pEnergy;
    const ptr = px > -1e3;
    const FRONT = 0.035;

    // local time with pointer acceleration + drift
    const teff = (k: number) => {
      let tt = t;
      if (ptr) {
        const dx = nx[k] - px, dy = ny[k] - py, d2 = dx * dx + dy * dy;
        if (d2 < R2) { const f = 1 - d2 / R2; this.pBoost[k] = Math.min(0.45, this.pBoost[k] + f * f * 0.012 * pe); }
      }
      this.pBoost[k] *= 0.992;
      return tt + this.pBoost[k] + this.pulseB[k];
    };
    const off = (k: number) => {
      let ox = Math.sin(clk * 0.6 + phase[k]) * 1.2, oy = Math.cos(clk * 0.5 + phase[k] * 1.3) * 1.2;
      if (ptr) {
        const dx = nx[k] - px, dy = ny[k] - py, d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 1) { const f = (1 - d2 / R2) * 10 / Math.sqrt(d2); ox += dx * f; oy += dy * f; }
      }
      let x = nx[k] + ox, y = ny[k] + oy;
      // rupture: a flowing turbulence tears the network apart
      const st = this.storm + this.kick * 0.12;
      if (st > 0.001) {
        const S = 115 * st, ph = phase[k];
        x += (Math.sin(y * 0.0065 + clk * 0.9 + ph * 0.5) + Math.sin(x * 0.011 - clk * 0.6)) * S;
        y += (Math.cos(x * 0.0072 - clk * 0.8 + ph * 0.5) + Math.cos(y * 0.013 + clk * 0.5)) * S * 0.8;
      }
      // re-knit into the new lattice
      const se = this.settle;
      if (se > 0.001) { const e = se * se * (3 - 2 * se); x += (this.tx[k] + Math.sin(clk * 0.7 + phase[k]) * 0.8 - x) * e; y += (this.ty[k] + Math.cos(clk * 0.6 + phase[k]) * 0.8 - y) * e; }
      // click shockwaves
      for (const p of this.pulses) {
        const r = (clk - p.t0) * 620, dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1, band = d - r;
        if (band < 0 && this.pulseB[k] < 0.6 && band > -40) this.pulseB[k] = 0.6;
        if (Math.abs(band) < 60) { const a = Math.cos((band / 60) * Math.PI / 2) * 18 * Math.max(0, 1 - r / 1400); x += (dx / d) * a; y += (dy / d) * a; }
      }
      return [x, y];
    };

    // 1) lattice — the old structure, dissolving under the front
    ctx.beginPath();
    for (let i = 0; i < this.nseg; i++) {
      const d = Math.min(1, Math.max(0, (t - this.segT[i] - 0.02) / 0.16));
      if (d >= 1) continue;
      const x1 = this.segs[i * 4], y1 = this.segs[i * 4 + 1], x2 = this.segs[i * 4 + 2], y2 = this.segs[i * 4 + 3];
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, k = (1 - d) * 0.5;
      let bx = 0, by = 0;
      if (ptr) { const dx = mx - px, dy = my - py, dd = Math.hypot(dx, dy); if (dd < R && dd > 1) { const f = (1 - dd / R) * 12 / dd; bx = dx * f; by = dy * f; } }
      ctx.moveTo(mx + (x1 - mx) * k * 2 + bx, my + (y1 - my) * k * 2 + by);
      ctx.lineTo(mx + (x2 - mx) * k * 2 + bx, my + (y2 - my) * k * 2 + by);
    }
    ctx.strokeStyle = colors.rule; ctx.lineWidth = 1; ctx.stroke();

    // 2) new network: links grow from parent to child after adoption
    ctx.beginPath();
    const pos = new Float32Array(n * 2), te = new Float32Array(n);
    for (let k = 0; k < n; k++) { const [x, y] = off(k); pos[k * 2] = x; pos[k * 2 + 1] = y; te[k] = teff(k); }
    for (let k = 0; k < n; k++) {
      const p = parent[k]; if (p < 0) continue;
      const g = (te[k] - T[k]) / 0.04; if (g <= 0) continue;
      const f = Math.min(1, g);
      const x0 = pos[p * 2], y0 = pos[p * 2 + 1];
      ctx.moveTo(x0, y0); ctx.lineTo(x0 + (pos[k * 2] - x0) * f, y0 + (pos[k * 2 + 1] - y0) * f);
    }
    const se = this.settle, sE = se * se * (3 - 2 * se);
    ctx.globalAlpha = 0.38 * (1 - sE) * (1 - this.storm * 0.35); ctx.strokeStyle = colors.ink; ctx.lineWidth = 0.8; ctx.stroke(); ctx.globalAlpha = 1;
    // 2b) the re-knit: new lattice links form as nodes lock into place; some flash on a sweeping front
    if (se > 0.02) {
      const main = new Path2D(), flash = new Path2D(), front = se * 1.3 - 0.15;
      for (let q = 0; q < this.hex.length; q += 2) {
        const a = this.hex[q], b = this.hex[q + 1];
        const fx = (this.tx[a] / this.w + this.ty[a] / this.h * 0.35) / 1.35;
        const lk = Math.min(1, Math.max(0, (front - fx) / 0.12)); if (lk <= 0) continue;
        const x1 = pos[a * 2], y1 = pos[a * 2 + 1], x2 = pos[b * 2], y2 = pos[b * 2 + 1];
        const f = lk;
        const path = this.hexFresh[q / 2] && lk < 1 ? flash : main;
        path.moveTo(x1, y1); path.lineTo(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f);
      }
      ctx.strokeStyle = colors.ink; ctx.globalAlpha = 0.34 * Math.min(1, se * 1.6); ctx.lineWidth = 0.8; ctx.stroke(main);
      ctx.strokeStyle = colors.signal; ctx.globalAlpha = 0.95; ctx.lineWidth = 1.2; ctx.stroke(flash); ctx.globalAlpha = 1;
    }

    // 3) nodes: waiting (grey), front (signal), adopted (ink)
    ctx.fillStyle = colors.ink3; ctx.globalAlpha = 0.55;
    for (let k = 0; k < n; k++) if (te[k] < T[k]) ctx.fillRect(pos[k * 2] - 0.75, pos[k * 2 + 1] - 0.75, 1.5, 1.5);
    ctx.globalAlpha = 1; ctx.fillStyle = colors.ink;
    for (let k = 0; k < n; k++) { const a = te[k] - T[k]; if (a >= FRONT) ctx.fillRect(pos[k * 2] - 1.25, pos[k * 2 + 1] - 1.25, 2.5, 2.5); }
    ctx.fillStyle = colors.signal;
    for (let k = 0; k < n; k++) {
      const a = te[k] - T[k];
      if (a >= 0 && a < FRONT) { const s = 2 + 3 * (1 - a / FRONT); ctx.fillRect(pos[k * 2] - s / 2, pos[k * 2 + 1] - s / 2, s, s); }
    }

    // 3b) click shockwave fronts: nodes on the ring flash
    if (this.pulses.length) {
      ctx.fillStyle = colors.signal;
      for (const p of this.pulses) {
        const r = (clk - p.t0) * 620, fade = Math.max(0, 1 - r / 1400); if (fade <= 0) continue;
        ctx.globalAlpha = fade;
        for (let k = 0; k < n; k++) { const d = Math.hypot(pos[k * 2] - p.x, pos[k * 2 + 1] - p.y); if (Math.abs(d - r) < 14) ctx.fillRect(pos[k * 2] - 2.5, pos[k * 2 + 1] - 2.5, 5, 5); }
        if (r < 30) { ctx.globalAlpha = 1; ctx.fillRect(p.x - 4, p.y - 4, 8, 8); }
      }
      ctx.globalAlpha = 1;
    }

    // 4) aggregate adoption curve overlay (computed from this field)
    if (this.o.curve) this.drawCurve();
  }

  drawCurve() {
    const { ctx, colors } = this;
    const pad = 16, full = this.o.curve === 'full', cr = this.o.curveRect;
    let H = full ? this.h - pad * 2 : Math.min(150, this.h * 0.28);
    let W = this.w - pad * 2, x0 = pad, y0 = this.h - pad;
    if (cr) { x0 = this.w * cr[0]; y0 = this.h * cr[1]; W = this.w * cr[2]; H = this.h * cr[3]; }
    ctx.fillStyle = colors.paper; ctx.fillRect(x0 - 8, y0 - H - 24, W + 16, H + 32);
    ctx.strokeStyle = colors.rule; ctx.lineWidth = 1; ctx.strokeRect(x0 - 8.5, y0 - H - 24.5, W + 17, H + 33);
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y0 - H); ctx.lineTo(x0, y0); ctx.lineTo(x0 + W, y0); ctx.stroke();
    // ticks
    ctx.beginPath(); for (let i = 1; i <= 4; i++) { const x = x0 + (W * i) / 4; ctx.moveTo(x, y0); ctx.lineTo(x, y0 + 4); } ctx.stroke();
    // curve
    ctx.beginPath();
    const steps = 80;
    for (let i = 0; i <= steps; i++) { const tt = i / steps, s = this.share(tt); const x = x0 + W * tt, y = y0 - H * s; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = colors.ink3; ctx.stroke();
    ctx.beginPath();
    const tn = Math.max(0, Math.min(1, this.t));
    for (let i = 0; i <= steps * tn; i++) { const tt = i / steps, s = this.share(tt); const x = x0 + W * tt, y = y0 - H * s; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
    const s = this.share(tn), mx = x0 + W * tn, my = y0 - H * s;
    ctx.fillStyle = colors.signal; ctx.fillRect(mx - 3.5, my - 3.5, 7, 7);
  }
}
