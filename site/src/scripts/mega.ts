// The megastructure model: cores (service shafts) carry beams (infrastructure); units plug into sockets
// along beams and around cores. Everything is a function of one clock t, so scroll can run it forwards
// and backwards. Units are never removed; they plug in, or unplug and re-seat elsewhere.

import { type Cam, type Item, boxItem, cylItem, close, proj } from './axon';

export const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const win = (t: number, a: number, b: number) => (b <= a ? (t >= a ? 1 : 0) : clamp((t - a) / (b - a)));

export const BEAM_W = 0.75; // half width
export const BEAM_H = 0.55;
export const CAP_L = 1.05; // half length (outward)
export const CAP_W = 0.55; // half width
export const CAP_H = 1.1;
const OUT = 2.6; // stand-off distance before plugging

type Core = { x: number; y: number; r: number; h0: number; h1: number; g0: number; g1: number };
type Beam = { core: number; a: number; len: number; z: number; g0: number; g1: number; real?: number; realDur?: number };
export type Sock = { x: number; y: number; z: number; a: number; beam: number; core: number; s: number };
type Move = { kind: 'plug' | 'move'; from: number; to: number; t0: number; t1: number; real?: boolean };
export type Cap = { agent: boolean; moves: Move[]; user?: boolean };
type AABB = [number, number, number, number, number, number];

const hit = (a: AABB, b: AABB) => a[0] < b[1] && a[1] > b[0] && a[2] < b[3] && a[3] > b[2] && a[4] < b[5] && a[5] > b[4];

function boxAABB(x: number, y: number, a: number, hu: number, hv: number, z0: number, z1: number, shrink = 0.9): AABB {
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const ex = (hu * c + hv * s) * shrink, ey = (hu * s + hv * c) * shrink;
  return [x - ex, x + ex, y - ey, y + ey, z0, z1];
}

export class Struct {
  cores: Core[] = [];
  beams: Beam[] = [];
  socks: Sock[] = [];
  caps: Cap[] = [];
  solids: AABB[] = [];
  busy = new Map<number, [number, number][]>();
  scripted = new Set<number>();
  userBusy = new Set<number>();
  alpha = 0.9;
  deferSockets = false; // build all beams first, then their sockets (so no socket sits inside a later beam)

  core(x: number, y: number, r: number, h0: number, h1 = h0, g0 = -1, g1 = -1) {
    this.cores.push({ x, y, r, h0, h1, g0, g1 });
    this.solids.push([x - r, x + r, y - r, y + r, 0, Math.max(h0, h1)]);
    return this.cores.length - 1;
  }

  coreH(i: number, t: number) {
    const c = this.cores[i];
    return c.h0 + (c.h1 - c.h0) * ease(win(t, c.g0, c.g1));
  }

  beamStart(b: Beam) {
    const c = this.cores[b.core];
    return [c.x + Math.cos(b.a) * c.r * 0.75, c.y + Math.sin(b.a) * c.r * 0.75];
  }

  beamAABB(core: number, a: number, len: number, z: number): AABB {
    const c = this.cores[core];
    const x0 = c.x + Math.cos(a) * c.r, y0 = c.y + Math.sin(a) * c.r;
    return boxAABB(x0 + (Math.cos(a) * len) / 2, y0 + (Math.sin(a) * len) / 2, a, len / 2, BEAM_W, z, z + BEAM_H, 1);
  }

  canBeam(core: number, a: number, len: number, z: number) {
    const bb = this.beamAABB(core, a, len, z);
    const pad: AABB = [bb[0] - 0.1, bb[1] + 0.1, bb[2] - 0.1, bb[3] + 0.1, bb[4] - 1.2, bb[5] + 1.2];
    return !this.solids.some((s, i) => i !== core && hit(pad, s) && !this.isOwnCore(s, core));
  }

  private isOwnCore(s: AABB, core: number) {
    const c = this.cores[core];
    return Math.abs((s[0] + s[1]) / 2 - c.x) < 1e-6 && Math.abs((s[2] + s[3]) / 2 - c.y) < 1e-6;
  }

  // cantilever or bridge from core surface, angle a, length len (from the surface) at level z
  beam(core: number, a: number, len: number, z: number, g0 = -1, g1 = -1, sockets = true) {
    const c = this.cores[core];
    this.beams.push({ core, a, len: len + c.r * 0.25, z, g0, g1 });
    const bi = this.beams.length - 1;
    this.solids.push(this.beamAABB(core, a, len, z));
    if (sockets && !this.deferSockets) this.beamSockets(bi);
    return bi;
  }

