// The composition. State A: planes in tension on one picture plane. B: the fracture — each plane
// cracks along cuts it always had, pieces thrown along the agent's vector. C: the same pieces, none
// removed, reassembled into a spatial construction around the agent. One cluster-local frame, units ≈ ±1.
import { type V3, type Q, v, add, sub, scale, norm, len, dot, cross, qId, qZ, qX, qY, qMul, qAxis, qLook, qRot, rng } from './math3';

export type Mat = 'chalk' | 'haze' | 'pewter' | 'slate' | 'graphite' | 'cad';
export interface Pose { p: V3; q: Q; s: V3 }
export interface Frag { mat: Mat; h: V3; A: Pose; B: Pose; C: Pose; o: number; o2: number; tint: number; parent: number; mid: number }
export interface Parent { mat: Mat; h: V3; A: Pose; cuts: number[]; frags: Frag[]; o: number; minor: boolean; tint: number }

type Join = { mode: 'join'; c: V3; dir: V3; up?: V3; k?: number; t?: number };
type Stack = { mode: 'stack'; c: V3; step: V3; q?: Q; fan?: number; s?: V3 };
interface Def { mat: Mat; c: [number, number]; w: number; h: number; ang: number; n: number; z: number; t: number; C: Join | Stack; minor?: boolean }

const D = Math.PI / 180;
const UP = qX(-Math.PI / 2); // a plate lying flat, face up

// The picture rises along one diagonal (28°). One dominant plane carries the name; a large dark plane,
// cropped by the frame (top-left, clear of the captions), gives the scale jump; everything else is small and far.
const DEFS: Def[] = [
  // 0 · the dominant pale plane → floors, jogged and fanned
  { mat: 'chalk', c: [-0.05, 0.12], w: 1.5, h: 0.27, ang: 28, n: 5, z: 0.02, t: 0.024,
    C: { mode: 'stack', c: v(-0.28, -0.1, 0.22), step: v(0.2, 0.1, -0.12), q: UP, fan: 0.2, s: v(1.5, 1.35, 1) } },
  // 1 · long bar under it → one continuous rod through the construction
  { mat: 'pewter', c: [0.22, -0.21], w: 1.9, h: 0.04, ang: 28, n: 6, z: 0.05, t: 0.02,
    C: { mode: 'join', c: v(0.02, 0.1, 0.02), dir: v(1, 0.38, -0.7), k: 1.12 } },
  // 2 · dark mass behind the plane → standing masses
  { mat: 'graphite', c: [-0.5, -0.19], w: 0.46, h: 0.4, ang: 28, n: 3, z: -0.01, t: 0.03,
    C: { mode: 'stack', c: v(-0.62, -0.4, 0.3), step: v(0.17, -0.06, 0.15), q: qY(0.25), fan: -0.12, s: v(1.25, 1.2, 4.4) } },
  // 3 · pale square, high → two plates lifted
  { mat: 'haze', c: [0.74, 0.55], w: 0.2, h: 0.2, ang: 14, n: 2, z: 0.03, t: 0.018,
    C: { mode: 'stack', c: v(0.52, 0.66, -0.34), step: v(0.16, 0.12, 0.14), q: qMul(qY(0.5), UP), fan: 0.3, s: v(2.3, 1.6, 1) } },
  // 4 · thin line across the grain → vertical mast
  { mat: 'chalk', c: [0.2, 0.16], w: 1.4, h: 0.011, ang: 118, n: 4, z: -0.004, t: 0.011,
    C: { mode: 'join', c: v(0.44, 0.24, -0.22), dir: v(0, 1, 0), up: v(1, 0, 0), k: 1.0 } },
  // 5 · short blue bar → beam in depth
  { mat: 'slate', c: [0.84, 0.1], w: 0.48, h: 0.085, ang: 28, n: 3, z: 0.01, t: 0.03,
    C: { mode: 'join', c: v(0.66, -0.3, 0.22), dir: v(0.18, 0, 1), k: 1.3, t: 1.6 } },
  // 6 · the large dark plane, cropped by the frame → the ground the construction stands on
  { mat: 'slate', c: [-1.52, 0.78], w: 1.5, h: 0.5, ang: 28, n: 3, z: -0.12, t: 0.02,
    C: { mode: 'stack', c: v(-0.02, -0.72, 0.06), step: v(0.42, -0.03, 0.08), q: qMul(qY(-0.12), UP), fan: 0.07, s: v(0.82, 0.95, 1) } },
  // 7–8 · two short bars → a stair
  { mat: 'chalk', c: [-0.66, 0.64], w: 0.3, h: 0.045, ang: 28, n: 1, z: 0.03, t: 0.016, minor: true,
    C: { mode: 'stack', c: v(-0.16, 0.5, 0.42), step: v(0, 0, 0), q: qMul(qY(0.55), UP), s: v(1, 2.6, 1) } },
  { mat: 'haze', c: [-0.53, 0.74], w: 0.18, h: 0.045, ang: 28, n: 1, z: 0.03, t: 0.016, minor: true,
    C: { mode: 'stack', c: v(0.02, 0.62, 0.36), step: v(0, 0, 0), q: qMul(qY(0.7), UP), s: v(1, 2.6, 1) } },
  // 9–10 · two small far squares → cap of the mast, a floating plate
  { mat: 'chalk', c: [1.12, 0.8], w: 0.065, h: 0.065, ang: 28, n: 1, z: 0.04, t: 0.016, minor: true,
    C: { mode: 'stack', c: v(0.44, 0.97, -0.22), step: v(0, 0, 0), q: qMul(qY(0.6), UP), s: v(2.6, 2.6, 1) } },
  { mat: 'haze', c: [1.24, 0.68], w: 0.04, h: 0.04, ang: 28, n: 1, z: 0.04, t: 0.014, minor: true,
    C: { mode: 'stack', c: v(-0.84, 0.3, -0.28), step: v(0, 0, 0), q: qMul(qY(0.3), UP), s: v(5, 4, 1) } },
];

