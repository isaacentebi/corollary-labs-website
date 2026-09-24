// Figures 1–3 of the home page: states for the string-diagram renderer. Coordinates are in each figure's viewBox.
import type { State, BoxS } from './diagram';

const sub = (base: string, i: string | number) => `${base}<tspan class="dg-sub" dy="6">${i}</tspan>`;

// ── Figure 1 — a firm, closed and opened ────────────────────────────────────────────────
// viewBox 640 × 400
export const fig1: State[] = [
  {
    boxes: { f: { x: 320, y: 200, w: 110, h: 150, solid: 1, label: 'f' } },
    bounds: { F: { x: 265, y: 125, w: 110, h: 150, o: 0 } },
    wires: {
      X: { from: { x: 40, y: 200 }, to: { b: 'f', side: 'in' }, label: 'X', lt: 0.18 },
      Y: { from: { b: 'f', side: 'out' }, to: { x: 600, y: 200 }, label: 'Y', lt: 0.78 },
    },
    labels: { ft: { x: 116, y: 94, text: 'f', o: 0, cls: 'dg-it', anchor: 'start' } },
  },
  {
    boxes: {
      f: { x: 320, y: 200, w: 440, h: 270, solid: 0, o: 0 },
      p1: { x: 205, y: 200, w: 46, h: 70, solid: 0 },
      p2: { x: 325, y: 140, w: 46, h: 56, solid: 0 },
      p3: { x: 445, y: 222, w: 46, h: 90, solid: 0 },
    },
    bounds: { F: { x: 100, y: 65, w: 440, h: 270, o: 1 } },
    wires: {
      X: { from: { x: 40, y: 200 }, to: { b: 'f', side: 'in' }, label: 'X', lt: 0.5 },
      Y: { from: { b: 'f', side: 'out' }, to: { x: 600, y: 200 }, label: 'Y', lt: 0.5 },
      i1: { from: { b: 'f', side: 'in' }, to: { b: 'p1', side: 'in' } },
      i2: { from: { b: 'p1', side: 'out', dy: -18 }, to: { b: 'p2', side: 'in' } },
      i3: { from: { b: 'p1', side: 'out', dy: 18 }, to: { b: 'p3', side: 'in', dy: 22 } },
      i4: { from: { b: 'p2', side: 'out' }, to: { b: 'p3', side: 'in', dy: -26 } },
      i5: { from: { b: 'p3', side: 'out', dy: -22 }, to: { b: 'f', side: 'out' } },
    },
    labels: { ft: { x: 116, y: 94, text: 'f', o: 1, cls: 'dg-it', anchor: 'start' } },
  },
];
export const fig1Types = ['<i>f</i> : <i>X</i> <span class="op">→</span> <i>Y</i>', '<i>f</i> : <i>X</i> <span class="op">→</span> <i>Y</i>'];

// ── Figure 2 — automation of P ──────────────────────────────────────────────────────────
// viewBox 640 × 400
const f2 = (inside: boolean, notes: boolean): State => ({
  boxes: {
    f: { x: 455, y: 200, w: 70, h: 150, solid: 1, label: 'f' },
    g: { x: 250, y: 250, w: 64, h: 60, solid: inside ? 1 : 0, label: 'g' },
  },
  bounds: { F: inside ? { x: 178, y: 92, w: 348, h: 216, blue: 1 } : { x: 386, y: 92, w: 140, h: 216, blue: 1 } },
  wires: {
    A: { from: { x: 30, y: 160 }, to: { b: 'f', side: 'in', dy: -40 }, label: 'A', lt: 0.08 },
    O: { from: { x: 30, y: 250 }, to: { b: 'g', side: 'in' }, label: 'O', lt: 0.4 },
    P: { from: { b: 'g', side: 'out' }, to: { b: 'f', side: 'in', dy: 50 }, label: 'P', lt: 0.55 },
    Y: { from: { b: 'f', side: 'out' }, to: { x: 610, y: 200 }, label: 'Y', lt: 0.6 },
  },
  labels: {
    pl: { x: 352, y: 282, text: 'plan', cls: 'dg-note', o: notes ? 1 : 0 },
    ob: { x: 115, y: 282, text: 'objective', cls: 'dg-note', o: notes ? 1 : 0 },
  },
});
export const fig2: State[] = [f2(false, false), f2(true, false), f2(true, true)];
export const fig2Types = [
  '<i>f</i> : <i>A</i> <span class="op">⊗</span> <i>P</i> <span class="op">→</span> <i>Y</i>',
  '<i>f</i> <span class="op">∘</span> (1<sub><i>A</i></sub> <span class="op">⊗</span> <i>g</i>) : <i>A</i> <span class="op">⊗</span> <i>O</i> <span class="op">→</span> <i>Y</i>',
  '<i>f</i> <span class="op">∘</span> (1<sub><i>A</i></sub> <span class="op">⊗</span> <i>g</i>) : <i>A</i> <span class="op">⊗</span> <i>O</i> <span class="op">→</span> <i>Y</i>',
];

// ── Figure 3 — replacement, isotopy, surgery ────────────────────────────────────────────
// viewBox 720 × 460
const E = (x: number, y: number, solid: number, i: number): BoxS => ({ x, y, w: 56, h: 80, solid, label: sub('e', i) });
const bnd = { F: { x: 64, y: 34, w: 600, h: 404, tag: 'F' } };

