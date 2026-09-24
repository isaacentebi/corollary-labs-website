// Figures 1–3 of the home page: states for the string-diagram renderer. Coordinates are in each figure's viewBox.
// Drawing conventions (legend at Fig. 1): thick outline = a firm drawn as one box; thin outline = a process carried
// out by people; solid = a process carried out by an agent; dashed = a firm's boundary; blue = what changes.
import type { State, BoxS } from './diagram';

export interface TypeLine { t: string; g: string }
const op = (c: string) => `<span class="op">${c}</span>`;
const TO = op('→'), OT = op('⊗'), CO = op('∘');
const sub = (base: string, i: string | number) => `${base}<tspan class="dg-sub" dy="6">${i}</tspan>`;

// ── Figure 1 — a firm, closed and opened ────────────────────────────────────────────────
// viewBox 640 × 400
export const fig1: State[] = [
  {
    boxes: { f: { x: 320, y: 200, w: 130, h: 200, solid: 0, firm: 1, label: 'f' } },
    bounds: { F: { x: 265, y: 125, w: 110, h: 150, o: 0 } },
    wires: {
      X: { from: { x: 10, y: 200 }, to: { b: 'f', side: 'in' }, label: 'X', note: 'inputs', na: 'start', lt: 0.3 },
      Y: { from: { b: 'f', side: 'out' }, to: { x: 630, y: 200 }, label: 'Y', note: 'outputs', na: 'end', lt: 0.7 },
    },
    labels: { ft: { x: 116, y: 94, text: 'f', o: 0, cls: 'dg-it', anchor: 'start' } },
  },
  {
    boxes: {
      f: { x: 320, y: 200, w: 440, h: 270, solid: 0, firm: 1, o: 0 },
      p1: { x: 205, y: 200, w: 46, h: 70, solid: 0 },
      p2: { x: 325, y: 140, w: 46, h: 56, solid: 0 },
      p3: { x: 445, y: 222, w: 46, h: 90, solid: 0 },
    },
    bounds: { F: { x: 100, y: 65, w: 440, h: 270, o: 1 } },
    wires: {
      X: { from: { x: 10, y: 200 }, to: { b: 'f', side: 'in' }, label: 'X', note: 'inputs', na: 'start', lt: 0.5 },
      Y: { from: { b: 'f', side: 'out' }, to: { x: 630, y: 200 }, label: 'Y', note: 'outputs', na: 'end', lt: 0.5 },
      i1: { from: { b: 'f', side: 'in' }, to: { b: 'p1', side: 'in' } },
      i2: { from: { b: 'p1', side: 'out', dy: -18 }, to: { b: 'p2', side: 'in' } },
      i3: { from: { b: 'p1', side: 'out', dy: 18 }, to: { b: 'p3', side: 'in', dy: 22 } },
      i4: { from: { b: 'p2', side: 'out' }, to: { b: 'p3', side: 'in', dy: -26 } },
      i5: { from: { b: 'p3', side: 'out', dy: -22 }, to: { b: 'f', side: 'out' } },
    },
    labels: { ft: { x: 116, y: 94, text: 'f', o: 1, cls: 'dg-it', anchor: 'start' } },
  },
];
const T1 = { t: `<i>f</i> : <i>X</i> ${TO} <i>Y</i>`, g: '' };
export const fig1Types: TypeLine[] = [T1, T1];

