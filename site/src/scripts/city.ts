// Builds the scripted scene: our megastructure (the hero) and the city it sits in.
import { Struct, rng, clamp } from './mega';

const PI = Math.PI;

export function buildHero() {
  const H = new Struct();
  const A = H.core(0, 0, 1.1, 11);
  const B = H.core(10, 0, 1.1, 8.2);
  const Cc = H.core(0, 10, 1.1, 9, 12.4, 0.24, 0.44);
  const D = H.core(10, 10, 1.1, 0, 13.2, 0.22, 0.45);
  H.deferSockets = true;
  // present infrastructure
  H.bridge(A, B, 3);
  H.bridge(A, Cc, 5.5);
  H.beam(Cc, PI, 5.5, 2.5);
  H.beam(A, -PI / 2, 6, 8);
  H.beam(B, 0, 5, 6.5);
  H.beam(B, -PI / 2, 4.5, 2.2);
  H.beam(Cc, PI / 2, 4.5, 6.8);
  // growth
  H.bridge(B, D, 4, 0.36, 0.5);
  H.bridge(Cc, D, 7, 0.4, 0.56);
  H.bridge(A, B, 7.2, 0.46, 0.6);
  H.beam(D, 0, 6, 10, 0.5, 0.64);
  H.beam(D, PI / 2, 5, 8.4, 0.54, 0.68);
  H.beam(Cc, PI / 2, 5, 10.6, 0.56, 0.7);
  H.deferSockets = false;
  H.beams.forEach((_, bi) => H.beamSockets(bi));
  H.coreSockets(A, [0.9, 9.7]);
  H.coreSockets(D, [1.2, 5.6, 11.9]);
  H.coreSockets(B, [1.1]);

  const r = rng(11);
  const shuffle = <T,>(a: T[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // units present at the start (ink)
  const initial = shuffle(H.freeAt(-1));
  const nInk = Math.min(19, Math.floor(initial.length * 0.6));
  initial.slice(0, nInk).forEach((i) => H.place(i));
  const inkCaps = H.caps.slice();

  // wave 1: agents plug into the existing structure
  const w1 = shuffle(H.freeAt(-1));
  // the first agent goes in near the middle of the structure, where it reads at once
  const mid = (i: number) => { const so = H.socks[i]; return (so.x - 5) ** 2 + (so.y - 5) ** 2 + (so.z - 6) ** 2; };
  const first = w1.reduce((b, i) => (mid(i) < mid(b) ? i : b), w1[0]);
  w1.splice(w1.indexOf(first), 1);
  w1.unshift(first);
  // (the first one alone: an agent enters; the rest follow as the structure starts to change)
  for (let k = 0; k < Math.min(6, w1.length - 6); k++) H.plug(w1[k], k === 0 ? 0.03 : 0.2 + k * 0.035, k === 0 ? 0.16 : 0.14);

  // re-seat: some units move out onto the new infrastructure (none leave)
  const movers = shuffle(inkCaps.slice()).slice(0, 5);
  movers.forEach((cap, k) => {
    const t0 = 0.6 + k * 0.045;
    const cand = H.freeAt(t0 + 0.12, (i) => H.sockReady(i) > 0);
    if (cand.length) H.reseat(cap, cand[Math.floor(r() * cand.length)], t0, 0.2);
  });

  // wave 2: agents plug into freed sockets and new infrastructure
  for (let k = 0; k < 13; k++) {
    const t0 = 0.64 + k * 0.02;
    const cand = shuffle(H.freeAt(t0));
    // keep a reserve of never-used sockets for the visitor
    const pick = cand.find((i) => H.sockReady(i) > 0 || H.busy.has(i)) ?? (cand.length > 8 ? cand[0] : undefined);
    if (pick !== undefined) H.plug(pick, t0, 0.11);
  }
  return { H, cores: { A, B, C: Cc, D } };
}

export type Cluster = { S: Struct; T: number; x: number; y: number };
export type NetSeg = { x0: number; y0: number; x1: number; y1: number; d0: number; w: number };

export const SPINE_Y = -13;
export const BRANCH_DX = 44;
export const SPEED = 175; // network distance covered per unit of the city clock
const T0 = 0.1;

// The city: one spine, branches at intervals, a few structures along each branch. The change starts at our
// structure (the one the visitor plugged into) and travels along the network: T = network distance / SPEED.
export function buildCity() {
  const r = rng(29);
  const clusters: Cluster[] = [];
  const branches: { x: number; y0: number; y1: number }[] = [];
  const net: NetSeg[] = [];
  const OUR = 18; // our structure sits 18 up branch 0
  net.push({ x0: 5, y0: SPINE_Y + OUR, x1: 5, y1: SPINE_Y, d0: 0, w: 2 });
  net.push({ x0: 5, y0: SPINE_Y, x1: 5 + 6 * BRANCH_DX, y1: SPINE_Y, d0: OUR, w: 3 });
  net.push({ x0: 5, y0: SPINE_Y, x1: 5 - 6 * BRANCH_DX, y1: SPINE_Y, d0: OUR, w: 3 });
  for (let k = -5; k <= 5; k++) {
    const x = 5 + k * BRANCH_DX;
    for (const side of [1, -1]) {
      const ours = k === 0 && side === 1;
      const L = ours ? 70 : 26 + r() * 60;
      branches.push({ x, y0: SPINE_Y + side * 2.2, y1: SPINE_Y + side * L });
      if (ours) net.push({ x0: 5, y0: SPINE_Y + OUR, x1: 5, y1: SPINE_Y + L, d0: 0, w: 2 });
      else net.push({ x0: x, y0: SPINE_Y, x1: x, y1: SPINE_Y + side * L, d0: OUR + Math.abs(x - 5), w: 2 });
      for (let d = 20; d < L - 5; d += 26) {
        if (ours && d === 20) continue; // ours
        const cy = SPINE_Y + side * d;
        const dist = ours ? Math.abs(d - OUR) : OUR + Math.abs(x - 5) + d;
        const T = T0 + dist / SPEED + (r() - 0.5) * 0.03;
        clusters.push({ S: genCluster(r, x, cy, T), T, x, y: cy });
      }
    }
  }
  return { clusters, branches, net };
}

export const FRONT = (c: number) => (c - T0) * SPEED;

function genCluster(r: () => number, cx: number, cy: number, T: number) {
  const S = new Struct();
  S.alpha = 0.62;
  const type = r();
  const hs = () => 4 + Math.floor(r() * 10);
  const cores: number[] = [];
  if (type < 0.22) {
    cores.push(S.core(cx, cy, 1, hs() + 3));
  } else if (type < 0.55) {
    cores.push(S.core(cx, cy - 4.5, 1, hs()), S.core(cx, cy + 4.5, 1, hs()));
  } else {
    const o = 4;
    cores.push(S.core(cx - o, cy - o, 0.9, hs()), S.core(cx + o, cy - o, 0.9, hs()), S.core(cx - o, cy + o, 0.9, hs()), S.core(cx + o, cy + o, 0.9, hs()));
  }
  const H = (i: number) => S.cores[cores[i]].h0;
  // bridges between neighbouring cores
  for (let i = 0; i < cores.length; i++) for (let j = i + 1; j < cores.length; j++) {
    const a = S.cores[cores[i]], b = S.cores[cores[j]];
    if (Math.abs(a.x - b.x) > 0.1 && Math.abs(a.y - b.y) > 0.1) continue;
    const top = Math.min(H(i), H(j)) - 1.4;
    if (top < 2 || r() < 0.3) continue;
    const z = 1.5 + Math.floor(r() * (top - 1.5));
    S.bridge(cores[i], cores[j], z);
  }
  // cantilevers (tree branches), alternating direction by level
  cores.forEach((ci, i) => {
    let dir = Math.floor(r() * 4);
    for (let z = 2 + r() * 1.5; z < H(i) - 1.2; z += 2.2 + r() * 1.6) {
      const a = (dir * PI) / 2;
      const len = 3 + r() * 3;
      if (r() < 0.6 && S.canBeam(ci, a, len, z)) S.beam(ci, a, len, z);
      dir = (dir + 1 + Math.floor(r() * 2)) % 4;
    }
    if (r() < 0.5) S.coreSockets(ci, [0.8 + Math.floor(r() * 3) * 1.3]);
  });
  // growth when the change arrives: one core extends, one new cantilever
  const gi = Math.floor(r() * cores.length);
  const g = S.cores[cores[gi]];
  g.h1 = g.h0 + 2.5 + r() * 2;
  g.g0 = T;
  g.g1 = T + 0.1;
  for (let tries = 0; tries < 6; tries++) {
    const a = (Math.floor(r() * 4) * PI) / 2;
    const z = g.h0 + 0.4 + r() * (g.h1 - g.h0 - 1.2);
    if (S.canBeam(cores[gi], a, 4, z)) {
      S.beam(cores[gi], a, 4, z, T + 0.06, T + 0.14);
      break;
    }
  }
  // units present
  const free = S.freeAt(-1);
  for (const i of free) if (r() < 0.55) S.place(i);
  // agents plug in when the change arrives
  if (T < 5) {
    const later = S.freeAt(T + 0.2);
    for (const i of later) if (r() < 0.62) S.plug(i, Math.max(T + 0.02 + r() * 0.14, S.sockReady(i) + 0.01), 0.06);
  }
  return S;
}

// small structures at rest, for essay figures and inner pages
export function figureStruct(kind: string) {
  if (kind === 'about') return buildHero().H;
  const seed = { org: 3, gap: 8, dissolve: 21, team: 5, contact: 13 }[kind] ?? 3;
  const r = rng(seed);
  const S = new Struct();
  if (kind === 'gap') {
    const a = S.core(0, 0, 1, 9), b = S.core(9, 0, 1, 7);
    S.bridge(a, b, 2.5); S.bridge(a, b, 5.2);
    S.beam(a, PI / 2, 5, 7.2); S.beam(b, -PI / 2, 4, 4);
  } else if (kind === 'dissolve') {
    const cs = [S.core(0, 0, 0.9, 8), S.core(8, 0, 0.9, 6), S.core(0, 8, 0.9, 10), S.core(8, 8, 0.9, 5)];
    S.bridge(cs[0], cs[1], 3); S.bridge(cs[0], cs[2], 5.5); S.bridge(cs[2], cs[3], 2.4); S.beam(cs[2], PI, 4, 8);
  } else {
    const a = S.core(0, 0, 1.1, 12);
    S.beam(a, 0, 5, 2.5); S.beam(a, PI / 2, 5, 5); S.beam(a, PI, 5, 7.5); S.beam(a, -PI / 2, 5, 10);
  }
  for (const i of S.freeAt(-1)) {
    const x = r();
    if (x < 0.45) S.place(i);
    else if (x < 0.62) S.place(i, true);
  }
  return S;
}

export { clamp };