  bridge(ci: number, cj: number, z: number, g0 = -1, g1 = -1) {
    const a = this.cores[ci], b = this.cores[cj];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    return this.beam(ci, Math.atan2(b.y - a.y, b.x - a.x), d - a.r - b.r * 0.75, z, g0, g1);
  }

  beamSockets(bi: number) {
    const b = this.beams[bi];
    const [x0, y0] = this.beamStart(b);
    const ux = Math.cos(b.a), uy = Math.sin(b.a);
    const c = this.cores[b.core];
    for (let s = c.r + 0.9; s <= b.len - 0.75; s += 1.3) {
      for (const side of [1, -1]) {
        const a = b.a + (side * Math.PI) / 2;
        const off = BEAM_W + CAP_L + 0.05;
        const x = x0 + ux * s + Math.cos(a) * off, y = y0 + uy * s + Math.sin(a) * off;
        this.trySock({ x, y, z: b.z - 0.22, a, beam: bi, core: -1, s });
      }
    }
  }

  coreSockets(ci: number, zs: number[], angles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const c = this.cores[ci];
    for (const z of zs) for (const a of angles) {
      const off = c.r + CAP_L - 0.16;
      this.trySock({ x: c.x + Math.cos(a) * off, y: c.y + Math.sin(a) * off, z, a, beam: -1, core: ci, s: 0 });
    }
  }

  trySock(s: Sock) {
    const bb = boxAABB(s.x, s.y, s.a, CAP_L, CAP_W, s.z, s.z + CAP_H, 0.92);
    if (this.solids.some((o) => hit(bb, o))) return -1;
    this.solids.push(bb);
    this.socks.push(s);
    return this.socks.length - 1;
  }

  // time at which a socket exists (its beam has grown past it / its core is tall enough)
  sockReady(i: number) {
    const s = this.socks[i];
    if (s.beam >= 0) {
      const b = this.beams[s.beam];
      if (b.g0 < 0) return -1;
      return b.g0 + (b.g1 - b.g0) * clamp((s.s + 1) / b.len);
    }
    const c = this.cores[s.core];
    if (c.g0 < 0 || c.h0 >= s.z + CAP_H + 0.3) return -1;
    const need = clamp((s.z + CAP_H + 0.3 - c.h0) / (c.h1 - c.h0));
    return c.g0 + (c.g1 - c.g0) * need;
  }

  isFree(i: number, a: number, b: number) {
    return !(this.busy.get(i) || []).some(([p, q]) => a < q && b > p);
  }

  reserve(i: number, a: number, b: number) {
    if (!this.busy.has(i)) this.busy.set(i, []);
    this.busy.get(i)!.push([a, b]);
    this.scripted.add(i);
  }

  freeAt(t: number, pick: (i: number) => boolean = () => true) {
    const out: number[] = [];
    this.socks.forEach((_, i) => {
      if (this.sockReady(i) <= t && this.isFree(i, t, 99) && pick(i)) out.push(i);
    });
    return out;
  }

  place(i: number, agent = false) {
    this.reserve(i, -9, 99);
    this.caps.push({ agent, moves: [{ kind: 'plug', from: i, to: i, t0: -9, t1: -9 }] });
  }

  plug(i: number, t0: number, dur: number, agent = true) {
    this.reserve(i, t0, 99);
    this.caps.push({ agent, moves: [{ kind: 'plug', from: i, to: i, t0, t1: t0 + dur }] });
  }

  // an existing unit unplugs and re-seats at socket j
  reseat(cap: Cap, j: number, t0: number, dur: number) {
    const last = cap.moves[cap.moves.length - 1];
    const i = last.to;
    const iv = this.busy.get(i)!.find((v) => v[1] === 99)!;
    iv[1] = t0 + dur * 0.2;
    this.reserve(j, t0 + dur * 0.75, 99);
    cap.moves.push({ kind: 'move', from: i, to: j, t0, t1: t0 + dur });
  }

