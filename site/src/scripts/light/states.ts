// Every state the light can be in: a function of local scroll progress p (0..1 through its section) and
// the viewport. Each scene has a field of light at the scale of the room and one precise luminous
// boundary against it. Adjacent states are written to meet, so scrolling is one continuous change.
import { C } from './palette';
import { smooth as sm, lerp, lerpV, clamp, type State, type Vec } from './params';

export interface Env { a: number; m: boolean; ox: number; nodeSeed: [number, number, number] }
export type StateFn = (p: number, e: Env) => State;

export function mixS(a: State, b: State, t: number): State {
  const out: Record<string, unknown> = { ...a };
  for (const k of Object.keys(b) as (keyof State)[]) {
    const va = a[k] as number | Vec | undefined, vb = b[k] as number | Vec;
    if (va === undefined) { out[k] = vb; continue; }
    out[k] = Array.isArray(vb) ? lerpV(va as Vec, vb, t) : lerp(va as number, vb, t);
  }
  return out as State;
}

// the horizon the lights stand on (the same on every page, so the twilight at Contact is the one the
// diffusion scene arrives at)
export const fieldHorizon = (e: { m: boolean }) => (e.m ? 0.1 : -0.16);

// ---------- fields
// the first screen: silver light above, deepening to gold, rising from a razor horizon over black
// ground (Brindle, "Refracting Twilight"; Turrell, "Twilight Epiphany")
const dusk = (e: Env): State => ({
  wallTop: C.silver, wallMid: C.gold, groundTop: C.emberDeep, groundBot: C.night,
  horizon: e.m ? -0.36 : -0.27, horizonSoft: 0,
  glowCol: C.hot, glowAmt: 0.85, glowW: e.m ? 0.1 : 0.13, glowX: e.m ? 0.1 : e.a * 0.5 * 0.45, glowSpread: e.m ? 0.35 : 0.75,
  lineCol: C.goldPale, lineAmt: 0.9, groundGlow: 0.35, roomLight: 0.04, vignette: 0.12, grain: 0.022,
});
// below the horizon: the deep dark with the light far above (the horizon has risen past the top)
const ground = (e: Env): State => ({
  wallTop: C.silver, wallMid: C.gold, groundTop: C.charcoal, groundBot: C.night,
  horizon: 0.56, horizonSoft: 0, glowCol: C.hot, glowAmt: 0.85, glowW: 0.13, glowX: 0, glowSpread: 2,
  lineCol: C.goldPale, lineAmt: 0.9, groundGlow: 0.5, roomLight: 0.02, vignette: 0.2, grain: 0.026,
});
// the night room the ideas happen in: dark sky, a low warm band at the horizon, dark ground
const night = (e: Env, h = fieldHorizon(e)): State => ({
  wallTop: C.night, wallMid: C.emberDeep, groundTop: C.charcoal, groundBot: C.night,
  horizon: h, horizonSoft: 0, glowCol: C.ember, glowAmt: 0.55, glowW: 0.07, glowX: 0, glowSpread: 3,
  lineCol: C.amber, lineAmt: 0.55, groundGlow: 0.25, roomLight: 0.02, vignette: 0.24, grain: 0.028,
});
// silver, for reading (Ando's anodised aluminium): an almost even field
// (the light is the "ground" here, with the horizon above the top of the screen, so arriving from a
// dark scene the silver rises as a band of light)
const silver = (): State => ({
  wallTop: C.silverHi, wallMid: C.silverHi, groundTop: C.silverHi, groundBot: C.silver,
  horizon: 0.62, horizonSoft: 0, glowCol: C.gold, glowAmt: 0, glowW: 0.1, glowX: 0, glowSpread: 3,
  lineCol: C.goldPale, lineAmt: 0, groundGlow: 0, roomLight: 0.03, vignette: 0.08, grain: 0.018,
});
// twilight with every light on (Contact): the diffusion horizon, finished
const twilight = (e: Env): State => ({
  wallTop: e.m ? C.steel : C.steelDark, wallMid: C.goldPale, groundTop: C.emberDeep, groundBot: C.night,
  horizon: fieldHorizon(e), horizonSoft: 0, glowCol: C.amber, glowAmt: 0.9, glowW: e.m ? 0.2 : 0.24, glowX: 0, glowSpread: 1.2,
  lineCol: C.goldPale, lineAmt: 0.8, groundGlow: 0.3, roomLight: 0.02, vignette: 0.14, grain: 0.024,
  field: 1, fieldProg: 1, coreCol: C.gold, haloCol: C.amber,
});

