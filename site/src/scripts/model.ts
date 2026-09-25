// The score model. Pure functions, shared by the canvas hero (client) and the
// build-time SVG miniatures (server). Coordinates are normalised: t in [0,1] is
// time (left to right), y in [0,1] is register within one system (0 = top).
//
// Six grammars, one per voice, each borrowed from a graphic score:
//   fan    — Xenakis, Metastaseis: ruled string glissandi that fan out and converge
//   line   — Cardew, Treatise: one continuous line; thickness is the only dynamic
//   points — Brown / pointillist events: dots with stems
//   boxes  — Feldman, Projections: boxes on a time grid in high / middle / low register, with a count
//   bars   — Brown, December 1952: horizontal and vertical bars of varying weight
//   bands  — Stockhausen, Studie II: overlapping translucent frequency bands
// A new voice enters (the agent). The others make room, fall onto a shared pulse,
// and each restates its figure in its OWN grammar.

export type Grammar = 'fan' | 'line' | 'points' | 'boxes' | 'bars' | 'bands';

export interface Ev { t: number; d: number; v: number; w: number; n?: number; vert?: boolean; h?: number; off?: number[] }
export interface Voice { g: Grammar; y0: number; y1: number; lag: number; k: number; order: number; seed: number; divisi: boolean; takes: boolean; events: Ev[] }
export interface System { seed: number; t0: number; ya0: number; ya1: number; voices: Voice[]; before: number[][]; after: number[][] }
export interface UserStroke { pts: [number, number][]; g?: number; mean?: number }
export interface State {
  r: number;          // re-harmonisation, 0..1
  agentTo: number;    // the new voice is drawn from t0 up to this time
  users?: UserStroke[];
}

// ---------------------------------------------------------------- utilities
export function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
export const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- the figure
// A rise, a held note, three quick points, a slow glissando.
const MOTIF: [number, number][] = [[0, 0], [0.012, -1], [0.026, -1], [0.034, -0.3], [0.043, 0.25], [0.053, -0.4], [0.082, 0.8], [0.108, 0.25], [0.13, 0]];
export const MOTIF_LEN = 0.13;
export const MOTIF_POINTS = [0.012, 0.034, 0.043, 0.053];
export const PERIOD = 0.17;
export function motif(u: number) {
  if (u <= 0 || u >= MOTIF_LEN) return 0;
  for (let i = 1; i < MOTIF.length; i++) {
    const [ta, ya] = MOTIF[i - 1], [tb, yb] = MOTIF[i];
    if (u <= tb) { const f = (u - ta) / (tb - ta); return mix(ya, yb, (1 - Math.cos(Math.PI * f)) / 2); }
  }
  return 0;
}

// ---------------------------------------------------------------- generation
const GRAMMARS: Grammar[] = ['fan', 'line', 'points', 'boxes', 'bars', 'bands'];

function events(g: Grammar, R: () => number, density = 1): Ev[] {
  const out: Ev[] = [];
  const dd = 1 / density;
  if (g === 'line') {
    for (let t = 0; t < 1; t += (0.05 + R() * 0.07) * dd) out.push({ t, d: 0, v: 0, w: R() < 0.3 ? 2.2 + R() * 1.6 : 0.5 + R() * 0.7 });
  } else if (g === 'points') {
    for (let t = 0.01; t < 1; t += (0.01 + R() * 0.032) * dd) { if (R() < 0.18) t += 0.03 * dd; out.push({ t, d: 0, v: R() * 2 - 1, w: 0.4 + R() * 0.9, vert: R() < 0.55 }); }
  } else if (g === 'boxes') {
    for (let s = 0; s < 40; s++) if (R() < 0.58 * Math.min(1.3, density)) out.push({ t: s * 0.025, d: 0.025 * (R() < 0.25 && s < 39 ? 2 : 1), v: Math.floor(R() * 3) - 1, w: 1, n: 1 + Math.floor(R() * 5) });
  } else if (g === 'bars') {
    for (let t = 0.005; t < 1; t += (0.022 + R() * 0.06) * dd) {
      if (R() < 0.2) out.push({ t, d: 0, v: R() * 2 - 1, w: 1 + R() * 1.2, vert: true, h: 0.02 + R() * 0.04 });
      else out.push({ t, d: Math.min(1 - t, 0.008 + R() * 0.06), v: R() * 2 - 1, w: R() < 0.3 ? 3.5 + R() * 2.5 : 0.8 + R() * 1.6 });
    }
  } else if (g === 'fan') {
    const n = 6;
    for (let t = 0; t <= 1.0001; t += (0.05 + R() * 0.06) * dd) {
      const spread = R() < 0.35 ? 0 : 0.25 + R() * 0.75;
      out.push({ t: Math.min(t, 1), d: 0, v: 0, w: 1, off: Array.from({ length: n }, (_, j) => (j - (n - 1) / 2) / ((n - 1) / 2) * spread * (0.6 + R() * 0.5)) });
    }
    if (out[out.length - 1].t < 1) out.push({ ...out[out.length - 1], t: 1 });
  } else if (g === 'bands') {
    for (let t = 0.01; t < 1; t += (0.035 + R() * 0.07) * dd) out.push({ t, d: Math.min(1 - t, 0.02 + R() * 0.08), v: R() * 2 - 1, w: 1, h: 0.012 + R() * 0.035 });
  }
  return out;
}