const f3a = (e2solid: number): State => ({
  bounds: bnd,
  boxes: { c: { x: 150, y: 140, w: 80, h: 70, solid: 0, label: 'c' }, e1: E(280, 300, 0, 1), e2: E(410, 300, e2solid, 2), e3: E(540, 300, 0, 3) },
  wires: {
    O: { from: { x: 16, y: 140 }, to: { b: 'c', side: 'in' }, label: 'O', lt: 0.05, ldx: 8 },
    A: { from: { x: 16, y: 318 }, to: { b: 'e1', side: 'in', dy: 18 }, label: 'A', lt: 0.05, ldx: 8 },
    p1: { from: { b: 'c', side: 'out', dy: 20 }, to: { b: 'e1', side: 'in', dy: -22 }, bend: 0.5 },
    p2: { from: { b: 'c', side: 'out', dy: 0 }, to: { b: 'e2', side: 'in', dy: -22 }, bend: 0.8 },
    p3: { from: { b: 'c', side: 'out', dy: -20 }, to: { b: 'e3', side: 'in', dy: -22 }, bend: 0.9 },
    m1: { from: { b: 'e1', side: 'out' }, to: { b: 'e2', side: 'in', dy: 18 } },
    m2: { from: { b: 'e2', side: 'out' }, to: { b: 'e3', side: 'in', dy: 18 } },
    Y: { from: { b: 'e3', side: 'out' }, to: { x: 704, y: 300 }, label: 'Y', lt: 0.9, ldx: 6 },
  },
});
const f3c: State = {
  bounds: bnd,
  boxes: { c: { x: 172, y: 206, w: 80, h: 70, solid: 0, label: 'c' }, e1: E(282, 268, 0, 1), e2: E(420, 346, 1, 2), e3: E(560, 262, 0, 3) },
  wires: {
    O: { from: { x: 16, y: 140 }, to: { b: 'c', side: 'in' }, label: 'O', lt: 0.05, ldx: 8 },
    A: { from: { x: 16, y: 318 }, to: { b: 'e1', side: 'in', dy: 18 }, label: 'A', lt: 0.05, ldx: 8 },
    p1: { from: { b: 'c', side: 'out', dy: 20 }, to: { b: 'e1', side: 'in', dy: -22 }, bend: 0.5 },
    p2: { from: { b: 'c', side: 'out', dy: 0 }, to: { b: 'e2', side: 'in', dy: -22 }, bend: 0.8 },
    p3: { from: { b: 'c', side: 'out', dy: -20 }, to: { b: 'e3', side: 'in', dy: -22 }, bend: 0.9 },
    m1: { from: { b: 'e1', side: 'out' }, to: { b: 'e2', side: 'in', dy: 18 } },
    m2: { from: { b: 'e2', side: 'out' }, to: { b: 'e3', side: 'in', dy: 18 } },
    Y: { from: { b: 'e3', side: 'out' }, to: { x: 704, y: 300 }, label: 'Y', lt: 0.9, ldx: 6 },
  },
};
const f3d: State = {
  bounds: bnd,
  boxes: {
    k: { x: 150, y: 150, w: 12, h: 12, dot: true, blue: 1 },
    r: { x: 170, y: 372, w: 56, h: 48, solid: 0, label: 'r', blue: 1 },
    h: { x: 620, y: 206, w: 44, h: 44, solid: 0, label: 'h', blue: 1 },
    e1: E(280, 300, 1, 1), e2: E(410, 300, 1, 2), e3: E(530, 300, 1, 3),
  },
  wires: {
    O: { from: { x: 16, y: 150 }, to: { b: 'k', side: 'in' }, label: 'O', lt: 0.05, ldx: 8 },
    A: { from: { x: 16, y: 318 }, to: { b: 'e1', side: 'in', dy: 18 }, label: 'A', lt: 0.05, ldx: 8 },
    o1: { from: { b: 'k', side: 'out' }, to: { b: 'e1', side: 'in', dy: -22 }, bend: 0.55, blue: 1 },
    o2: { from: { b: 'k', side: 'out' }, to: { b: 'e2', side: 'in', dy: -22 }, bend: 0.76, blue: 1 },
    o3: { from: { b: 'k', side: 'out' }, to: { b: 'e3', side: 'in', dy: -22 }, bend: 0.88, blue: 1 },
    m1: { from: { b: 'e1', side: 'out' }, to: { b: 'e2', side: 'in', dy: 18 } },
    m2: { from: { b: 'e2', side: 'out' }, to: { b: 'e3', side: 'in', dy: 18 } },
    U: { from: { b: 'e3', side: 'out', dy: 28 }, to: { b: 'r', side: 'in' }, loop: -44, blue: 1 },
    R: { from: { b: 'r', side: 'out' }, to: { b: 'e1', side: 'in', dy: 34 }, blue: 1, bend: 0.45 },
    Zf: { from: { b: 'e3', side: 'out', dy: -26 }, to: { b: 'h', side: 'in' }, blue: 1 },
    Z: { from: { b: 'h', side: 'out' }, to: { x: 704, y: 206 }, label: 'Z', lt: 0.82, ldx: 6, blue: 1 },
    Y: { from: { b: 'e3', side: 'out' }, to: { x: 704, y: 300 }, label: 'Y', lt: 0.9, ldx: 6 },
  },
};
export const fig3: State[] = [f3a(0), f3a(1), f3c, f3d];
const T3 = '<i>F</i> : <i>A</i> <span class="op">⊗</span> <i>O</i> <span class="op">→</span> <i>Y</i>';
export const fig3Types = [T3, T3, T3, '<i>F</i>′ : <i>A</i> <span class="op">⊗</span> <i>O</i> <span class="op">→</span> <i>Y</i> <span class="op">⊗</span> <i>Z</i>'];