// ---------- the lens (Pashgian): the field seen through it, inverted; a precise frosted rim
const lensLook = (): State => ({
  volN: 2, volSoft: 0, lens: 1, lensMag: 0.75, frost: 0.12, tint: C.silverHi, rimAmt: 0.6, rimLineCol: C.goldPale,
  paint: 0, coreCol: C.amber, edgeCol: C.hot, emitCore: 0, emitRim: 0, halo: 0.35, haloCol: C.amber,
});

// ---------- the ideas, each with its own composition
// I. a lens on the horizon: warm light enters, cool light leaves
function io(p: number, e: Env): State {
  const inn = sm(0.0, 0.4, p), out = sm(0.3, 0.75, p);
  const h = e.m ? 0.12 : -0.04;
  return {
    ...night(e, h), glowAmt: 0.45,
    ...lensLook(), volC: e.m ? [0, 0.16] : [e.a * 0.5 * 0.2, -0.02], volR: e.m ? [0.12, 0.12] : [0.15, 0.15],
    lit: 0.45 * inn, litCol: C.amber, litDir: [-1, 0.05],
    beamIn: 0.5 * inn, beamInW: e.m ? 0.03 : 0.045, beamInCol: C.amber, beamFrom: -2,
    beamOut: 0.45 * out, beamOutW: e.m ? 0.04 : 0.06, beamOutCol: C.coolLight,
  };
}
// II. the lens fills the frame and the light moves inside it: the rim first (execution), then the
// core (planning); what still comes in narrows to a thread
function auto(p: number, e: Env): State {
  const ex = sm(0.05, 0.45, p), pl = sm(0.45, 0.85, p);
  const base = io(1, e);
  const R: Vec = e.m ? [0.15, 0.15] : [0.33, 0.33];
  return {
    ...base,
    volC: e.m ? [0, 0.16] : [e.a * 0.5 * 0.42, 0.02], volR: lerpV(base.volR as Vec, R, sm(0.0, 0.35, p)),
    lit: 0.45 * (1 - ex), frost: lerp(0.12, 0.35, pl),
    emitRim: 0.9 * ex * (1 - 0.6 * pl), rimCol: C.amber, ringPos: lerp(0.9, 0.78, ex), ringW: 0.12,
    emitCore: 0.9 * pl, coreCol: C.amber, halo: lerp(0.35, 0.8, pl), haloCol: C.hot, rimAmt: lerp(0.6, 0.9, ex),
    beamIn: lerp(0.5, 0.3, ex) * (1 - 0.4 * pl), beamInW: lerp(e.m ? 0.03 : 0.045, 0.003, clamp(ex * 0.5 + pl)),
    beamOut: lerp(0.45, 0.6, pl), beamOutCol: lerpV(C.coolLight, C.gold, pl * 0.6),
  };
}
// III. coated planes across a bright field; their arrangement shifts, and where they overlap there
// are colours none of them has (Bell, Alexander, Evertz). The new arrangement is the point.
function combine(p: number, e: Env): State {
  const k = sm(0.0, 0.25, p), re = sm(0.3, 0.9, p);
  const H = e.m ? 0.18 : 0.5, yc = e.m ? 0.2 : 0, x0 = e.m ? -e.a * 0.5 + 0.03 : -0.05, span = e.m ? e.a - 0.06 : e.a * 0.5 - x0 + 0.02;
  // old arrangement: four apart, in order; new: overlapping, re-ordered
  const w = e.m ? 0.045 : span * 0.1;
  const oldX = [0.12, 0.37, 0.62, 0.87].map((t) => x0 + span * t);
  const newX = [0.58, 0.3, 0.72, 0.44].map((t) => x0 + span * t);
  const newW = [1.7, 1.5, 1.2, 1.9];
  const pl = (i: number): Vec => [lerp(oldX[i], newX[i], re), yc, w * lerp(1, newW[i], re), H];
  return {
    wallTop: C.silverHi, wallMid: C.goldPale, groundTop: C.gold, groundBot: C.amber,
    horizon: -0.62, horizonSoft: 0, glowCol: C.gold, glowAmt: 0.3, glowW: 0.5, glowX: 0, glowSpread: 3,
    lineAmt: 0, roomLight: 0.1, vignette: 0.1, grain: 0.022,
    planeAmt: k, plane0: pl(0), plane1: pl(1), plane2: pl(2), plane3: pl(3),
    planeCol0: C.planeEmber, planeCol1: C.planeGreen, planeCol2: C.planeSteel, planeCol3: C.planeAmber, planeRefl: C.filmViolet,
  };
}
// IV. one thin band of light across the whole frame (Brindle's strata) bends without tearing; where
// it cannot bend it is cut, the halves slide along the cut, and it is re-joined
function deform(p: number, e: Env): State {
  const bendK = sm(0.05, 0.5, p), cut = sm(0.52, 0.6, p), rejoin = sm(0.7, 0.9, p);
  const y = e.m ? 0.18 : 0.08;
  return {
    // all ground (the horizon is above the top), so arriving from the bright planes the dark rises
    ...night(e, 0.62), groundTop: C.emberDeep, groundBot: C.night, glowAmt: 0, lineAmt: 0,
    volC: [e.m ? 0 : 0.02, y], volR: [e.a * 0.5 * 0.94, e.m ? 0.012 : 0.009], volN: 8, volSoft: 0,
    paint: 1, coreCol: C.goldPale, edgeCol: C.hot, coreSize: 0.9, emitCore: 0.5, halo: 1.2, haloCol: C.ember, rimAmt: 0,
    warp: 0.0, bend: 0.9 * bendK * (1 - 0.35 * rejoin),
    cutAmt: cut, cutAngle: 1.5708, cutOffset: (e.m ? 0.05 : 0.08) * cut * (1 - rejoin), seam: cut * lerp(1, 0.55, rejoin),
  };
}
// V. lights along the horizon, reached one after another, unevenly; then dawn
function diffuse(p: number, e: Env): State {
  const prog = sm(0.1, 0.92, p);
  return { ...night(e), field: 1, fieldProg: prog, coreCol: C.gold, haloCol: C.amber, glowAmt: lerp(0.35, 0.6, prog) };
}
function dawn(p: number, e: Env): State {
  const k = sm(0.0, 1.0, p);
  return mixS(diffuse(1, e), { ...twilight(e), wallTop: lerpV(C.steelDark, C.steel, 0.3) }, k);
}