/** Where the agent strikes the picture, and where it waits (landscape / portrait). */
export const IMPACT: V3 = v(0.12, 0.07, 0.08);
export const AGENT_START_L: V3 = v(1.22, -0.6, 0.12);
export const AGENT_START_P: V3 = v(0.52, -0.98, 0.12);
export const AGENT_H: V3 = v(0.17, 0.021, 0.021);
export const AGENT_C: Pose = { p: v(-0.04, 0.12, 0.1), q: qLook(v(-0.35, 0.18, 1)), s: v(2.3, 1.35, 1.35) };

export interface Variant { variant?: number; slabH?: number }

/** Each page gets its own picture: the same grammar, secondary planes moved and dropped per variant. */
function vary(defs: Def[], variant: number, slabH?: number): Def[] {
  if (!variant && !slabH) return defs;
  const r = rng(1000 + variant * 7919);
  return defs.map((d, i) => {
    const o = { ...d, c: [...d.c] as [number, number] };
    if (i === 0 && slabH) o.h = slabH;
    if (variant && i >= 2) {
      const j = i === 6 ? 0.25 : i >= 7 ? 0.35 : 0.14;
      o.c = [d.c[0] + (r() - 0.5) * 2 * j, d.c[1] + (r() - 0.5) * 2 * j];
      if (i === 3 || i === 5) o.w = d.w * (0.7 + r() * 0.7);
      if (i === 6) o.c = [variant % 2 ? -1.52 : 1.78, variant % 2 ? 0.8 : -0.18];
      // keep the small planes clear of the header
      if (i !== 6) o.c = [Math.min(o.c[0], 1.15), Math.min(o.c[1], 0.66)];
    }
    return o;
  });
}

