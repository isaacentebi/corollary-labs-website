// Shared maths for the needle field: used live on the home instrument (scripts/field.ts)
// and at build time for the static essay figures (components/Figure.astro).
//
// A needle's angle is the direction of a vector: the panel's base flow, plus the
// circulation that each agent sets up around itself once it has entered. Each agent's
// contribution is switched on by a damped step response that travels outward from the
// agent, so needles swing past their new position and settle into a new equilibrium.

export const TAU = Math.PI * 2;

export function rng(seed: number) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export interface FlowParams { phi: number; a1: number; a2: number; ps1: number; ps2: number }

export function flowParams(seed: number, tilt = 0): FlowParams {
  const r = rng(seed * 7919 + 11);
  return { phi: tilt + (r() - 0.5) * 0.5, a1: 0.24 + r() * 0.12, a2: 0.08 + r() * 0.08, ps1: r() * TAU, ps2: r() * TAU };
}

/** Base angle at normalised panel coordinates (u, v in 0..1). */
export function baseAngle(f: FlowParams, u: number, v: number) {
  return f.phi + f.a1 * Math.sin(TAU * (0.55 * u + 0.35 * v) + f.ps1) + f.a2 * Math.sin(TAU * (1.1 * v - 0.4 * u) + f.ps2);
}

/** Circulation around an agent. (dx, dy) in panel-scale units. Writes into out. */
export const SPIRAL = 0.42; // radians of outward lean: circulation that also feeds outward
export const CORE = 0.13;   // radius where the circulation peaks
export const GAIN = 2.3;
export const HOLD = 0.8;  // how much of the old flow gives way near an agent
export function swirl(dx: number, dy: number, out: { x: number; y: number }) {
  const r = Math.hypot(dx, dy);
  if (r < 1e-6) { out.x = 0; out.y = 0; return 0; }
  const q = r / CORE;
  const m = GAIN * q * Math.exp(1 - q);
  const tx = -dy / r, ty = dx / r, rx = dx / r, ry = dy / r;
  const c = Math.cos(SPIRAL), s = Math.sin(SPIRAL);
  out.x = m * (c * tx + s * rx);
  out.y = m * (c * ty + s * ry);
  return m;
}

/** Unit-step response of a damped second-order system, and its rate. */
export function step(t: number, w: number, z: number) {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  const e = Math.exp(-z * w * t);
  return 1 - e * (Math.cos(wd * t) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * t));
}
export function stepRate(t: number, w: number, z: number) {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return (w / Math.sqrt(1 - z * z)) * Math.exp(-z * w * t) * Math.sin(wd * t);
}
