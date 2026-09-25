// Soft physics for the stones: each one follows a target with a gentle, slightly underdamped spring,
// and neighbours push each other apart so a cluster re-packs instead of overlapping.
import type { StoneState } from './ground';

export type Stone = StoneState & {
  id: string;
  vx: number; vy: number;
  tx: number; ty: number;       // target position
  tr: number; tlift: number; trose: number; tk: number;
  solid: boolean;               // takes part in packing
};

let uid = 0;
export function stone(o: Partial<Stone> & { x: number; y: number; r: number }): Stone {
  const s: Stone = {
    id: o.id ?? `s${uid++}`,
    x: o.x, y: o.y, r: o.r,
    aspect: o.aspect ?? 1, rot: o.rot ?? 0, k: o.k ?? 1.9, rose: o.rose ?? 0, lift: o.lift ?? 0, seed: o.seed ?? Math.random(),
    vx: 0, vy: 0, tx: o.tx ?? o.x, ty: o.ty ?? o.y,
    tr: o.tr ?? o.r, tlift: o.tlift ?? 1, trose: o.trose ?? o.rose ?? 0, tk: o.tk ?? o.k ?? 1.9,
    solid: o.solid ?? true,
  };
  return s;
}

const approach = (v: number, t: number, rate: number, dt: number) => v + (t - v) * (1 - Math.exp(-rate * dt));

export function step(stones: Stone[], dt: number, opts: { stiff?: number; damp?: number; instant?: boolean; gap?: number } = {}) {
  const stiff = opts.stiff ?? 26, damp = opts.damp ?? 8.5, gap = opts.gap ?? 10;
  if (opts.instant) {
    for (const s of stones) { s.x = s.tx; s.y = s.ty; s.vx = s.vy = 0; s.r = s.tr; s.lift = s.tlift; s.rose = s.trose; s.k = s.tk; }
    return;
  }
  dt = Math.min(dt, 1 / 30);
  for (const s of stones) {
    s.vx += ((s.tx - s.x) * stiff - s.vx * damp) * dt;
    s.vy += ((s.ty - s.y) * stiff - s.vy * damp) * dt;
    s.r = approach(s.r, s.tr, 5, dt);
    s.lift = approach(s.lift, s.tlift, 3.2, dt);
    s.rose = approach(s.rose, s.trose, 2.4, dt);
    s.k = approach(s.k, s.tk, 3, dt);
  }
  // soft packing
  for (let i = 0; i < stones.length; i++) {
    const a = stones[i]; if (!a.solid || a.lift < 0.3) continue;
    for (let j = i + 1; j < stones.length; j++) {
      const b = stones[j]; if (!b.solid || b.lift < 0.3) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
      const min = (a.r * Math.max(a.aspect, 1 / a.aspect) * 0.92 + b.r * Math.max(b.aspect, 1 / b.aspect) * 0.92) + gap;
      if (d < min) {
        const push = (min - d) * 30 * dt, nx = dx / d, ny = dy / d;
        const wa = b.r / (a.r + b.r), wb = 1 - wa;
        a.vx -= nx * push * wa * 6; a.vy -= ny * push * wa * 6;
        b.vx += nx * push * wb * 6; b.vy += ny * push * wb * 6;
      }
    }
  }
  for (const s of stones) { s.x += s.vx * dt; s.y += s.vy * dt; }
}

// deterministic random
export function rng(seed: number) {
  let s = (seed * 16807) % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
