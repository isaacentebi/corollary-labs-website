// The parts box: flat metal offcuts, the kind found by the roadside or in a workshop drawer.
// Strips with cut ends and holes drilled by hand, plates with a chamfered corner, discs with a
// flat or a bolt circle, washers, brackets, rods. Every edge is slightly uneven, as a worn
// part prints. Everything on the site is composed from these: the hero press, the essay
// prints, the mark. Shared by build-time SVG (Astro) and the canvas engine (browser).

export const INK = {
  paper: '#EEEBE3',
  y: '#F5C21B', // yellow — the organisation
  c: '#26A2C8', // cyan — the organisation
  m: '#E8487E', // pink — agents
  key: '#1D1C21',
} as const;
/** Each ink printed over itself: the heavier rim where ink gathers at a part's edge. */
export const RIM = { y: '#E3A20C', c: '#1778A0', m: '#C8255E' } as const;
export type Ink = 'y' | 'c' | 'm';

export type Kind = 'strip' | 'plate' | 'disc' | 'ring' | 'sector' | 'angle' | 'rod';
export interface Shape {
  kind: Kind; seed: number;
  L?: number; w?: number; h?: number; r?: number; t?: number; a?: number; b?: number; span?: number;
}
type Pt = [number, number];
export interface Geo { d: string; holes: Pt[]; pins: Pt[]; radius: number }

// ——— seeded randomness ———
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ——— outlines ———
const f = (v: number) => +v.toFixed(2);
function densify(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}
function arc(cx: number, cy: number, r: number, a0 = 0, a1 = Math.PI * 2, step = 0.7): Pt[] {
  const n = Math.max(12, Math.ceil((Math.abs(a1 - a0) * r) / step));
  const full = Math.abs(a1 - a0) >= Math.PI * 2 - 1e-6;
  const out: Pt[] = [];
  for (let i = 0; i < (full ? n : n + 1); i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
/** Push each point along its normal by a smooth, seeded amount: a worn, hand-cut edge. */
function roughen(pts: Pt[], amp: number, r: () => number): Pt[] {
  const n = pts.length;
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  let s = 0;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    if (i > 0) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const o = amp * (0.35 * Math.sin(s * 1.3 + ph[0]) + 0.3 * Math.sin(s * 3.1 + ph[1]) + 0.25 * Math.sin(s * 7.3 + ph[2]) + 0.5 * (r() - 0.5));
    return [p[0] + nx * o, p[1] + ny * o];
  });
}
const loopD = (pts: Pt[]) => 'M' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
function hole(cx: number, cy: number, rad: number, r: () => number) {
  return loopD(roughen(arc(cx, cy, rad, 0, Math.PI * 2, 0.45), Math.min(0.09, rad * 0.07), r));
}
function slot(cx: number, cy: number, len: number, rad: number, r: () => number) {
  const pts = [...arc(cx + len / 2, cy, rad, -Math.PI / 2, Math.PI / 2, 0.45), ...arc(cx - len / 2, cy, rad, Math.PI / 2, Math.PI * 1.5, 0.45)];
  return loopD(roughen(pts, 0.1, r));
}

