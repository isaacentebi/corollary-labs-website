// The mark: a limaçon, r = b + a·cos θ with a > b, turned so its inner loop hangs from the top.
// One closed line that is a boundary and, through the loop, something it has drawn inside itself.
export function limacon(a = 3, b = 1, n = 260, size = 32, pad = 2.5, rot = Math.PI / 2): string {
  const c = Math.cos(rot), s = Math.sin(rot);
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = b + a * Math.cos(t);
    const x = r * Math.cos(t), y = r * Math.sin(t);
    pts.push([x * c - y * s, x * s + y * c]);
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const k = (size - pad * 2) / Math.max(maxX - minX, maxY - minY);
  const ox = pad + (size - pad * 2 - (maxX - minX) * k) / 2 - minX * k;
  const oy = pad + (size - pad * 2 - (maxY - minY) * k) / 2 - minY * k;
  return pts.map((p, i) => `${i ? 'L' : 'M'}${(ox + p[0] * k).toFixed(2)} ${(oy + p[1] * k).toFixed(2)}`).join(' ') + 'Z';
}
