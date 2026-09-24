// A small, deterministic input–output economy of 32 firms, in input coefficients.
// A[i][j] = what firm j takes from firm i per unit of its output. Column j of the table is firm j's inputs.
// The diagonal A[j][j] is what firm j supplies to itself. Three supplied rows (execution, plans, objectives)
// are inputs supplied to each firm by people. Every column sums to exactly 1 (one unit of output):
//   sum_i A[i][j] + E[j] + P[j] + O[j] = 1, in A0 and in A1.
// Firm s has number s + 1 and sits at position s in the first table.

export const N = 32;
export const SUPPLIED = ['Execution', 'Plans', 'Objectives'] as const;

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Economy {
  A0: Float32Array; A1: Float32Array;   // N × N, row-major [i * N + j]
  L: Float32Array;                      // 3 × N supplied coefficients [k * N + j]
  pos1: Float32Array;                   // position of firm s in the reorganised table
  K: number;                            // the focus firm
  round: Int16Array;                    // diffusion round of each firm (-1: not reached)
  edge: Uint8Array;                     // N × N: the link along which the change reached a firm
  tE: Float32Array; tP: Float32Array;   // front value at which execution / plans move inside
  R: number;                            // last round
}

function build(r: () => number, group: Int16Array, pIn: number, pOut: number, L: Float32Array) {
  const W = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const q = r();
      let w = 0;
      if (i === j) w = 0.35 + r() * 0.5;
      else if (group[i] === group[j]) w = q < pIn ? 0.25 + r() * 1.0 : 0;
      else w = q < pOut ? 0.15 + r() * 0.45 : 0;
      W[i * N + j] = w; sum += w;
    }
    const share = 1 - L[j] - L[N + j] - L[2 * N + j];
    for (let i = 0; i < N; i++) W[i * N + j] = (W[i * N + j] / sum) * share;
  }
  return W;
}

function normalise(W: Float32Array, L: Float32Array) {
  // exact three-decimal columns: sum_i W[i][j] + supplied = 1.000
  for (let j = 0; j < N; j++) {
    let s = 0;
    for (let i = 0; i < N; i++) s += Math.round(W[i * N + j] * 1000);
    const sup = Math.round(L[j] * 1000) + Math.round(L[N + j] * 1000) + Math.round(L[2 * N + j] * 1000);
    const diff = 1000 - sup - s;
    W[j * N + j] = (Math.round(W[j * N + j] * 1000) + diff) / 1000;
    for (let i = 0; i < N; i++) if (i !== j) W[i * N + j] = Math.round(W[i * N + j] * 1000) / 1000;
  }
}

export function makeEconomy(seed = 3): Economy {
  const r = rng(seed);
  const L = new Float32Array(3 * N);
  for (let j = 0; j < N; j++) {
    L[j] = Math.round((0.14 + r() * 0.12) * 1000) / 1000;
    L[N + j] = Math.round((0.07 + r() * 0.07) * 1000) / 1000;
    L[2 * N + j] = Math.round((0.03 + r() * 0.04) * 1000) / 1000;
  }

  // first table: old sectors in number order, loosely held (much cross-sector trade)
  const g0 = new Int16Array(N);
  { let s = 0; [7, 5, 6, 4, 5, 5].forEach((n, g) => { for (let k = 0; k < n; k++) g0[s++] = g; }); }
  // second table: new groups that cut across the old sectors, tightly held
  const perm = Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [perm[i], perm[k]] = [perm[k], perm[i]]; }
  const g1 = new Int16Array(N);
  { let s = 0; [9, 7, 8, 8].forEach((n, g) => { for (let k = 0; k < n; k++) g1[perm[s++]] = g; }); }

  const A0 = build(r, g0, 0.5, 0.2, L);
  const A1 = build(r, g1, 0.8, 0.025, L);
  normalise(A0, L); normalise(A1, L);

  const pos1 = new Float32Array(N);
  perm.forEach((s, p) => (pos1[s] = p));

  // focus firm: near the middle of the first table, drawing on many firms
  let K = 16, best = -1;
  for (let j = 12; j < 21; j++) {
    let c = 0; for (let i = 0; i < N; i++) if (i !== j && A0[i * N + j] > 0) c++;
    if (c > best) { best = c; K = j; }
  }

  // diffusion rounds: breadth-first from K along each firm's three heaviest trading links in A1,
  // plus its heaviest link outside its own group (the links that carry a change between groups)
  const strong = new Uint8Array(N * N);
  for (let f = 0; f < N; f++) {
    const all = Array.from({ length: N }, (_, x) => x).filter((x) => x !== f)
      .map((x) => [x, A1[f * N + x] + A1[x * N + f]] as const).sort((a, b) => b[1] - a[1]);
    const nb = all.slice(0, 3);
    const out = all.find(([x, w]) => w > 0 && g1[x] !== g1[f]);
    if (out) nb.push(out);
    for (const [x, w] of nb) if (w > 0) { strong[f * N + x] = 1; strong[x * N + f] = 1; }
  }
  const round = new Int16Array(N).fill(-1);
  const edge = new Uint8Array(N * N);
  round[K] = 0;
  let frontier = [K], rd = 0;
  while (frontier.length) {
    rd++;
    const next: number[] = [];
    for (const f of frontier) for (let x = 0; x < N; x++) {
      if (!strong[f * N + x] || round[x] >= 0) continue;
      round[x] = rd; next.push(x); edge[f * N + x] = 1; edge[x * N + f] = 1;
    }
    frontier = next;
  }
  let R = 0;
  for (let i = 0; i < N; i++) R = Math.max(R, round[i]);
  const tE = new Float32Array(N), tP = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (round[i] < 0) { tE[i] = 99; tP[i] = 99; continue; }
    tE[i] = i === K ? -9 : round[i] - 0.35 + r() * 0.5;
    tP[i] = i === K ? -9 : tE[i] + 0.3 + r() * 1.4;   // uneven: some firms move plans inside late, or not in this table
  }
  return { A0, A1, L, pos1, K, round, edge, tE, tP, R };
}
