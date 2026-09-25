// Truchet geometry shared by the SVG emblems (build time) and the live field (client).
// A tile has two quarter-circle arcs. Corners c0..c3 = (0,0) (1,0) (1,1) (0,1) in local coords (y down).
// Sides: 0 = y=0, 1 = x=1, 2 = y=1, 3 = x=0. With k quarter-turns (clockwise on screen):
//   arc A is centred on corner k, arc B on corner k+2; the arc on corner c joins sides c and c-1.

export const arcSides = (k: number, arc: 0 | 1): [number, number] => {
  // u=0 end first. Base: A = (0,3), B = (2,1).
  const base: [number, number] = arc === 0 ? [0, 3] : [2, 1];
  return [(base[0] + k) % 4, (base[1] + k) % 4];
};

export function rng(seed: number) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647), (s - 1) / 2147483646);
}

export function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Components of arcs on an n×m open patch. Returns a component id per arc (tile*2+arc) and sizes. */
export function components(n: number, m: number, k: number[]) {
  // node ids: vertical edges V(i,j) i∈[0,n] j∈[0,m) ; horizontal edges H(i,j) i∈[0,n) j∈[0,m]
  const V = (i: number, j: number) => j * (n + 1) + i;
  const H = (i: number, j: number) => (n + 1) * m + j * n + i;
  const side = (i: number, j: number, s: number) => (s === 0 ? H(i, j) : s === 1 ? V(i + 1, j) : s === 2 ? H(i, j + 1) : V(i, j));
  const parent = Array.from({ length: (n + 1) * m + n * (m + 1) }, (_, i) => i);
  const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const arcNode: number[] = [];
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const t = j * n + i;
    for (const a of [0, 1] as const) {
      const [s0, s1] = arcSides(k[t], a);
      const n0 = side(i, j, s0), n1 = side(i, j, s1);
      parent[find(n0)] = find(n1);
      arcNode[t * 2 + a] = n0;
    }
  }
  const comp = arcNode.map((nd) => find(nd));
  const size = new Map<number, number>();
  comp.forEach((c) => size.set(c, (size.get(c) || 0) + 1));
  return { comp, size };
}

/** SVG markup for an n×n emblem seeded by a string. The longest loop is drawn in the accent. */
export function emblem(seed: string, n = 3, opts: { stroke?: number; size?: number } = {}) {
  // only layouts whose accent loop closes inside the patch: try seeded variants, keep the largest closed loop
  const h = hash(seed), r = rng(h);
  // aim for a loop length chosen by the seed, so emblems differ from each other
  const want = n <= 2 ? 4 : n === 3 ? [4, 6, 8][h % 3] : n === 4 ? [8, 10, 12][h % 3] : 16;
  let k: number[] = [], comp: number[] = [], best = -1, bestSize = 0;
  for (let attempt = 0; attempt < 2000 && bestSize < want; attempt++) {
    const kk = Array.from({ length: n * n }, () => Math.floor(r() * 4));
    const res = components(n, n, kk);
    // a component is closed if none of its arcs ends on the patch border
    const open = new Set<number>();
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const t = j * n + i;
      for (const a of [0, 1] as const) for (const s of arcSides(kk[t], a)) {
        const border = (s === 0 && j === 0) || (s === 2 && j === n - 1) || (s === 3 && i === 0) || (s === 1 && i === n - 1);
        if (border) open.add(res.comp[t * 2 + a]);
      }
    }
    for (const [c, s] of res.size) if (!open.has(c) && s > bestSize && (bestSize < want)) { bestSize = s; best = c; k = kk; comp = res.comp; }
  }
  if (best < 0) { k = Array.from({ length: n * n }, (_, t) => (t % n + Math.floor(t / n)) % 2 ? 1 : 0); comp = components(n, n, k).comp; best = -2; }
  const S = opts.size ?? 100, w = opts.stroke ?? 0.16;
  let d0 = '', d1 = '';
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const t = j * n + i, x = i * S, y = j * S, h = S / 2;
    // corner centre for arc A and B after k turns
    const corners = [[x, y], [x + S, y], [x + S, y + S], [x, y + S]];
    for (const a of [0, 1] as const) {
      const c = corners[(k[t] + (a ? 2 : 0)) % 4];
      // endpoints: midpoints of the two sides meeting at the corner
      const cx = c[0], cy = c[1];
      const px = cx === x ? x + h : x + h, py = cy; // point on horizontal side
      const qx = cx, qy = y + h; // point on vertical side
      const sweep = (cx === x) === (cy === y) ? 1 : 0;
      const seg = `M${px} ${py}A${h} ${h} 0 0 ${sweep} ${qx} ${qy}`;
      if (comp[t * 2 + a] === best) d1 += seg; else d0 += seg;
    }
  }
  const W = n * S;
  return `<svg class="emblem" viewBox="${-S * w} ${-S * w} ${W + 2 * S * w} ${W + 2 * S * w}" aria-hidden="true"><path class="emblem__base" d="${d0}" stroke-width="${S * w}"/><path class="emblem__loop" d="${d1}" stroke-width="${S * w}"/></svg>`;
}
