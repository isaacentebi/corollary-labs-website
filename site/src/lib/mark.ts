// The mark: a limaçon, r = b + a·cos θ with a > b. One closed line that is both the boundary and,
// through its inner loop, the input it has drawn inside itself. Used for the logo, favicon and menu button.
export function limacon(a = 1.6, b = 1, n = 220, size = 32, pad = 2.5): string {
  // bounds of the curve for this a, b
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = b + a * Math.cos(t);
    pts.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = (size - pad * 2) / Math.max(maxX - minX, maxY - minY);
  const ox = pad + (size - pad * 2 - (maxX - minX) * s) / 2 - minX * s;
  const oy = pad + (size - pad * 2 - (maxY - minY) * s) / 2 - minY * s;
  return pts.map((p, i) => `${i ? 'L' : 'M'}${(ox + p[0] * s).toFixed(2)} ${(oy + p[1] * s).toFixed(2)}`).join(' ') + 'Z';
}