/** The main score: six voices, one grammar each, unevenly spaced; the new voice enters in the narrow gap. */
export function mainSystem(): System {
  const y0 = [0.05, 0.21, 0.37, 0.52, 0.72, 0.92];
  const y1 = [0.03, 0.17, 0.31, 0.61, 0.77, 0.93];
  const lags = [0.2, 0.1, 0.035, 0.05, 0.13, 0.235];
  const order = [4, 2, 0, 1, 3, 5];
  const voices: Voice[] = GRAMMARS.map((g, i) => {
    const R = rng(9001 + i * 131);
    return { g, y0: y0[i], y1: y1[i], lag: lags[i], k: i % 2 ? -1 : 1, order: order[i], seed: i * 0.37, divisi: g === 'line', takes: true, events: events(g, R) };
  });
  // groups (brackets) before and after the entry; -1 is the new voice
  return { seed: 1, t0: 0.34, ya0: 0.445, ya1: 0.46, voices, before: [[0, 1], [2, 3], [4, 5]], after: [[0, 1, 2], [-1, 3], [4, 5]] };
}

/** Another organisation: its own voices, its own moment of entry, its own takers. */
export function otherSystem(seed: number, nVoices?: number, only?: Grammar): System {
  const R = rng(seed * 7919 + 17);
  const n = nVoices ?? 4 + Math.floor(R() * 3);
  const pool = [...GRAMMARS].sort(() => R() - 0.5);
  const density = 0.65 + R() * 0.8;
  const gaps = Array.from({ length: n + 1 }, () => 0.6 + R());
  const sum = gaps.reduce((a, b) => a + b, 0);
  let acc = 0;
  const y0 = n === 1 ? [0.5] : gaps.slice(0, n).map((g) => { acc += g; return (acc / sum) * 0.98; });
  const gapAt = n > 1 ? 1 + Math.floor(R() * (n - 1)) : 0;
  const ya0 = n > 1 ? (y0[gapAt - 1] + y0[gapAt]) / 2 : 0.5;
  const y1 = y0.map((y, i) => (i < gapAt ? y * 0.86 : 1 - (1 - y) * 0.86));
  const takeP = 0.45 + R() * 0.5;
  const voices: Voice[] = y0.map((y, i) => {
    const g = only ?? pool[i % pool.length];
    const d = Math.abs(i - gapAt + 0.5);
    return { g, y0: y, y1: y1[i], lag: 0.03 + d * (0.04 + R() * 0.05), k: R() < 0.5 ? -1 : 1, order: Math.round(d), seed: R() * 3, divisi: g === 'line' && R() < 0.6, takes: d < 1 || R() < takeP, events: events(g, rng(seed * 31 + i * 7), density) };
  });
  const groups: number[][] = [];
  for (let i = 0; i < n; i += 2) groups.push(i + 1 < n ? [i, i + 1] : [i]);
  return { seed, t0: 0.2 + R() * 0.42, ya0, ya1: ya0, voices, before: groups, after: groups };
}

// ---------------------------------------------------------------- dynamics of the score
const AMP_AGENT = 0.05;
const AMP_IMIT = 0.036;

export const post = (sys: System, st: State, t: number) => smooth(sys.t0 - 0.015, sys.t0 + 0.075, t) * st.r;
export const imitation = (v: Voice, st: State) => (v.takes ? clamp((st.r - v.order * 0.11) / 0.24) : 0);

