// Shared drawing kit: maths helpers, palette from CSS, seeded noise, and the tissue (a Voronoi of cells,
// every cell a firm). Used by the home specimen, the footer and the page plates.


export const TAU = Math.PI * 2;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const ss = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** springy ease: overshoots, settles exactly at 1 */
export const spring = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-4 * t) * Math.cos(10 * t) * (1 - t));
export const gauss = (d: number, w: number) => Math.exp(-(d / w) * (d / w));
export const angDiff = (a: number, b: number) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const polar = (th: number, r: number): [number, number] => [Math.cos(th) * r, Math.sin(th) * r];

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RGB = [number, number, number];
export interface Palette { paper: RGB; paper3: RGB; ink: RGB; ink2: RGB; ink3: RGB; accent: RGB; accent2: RGB; body: RGB }
const hex = (h: string): RGB => { const s = h.trim().replace('#', ''); const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export function palette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const g = (v: string, f: string) => hex(cs.getPropertyValue(v) || f);
  return { paper: g('--paper', '#f2ede3'), paper3: g('--paper-3', '#ddd4c2'), ink: g('--ink', '#25221c'), ink2: g('--ink-2', '#585246'), ink3: g('--ink-3', '#9a9384'), accent: g('--accent', '#a66d1a'), accent2: g('--accent-2', '#e2c48e'), body: [118, 104, 82] };
}
export const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
export const mixc = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Smooth closed path through points (Catmull-Rom as cubic Bézier). */
export function smoothClosed(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  const n = pts.length; if (n < 3) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  ctx.closePath();
}
/** Rounded polygon: corners replaced by quadratic curves through edge midpoints. */
export function roundPoly(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  const n = pts.length; if (n < 3) return;
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const m = mid(pts[i], pts[(i + 1) % n]); ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
  ctx.closePath();
}

