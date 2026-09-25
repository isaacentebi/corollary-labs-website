// The light's parameters: one flat vector, so any two states can be interpolated (every change is a
// continuous deformation of the same field). app.ts reads it to judge the light behind text.

export type Vec = number[];
export interface Params {
  fieldTop: Vec; fieldBot: Vec; fieldGlowCol: Vec; fieldGlowAmt: number; fieldGlowC: Vec; fieldGlowR: Vec;
  vignette: number; grain: number;
  lineX: number; lineTop: number; lineBot: number; lineAmt: number; lineW: number; lineColL: Vec; lineColR: Vec; lineSplitY: number;
  glowUp: Vec; glowDn: Vec; lineGlowAmt: number; lineGlowW: number;
  bend: number; bendPhase: number; cutX: number; cutGap: number; poolAmt: number; weld: number;
  lensC: Vec; lensR: number; lensAmt: number; lensMag: number; menY: number; fillAmt: number; fillCol: Vec;
  lensGlow: number; lensTint: Vec;
  mixAmt: number; blob0: Vec; blob1: Vec; blob2: Vec; blobCol0: Vec; blobCol1: Vec; blobCol2: Vec;
  bandAmt: number; bandProg: number; bandAll: number; bandBase: Vec;
}
export type State = Partial<Params>;

export const hex = (h: string): Vec => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const W = hex('#ffffff');
export const DEFAULTS: Params = {
  fieldTop: hex('#0c1622'), fieldBot: hex('#140f2a'), fieldGlowCol: W, fieldGlowAmt: 0, fieldGlowC: [0, 0], fieldGlowR: [1, 0.5],
  vignette: 0.12, grain: 0.02,
  lineX: 0.3, lineTop: 0.7, lineBot: -0.7, lineAmt: 0, lineW: 1.4, lineColL: W, lineColR: W, lineSplitY: 0,
  glowUp: W, glowDn: W, lineGlowAmt: 0, lineGlowW: 0.12,
  bend: 0, bendPhase: 0.6, cutX: 0, cutGap: 0, poolAmt: 0, weld: 0,
  lensC: [0, 0], lensR: 0.2, lensAmt: 0, lensMag: 0.75, menY: -0.2, fillAmt: 0, fillCol: W, lensGlow: 0, lensTint: W,
  mixAmt: 0, blob0: [0, 0, 0.2, 0.3], blob1: [0, 0, 0.2, 0.3], blob2: [0, 0, 0.2, 0.3], blobCol0: W, blobCol1: W, blobCol2: W,
  bandAmt: 0, bandProg: 0, bandAll: 0, bandBase: hex('#1b1b20'),
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
