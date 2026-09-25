// The light's parameters: one flat vector, so any two states can be interpolated (every change is a
// continuous deformation of the same field).

export type Vec = number[];
export interface Params {
  wallTop: Vec; wallMid: Vec; wallBot: Vec;
  horizon: number; horizonSoft: number; horizonGlow: Vec; horizonGlowAmt: number; horizonGlowW: number; horizonLine: number;
  roomLight: number; vignette: number; grain: number;
  volC: Vec; volR: Vec; volN: number; volSoft: number; volBody: number; volTint: Vec; paint: number; refl: number;
  litDir: Vec; lit: number; litCol: Vec;
  emitRim: number; emitCore: number; rimCol: Vec; coreCol: Vec; halo: number; haloCol: Vec; sheen: number; ringPos: number; ringW: number; frame: number; frameCol: Vec;
  beamIn: number; beamInW: number; beamInCol: Vec; beamFrom: number; beamOut: number; beamOutW: number; beamOutCol: Vec;
  disc0: Vec; disc1: Vec; disc2: Vec; discCol0: Vec; discCol1: Vec; discCol2: Vec; discAmt: number; discSoft: number;
  warp: number; warpFreq: number; warpPhase: number; bend: number;
  cutAmt: number; cutAngle: number; cutOffset: number; seam: number;
  field: number; fieldProg: number; fieldHaze: number;
}
export type State = Partial<Params>;

export const hex = (h: string): Vec => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const DEFAULTS: Params = {
  wallTop: hex('#e9e6e1'), wallMid: hex('#e4e0da'), wallBot: hex('#dcd7d0'),
  horizon: -0.1, horizonSoft: 0.2, horizonGlow: hex('#ffffff'), horizonGlowAmt: 0, horizonGlowW: 0.05, horizonLine: 0,
  roomLight: 0.2, vignette: 0.15, grain: 0.012,
  volC: [0, 0], volR: [0.2, 0.28], volN: 4, volSoft: 0.04, volBody: 0, volTint: hex('#ffffff'), paint: 0, refl: 0,
  litDir: [-1, 0.2], lit: 0, litCol: hex('#ffffff'),
  emitRim: 0, emitCore: 0, rimCol: hex('#ffffff'), coreCol: hex('#ffffff'), halo: 0, haloCol: hex('#ffffff'), sheen: 0, ringPos: 0.72, ringW: 0.16, frame: 0, frameCol: hex('#b89a6a'),
  beamIn: 0, beamInW: 0.08, beamInCol: hex('#ffffff'), beamFrom: -2, beamOut: 0, beamOutW: 0.08, beamOutCol: hex('#ffffff'),
  disc0: [0, 0, 0.1], disc1: [0, 0, 0.1], disc2: [0, 0, 0.1],
  discCol0: hex('#ff0000'), discCol1: hex('#00ff00'), discCol2: hex('#0000ff'), discAmt: 0, discSoft: 0.06,
  warp: 0, warpFreq: 2.2, warpPhase: 0, bend: 0,
  cutAmt: 0, cutAngle: 0.35, cutOffset: 0, seam: 0,
  field: 0, fieldProg: 0, fieldHaze: 0,
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
