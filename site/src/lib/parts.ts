// The parts box. A handful of flat, perforated parts (a strip, a disc, a ring, a plate,
// a half disc, a bar) and the three inks they are printed in. Everything on the site is
// composed from these: the hero press, the essay prints, the mark.
// Shared by build-time SVG (Astro) and the canvas engine (browser).

export const INK = {
  paper: '#EEEBE3',
  y: '#F5C21B', // yellow — the organisation
  c: '#26A2C8', // cyan — the organisation
  m: '#E8487E', // pink — agents
  key: '#1D1C21',
} as const;
export type Ink = 'y' | 'c' | 'm';

export type Kind = 'strip' | 'disc' | 'ring' | 'plate' | 'half' | 'bar';
export interface Shape { kind: Kind; n?: number; r?: number; t?: number; w?: number; h?: number }

const PITCH = 8; // hole pitch, like a construction set
const HOLE = 1.85;
const f = (v: number) => +v.toFixed(2);

function circle(cx: number, cy: number, r: number) {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}

/** SVG path data for a shape, centred on 0,0. Holes are separate subpaths: fill with evenodd. */
export function shapePath(s: Shape): string {
  switch (s.kind) {
    case 'strip': {
      const n = s.n ?? 5, L = n * PITCH, r = PITCH / 2;
      let d = `M${-L / 2 + r} ${-r}H${L / 2 - r}A${r} ${r} 0 0 1 ${L / 2 - r} ${r}H${-L / 2 + r}A${r} ${r} 0 0 1 ${-L / 2 + r} ${-r}Z`;
      for (let i = 0; i < n; i++) d += circle(-L / 2 + r + i * PITCH, 0, HOLE);
      return d;
    }
    case 'disc': {
      const r = s.r ?? 10;
      let d = circle(0, 0, r);
      if (r > 7) d += circle(0, 0, HOLE);
      return d;
    }
    case 'ring': {
      const r = s.r ?? 12, t = s.t ?? 4;
      return circle(0, 0, r) + circle(0, 0, r - t);
    }
    case 'plate': {
      const n = s.n ?? 3, S = n * PITCH, h = S / 2, k = 1.4;
      let d = `M${-h + k} ${-h}H${h - k}Q${h} ${-h} ${h} ${-h + k}V${h - k}Q${h} ${h} ${h - k} ${h}H${-h + k}Q${-h} ${h} ${-h} ${h - k}V${-h + k}Q${-h} ${-h} ${-h + k} ${-h}Z`;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) d += circle(-h + PITCH / 2 + i * PITCH, -h + PITCH / 2 + j * PITCH, HOLE);
      return d;
    }
    case 'half': {
      const r = s.r ?? 12;
      return `M${-r} 0A${r} ${r} 0 0 1 ${r} 0Z` + circle(0, -r * 0.42, HOLE);
    }
    case 'bar': {
      const w = s.w ?? 30, h = s.h ?? 6;
      return `M${-w / 2} ${-h / 2}H${w / 2}V${h / 2}H${-w / 2}Z`;
    }
  }
}

/** Rough radius of a shape, for overlap placement. */
export function shapeRadius(s: Shape): number {
  switch (s.kind) {
    case 'strip': return ((s.n ?? 5) * PITCH) / 2;
    case 'disc': return s.r ?? 10;
    case 'ring': return s.r ?? 12;
    case 'plate': return ((s.n ?? 3) * PITCH) / 1.6;
    case 'half': return s.r ?? 12;
    case 'bar': return (s.w ?? 30) / 2;
  }
}

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

/**
 * A placed part. It hangs from a pivot (px,py) in print space (0..100), the shape sits at
 * (ox,oy) from the pivot, rotated by th (degrees). "0" is before an agent arrives, "1" after:
 * parts are never removed, they only turn and shift about their pivots.
 */
export interface Part {
  shape: Shape; ink: Ink;
  px: number; py: number; ox: number; oy: number; th: number;
  px1: number; py1: number; th1: number;
  agent?: boolean;
  lag?: number; // 0..1 — when, within the reorganisation, this part moves
}

function pickShape(r: () => number): Shape {
  const k = r();
  if (k < 0.34) return { kind: 'strip', n: 3 + Math.floor(r() * 4) };
  if (k < 0.52) return { kind: 'disc', r: 9 + r() * 9 };
  if (k < 0.66) return { kind: 'ring', r: 9 + r() * 7, t: 3.4 + r() * 1.6 };
  if (k < 0.82) return { kind: 'plate', n: 2 + Math.floor(r() * 2) };
  return { kind: 'half', r: 10 + r() * 7 };
}
const quarter = (r: () => number) => (r() < 0.6 ? Math.floor(r() * 4) * 90 : (r() < 0.5 ? -1 : 1) * (30 + Math.floor(r() * 3) * 15));

