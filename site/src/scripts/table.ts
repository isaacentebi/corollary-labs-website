// The table: one instanced WebGL draw of every cell of the input–output table.
// World units are CSS px (orthographic), so the flat states are pixel-exact and hover needs no raycasting.
// Colour rule: greys are amounts; white marks what is being read or traced; signal orange appears only on a
// diagonal cell, and only once that firm's execution is produced inside it.
import { GL } from './gl';
import { makeEconomy, N, type Economy } from './economy';

export interface Params {
  focus: number;   // 0..1 column K widened, others dimmed
  eK: number;      // 0..1 flight of K's execution cell to its diagonal
  pK: number;      // 0..1 flight of K's plans cell
  vals: number;    // 0..1 entries A0 → A1
  rows: number;    // 0..1 rows travel to the new order
  cols: number;    // 0..1 columns travel to the new order
  front: number;   // diffusion front, in rounds (< -50: nothing has moved inside, except K's own flight)
  lift: number;    // 0..1 flat → height field
  t: number;       // 0..1 homotopy parameter for the heights, used while lifted
}

export interface Layout { W: number; H: number; u: number; uy: number; ox: number; oy: number; fit: { x: number; y: number; w: number; h: number; bottom?: boolean } }

const WIDE = 7;
const EMPTY = 0.078;
const ACC = [1.0, 0.357, 0.122];

const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const ease = (x: number) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lum = (v: number) => (v <= 0.0005 ? EMPTY : 0.2 + 0.76 * Math.sqrt(Math.min(1, v / 0.4)));

export class Table {
  e: Economy = makeEconomy();
  gl: GL;
  data: Float32Array;
  L: Layout = { W: 1, H: 1, u: 10, uy: 10, ox: 0, oy: 0, fit: { x: 0, y: 0, w: 1, h: 1 } };
  hover: { r: number; c: number } | null = null;
  flash = new Float32Array(N * N);
  // derived per frame (read by the DOM layer)
  rowPos = new Float32Array(N); colPos = new Float32Array(N);
  colX = new Float32Array(N); colW = new Float32Array(N);   // in u
  eIn = new Float32Array(N); pIn = new Float32Array(N);       // 0/1: moved inside
  diag = new Float32Array(N);                                  // current diagonal coefficient
  moving = new Uint8Array(N);

  constructor(public canvas: HTMLCanvasElement) {
    const count = N * N + N * 3 + N + 4;   // + room for the two cells in flight and the holes they leave
    this.data = new Float32Array(count * 9);
    this.gl = new GL(canvas, count);
    this.buildSwaps();
  }

  resize(W: number, H: number) { this.gl.resize(W, H, Math.min(devicePixelRatio || 1, 2)); }

  // vertical geometry in px, relative to the table's top edge
  rowTop(pos: number) { return pos * this.L.uy; }
  supTop(k: number) { const { u, uy } = this.L; return N * uy + 0.7 * u + k * 1.5 * u; }
  outTop() { const { u, uy } = this.L; return N * uy + 1.4 * u + 4.5 * u; }
  static height(u: number, uy: number) { return N * uy + 1.4 * u + 6 * u; }

  swaps: [number, number][] = [];
  private buildSwaps() {
    const cur = Array.from({ length: N }, (_, i) => i);       // position → firm
    const target: number[] = [];
    for (let s = 0; s < N; s++) target[this.e.pos1[s]] = s;
    for (let k = 0; k < N; k++) {
      if (cur[k] === target[k]) continue;
      const j = cur.indexOf(target[k]);
      this.swaps.push([k, j]);
      [cur[k], cur[j]] = [cur[j], cur[k]];
    }
  }
  private permute(x: number, out: Float32Array) {
    const pos = Array.from({ length: N }, (_, i) => i);       // firm → position
    const at = Array.from({ length: N }, (_, i) => i);        // position → firm
    const M = this.swaps.length;
    const f = clamp(x) * M, done = Math.min(M, Math.floor(f));
    for (let q = 0; q < done; q++) {
      const [a, b] = this.swaps[q], sa = at[a], sb = at[b];
      at[a] = sb; at[b] = sa; pos[sb] = a; pos[sa] = b;
    }
    for (let s = 0; s < N; s++) out[s] = pos[s];
    if (done < M && f > done) {
      const [a, b] = this.swaps[done], sa = at[a], sb = at[b], k = ease(f - done);
      out[sa] = lerp(a, b, k); out[sb] = lerp(b, a, k);
      this.moving[sa] = 1; this.moving[sb] = 1;
    }
  }

