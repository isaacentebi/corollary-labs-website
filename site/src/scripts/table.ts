// The table: one instanced WebGL draw of every cell of the input–output table.
// World units are CSS pixels on the z = 0 plane, so the flat states are pixel-exact and hover needs no raycasting.
import { GL } from './gl';
import { makeEconomy, N, SLOTS, type Economy } from './economy';

export interface Params {
  focus: number;   // 0..1 column K widened, others dimmed
  eK: number;      // 0..1 execution of K moved inside
  pK: number;      // 0..1 plans of K moved inside
  reorg: number;   // 0..1 A0 → A1, order pos0 → pos1
  front: number;   // 0..Fmax diffusion front
  lift: number;    // 0..1 flat → height field
  spin: number;    // radians, slow orbit in the coda
}

export interface Layout { W: number; H: number; u: number; ox: number; oy: number; }

const ROWS_H = 37.4;            // table height in units
const Y_SUP = N + 0.7;          // first supplied row
const Y_OUT = N + 0.7 + 3 + 0.7;
const WIDE = 7;                 // width of the focus column when widened
const GAP = 0.2;

const BG = 0.043;
const ACC = [1.0, 0.357, 0.122];

const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const ease = (x: number) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lum = (v: number) => (v <= 0.0001 ? 0.085 : 0.16 + 0.8 * Math.sqrt(v));

export class Table {
  e: Economy = makeEconomy();
  gl: GL;
  count: number;
  data: Float32Array;                                // per instance: pos(3) size(3) col(3)
  L: Layout = { W: 1, H: 1, u: 10, ox: 0, oy: 0 };
  hover: { r: number; c: number } | null = null;   // display row / column (flat, reorg 0)
  flash = new Float32Array(SLOTS * SLOTS);           // accent pulse per matrix cell
  // derived per-frame
  insE = new Float32Array(SLOTS); insP = new Float32Array(SLOTS);
  thinR = 1; thinC = 1;
  colX = new Float32Array(SLOTS); colW = new Float32Array(SLOTS); rowY = new Float32Array(SLOTS); slotA = new Float32Array(SLOTS);

  constructor(public canvas: HTMLCanvasElement) {
    this.count = SLOTS * SLOTS + SLOTS * 3 + SLOTS * 2 + SLOTS;
    this.data = new Float32Array(this.count * 9);
    this.gl = new GL(canvas, this.count);
  }

  resize(W: number, H: number, L: Layout) {
    this.L = L;
    this.gl.resize(W, H, Math.min(devicePixelRatio || 1, 2));
  }

  /** Layout for a viewport; `box` is the region the table must fit, in px. */
  static fit(W: number, H: number, box: { x: number; y: number; w: number; h: number }, valign = 0.5): Layout {
    const u = Math.floor(Math.min(box.w / N, box.h / ROWS_H) * 4) / 4;
    const tw = u * N, th = u * ROWS_H;
    return { W, H, u, ox: Math.round(box.x + box.w - tw), oy: Math.round(box.y + (box.h - th) * valign) };
  }

  static rows = { sup: Y_SUP, out: Y_OUT, total: ROWS_H };

  /** Display position of a slot's column / row, in units. */
  derive(p: Params) {
    const e = this.e, K = e.K;
    const wo = 1 - (p.focus * (WIDE - 1)) / (N - 1), wk = 1 + p.focus * (WIDE - 1);
    const pk = e.pos0[K];
    // reorganisation in two strokes, like a rod mechanism: rows travel first, then columns (same permutation)
    const rp = ease(p.reorg / 0.5), cp = ease((p.reorg - 0.5) / 0.5);
    this.thinR = 1 - 0.7 * Math.sin(Math.PI * rp);
    this.thinC = 1 - 0.7 * Math.sin(Math.PI * cp);
    const fade = ease(p.reorg);
    for (let s = 0; s < SLOTS; s++) {
      this.rowY[s] = lerp(e.pos0[s], e.pos1[s], rp);
      const pos = lerp(e.pos0[s], e.pos1[s], cp);
      this.colX[s] = pos * wo + clamp(pos - pk) * (wk - wo);
      this.colW[s] = s === K ? wk : wo;
      this.slotA[s] = lerp(e.alive0[s], e.alive1[s], fade);
      const fe = clamp((p.front - e.tE[s]) / 0.7), fp = clamp((p.front - e.tP[s]) / 0.7);
      this.insE[s] = s === K ? Math.max(p.eK, fe) : fe;
      this.insP[s] = s === K ? Math.max(p.pK, fp) : fp;
      if (!e.alive1[s]) { this.insE[s] = 0; this.insP[s] = 0; }
    }
  }