const cache = new Map<string, Geo>();
/** Build a shape's outline (path data, evenodd), its holes, the points it can be bolted at, and its reach. */
export function geo(s: Shape): Geo {
  const key = JSON.stringify(s);
  const hit = cache.get(key);
  if (hit) return hit;
  const r = rng(s.seed * 7919 + 17);
  let outer: Pt[] = [];
  const holes: Pt[] = [];
  let d = '';
  const drill = (x: number, y: number, rad: number) => { holes.push([x, y]); d += hole(x, y, rad, r); };
  switch (s.kind) {
    case 'strip': {
      const L = s.L ?? 40, w = s.w ?? 5;
      const cutL = r() < 0.45 ? w * (0.35 + r() * 0.5) : 0, cutR = r() < 0.35 ? w * (0.35 + r() * 0.5) : 0;
      outer = densify([[-L / 2 + cutL, -w / 2], [L / 2, -w / 2], [L / 2 - cutR, w / 2], [-L / 2, w / 2]], 0.8);
      let x = -L / 2 + w * 0.75 + cutL * 0.5;
      const pitch = w * (1.25 + r() * 0.4);
      let slotted = false;
      while (x < L / 2 - w * 0.75) {
        const k = r();
        if (!slotted && k < 0.1 && x + w * 2.4 < L / 2 - w * 0.75) { d += slot(x + w * 0.9, 0, w * 1.6, w * 0.2, r); holes.push([x, 0], [x + w * 1.8, 0]); x += w * 2.8; slotted = true; continue; }
        if (k > 0.13) drill(x, (r() - 0.5) * w * 0.08, w * (0.15 + r() * 0.09));
        x += pitch * (0.7 + r() * 0.7);
      }
      break;
    }
    case 'plate': {
      const W = s.w ?? 24, H = s.h ?? 18, c1 = r() < 0.6 ? Math.min(W, H) * (0.12 + r() * 0.16) : 0, c2 = r() < 0.3 ? Math.min(W, H) * (0.1 + r() * 0.12) : 0;
      outer = densify([[-W / 2 + c1, -H / 2], [W / 2, -H / 2], [W / 2, H / 2 - c2], [W / 2 - c2, H / 2], [-W / 2, H / 2], [-W / 2, -H / 2 + c1]], 0.8);
      const g = 5.5 + r() * 2.5, m = 3.6;
      const big = r() < 0.3 ? [(r() - 0.5) * W * 0.3, (r() - 0.5) * H * 0.3, Math.min(W, H) * (0.16 + r() * 0.06)] : null;
      if (big) drill(big[0], big[1], big[2]);
      for (let y = -H / 2 + m; y <= H / 2 - m + 0.01; y += g) for (let x = -W / 2 + m; x <= W / 2 - m + 0.01; x += g) {
        if (r() < 0.28) continue;
        const hx = x + (r() - 0.5) * 1.1, hy = y + (r() - 0.5) * 1.1;
        if (Math.hypot(hx + W / 2, hy + H / 2) < c1 + 3.5 || Math.hypot(hx - W / 2, hy - H / 2) < c2 + 3.5) continue;
        if (big && Math.hypot(hx - big[0], hy - big[1]) < big[2] + 2.4) continue;
        drill(hx, hy, 0.95 + r() * 0.6);
      }
      break;
    }
    case 'disc': {
      const R = s.r ?? 10;
      outer = arc(0, 0, R, 0, Math.PI * 2, 0.8);
      if (R > 7 && r() < 0.4) { const cut = R * (0.62 + r() * 0.2); outer = outer.map(([x, y]) => [x, Math.min(y, cut)]); }
      if (R < 6) drill(0, 0, R * 0.28);
      else if (r() < 0.5) { drill(0, 0, R * (0.08 + r() * 0.06) + 0.5); }
      else {
        const n = 3 + Math.floor(r() * 4), rr = R * (0.55 + r() * 0.12), a0 = r() * 6.28;
        for (let i = 0; i < n; i++) drill(Math.cos(a0 + (i * 6.28) / n) * rr, Math.sin(a0 + (i * 6.28) / n) * rr, 0.8 + R * 0.04);
        if (r() < 0.6) drill(0, 0, R * 0.16);
      }
      break;
    }
    case 'ring': {
      const R = s.r ?? 8, t = s.t ?? 2;
      outer = arc(0, 0, R, 0, Math.PI * 2, 0.8);
      d += loopD(roughen(arc(0, 0, R - t, 0, Math.PI * 2, 0.6), 0.1, r));
      holes.push([0, 0]);
      break;
    }
    case 'sector': {
      const R = s.r ?? 12, span = s.span ?? Math.PI / 2;
      outer = densify([[0, 0], ...arc(0, 0, R, -span / 2, span / 2, 0.8)], 0.8);
      drill(R * 0.2, 0, 0.9 + R * 0.04);
      if (r() < 0.6) drill(R * 0.72, 0, 0.8 + R * 0.035);
      break;
    }
    case 'angle': {
      const a = s.a ?? 30, b = s.b ?? 18, w = s.w ?? 5;
      outer = densify([[0, 0], [a, 0], [a, w], [w, w], [w, b], [0, b]], 0.8).map(([x, y]) => [x - w / 2, y - w / 2] as Pt);
      const pitch = w * (1.3 + r() * 0.4);
      for (let x = w * 1.5; x < a - w * 0.7; x += pitch * (0.8 + r() * 0.5)) if (r() > 0.12) drill(x - w / 2, 0, w * (0.16 + r() * 0.07));
      for (let y = w * 1.5; y < b - w * 0.7; y += pitch * (0.8 + r() * 0.5)) if (r() > 0.12) drill(0, y - w / 2, w * (0.16 + r() * 0.07));
      drill(0, 0, w * 0.2);
      break;
    }
    case 'rod': {
      const L = s.L ?? 40, w = s.w ?? 1.6;
      outer = densify([[-L / 2, -w / 2], [L / 2, -w / 2], [L / 2, w / 2], [-L / 2, w / 2]], 0.9);
      break;
    }
  }
  const amp = s.kind === 'rod' ? 0.06 : 0.13;
  d = loopD(roughen(outer, amp, r)) + d;
  const radius = Math.max(...outer.map(([x, y]) => Math.hypot(x, y)));
  const pins: Pt[] = holes.length ? holes : s.kind === 'rod' ? [[-(s.L ?? 40) / 2 + 1.2, 0], [(s.L ?? 40) / 2 - 1.2, 0]] : [[0, 0]];
  const g: Geo = { d, holes, pins, radius };
  cache.set(key, g);
  return g;
}
export const shapePath = (s: Shape) => geo(s).d;
export const shapeRadius = (s: Shape) => geo(s).radius;