  // world pose of a unit at clock t (and real time for user units)
  pose(cap: Cap, t: number, now: number): { x: number; y: number; z: number; a: number; k: number } | null {
    let m = cap.moves[0];
    for (const mv of cap.moves) if ((mv.real ? now : t) >= mv.t0) m = mv;
    const clock = m.real ? now : t;
    const u = m.t1 > m.t0 ? clamp((clock - m.t0) / (m.t1 - m.t0)) : 1;
    const S = this.socks[m.to];
    if (m.kind === 'plug') {
      if (clock < m.t0) return null;
      const ox = Math.cos(S.a) * OUT, oy = Math.sin(S.a) * OUT;
      if (u < 0.6) {
        const e = ease(u / 0.6);
        return { x: S.x + ox, y: S.y + oy, z: S.z + 7 * (1 - e), a: S.a, k: clamp(u / 0.18) };
      }
      // slide in, overshoot a little into the socket, settle (the latch)
      const x = (u - 0.6) / 0.4;
      const c1 = 1.6, c3 = c1 + 1;
      const e = 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
      return { x: S.x + ox * (1 - e), y: S.y + oy * (1 - e), z: S.z, a: S.a, k: 1 };
    }
    const F = this.socks[m.from];
    const A = { x: F.x, y: F.y, z: F.z };
    const A1 = { x: F.x + Math.cos(F.a) * OUT, y: F.y + Math.sin(F.a) * OUT, z: F.z };
    const A2 = { ...A1, z: Math.max(F.z, S.z) + 2.2 };
    const B1 = { x: S.x + Math.cos(S.a) * OUT, y: S.y + Math.sin(S.a) * OUT, z: S.z };
    const B2 = { ...B1, z: A2.z };
    const keys = [A, A1, A2, B2, B1, S];
    const w = [0.14, 0.12, 0.34, 0.12, 0.28];
    let acc = 0, seg = 0;
    while (seg < w.length - 1 && u > acc + w[seg]) acc += w[seg++];
    const e = ease(clamp((u - acc) / w[seg]));
    const P = keys[seg], Q = keys[seg + 1];
    let da = S.a - F.a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const ta = clamp((u - 0.26) / 0.34);
    return { x: P.x + (Q.x - P.x) * e, y: P.y + (Q.y - P.y) * e, z: P.z + (Q.z - P.z) * e, a: F.a + da * ease(ta), k: 1 };
  }

  beamGrow(b: Beam, t: number, now: number) {
    if (b.real !== undefined) return ease(clamp((now - b.real) / (b.realDur || 900)));
    return b.g0 < 0 ? 1 : ease(win(t, b.g0, b.g1));
  }

  items(cam: Cam, t: number, now: number, out: Item[], opts: { lod?: boolean; fade?: number; cull?: [number, number]; glow?: (ci: number) => number; ghosts?: number[]; ghostA?: number; hover?: number } = {}) {
    const lod = !!opts.lod;
    const la = this.alpha * (opts.fade ?? 1);
    const W = opts.cull;
    const onScreen = (x: number, y: number, z: number) => {
      if (!W) return true;
      const [sx, sy] = proj(cam, x, y, z);
      const m = 60;
      return sx > -m && sx < W[0] + m && sy > -m - cam.s * 16 && sy < W[1] + m;
    };
    // cores
    this.cores.forEach((c, i) => {
      const h = this.coreH(i, t);
      if (h < 0.05) return;
      if (!onScreen(c.x, c.y, h / 2)) return;
      if (lod) {
        out.push(cylItem(cam, c.x, c.y, 0, h, c.r, true, la));
        return;
      }
      const step = 1.25;
      for (let z = 0; z < h - 1e-3; z += step) {
        const z1 = Math.min(h, z + step);
        out.push(cylItem(cam, c.x, c.y, z, z1, c.r, z1 >= h - 1e-3, la, z === 0));
      }
    });
    // beams (segmented for painter order)
    for (const b of this.beams) {
      const g = this.beamGrow(b, t, now);
      if (g <= 0.001) continue;
      if (this.coreH(b.core, t) < b.z + BEAM_H + 0.3) continue;
      const [x0, y0] = this.beamStart(b);
      const L = b.len * g;
      const ux = Math.cos(b.a), uy = Math.sin(b.a);
      if (!onScreen(x0 + (ux * L) / 2, y0 + (uy * L) / 2, b.z)) continue;
      const segL = lod ? L : 1.3;
      for (let s = 0; s < L - 1e-3; s += segL) {
        const s1 = Math.min(L, s + segL);
        const m = (s + s1) / 2;
        out.push(boxItem(cam, x0 + ux * m, y0 + uy * m, b.z, b.z + BEAM_H, b.a, (s1 - s) / 2 + 0.002, BEAM_W, { alpha: la * 0.95, rails: !lod, open: [s > 0, s1 < L - 1e-3] }));
      }
    }
    // open sockets, drawn as faint dashed ghosts (the hovered one in lamp)
    if (opts.ghosts) for (const i of opts.ghosts) {
      const s = this.socks[i];
      const hov = i === opts.hover;
      out.push(boxItem(cam, s.x, s.y, s.z, s.z + CAP_H, s.a, CAP_L, CAP_W, { ghost: true, ghostA: hov ? 0 : opts.ghostA ?? 0.3, window: true }));
    }
    // units
    for (let ci = 0; ci < this.caps.length; ci++) {
      const cap = this.caps[ci];
      const p = this.pose(cap, t, now);
      if (!p) continue;
      const S = this.socks[cap.moves[cap.moves.length - 1].to];
      if (S.beam >= 0 && this.beamGrow(this.beams[S.beam], t, now) <= 0 && cap.moves.length === 1) continue;
      if (!onScreen(p.x, p.y, p.z)) continue;
      const it = boxItem(cam, p.x, p.y, p.z, p.z + CAP_H, p.a, CAP_L, CAP_W, { lamp: cap.agent, alpha: la, window: !lod, glow: opts.glow ? opts.glow(ci) : 0 });
      if (p.k < 1) {
        const d = it.draw;
        it.draw = (ctx) => {
          ctx.globalAlpha = p.k;
          d(ctx);
          ctx.globalAlpha = 1;
        };
      }
      out.push(it);
    }
  }

