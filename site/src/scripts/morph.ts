// Reorganisation field — the main-page motif.
// One population of points passes through a cycle of formations by continuous deformation:
//   lattice → twisted lattice → modules → orbits → new lattice → …
// Each formation has its own links. During a transition the old links stretch and tear (they fade as they
// exceed their rest length), turbulence peaks mid-way, and the next formation's links form — a few of them
// flashing on the adoption front colour. Scroll drives the phase; the cursor bends space and tears links.

const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; }; }
const smooth = (x: number) => x * x * (3 - 2 * x);
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export interface MorphOptions { spacing?: number; auto?: number; seed?: number; staticPhase?: number; density?: number }

export class MorphField {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  o: Required<MorphOptions>;
  w = 0; h = 0; dpr = 1; n = 0;
  F: Float32Array[] = []; // formations: [x0,y0,x1,y1,...]
  E: Uint32Array[] = []; // edges per formation: [a,b,a,b,...]
  R: Float32Array[] = []; // rest length per edge
  fresh: Uint8Array[] = []; // edge is new relative to previous formation
  pos = new Float32Array(); seedv = new Float32Array();
  phase = 0; target = 0; extra = 0; clock = 0;
  px = -1e4; py = -1e4; pe = 0;
  running = false; visible = false; raf = 0; last = 0;
  c = { ink: '#0d0d0c', ink3: '#8e8e86', rule: '#d9d9d3', signal: '#00a15c' };
  io?: IntersectionObserver; ro?: ResizeObserver;
  static reduced = false;
  static K = 5;

