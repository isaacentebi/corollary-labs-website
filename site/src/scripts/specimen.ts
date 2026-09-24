// The specimen: one firm drawn as a living cell, seen through a round aperture.
// Everything is a function of the story position `s` (scroll) and time `t` (idle life), so it scrubs both ways.
//   s < 0      hero: the firm, alive (labelled inputs / firm / output A)
//   0 → 1      fig 1  inputs, three people in sequence, coordination (a ring) issuing plans, output A
//   1 → 2      fig 2  an agent arrives with the inputs; the boundary reaches in along the flow and closes
//                     around it at the middle step; that step's person steps aside and stays attached to it;
//                     the plan still reaches the middle step
//   2 → 3      fig 3  the plan to the middle step is withdrawn; an objective; alternatives; one selected
//   3 → 4      fig 4  coordination opens into a mesh; an agent at every step; people inside, on a loop that
//                     runs out to the environment and back; the boundary deforms and grows a lobe;
//                     A closes, B and C open, more passes through
//   4 → 5      fig 5  pull back into the tissue; the change spreads firm to firm; the aperture opens
import { TAU, clamp, ss, lerp, spring, gauss, angDiff, polar, rng, palette, rgba, mixc, smoothClosed, type Palette, type RGB } from './draw';

// fig 4 is drawn on a dark umber ground: the palette is mixed toward this as `dark` rises
const DARK: Palette = { paper: [30, 27, 22], paper3: [52, 47, 39], ink: [240, 233, 219], ink2: [194, 184, 166], ink3: [138, 130, 114], accent: [219, 166, 78], accent2: [122, 90, 38], body: [214, 200, 172] };
const mixP = (a: Palette, b: Palette, t: number): Palette => { const o: any = {}; for (const k in a) o[k] = mixc((a as any)[k] as RGB, (b as any)[k] as RGB, t); return o; };
import { makeTissue, stepTissue, drawTissue, type Tissue } from './tissue';

type V = [number, number];
const R0 = 0.7;
const TH_IN = Math.PI - 0.12;
const TH_A = 0.22, TH_B = -0.9, TH_C = -0.42, TH_LOBE = -0.66, TH_O = 1.05;
const STEP: V[] = [[-0.34, 0.1], [0, 0.13], [0.34, 0.1]];
const S4: V = [0.5, -0.3];
const NUC: V = [-0.02, -0.33];
const RN = 0.12;
const ASIDE: V = [0.17, 0.12]; // fig 2: the person keeps working on the line, beside the agent
const PEOPLE_IN = [-2.2, 2.2, 0.5]; // angles at which the people sit inside the boundary in fig 4
const MESH_N: V[] = [STEP[0], STEP[1], STEP[2], S4, NUC, [-0.2, -0.1], [0.22, -0.14], [-0.16, 0.36], [0.2, 0.33],
  [-0.46, -0.16], [0.3, -0.48], [-0.4, 0.33], [0.46, 0.18], [-0.02, -0.08]];
const MESH_E: [number, number][] = [[4, 5], [4, 6], [5, 0], [5, 13], [13, 1], [6, 13], [6, 3], [2, 3], [0, 7], [7, 1], [1, 8], [8, 2],
  [6, 2], [4, 10], [10, 3], [5, 9], [9, 0], [0, 11], [11, 7], [2, 12], [12, 3], [8, 12], [4, 9]];
const FIL = [-2.5, -1.75, -0.35, 0.3, 2.35, 3.0]; // explored directions; index 3 is replaced by the direction to the objective
const SEL = 3;
// the channel the boundary makes from the input pore to the middle step (fig 2)
const TUBE_C: V = [-0.36, 0.36], TUBE_B: V = STEP[1];

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const lerpV = (a: V, b: V, t: number): V => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const quad = (a: V, c: V, b: V, t: number): V => { const u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; };
const quadD = (a: V, c: V, b: V, t: number): V => [2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]), 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1])];

export interface Label { id: string; text: string; letter: string; key: boolean; x: number; y: number; ax: number; ay: number; a: number }
export type LayoutFn = (w: number, h: number, compose: number) => { cx: number; cy: number; R: number };
export interface SpecimenOpts { canvas: HTMLCanvasElement; plate?: number; reduced?: boolean; layout?: LayoutFn; labels?: boolean }
type St = ReturnType<Specimen['st']>;

export class Specimen {
  c: HTMLCanvasElement; ctx: CanvasRenderingContext2D; P: Palette; P0: Palette;
  w = 0; h = 0; dpr = 1; cx = 0; cy = 0; R = 1;
  s = -1; sTarget = -1; t = 0; phase = 0; born = 0;
  running = false; raf = 0; last = 0;
  reduced: boolean; plate?: number; withLabels: boolean;
  pointer = { x: 9, y: 9, on: 0, tx: 9, ty: 9 };
  tissue: Tissue; granules: [number, number, number][] = [];
  layoutFn?: LayoutFn;
  mobile = false; maskBottom = 0; heroA = -1;
  onLabels?: (l: Label[]) => void;

  constructor(o: SpecimenOpts) {
    this.c = o.canvas; this.ctx = o.canvas.getContext('2d')!; this.P0 = palette(); this.P = this.P0;
    this.reduced = !!o.reduced; this.plate = o.plate; this.layoutFn = o.layout; this.withLabels = !!o.labels;
    if (o.plate != null) { this.s = this.sTarget = o.plate; }
    this.tissue = makeTissue(7, 38, 26, 1.9, { divide: 0.16, shrink: 0.12, reach: 9 });
    const G = rng(23);
    for (let i = 0; i < 70; i++) this.granules.push([G() * TAU, Math.sqrt(G()), G()]);
    this.resize();
    this.born = performance.now();
  }