  // world points that outline what stands at clock t (for a tight camera fit)
  fitPoints(t: number) {
    const pts: [number, number, number][] = [];
    const m = CAP_L * 2 + 0.3;
    this.cores.forEach((c, i) => {
      const h = this.coreH(i, t);
      if (h < 0.05) return;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        for (const z of [0, h]) pts.push([c.x + Math.cos(a) * (c.r + 0.3), c.y + Math.sin(a) * (c.r + 0.3), z]);
      }
    });
    for (const b of this.beams) {
      if (b.real !== undefined) continue;
      const g = this.beamGrow(b, t, 0);
      if (g <= 0 || this.coreH(b.core, t) < b.z + BEAM_H) continue;
      const [sx, sy] = this.beamStart(b);
      const ux = Math.cos(b.a), uy = Math.sin(b.a);
      for (const s of [0, b.len * g]) for (const side of [-1, 1]) for (const z of [b.z - 0.3, b.z + CAP_H]) {
        pts.push([sx + ux * s - uy * side * (BEAM_W + m), sy + uy * s + ux * side * (BEAM_W + m), z]);
      }
    }
    return pts;
  }

  // bounds of what stands at clock t (for camera fitting)
  boundsAt(t: number) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z1 = 0;
    const m = 2.3;
    this.cores.forEach((c, i) => {
      const h = this.coreH(i, t);
      if (h < 0.05) return;
      x0 = Math.min(x0, c.x - c.r - m); x1 = Math.max(x1, c.x + c.r + m);
      y0 = Math.min(y0, c.y - c.r - m); y1 = Math.max(y1, c.y + c.r + m);
      z1 = Math.max(z1, h);
    });
    for (const b of this.beams) {
      if (b.real !== undefined) continue;
      const g = this.beamGrow(b, t, 0);
      if (g <= 0) continue;
      const [sx, sy] = this.beamStart(b);
      const ex = sx + Math.cos(b.a) * b.len * g, ey = sy + Math.sin(b.a) * b.len * g;
      x0 = Math.min(x0, ex - m); x1 = Math.max(x1, ex + m); y0 = Math.min(y0, ey - m); y1 = Math.max(y1, ey + m);
    }
    return { x0, x1, y0, y1, z1: z1 + 1 };
  }

  // bounds of the fully grown structure (for camera fitting)
  bounds() {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z1 = 0;
    for (const s of this.solids) {
      x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[1]);
      y0 = Math.min(y0, s[2]); y1 = Math.max(y1, s[3]);
      z1 = Math.max(z1, s[5]);
    }
    return { x0, x1, y0, y1, z1 };
  }
}

// ghost of a unit at a socket (hover preview)
export function ghostItem(cam: Cam, s: Sock): Item {
  return { ...boxItem(cam, s.x, s.y, s.z, s.z + CAP_H, s.a, CAP_L, CAP_W, { ghost: true, window: true }), c: 1e9 };
}

export { close };