export function agentY(sys: System, st: State, t: number) {
  const u = t - sys.t0;
  if (u < 0) return sys.ya0;
  const k = Math.floor(u / PERIOD);
  const sign = k % 2 ? -1 : 1;
  return mix(sys.ya0, sys.ya1, post(sys, st, t)) + AMP_AGENT * sign * (1 - 0.12 * k) * motif(u - k * PERIOD);
}

/** Resting centre of a voice (register + slow drift), without any restatement of the figure. */
export function baseY(sys: System, v: Voice, st: State, t: number) {
  const q = post(sys, st, t);
  return mix(v.y0, v.y1, q) + 0.011 * Math.sin(6.283 * (t * 1.3 + v.seed)) + 0.006 * Math.sin(6.283 * (t * 3.7 + v.seed * 2.1));
}
/** The figure as this voice restates it (signed, in register units), 0 outside the window. */
export function contour(sys: System, v: Voice, st: State, t: number) {
  const im = imitation(v, st);
  if (im <= 0) return 0;
  return im * v.k * AMP_IMIT * motif(t - (sys.t0 + v.lag));
}
export const voiceY = (sys: System, v: Voice, st: State, t: number) => baseY(sys, v, st, t) + contour(sys, v, st, t);

/** Events drift onto a shared pulse after the entry: the ensemble starts playing together. */
export function snapT(sys: System, st: State, t: number) {
  if (t <= sys.t0) return t;
  const q = post(sys, st, t);
  const g = sys.t0 + Math.round((t - sys.t0) / 0.025) * 0.025;
  return mix(t, g, q * 0.92);
}

// ---------------------------------------------------------------- the visitor's voice: a smooth, order-preserving deformation
export function strokeY(p: [number, number][], t: number) {
  const n = p.length;
  if (t <= p[0][0]) return p[0][1];
  if (t >= p[n - 1][0]) return p[n - 1][1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m][0] < t) lo = m; else hi = m; }
  const f = (t - p[lo][0]) / Math.max(1e-6, p[hi][0] - p[lo][0]);
  return mix(p[lo][1], p[hi][1], f);
}
/**
 * Space bends around a drawn line: a lens pushes nearby material away and the ensemble
 * leans toward the line's contour. The map is monotone in y, so voices never cross.
 */
export function warp(st: State, t: number, y: number) {
  const us = st.users;
  if (!us || !us.length) return y;
  let d = 0;
  for (const s of us) {
    const p = s.pts; if (p.length < 2) continue;
    const ta = p[0][0], tb = p[p.length - 1][0];
    // local in time: strongest where the line enters, fading along the timeline
    const W = smooth(ta - 0.05, ta + 0.01, t) * (1 - smooth(tb - 0.01, tb + 0.05, t)) * Math.exp(-Math.max(0, t - ta) / 0.3);
    if (W <= 0.001) continue;
    const ys = strokeY(p, t);
    const m = s.mean ?? 0.5;
    const u = (y - ys) / 0.07;
    // where the drawn line is steep it passes through; where it is level it pushes
    const slope = Math.abs(strokeY(p, t + 0.004) - strokeY(p, t - 0.004)) / 0.008;
    const lens = (0.9 / (1 + slope * 0.35)) * (y - ys) * Math.exp(-u * u);
    const lean = 0.12 * (ys - m) * Math.exp(-(((y - m) / 0.3) ** 2));
    d += W * Math.min(1.08, s.g ?? 1) * (lens + lean);
  }
  // never more than about half a lane
  return y + 0.075 * Math.tanh(d / 0.075);
}

// ---------------------------------------------------------------- geometry
export type Prim =
  | { k: 'path'; pts: [number, number][]; w: number; role?: 'agent' | 'string'; vi?: number; rs?: boolean }
  | { k: 'ribbon'; pts: [number, number, number][]; role?: 'user' }  // t, y, width (px units)
  | { k: 'rect'; t: number; y: number; w: number; h: number; fill: boolean; n?: number; lw?: number; vi?: number; rs?: boolean; hlFill?: boolean }
  | { k: 'dot'; t: number; y: number; r: number; stem?: number; vi?: number; rs?: boolean }
  | { k: 'hl'; pts: [number, number][]; w: number; a: number }
  | { k: 'hairpin'; t: number; y: number; len: number; open: number }
  | { k: 'niente'; t: number; y: number };