  cellAt(px: number, py: number) {
    const { u, ox, oy } = this.L;
    const x = (px - ox) / u, y = (py - oy) / u;
    if (x < 0 || x >= N) return null;
    const c = Math.floor(x);
    if (y >= 0 && y < N) return { r: Math.floor(y), c };
    for (let k = 0; k < 3; k++) if (y >= Y_SUP + k && y < Y_SUP + k + 1) return { r: N + k, c };
    return null;
  }

  slotAtPos(pos: number) {
    const e = this.e;
    for (let s = 0; s < SLOTS; s++) if (e.alive0[s] && e.pos0[s] === pos) return s;
    return -1;
  }

  /** Accent pulse: demand on column j passes to its suppliers, then to theirs (x_{r+1} = A x_r). */
  pulse(j: number, t: number, out: Float32Array) {
    const e = this.e, A = e.A0;
    out.fill(0);
    let x = new Float32Array(SLOTS); x[j] = 1;
    for (let r = 0; r < 5; r++) {
      const w = clamp(1 - Math.abs(t - r * 0.42) / 0.5);
      let m = 0; for (let c = 0; c < SLOTS; c++) m = Math.max(m, x[c]);
      if (m <= 0) break;
      if (w > 0) for (let c = 0; c < SLOTS; c++) {
        const xc = x[c] / m; if (xc < 0.02) continue;
        for (let i = 0; i < SLOTS; i++) { const v = A[i * SLOTS + c] * xc; if (v > 0) out[i * SLOTS + c] = Math.max(out[i * SLOTS + c], Math.min(1, v * 2.2) * w); }
      }
      const nx = new Float32Array(SLOTS);
      for (let i = 0; i < SLOTS; i++) { let t2 = 0; for (let c = 0; c < SLOTS; c++) if (c !== i) t2 += A[i * SLOTS + c] * x[c]; nx[i] = t2; }
      x = nx;
    }
  }

