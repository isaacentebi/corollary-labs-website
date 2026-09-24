// A small, deterministic input–output economy.
// Slots are firms. 32 are active in the first table A0; 3 of them retire and 3 new ones are born, so 32 are active in A1.
// A[i][j] = what firm j takes from firm i (column j = the inputs of firm j). The diagonal is what a firm supplies to itself.
// Three supplied rows (execution, plans, objectives) are inputs supplied to each firm by people.

export const N = 32;
export const BORN = 3;
export const SLOTS = N + BORN;
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
  A0: Float32Array; A1: Float32Array;      // SLOTS × SLOTS, row-major [i * SLOTS + j]
  L: Float32Array;                          // 3 × SLOTS supplied inputs
  out0: Float32Array; out1: Float32Array;   // output per slot (normalised)
  alive0: Uint8Array; alive1: Uint8Array;
  pos0: Float32Array; pos1: Float32Array;   // display position (0..31 on the grid; ≥ 32 off the edge)
  K: number;                                // the focus firm
  tE: Float32Array; tP: Float32Array;       // diffusion: front value at which execution / plans move inside
  round: Int16Array;
  Fmax: number;
}

function build(r: () => number, group: Int16Array, alive: Uint8Array, prev?: Float32Array, mixPrev = 0) {
  const A = new Float32Array(SLOTS * SLOTS);
  for (let i = 0; i < SLOTS; i++) for (let j = 0; j < SLOTS; j++) {
    if (!alive[i] || !alive[j]) continue;
    let v: number;
    const q = r();
    if (i === j) v = 0.1 + q * 0.14;
    else if (group[i] === group[j]) v = q < 0.18 ? 0 : 0.1 + Math.pow(r(), 1.1) * 0.82;
    else v = q < 0.8 ? 0 : Math.pow(r(), 3) * 0.4;
    if (v < 0.035) v = 0;
    if (prev && mixPrev) v = v * (1 - mixPrev) + prev[i * SLOTS + j] * mixPrev;
    A[i * SLOTS + j] = v;
  }
  return A;
}

export function makeEconomy(seed = 11): Economy {
  const r = rng(seed);
  // sectors of A0 (in slot order: slots 0..31 active, 32..34 not yet born)
  const sizes0 = [7, 5, 6, 4, 5, 5];
  const g0 = new Int16Array(SLOTS).fill(-1);
  let s = 0;
  sizes0.forEach((n, g) => { for (let k = 0; k < n; k++) g0[s++] = g; });
  const alive0 = new Uint8Array(SLOTS); for (let i = 0; i < N; i++) alive0[i] = 1;

  // display order of A0: grouped by sector, lightly shuffled inside each sector
  const ord0 = Array.from({ length: N }, (_, i) => i).sort((a, b) => g0[a] - g0[b] || ((a * 7919) % 13) - ((b * 7919) % 13));
  const pos0 = new Float32Array(SLOTS);
  ord0.forEach((slot, p) => (pos0[slot] = p));
  for (let b = 0; b < BORN; b++) pos0[N + b] = N + 7 + b; // waiting beyond the edge

  const retired = [ord0[4], ord0[13], ord0[27]];

  const alive1 = new Uint8Array(SLOTS);
  for (let i = 0; i < SLOTS; i++) alive1[i] = i >= N ? 1 : retired.includes(i) ? 0 : 1;

  // new sectors for A1: firms regroup (the reorganisation), born firms join
  const g1 = new Int16Array(SLOTS).fill(-1);
  const sizes1 = [11, 4, 9, 8];
  const pool = Array.from({ length: SLOTS }, (_, i) => i).filter((i) => alive1[i]);
  // deterministic shuffle keeping some old neighbours together
  pool.sort((a, b) => ((g0[a] * 5 + (a % 3)) % 7) - ((g0[b] * 5 + (b % 3)) % 7) || a - b);
  s = 0;
  sizes1.forEach((n, g) => { for (let k = 0; k < n && s < pool.length; k++) g1[pool[s++]] = g; });

  const A0 = build(r, g0, alive0);
  // the focus firm: the one in the middle of the table that draws on the most other firms
  let K = ord0[18], best = -1;
  for (let p = 14; p < 24; p++) {
    const j = ord0[p]; if (retired.includes(j)) continue;
    let c = 0; for (let i = 0; i < SLOTS; i++) if (i !== j && A0[i * SLOTS + j] > 0) c++;
    if (c > best) { best = c; K = j; }
  }
  const A1 = build(r, g1, alive1);

  const ord1 = pool.slice().sort((a, b) => g1[a] - g1[b]);
  const pos1 = new Float32Array(SLOTS);
  ord1.forEach((slot, p) => (pos1[slot] = p));
  retired.forEach((slot, k) => (pos1[slot] = N + 7 + k));

  const L = new Float32Array(3 * SLOTS);
  for (let j = 0; j < SLOTS; j++) {
    L[j] = 0.45 + r() * 0.5;
    L[SLOTS + j] = 0.3 + r() * 0.45;
    L[2 * SLOTS + j] = 0.2 + r() * 0.35;
  }
  const out = (A: Float32Array, alive: Uint8Array) => {
    const o = new Float32Array(SLOTS);
    let m = 0;
    for (let i = 0; i < SLOTS; i++) {
      if (!alive[i]) continue;
      let t = 0;
      for (let j = 0; j < SLOTS; j++) t += A[i * SLOTS + j];
      o[i] = t; m = Math.max(m, t);
    }
    for (let i = 0; i < SLOTS; i++) o[i] = o[i] / m;
    return o;
  };

  // diffusion rounds: breadth-first over each firm's three heaviest trading partners in A1
  const round = new Int16Array(SLOTS).fill(-1);
  round[K] = 0;
  let frontier = [K], rd = 0;
  while (frontier.length) {
    rd++;
    const next: number[] = [];
    for (const f of frontier) {
      const nb = pool.filter((x) => x !== f).map((x) => [x, A1[f * SLOTS + x] + A1[x * SLOTS + f]] as const).sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [x] of nb) if (round[x] < 0) { round[x] = rd; next.push(x); }
    }
    frontier = next;
  }
  let maxR = 0;
  for (let i = 0; i < SLOTS; i++) if (round[i] > maxR) maxR = round[i];
  for (let i = 0; i < SLOTS; i++) if (round[i] < 0) round[i] = maxR + 1;
  const tE = new Float32Array(SLOTS), tP = new Float32Array(SLOTS);
  for (let i = 0; i < SLOTS; i++) {
    tE[i] = i === K ? -1 : round[i] + r() * 0.7;
    tP[i] = i === K ? -0.5 : tE[i] + 0.4 + r() * 1.3;   // uneven: some firms move plans inside late or not at all
  }
  return { A0, A1, L, out0: out(A0, alive0), out1: out(A1, alive1), alive0, alive1, pos0, pos1, K, tE, tP, round, Fmax: maxR + 1.1 };
}