const STEP = 0.004;
function sample(f: (t: number) => number, a: number, b: number, step = STEP) {
  const pts: [number, number][] = [];
  if (b <= a) return pts;
  for (let t = a; t < b; t += step) pts.push([t, f(t)]);
  pts.push([b, f(b)]);
  return pts;
}
const bell = (a: number, b: number, t: number, e = 0.012) => smooth(a - e, a + e, t) * (1 - smooth(b - e, b + e, t));

/** Everything drawn for one system in one state. Widths are in "score px" (scaled by the renderer). */
export function geometry(sys: System, st: State, opts: { detail?: number; skipUsers?: boolean } = {}): Prim[] {
  const out: Prim[] = [];
  const step = STEP / (opts.detail ?? 1);

  // the new voice's part is marked with the highlighter
  if (st.agentTo > sys.t0) out.push({ k: 'hl', pts: sample((t) => agentY(sys, st, t), sys.t0, st.agentTo, step), w: 18, a: 1 });

  for (let vi = 0; vi < sys.voices.length; vi++) {
    const v = sys.voices[vi];
    const B = (t: number) => baseY(sys, v, st, t);
    const C = (t: number) => contour(sys, v, st, t);
    const im = imitation(v, st);
    const wa = sys.t0 + v.lag, wb = wa + MOTIF_LEN;
    const shown = wa + MOTIF_LEN * im;              // the restatement is written in as im grows
    const inside = (t: number, d = 0) => im > 0 && t + d > wa - 0.006 && t < Math.min(wb, shown) + 0.004;
    const U = (t: number) => motif(t - wa) * v.k;   // signed figure, -1..1
    // thin highlighter underlay for the continuous voices (the discrete ones get theirs from their own marks, below)
    const under: [number, number][] | null = im > 0 && (v.g === 'line' || v.g === 'fan') ? sample((t) => B(t) + C(t), wa, Math.min(1, shown), step) : null;

    if (v.g === 'line') {
      // Cardew: the line leans into the figure and thickens where it moves
      const ev = v.events;
      const width = (t: number) => {
        let w = 0.45;
        for (const e of ev) w += e.w * Math.exp(-(((t - e.t) / 0.018) ** 2));
        w = Math.min(w, 3.2);
        if (im > 0 && t >= wa && t <= shown) w += im * (0.6 + 3.2 * Math.abs(motif(t - wa)));
        return w;
      };
      const split = (t: number) => v.divisi ? st.r * smooth(wb, wb + 0.06, t) : 0;
      const pts: [number, number, number][] = [];
      const pts2: [number, number, number][] = [];
      for (let t = 0; t <= 1.0001; t += step) {
        const tt = Math.min(1, t);
        const s = split(tt), y = B(tt) + C(tt), w = width(tt);
        pts.push([tt, y - s * 0.022, w * (1 - s * 0.4)]);
        if (s > 0.001) pts2.push([tt, y + s * 0.022, w * (1 - s * 0.4)]);
      }
      out.push({ k: 'ribbon', pts });
      if (pts2.length > 1) out.push({ k: 'ribbon', pts: pts2 });
    } else if (v.g === 'points') {
      for (const e of v.events) { const t = snapT(sys, st, e.t); if (inside(t)) continue; out.push({ vi, k: 'dot', t, y: B(t) + e.v * 0.028, r: 1.1 + e.w * 1.8, stem: e.vert ? (e.v > 0 ? -1 : 1) * 0.034 : 0 }); }
      // pointillist restatement: the figure as a run of points, stems follow the motion
      if (im > 0) for (let t = wa + 0.004; t < Math.min(wb, shown); t += 0.0072) {
        const y = B(t) + C(t), dy = C(t + 0.004) - C(t - 0.004);
        out.push({ vi, rs: true, k: 'dot', t, y, r: 1.3 + 1.6 * Math.abs(U(t)), stem: Math.abs(dy) > 0.0015 ? -Math.sign(dy) * 0.026 : 0 });
      }
    } else if (v.g === 'boxes') {
      for (const e of v.events) { const t = snapT(sys, st, e.t); if (inside(t, e.d)) continue; out.push({ vi, k: 'rect', t, y: B(t + e.d / 2) + e.v * 0.03 - 0.013, w: e.d, h: 0.026, fill: false, n: e.n }); }
      // Feldman: the figure as boxes stepping between high, middle and low register
      if (im > 0) for (let t = wa; t < Math.min(wb, shown) - 0.004; t += 0.0205) {
        const f = U(t + 0.01), reg = Math.max(-1, Math.min(1, Math.round(-f * 1.6)));
        out.push({ vi, rs: true, k: 'rect', t, y: B(t + 0.01) + reg * 0.032 - 0.013, w: 0.019, h: 0.026, fill: false, n: 1 + Math.round(Math.abs(f) * 4), lw: 1.5 });
      }
    } else if (v.g === 'bars') {
      for (const e of v.events) {
        const t = snapT(sys, st, e.t), y = B(t) + e.v * 0.03;
        if (inside(t, e.d)) continue;
        if (e.vert) out.push({ vi, k: 'path', pts: [[t, y - (e.h ?? 0.03) / 2], [t, y + (e.h ?? 0.03) / 2]], w: e.w });
        else out.push({ vi, k: 'path', pts: [[t, y], [t + e.d, y]], w: e.w });
      }
      // Brown: the figure as a staircase of bars, weight follows the size of the move
      if (im > 0) for (let t = wa; t < Math.min(wb, shown) - 0.004; t += 0.0145) {
        const c = C(t + 0.006), lv = Math.round(c / 0.009) * 0.009;
        out.push({ vi, rs: true, k: 'path', pts: [[t, B(t) + lv], [t + 0.0115, B(t) + lv]], w: 1.2 + 3.6 * Math.abs(U(t + 0.006)) });
      }
    } else if (v.g === 'fan') {
      // Xenakis: strings are ruled between control times; inside the figure they pinch into a bundle and trace it
      const ev = v.events, n = ev[0].off!.length;
      const offAt = (j: number, t: number) => {
        let i = 1; while (i < ev.length - 1 && ev[i].t < t) i++;
        const a = ev[i - 1], b = ev[i];
        const f = clamp((t - a.t) / Math.max(1e-6, b.t - a.t));
        return mix(a.off![j], b.off![j], f);
      };
      const pinch = (t: number) => im * 0.86 * bell(wa, Math.min(wb, shown), t);
      for (let j = 0; j < n; j++) {
        const pts = sample((t) => B(t) + C(t) + offAt(j, t) * 0.034 * (1 - pinch(t)), 0, 1, step * 1.5);
        out.push({ k: 'path', pts, w: 0.45 + 0.3 * ((j * 7) % 3), role: 'string' });
      }
    } else if (v.g === 'bands') {
      for (const e of v.events) { const t = snapT(sys, st, e.t); if (inside(t, e.d)) continue; out.push({ vi, k: 'rect', t, y: B(t) + e.v * 0.022 - (e.h ?? 0.02) / 2, w: e.d, h: e.h ?? 0.02, fill: true }); }
      // Stockhausen: the figure as bands stepping in pitch; their fill is the highlight
      if (im > 0) for (let t = wa; t < Math.min(wb, shown) - 0.008; t += 0.0215) {
        const c = C(t + 0.011), y = B(t + 0.011) + Math.round(c / 0.012) * 0.012, h = 0.016 + 0.014 * Math.abs(U(t + 0.011));
        out.push({ vi, rs: true, k: 'rect', t, y: y - h / 2, w: 0.024, h, fill: true, hlFill: true });
      }
    }
    if (under && under.length > 1) out.push({ k: 'hl', pts: under, w: 5, a: 0.8 });
  }

  // (underlays are pushed per voice inside the loop)
  // the new voice: enters from nothing (niente + hairpin), then its line and points
  if (st.agentTo > sys.t0) {
    const y0 = agentY(sys, st, sys.t0);
    out.push({ k: 'niente', t: sys.t0 - 0.056, y: y0 });
    out.push({ k: 'hairpin', t: sys.t0 - 0.05, y: y0, len: 0.042, open: 0.016 });
    out.push({ k: 'path', pts: sample((t) => agentY(sys, st, t), sys.t0, st.agentTo, step), w: 1.9, role: 'agent' });
    for (let k = 0; k * PERIOD + sys.t0 < st.agentTo; k++) for (const m of MOTIF_POINTS) {
      const t = sys.t0 + k * PERIOD + m;
      if (t < st.agentTo) out.push({ vi: -1, k: 'dot', t, y: agentY(sys, st, t), r: 2.5 });
    }
  }

  // bend everything around any drawn line
  if (st.users?.length) for (const p of out) {
    if ('rs' in p && p.k === 'rect' && p.hlFill) { const y2 = warp(st, p.t + p.w / 2, p.y + p.h / 2); p.y = y2 - p.h / 2; continue; }
    if (p.k === 'path' && p.vi !== undefined) { const tm = (p.pts[0][0] + p.pts[p.pts.length - 1][0]) / 2, ym = (p.pts[0][1] + p.pts[p.pts.length - 1][1]) / 2, dy = warp(st, tm, ym) - ym; p.pts = p.pts.map(([t, y]) => [t, y + dy]); }
    else if (p.k === 'path' || p.k === 'hl') p.pts = p.pts.map(([t, y]) => [t, warp(st, t, y)]);
    else if (p.k === 'ribbon') p.pts = p.pts.map(([t, y, w]) => [t, warp(st, t, y), w]);
    else if (p.k === 'rect') { const y2 = warp(st, p.t + p.w / 2, p.y + p.h / 2); p.y = y2 - p.h / 2; }
    else if (p.k === 'dot' || p.k === 'niente' || p.k === 'hairpin') p.y = warp(st, p.t, p.y);
  }

  // underlays for the discrete voices, derived from their own (possibly bent) marks so they never detach
  const byVoice = new Map<number, Prim[]>();
  for (const p of out) if ((p.k === 'rect' || p.k === 'dot' || p.k === 'path') && p.rs && p.vi !== undefined && !(p.k === 'rect' && p.hlFill)) {
    if (!byVoice.has(p.vi)) byVoice.set(p.vi, []);
    byVoice.get(p.vi)!.push(p);
  }
  for (const list of byVoice.values()) {
    const pts: [number, number][] = [];
    const tOf = (p: Prim) => (p.k === 'path' ? p.pts[0][0] : (p as { t: number }).t);
    list.sort((a, b) => tOf(a) - tOf(b));
    for (const p of list) {
      if (p.k === 'rect') { const cy = p.y + p.h / 2; pts.push([p.t, cy], [p.t + p.w + 0.0015, cy]); }
      else if (p.k === 'path') pts.push([p.pts[0][0], p.pts[0][1]], [p.pts[p.pts.length - 1][0] + 0.003, p.pts[p.pts.length - 1][1]]);
      else if (p.k === 'dot') pts.push([p.t, p.y]);
    }
    if (pts.length > 1) out.unshift({ k: 'hl', pts, w: 5, a: 0.8 });
  }

  // the visitor's own line: ink only, weight follows the pen (steep = thin)
  if (!opts.skipUsers) out.push(...userPrims(st));
  return out;
}

