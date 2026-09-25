// The light's parameters: one flat vector, so any two states can be interpolated (every change is a
// continuous deformation of the same field). wallTop must stay first: the navigation reads it.

export type Vec = number[];
export interface Params {
  wallTop: Vec; wallMid: Vec; wallBot: Vec;
  horizon: number; horizonSoft: number; horizonGlow: Vec; horizonGlowAmt: number; horizonGlowW: number;
  roomLight: number; vignette: number; grain: number;
  // the volume: its shape, the painted light inside it, the glass body, light added from within
  volC: Vec; volR: Vec; volN: number; volSoft: number; dissolve: number; pour: number;
  paint: number; coreCol: Vec; edgeCol: Vec; coreSize: number; topFade: number;
  volBody: number; glassTint: Vec; litDir: Vec; lit: number; litCol: Vec; sheen: number;
  emitRim: number; rimCol: Vec; ringPos: number; ringW: number; emitCore: number; halo: number; haloCol: Vec;
  beamIn: number; beamInW: number; beamInCol: Vec; beamFrom: number; beamOut: number; beamOutW: number; beamOutCol: Vec;
  // new combinations: two fields of light meeting inside the volume, and what forms between them
  mixAmt: number; mixW: number; mixShift: number; mixAngle: number; mixMid: number; mixL: Vec; mixR: Vec; mixM: Vec;
  // deformation and the cut
  warp: number; warpFreq: number; warpPhase: number; bend: number;
  cutAmt: number; cutAngle: number; cutOffset: number; seam: number;
  // diffusion
  field: number; fieldProg: number; fieldHaze: number;
}
export type State = Partial<Params>;

export const hex = (h: string): Vec => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const DEFAULTS: Params = {
  wallTop: hex('#e9e6e1'), wallMid: hex('#e4e0da'), wallBot: hex('#dcd7d0'),
  horizon: -0.1, horizonSoft: 0.2, horizonGlow: hex('#ffffff'), horizonGlowAmt: 0, horizonGlowW: 0.08,
  roomLight: 0.2, vignette: 0.15, grain: 0.012,
  volC: [0, 0], volR: [0.1, 0.3], volN: 2.6, volSoft: 0.02, dissolve: 0.4, pour: 0,
  paint: 0, coreCol: hex('#ffffff'), edgeCol: hex('#ffffff'), coreSize: 0.95, topFade: 0,
  volBody: 0, glassTint: hex('#ffffff'), litDir: [-1, 0.05], lit: 0, litCol: hex('#ffffff'), sheen: 0,
  emitRim: 0, rimCol: hex('#ffffff'), ringPos: 0.75, ringW: 0.2, emitCore: 0, halo: 0, haloCol: hex('#ffffff'),
  beamIn: 0, beamInW: 0.08, beamInCol: hex('#ffffff'), beamFrom: -2, beamOut: 0, beamOutW: 0.08, beamOutCol: hex('#ffffff'),
  mixAmt: 0, mixW: 0.2, mixShift: 0, mixAngle: 0.35, mixMid: 0, mixL: hex('#ff0000'), mixR: hex('#0000ff'), mixM: hex('#ff00ff'),
  warp: 0, warpFreq: 1.6, warpPhase: 0, bend: 0,
  cutAmt: 0, cutAngle: 1.12, cutOffset: 0, seam: 0,
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