  cellAt(px: number, py: number) {
    const { u, uy, ox, oy } = this.L;
    const x = (px - ox) / u, y = py - oy;
    if (x < 0 || x >= N) return null;
    const c = Math.floor(x);
    if (y >= 0 && y < N * uy) return { r: Math.floor(y / uy), c };
    for (let k = 0; k < 3; k++) { const t = this.supTop(k); if (y >= t && y < t + 1.5 * u) return { r: N + k, c }; }
    return null;
  }

  /** Click trace: the clicked firm's suppliers light first, then their suppliers, in white steps. */
  pulse(j: number, t: number) {
    const A = this.e.A0, out = this.flash;
    out.fill(0);
    const seen = new Uint8Array(N); seen[j] = 1;
    let cur = [j];
    const fade = clamp((3 - t) / 0.5);
    for (let r = 0; r < 4 && cur.length; r++) {
      const on = clamp((t - r * 0.45) / 0.12) * (1 - 0.2 * r) * fade;
      const next: number[] = [];
      for (const c of cur) for (let i = 0; i < N; i++) {
        if (i === c || A[i * N + c] <= 0) continue;
        if (on > 0) out[i * N + c] = Math.max(out[i * N + c], 0.3 + 0.7 * on);
        if (!seen[i] && A[i * N + c] > 0.03) { seen[i] = 1; next.push(i); }
      }
      cur = next;
    }
  }