/** Where a bolt sits on a part, in the part's own coordinates. */
function bolt(s: Shape, r: () => number): [number, number] {
  if (s.kind === 'strip') { const n = s.n ?? 5; const i = r() < 0.5 ? 0 : n - 1; return [-(n * PITCH) / 2 + PITCH / 2 + i * PITCH, 0]; }
  if (s.kind === 'plate') { const h = ((s.n ?? 3) * PITCH) / 2 - PITCH / 2; return [-h, -h]; }
  if (s.kind === 'half') return [0, -(s.r ?? 12) * 0.42];
  if (s.kind === 'ring') return [(s.r ?? 12) - (s.t ?? 4) / 2, 0];
  return [0, 0];
}
const rot = (x: number, y: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
};

/**
 * A seeded composition, built like a construction set: a long strip (the spine) with a few
 * parts bolted through its holes, in two inks. Before/after: the spine turns about its bolt,
 * and every attached part is carried with it and turns about its own bolt. The agent part is
 * bolted into the same holes, so it always prints over the organisation.
 */
export function compose(seed: number | string, opts: { base?: number; agents?: number } = {}) {
  const r = rng(typeof seed === 'string' ? hash(seed) : seed);
  const nb = Math.max(2, opts.base ?? 3 + Math.floor(r() * 2));
  const na = opts.agents ?? 1 + (r() < 0.3 ? 1 : 0);
  const inkA: Ink = r() < 0.5 ? 'y' : 'c', inkB: Ink = inkA === 'y' ? 'c' : 'y';
  const n = 7 + Math.floor(r() * 4);
  const spine: Shape = { kind: 'strip', n };
  const L = n * PITCH;
  const th0 = r() < 0.5 ? 0 : r() < 0.5 ? 90 : (r() < 0.5 ? -1 : 1) * 30;
  const turn = (r() < 0.5 ? -1 : 1) * (18 + r() * 22);
  const sx = 50 + (r() - 0.5) * 10, sy = 50 + (r() - 0.5) * 10;
  // spine pivots about one of its own holes, a little off centre
  const pivotHole = Math.floor(n / 2) + (r() < 0.5 ? -1 : 1) * Math.floor(1 + r() * 2);
  const hx = -L / 2 + PITCH / 2 + pivotHole * PITCH;
  const [spx, spy] = [sx + rot(hx, 0, th0)[0], sy + rot(hx, 0, th0)[1]];
  const parts: Part[] = [{ shape: spine, ink: inkA, px: spx, py: spy, ox: -hx, oy: 0, th: th0, px1: spx, py1: spy, th1: th0 + turn, lag: 0 }];
  const holeAt = (i: number, th: number): [number, number] => {
    const x = -L / 2 + PITCH / 2 + i * PITCH - hx;
    const [dx, dy] = rot(x, 0, th);
    return [spx + dx, spy + dy];
  };
  const used = new Set<number>([pivotHole]);
  const freeHole = () => {
    for (let k = 0; k < 20; k++) { const i = Math.floor(r() * n); if (!used.has(i)) { used.add(i); return i; } }
    return Math.floor(r() * n);
  };
  for (let i = 1; i < nb; i++) {
    const shape = pickShape(r);
    const h = freeHole();
    const [bx, by] = bolt(shape, r);
    const [x0, y0] = holeAt(h, th0), [x1, y1] = holeAt(h, th0 + turn);
    const th = quarter(r);
    parts.push({
      shape, ink: i % 2 ? inkB : inkA, px: x0, py: y0, ox: -bx, oy: -by, th,
      px1: x1, py1: y1, th1: th + turn * (0.4 + r() * 0.9) * (r() < 0.3 ? -1 : 1), lag: 0.15 + r() * 0.85,
    });
  }
  for (let j = 0; j < na; j++) {
    const shape: Shape = j === 0 && r() < 0.55 ? { kind: 'strip', n: 3 + Math.floor(r() * 3) } : pickShape(r);
    const h = freeHole();
    const [bx, by] = bolt(shape, r);
    const [x1, y1] = holeAt(h, th0 + turn);
    const th = quarter(r) + turn;
    parts.push({ shape, ink: 'm', px: x1, py: y1, ox: -bx, oy: -by, th, px1: x1, py1: y1, th1: th, agent: true, lag: 0 });
  }
  return parts;
}

/** Order parts so the prints stack in a stable way (big first). */
export const byRadius = (a: Part, b: Part) => shapeRadius(b.shape) - shapeRadius(a.shape);
