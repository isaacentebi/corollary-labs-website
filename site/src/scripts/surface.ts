// Homotopy surface. A wireframe sheet deformed by one parameter h ∈ [0,1] (driven by scroll):
//   0.00–0.30  isotopy: the flat lattice twists and folds, continuously, without breaking
//   0.30–0.55  rupture: continuity fails; the sheet tears along a seam and the pieces drift apart
//   0.55–1.00  reorganisation: the torn sheet re-glues both pairs of edges and closes into a torus
// Rendered in ink on paper with depth-faded lines. Drag / pointer turns it; click sends a ripple across it.

const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const sm = (x: number) => x * x * (3 - 2 * x);
const TAU = Math.PI * 2;

export class HomotopySurface {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  w = 0; h = 0; dpr = 1;
  NU = 64; NV = 34;
  hp = 0; target = 0; // homotopy parameter
  yaw = 0.6; pitch = 0.5; yawT = 0.6; pitchT = 0.5; spin = 0;
  tilt = 1; // 0 = seen straight from above (reads as the flat field), 1 = free 3D view
  clock = 0; raf = 0; running = false; visible = false; last = 0;
  ripples: Array<{ u: number; v: number; t0: number }> = [];
  c = { ink: '#0d0d0c', ink3: '#8e8e86', rule: '#d9d9d3', signal: '#00a15c' };
  io?: IntersectionObserver; ro?: ResizeObserver;
  proj = new Float32Array(); depth = new Float32Array();
  static reduced = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d')!;
    this.c = { ink: css('--ink'), ink3: css('--ink-3'), rule: css('--rule'), signal: css('--signal') };
    this.proj = new Float32Array(this.NU * this.NV * 2); this.depth = new Float32Array(this.NU * this.NV);
    this.resize();
    this.ro = new ResizeObserver(() => { this.resize(); this.draw(); }); this.ro.observe(canvas);
    this.io = new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; this.visible ? this.start() : this.stop(); });
    this.io.observe(canvas);
    addEventListener('pointermove', this.onMove, { passive: true });
    canvas.addEventListener('pointerdown', this.onDown);
    if (HomotopySurface.reduced) { this.hp = this.target = 0.4; this.draw(); }
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
  }
  onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) return;
    this.yawT = 0.6 + ((e.clientX - r.left) / r.width - 0.5) * 1.1;
    this.pitchT = 0.5 + ((e.clientY - r.top) / r.height - 0.5) * 0.6;
  };
  onDown = (e: PointerEvent) => {
    // ripple from the nearest projected vertex
    const r = this.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = 0, bd = 1e12;
    for (let k = 0; k < this.NU * this.NV; k++) { const d = (this.proj[k * 2] - x) ** 2 + (this.proj[k * 2 + 1] - y) ** 2; if (d < bd) { bd = d; best = k; } }
    this.ripples.push({ u: (best % this.NU) / (this.NU - 1), v: Math.floor(best / this.NU) / (this.NV - 1), t0: this.clock });
    if (this.ripples.length > 5) this.ripples.shift();
  };
  setProgress(h: number) { this.target = h; if (HomotopySurface.reduced) { this.hp = 0.4; this.draw(); } }

  start() {
    if (this.running || HomotopySurface.reduced) return;
    this.running = true; this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.clock += dt;
      this.hp += (this.target - this.hp) * (1 - Math.exp(-dt * 5));
      this.spin += dt * 0.08;
      this.yaw += ((this.yawT + this.spin) * this.tilt - this.yaw) * (1 - Math.exp(-dt * 3));
      const pt = 1.52 + (this.pitchT - 1.52) * this.tilt, yt = (this.yawT + this.spin) * this.tilt;
      this.pitch += (pt - this.pitch) * (1 - Math.exp(-dt * 3));
      this.ripples = this.ripples.filter((q) => this.clock - q.t0 < 3.5);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  destroy() { this.stop(); this.io?.disconnect(); this.ro?.disconnect(); removeEventListener('pointermove', this.onMove); this.canvas.removeEventListener('pointerdown', this.onDown); }

  /** the surface at (u,v) for the current homotopy parameter, in object space (unit ≈ 1) */
  point(u: number, v: number, out: number[]) {
    const hp = this.hp, t = this.clock;
    // S0 flat sheet
    let x = (u - 0.5) * 2.6, y = 0, z = (v - 0.5) * 1.5;
    // S1 isotopy: twist around the long axis + folding waves
    const iso = sm(seg(hp, 0.02, 0.32));
    if (iso > 0) {
      const tw = iso * Math.PI * 0.9 * (u - 0.5) * 2;
      const zz = z * Math.cos(tw) - y * Math.sin(tw), yy = z * Math.sin(tw) + y * Math.cos(tw);
      z = zz; y = yy + iso * 0.28 * Math.sin(u * TAU * 1.5 + t * 0.6) * Math.cos(v * Math.PI);
      x += iso * 0.12 * Math.sin(v * TAU + t * 0.4);
    }
    // S2 rupture: the two halves (v < .5 / v ≥ .5) pull apart along the seam, with turbulence
    const rup = Math.sin(Math.PI * seg(hp, 0.3, 0.62));
    if (rup > 0) {
      const side = v < 0.5 ? -1 : 1;
      y += side * rup * 0.38; z += side * rup * 0.28;
      x += rup * 0.18 * Math.sin(v * 9 + t * 1.3 + u * 4);
      y += rup * 0.12 * Math.cos(u * 11 - t * 1.1);
    }
    // S3 re-glue: close into a torus (u → major angle, v → minor angle)
    const tor = sm(seg(hp, 0.52, 0.95));
    if (tor > 0) {
      const R = 1.05, r = 0.42, th = u * TAU, ph = v * TAU + t * 0.15;
      const tx = (R + r * Math.cos(ph)) * Math.cos(th), ty = r * Math.sin(ph), tz = (R + r * Math.cos(ph)) * Math.sin(th);
      x += (tx - x) * tor; y += (ty - y) * tor; z += (tz - z) * tor;
    }
    // ripples travel across the parameter domain
    for (const q of this.ripples) {
      const d = Math.hypot(u - q.u, (v - q.v) * 0.6), rr = (this.clock - q.t0) * 0.45, band = d - rr;
      if (Math.abs(band) < 0.08) y += Math.cos((band / 0.08) * Math.PI / 2) * 0.12 * Math.max(0, 1 - rr / 1.4);
    }
    out[0] = x; out[1] = y; out[2] = z;
  }

  // network look (matches the diffusion field): per-vertex jitter + one "parent" link per vertex, built once
  jit = new Float32Array(); parent = new Int32Array(); extra = new Uint8Array();
  buildNet() {
    const { NU, NV } = this, N = NU * NV;
    let s = 97; const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    this.jit = Float32Array.from({ length: N * 2 }, () => (rnd() - 0.5) * 0.62);
    this.parent = new Int32Array(N).fill(-1); this.extra = new Uint8Array(N);
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const k = j * NU + i, opts: number[] = [];
      if (i > 0) opts.push(k - 1); if (j > 0) opts.push(k - NU); if (i > 0 && j > 0) opts.push(k - NU - 1); if (i < NU - 1 && j > 0) opts.push(k - NU + 1);
      if (opts.length) this.parent[k] = opts[(rnd() * opts.length) | 0];
      this.extra[k] = rnd() < 0.22 ? 1 : 0;
    }
  }

  draw() {
    const { ctx, NU, NV, c } = this;
    if (!this.parent.length) this.buildNet();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    // seen from above at tilt 0 the sheet fills the screen like the field it replaces, then pulls back as it tilts
    const scale = Math.min(this.w, this.h) * 0.32 * (this.w < 700 ? 1.15 : 1) * (1 + (1 - this.tilt) * ((this.w / this.h) * 1.25)), cam = 4.2;
    const P = this.proj, D = this.depth, tmp = [0, 0, 0], J = this.jit;
    const du = 1 / (NU - 1), dv = 1 / (NV - 1);
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const k = j * NU + i;
      // jitter fades out as the surface becomes the torus (the new order is regular)
      const jf = 1 - sm(seg(this.hp, 0.6, 0.95));
      const u = Math.min(1, Math.max(0, i * du + J[k * 2] * du * jf)), v = Math.min(1, Math.max(0, j * dv + J[k * 2 + 1] * dv * jf));
      this.point(u, v, tmp);
      const [x, y, z] = tmp;
      const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const f = cam / (cam + z2);
      P[k * 2] = this.w / 2 + x1 * f * scale; P[k * 2 + 1] = this.h / 2 - y2 * f * scale; D[k] = z2;
    }
    const hp = this.hp;
    const seamJ = Math.floor((NV - 1) / 2);
    const torn = seg(hp, 0.3, 0.36) > 0 && hp < 0.62;
    const seamFlash = hp > 0.28 && hp < 0.44;
    const glue = seg(hp, 0.62, 0.95);
    const crossesSeam = (a: number, b: number) => { const ja = (a / NU) | 0, jb = (b / NU) | 0; return (ja <= seamJ) !== (jb <= seamJ); };
    const buckets = [new Path2D(), new Path2D(), new Path2D(), new Path2D()], gBuckets = [new Path2D(), new Path2D(), new Path2D(), new Path2D()], flash = new Path2D(), faint = new Path2D();
    // the re-formed surface is green: a front sweeps round the new shape as it closes (the transformation)
    const front = sm(seg(hp, 0.5, 0.97)) * 1.15;
    const reformed = (a: number) => (a % NU) / (NU - 1) < front;
    const add = (a: number, b: number, green = false, into?: Path2D) => {
      const bi = Math.min(3, Math.max(0, Math.floor((1.6 - (D[a] + D[b]) / 2) / 0.8)));
      const path = green ? flash : into ?? (reformed(a) && reformed(b) ? gBuckets[bi] : buckets[bi]);
      path.moveTo(P[a * 2], P[a * 2 + 1]); path.lineTo(P[b * 2], P[b * 2 + 1]);
    };
    // the old lattice as a faint underlay — it fades as the new structure takes over
    const lat = 1 - sm(seg(hp, 0.25, 0.6));
    if (lat > 0.02) for (let j = 0; j < NV; j += 2) for (let i = 0; i < NU - 1; i++) add(j * NU + i, j * NU + i + 1, false, faint);
    // network links: each vertex to its parent (+ some extra links for 3D legibility)
    for (let k = 0; k < NU * NV; k++) {
      const pk = this.parent[k]; if (pk < 0) continue;
      const cross = crossesSeam(k, pk);
      if (cross && torn) continue;
      add(k, pk, cross && (seamFlash || (hp >= 0.62 && hp < 0.78)));
      if (this.extra[k]) { const i = k % NU; if (i < NU - 1 && !(torn && crossesSeam(k, k + 1))) add(k, k + 1); }
    }
    // re-gluing: stitches appear only where the edges have actually met
    if (glue > 0.02) {
      const near = (a: number, b: number) => Math.hypot(P[a * 2] - P[b * 2], P[a * 2 + 1] - P[b * 2 + 1]) < 26;
      for (let j = 0; j < NV; j++) { const a = j * NU + NU - 1, b = j * NU; if (near(a, b)) add(a, b, glue < 0.85); }
      for (let i = 0; i < NU; i++) { const a = (NV - 1) * NU + i, b = i; if (near(a, b)) add(a, b, glue < 0.85); }
    }
    ctx.lineWidth = 1; ctx.strokeStyle = c.rule; ctx.globalAlpha = lat; ctx.stroke(faint);
    ctx.lineWidth = 0.8; ctx.strokeStyle = c.ink;
    [0.42, 0.3, 0.18, 0.09].forEach((a, i) => { ctx.globalAlpha = a; ctx.stroke(buckets[i]); });
    ctx.strokeStyle = c.signal; [0.7, 0.5, 0.3, 0.14].forEach((a, i) => { ctx.globalAlpha = a; ctx.stroke(gBuckets[i]); });
    ctx.globalAlpha = 1; ctx.strokeStyle = c.signal; ctx.lineWidth = 1.2; ctx.stroke(flash);
    // vertices: ink squares like the field's nodes; the torn seam's vertices flash green
    for (let k = 0; k < NU * NV; k++) {
      const j = (k / NU) | 0, onSeam = (j === seamJ || j === seamJ + 1) && seamFlash;
      ctx.globalAlpha = D[k] < 0 ? 0.95 : 0.4;
      ctx.fillStyle = onSeam || reformed(k) ? c.signal : c.ink;
      const sz = onSeam ? 3.5 : 2.2;
      ctx.fillRect(P[k * 2] - sz / 2, P[k * 2 + 1] - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
  }
}