  resize() {
    const r = this.c.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr);
    this.mobile = this.w < 760;
    this.place(this.st(this.s).compose);
    if (!this.running) this.draw();
  }
  place(compose: number) {
    const L = this.layoutFn ? this.layoutFn(this.w, this.h, compose) : { cx: this.w / 2, cy: this.h / 2, R: Math.min(this.w, this.h) * 0.46 };
    this.cx = L.cx; this.cy = L.cy; this.R = L.R;
  }

  start() {
    if (this.running) return; this.running = true; this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now;
      this.tick(dt); this.draw();
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
    this.phase += dt * lerp(1, 1.8, ss(3.62, 3.92, this.s));
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
      grow, hero: this.heroA >= 0 ? this.heroA : 1 - ss(-0.45, -0.1, s),
      aIn: ss(1.0, 1.24, s), tube: ss(1.1, 1.34, s), aside: ss(1.2, 1.42, s), ride: ss(1.3, 1.6, s),
      close: ss(1.6, 1.8, s), fuse: ss(1.8, 1.93, s), tether: 0,
      wither: ss(2.03, 2.3, s), obj: ss(2.12, 2.45, s), explore: ss(2.33, 2.68, s), select: ss(2.62, 2.95, s),
      compose: ss(3.02, 3.13, s), dark: this.plate == null ? ss(3.03, 3.09, s) * (1 - ss(3.97, 4.04, s)) : 0,
      dissolve: ss(3.04, 3.3, s), mesh: ss(3.1, 3.55, s), divide: ss(3.22, 3.56, s), out: ss(3.3, 3.62, s),
      lobe: ss(3.4, 3.8, s), newOut: ss(3.62, 3.9, s), loop: ss(3.5, 3.86, s),
      zoom: ss(4.0, 4.42, s), detail: 1 - ss(4.08, 4.3, s), tissueA: ss(4.02, 4.24, s),
      stain: 0.85 * clamp((s - 4.25) / 0.72) + 0.15 * clamp(s - 5), open: ss(4.5, 4.9, s),
    };
  }

  memR(th: number, S: St): number {
    const t = this.t;
    let r = R0 * (1 + 0.022 * Math.sin(3 * th + t * 0.45) + 0.015 * Math.sin(5 * th - t * 0.62 + 1.3) + 0.01 * Math.sin(2 * th + t * 0.31 + 2));
    r *= 0.25 + 0.75 * S.grow;
    r += S.lobe * 0.21 * gauss(angDiff(th, TH_LOBE), 0.5);
    r -= S.lobe * 0.03 * gauss(angDiff(th, 2.2), 0.8);
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
    const s = this.s; const S = this.st(s);
    this.P = S.dark > 0.001 ? mixP(this.P0, DARK, S.dark) : this.P0;
    const { ctx, P, dpr } = this;
    if (this.layoutFn) this.place(S.compose);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.c.width, this.c.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // phones: the band the aperture sits in is solid paper, so text scrolling beneath never shows through it
    this.maskBottom = 0;
    if (this.mobile && this.plate == null && S.open < 0.02) {
      const b = this.cy + this.R + 10; this.maskBottom = b;
      ctx.fillStyle = rgba(P.paper, 1); ctx.fillRect(0, 0, this.w, b);
      const g = ctx.createLinearGradient(0, b, 0, b + 26); g.addColorStop(0, rgba(P.paper, 1)); g.addColorStop(1, rgba(P.paper, 0));
      ctx.fillStyle = g; ctx.fillRect(0, b, this.w, 26);
    }
    const diag = Math.hypot(Math.max(this.cx, this.w - this.cx), Math.max(this.cy, this.h - this.cy));
    const clipR = lerp(this.R, diag + 4, spring(S.open));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath(); ctx.arc(this.cx * dpr, this.cy * dpr, clipR * dpr, 0, TAU); ctx.clip();
    ctx.fillStyle = rgba(mixc(P.paper, mixc([255, 255, 255], P.paper3, S.dark), 0.45 * (1 - S.open)), 1); ctx.fill();
    const cam = lerp(1, this.mobile ? 0.34 : 0.24, S.zoom);
    const k = this.R * cam;
    ctx.setTransform(dpr * k, 0, 0, dpr * k, this.cx * dpr, this.cy * dpr);
    const px = 1 / k;
    if (S.tissueA > 0) this.drawTissueLayer(S, px, cam);
    const labels: Label[] = [];
    if (S.detail > 0.001) {
      ctx.globalAlpha = S.detail;
      this.drawCell(S, px);
      ctx.globalAlpha = 1;
    }
    // a faint eyepiece edge
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vg = ctx.createRadialGradient(this.cx, this.cy, clipR * 0.84, this.cx, this.cy, clipR);
    vg.addColorStop(0, rgba(P.paper3, 0)); vg.addColorStop(1, rgba(P.paper3, 0.28 * (1 - S.open)));
    ctx.fillStyle = vg; ctx.fillRect(this.cx - clipR, this.cy - clipR, clipR * 2, clipR * 2);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ringA = 1 - S.open;
    if (ringA > 0.01) {
      ctx.beginPath(); ctx.arc(this.cx, this.cy, clipR - 0.5, 0, TAU); ctx.lineWidth = 1; ctx.strokeStyle = rgba(P.ink, 0.8 * ringA); ctx.stroke();
      // a graduated rim: fine ticks every 5°, longer every 30° (a measuring instrument, not a lens)
      ctx.beginPath();
      for (let i = 0; i < 72; i++) { const a = (i / 72) * TAU, l = i % 6 === 0 ? 9 : 4; ctx.moveTo(this.cx + Math.cos(a) * clipR, this.cy + Math.sin(a) * clipR); ctx.lineTo(this.cx + Math.cos(a) * (clipR - l), this.cy + Math.sin(a) * (clipR - l)); }
      ctx.lineWidth = 0.8; ctx.strokeStyle = rgba(P.ink, 0.55 * ringA); ctx.stroke();
    }
    if (this.withLabels) { this.labels(S, s, labels); this.drawLeaders(labels); this.onLabels?.(labels); }
  }

  toScreen(v: V, cam = 1): V { return [this.cx + v[0] * this.R * cam, this.cy + v[1] * this.R * cam]; }

  drawTissueLayer(S: St, px: number, cam: number) {
    const { ctx } = this;
    const tk = R0 / 0.95;
    ctx.save(); ctx.scale(tk, tk);
    stepTissue(this.tissue, S.stain, this.t, this.reduced ? 0 : 1);
    const k = this.R * cam * tk;
    const view: [number, number, number, number] = [-this.cx / k, -this.cy / k, (this.w - this.cx) / k, (this.h - this.cy) / k];
    drawTissue(ctx, this.tissue, { P: this.P, px: px / tk, st: S.stain, t: this.t, alpha: S.tissueA, view, firstStained: true });
    ctx.restore();
  }

  // ── the firm ───────────────────────────────────────────────────────────
  drawCell(S: St, px: number) {
    const { ctx, P } = this; const t = this.t;
    const N = 220;
    const mem: V[] = [];
    for (let i = 0; i < N; i++) { const th = (i / N) * TAU; mem.push(polar(th, this.memR(th, S))); }
    const O = polar(TH_O, this.memR(TH_O, S));
    const objA = S.obj * (1 - 0.5 * S.loop);
    // interior wash + a few granules
    ctx.beginPath(); smoothClosed(ctx, mem);
    const g = ctx.createRadialGradient(0, 0, 0.1, 0, 0, R0 * 1.05);
    g.addColorStop(0, rgba(mixc(P.body, P.accent, S.lobe * 0.25), 0.1));
    g.addColorStop(1, rgba(mixc(P.body, P.accent, S.lobe * 0.25), 0.2));
    ctx.fillStyle = g; ctx.fill();
    for (const [a, d, u] of this.granules) {
      const th = a + Math.sin(t * 0.05 + u * 9) * 0.08; const rr = d * 0.9 * this.memR(th, S);
      const sz = px * (1 + u);
      ctx.fillStyle = rgba(P.body, 0.22 + u * 0.15); ctx.fillRect(Math.cos(th) * rr - sz / 2, Math.sin(th) * rr - sz / 2, sz, sz);
    }
    if (objA > 0.001) {
      ctx.save(); ctx.clip();
      const og = ctx.createRadialGradient(O[0], O[1], 0, O[0], O[1], 1.05 * objA + 0.01);
      og.addColorStop(0, rgba(P.accent, 0.2 * objA)); og.addColorStop(1, rgba(P.accent, 0));
      ctx.fillStyle = og; ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
      for (let q = 0; q < 4; q++) {
        const f = (t * 0.07 + q / 4) % 1;
        ctx.beginPath(); ctx.arc(O[0], O[1], (0.08 + f * 0.9) * objA, 0, TAU);
        ctx.setLineDash([px * 2, px * 5]); ctx.lineWidth = px; ctx.strokeStyle = rgba(P.accent, 0.4 * objA * (1 - f)); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.restore();
    }
    // pores [angle, half-width (unit), openness]
    const tubeOpen = S.tube * (1 - ss(0, 0.35, S.close));
    const pores: [number, number, number][] = [
      [TH_IN, 0.035, 1], [TH_IN, 0.05, tubeOpen],
      [TH_A, 0.035, 1 - S.newOut], [TH_B, 0.035, S.newOut], [TH_C, 0.035, S.newOut],
    ];
    this.drawMembrane(mem, pores, px, S);
    if (S.tube > 0 && S.fuse < 1) this.drawTube(S, px);
    // a sealed port where output A used to leave
    if (S.newOut > 0.3) {
      const a = polar(TH_A, this.memR(TH_A, S) - 0.012), b = polar(TH_A, this.memR(TH_A, S) + 0.012);
      ctx.beginPath(); ctx.arc(lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5), px * 4, 0, TAU); ctx.lineWidth = px; ctx.strokeStyle = rgba(P.ink2, 0.7 * S.newOut); ctx.stroke();
    }
    this.drawCoordination(S, px);
    const occ = this.occupants(S);
    this.drawStrands(S, px, occ);
    if (S.mesh > 0) { this.drawMesh(S, px); this.drawJunctions(S, px); }
    if (S.explore > 0 && S.dissolve < 1) this.drawFilaments(S, px, occ.agent[0].p);
    if (objA > 0.01) {
      ctx.beginPath(); ctx.arc(O[0], O[1], 0.02 + 0.005 * Math.sin(t * 2), 0, TAU); ctx.fillStyle = rgba(P.accent, objA); ctx.fill();
      ctx.beginPath(); ctx.arc(O[0], O[1], 0.034, 0, TAU); ctx.lineWidth = px; ctx.strokeStyle = rgba(P.accent, objA * 0.7); ctx.stroke();
    }
    if (S.loop > 0) this.drawLoop(S, px, occ.people);
    // the person who stepped aside stays attached to the agent at their old step
    if (S.tether > 0.01) {
      const a = occ.people[1], b = occ.agent[0].p;
      ctx.beginPath(); ctx.moveTo(a[0], a[1] - 0.02); ctx.lineTo(b[0], b[1] + 0.03);
      ctx.lineWidth = px * 1.1; ctx.strokeStyle = rgba(P.ink, 0.75 * S.tether); ctx.stroke();
    }
    this.drawFlow(S, px);
    occ.people.forEach((p) => this.drawPerson(p, px));
    this.drawAgents(S, px, occ);
  }

  drawMembrane(mem: V[], pores: [number, number, number][], px: number, S: St) {
    const { ctx, P } = this; const N = mem.length;
    const open = (th: number) => pores.some(([a, w, o]) => o > 0.02 && Math.abs(angDiff(th, a)) < (w / R0) * o);
    for (const [off, lw, col] of [[0, 1.6, rgba(P.ink, 1)], [-5.5, 0.9, rgba(P.ink2, 0.8)]] as const) {
      ctx.beginPath(); let pen = false;
      for (let i = 0; i <= N; i++) {
        const th = (i / N) * TAU; const m = mem[i % N];
        const r = Math.hypot(m[0], m[1]); const f = (r + off * px) / r;
        if (open(th)) { pen = false; continue; }
        if (!pen) { ctx.moveTo(m[0] * f, m[1] * f); pen = true; } else ctx.lineTo(m[0] * f, m[1] * f);
      }
      ctx.lineWidth = lw * px; ctx.strokeStyle = col; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    }
    ctx.beginPath();
    for (const [a, w, o] of pores) {
      if (o < 0.05 || w > 0.04) continue;
      for (const sgn of [-1, 1]) {
        const th = a + sgn * (w / R0) * o; const r = this.memR(th, S);
        const p1 = polar(th, r + 3 * px), p2 = polar(th, r - 9 * px);
        ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
      }
    }
    ctx.lineWidth = px * 1.1; ctx.strokeStyle = rgba(P.ink, 0.8); ctx.stroke();
  }

  /** fig 2: the boundary reaches in from the input pore to the middle step (a channel), then closes behind the agent */
  drawTube(S: St, px: number) {
    const { ctx, P } = this;
    const a = polar(TH_IN, this.memR(TH_IN, S));
    const u0 = S.close * 0.93, u1 = S.tube;
    if (u1 - u0 < 0.01) return;
    const w = 0.05 * (1 - S.close * 0.2);
    const alpha = 1 - S.fuse;
    const n = 40;
    for (const [off, lw, col] of [[0, 1.35, rgba(P.ink, 0.9 * alpha)], [-5.5, 0.85, rgba(P.ink2, 0.7 * alpha)]] as const) {
      const ww = w + off * px;
      const side = (sg: number) => {
        const pts: V[] = [];
        for (let j = 0; j <= n; j++) {
          const u = lerp(u0, u1, j / n); const p = quad(a, TUBE_C, TUBE_B, u); const d = quadD(a, TUBE_C, TUBE_B, u); const L = Math.hypot(d[0], d[1]) || 1;
          pts.push([p[0] - (d[1] / L) * ww * sg, p[1] + (d[0] / L) * ww * sg]);
        }
        return pts;
      };
      const L1 = side(1), L2 = side(-1);
      ctx.beginPath();
      L1.forEach((p, j) => (j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      // rounded cap at the inner end
      const e = quad(a, TUBE_C, TUBE_B, u1), ed = quadD(a, TUBE_C, TUBE_B, u1); const ang = Math.atan2(ed[1], ed[0]);
      ctx.arc(e[0], e[1], ww, ang + Math.PI / 2, ang - Math.PI / 2, true);
      for (let j = n; j >= 0; j--) ctx.lineTo(L2[j][0], L2[j][1]);
      if (S.close > 0.001) {
        const s0 = quad(a, TUBE_C, TUBE_B, u0), sd = quadD(a, TUBE_C, TUBE_B, u0); const a0 = Math.atan2(sd[1], sd[0]);
        ctx.arc(s0[0], s0[1], ww, a0 - Math.PI / 2, a0 + Math.PI / 2, true);
      }
      ctx.lineWidth = lw * px; ctx.strokeStyle = col; ctx.stroke();
    }
  }

  drawCoordination(S: St, px: number) {
    const { ctx, P } = this; const t = this.t;
    const env = 1 - S.dissolve;
    if (env <= 0.01) return;
    for (const [rr, lw, col] of [[RN, 1.25, P.ink], [RN - 0.018, 0.8, P.ink2]] as const) {
      const pts: V[] = [];
      for (let i = 0; i < 60; i++) { const th = (i / 60) * TAU; const r = rr * (1 + 0.03 * Math.sin(3 * th + t * 0.8) + 0.02 * Math.sin(4 * th - t * 0.5)); pts.push([NUC[0] + Math.cos(th) * r, NUC[1] + Math.sin(th) * r]); }
      ctx.beginPath(); smoothClosed(ctx, pts);
      ctx.setLineDash(S.dissolve > 0 ? [px * 10 * env, px * 14 * S.dissolve] : []);
      ctx.lineWidth = px * lw; ctx.strokeStyle = rgba(col, 0.85 * env); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  meshPoint(e: [number, number], u: number): V {
    const a = MESH_N[e[0]], b = MESH_N[e[1]];
    const m: V = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1;
    const bend = ((e[0] * 7 + e[1] * 3) % 5 - 2) * 0.03 + 0.01;
    const q = quad(a, [m[0] - (dy / L) * bend, m[1] + (dx / L) * bend], b, u);
    const wig = Math.sin(u * Math.PI * 2 + e[0] + e[1] * 2) * 0.014 * Math.sin(u * Math.PI);
    return [q[0] - (dy / L) * wig, q[1] + (dx / L) * wig];
  }

  drawMesh(S: St, px: number) {
    const { ctx, P } = this; const t = this.t;
    MESH_E.forEach((e, i) => {
      const a = MESH_N[e[0]]; const d0 = Math.hypot(a[0] - NUC[0], a[1] - NUC[1]);
      const k = ss(d0 * 0.9, d0 * 0.9 + 0.55, S.mesh * 1.4);
      if (k <= 0) return;
      ctx.beginPath(); const n = 18;
      for (let j = 0; j <= Math.round(n * k); j++) { const p = this.meshPoint(e, j / n); j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.lineWidth = px * (1.2 + ((i * 5) % 4) * 0.6); ctx.strokeStyle = rgba(P.accent, 0.55 * k); ctx.lineCap = 'round'; ctx.stroke();
      if (k > 0.95) {
        const u = (t * 0.28 + i * 0.37) % 1; const p = this.meshPoint(e, i % 2 ? u : 1 - u);
        ctx.beginPath(); ctx.arc(p[0], p[1], px * 2.2, 0, TAU); ctx.fillStyle = rgba(P.accent, 0.95); ctx.fill();
      }
    });
  }
  drawJunctions(S: St, px: number) {
    const { ctx, P } = this;
    for (let i = 4; i < MESH_N.length; i++) {
      const n = MESH_N[i]; const d0 = Math.hypot(n[0] - NUC[0], n[1] - NUC[1]);
      const k = ss(d0 * 0.9 + 0.2, d0 * 0.9 + 0.6, S.mesh * 1.4); if (k <= 0) continue;
      ctx.beginPath(); ctx.arc(n[0], n[1], px * 3.4 * k, 0, TAU); ctx.fillStyle = rgba(P.paper, 0.95); ctx.fill();
      ctx.lineWidth = px * 1.2; ctx.strokeStyle = rgba(P.accent, 0.9 * k); ctx.stroke();
    }
  }

  inPos(i: number, S: St): V { const th = PEOPLE_IN[i]; return polar(th, this.memR(th, S) - 0.19); }

  occupants(S: St) {
    const t = this.t;
    const w = (i: number): V => [Math.sin(t * 0.8 + i * 2) * 0.005, Math.cos(t * 0.6 + i) * 0.005];
    const k = spring(S.out);
    const people = [
      add(lerpV(STEP[0], this.inPos(0, S), k), w(0)),
      add(lerpV(lerpV(STEP[1], ASIDE, spring(S.aside)), this.inPos(1, S), k), w(1)),
      add(lerpV(STEP[2], this.inPos(2, S), k), w(2)),
    ];
    const agent: { p: V; a: number }[] = [];
    let a0: V;
    const pin = polar(TH_IN, this.memR(TH_IN, S));
    if (S.ride <= 0) { const from: V = [-1.25, 0.075]; a0 = [lerp(from[0], pin[0] - 0.06, S.aIn), lerp(from[1], pin[1], S.aIn) + Math.sin(S.aIn * 8 + t * 2) * 0.012 * (1 - S.aIn)]; }
    else a0 = quad(pin, TUBE_C, TUBE_B, S.ride);
    if (S.divide <= 0) agent.push({ p: add(a0, w(5)), a: S.aIn > 0 ? 1 : 0 });
    else {
      [STEP[0], STEP[1], STEP[2], S4].forEach((tg, i) => {
        const kk = i === 1 ? 1 : spring(clamp((S.divide - (i === 3 ? 0.25 : 0)) / 0.75));
        agent.push({ p: add(lerpV(STEP[1], tg, kk), w(6 + i)), a: i === 1 ? 1 : clamp(kk * 3) });
      });
    }
    return { people, agent };
  }

  drawStrands(S: St, px: number, occ: ReturnType<Specimen['occupants']>) {
    const { ctx, P } = this; const t = this.t;
    const env = 1 - S.dissolve;
    if (env <= 0.01) return;
    const from: V = [NUC[0], NUC[1] + RN];
    const strands: { to: V; a: number; mid: boolean }[] = [
      { to: occ.people[0], a: 1 - S.out, mid: false },
      { to: STEP[1], a: 1 - S.wither, mid: true }, // the plan reaches the middle step, whoever works it
      { to: occ.people[2], a: 1 - S.out, mid: false },
    ];
    strands.forEach((st, i) => {
      if (st.a <= 0.01) return;
      const to: V = [st.to[0], st.to[1] - 0.07];
      const c: V = [(from[0] + to[0]) / 2 + (to[0] - from[0]) * 0.1, (from[1] + to[1]) / 2 + (st.mid ? S.wither * 0.06 : 0)];
      ctx.beginPath(); const n = 36;
      for (let j = 0; j <= n; j++) {
        const u = j / n; const p = quad(from, c, to, u);
        const dx = to[0] - from[0], dy = to[1] - from[1]; const L = Math.hypot(dx, dy) || 1;
        const wv = Math.sin(u * 16 + t * 2.2 + i) * 0.008 * Math.sin(u * Math.PI);
        j ? ctx.lineTo(p[0] - (dy / L) * wv, p[1] + (dx / L) * wv) : ctx.moveTo(p[0], p[1]);
      }
      if (st.mid && S.wither > 0) ctx.setLineDash([px * 4, px * 4 * (1 + S.wither * 3)]);
      ctx.lineWidth = px * 1.05; ctx.strokeStyle = rgba(P.ink2, 0.85 * st.a * env); ctx.lineCap = 'round'; ctx.stroke(); ctx.setLineDash([]);
      if (st.a > 0.9) for (let q = 0; q < 2; q++) {
        const u = (t * 0.32 + q * 0.5 + i * 0.21) % 1; const p = quad(from, c, to, u);
        ctx.fillStyle = rgba(P.ink, 0.85 * st.a * env); ctx.fillRect(p[0] - px * 1.8, p[1] - px * 1.8, px * 3.6, px * 3.6);
      }
    });
  }

  filamentPath(i: number, S: St, from: V): V[] {
    const t = this.t;
    const O = polar(TH_O, this.memR(TH_O, S));
    const isSel = i === SEL;
    const base = isSel ? Math.atan2(O[1] - from[1], O[0] - from[0]) : FIL[i];
    const grow = S.explore * (isSel ? 1 : 1 - S.select);
    let L = (0.12 + ((i * 37) % 10) / 90) * grow;
    if (isSel) L = lerp(L, Math.hypot(O[0] - from[0], O[1] - from[1]) - 0.05, S.select);
    const pts: V[] = []; const n = 16;
    for (let j = 0; j <= n; j++) {
      const u = j / n; const d = u * L;
      const wob = Math.sin(u * 7 + i * 2 + t * 1.4) * 0.018 * u * (1 - (isSel ? S.select * 0.7 : 0));
      const a = base + wob * 3;
      pts.push([from[0] + Math.cos(a) * d - Math.sin(a) * wob, from[1] + Math.sin(a) * d + Math.cos(a) * wob]);
    }
    return pts;
  }
  drawFilaments(S: St, px: number, from: V) {
    const { ctx, P } = this; const fade = 1 - S.mesh;
    FIL.forEach((_, i) => {
      const pts = this.filamentPath(i, S, from); const isSel = i === SEL;
      ctx.beginPath(); pts.forEach((p, j) => (j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.lineWidth = px * (isSel ? 1.2 + S.select * 2.2 : 1.1);
      ctx.strokeStyle = rgba(P.accent, (isSel ? 0.55 + S.select * 0.4 : 0.6) * fade);
      ctx.setLineDash(isSel && S.select > 0.5 ? [] : [px * 3, px * 3]);
      ctx.lineCap = 'round'; ctx.stroke(); ctx.setLineDash([]);
      const tip = pts[pts.length - 1];
      ctx.beginPath(); ctx.arc(tip[0], tip[1], px * 2.2, 0, TAU); ctx.fillStyle = rgba(P.accent, 0.85 * fade * (isSel ? 1 : 1 - S.select)); ctx.fill();
    });
  }

  /** the feedback loop: inside the boundary where the people sit, outside it between them */
  loopPath(S: St): V[] {
    const pts: V[] = []; const n = 180;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU;
      let m = 0; for (const a of PEOPLE_IN) m = Math.max(m, gauss(angDiff(th, a), 0.42));
      pts.push(polar(th, this.memR(th, S) + 0.12 - 0.31 * m));
    }
    return pts;
  }
  drawLoop(S: St, px: number, people: V[]) {
    const { ctx, P } = this; const t = this.t;
    const pts = this.loopPath(S);
    const m = Math.round(pts.length * S.loop);
    ctx.beginPath();
    for (let i = 0; i <= m; i++) { const p = pts[(i + 20) % pts.length]; i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.setLineDash([px * 6, px * 5]); ctx.lineDashOffset = -t * 14 * px;
    ctx.lineWidth = px * 1.15; ctx.strokeStyle = rgba(P.ink, 0.8); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    if (S.loop > 0.95) for (let q = 0; q < 4; q++) {
      const p = pts[Math.floor(((t * 0.05 + q / 4) % 1) * pts.length)];
      ctx.beginPath(); ctx.arc(p[0], p[1], px * 2.6, 0, TAU); ctx.fillStyle = rgba(P.ink, 0.9); ctx.fill();
    }
    // each person works into the mesh
    ctx.beginPath();
    people.forEach((p, i) => { const tg = MESH_N[[9, 11, 12][i]]; const q = lerpV(p, tg, 0.8 * S.loop); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); });
    ctx.setLineDash([px * 2, px * 4]); ctx.lineWidth = px; ctx.strokeStyle = rgba(P.ink2, 0.75 * S.loop); ctx.stroke(); ctx.setLineDash([]);
  }

  drawFlow(S: St, px: number) {
    const { ctx, P } = this;
    const pin = polar(TH_IN, this.memR(TH_IN, S));
    const pa = polar(TH_A, this.memR(TH_A, S)), pb = polar(TH_B, this.memR(TH_B, S)), pc = polar(TH_C, this.memR(TH_C, S));
    const L = S.newOut;
    const N0 = 44, N = N0 + 70; const base = ctx.globalAlpha;
    for (let i = 0; i < N; i++) {
      const extra = i >= N0; const va = extra ? L : 1; // more passes through once reorganised
      if (va <= 0.01) continue;
      const toB = i % 2 === 0;
      const exitP = L > 0.5 ? (toB ? pb : pc) : pa, exitTh = L > 0.5 ? (toB ? TH_B : TH_C) : TH_A;
      const via = L > 0.5 ? S4 : lerpV(STEP[2], pa, 0.55);
      const nodes: V[] = [
        [-1.3, 0.075 + ((i * 53) % 17 - 8) / 34], [pin[0] - 0.12, pin[1] + ((i * 29) % 7 - 3) / 90], pin, STEP[0], STEP[1], STEP[2],
        via, exitP, polar(exitTh, 1.3),
      ];
      nodes[8][1] += ((i * 31) % 13 - 6) / 40;
      const u = (((this.phase * 0.035 + i / (extra ? N - N0 : N0) + (extra ? 0.013 : 0)) % 1) + 1) % 1;
      const segs = nodes.length - 1;
      const f = u * segs; const k = Math.min(segs - 1, Math.floor(f)); let q = f - k;
      q = q - Math.sin(q * TAU) / TAU * 0.85;
      const a = nodes[k], b = nodes[k + 1];
      const jit = Math.sin(i * 12.9 + this.t * 1.3) * (k <= 1 || k >= 7 ? 0.05 : 0.018);
      const dx = b[0] - a[0], dy = b[1] - a[1]; const Ld = Math.hypot(dx, dy) || 1;
      const x = lerp(a[0], b[0], q) - (dy / Ld) * jit, y = lerp(a[1], b[1], q) + (dx / Ld) * jit;
      ctx.globalAlpha = va * base;
      if (k <= 2) { ctx.beginPath(); ctx.arc(x, y, px * 3.4, 0, TAU); ctx.lineWidth = px * 1.1; ctx.strokeStyle = rgba(P.ink, 0.8); ctx.stroke(); }
      else if (k <= 5) { ctx.beginPath(); ctx.arc(x, y, px * (2.4 + (k - 3) * 0.7), 0, TAU); ctx.fillStyle = rgba(P.ink, 0.85); ctx.fill(); }
      else {
        const isNew = L > 0.5; const col = isNew ? P.accent : P.ink;
        if (isNew && !toB) { ctx.beginPath(); ctx.arc(x - px * 3, y, px * 2.6, 0, TAU); ctx.arc(x + px * 3, y, px * 2.6, 0, TAU); ctx.fillStyle = rgba(col, 0.9); ctx.fill(); }
        else {
          ctx.beginPath(); ctx.arc(x, y, px * 5.2, 0, TAU); ctx.lineWidth = px * 1.1; ctx.strokeStyle = rgba(col, 0.9); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, px * 2.3, 0, TAU); ctx.fillStyle = rgba(col, 0.9); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = base;
  }

  /** a person: drawn in the membrane's own line (a double stroke), a head over an open shoulder arc */
  drawPerson(p: V, px: number) {
    const { ctx, P } = this; const t = this.t;
    const wob = (q: number) => 1 + 0.05 * Math.sin(q * 3 + t * 1.3 + p[0] * 9);
    ctx.lineCap = 'round';
    for (const [off, lw, col] of [[0, 1.6, rgba(P.ink, 1)], [-3.5, 0.8, rgba(P.ink2, 0.8)]] as const) {
      // shoulders: an open arc, not a closed badge
      ctx.beginPath();
      for (let j = 0; j <= 24; j++) { const a = Math.PI * (1.02 + (j / 24) * 0.96); const r = (0.05 + off * px) * wob(a); const x = p[0] + Math.cos(a) * r, y = p[1] + 0.064 + Math.sin(a) * r * 0.95; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.lineWidth = lw * px; ctx.strokeStyle = col; ctx.stroke();
      ctx.beginPath();
      for (let j = 0; j <= 20; j++) { const a = (j / 20) * TAU; const r = (0.021 + off * px * 0.6) * wob(a); const x = p[0] + Math.cos(a) * r, y = p[1] - 0.03 + Math.sin(a) * r; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      if (off === 0) { ctx.fillStyle = rgba(P.paper, 0.9); ctx.fill(); }
      ctx.lineWidth = lw * px; ctx.strokeStyle = col; ctx.stroke();
    }
  }

  /** an agent: a reticle (ring, centre point, four ticks), in the accent */
  agentGlyph(x: number, y: number, r: number, a: number, px: number, spin = 0) {
    const { ctx, P } = this;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = rgba(P.paper, 0.9 * a); ctx.fill();
    ctx.lineWidth = px * 1.6; ctx.strokeStyle = rgba(P.accent, a); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.36, 0, TAU); ctx.fillStyle = rgba(P.accent, a); ctx.fill();
    ctx.beginPath();
    for (let q = 0; q < 4; q++) { const an = spin + (q * Math.PI) / 2; ctx.moveTo(x + Math.cos(an) * r * 1.2, y + Math.sin(an) * r * 1.2); ctx.lineTo(x + Math.cos(an) * r * 1.6, y + Math.sin(an) * r * 1.6); }
    ctx.lineWidth = px * 1.3; ctx.stroke();
  }
  drawAgents(S: St, px: number, occ: ReturnType<Specimen['occupants']>) {
    for (const [i, ag] of occ.agent.entries()) {
      if (ag.a <= 0.01) continue;
      this.agentGlyph(ag.p[0], ag.p[1], 0.036, ag.a, px, this.t * 0.4 + i);
    }
  }

  // ── labels: letter keys (figures) and words (hero), laid out in screen space, kept inside the aperture ──
  labels(S: St, s: number, out: Label[]) {
    const win = (k: number) => ss(k - 1 + 0.04, k - 1 + 0.16, s) * (1 - ss(k - 0.02, k + 0.06, s));
    const occ = this.occupants(S);
    const O = polar(TH_O, this.memR(TH_O, S));
    const strandMid = (to: V): V => [lerp(NUC[0], to[0], 0.55) + 0.01, lerp(NUC[1] + RN, to[1] - 0.07, 0.55)];
    const sel = S.explore > 0 ? this.filamentPath(SEL, S, occ.agent[0].p) : null;
    const alt = S.explore > 0 ? this.filamentPath(1, S, occ.agent[0].p) : null;
    const loopP = this.loopPath(S)[Math.round(180 * ((TAU - 1.25) / TAU))];
    const exitB = polar(TH_B, this.memR(TH_B, S) + 0.1), exitC = polar(TH_C, this.memR(TH_C, S) + 0.1);
    const hero = S.hero * (this.plate == null ? 1 : 0);
    // One letter per concept for the whole story (listed under each legend). A concept is written out in
    // words the first time it appears on the drawing, and shown by its letter after that.
    // [id, word, letter, first appearance?, anchor, direction (deg), alpha]
    const L: [string, string, string, boolean, V, number, number][] = [
      ['h-in', 'inputs', '', true, [-0.88, 0.075], 100, hero],
      ['h-firm', 'firm', '', true, polar(-2.35, this.memR(-2.35, S)), -135, hero],
      ['h-out', 'output A', '', true, [0.86, 0.19], 90, hero],
      ['1a', 'inputs', 'a', true, [-0.88, 0.075], 100, win(1)],
      ['1b', 'people', 'b', true, add(occ.people[0], [0, -0.06]), -100, win(1)],
      ['1c', 'coordination', 'c', true, [NUC[0] + RN * 0.8, NUC[1] - RN * 0.6], -35, win(1)],
      ['1d', 'plan', 'd', true, strandMid(STEP[2]), 0, win(1)],
      ['1e', 'output A', 'e', true, [0.86, 0.19], 90, win(1)],
      ['2a', 'inputs', 'a', false, [-0.9, -0.02], -90, win(2) * (1 - S.ride)],
      ['2f', 'agent', 'f', true, occ.agent[0].p, -120, win(2)],
      ['2d', 'plan', 'd', false, strandMid(STEP[1]), 20, win(2)],
      ['3f', 'agent', 'f', false, occ.agent[0].p, -150, win(3)],
      ['3g', 'objective', 'g', true, O, 60, win(3) * S.obj],
      ['3h', 'alternatives', 'h', true, alt ? alt[alt.length - 1] : [0, 0], -120, win(3) * S.explore * (1 - S.select * 0.8)],
      ['3i', 'selected plan', 'i', true, sel ? sel[9] : [0, 0], 15, win(3) * S.select],
      ['4c', 'coordination', 'c', false, MESH_N[5], -150, win(4) * S.mesh],
      ['4f', 'agents', 'f', false, occ.agent[3]?.p ?? S4, -60, win(4) * S.divide],
      ['4b', 'people', 'b', false, add(occ.people[1], [0, 0.06]), 120, win(4) * S.out],
      ['4j', 'feedback loop', 'j', true, loopP, -60, win(4) * S.loop],
      ['4k', 'output B', 'k', true, exitB, -80, win(4) * S.newOut],
      ['4l', 'output C', 'l', true, exitC, -10, win(4) * S.newOut],
    ];
    const m = this.mobile ? 0.8 : 1;
    for (const [id, word, letter, first, anchor, deg, a] of L) {
      const key = !first;
      const [ax, ay] = this.toScreen(anchor);
      const d = (key ? 30 : 38) * m, r = (deg * Math.PI) / 180;
      let x = ax + Math.cos(r) * d, y = ay + Math.sin(r) * d;
      const dx = x - this.cx, dy = y - this.cy, dist = Math.hypot(dx, dy), lim = this.R - (key ? 18 : 24);
      if (dist > lim) { x = this.cx + (dx / dist) * lim; y = this.cy + (dy / dist) * lim; }
      out.push({ id, text: key ? letter : word, letter, key, x, y, ax, ay, a: clamp(a) });
    }
  }
  drawLeaders(labels: Label[]) {
    const { ctx, P } = this;
    for (const l of labels) {
      if (l.a <= 0.01) continue;
      const dx = l.x - l.ax, dy = l.y - l.ay, d = Math.hypot(dx, dy) || 1, stop = l.key ? 11 : 6;
      ctx.globalAlpha = l.a;
      ctx.beginPath(); ctx.moveTo(l.ax, l.ay); ctx.lineTo(l.x - (dx / d) * stop, l.y - (dy / d) * stop);
      ctx.lineWidth = 0.8; ctx.strokeStyle = rgba(P.ink2, 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(l.ax, l.ay, 1.8, 0, TAU); ctx.fillStyle = rgba(P.ink, 1); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