  render(p: Params) {
    this.derive(p);
    const e = this.e, { u, ox, oy, W, H } = this.L, K = e.K;
    const D = this.data;
    const vm = ease(p.reorg);
    const lift = p.lift;
    const cx = ox + (N * u) / 2, cy = oy + (ROWS_H * u) / 2;
    const dim = 1 - 0.82 * p.focus;
    const hv = this.hover;
    const gap = Math.max(1, GAP * u);
    let n = 0;
    const put = (x: number, y: number, w: number, h: number, z: number, r: number, g: number, b: number) => {
      // x, y: top-left in units relative to table; w, h in units
      const k = n * 9;
      D[k] = ox + (x + w / 2) * u - cx; D[k + 1] = -(oy + (y + h / 2) * u - cy); D[k + 2] = 0;
      D[k + 3] = Math.max(0, w * u - gap); D[k + 4] = Math.max(0, h * u - gap); D[k + 5] = z;
      D[k + 6] = r; D[k + 7] = g; D[k + 8] = b;
      n++;
    };
    const mixc = (l: number, a: number): [number, number, number] => [lerp(l, ACC[0], a), lerp(l, ACC[1], a), lerp(l, ACC[2], a)];
    const zOf = (v: number, k = 6.5) => 1 + lift * u * (0.25 + k * v);

    // matrix
    for (let i = 0; i < SLOTS; i++) {
      for (let j = 0; j < SLOTS; j++) {
        const a = this.slotA[i] * this.slotA[j];
        let v = lerp(e.A0[i * SLOTS + j], e.A1[i * SLOTS + j], vm);
        // execution and plans produced inside add to what the firm supplies to itself
        if (i === j) v += 0.5 * (e.L[j] * ease(this.insE[j]) + e.L[SLOTS + j] * ease(this.insP[j]));
        let l = lum(v);
        let acc = 0;
        const inside = i === j && this.insE[j] > 0.97;
        if (j !== K) l = BG + (l - BG) * dim;
        if (hv && p.reorg === 0) {
          const ri = e.pos0[i], cj = e.pos0[j];
          if (ri === hv.r && cj === hv.c) l = 1;
          else if (ri === hv.r || cj === hv.c) l = Math.min(1, l + 0.13);
        }
        const f = this.flash[i * SLOTS + j];
        let [r, g, b] = mixc(l, acc);
        if (inside) { const k = 0.62 + 0.38 * ease(this.insP[j]); r = ACC[0] * k; g = ACC[1] * k; b = ACC[2] * k; }
        if (f > 0.12) { const k = 0.35 + 0.65 * f; r = ACC[0] * k; g = ACC[1] * k; b = ACC[2] * k; }
        const w = this.colW[j] * a * this.thinC, h = a * this.thinR;
        put(this.colX[j] + (this.colW[j] - w) / 2, this.rowY[i] + (1 - h) / 2, w, h, zOf(v), r, g, b);
      }
    }
    // supplied tokens (E, P travel up their own column to the diagonal; O stays)
    for (let k = 0; k < 3; k++) {
      for (let j = 0; j < SLOTS; j++) {
        const a = this.slotA[j];
        const ins = k === 0 ? this.insE[j] : k === 1 ? this.insP[j] : 0;
        const t = ease(ins);
        const y = lerp(Y_SUP + k, this.rowY[j], t);
        const v = e.L[k * SLOTS + j];
        let l = lum(v * 0.8);
        if (j !== K) l = BG + (l - BG) * dim;
        if (hv && p.reorg === 0 && hv.r === N + k && e.pos0[j] === hv.c) l = 1;
        else if (hv && p.reorg === 0 && (hv.r === N + k || e.pos0[j] === hv.c)) l = Math.min(1, l + 0.13);
        const accA = ins > 0.02 && ins < 1 ? 1 : 0;
        const [r, g, b] = mixc(l, accA);
        const sz = ins >= 0.999 ? 0 : a;
        const tw = this.colW[j] * sz * this.thinC;
        put(this.colX[j] + (this.colW[j] - tw) / 2, y + (1 - sz) / 2, tw, sz, zOf(v, 4) + (ins > 0 && ins < 1 ? 2 : 0), r, g, b);
      }
    }
    // holes left in the supplied rows
    for (let k = 0; k < 2; k++) {
      for (let j = 0; j < SLOTS; j++) {
        const ins = k === 0 ? this.insE[j] : this.insP[j];
        const a = this.slotA[j] * clamp(ins * 3);
        const l = 0.105;
        put(this.colX[j] + (this.colW[j] * (1 - a)) / 2, Y_SUP + k + (1 - a) / 2, this.colW[j] * a, a, 1, l, l, l * 0.97);
      }
    }
    // output row
    for (let j = 0; j < SLOTS; j++) {
      const a = this.slotA[j];
      const v = lerp(e.out0[j], e.out1[j], vm);
      let l = 0.2 + 0.78 * v;
      if (j !== K) l = BG + (l - BG) * dim;
      put(this.colX[j] + (this.colW[j] * (1 - a)) / 2, Y_OUT + (1 - a) / 2, this.colW[j] * a, a, zOf(v, 4), l, l, l * 0.97);
    }
    // lift: the table tilts into a height field around its centre, which drifts to the stage centre
    const gx = cx - W / 2, gy = -(cy - H / 2);
    const wide = W > 900;
    const tx = wide ? W * 0.13 : 0, ty = wide ? -H * 0.04 : gy + 0.04 * H;
    const le = ease(lift);
    const sc = lerp(1, wide ? 1.02 : 0.9, le);
    this.gl.draw(D, n, [lerp(gx, tx, le), lerp(gy, ty, le), 0], -1.02 * le, (0.62 + p.spin) * le, sc);
  }

  /** px position of the top-left of a unit coordinate in the flat table (used by DOM labels). */
  px(x: number, y: number) { return [this.L.ox + x * this.L.u, this.L.oy + y * this.L.u]; }
}