export function userPrims(st: State): Prim[] {
  const out: Prim[] = [];
  for (const s of st.users ?? []) {
    const p = s.pts; if (p.length < 2) continue;
    const rib: [number, number, number][] = p.map(([t, y], i) => {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
      const slope = Math.abs((b[1] - a[1]) / Math.max(1e-4, b[0] - a[0]));
      const taper = Math.min(1, i / 6, (p.length - 1 - i) / 10);
      return [t, y, (1.5 + 2.1 / (1 + slope * 0.14)) * (0.45 + 0.55 * taper)];
    });
    out.push({ k: 'niente', t: p[0][0] - 0.01, y: p[0][1] });
    out.push({ k: 'ribbon', pts: rib, role: 'user' });
  }
  return out;
}

/** Bracket groups for the current state: before the entry, and re-formed around the new voice after it. */
export function groupSpans(sys: System, st: State, t: number): { a: number; b: number }[] {
  const yOf = (i: number) => (i < 0 ? agentY(sys, st, Math.max(t, sys.t0)) : baseY(sys, sys.voices[i], st, t));
  const span = (g: number[]) => { const ys = g.map(yOf); return { a: Math.min(...ys), b: Math.max(...ys) }; };
  const q = smooth(0.35, 0.9, st.r);
  const n = Math.max(sys.before.length, sys.after.length);
  const res: { a: number; b: number }[] = [];
  for (let i = 0; i < n; i++) {
    const A = span(sys.before[Math.min(i, sys.before.length - 1)]), Bb = span(sys.after[Math.min(i, sys.after.length - 1)]);
    res.push({ a: mix(A.a, Bb.a, q), b: mix(A.b, Bb.b, q) });
  }
  return res;
}
