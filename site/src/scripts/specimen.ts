// The specimen: one firm drawn as a living cell, seen through a round aperture.
// Everything is a function of the story position `s` (scroll) and time `t` (idle life), so it scrubs both ways.
//   s < 0      hero: the firm, alive
//   0 → 1      fig 1  the firm: inputs, three people in sequence, coordination issuing plans, output A
//   1 → 2      fig 2  an agent arrives with the inputs; the boundary closes around it at the middle step
//   2 → 3      fig 3  the plan is withdrawn; an objective; alternatives explored, one selected
//   3 → 4      fig 4  coordination spreads as a mesh; agents at every step; people on the feedback loop;
//                     the boundary deforms and grows a lobe; A closes, B and C open, throughput rises
//   4 → 5      fig 5  pull back into the tissue; the change spreads cell to cell; the aperture opens
import { TAU, clamp, ss, lerp, spring, gauss, angDiff, polar, rng, palette, rgba, mixc, smoothClosed, type Palette } from './draw';
import { makeTissue, stepTissue, drawTissue, type Tissue } from './tissue';

type V = [number, number];
const R0 = 0.7;
const TH_IN = Math.PI - 0.12;
const TH_A = 0.1, TH_B = -0.78, TH_C = -0.3, TH_LOBE = -0.52, TH_O = 1.02;
const STEP: V[] = [[-0.34, 0.1], [0, 0.15], [0.34, 0.1]];
const S4: V = [0.56, -0.3];
const NUC: V = [-0.03, -0.34];
const RN = 0.13;
const ASIDE: V = [0.1, 0.43];
const PEOPLE_OUT = [-2.25, 1.95, 0.5]; // membrane angles the three people move to
const MESH_N: V[] = [STEP[0], STEP[1], STEP[2], S4, NUC, [-0.2, -0.1], [0.22, -0.14], [-0.16, 0.36], [0.2, 0.33],
  [-0.46, -0.16], [0.3, -0.48], [-0.4, 0.33], [0.46, 0.18], [-0.02, -0.08]];
const MESH_E: [number, number][] = [[4, 5], [4, 6], [5, 0], [5, 13], [13, 1], [6, 13], [6, 3], [2, 3], [0, 7], [7, 1], [1, 8], [8, 2],
  [6, 2], [4, 10], [10, 3], [5, 9], [9, 0], [0, 11], [11, 7], [2, 12], [12, 3], [8, 12], [4, 9]];
const FIL = [-2.5, -1.75, -0.35, 0.3, 2.35, 3.0]; // explored directions (agent-relative), index 3 → toward the objective
const SEL = 3;

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const lerpV = (a: V, b: V, t: number): V => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const quad = (a: V, c: V, b: V, t: number): V => { const u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; };

export interface SpecimenOpts { canvas: HTMLCanvasElement; plate?: number; reduced?: boolean; layout?: (w: number, h: number) => { cx: number; cy: number; R: number } }

export class Specimen {
  c: HTMLCanvasElement; ctx: CanvasRenderingContext2D; P: Palette;
  w = 0; h = 0; dpr = 1; cx = 0; cy = 0; R = 1;
  s = -1; sTarget = -1; t = 0; phase = 0; born = 0;
  running = false; raf = 0; last = 0; visible = true;
  reduced: boolean; plate?: number;
  pointer = { x: 9, y: 9, on: 0, tx: 9, ty: 9 };
  tissue: Tissue; nucDots: { a: V; e: number; u: number; d: number }[] = [];
  granules: [number, number, number, number][] = [];
  layoutFn?: SpecimenOpts['layout'];
  mobile = false;
  onFrame?: (s: number) => void;

  constructor(o: SpecimenOpts) {
    this.c = o.canvas; this.ctx = o.canvas.getContext('2d')!; this.P = palette();
    this.reduced = !!o.reduced; this.plate = o.plate; this.layoutFn = o.layout;
    if (o.plate != null) { this.s = this.sTarget = o.plate; }
    this.tissue = makeTissue(7, 38, 26, 1.9, { divide: 0.12, shrink: 0.1, reach: 9 });
    const G = rng(23);
    for (let i = 0; i < 170; i++) { const a = G() * TAU, d = Math.sqrt(G()); this.granules.push([a, d, G(), G()]); }
    const R = rng(11);
    for (let i = 0; i < 150; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * RN * 0.86;
      this.nucDots.push({ a: [NUC[0] + Math.cos(a) * d, NUC[1] + Math.sin(a) * d], e: Math.floor(R() * MESH_E.length), u: R(), d: R() });
    }
    this.resize();
    this.born = performance.now();
  }