/**
 * A placed part. It hangs from a bolt at (px,py) in print space (0..100); the part's own
 * origin sits at (ox,oy) from the bolt, rotated by th (degrees). Suffix 1 is after an agent
 * arrives: parts are never removed, they only turn about their bolts and shift.
 */
export interface Part {
  shape: Shape; ink: Ink;
  px: number; py: number; ox: number; oy: number; th: number;
  px1: number; py1: number; th1: number;
  agent?: boolean;
  lag?: number;
}

// ——— the parts drawer ———
function pick(r: () => number, role: 'spine' | 'big' | 'small' | 'agent'): Shape {
  const seed = Math.floor(r() * 1e9);
  const k = r();
  if (role === 'spine') {
    if (k < 0.72) return { kind: 'strip', seed, L: 54 + r() * 34, w: 4.2 + r() * 2.2 };
    return { kind: 'angle', seed, a: 40 + r() * 22, b: 22 + r() * 18, w: 4.4 + r() * 1.8 };
  }
  if (role === 'big') {
    if (k < 0.45) return { kind: 'plate', seed, w: 24 + r() * 16, h: 16 + r() * 14 };
    if (k < 0.8) return { kind: 'disc', seed, r: 13 + r() * 9 };
    return { kind: 'sector', seed, r: 18 + r() * 8, span: r() < 0.5 ? Math.PI / 2 : Math.PI * 0.66 };
  }
  if (role === 'agent') {
    if (k < 0.45) return { kind: 'strip', seed, L: 22 + r() * 22, w: 4 + r() * 2 };
    if (k < 0.7) return { kind: 'disc', seed, r: 6 + r() * 6 };
    if (k < 0.85) return { kind: 'plate', seed, w: 12 + r() * 8, h: 10 + r() * 6 };
    return { kind: 'sector', seed, r: 10 + r() * 6, span: Math.PI / 2 };
  }
  if (k < 0.28) return { kind: 'strip', seed, L: 16 + r() * 20, w: 3.4 + r() * 2 };
  if (k < 0.46) return { kind: 'ring', seed, r: 3.2 + r() * 5, t: 1.1 + r() * 1.4 };
  if (k < 0.62) return { kind: 'rod', seed, L: 22 + r() * 30, w: 1.1 + r() * 0.8 };
  if (k < 0.8) return { kind: 'disc', seed, r: 3 + r() * 4 };
  return { kind: 'sector', seed, r: 8 + r() * 6, span: Math.PI / 2 };
}
const rot = (x: number, y: number, deg: number): Pt => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
};
const quarter = (r: () => number) => (r() < 0.55 ? Math.floor(r() * 4) * 90 : (r() < 0.5 ? -1 : 1) * (15 + Math.floor(r() * 4) * 15));