export function buildComposition(start: V3, seed = 7, opt: Variant = {}): Parent[] {
  const r = rng(seed);
  const DEFS_V = vary(DEFS, opt.variant ?? 0, opt.slabH);
  const dir3 = norm(sub(IMPACT, start));
  const d2 = norm(v(dir3[0], dir3[1], 0));
  const tumbleAxis = cross(d2, v(0, 0, 1)); // pieces tumble forward, over the direction of travel
  const parents: Parent[] = [];

  DEFS_V.forEach((df, pi) => {
    const a = df.ang * D;
    const ax: V3 = v(Math.cos(a), Math.sin(a), 0);
    const qa = qZ(a);
    const wts = Array.from({ length: df.n }, () => 0.62 + r() * 0.8);
    const tot = wts.reduce((s, x) => s + x, 0);
    const lens = wts.map((x) => (x / tot) * df.w);
    const k = df.C.mode === 'join' ? df.C.k ?? 1 : 1;
    const joinTotal = df.w * k;
    const center = v(df.c[0], df.c[1], df.z);
    const tint = (r() - 0.5) * 2;
    const cuts: number[] = [];
    const frags: Frag[] = [];
    let u = 0, ju = 0;

    lens.forEach((L, i) => {
      const mid = u + L / 2 - df.w / 2;
      u += L;
      if (i < lens.length - 1) cuts.push(u - df.w / 2);
      const h: V3 = v(L / 2, df.h / 2, df.t);
      const A: Pose = { p: add(center, scale(ax, mid)), q: qa, s: v(1, 1, 1) };

      // B — thrown along the agent's vector; hardest near its path and downstream of the strike
      const rel = sub(A.p, IMPACT);
      const along = dot(rel, d2);
      const perpV = sub(v(rel[0], rel[1], 0), scale(d2, along));
      const perp = len(perpV);
      const near = Math.exp(-(perp * perp) / 0.3);
      const m = (0.16 + 0.62 * near) * (along > -0.1 ? 1 : 0.55) * (0.8 + r() * 0.45);
      const side = perp > 1e-3 ? scale(perpV, 1 / perp) : v(0, 0, 0);
      const Bp = add(add(A.p, scale(d2, m)), add(scale(side, 0.2 * near + 0.05), v(0, 0, (r() - 0.35) * 0.55 * (0.4 + near))));
      const Bq = qMul(qAxis(add(tumbleAxis, v((r() - 0.5) * 0.6, (r() - 0.5) * 0.6, (r() - 0.5) * 0.4)), (0.5 + m * 1.9) * (r() > 0.3 ? 1 : -1)), qa);
      const B: Pose = { p: Bp, q: Bq, s: v(1, 1, 1) };

      // C — the new order
      let C: Pose;
      const L2 = df.C;
      if (L2.mode === 'join') {
        const dd = norm(L2.dir);
        const Lk = L * k;
        const at = ju + Lk / 2 - joinTotal / 2;
        ju += Lk;
        C = { p: add(L2.c, scale(dd, at)), q: qLook(dd, L2.up ?? v(0, 1, 0)), s: v(k, 1, L2.t ?? 1) };
      } else {
        const off = i - (df.n - 1) / 2;
        C = { p: add(L2.c, scale(L2.step, off)), q: qMul(qY((L2.fan ?? 0) * off), L2.q ?? qId()), s: L2.s ?? v(1, 1, 1) };
      }

      // pieces nearest the strike go first
      const dist = len(v(rel[0], rel[1], 0));
      frags.push({ mat: df.mat, h, A, B, C, o: Math.min(1, dist / 1.7), o2: r(), tint: tint + (r() - 0.5) * 0.8, parent: pi, mid });
    });

    parents.push({
      mat: df.mat, h: v(df.w / 2, df.h / 2, df.t), A: { p: center, q: qa, s: v(1, 1, 1) }, cuts, frags,
      o: Math.min(...frags.map((f) => f.o)), minor: !!df.minor, tint,
    });
  });
  return parents;
}

/** Rotate + scale + translate a local pose into a world frame. */
export function place(p: Pose, pos: V3, q: Q, k: number): Pose {
  return { p: add(pos, qRot(q, scale(p.p, k))), q: qMul(q, p.q), s: p.s };
}