// ── Figure 2 — automation of P ──────────────────────────────────────────────────────────
// viewBox 640 × 400
const f2 = (inside: boolean): State => ({
  boxes: {
    f: { x: 455, y: 200, w: 70, h: 150, solid: 0, firm: 1, label: 'f' },
    g: { x: 250, y: 250, w: 64, h: 60, solid: inside ? 1 : 0, label: 'g', blue: inside ? 1 : 0 },
  },
  bounds: { F: inside ? { x: 178, y: 92, w: 348, h: 216, blue: 1 } : { x: 386, y: 92, w: 140, h: 216, blue: 1 } },
  wires: {
    A: { from: { x: 30, y: 160 }, to: { b: 'f', side: 'in', dy: -40 }, label: 'A', note: 'materials', na: 'start', lt: 0.14 },
    O: { from: { x: 30, y: 250 }, to: { b: 'g', side: 'in' }, label: 'O', note: 'objective', na: 'start', lt: 0.4 },
    P: { from: { b: 'g', side: 'out' }, to: { b: 'f', side: 'in', dy: 50 }, label: 'P', note: 'plan', lt: 0.5, blue: inside ? 1 : 0 },
    Y: { from: { b: 'f', side: 'out' }, to: { x: 610, y: 200 }, label: 'Y', note: 'product', na: 'end', lt: 0.65 },
  },
});
export const fig2: State[] = [f2(false), f2(true), f2(true)];
const T2b = { t: `<i>f</i> ${CO} (1<sub><i>A</i></sub> ${OT} <i>g</i>) : <i>A</i> ${OT} <i>O</i> ${TO} <i>Y</i>`, g: 'in: materials, plan → materials, objective' };
export const fig2Types: TypeLine[] = [
  { t: `<i>f</i> : <i>A</i> ${OT} <i>P</i> ${TO} <i>Y</i>`, g: '' },
  T2b, T2b,
];

// ── Figure 3 — replacement, isotopy, surgery ────────────────────────────────────────────
// viewBox (−50, 0) 850 × 460. The boundary runs from x = 100 to x = 640; wire words sit outside it, centred in the margins.
const E = (x: number, y: number, solid: number, i: number): BoxS => ({ x, y, w: 56, h: 80, solid, label: sub('e', i) });
const bnd = { F: { x: 100, y: 34, w: 540, h: 404, tag: 'F' } };
const at = (x0: number, x1: number, x: number) => (x - x0) / (x1 - x0); // position along a wire for a word at x
const L = 27, Rm = 718;
const Ow = (x1: number) => ({ label: 'O', note: 'objective', na: 'start' as const, lt: at(-46, x1, L) });
const Aw = { label: 'A', note: 'materials', na: 'start' as const, lt: at(-46, 256, L) };
const Yw = (x0: number) => ({ label: 'Y', note: 'product', na: 'end' as const, lt: at(x0, 796, Rm) });
const plans = (y: number): State['labels'] => ({ pl: { x: 400, y, text: 'plans', cls: 'dg-note' } });

