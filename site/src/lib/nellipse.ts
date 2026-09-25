// Level sets of f(p) = sum_i |p - c_i|  (an n-ellipse: the set of points whose summed distance to n foci is constant).
// f is convex, so every level set is a convex closed curve, star-shaped from the centroid: we find it by bisection along rays.
export type Pt = [number, number];

export function nEllipse(foci: Pt[], c: number, samples = 120): Pt[] {
  const cx = foci.reduce((a, p) => a + p[0], 0) / foci.length;
  const cy = foci.reduce((a, p) => a + p[1], 0) / foci.length;
  const f = (x: number, y: number) => foci.reduce((a, p) => a + Math.hypot(x - p[0], y - p[1]), 0);
  const pts: Pt[] = [];
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    let lo = 0, hi = c;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (f(cx + dx * m, cy + dy * m) < c) lo = m; else hi = m; }
    pts.push([cx + dx * lo, cy + dy * lo]);
  }
  return pts;
}

// closed Catmull-Rom → cubic Bézier path
export function smoothClosed(pts: Pt[], dp = 2): string {
  const n = pts.length, r = (v: number) => v.toFixed(dp);
  let d = `M${r(pts[0][0])} ${r(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r(c1[0])} ${r(c1[1])} ${r(c2[0])} ${r(c2[1])} ${r(p2[0])} ${r(p2[1])}`;
  }
  return d + 'Z';
}

export const ringPath = (foci: Pt[], c: number, samples = 48, dp = 2) => smoothClosed(nEllipse(foci, c, samples), dp);
