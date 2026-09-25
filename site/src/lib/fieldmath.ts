// Shared maths for the gauge field: used live by every face (scripts/field/scene.ts)
// and at build time for the static essay figures (components/Figure.astro).
//
// A needle's angle is the direction of a vector: the panel's base flow, plus the
// circulation an agent sets up around itself once it has entered. Each agent's
// contribution is switched on by a damped step response that travels outward from it,
// so needles swing past their new position and settle into a new equilibrium.

export const TAU = Math.PI * 2;

export function rng(seed: number) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export interface FlowParams { phi: number; a1: number; a2: number; ps1: number; ps2: number }

export function flowParams(seed: number, tilt = 0): FlowParams {
  const r = rng(seed * 7919 + 11);
  return { phi: tilt + (r() - 0.5) * 0.4, a1: 0.22 + r() * 0.12, a2: 0.07 + r() * 0.08, ps1: r() * TAU, ps2: r() * TAU };
}

/** Base angle at normalised panel coordinates (u, v in 0..1). */
export function baseAngle(f: FlowParams, u: number, v: number) {
  return f.phi + f.a1 * Math.sin(TAU * (0.55 * u + 0.35 * v) + f.ps1) + f.a2 * Math.sin(TAU * (1.1 * v - 0.4 * u) + f.ps2);
}

/** How an agent reshapes the flow around it. Each organisation answers differently. */
export interface Response { hand: number; spiral: number; gain: number; core: number }
export const DEFAULT_RESPONSE: Response = { hand: 1, spiral: 0.42, gain: 2.3, core: 0.13 };
export const HOLD = 0.8; // how much of the old flow gives way near an agent

/** Circulation around an agent. (dx, dy) in panel-scale units. Writes into out; returns magnitude. */
export function swirl(dx: number, dy: number, out: { x: number; y: number }, r: Response = DEFAULT_RESPONSE) {
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) { out.x = 0; out.y = 0; return 0; }
  const q = d / r.core;
  const m = r.gain * q * Math.exp(1 - q);
  const tx = (-dy / d) * r.hand, ty = (dx / d) * r.hand, rx = dx / d, ry = dy / d;
  const c = Math.cos(r.spiral), s = Math.sin(r.spiral);
  out.x = m * (c * tx + s * rx);
  out.y = m * (c * ty + s * ry);
  return m;
}
export const holdAt = (d: number, core = 0.13) => HOLD * Math.exp(-((d / (core * 2.45)) ** 2));

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
/** Impulse response, normalised to a peak of about 1: a disturbance that is absorbed. */
export function impulse(t: number, w: number, z: number) {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return Math.exp(-z * w * t) * Math.sin(wd * t);
}
