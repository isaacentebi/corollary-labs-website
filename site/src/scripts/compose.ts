// The composition: a set of planes in tension (state A, a flat picture plane), their fracture (state B)
// and the new spatial order they reassemble into (state C). All in one cluster-local frame, units ≈ ±1.
import { type V3, type Q, v, add, sub, scale, norm, len, qId, qZ, qX, qY, qMul, qAxis, qLook, qRot, rng } from './math3';

export type Col = 'chalk' | 'haze' | 'pewter' | 'slate' | 'graphite' | 'cad';
export interface Pose { p: V3; q: Q; s: V3 }
export interface Frag { col: Col; h: V3; A: Pose; B: Pose; C: Pose; o: number; o2: number; parent: number; minor: boolean }

type Join = { mode: 'join'; c: V3; dir: V3; up?: V3; k?: number; t?: number };
type Stack = { mode: 'stack'; c: V3; step: V3; q?: Q; fan?: number; s?: V3 };
interface Parent { col: Col; c: [number, number]; w: number; h: number; ang: number; n: number; z: number; t: number; C: Join | Stack; minor?: boolean }

const D = Math.PI / 180;
const UP = qX(-Math.PI / 2); // plate lying flat, face up

// The dominant diagonal of the picture rises at 28°.
const P: Parent[] = [
  // 0 · the large pale slab → floors, jogged and fanned
  { col: 'chalk', c: [-0.2, 0.1], w: 1.26, h: 0.25, ang: 28, n: 5, z: 0.02, t: 0.022,
    C: { mode: 'stack', c: v(-0.28, -0.12, 0.22), step: v(0.2, 0.1, -0.12), q: UP, fan: 0.2, s: v(1.7, 1.45, 1) } },
  // 1 · long bar → one continuous rod through the construction
  { col: 'pewter', c: [0.14, -0.2], w: 1.72, h: 0.045, ang: 28, n: 6, z: 0.05, t: 0.022,
    C: { mode: 'join', c: v(0.02, 0.1, 0.02), dir: v(1, 0.38, -0.7), k: 1.28 } },
  // 2 · dark block → standing masses with depth
  { col: 'graphite', c: [-0.5, -0.3], w: 0.54, h: 0.36, ang: 118, n: 4, z: 0.0, t: 0.03,
    C: { mode: 'stack', c: v(-0.62, -0.42, 0.3), step: v(0.15, -0.06, 0.14), q: qY(0.25), fan: -0.12, s: v(1.15, 1.25, 4.2) } },
  // 3 · pale square → two plates lifted high
  { col: 'haze', c: [0.58, 0.44], w: 0.21, h: 0.21, ang: 14, n: 2, z: 0.03, t: 0.018,
    C: { mode: 'stack', c: v(0.52, 0.66, -0.34), step: v(0.16, 0.12, 0.14), q: qMul(qY(0.5), UP), fan: 0.3, s: v(2.3, 1.6, 1) } },
  // 4 · thin line → vertical mast
  { col: 'chalk', c: [0.04, 0.22], w: 1.34, h: 0.012, ang: 118, n: 4, z: 0.06, t: 0.012,
    C: { mode: 'join', c: v(0.44, 0.24, -0.22), dir: v(0, 1, 0), up: v(1, 0, 0), k: 1.05 } },
  // 5 · dark-blue bar → beam in depth
  { col: 'slate', c: [0.64, 0.02], w: 0.62, h: 0.09, ang: 28, n: 3, z: 0.01, t: 0.03,
    C: { mode: 'join', c: v(0.66, -0.3, 0.22), dir: v(0.18, 0, 1), k: 1.3, t: 1.6 } },
  // 6–8 · three short bars → a stair
  { col: 'chalk', c: [-0.74, 0.44], w: 0.34, h: 0.05, ang: 28, n: 2, z: 0.03, t: 0.016, minor: true,
    C: { mode: 'stack', c: v(-0.2, 0.52, 0.42), step: v(0.13, 0.08, -0.03), q: qMul(qY(0.55), UP), fan: 0.08, s: v(1, 2.4, 1) } },
  { col: 'haze', c: [-0.66, 0.54], w: 0.24, h: 0.05, ang: 28, n: 1, z: 0.03, t: 0.016, minor: true,
    C: { mode: 'stack', c: v(0.08, 0.66, 0.36), step: v(0, 0, 0), q: qMul(qY(0.7), UP), s: v(1, 2.4, 1) } },
  { col: 'pewter', c: [-0.58, 0.64], w: 0.14, h: 0.05, ang: 28, n: 1, z: 0.03, t: 0.016, minor: true,
    C: { mode: 'stack', c: v(0.22, 0.75, 0.33), step: v(0, 0, 0), q: qMul(qY(0.8), UP), s: v(1, 2.4, 1) } },
  // 9 · small square → cap of the mast
  { col: 'chalk', c: [0.84, 0.64], w: 0.075, h: 0.075, ang: 28, n: 1, z: 0.04, t: 0.016, minor: true,
    C: { mode: 'stack', c: v(0.44, 0.96, -0.22), step: v(0, 0, 0), q: qMul(qY(0.6), UP), s: v(1.6, 1.6, 1) } },
  // 10 · faint long line → horizon rail
  { col: 'pewter', c: [0.02, -0.04], w: 2.5, h: 0.006, ang: -4, n: 3, z: -0.02, t: 0.006,
    C: { mode: 'join', c: v(-0.05, -0.66, 0.05), dir: v(1, 0, 0.22), k: 1.3 } },
  // 11 · dark-blue plane → fins
  { col: 'slate', c: [0.26, 0.47], w: 0.42, h: 0.16, ang: -62, n: 2, z: 0.045, t: 0.02,
    C: { mode: 'stack', c: v(0.18, -0.12, 0.62), step: v(0.16, 0, -0.06), q: qY(1.05), s: v(1.3, 2.4, 1.2) } },
  // 12 · small pale rectangle → floating plate
  { col: 'chalk', c: [0.34, -0.54], w: 0.22, h: 0.08, ang: 28, n: 1, z: 0.02, t: 0.016, minor: true,
    C: { mode: 'stack', c: v(-0.82, 0.3, -0.3), step: v(0, 0, 0), q: qMul(qY(0.3), UP), s: v(1.8, 2.6, 1) } },
];