/**
 * A seeded composition, assembled like a found-metal construction: a spine (a long strip or a
 * bracket) with a few parts bolted through its holes, one of them large, in two inks. After:
 * the spine turns about its bolt, and every attached part is carried with it and turns about
 * its own bolt. Agents (pink) are bolted into the same holes, so they always print over the
 * organisation.
 */
export function compose(seed: number | string, opts: { base?: number; agents?: number } = {}) {
  const r = rng(typeof seed === 'string' ? hash(seed) : seed);
  const nb = Math.max(2, opts.base ?? 4 + (r() < 0.4 ? 1 : 0));
  const na = opts.agents ?? 1 + (r() < 0.3 ? 1 : 0);
  const inkA: Ink = r() < 0.5 ? 'y' : 'c', inkB: Ink = inkA === 'y' ? 'c' : 'y';
  const spine = pick(r, 'spine');
  const sg = geo(spine);
  const th0 = [0, 90, -15, 15, -30, 30, 45][Math.floor(r() * 7)];
  const turn = (r() < 0.5 ? -1 : 1) * (16 + r() * 22);
  const sx = 50 + (r() - 0.5) * 8, sy = 50 + (r() - 0.5) * 8;
  const pinsS = sg.pins.length > 2 ? sg.pins.slice(1, -1) : sg.pins;
  const [hx, hy] = pinsS[Math.floor(r() * pinsS.length)];
  const [ax, ay] = rot(hx, hy, th0);
  const spx = sx + ax, spy = sy + ay;
  const parts: Part[] = [{ shape: spine, ink: inkA, px: spx, py: spy, ox: -hx, oy: -hy, th: th0, px1: spx, py1: spy, th1: th0 + turn, lag: 0 }];
  const holeAt = (i: number, th: number): Pt => {
    const [x, y] = sg.pins[i];
    const [dx, dy] = rot(x - hx, y - hy, th);
    return [spx + dx, spy + dy];
  };
  const used = new Set<number>();
  const free = () => {
    for (let k = 0; k < 24; k++) { const i = Math.floor(r() * sg.pins.length); if (!used.has(i)) { used.add(i); return i; } }
    return Math.floor(r() * sg.pins.length);
  };
  for (let i = 1; i < nb; i++) {
    const shape = pick(r, i === 1 ? 'big' : 'small');
    const g = geo(shape);
    const [bx, by] = g.pins[Math.floor(r() * g.pins.length)];
    const h = free();
    const [x0, y0] = holeAt(h, th0), [x1, y1] = holeAt(h, th0 + turn);
    const th = quarter(r);
    parts.push({
      shape, ink: i % 2 ? inkB : inkA, px: x0, py: y0, ox: -bx, oy: -by, th,
      px1: x1, py1: y1, th1: th + turn * (0.4 + r() * 0.9) * (r() < 0.3 ? -1 : 1), lag: 0.15 + r() * 0.85,
    });
  }
  for (let j = 0; j < na; j++) {
    const shape = pick(r, 'agent');
    const g = geo(shape);
    const [bx, by] = g.pins[Math.floor(r() * g.pins.length)];
    const [x1, y1] = holeAt(free(), th0 + turn);
    const th = quarter(r) + turn;
    parts.push({ shape, ink: 'm', px: x1, py: y1, ox: -bx, oy: -by, th, px1: x1, py1: y1, th1: th, agent: true, lag: 0 });
  }
  return parts;
}

/** Bounds of a composition over both states: [x0, y0, x1, y1]. */
export function bounds(parts: Part[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of parts) for (const s of [0, 1] as const) {
    if (p.agent && s === 0) continue;
    const px = s ? p.px1 : p.px, py = s ? p.py1 : p.py, th = s ? p.th1 : p.th;
    const [cx, cy] = rot(p.ox, p.oy, th);
    const rad = geo(p.shape).radius * 0.92;
    x0 = Math.min(x0, px + cx - rad); y0 = Math.min(y0, py + cy - rad); x1 = Math.max(x1, px + cx + rad); y1 = Math.max(y1, py + cy + rad);
  }
  return [x0, y0, x1, y1];
}

export const byRadius = (a: Part, b: Part) => shapeRadius(b.shape) - shapeRadius(a.shape);
