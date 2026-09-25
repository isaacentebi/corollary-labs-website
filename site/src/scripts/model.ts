// The score model. Pure functions, shared by the canvas hero (client) and the
// build-time SVG miniatures (server). Coordinates are normalised: t in [0,1] is
// time (left to right), y in [0,1] is register within one system (0 = top).

export type Grammar = 'fan' | 'line' | 'points' | 'boxes' | 'bars' | 'bands';

export interface Ev { t: number; d: number; v: number; w: number; n?: number; vert?: boolean; h?: number; off?: number[] }
export interface Voice { g: Grammar; y0: number; y1: number; lag: number; k: number; order: number; seed: number; divisi: boolean; events: Ev[] }
export interface System { seed: number; t0: number; ya0: number; ya1: number; voices: Voice[] }
export interface UserStroke { pts: [number, number][]; g?: number }
export interface State {
  r: number;          // re-harmonisation, 0..1
  agentTo: number;    // agent voice is drawn from t0 up to this time
  users?: UserStroke[];
  ug?: number;        // user-field gain (spring), 0..~1.1
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

// ---------------------------------------------------------------- the motif
// A short figure: a rise, a held note, three quick points, a slow glissando.
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

function events(g: Grammar, R: () => number): Ev[] {
  const out: Ev[] = [];
  if (g === 'line') {
    for (let t = 0; t < 1; t += 0.05 + R() * 0.07) out.push({ t, d: 0, v: 0, w: R() < 0.3 ? 2.6 + R() * 2 : 0.7 + R() * 0.8 });
  } else if (g === 'points') {
    for (let t = 0.01; t < 1; t += 0.008 + R() * 0.03) { if (R() < 0.18) t += 0.03; out.push({ t, d: 0, v: R() * 2 - 1, w: 0.5 + R() * 0.8, vert: R() < 0.5 }); }
  } else if (g === 'boxes') {
    for (let s = 0; s < 40; s++) if (R() < 0.62) out.push({ t: s * 0.025, d: 0.025 * (R() < 0.25 && s < 39 ? 2 : 1), v: Math.floor(R() * 3) - 1, w: 1, n: 1 + Math.floor(R() * 5) });
  } else if (g === 'bars') {
    for (let t = 0.005; t < 1; t += 0.02 + R() * 0.06) {
      if (R() < 0.22) out.push({ t, d: 0, v: R() * 2 - 1, w: 1 + R() * 1.5, vert: true, h: 0.02 + R() * 0.04 });
      else out.push({ t, d: Math.min(1 - t, 0.008 + R() * 0.06), v: R() * 2 - 1, w: 0.8 + R() * 5 });
    }
  } else if (g === 'fan') {
    const n = 6;
    for (let t = 0; t <= 1.0001; t += 0.05 + R() * 0.05) {
      const spread = R() < 0.35 ? 0 : 0.2 + R() * 0.8;
      out.push({ t: Math.min(t, 1), d: 0, v: R() * 2 - 1, w: 1, off: Array.from({ length: n }, (_, j) => (j - (n - 1) / 2) / ((n - 1) / 2) * spread * (0.6 + R() * 0.5)) });
    }
    if (out[out.length - 1].t < 1) out.push({ ...out[out.length - 1], t: 1 });
  } else if (g === 'bands') {
    for (let t = 0.01; t < 1; t += 0.03 + R() * 0.07) out.push({ t, d: Math.min(1 - t, 0.02 + R() * 0.08), v: R() * 2 - 1, w: 1, h: 0.012 + R() * 0.04 });
  }
  return out;
}

/** The main score: six voices, one grammar each, unevenly spaced; the new voice enters in the narrow gap. */
export function mainSystem(): System {
  const y0 = [0.05, 0.21, 0.37, 0.52, 0.72, 0.92];
  const y1 = [0.03, 0.17, 0.31, 0.61, 0.77, 0.93];
  const lags = [0.2, 0.1, 0.035, 0.05, 0.13, 0.24];
  const order = [4, 2, 0, 1, 3, 5];
  const voices: Voice[] = GRAMMARS.map((g, i) => {
    const R = rng(9001 + i * 131);
    return { g, y0: y0[i], y1: y1[i], lag: lags[i], k: i % 2 ? -1 : 1, order: order[i], seed: i * 0.37, divisi: g === 'line', events: events(g, R) };
  });
  return { seed: 1, t0: 0.34, ya0: 0.445, ya1: 0.46, voices };
}

/** Another organisation: its own voices and its own moment of entry. */
export function otherSystem(seed: number, nVoices?: number): System {
  const R = rng(seed * 7919 + 17);
  const n = nVoices ?? 4 + Math.floor(R() * 3);
  const pool = [...GRAMMARS].sort(() => R() - 0.5);
  const gaps = Array.from({ length: n + 1 }, () => 0.6 + R());
  const sum = gaps.reduce((a, b) => a + b, 0);
  let acc = 0;
  const y0 = gaps.slice(0, n).map((g) => { acc += g; return 0.02 + (acc / sum) * 0.96 - 0.02; });
  const gapAt = Math.floor(n / 2);
  const ya0 = (y0[gapAt - 1] + y0[gapAt]) / 2;
  const y1 = y0.map((y, i) => (i < gapAt ? mix(y, y * 0.85, 1) : mix(y, 1 - (1 - y) * 0.85, 1)));
  const voices: Voice[] = y0.map((y, i) => {
    const g = pool[i % pool.length];
    const d = Math.abs(i - gapAt + 0.5);
    return { g, y0: y, y1: y1[i], lag: 0.03 + d * 0.06 + R() * 0.03, k: R() < 0.5 ? -1 : 1, order: Math.round(d), seed: R() * 3, divisi: g === 'line' && R() < 0.6, events: events(g, rng(seed * 31 + i * 7)) };
  });
  return { seed, t0: 0.25 + R() * 0.3, ya0, ya1: ya0, voices };
}

// ---------------------------------------------------------------- dynamics of the score
const AMP_AGENT = 0.05;
const AMP_IMIT = 0.034;

export const post = (sys: System, st: State, t: number) => smooth(sys.t0 - 0.015, sys.t0 + 0.075, t) * st.r;
export const imitation = (v: Voice, st: State) => clamp((st.r - v.order * 0.11) / 0.22);

export function agentY(sys: System, st: State, t: number) {
  const u = t - sys.t0;
  if (u < 0) return mix(sys.ya0, sys.ya1, st.r);
  const k = Math.floor(u / PERIOD);
  const sign = k % 2 ? -1 : 1;
  return mix(sys.ya0, sys.ya1, post(sys, st, t)) + AMP_AGENT * sign * (1 - 0.12 * k) * motif(u - k * PERIOD);
}

function userField(c: number, t: number, st: State) {
  if (!st.users?.length) return 0;
  let dy = 0;
  for (const s of st.users) {
    const p = s.pts; if (p.length < 2) continue;
    const ta = p[0][0], tb = p[p.length - 1][0];
    const W = smooth(ta - 0.05, ta, t) * (1 - smooth(tb, tb + 0.05, t));
    if (W <= 0) continue;
    const ys = strokeY(p, t);
    const m = p.reduce((a, q) => a + q[1], 0) / p.length;
    const follow = (ys - m) * 0.85 * Math.exp(-Math.abs(c - m) / 0.3);
    const dist = c - ys;
    const repel = Math.sign(dist || 1) * Math.max(0, 0.1 - Math.abs(dist)) * 1.1;
    dy += W * (follow + repel) * (s.g ?? 1);
  }
  return dy * (st.ug ?? 1);
}

export function strokeY(p: [number, number][], t: number) {
  if (t <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) if (t <= p[i][0]) { const f = (t - p[i - 1][0]) / Math.max(1e-6, p[i][0] - p[i - 1][0]); return mix(p[i - 1][1], p[i][1], f); }
  return p[p.length - 1][1];
}

/** Centre line of a voice at time t. */
export function voiceY(sys: System, v: Voice, st: State, t: number) {
  const q = post(sys, st, t);
  let y = mix(v.y0, v.y1, q);
  y += 0.011 * Math.sin(6.283 * (t * 1.3 + v.seed)) + 0.006 * Math.sin(6.283 * (t * 3.7 + v.seed * 2.1));
  y += imitation(v, st) * v.k * AMP_IMIT * motif(t - (sys.t0 + v.lag));
  return y + userField(y, t, st);
}

/** Events drift onto a shared pulse after the entry: the ensemble starts playing together. */
export function snapT(sys: System, st: State, t: number) {
  if (t <= sys.t0) return t;
  const q = post(sys, st, t);
  const g = sys.t0 + Math.round((t - sys.t0) / 0.025) * 0.025;
  return mix(t, g, q * 0.92);
}

// ---------------------------------------------------------------- geometry
export type Prim =
  | { k: 'path'; pts: [number, number][]; w: number; role?: 'agent' | 'user' }
  | { k: 'ribbon'; pts: [number, number, number][] }          // t, y, half-width (px units)
  | { k: 'rect'; t: number; y: number; w: number; h: number; fill: boolean; n?: number }
  | { k: 'dot'; t: number; y: number; r: number; stem?: number }
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

/** Everything drawn for one system in one state. Widths are in "score px" (scaled by the renderer). */
export function geometry(sys: System, st: State, opts: { detail?: number; skipUsers?: boolean } = {}): Prim[] {
  const out: Prim[] = [];
  const step = STEP / (opts.detail ?? 1);

  // highlights first: the new voice's part, and each place the motif is taken up
  if (st.agentTo > sys.t0) out.push({ k: 'hl', pts: sample((t) => agentY(sys, st, t), sys.t0, st.agentTo, step), w: 15, a: 1 });
  for (const v of sys.voices) {
    const im = imitation(v, st);
    if (im <= 0) continue;
    const a = sys.t0 + v.lag, b = a + MOTIF_LEN * im;
    out.push({ k: 'hl', pts: sample((t) => voiceY(sys, v, st, t), a, Math.min(1, b), step), w: v.g === 'fan' ? 20 : 12, a: 0.9 });
  }

  for (const v of sys.voices) {
    const Y = (t: number) => voiceY(sys, v, st, t);
    const im = imitation(v, st);
    const wa = sys.t0 + v.lag, wb = wa + MOTIF_LEN;
    const discrete = v.g !== 'line' && v.g !== 'fan';
    // inside the imitation window a discrete voice's own events give way to the figure
    const gone = (t: number, d = 0) => discrete && im > 0 && t + d > wa - 0.004 && t < wb + 0.004 && (t - wa) / MOTIF_LEN < im + 0.05;
    if (im > 0) {
      const b = Math.min(1, wa + MOTIF_LEN * im);
      if (discrete) out.push({ k: 'path', pts: sample(Y, wa, b, step), w: 1.1 });
      for (const m of MOTIF_POINTS) if (wa + m < b) out.push({ k: 'dot', t: wa + m, y: Y(wa + m), r: 2.1 });
    }
    if (v.g === 'line') {
      const ev = v.events;
      const width = (t: number) => {
        let w = 0.55;
        for (const e of ev) w += e.w * Math.exp(-(((t - e.t) / 0.018) ** 2));
        return Math.min(w, 3.6);
      };
      const split = (t: number) => v.divisi ? st.r * smooth(sys.t0 + v.lag, sys.t0 + v.lag + 0.06, t) : 0;
      const pts: [number, number, number][] = [];
      const pts2: [number, number, number][] = [];
      for (let t = 0; t <= 1.0001; t += step) {
        const s = split(t), y = Y(t), w = width(t);
        pts.push([t, y - s * 0.024, w * (1 - s * 0.45)]);
        if (s > 0.001) pts2.push([t, y + s * 0.024, w * (1 - s * 0.45)]);
      }
      out.push({ k: 'ribbon', pts });
      if (pts2.length) out.push({ k: 'ribbon', pts: pts2 });
    } else if (v.g === 'points') {
      for (const e of v.events) { const t = snapT(sys, st, e.t); if (gone(t)) continue; out.push({ k: 'dot', t, y: Y(t) + e.v * 0.028, r: 1.2 + e.w * 1.9, stem: e.vert ? (e.v > 0 ? -1 : 1) * 0.035 : 0 }); }
    } else if (v.g === 'boxes') {
      for (const e of v.events) { const t = snapT(sys, st, e.t); if (gone(t, e.d)) continue; out.push({ k: 'rect', t, y: Y(t + e.d / 2) + e.v * 0.03 - 0.013, w: e.d, h: 0.026, fill: false, n: e.n }); }
    } else if (v.g === 'bars') {
      for (const e of v.events) {
        const t = snapT(sys, st, e.t), y = Y(t) + e.v * 0.03;
        if (gone(t, e.d)) continue;
        if (e.vert) out.push({ k: 'path', pts: [[t, y - (e.h ?? 0.03) / 2], [t, y + (e.h ?? 0.03) / 2]], w: e.w });
        else out.push({ k: 'path', pts: [[t, y], [t + e.d, y]], w: e.w });
      }
    } else if (v.g === 'fan') {
      const ev = v.events, n = ev[0].off!.length;
      for (let j = 0; j < n; j++) {
        const pts: [number, number][] = [];
        for (let i = 0; i < ev.length; i++) {
          const t = snapT(sys, st, ev[i].t);
          // between control times strings are ruled straight; sample a few points so the centre can bend
          if (i > 0) {
            const tp = snapT(sys, st, ev[i - 1].t);
            for (let s = 1; s < 4; s++) { const f = s / 4, tt = mix(tp, t, f); pts.push([tt, Y(tt) + mix(ev[i - 1].off![j], ev[i].off![j], f) * 0.034]); }
          }
          pts.push([t, Y(t) + ev[i].off![j] * 0.034]);
        }
        out.push({ k: 'path', pts, w: 0.7 });
      }
    } else if (v.g === 'bands') {
      for (const e of v.events) { const t = snapT(sys, st, e.t); if (gone(t, e.d)) continue; out.push({ k: 'rect', t, y: Y(t) + e.v * 0.022 - (e.h ?? 0.02) / 2, w: e.d, h: e.h ?? 0.02, fill: true }); }
    }
  }

  // the new voice: enters from nothing, crescendo marked beneath
  if (st.agentTo > sys.t0) {
    const pts = sample((t) => agentY(sys, st, t), sys.t0, st.agentTo, step);
    out.push({ k: 'niente', t: sys.t0 - 0.056, y: agentY(sys, st, sys.t0) });
    out.push({ k: 'path', pts, w: 1.8, role: 'agent' });
    const base = mix(sys.ya0, sys.ya1, st.r);
    out.push({ k: 'hairpin', t: sys.t0 - 0.05, y: base, len: 0.042, open: 0.016 });
    for (let k = 0; k * PERIOD + sys.t0 < st.agentTo; k++) for (const m of MOTIF_POINTS) {
      const t = sys.t0 + k * PERIOD + m;
      if (t < st.agentTo) out.push({ k: 'dot', t, y: agentY(sys, st, t), r: 2.6 });
    }
  }
  if (!opts.skipUsers) for (const s of st.users ?? []) if (s.pts.length > 1) {
    out.push({ k: 'hl', pts: s.pts, w: 15, a: 1 });
    out.push({ k: 'path', pts: s.pts, w: 1.8, role: 'user' });
    out.push({ k: 'niente', t: s.pts[0][0] - 0.006, y: s.pts[0][1] });
  }
  return out;
}