/** Where the agent strikes the picture. */
export const IMPACT: V3 = v(0.1, 0.02, 0.08);
/** Where the agent waits in the first state, and its heading. */
export const AGENT_START: V3 = v(1.32, -0.76, 0.12);
export const AGENT_H: V3 = v(0.17, 0.021, 0.021);
export const AGENT_C: Pose = { p: v(-0.04, 0.12, 0.1), q: qLook(v(-0.35, 0.18, 1)), s: v(2.3, 1.35, 1.35) };

export function buildFragments(seed = 7): Frag[] {
  const r = rng(seed);
  const out: Frag[] = [];
  P.forEach((pa, pi) => {
    const a = pa.ang * D;
    const ax: V3 = v(Math.cos(a), Math.sin(a), 0);
    const qa = qZ(a);
    // uneven cuts
    const wts = Array.from({ length: pa.n }, () => 0.65 + r() * 0.8);
    const tot = wts.reduce((s, x) => s + x, 0);
    let u = 0;
    const lens = wts.map((x) => (x / tot) * pa.w);
    const k = pa.C.mode === 'join' ? pa.C.k ?? 1 : 1;
    const joinTotal = pa.w * k;
    let ju = 0;
    lens.forEach((L, i) => {
      const mid = u + L / 2 - pa.w / 2;
      u += L;
      const h: V3 = v(L / 2, pa.h / 2, pa.t);
      const A: Pose = { p: add(v(pa.c[0], pa.c[1], pa.z), scale(ax, mid)), q: qa, s: v(1, 1, 1) };

      // B — fracture: thrown away from the impact, spun, spread in depth
      const d0 = sub(A.p, IMPACT);
      const dist = len([d0[0], d0[1], 0]);
      const dir = norm(v(d0[0] + (r() - 0.5) * 0.5, d0[1] + (r() - 0.5) * 0.5, (r() - 0.5) * 1.4));
      const push = 0.2 + (0.35 + r() * 0.35) / (0.55 + dist);
      const B: Pose = {
        p: add(A.p, scale(dir, push)),
        q: qMul(qAxis(v(r() - 0.5, r() - 0.5, r() - 0.5), (r() - 0.5) * 2.2), qa),
        s: v(1, 1, 1),
      };

      // C — the new order
      let C: Pose;
      const L2 = pa.C;
      if (L2.mode === 'join') {
        const d = norm(L2.dir);
        const Lk = L * k;
        const at = ju + Lk / 2 - joinTotal / 2;
        ju += Lk;
        C = { p: add(L2.c, scale(d, at)), q: qLook(d, L2.up ?? v(0, 1, 0)), s: v(k, 1, L2.t ?? 1) };
      } else {
        const off = i - (pa.n - 1) / 2;
        const qb = L2.q ?? qId();
        C = { p: add(L2.c, scale(L2.step, off)), q: qMul(qY((L2.fan ?? 0) * off), qb), s: L2.s ?? v(1, 1, 1) };
      }

      out.push({ col: pa.col, h, A, B, C, o: Math.min(1, dist / 1.25), o2: r(), parent: pi, minor: !!pa.minor });
    });
  });
  return out;
}

/** Rotate + scale + translate a local pose into a world frame. */
export function place(p: Pose, pos: V3, q: Q, k: number): Pose {
  return { p: add(pos, qRot(q, scale(p.p, k))), q: qMul(q, p.q), s: p.s };
}
