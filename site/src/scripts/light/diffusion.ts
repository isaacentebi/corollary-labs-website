// Small volumes scattered across a plain below the horizon. Light reaches each one from its
// neighbours, never all at once: arrival times come from shortest paths over a nearest-neighbour graph
// whose edges have uneven (log-normal) delays, so the spread is uneven and some are reached late.
import { NODE_COUNT } from './shader';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export interface FieldLayout { nodes: Float32Array; seed: [number, number, number] }

export function layoutField(aspect: number, horizon: number): FieldLayout {
  const r = rng(7);
  const N = NODE_COUNT;
  const world: { x: number; z: number }[] = [];
  // the seed volume sits in the foreground, slightly left of centre
  world.push({ x: -0.25, z: 1.35 });
  let guard = 0;
  while (world.length < N && guard++ < 5000) {
    const z = 1.2 + Math.pow(r(), 0.8) * 7.5;
    const spread = (aspect > 1 ? 2.1 : 1.1) * z;
    const x = (r() * 2 - 1) * spread;
    if (world.every((w) => Math.hypot((w.x - x) / Math.max(1, z * 0.4), (w.z - z) * 1.1) > 0.42)) world.push({ x, z });
  }
  // project onto the screen
  const focal = aspect > 1 ? 0.3 : 0.24;
  const proj = world.map((w) => ({
    x: (w.x / w.z) * focal * 1.6,
    y: horizon - (focal * 0.9) / w.z,
    s: (aspect > 1 ? 0.028 : 0.022) / Math.pow(w.z, 0.9),
  }));
  // uneven arrival: Dijkstra over k nearest neighbours in world space
  const k = 4;
  const edges: [number, number][][] = world.map(() => []);
  world.forEach((a, i) => {
    const near = world.map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.z - b.z) })).filter((e) => e.j !== i).sort((p, q) => p.d - q.d).slice(0, k);
    for (const e of near) {
      const delay = e.d * Math.exp((r() - 0.5) * 1.8);
      edges[i].push([e.j, delay]);
      edges[e.j].push([i, delay]);
    }
  });
  const dist = new Array(N).fill(Infinity);
  const done = new Array(N).fill(false);
  dist[0] = 0;
  for (let it = 0; it < N; it++) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = true;
    for (const [v, w] of edges[u]) if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
  }
  const finite = dist.filter((d) => d < Infinity);
  const max = Math.max(...finite);
  const nodes = new Float32Array(N * 4);
  proj.forEach((p, i) => {
    // a few are never reached within the scene (arrival > 1)
    const a = dist[i] === Infinity ? 1.4 : (dist[i] / max) * 0.92;
    nodes.set([p.x, p.y, p.s, i === 0 ? -0.1 : a + (r() < 0.1 ? 0.35 : 0)], i * 4);
  });
  return { nodes, seed: [proj[0].x, proj[0].y, proj[0].s] };
}