  resize() {
    const r = this.c.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr);
    this.mobile = this.w < 760;
    const L = this.layoutFn ? this.layoutFn(this.w, this.h) : { cx: this.w / 2, cy: this.h / 2, R: Math.min(this.w, this.h) * 0.46 };
    this.cx = L.cx; this.cy = L.cy; this.R = L.R;
    if (!this.running) this.draw();
  }

  start() {
    if (this.running) return; this.running = true; this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.tick(dt); this.draw(); this.onFrame?.(this.s);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  tick(dt: number) {
    if (this.reduced) { this.s = this.sTarget; return; }
    this.t += dt;
    this.s += (this.sTarget - this.s) * (1 - Math.exp(-dt * 7));
    if (Math.abs(this.sTarget - this.s) < 1e-4) this.s = this.sTarget;
    const speed = lerp(1, 1.9, ss(3.62, 3.92, this.s));
    this.phase += dt * speed;
    const p = this.pointer;
    p.x += (p.tx - p.x) * (1 - Math.exp(-dt * 10)); p.y += (p.ty - p.y) * (1 - Math.exp(-dt * 10));
  }

  setPointer(clientX: number, clientY: number, on: boolean) {
    const r = this.c.getBoundingClientRect();
    this.pointer.tx = (clientX - r.left - this.cx) / this.R; this.pointer.ty = (clientY - r.top - this.cy) / this.R; this.pointer.on = on ? 1 : 0;
    if (!on) { this.pointer.tx = 9; this.pointer.ty = 9; }
  }

  // ── derived state ──────────────────────────────────────────────────────
  st(s: number) {
    const grow = this.reduced ? 1 : spring(clamp((performance.now() - this.born - 150) / 1500));
    return {
      grow,
      aIn: ss(1.0, 1.3, s), engulf: ss(1.25, 1.55, s), pinch: ss(1.52, 1.66, s), toStep: ss(1.6, 1.88, s),
      aside: ss(1.55, 1.8, s), fuse: ss(1.82, 1.97, s), plan2: ss(1.84, 2.0, s),
      wither: ss(2.03, 2.3, s), obj: ss(2.12, 2.45, s), explore: ss(2.33, 2.68, s), select: ss(2.62, 2.95, s),
      dissolve: ss(3.02, 3.3, s), mesh: ss(3.1, 3.55, s), divide: ss(3.25, 3.6, s), out: ss(3.3, 3.65, s),
      lobe: ss(3.4, 3.8, s), newOut: ss(3.62, 3.92, s), loop: ss(3.55, 3.9, s),
      zoom: ss(4.0, 4.42, s), detail: 1 - ss(4.08, 4.3, s), tissueA: ss(4.02, 4.24, s), stain: 0.85 * clamp((s - 4.25) / 0.75) + 0.12 * clamp(s - 5), open: ss(4.5, 4.92, s),
    };
  }

  memR(th: number, S: ReturnType<Specimen['st']>): number {
    const t = this.t;
    let r = R0 * (1 + 0.022 * Math.sin(3 * th + t * 0.45) + 0.015 * Math.sin(5 * th - t * 0.62 + 1.3) + 0.01 * Math.sin(2 * th + t * 0.31 + 2));
    r *= 0.25 + 0.75 * S.grow;
    r += S.lobe * 0.21 * gauss(angDiff(th, TH_LOBE), 0.5);
    r -= S.lobe * 0.03 * gauss(angDiff(th, 2.2), 0.8); // the rest of the boundary gives a little
    const p = this.pointer;
    if (p.on && this.s < 0.5) {
      const d = Math.hypot(p.x, p.y), phi = Math.atan2(p.y, p.x);
      const near = gauss(d - R0, 0.22) * gauss(angDiff(th, phi), 0.32);
      r += (d > R0 ? -0.07 : 0.05) * near;
    }
    return r;
  }

  // ── draw ───────────────────────────────────────────────────────────────
  draw() {
    const { ctx, P, dpr } = this; const s = this.s; const S = this.st(s);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.c.width, this.c.height);
    const diag = Math.hypot(Math.max(this.cx, this.w - this.cx), Math.max(this.cy, this.h - this.cy));
    const clipR = lerp(this.R, diag + 4, spring(S.open));
    // aperture
    ctx.save();
    ctx.beginPath(); ctx.arc(this.cx * dpr, this.cy * dpr, clipR * dpr, 0, TAU); ctx.clip();
    // camera
    const zoomTo = this.mobile ? 0.34 : 0.24;
    const cam = lerp(1, zoomTo, S.zoom);
    const k = this.R * cam;
    const setT = () => ctx.setTransform(dpr * k, 0, 0, dpr * k, this.cx * dpr, this.cy * dpr);
    setT();
    const px = 1 / k; // one CSS pixel in unit space
    if (S.tissueA > 0) this.drawTissueLayer(S, px, cam);
    if (S.detail > 0.001) {
      ctx.globalAlpha = S.detail;
      this.drawCell(S, px);
      ctx.globalAlpha = 1;
    }
    // eyepiece vignette
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vg = ctx.createRadialGradient(this.cx, this.cy, clipR * 0.78, this.cx, this.cy, clipR);
    vg.addColorStop(0, rgba(P.paper3, 0)); vg.addColorStop(1, rgba(P.paper3, 0.55 * (1 - S.open)));
    ctx.fillStyle = vg; ctx.fillRect(this.cx - clipR, this.cy - clipR, clipR * 2, clipR * 2);
    ctx.restore();
    // aperture ring
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ringA = 1 - S.open;
    if (ringA > 0.01) {
      ctx.beginPath(); ctx.arc(this.cx, this.cy, clipR - 0.5, 0, TAU); ctx.lineWidth = 1; ctx.strokeStyle = rgba(P.ink, 0.55 * ringA); ctx.stroke();
      ctx.beginPath(); ctx.arc(this.cx, this.cy, clipR + 7, 0, TAU); ctx.lineWidth = 0.75; ctx.strokeStyle = rgba(P.ink3, 0.45 * ringA); ctx.stroke();
    }
    if (S.detail > 0.001 && this.plate == null) this.drawLabels(S, s);
    else if (this.plate != null) this.drawLabels(S, s);
  }

  toScreen(v: V, cam = 1): V { return [this.cx + v[0] * this.R * cam, this.cy + v[1] * this.R * cam]; }

  drawTissueLayer(S: ReturnType<Specimen['st']>, px: number, cam: number) {
    const { ctx } = this;
    const tk = R0 / 0.95; // tissue unit → cell unit
    ctx.save();
    ctx.scale(tk, tk);
    stepTissue(this.tissue, S.stain, this.t, this.reduced ? 0 : 1);
    const k = this.R * cam * tk;
    const view: [number, number, number, number] = [-this.cx / k, -this.cy / k, (this.w - this.cx) / k, (this.h - this.cy) / k];
    drawTissue(ctx, this.tissue, { P: this.P, px: px / tk, st: S.stain, t: this.t, alpha: S.tissueA, view, firstStained: true });
    ctx.restore();
  }

  // the firm
  drawCell(S: ReturnType<Specimen['st']>, px: number) {
    const { ctx, P } = this; const t = this.t;
    const N = 220;
    const mem: V[] = [];
    for (let i = 0; i < N; i++) { const th = (i / N) * TAU; mem.push(polar(th, this.memR(th, S))); }

    // objective gradient (under everything inside)
    const O = polar(TH_O, this.memR(TH_O, S));
    const objA = S.obj * (1 - 0.45 * S.loop);
    // cytoplasm
    ctx.beginPath(); smoothClosed(ctx, mem);
    const g = ctx.createRadialGradient(0, 0, 0.1, 0, 0, R0 * 1.05);
    g.addColorStop(0, rgba(mixc(P.haem, P.eosin, S.lobe * 0.35), 0.035));
    g.addColorStop(1, rgba(mixc(P.haem, P.eosin, S.lobe * 0.35), 0.12));
    ctx.fillStyle = g; ctx.fill();
    // cytoplasm granules (inside) and suspended particles in the surroundings (outside)
    for (const [a, d, u, v] of this.granules) {
      const th = a + Math.sin(t * 0.05 + u * 9) * 0.08;
      const inside = v < 0.72;
      const rr = inside ? d * 0.93 * this.memR(th, S) : this.memR(th, S) + 0.04 + d * 0.5;
      const x = Math.cos(th) * rr + Math.sin(t * 0.3 + u * 20) * 0.006, y = Math.sin(th) * rr + Math.cos(t * 0.27 + v * 20) * 0.006;
      const sz = px * (inside ? 1.1 + u * 1.3 : 1 + u);
      ctx.fillStyle = rgba(inside ? P.haem : P.ink3, inside ? 0.28 + u * 0.2 : 0.35);
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
    if (objA > 0.001) {
      ctx.save(); ctx.clip();
      const og = ctx.createRadialGradient(O[0], O[1], 0, O[0], O[1], 1.05 * objA + 0.01);
      og.addColorStop(0, rgba(P.eosin, 0.22 * objA)); og.addColorStop(1, rgba(P.eosin, 0));
      ctx.fillStyle = og; ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
      // isolines of the gradient, drifting outward
      for (let q = 0; q < 4; q++) {
        const f = (t * 0.07 + q / 4) % 1;
        ctx.beginPath(); ctx.arc(O[0], O[1], (0.08 + f * 0.9) * objA, 0, TAU);
        ctx.setLineDash([px * 2, px * 5]); ctx.lineWidth = px; ctx.strokeStyle = rgba(P.eosin, 0.35 * objA * (1 - f)); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    // pores: [angle, half-width, openness]
    const gapIn = S.engulf * (1 - S.pinch);
    const pores: [number, number, number][] = [
      [TH_IN, 0.05, 1], [TH_IN, 0.13, gapIn],
      [TH_A, 0.05, 1 - S.newOut], [TH_B, 0.05, S.newOut], [TH_C, 0.05, S.newOut],
    ];
    this.drawMembrane(mem, pores, px, S);

    // coordination (nucleus) → dissolves into a mesh
    this.drawNucleus(S, px);
    // plans (strands) from coordination to each step
    const occ = this.occupants(S);
    this.drawStrands(S, px, occ);
    // mesh of coordination across every step
    if (S.mesh > 0) { this.drawMesh(S, px); this.drawJunctions(S, px); }
    // alternatives
    if (S.explore > 0 && S.dissolve < 1) this.drawFilaments(S, px, occ.agent[0]);
    // objective source
    if (objA > 0.01) {
      ctx.beginPath(); ctx.arc(O[0], O[1], 0.02 + 0.006 * Math.sin(t * 2), 0, TAU); ctx.fillStyle = rgba(P.eosin, objA); ctx.fill();
      ctx.beginPath(); ctx.arc(O[0], O[1], 0.034, 0, TAU); ctx.lineWidth = px; ctx.strokeStyle = rgba(P.eosin, objA * 0.7); ctx.stroke();
    }
    // feedback loop
    if (S.loop > 0) this.drawLoop(S, px, occ.people);
    // flow of inputs → outputs
    this.drawFlow(S, px);
    // people
    occ.people.forEach((p, i) => this.drawPerson(p, 0.072, px, i));
    // agents
    this.drawAgents(S, px, occ);
  }

  drawMembrane(mem: V[], pores: [number, number, number][], px: number, S: ReturnType<Specimen['st']>) {
    const { ctx, P } = this; const N = mem.length;
    const open = (th: number) => pores.some(([a, w, o]) => o > 0.02 && Math.abs(angDiff(th, a)) < w * o);
    const ink = rgba(P.ink, 0.9);
    for (const [off, lw, col] of [[0, 1.35, ink], [-5.5, 0.9, rgba(P.ink2, 0.75)]] as const) {
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= N; i++) {
        const th = (i / N) * TAU; const m = mem[i % N];
        const r = Math.hypot(m[0], m[1]); const f = (r + off * px) / r;
        const x = m[0] * f, y = m[1] * f;
        if (open(th)) { pen = false; continue; }
        if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
      }
      ctx.lineWidth = lw * px; ctx.strokeStyle = col as string; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    }
    // pore channels: short radial ticks at each open pore's edges
    ctx.beginPath();
    for (const [a, w, o] of pores) {
      if (o < 0.05 || w > 0.1) continue;
      for (const sgn of [-1, 1]) {
        const th = a + sgn * w * o; const r = this.memR(th, S);
        const p1 = polar(th, r + 3 * px), p2 = polar(th, r - 9 * px);
        ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
      }
    }
    ctx.lineWidth = px * 1.1; ctx.strokeStyle = rgba(P.ink, 0.8); ctx.stroke();
    // engulfment: the boundary folds around the agent and closes (neck → vesicle)
    if (S.engulf > 0 && S.fuse < 1) this.drawEngulf(S, px);
  }

  agentVesicle(S: ReturnType<Specimen['st']>): { c: V; r: number } {
    const outer = polar(TH_IN, R0 + 0.07);
    const inner = polar(TH_IN, R0 - 0.19);
    let c = lerpV(outer, inner, S.engulf);
    if (S.toStep > 0) c = quad(inner, [-0.3, 0.38], STEP[1], S.toStep);
    return { c, r: 0.066 };
  }

  drawEngulf(S: ReturnType<Specimen['st']>, px: number) {
    const { ctx, P } = this;
    const { c, r } = this.agentVesicle(S);
    const gap = 0.13 * S.engulf * (1 - S.pinch);
    const aOut = Math.atan2(-c[1], -c[0]) + Math.PI; // direction from vesicle centre towards the cell edge (outward)
    const toEdge = Math.atan2(polar(TH_IN, R0)[1] - c[1], polar(TH_IN, R0)[0] - c[0]);
    const neck = gap > 0.002 ? clamp(gap * 5.5, 0, 1.2) : 0;
    const alpha = 1 - S.fuse;
    for (const [off, lw, col] of [[0, 1.35, rgba(P.ink, 0.9 * alpha)], [5.5, 0.9, rgba(P.ink2, 0.75 * alpha)]] as const) {
      const rr = r + off * px;
      ctx.beginPath();
      ctx.arc(c[0], c[1], rr, toEdge + neck, toEdge - neck + TAU);
      if (neck > 0) {
        // neck walls: from the arc ends to the membrane gap edges
        const e1 = polar(TH_IN - gap, this.memR(TH_IN - gap, S) + (off ? -5.5 * px : 0) * -1);
        const e2 = polar(TH_IN + gap, this.memR(TH_IN + gap, S) + (off ? -5.5 * px : 0) * -1);
        const a1: V = [c[0] + Math.cos(toEdge - neck) * rr, c[1] + Math.sin(toEdge - neck) * rr];
        const a2: V = [c[0] + Math.cos(toEdge + neck) * rr, c[1] + Math.sin(toEdge + neck) * rr];
        ctx.moveTo(a1[0], a1[1]); ctx.quadraticCurveTo(lerp(a1[0], e1[0], 0.6), lerp(a1[1], e1[1], 0.2), e1[0], e1[1]);
        ctx.moveTo(a2[0], a2[1]); ctx.quadraticCurveTo(lerp(a2[0], e2[0], 0.6), lerp(a2[1], e2[1], 0.2), e2[0], e2[1]);
      }
      ctx.lineWidth = lw * px; ctx.strokeStyle = col; ctx.stroke();
    }
    void aOut;
  }

  drawNucleus(S: ReturnType<Specimen['st']>, px: number) {
    const { ctx, P } = this; const t = this.t;
    const env = 1 - S.dissolve;
    if (env > 0.01) {
      const pts: V[] = [];
      for (let i = 0; i < 60; i++) { const th = (i / 60) * TAU; const r = RN * (1 + 0.04 * Math.sin(3 * th + t * 0.8) + 0.03 * Math.sin(4 * th - t * 0.5)); pts.push([NUC[0] + Math.cos(th) * r, NUC[1] + Math.sin(th) * r]); }
      ctx.fillStyle = rgba(P.haem, 0.1 * env);
      ctx.beginPath(); smoothClosed(ctx, pts); ctx.fill();
      ctx.setLineDash(S.dissolve > 0 ? [px * 10 * env, px * 14 * S.dissolve] : []);
      ctx.lineWidth = px * 1.2; ctx.strokeStyle = rgba(P.ink, 0.85 * env); ctx.stroke();
      const inner = pts.map(([x, y]) => [NUC[0] + (x - NUC[0]) * 0.9, NUC[1] + (y - NUC[1]) * 0.9] as V);
      ctx.beginPath(); smoothClosed(ctx, inner); ctx.lineWidth = px * 0.8; ctx.strokeStyle = rgba(P.ink2, 0.6 * env); ctx.stroke();
      ctx.setLineDash([]);
      // nucleolus
      ctx.beginPath(); ctx.arc(NUC[0] + 0.03, NUC[1] - 0.02, 0.026, 0, TAU); ctx.fillStyle = rgba(P.ink, 0.7 * env); ctx.fill();
    }
    // chromatin: stays in the nucleus, then flies out to become the mesh
    for (const d of this.nucDots) {
      const k = spring(clamp((S.mesh - d.d * 0.35) / 0.65));
      let p: V = [d.a[0] + Math.sin(t * 0.9 + d.u * 20) * 0.004, d.a[1] + Math.cos(t * 0.7 + d.u * 17) * 0.004];
      if (k > 0) { const e = MESH_E[d.e]; const q = this.meshPoint(e, d.u); p = lerpV(p, q, k); }
      const col = mixc(P.ink, P.eosin, clamp(k * 1.3));
      ctx.fillStyle = rgba(col, 0.8);
      const sz = px * (1.6 + (1 - k) * 0.4);
      ctx.fillRect(p[0] - sz / 2, p[1] - sz / 2, sz, sz);
    }
  }

  meshPoint(e: [number, number], u: number): V {
    const a = MESH_N[e[0]], b = MESH_N[e[1]];
    const m: V = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1;
    const bend = ((e[0] * 7 + e[1] * 3) % 5 - 2) * 0.03 + 0.01;
    const c: V = [m[0] - (dy / L) * bend, m[1] + (dx / L) * bend];
    const q = quad(a, c, b, u);
    const wig = Math.sin(u * Math.PI * 2 + e[0] + e[1] * 2) * 0.014 * Math.sin(u * Math.PI);
    return [q[0] - (dy / L) * wig, q[1] + (dx / L) * wig];
  }

  drawMesh(S: ReturnType<Specimen['st']>, px: number) {
    const { ctx, P } = this; const t = this.t;
    MESH_E.forEach((e, i) => {
      const a = MESH_N[e[0]];
      const d0 = Math.hypot(a[0] - NUC[0], a[1] - NUC[1]);
      const k = ss(d0 * 0.9, d0 * 0.9 + 0.55, S.mesh * 1.4);
      if (k <= 0) return;
      ctx.beginPath();
      const n = 18;
      for (let j = 0; j <= Math.round(n * k); j++) { const p = this.meshPoint(e, j / n); j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.lineWidth = px * (1.2 + ((i * 5) % 4) * 0.7); ctx.strokeStyle = rgba(P.eosin, 0.5 * k); ctx.lineCap = 'round'; ctx.stroke();
      ctx.lineWidth = px * 0.6; ctx.strokeStyle = rgba(P.paper, 0.5 * k); ctx.stroke();
      // pulses along the tube
      if (k > 0.95) {
        const u = (t * 0.28 + i * 0.37) % 1; const p = this.meshPoint(e, i % 2 ? u : 1 - u);
        ctx.beginPath(); ctx.arc(p[0], p[1], px * 2.2, 0, TAU); ctx.fillStyle = rgba(P.eosin, 0.9); ctx.fill();
      }
    });
  }

  drawJunctions(S: ReturnType<Specimen['st']>, px: number) {
    const { ctx, P } = this;
    for (let i = 4; i < MESH_N.length; i++) {
      const n = MESH_N[i]; const d0 = Math.hypot(n[0] - NUC[0], n[1] - NUC[1]);
      const k = ss(d0 * 0.9 + 0.2, d0 * 0.9 + 0.6, S.mesh * 1.4); if (k <= 0) continue;
      ctx.beginPath(); ctx.arc(n[0], n[1], px * 3.4 * k, 0, TAU); ctx.fillStyle = rgba(P.paper, 0.95); ctx.fill();
      ctx.lineWidth = px * 1.2; ctx.strokeStyle = rgba(P.eosin, 0.9 * k); ctx.stroke();
    }
  }

  /** who stands where: people positions and agent positions */
  occupants(S: ReturnType<Specimen['st']>) {
    const t = this.t;
    const outPos = (i: number): V => { const th = PEOPLE_OUT[i]; return polar(th, this.memR(th, S) - 0.005); };
    const w = (i: number): V => [Math.sin(t * 0.8 + i * 2) * 0.006, Math.cos(t * 0.6 + i) * 0.006];
    const k = spring(S.out);
    const p0 = lerpV(STEP[0], outPos(0), k);
    const p1base = lerpV(STEP[1], ASIDE, spring(S.aside));
    const p1 = lerpV(p1base, outPos(1), k);
    const p2 = lerpV(STEP[2], outPos(2), k);
    const people = [add(p0, w(0)), add(p1, w(1)), add(p2, w(2))];
    // agents
    const agent: { p: V; ang: number; tail: number; a: number }[] = [];
    let a0: V, ang = 0, tail = 1;
    if (S.aIn < 1) {
      const from: V = [-1.2, -0.06], to = polar(TH_IN, R0 + 0.075);
      const e = S.aIn;
      a0 = [lerp(from[0], to[0], e), lerp(from[1], to[1], e) + Math.sin(e * 9 + t * 2) * 0.02 * (1 - e)];
      ang = Math.sin(t * 3) * 0.15 * (1 - e);
    } else if (S.fuse < 1 || S.toStep < 1) {
      a0 = this.agentVesicle(S).c; tail = 1 - S.engulf; ang = S.toStep > 0 ? Math.atan2(STEP[1][1] - a0[1], STEP[1][0] - a0[0]) * (1 - S.toStep) : 0;
    } else a0 = STEP[1];
    const vis = S.aIn > 0 ? 1 : 0;
    if (S.divide <= 0) agent.push({ p: add(a0, w(5)), ang, tail, a: vis });
    else {
      const targets = [STEP[0], STEP[1], STEP[2], S4];
      targets.forEach((tg, i) => {
        const kk = i === 1 ? 1 : spring(clamp((S.divide - (i === 3 ? 0.25 : 0)) / 0.75));
        agent.push({ p: add(lerpV(STEP[1], tg, kk), w(6 + i)), ang: 0, tail: 0, a: i === 1 ? 1 : clamp(kk * 3) });
      });
    }
    return { people, agent };
  }

  drawStrands(S: ReturnType<Specimen['st']>, px: number, occ: ReturnType<Specimen['occupants']>) {
    const { ctx, P } = this; const t = this.t;
    const env = 1 - S.dissolve;
    if (env <= 0.01) return;
    const from: V = [NUC[0], NUC[1] + RN * 0.95];
    const strands: { to: V; frac: number; a: number }[] = [
      { to: occ.people[0], frac: 1, a: 1 - S.out },
      { to: occ.people[1], frac: 1 - S.aside, a: 1 - S.aside },
      { to: occ.people[2], frac: 1, a: 1 - S.out },
    ];
    if (S.plan2 > 0) strands.push({ to: occ.agent[0].p, frac: S.plan2 * (1 - S.wither), a: 1 - S.wither * 0.6 });
    for (const [i, st] of strands.entries()) {
      if (st.frac <= 0.01 || st.a <= 0.01) continue;
      const to: V = [st.to[0], st.to[1] - 0.075];
      const c: V = [(from[0] + to[0]) / 2 + (to[0] - from[0]) * 0.1, (from[1] + to[1]) / 2 + (i === 3 ? S.wither * 0.08 : 0)];
      ctx.beginPath();
      const n = 36; const m = Math.round(n * st.frac);
      for (let j = 0; j <= m; j++) {
        const u = j / n; const p = quad(from, c, to, u);
        const dx = to[0] - from[0], dy = to[1] - from[1]; const L = Math.hypot(dx, dy) || 1;
        const wv = Math.sin(u * 16 + t * 2.2 + i) * 0.009 * Math.sin(u * Math.PI);
        const x = p[0] - (dy / L) * wv, y = p[1] + (dx / L) * wv;
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.lineWidth = px * 1.05; ctx.strokeStyle = rgba(P.ink2, 0.85 * st.a * env); ctx.lineCap = 'round'; ctx.stroke();
      // transcripts travelling down the strand
      if (st.frac > 0.98) for (let q = 0; q < 2; q++) {
        const u = (t * 0.32 + q * 0.5 + i * 0.21) % 1; const p = quad(from, c, to, u);
        ctx.fillStyle = rgba(P.ink, 0.85 * st.a * env); ctx.fillRect(p[0] - px * 1.8, p[1] - px * 1.8, px * 3.6, px * 3.6);
      }
    }
  }

  filamentPath(i: number, S: ReturnType<Specimen['st']>, from: V): V[] {
    const t = this.t;
    const O = polar(TH_O, this.memR(TH_O, S));
    const isSel = i === SEL;
    const base = isSel ? Math.atan2(O[1] - from[1], O[0] - from[0]) : FIL[i];
    const grow = S.explore * (isSel ? 1 : 1 - S.select);
    let L = (0.12 + ((i * 37) % 10) / 90) * grow;
    if (isSel) L = lerp(L, Math.hypot(O[0] - from[0], O[1] - from[1]) - 0.05, S.select);
    const pts: V[] = [];
    const n = 16;
    for (let j = 0; j <= n; j++) {
      const u = j / n; const d = u * L;
      const wob = Math.sin(u * 7 + i * 2 + t * 1.4) * 0.018 * u * (1 - (isSel ? S.select * 0.7 : 0));
      const a = base + wob * 3;
      pts.push([from[0] + Math.cos(a) * d - Math.sin(a) * wob, from[1] + Math.sin(a) * d + Math.cos(a) * wob]);
    }
    return pts;
  }

  drawFilaments(S: ReturnType<Specimen['st']>, px: number, agent: { p: V }) {
    const { ctx, P } = this;
    const fade = 1 - S.mesh;
    FIL.forEach((_, i) => {
      const pts = this.filamentPath(i, S, agent.p);
      const isSel = i === SEL;
      ctx.beginPath(); pts.forEach((p, j) => (j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.lineWidth = px * (isSel ? 1.2 + S.select * 2.2 : 1.1);
      ctx.strokeStyle = rgba(P.eosin, (isSel ? 0.55 + S.select * 0.4 : 0.55) * fade);
      ctx.setLineDash(isSel && S.select > 0.5 ? [] : [px * 3, px * 3]);
      ctx.lineCap = 'round'; ctx.stroke(); ctx.setLineDash([]);
      // branch tips
      const tip = pts[pts.length - 1];
      ctx.beginPath(); ctx.arc(tip[0], tip[1], px * 2.2, 0, TAU); ctx.fillStyle = rgba(P.eosin, 0.8 * fade * (isSel ? 1 : 1 - S.select)); ctx.fill();
    });
  }

  loopPath(S: ReturnType<Specimen['st']>): V[] {
    const pts: V[] = [];
    const n = 160;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU;
      let b = 1; for (const a of PEOPLE_OUT) b *= 1 - gauss(angDiff(th, a), 0.32);
      pts.push(polar(th, this.memR(th, S) + 0.02 + 0.13 * b));
    }
    return pts;
  }

  drawLoop(S: ReturnType<Specimen['st']>, px: number, people: V[]) {
    const { ctx, P } = this; const t = this.t;
    const pts = this.loopPath(S);
    const m = Math.round(pts.length * S.loop);
    ctx.beginPath();
    for (let i = 0; i <= m; i++) { const p = pts[(i + 60) % pts.length]; i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.setLineDash([px * 6, px * 5]); ctx.lineDashOffset = -t * 14 * px;
    ctx.lineWidth = px * 1.1; ctx.strokeStyle = rgba(P.ink, 0.75); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    // signals travelling round the loop
    if (S.loop > 0.95) for (let q = 0; q < 3; q++) {
      const p = pts[Math.floor(((t * 0.06 + q / 3) % 1) * pts.length)];
      ctx.beginPath(); ctx.arc(p[0], p[1], px * 2.6, 0, TAU); ctx.fillStyle = rgba(P.ink, 0.9); ctx.fill();
    }
    // each person reaches in to the nearest step
    ctx.beginPath();
    people.forEach((p, i) => {
      const tg = MESH_N[[5, 7, 2][i]];
      const q = lerpV(p, tg, 0.55 * S.loop);
      ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
    });
    ctx.setLineDash([px * 2, px * 4]); ctx.lineWidth = px; ctx.strokeStyle = rgba(P.ink2, 0.7 * S.loop); ctx.stroke(); ctx.setLineDash([]);
  }

  // inputs → steps → outputs
  drawFlow(S: ReturnType<Specimen['st']>, px: number) {
    const { ctx, P } = this;
    const pin = polar(TH_IN, this.memR(TH_IN, S));
    const pa = polar(TH_A, this.memR(TH_A, S));
    const pb = polar(TH_B, this.memR(TH_B, S));
    const pc = polar(TH_C, this.memR(TH_C, S));
    const L = S.newOut;
    const N = 54;
    for (let i = 0; i < N; i++) {
      const toB = i % 2 === 0;
      const exitP = L > 0 ? (toB ? pb : pc) : pa;
      const exitTh = L > 0 ? (toB ? TH_B : TH_C) : TH_A;
      const nodes: V[] = [
        [-1.3, 0.02 + ((i * 53) % 17 - 8) / 34], [pin[0] - 0.12, pin[1] + ((i * 29) % 7 - 3) / 90], pin, STEP[0], STEP[1], STEP[2],
        lerpV(lerpV(STEP[2], pa, 0.5), S4, L), lerpV(pa, exitP, L),
        lerpV(polar(TH_A, 1.3), polar(exitTh, 1.3), L),
      ];
      nodes[nodes.length - 1][1] += ((i * 31) % 13 - 6) / 40;
      // path time weights (outside legs quick, steps linger)
      const u = (this.phase * 0.035 + i / N) % 1;
      const segs = nodes.length - 1;
      const f = u * segs; const k = Math.min(segs - 1, Math.floor(f)); let q = f - k;
      q = q - Math.sin(q * TAU) / TAU * 0.85; // linger at nodes
      const a = nodes[k], b = nodes[k + 1];
      const jit = Math.sin(i * 12.9 + this.t * 1.3) * (k <= 1 || k >= 7 ? 0.05 : 0.02);
      const dx = b[0] - a[0], dy = b[1] - a[1]; const Ld = Math.hypot(dx, dy) || 1;
      const x = lerp(a[0], b[0], q) - (dy / Ld) * jit, y = lerp(a[1], b[1], q) + (dx / Ld) * jit;
      // appearance by stage
      if (k <= 2) {
        ctx.beginPath(); ctx.arc(x, y, px * 3.6, 0, TAU); ctx.lineWidth = px * 1.1; ctx.strokeStyle = rgba(P.ink, 0.8); ctx.stroke();
      } else if (k <= 5) {
        ctx.beginPath(); ctx.arc(x, y, px * (2.4 + (k - 3) * 0.7), 0, TAU); ctx.fillStyle = rgba(P.ink, 0.85); ctx.fill();
      } else {
        const isNew = L > 0.5;
        const col = isNew ? P.eosin : P.ink;
        if (isNew && !toB) {
          // output C: a pair
          ctx.beginPath(); ctx.arc(x - px * 3, y, px * 2.6, 0, TAU); ctx.arc(x + px * 3, y, px * 2.6, 0, TAU); ctx.fillStyle = rgba(col, 0.9); ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(x, y, px * 5.5, 0, TAU); ctx.lineWidth = px * 1.1; ctx.strokeStyle = rgba(col, 0.9); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, px * 2.4, 0, TAU); ctx.fillStyle = rgba(col, 0.9); ctx.fill();
        }
      }
    }
  }

  drawPerson(p: V, r: number, px: number, i: number) {
    const { ctx, P } = this; const t = this.t;
    const pts: V[] = [];
    for (let j = 0; j < 36; j++) { const th = (j / 36) * TAU; const rr = r * (1 + 0.06 * Math.sin(3 * th + t * 1.1 + i * 2) + 0.04 * Math.sin(2 * th - t * 0.7 + i)); pts.push([p[0] + Math.cos(th) * rr, p[1] + Math.sin(th) * rr]); }
    ctx.beginPath(); smoothClosed(ctx, pts);
    ctx.fillStyle = rgba(this.P.paper, 0.92); ctx.fill();
    ctx.fillStyle = rgba(P.haem, 0.12); ctx.fill();
    ctx.lineWidth = px * 1.2; ctx.strokeStyle = rgba(P.ink, 0.9); ctx.stroke();
    // nucleus: a small stippled disc
    const R = rng(90 + i);
    ctx.fillStyle = rgba(P.haem, 0.95);
    for (let q = 0; q < 22; q++) { const a = R() * TAU, d = Math.sqrt(R()) * r * 0.42; ctx.fillRect(p[0] + Math.cos(a) * d - px, p[1] - r * 0.08 + Math.sin(a) * d - px, px * 2, px * 2); }
  }

  drawAgents(S: ReturnType<Specimen['st']>, px: number, occ: ReturnType<Specimen['occupants']>) {
    const { ctx, P } = this; const t = this.t;
    for (const [i, ag] of occ.agent.entries()) {
      if (ag.a <= 0.01) continue;
      const [x, y] = ag.p;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ag.ang + Math.sin(t * 1.3 + i) * 0.06);
      const rx = 0.066, ry = 0.034;
      // tail (flagellum)
      if (ag.tail > 0.02) {
        ctx.beginPath();
        for (let j = 0; j <= 20; j++) { const u = j / 20; const xx = -rx - u * 0.1 * ag.tail; const yy = Math.sin(u * 9 - t * 9) * 0.012 * u; j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
        ctx.lineWidth = px * 1.1; ctx.strokeStyle = rgba(P.eosin, 0.9 * ag.a); ctx.stroke();
      }
      // body: a capsule with folded inner membrane
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
      ctx.fillStyle = rgba(P.paper, 0.9 * ag.a); ctx.fill();
      ctx.fillStyle = rgba(P.eosin, 0.2 * ag.a); ctx.fill();
      ctx.lineWidth = px * 1.4; ctx.strokeStyle = rgba(P.eosin, ag.a); ctx.stroke();
      ctx.beginPath();
      for (let j = 0; j <= 10; j++) { const xx = -rx * 0.72 + (j / 10) * rx * 1.44; const yy = (j % 2 ? 1 : -1) * ry * 0.55; j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.lineWidth = px * 0.9; ctx.strokeStyle = rgba(P.eosin, 0.8 * ag.a); ctx.stroke();
      ctx.restore();
    }
  }

  // ── labels (drawn in screen space, allowed outside the aperture like a plate's annotations) ──
  drawLabels(S: ReturnType<Specimen['st']>, s: number) {
    const { ctx, P, dpr } = this;
    const win = (k: number) => ss(k - 1 + 0.06, k - 1 + 0.2, s) * (1 - ss(k - 0.03, k + 0.1, s));
    const occ = this.occupants(S);
    const O = polar(TH_O, this.memR(TH_O, S));
    const strandMid = (to: V): V => [lerp(NUC[0], to[0], 0.55) + 0.02, lerp(NUC[1] + RN, to[1] - 0.075, 0.55)];
    const exitB = polar(TH_B, this.memR(TH_B, S) + 0.16), exitC = polar(TH_C, this.memR(TH_C, S) + 0.16);
    const sel = S.explore > 0 ? this.filamentPath(SEL, S, occ.agent[0].p) : null;
    const alt = S.explore > 0 ? this.filamentPath(1, S, occ.agent[0].p) : null;
    const loopP = this.loopPath(S)[Math.round(160 * ((TAU - 1.25) / TAU))];
    const m = this.mobile ? 0.72 : 1;
    const L: [string, V, number, number, number][] = [
      ['inputs', [-0.93, 0.02], 26, -64, win(1) + win(2) * (1 - S.engulf)],
      ['people', add(occ.people[0], [0, -0.07]), -26, -38, win(1)],
      ['coordination', [NUC[0] + RN, NUC[1] - 0.02], 30, -12, win(1)],
      ['plan', strandMid(STEP[2]), 34, 0, win(1)],
      ['output A', [0.93, 0.18], 4, 34, win(1)],
      ['agent', add(occ.agent[0].p, [0, -0.04]), -6, -34, win(2)],
      ['plan', strandMid(STEP[1]), 30, 4, win(2) * S.plan2],
      ['objective', O, 20, 30, win(3) * S.obj],
      ['alternatives', alt ? alt[alt.length - 1] : [0, 0], -54, -26, win(3) * S.explore * (1 - S.select * 0.8)],
      ['selected plan', sel ? sel[10] : [0, 0], 30, -4, win(3) * S.select],
      ['coordination', MESH_N[5], -46, -30, win(4) * S.mesh],
      ['agents', add(occ.agent[3]?.p ?? S4, [0.03, -0.03]), 26, -26, win(4) * S.divide],
      ['people', add(occ.people[1], [0, 0.07]), -30, 30, win(4) * S.out],
      ['feedback loop', loopP, 30, -26, win(4) * S.loop],
      ['output B', exitB, 12, -20, win(4) * S.newOut],
      ['output C', exitC, 26, 8, win(4) * S.newOut],
    ];
    if (this.plate != null) L.forEach((l) => (l[4] = 0));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `italic 380 ${this.mobile ? 12.5 : 15}px "Fraunces Variable", Georgia, serif`;
    ctx.textBaseline = 'middle';
    for (const [text, anchor, dx0, dy0, a] of L) {
      if (a <= 0.01) continue;
      const [ax, ay] = this.toScreen(anchor);
      const dx = dx0 * m, dy = dy0 * m;
      const tx = ax + dx, ty = ay + dy;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx - Math.sign(dx) * 3, ty);
      ctx.lineWidth = 0.75; ctx.strokeStyle = rgba(P.ink2, 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(ax, ay, 1.6, 0, TAU); ctx.fillStyle = rgba(P.ink, 1); ctx.fill();
      const tw = ctx.measureText(text).width;
      let left = dx < 0;
      if (!left && tx + 3 + tw > this.w - 8) left = true; else if (left && tx - 3 - tw < 8) left = false;
      ctx.textAlign = left ? 'right' : 'left';
      let lx = tx + (left ? -3 : 3);
      lx = left ? Math.max(tw + 8, Math.min(this.w - 8, lx)) : Math.min(this.w - 8 - tw, Math.max(8, lx));
      ctx.lineWidth = 4; ctx.strokeStyle = rgba(P.paper, 0.9); ctx.lineJoin = 'round'; ctx.strokeText(text, lx, ty);
      ctx.fillStyle = rgba(P.ink, 1); ctx.fillText(text, lx, ty);
      ctx.globalAlpha = 1;
    }
  }
}