  render(p: Params) {
    const e = this.e, K = e.K, D = this.data;
    const { u, uy, ox, oy, W, H } = this.L;
    const lifted = p.lift > 0;
    const vm = lifted ? p.t : ease(p.vals);
    const wo = 1 - (p.focus * (WIDE - 1)) / (N - 1), wk = 1 + p.focus * (WIDE - 1);
    // the permutation is carried out as a sequence of swaps, like reordering a physical matrix by hand:
    // rows first, then columns; only two rows (or columns) are ever in motion, each whole and full size
    this.moving.fill(0);
    this.permute(p.rows, this.rowPos);
    this.permute(p.cols, this.colPos);
    const pk = this.colPos[K];
    for (let s = 0; s < N; s++) {
      const pos = this.colPos[s];
      this.colX[s] = pos * wo + clamp(pos - pk) * (wk - wo);
      this.colW[s] = s === K ? wk : wo;
      const inE = p.front >= e.tE[s] ? 1 : 0, inP = p.front >= e.tP[s] ? 1 : 0;
      this.eIn[s] = s === K ? Math.max(inE, p.eK >= 0.98 ? 1 : 0) : inE;
      this.pIn[s] = s === K ? Math.max(inP, p.pK >= 0.98 ? 1 : 0) : inP;
      this.diag[s] = lerp(e.A0[s * N + s], e.A1[s * N + s], vm) + e.L[s] * this.eIn[s] + e.L[N + s] * this.pIn[s];
    }

    const dim = 1 - 0.8 * p.focus;
    const hv = this.hover;
    const gx = Math.max(1, Math.round(0.2 * u)), gy = Math.max(1, Math.round(0.2 * Math.min(u, uy)));
    const tw = N * u, th = N * uy;
    const cx = ox + tw / 2, cy = oy + th / 2;              // the matrix centre is the pivot of the lift
    const hmax = 5 * u;
    let n = 0;
    const put = (x: number, y: number, w: number, h: number, z: number, r: number, g: number, b: number) => {
      const k = n * 9;
      D[k] = ox + x + w / 2 - cx; D[k + 1] = -(oy + y + h / 2 - cy); D[k + 2] = 0;
      D[k + 3] = Math.max(0, w - gx); D[k + 4] = Math.max(0, h - gy); D[k + 5] = z;
      D[k + 6] = r; D[k + 7] = g; D[k + 8] = b;
      n++;
    };
    const zOf = (v: number) => 1 + p.lift * hmax * Math.min(1, v / 0.3);
    const dimmed = (l: number, j: number) => (j === K ? l : EMPTY + (l - EMPTY) * dim);
    // diffusion glow on the links along which the change travelled
    const linkGlow = (i: number, j: number) => {
      if (!e.edge[i * N + j] || p.front < -50) return 0;
      const r = Math.max(e.round[i], e.round[j]);
      return clamp(1 - Math.abs(p.front - (r - 0.45)) / 0.55);
    };

    // matrix
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        let v = lerp(e.A0[i * N + j], e.A1[i * N + j], vm);
        if (i === j) v = this.diag[j];
        let l = dimmed(lum(v), j);
        if (hv && !lifted) {
          if (i === hv.r && j === hv.c) l = 1;
          else if (i === hv.r || j === hv.c) l = Math.min(1, l + 0.12);
        }
        const f = this.flash[i * N + j];
        if (f > l) l = f;
        if (!lifted && v > 0) { const gl = linkGlow(i, j); if (gl > 0) l = Math.max(l, 0.45 + 0.55 * gl); }
        let r = l, g = l, b = l * 0.97;
        if (i === j && this.eIn[j]) { r = ACC[0]; g = ACC[1]; b = ACC[2]; }
        put(this.colX[j] * u, this.rowTop(this.rowPos[i]), this.colW[j] * u, uy, zOf(v) + (this.moving[i] || this.moving[j] ? 2 + ((i * 7 + j) % 5) * 0.2 : 0), r, g, b);
      }
    }
    // supplied rows: E and P of K fly up their column to the diagonal; for other firms they go dark in place
    const flat = 1 - p.lift;
    for (let k = 0; k < 3; k++) {
      for (let j = 0; j < N; j++) {
        const v = e.L[k * N + j];
        const moved = k === 0 ? this.eIn[j] : k === 1 ? this.pIn[j] : 0;
        const fly = j === K && k < 2 ? (k === 0 ? p.eK : p.pK) : 0;
        const x = this.colX[j] * u, w = this.colW[j] * u * flat;
        if (fly > 0 && fly < 0.98) {
          // the hole it leaves, then the cell itself in flight (white: it is being moved)
          put(x, this.supTop(k), w, 1.5 * u, 1, EMPTY, EMPTY, EMPTY);
          const f = ease(fly);
          const y = lerp(this.supTop(k), this.rowTop(this.rowPos[K]), f), h = lerp(1.5 * u, uy, f);
          put(x, y, w, h, 3, 0.96, 0.96, 0.93);
          continue;
        }
        let l = moved ? EMPTY : dimmed(lum(v), j);
        if (hv && !lifted && !moved) {
          if (hv.r === N + k && hv.c === j) l = 1;
          else if (hv.r === N + k || hv.c === j) l = Math.min(1, l + 0.12);
        }
        put(x, this.supTop(k), w, 1.5 * u * flat, 1, l, l, l * 0.97);
      }
    }
    // output row: every column is one unit of output
    for (let j = 0; j < N; j++) {
      const l = dimmed(0.58, j);
      put(this.colX[j] * u, this.outTop(), this.colW[j] * u * flat, 1.5 * u * flat, 1, l, l, l * 0.97);
    }

    // lift: tilt about the matrix centre and fit the lifted object to the layout's fit box
    const le = ease(p.lift);
    const rx = -0.98, rz = 0.55;
    let pos: [number, number, number] = [cx - W / 2, -(cy - H / 2), 0], sc = 1;
    if (le > 0) {
      const cz = Math.cos(rz), sz = Math.sin(rz), ca = Math.cos(rx), sa = Math.sin(rx);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const X of [-tw / 2, tw / 2]) for (const Y of [-th / 2, th / 2]) for (const Z of [0, hmax]) {
        const xa = X * cz - Y * sz, ya = X * sz + Y * cz;
        const yb = ya * ca - Z * sa;
        x0 = Math.min(x0, xa); x1 = Math.max(x1, xa); y0 = Math.min(y0, yb); y1 = Math.max(y1, yb);
      }
      const F = this.L.fit;
      const s = Math.min(F.w / (x1 - x0), F.h / (y1 - y0));
      const fx = F.x + F.w / 2 - W / 2 - s * (x0 + x1) / 2;
      const fy = F.bottom ? -(F.y + F.h - H / 2) - s * y0 : -(F.y + F.h / 2 - H / 2) - s * (y0 + y1) / 2;
      pos = [lerp(pos[0], fx, le), lerp(pos[1], fy, le), 0];
      sc = lerp(1, s, le);
    }
    this.gl.draw(D, n, pos, rx * le, rz * le, sc);
  }
}