  constructor(canvas: HTMLCanvasElement, opts: MorphOptions = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d')!;
    this.o = { spacing: 34, auto: 0.085, seed: 3, staticPhase: 2.5, density: 1, ...opts };
    this.c = { ink: css('--ink'), ink3: css('--ink-3'), rule: css('--rule'), signal: css('--signal') };
    this.build();
    this.ro = new ResizeObserver(() => { const r = canvas.getBoundingClientRect(); if (Math.abs(r.width - this.w) > 2 || Math.abs(r.height - this.h) > 2) { this.build(); this.draw(); } });
    this.ro.observe(canvas);
    this.io = new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; this.visible ? this.start() : this.stop(); }, { rootMargin: '10% 0px' });
    this.io.observe(canvas);
    const host = canvas.parentElement || canvas;
    host.addEventListener('pointermove', this.onPointer, { passive: true });
    host.addEventListener('pointerleave', this.onLeave, { passive: true });
    if (MorphField.reduced) { this.phase = this.target = this.o.staticPhase; this.draw(); }
  }
  onPointer = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    this.pe = Math.min(1, this.pe + Math.hypot(x - this.px, y - this.py) / 300 || 0);
    this.px = x; this.py = y;
  };
  onLeave = () => { this.px = -1e4; this.py = -1e4; };

  build() {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    const rand = rng(this.o.seed);
    let s = this.o.spacing;
    while ((this.w / s) * (this.h / s) > 1300 * this.o.density) s *= 1.08;
    const cols = Math.max(3, Math.round(this.w / s)), rows = Math.max(3, Math.round(this.h / s));
    const sx = this.w / cols, sy = this.h / rows;
    const N = cols * rows; this.n = N;
    const cx = this.w / 2, cy = this.h / 2, Rm = Math.min(this.w, this.h) * 0.44;

    // F0 — the lattice (old structure)
    const f0 = new Float32Array(N * 2);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const k = j * cols + i; f0[k * 2] = (i + 0.5) * sx; f0[k * 2 + 1] = (j + 0.5) * sy; }
    // F1 — isotopy: the same lattice, continuously twisted and rippled
    const f1 = new Float32Array(N * 2);
    for (let k = 0; k < N; k++) {
      const dx = f0[k * 2] - cx, dy = f0[k * 2 + 1] - cy, rr = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const th = 1.9 * Math.exp(-((rr / Rm) ** 2) * 1.1);
      const r2 = rr * (0.86 + 0.08 * Math.sin(a * 5 + rr / 60));
      f1[k * 2] = cx + Math.cos(a + th) * r2; f1[k * 2 + 1] = cy + Math.sin(a + th) * r2;
    }
    // F2 — modules: the organisation breaks into clusters (nearest centre keeps neighbourhoods together)
    const M = 7, centres: number[][] = [];
    for (let m = 0; m < M; m++) { const a = (m / M) * Math.PI * 2 + rand() * 0.5; const d = Rm * (0.35 + rand() * 0.75); centres.push([cx + Math.cos(a) * d * (this.w / this.h > 1 ? 1.35 : 0.9), cy + Math.sin(a) * d * 0.8]); }
    const groups: number[][] = centres.map(() => []);
    for (let k = 0; k < N; k++) { let best = 0, bd = 1e12; centres.forEach(([x, y], m) => { const d = (f0[k * 2] - x) ** 2 + (f0[k * 2 + 1] - y) ** 2; if (d < bd) { bd = d; best = m; } }); groups[best].push(k); }
    const f2 = new Float32Array(N * 2), golden = Math.PI * (3 - Math.sqrt(5));
    groups.forEach((g, m) => {
      g.sort((a, b) => ((f0[a * 2] - centres[m][0]) ** 2 + (f0[a * 2 + 1] - centres[m][1]) ** 2) - ((f0[b * 2] - centres[m][0]) ** 2 + (f0[b * 2 + 1] - centres[m][1]) ** 2));
      const rad = Math.sqrt(g.length) * s * 0.36;
      g.forEach((k, q) => { const rr = rad * Math.sqrt((q + 0.5) / g.length), a = q * golden; f2[k * 2] = centres[m][0] + Math.cos(a) * rr; f2[k * 2 + 1] = centres[m][1] + Math.sin(a) * rr; });
    });
    // F3 — orbits: a new radial order (rank by distance, keep angle → neighbourhoods roughly preserved)
    const f3 = new Float32Array(N * 2);
    const byR = [...Array(N).keys()].sort((a, b) => ((f0[a * 2] - cx) ** 2 + (f0[a * 2 + 1] - cy) ** 2) - ((f0[b * 2] - cx) ** 2 + (f0[b * 2 + 1] - cy) ** 2));
    const rings = 11;
    byR.forEach((k, q) => {
      const ring = Math.floor((q / N) * rings), rr = Rm * 1.08 * ((ring + 0.6) / rings) ** 0.9;
      const a = Math.atan2(f0[k * 2 + 1] - cy, f0[k * 2] - cx) + ring * 0.21;
      f3[k * 2] = cx + Math.cos(a) * rr * (this.w > this.h ? 1.5 : 1); f3[k * 2 + 1] = cy + Math.sin(a) * rr * 0.95;
    });
    // F4 — the new lattice: rotated, hexagonal
    const f4 = new Float32Array(N * 2), rot = -0.42, sc = 0.95;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      const x = (i + 0.5 + (j % 2) * 0.5) * sx - cx, y = (j + 0.5) * sy * 0.94 - cy;
      f4[k * 2] = cx + (x * Math.cos(rot) - y * Math.sin(rot)) * sc * 1.15; f4[k * 2 + 1] = cy + (x * Math.sin(rot) + y * Math.cos(rot)) * sc;
    }
    this.F = [f0, f1, f2, f3, f4];

    // links per formation
    const gridEdges: number[] = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const k = j * cols + i; if (i < cols - 1) gridEdges.push(k, k + 1); if (j < rows - 1) gridEdges.push(k, k + cols); }
    const knn = (f: Float32Array, K: number) => {
      const cell = s * 1.6, gw = Math.ceil(this.w * 2 / cell) + 4, map = new Map<number, number[]>();
      const key = (x: number, y: number) => (Math.floor(y / cell) + 2) * gw + Math.floor(x / cell) + 2 + gw * 1000;
      for (let k = 0; k < N; k++) { const kk = key(f[k * 2] + this.w * 0.5, f[k * 2 + 1] + this.h * 0.5); (map.get(kk) || map.set(kk, []).get(kk)!).push(k); }
      const seen = new Set<number>(), out: number[] = [];
      for (let k = 0; k < N; k++) {
        const x = f[k * 2], y = f[k * 2 + 1], cand: Array<[number, number]> = [];
        const bx = Math.floor((y + this.h * 0.5) / cell) + 2, by = Math.floor((x + this.w * 0.5) / cell) + 2;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const arr = map.get((bx + dy) * gw + by + dx + gw * 1000); if (!arr) continue;
          for (const m of arr) if (m !== k) cand.push([m, (f[m * 2] - x) ** 2 + (f[m * 2 + 1] - y) ** 2]);
        }
        cand.sort((a, b) => a[1] - b[1]);
        for (const [m] of cand.slice(0, K)) { const id = k < m ? k * N + m : m * N + k; if (!seen.has(id)) { seen.add(id); out.push(Math.min(k, m), Math.max(k, m)); } }
      }
      return out;
    };
    const hexEdges = knn(f4, 3);
    this.E = [Uint32Array.from(gridEdges), Uint32Array.from(gridEdges), Uint32Array.from(knn(f2, 3)), Uint32Array.from(knn(f3, 2)), Uint32Array.from(hexEdges)];
    this.R = this.E.map((e, fi) => { const f = this.F[fi], r = new Float32Array(e.length / 2); for (let q = 0; q < r.length; q++) { const a = e[q * 2], b = e[q * 2 + 1]; r[q] = Math.hypot(f[a * 2] - f[b * 2], f[a * 2 + 1] - f[b * 2 + 1]); } return r; });
    this.fresh = this.E.map((e, fi) => {
      const prev = this.E[(fi + MorphField.K - 1) % MorphField.K], set = new Set<number>();
      for (let q = 0; q < prev.length; q += 2) set.add(prev[q] * N + prev[q + 1]);
      const out = new Uint8Array(e.length / 2);
      for (let q = 0; q < out.length; q++) out[q] = !set.has(e[q * 2] * N + e[q * 2 + 1]) && rand() < 0.1 ? 1 : 0;
      return out;
    });
    this.pos = new Float32Array(N * 2); this.seedv = Float32Array.from({ length: N }, () => rand() * Math.PI * 2);
  }

  /** current point positions (viewport-relative to the canvas) */
  points() { return this.pos; }
  setPhase(p: number) { this.target = p; if (MorphField.reduced) { this.phase = this.o.staticPhase; this.draw(); } else if (!this.running && this.visible) this.start(); }

  start() {
    if (this.running || MorphField.reduced) return;
    this.running = true; this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.clock += dt;
      this.target += this.o.auto * dt;
      this.phase += (this.target + this.extra - this.phase) * (1 - Math.exp(-dt * 5));
      this.pe *= Math.exp(-dt * 1.5);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  destroy() {
    this.stop(); this.io?.disconnect(); this.ro?.disconnect();
    const host = this.canvas.parentElement || this.canvas;
    host.removeEventListener('pointermove', this.onPointer); host.removeEventListener('pointerleave', this.onLeave);
  }

  draw() {
    const { ctx, n, c } = this, K = MorphField.K;
    const ph = ((this.phase % K) + K) % K, k = Math.floor(ph), k2 = (k + 1) % K;
    // hold each formation for a while, then transition
    const fr = ph - k, u = ease(smooth(Math.min(1, Math.max(0, (fr - 0.35) / 0.65))));
    const A = this.F[k], B = this.F[k2], turb = Math.sin(Math.PI * u) * this.o.spacing * 0.9, t = this.clock;
    const P = this.pos, R = 170, R2 = R * R, ptr = this.px > -1e3, push = 30 + 40 * this.pe;
    for (let i = 0; i < n; i++) {
      const s0 = this.seedv[i];
      let x = A[i * 2] + (B[i * 2] - A[i * 2]) * u + Math.cos(t * 0.7 + s0) * 1.6 + Math.sin(t * 1.3 + s0 * 3 + i * 0.01) * turb;
      let y = A[i * 2 + 1] + (B[i * 2 + 1] - A[i * 2 + 1]) * u + Math.sin(t * 0.6 + s0) * 1.6 + Math.cos(t * 1.1 + s0 * 2 + i * 0.013) * turb;
      if (ptr) { const dx = x - this.px, dy = y - this.py, d2 = dx * dx + dy * dy; if (d2 < R2 && d2 > 1) { const d = Math.sqrt(d2), f = (1 - d / R) ** 2 * push / d; x += dx * f; y += dy * f; } }
      P[i * 2] = x; P[i * 2 + 1] = y;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    // links: outgoing formation tears, incoming forms. Bucketed by alpha for fewer strokes.
    const buckets: Path2D[] = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    const flash = new Path2D();
    const layer = (fi: number, weight: number, incoming: boolean) => {
      if (weight <= 0.01) return;
      const e = this.E[fi], rest = this.R[fi], fresh = this.fresh[fi];
      for (let q = 0; q < rest.length; q++) {
        const a = e[q * 2], b = e[q * 2 + 1];
        const x1 = P[a * 2], y1 = P[a * 2 + 1], x2 = P[b * 2], y2 = P[b * 2 + 1];
        const len = Math.hypot(x2 - x1, y2 - y1), stretch = len / (rest[q] || 1);
        let integ = 1 - Math.max(0, stretch - 1.15) * 1.8;
        if (ptr) { const mx = (x1 + x2) / 2 - this.px, my = (y1 + y2) / 2 - this.py; const d = Math.hypot(mx, my); if (d < R * 0.55) integ *= d / (R * 0.55); }
        const al = weight * integ; if (al <= 0.04) continue;
        if (incoming && fresh[q] && u > 0.3 && u < 0.9) { flash.moveTo(x1, y1); flash.lineTo(x2, y2); continue; }
        const bi = Math.min(3, (al * 4) | 0); buckets[bi].moveTo(x1, y1); buckets[bi].lineTo(x2, y2);
      }
    };
    layer(k, 1 - u, false);
    layer(k2, u * u, true);
    ctx.lineWidth = 1; ctx.strokeStyle = c.ink;
    buckets.forEach((p, i) => { ctx.globalAlpha = 0.1 + i * 0.09; ctx.stroke(p); });
    ctx.globalAlpha = 0.9; ctx.strokeStyle = c.signal; ctx.lineWidth = 1.2; ctx.stroke(flash);
    // points
    ctx.globalAlpha = 1; ctx.fillStyle = c.ink;
    const sz = 2.2;
    for (let i = 0; i < n; i++) ctx.fillRect(P[i * 2] - sz / 2, P[i * 2 + 1] - sz / 2, sz, sz);
    // a few points on the front
    if (u > 0.05 && u < 0.95) {
      ctx.fillStyle = c.signal;
      for (let i = 0; i < n; i += 7) { const h = (Math.sin(i * 12.9898) * 43758.5453) % 1; if (Math.abs(h) < Math.sin(Math.PI * u) * 0.5) ctx.fillRect(P[i * 2] - 2, P[i * 2 + 1] - 2, 4, 4); }
    }
  }
}
