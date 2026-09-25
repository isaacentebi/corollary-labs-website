// Lights along a horizon, in a few rows at different distances (Koop's horizon fields; Krauze's
// stones along a ruled line). Light reaches each one from its neighbours, never all at once: arrival
// times are shortest paths over a nearest-neighbour graph with uneven (log-normal) delays.
import { NODE_COUNT } from './shader';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export interface FieldLayout { nodes: Float32Array; seed: [number, number, number] }

export function layoutField(aspect: number, horizon: number, ox = 0): FieldLayout {
  const r = rng(11);
  const N = NODE_COUNT;
  const half = aspect / 2;
  const x0 = ox > 0 ? -0.02 : -half + 0.04, x1 = half - 0.04;
  // rows: nearer rows are lower, larger and sparser
  const rows = [
    { z: 1.5, n: 5 }, { z: 2.3, n: 8 }, { z: 3.6, n: 12 }, { z: 6, n: 23 },
  ];
  const pts: { x: number; y: number; s: number; wx: number; wz: number }[] = [];
  for (const row of rows) {
    for (let i = 0; i < row.n && pts.length < N; i++) {
      const t = (i + 0.2 + r() * 0.6) / row.n;
      const x = x0 + (x1 - x0) * t;
      const y = horizon - (aspect > 1 ? 0.14 : 0.12) / row.z - (r() - 0.5) * 0.008;
      pts.push({ x, y, s: (aspect > 1 ? 0.017 : 0.013) / Math.pow(row.z, 0.8), wx: x * row.z, wz: row.z * 1.6 });
    }
  }
  while (pts.length < N) pts.push({ x: 99, y: 99, s: 0.001, wx: 999, wz: 999 });
  // the first light: nearest row, near the middle
  let seedI = 0, best = 1e9;
  pts.forEach((p, i) => { if (i < rows[0].n) { const d = Math.abs(p.x - (x0 + x1) / 2); if (d < best) { best = d; seedI = i; } } });
  const k = 4;
  const edges: [number, number][][] = pts.map(() => []);
  pts.forEach((a, i) => {
    const near = pts.map((b, j) => ({ j, d: Math.hypot(a.wx - b.wx, a.wz - b.wz) })).filter((e) => e.j !== i).sort((p, q) => p.d - q.d).slice(0, k);
    for (const e of near) {
      const delay = e.d * Math.exp((r() - 0.5) * 2.0);
      edges[i].push([e.j, delay]);
      edges[e.j].push([i, delay]);
    }
  });
  const dist = new Array(N).fill(Infinity);
  const done = new Array(N).fill(false);
  dist[seedI] = 0;
  for (let it = 0; it < N; it++) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = true;
    for (const [v, w] of edges[u]) if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
  }
  const max = Math.max(...dist.filter((d) => d < Infinity && d > 0));
  const nodes = new Float32Array(N * 4);
  pts.forEach((p, i) => {
    // a few are reached late or not within the scene
    const a = dist[i] === Infinity ? 1.5 : (dist[i] / max) * 0.9 + (r() < 0.08 ? 0.3 : 0);
    nodes.set([p.x, p.y, p.s, i === seedI ? -0.05 : a], i * 4);
  });
  const s = pts[seedI];
  return { nodes, seed: [s.x, s.y, s.s] };
}