const f3a = (e2solid: number): State => ({
  bounds: bnd,
  boxes: { c: { x: 176, y: 140, w: 80, h: 70, solid: 0, label: 'c' }, e1: E(284, 300, 0, 1), e2: E(410, 300, e2solid, 2), e3: E(536, 300, 0, 3) },
  wires: {
    O: { from: { x: -46, y: 140 }, to: { b: 'c', side: 'in' }, ...Ow(136) },
    A: { from: { x: -46, y: 318 }, to: { b: 'e1', side: 'in', dy: 18 }, ...Aw },
    p1: { from: { b: 'c', side: 'out', dy: 20 }, to: { b: 'e1', side: 'in', dy: -22 }, bend: 0.5 },
    p2: { from: { b: 'c', side: 'out', dy: 0 }, to: { b: 'e2', side: 'in', dy: -22 }, bend: 0.8 },
    p3: { from: { b: 'c', side: 'out', dy: -20 }, to: { b: 'e3', side: 'in', dy: -22 }, bend: 0.9 },
    m1: { from: { b: 'e1', side: 'out' }, to: { b: 'e2', side: 'in', dy: 18 } },
    m2: { from: { b: 'e2', side: 'out' }, to: { b: 'e3', side: 'in', dy: 18 } },
    Y: { from: { b: 'e3', side: 'out' }, to: { x: 796, y: 300 }, ...Yw(564) },
  },
  labels: plans(102),
});
const f3c: State = {
  bounds: bnd,
  boxes: { c: { x: 196, y: 206, w: 80, h: 70, solid: 0, label: 'c' }, e1: E(290, 268, 0, 1), e2: E(424, 346, 1, 2), e3: E(560, 262, 0, 3) },
  wires: {
    O: { from: { x: -46, y: 140 }, to: { b: 'c', side: 'in' }, ...Ow(156), bend: 0.93 },
    A: { from: { x: -46, y: 318 }, to: { b: 'e1', side: 'in', dy: 18 }, ...Aw },
    p1: { from: { b: 'c', side: 'out', dy: 20 }, to: { b: 'e1', side: 'in', dy: -22 }, bend: 0.5 },
    p2: { from: { b: 'c', side: 'out', dy: 0 }, to: { b: 'e2', side: 'in', dy: -22 }, bend: 0.8 },
    p3: { from: { b: 'c', side: 'out', dy: -20 }, to: { b: 'e3', side: 'in', dy: -22 }, bend: 0.9 },
    m1: { from: { b: 'e1', side: 'out' }, to: { b: 'e2', side: 'in', dy: 18 } },
    m2: { from: { b: 'e2', side: 'out' }, to: { b: 'e3', side: 'in', dy: 18 } },
    Y: { from: { b: 'e3', side: 'out' }, to: { x: 796, y: 300 }, ...Yw(588) },
  },
  labels: plans(168),
};
const f3d: State = {
  bounds: bnd,
  boxes: {
    k: { x: 170, y: 150, w: 12, h: 12, dot: true, blue: 1 },
    r: { x: 196, y: 372, w: 56, h: 48, solid: 0, label: 'r', blue: 1 },
    h: { x: 598, y: 196, w: 40, h: 40, solid: 0, label: 'h', blue: 1 },
    e1: E(290, 300, 1, 1), e2: E(410, 300, 1, 2), e3: E(530, 300, 1, 3),
  },
  wires: {
    O: { from: { x: -46, y: 150 }, to: { b: 'k', side: 'in' }, ...Ow(164) },
    A: { from: { x: -46, y: 318 }, to: { b: 'e1', side: 'in', dy: 18 }, label: 'A', note: 'materials', na: 'start', lt: at(-46, 262, L) },
    o1: { from: { b: 'k', side: 'out' }, to: { b: 'e1', side: 'in', dy: -22 }, bend: 0.55, blue: 1 },
    o2: { from: { b: 'k', side: 'out' }, to: { b: 'e2', side: 'in', dy: -22 }, bend: 0.76, blue: 1 },
    o3: { from: { b: 'k', side: 'out' }, to: { b: 'e3', side: 'in', dy: -22 }, bend: 0.88, blue: 1 },
    m1: { from: { b: 'e1', side: 'out' }, to: { b: 'e2', side: 'in', dy: 18 } },
    m2: { from: { b: 'e2', side: 'out' }, to: { b: 'e3', side: 'in', dy: 18 } },
    U: { from: { b: 'e3', side: 'out', dy: 28 }, to: { b: 'r', side: 'in' }, loop: -32, blue: 1, note: 'feedback', lt: 0.45 },
    R: { from: { b: 'r', side: 'out' }, to: { b: 'e1', side: 'in', dy: 34 }, blue: 1, bend: 0.45 },
    Zf: { from: { b: 'e3', side: 'out', dy: -26 }, to: { b: 'h', side: 'in' }, blue: 1 },
    Z: { from: { b: 'h', side: 'out' }, to: { x: 796, y: 196 }, label: 'Z', note: 'new product', noteShort: 'new', na: 'end', lt: at(618, 796, Rm), blue: 1 },
    Y: { from: { b: 'e3', side: 'out' }, to: { x: 796, y: 300 }, ...Yw(558) },
  },
};
export const fig3: State[] = [f3a(0), f3a(1), f3c, f3d];
const T3 = { t: `<i>F</i> : <i>A</i> ${OT} <i>O</i> ${TO} <i>Y</i>`, g: '' };
export const fig3Types: TypeLine[] = [T3, T3, T3, { t: `<i>F</i>′ : <i>A</i> ${OT} <i>O</i> ${TO} <i>Y</i> ${OT} <i>Z</i>`, g: 'out: product → product, new product' }];
