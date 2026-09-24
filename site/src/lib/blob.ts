// Seeded wobbly closed curves (cell walls) for SVG, generated at build time.
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/** Closed smooth blob in a box: centre (cx, cy), radius r, wobble amplitude w (fraction of r). */
export function blob(seed: number, cx = 50, cy = 50, r = 46, w = 0.06, n = 72): string {
  const R = rng(seed);
  const h = [2, 3, 4, 5].map((k) => ({ k, a: (R() * 2 - 1) * w / (k * 0.5), p: R() * Math.PI * 2 }));
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let rr = 1; for (const { k, a, p } of h) rr += a * Math.sin(k * t + p);
    pts.push([cx + Math.cos(t) * r * rr, cy + Math.sin(t) * r * rr]);
  }
  // Catmull-Rom → cubic Bézier, closed
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d + 'Z';
}

/** Stipple: n dots inside a disc, for chromatin in nuclei. Returns SVG circles. */
export function stipple(seed: number, cx: number, cy: number, r: number, n: number, dot = 0.9): string {
  const R = rng(seed); let s = '';
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r;
    s += `<circle cx="${(cx + Math.cos(a) * d).toFixed(2)}" cy="${(cy + Math.sin(a) * d).toFixed(2)}" r="${(dot * (0.6 + R() * 0.7)).toFixed(2)}"/>`;
  }
  return s;
}