// home: one moment carries the thinking. A lens on the horizon ignites from within, flattens into the
// horizon's band, is cut and re-joined, and the light runs out along the horizon as a row of lights.
function moment(p: number, e: Env): State {
  const h = fieldHorizon(e);
  const c: Vec = e.m ? [0, h + 0.02] : [e.a * 0.5 * 0.38, h + 0.02];
  const R0: Vec = e.m ? [0.11, 0.11] : [0.15, 0.15];
  const ex = sm(0.02, 0.2, p), pl = sm(0.18, 0.38, p);
  const flat = sm(0.42, 0.58, p), flatY = sm(0.4, 0.48, p), cut = sm(0.56, 0.62, p), rejoin = sm(0.66, 0.76, p), run = sm(0.74, 0.98, p);
  const band: Vec = [e.a * 0.5 * 0.94, 0.007];
  return {
    ...night(e, h), glowAmt: lerp(0.35, 0.6, run),
    ...lensLook(), volC: lerpV(c, [0, h + 0.004], flat), volR: [lerp(R0[0], band[0], flat), lerp(R0[1], band[1], flatY)], volN: lerp(2, 8, flatY),
    lens: 1 - flat, lit: 0.45 * (1 - ex), litCol: C.amber,
    emitRim: 0.9 * ex * (1 - 0.6 * pl) * (1 - flat), rimCol: C.amber, ringPos: 0.8, ringW: 0.12,
    emitCore: 0.9 * pl * (1 - run), coreCol: C.amber, halo: 0.8 * (1 - run) * (1 - 0.6 * flatY * (1 - flat)), haloCol: C.hot, rimAmt: 0.7 * (1 - flatY),
    paint: flat * (1 - run), edgeCol: C.hot, coreSize: 0.9,
    beamIn: 0.45 * (1 - ex * 0.5) * (1 - pl * 0.6) * (1 - flat), beamInW: lerp(0.04, 0.003, pl), beamInCol: C.amber, beamFrom: -2,
    beamOut: 0.45 * (1 - flat), beamOutW: 0.05, beamOutCol: C.coolLight,
    cutAmt: cut * (1 - run), cutAngle: 1.5708, cutOffset: 0.06 * cut * (1 - rejoin), seam: cut * lerp(1, 0.5, rejoin) * (1 - run),
    field: run, fieldProg: run,
  };
}

// ---------- states by name
export const states: Record<string, StateFn> = {
  // before the light comes up: the same room, dim, with the horizon low
  dark: (p, e) => ({ ...dusk(e), wallTop: [0.74, 0.75, 0.76], wallMid: [0.76, 0.74, 0.71], horizon: -0.5, glowAmt: 0, lineAmt: 0 }),
  hero: (p, e) => dusk(e),
  work: (p, e) => ground(e),
  io, auto, combine, deform, diffuse, dawn, moment,
  research: () => silver(),
  read: () => ({ ...silver(), vignette: 0.05, grain: 0.014 }),
  company: () => silver(),
  contact: (p, e) => twilight(e),
};
