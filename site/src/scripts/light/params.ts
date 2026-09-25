// The light's parameters: one flat vector, so any two states can be interpolated (every change is a
// continuous deformation of the same field). The first four colours are read by the page to decide
// text and navigation tone: wallTop, wallMid, groundTop, groundBot.

export type Vec = number[];
export interface Params {
  wallTop: Vec; wallMid: Vec; groundTop: Vec; groundBot: Vec;
  horizon: number; horizonSoft: number;
  glowCol: Vec; glowAmt: number; glowW: number; glowX: number; glowSpread: number;
  lineCol: Vec; lineAmt: number; groundGlow: number;
  roomLight: number; vignette: number; grain: number;
  volC: Vec; volR: Vec; volN: number; volSoft: number;
  lens: number; lensMag: number; frost: number; tint: Vec; rimAmt: number; rimLineCol: Vec;
  paint: number; coreCol: Vec; edgeCol: Vec; coreSize: number;
  emitCore: number; emitRim: number; ringPos: number; ringW: number; rimCol: Vec;
  halo: number; haloCol: Vec; litDir: Vec; lit: number; litCol: Vec;
  beamIn: number; beamInW: number; beamInCol: Vec; beamFrom: number; beamOut: number; beamOutW: number; beamOutCol: Vec;
  warp: number; warpFreq: number; warpPhase: number; bend: number;
  cutAmt: number; cutAngle: number; cutOffset: number; seam: number;
  planeAmt: number; plane0: Vec; plane1: Vec; plane2: Vec; plane3: Vec;
  planeCol0: Vec; planeCol1: Vec; planeCol2: Vec; planeCol3: Vec; planeRefl: Vec;
  field: number; fieldProg: number;
}
export type State = Partial<Params>;

export const hex = (h: string): Vec => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const W = hex('#ffffff');
export const DEFAULTS: Params = {
  wallTop: hex('#d9dde0'), wallMid: hex('#e4e6e8'), groundTop: hex('#1a1a1e'), groundBot: hex('#0b0b0d'),
  horizon: -0.6, horizonSoft: 0.002,
  glowCol: W, glowAmt: 0, glowW: 0.1, glowX: 0, glowSpread: 3,
  lineCol: W, lineAmt: 0, groundGlow: 0.3,
  roomLight: 0.1, vignette: 0.15, grain: 0.02,
  volC: [0, 0], volR: [0.12, 0.12], volN: 2, volSoft: 0,
  lens: 0, lensMag: 0.7, frost: 0.15, tint: W, rimAmt: 0, rimLineCol: W,
  paint: 0, coreCol: W, edgeCol: W, coreSize: 0.8,
  emitCore: 0, emitRim: 0, ringPos: 0.8, ringW: 0.15, rimCol: W,
  halo: 0, haloCol: W, litDir: [-1, 0.05], lit: 0, litCol: W,
  beamIn: 0, beamInW: 0.06, beamInCol: W, beamFrom: -2, beamOut: 0, beamOutW: 0.07, beamOutCol: W,
  warp: 0, warpFreq: 1.6, warpPhase: 0, bend: 0,
  cutAmt: 0, cutAngle: 1.5708, cutOffset: 0, seam: 0,
  planeAmt: 0, plane0: [0, 0, 0.1, 0.3], plane1: [0, 0, 0.1, 0.3], plane2: [0, 0, 0.1, 0.3], plane3: [0, 0, 0.1, 0.3],
  planeCol0: W, planeCol1: W, planeCol2: W, planeCol3: W, planeRefl: W,
  field: 0, fieldProg: 0,
};

export const KEYS = Object.keys(DEFAULTS) as (keyof Params)[];
export const SIZES = KEYS.map((k) => (Array.isArray(DEFAULTS[k]) ? (DEFAULTS[k] as Vec).length : 1));
export const LENGTH = SIZES.reduce((a, b) => a + b, 0);

export function pack(s: State, out = new Float32Array(LENGTH)): Float32Array {
  let o = 0;
  KEYS.forEach((k, i) => {
    const v = (s[k] ?? DEFAULTS[k]) as number | Vec;
    if (Array.isArray(v)) for (let j = 0; j < SIZES[i]; j++) out[o + j] = v[j];
    else out[o] = v;
    o += SIZES[i];
  });
  return out;
}

export function mixInto(out: Float32Array, a: Float32Array, b: Float32Array, t: number) {
  for (let i = 0; i < out.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpV = (a: Vec, b: Vec, t: number) => a.map((v, i) => v + (b[i] - v) * t);
