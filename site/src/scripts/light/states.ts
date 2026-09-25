// Every state the light can be in. A state is a function of local scroll progress p (0..1 through its
// section) and the viewport. Adjacent states are written to meet, so scrolling is one continuous change.
import { C } from './palette';
import { smooth as sm, lerp, lerpV, clamp, type State, type Vec } from './params';

export interface Env { a: number; m: boolean; ox: number; nodeSeed: [number, number, number]; plate?: boolean }
export type StateFn = (p: number, e: Env) => State;

const mul = (c: Vec, k: number): Vec => c.map((x) => x * k);

// blend two partial states (both are complete enough where it matters)
export function mixS(a: State, b: State, t: number): State {
  const out: Record<string, unknown> = { ...a };
  for (const k of Object.keys(b) as (keyof State)[]) {
    const va = a[k] as number | Vec | undefined, vb = b[k] as number | Vec;
    if (va === undefined) { out[k] = vb; continue; }
    out[k] = Array.isArray(vb) ? lerpV(va as Vec, vb, t) : lerp(va as number, vb, t);
  }
  return out as State;
}

// ---------- rooms (a vertical shift of value; never a line)
const paleRoom = (): State => ({
  wallTop: C.wallHi, wallMid: C.wall, wallBot: C.wallLow, horizon: -0.3, horizonSoft: 0.35,
  horizonGlow: C.white, horizonGlowAmt: 0, horizonGlowW: 0.1, roomLight: 0.06, vignette: 0.1, grain: 0.02,
});
const litRoom = (): State => ({
  wallTop: C.roomHi, wallMid: C.room, wallBot: C.roomLow, horizon: -0.25, horizonSoft: 0.4,
  horizonGlow: C.spill, horizonGlowAmt: 0, horizonGlowW: 0.1, roomLight: 0.12, vignette: 0.18, grain: 0.024,
});
const duskRoom = (e: Env): State => ({
  wallTop: C.duskTop, wallMid: C.duskMid, wallBot: C.duskLow, horizon: -0.4, horizonSoft: 0.16,
  horizonGlow: C.duskGlow, horizonGlowAmt: 0.16, horizonGlowW: 0.1, roomLight: 0.16, vignette: 0.28, grain: 0.03,
  // when the text sits on the left, the incoming light starts beside it, not behind it
  beamFrom: e.ox > 0 ? 0.08 : -2,
});
// phones: high, above the text; beside a text column: low, below the text
export const nightHorizon = (e: { m: boolean; ox: number }) => (e.m ? 0.2 : e.ox > 0 ? -0.12 : 0.02);
const nightRoom = (e: Env): State => ({
  wallTop: C.night, wallMid: C.nightMid, wallBot: C.nightLow, horizon: nightHorizon(e), horizonSoft: 0.1,
  horizonGlow: C.duskGlow, horizonGlowAmt: 0.22, horizonGlowW: 0.09, roomLight: 0.06, vignette: 0.3, grain: 0.03,
});

// ---------- the volume
// the column (Pashgian's columns; Brindle's "Light-Glyph"): light poured in from above, two
// neighbouring hues, no outline; its edge dissolves into the wall
const lit = (frost: Vec = C.frostDusk): State => ({
  volN: 2.5, volSoft: 0.012, dissolve: 0.12, pour: 0.5, topFade: 0.5, coreSize: 0.78,
  paint: 1, coreCol: C.apricot, edgeCol: frost, emitCore: 0.3, halo: 0.5, haloCol: C.spill,
  volBody: 0, emitRim: 0, lit: 0, beamIn: 0, beamOut: 0, mixAmt: 0,
});
const heroC = (e: Env): Vec => (e.plate ? [0, 0] : e.m ? [0, 0.255] : [e.a * 0.5 * 0.44, 0.0]);
const heroR = (e: Env): Vec => (e.plate ? [0.12, 0.36] : e.m ? [0.062, 0.165] : [0.1, 0.31]);
const roomC = (e: Env): Vec => (e.plate ? [0, 0] : e.m ? [0, 0.18] : [e.ox, 0.04]);
const roomR = (e: Env): Vec => (e.plate ? [0.14, 0.33] : e.m ? [0.075, 0.17] : [0.11, 0.27]);
const lensR = (e: Env): Vec => (e.plate ? [0.4, 0.12] : e.m ? [0.17, 0.07] : [0.34, 0.1]);

// ---------- the thinking, one function per idea
function io(p: number, e: Env): State {
  const inn = sm(0.0, 0.4, p), out = sm(0.3, 0.75, p);
  return {
    ...duskRoom(e), ...lit(),
    volC: roomC(e), volR: roomR(e), paint: 0, emitCore: 0, halo: 0.25, haloCol: C.sun,
    volBody: 1, glassTint: C.glass, litDir: [-1, 0.05], lit: 0.5 * inn, litCol: C.sun, sheen: 0.5,
    emitRim: 0.1 * out, rimCol: C.cool, ringPos: 0.82, ringW: 0.2,
    beamIn: 0.5 * inn, beamInW: e.m ? 0.04 : 0.06, beamInCol: C.sun,
    beamOut: 0.45 * out, beamOutW: e.m ? 0.05 : 0.075, beamOutCol: C.cool,
  };
}
// the light moves inside: first at the rim (execution), then the core (planning); the boundary moves
// outward, and what still comes in narrows to a thread (objectives)
function auto(p: number, e: Env): State {
  const ex = sm(0.05, 0.45, p), pl = sm(0.45, 0.85, p);
  const R0 = roomR(e), grow = 1 + 0.16 * pl + 0.05 * ex;
  return {
    ...duskRoom(e), ...lit(),
    volC: roomC(e), volR: [R0[0] * grow, R0[1] * grow],
    volBody: 1 - pl, glassTint: C.glass, litDir: [-1, 0.05], lit: 0.5 * (1 - ex), litCol: C.sun, sheen: 0.5 * (1 - pl),
    paint: pl, emitCore: 0.35 * pl, halo: lerp(0.25, 0.7, ex), haloCol: lerpV(C.sun, C.spill, pl),
    emitRim: lerp(0.1, 0.85, ex) * (1 - 0.7 * pl), rimCol: lerpV(C.cool, C.amber, ex), ringPos: lerp(0.82, 0.72, ex), ringW: 0.18,
    beamIn: lerp(0.5, 0.3, ex) * (1 - 0.4 * pl), beamInW: lerp(e.m ? 0.04 : 0.06, 0.004, clamp(ex * 0.5 + pl)), beamInCol: C.sun,
    beamOut: lerp(0.45, 0.6, pl), beamOutW: e.m ? 0.05 : 0.075, beamOutCol: lerpV(C.cool, C.spill, pl * 0.6),
  };
}
const ignited = (e: Env) => auto(1, e);

// two fields of light enter the same volume and bleed into each other; where they meet, a colour
// neither has, until it fills the interior (Pastine's hues edging into each other; Bell's coated
// planes passing one colour and returning another). No outlines, no additive white.
function combine(p: number, e: Env): State {
  const k = sm(0.02, 0.4, p), grow = sm(0.35, 0.9, p);
  const base = ignited(e);
  return {
    ...base,
    paint: 1 - k, emitCore: base.emitCore! * (1 - k), emitRim: 0,
    beamIn: base.beamIn! * (1 - k), beamOut: base.beamOut! * (1 - k),
    mixAmt: k, mixW: lerp(0.22, 0.95, grow), mixMid: grow, mixShift: lerp(-0.1, 0.05, grow), mixAngle: 0.4,
    mixL: C.rose, mixR: C.blue, mixM: C.violet, haloCol: lerpV(C.spill, C.violet, k), halo: 0.6,
  };
}
const combined = (e: Env) => combine(1, e);

// one form bends into a new shape without tearing; where it cannot bend it is cut, the halves slide
// along a bright seam, and it is re-joined
function deform(p: number, e: Env, from: State): State {
  const gather = sm(0.0, 0.2, p), bendK = sm(0.12, 0.55, p);
  const cut = sm(0.55, 0.64, p), rejoin = sm(0.72, 0.9, p);
  const Ra = from.volR as Vec, Rb = lensR(e);
  const shape: State = {
    volR: lerpV(Ra, Rb, bendK), volN: lerp(2.5, 2.3, bendK), topFade: lerp(0.5, 0.25, bendK), pour: lerp(0.5, 0.2, bendK), coreSize: lerp(0.78, 0.85, bendK),
    warp: 0.16 * bendK, warpFreq: 1.6, warpPhase: 1.2 + p * 2.4, bend: 0.5 * bendK,
    cutAmt: cut, cutAngle: 1.12, cutOffset: (e.m ? 0.05 : 0.09) * cut * (1 - rejoin), seam: cut * lerp(1, 0.5, rejoin),
  };
  const warm: State = { ...duskRoom(e), ...lit(), volC: roomC(e), emitCore: 0.35, halo: 0.7 };
  return { ...mixS(from, warm, gather), ...shape };
}
const deformed = (e: Env, from: State) => deform(1, e, from);

// the firm is one of many: soft lights across a plain, reached from their neighbours, unevenly
function diffuse(p: number, e: Env, from: State): State {
  const back = sm(0.0, 0.3, p), prog = sm(0.2, 0.92, p);
  const night = nightRoom(e);
  return {
    ...mixS(from, night, back),
    paint: 1 - back, emitCore: 0.35 * (1 - back), halo: 0.7 * (1 - back), seam: 0.5 * (1 - back),
    coreCol: C.apricot, haloCol: C.spill,
    field: back, fieldProg: prog, fieldHaze: 1,
  };
}

function dawn(p: number, e: Env): State {
  const night = nightRoom(e);
  const k = sm(0.0, 1.0, p);
  return {
    ...night,
    wallTop: lerpV(night.wallTop!, C.dawnSky, k), wallMid: lerpV(night.wallMid!, C.dawnPale, k), wallBot: lerpV(night.wallBot!, C.dawnLow, k),
    horizon: lerp(night.horizon!, -0.02, k), horizonSoft: 0.1, horizonGlow: lerpV(C.duskGlow, C.dawnAmber, k),
    horizonGlowAmt: lerp(0.22, 0.8, k), horizonGlowW: lerp(0.09, 0.1, k),
    coreCol: C.apricot, haloCol: C.spill, paint: 0, field: 1 - k, fieldProg: 1, fieldHaze: 1,
  };
}

// ---------- states by name
export const states: Record<string, StateFn> = {
  // the room before the light is on (intro)
  dark: (p, e) => ({
    ...litRoom(), ...lit(C.frostDay), volC: heroC(e), volR: heroR(e),
    wallTop: [0.62, 0.61, 0.6], wallMid: [0.58, 0.57, 0.56], wallBot: [0.5, 0.49, 0.48],
    paint: 0.12, coreCol: [0.75, 0.73, 0.72], edgeCol: [0.7, 0.68, 0.68], emitCore: 0, halo: 0,
  }),

  hero: (p, e) => ({ ...litRoom(), ...lit(C.frostDay), volC: heroC(e), volR: heroR(e) }),

  // What we do: the column moves aside (on phones it rises out of the way)
  work: (p, e) => ({
    ...litRoom(), ...lit(C.frostDay),
    volC: e.m ? [0, lerp(0.255, 0.8, sm(0.05, 0.35, p))] : [-e.a * 0.5 * 0.52, 0.0],
    volR: e.m ? [0.062, 0.165] : [0.09, 0.32], coreCol: lerpV(C.apricot, C.sun, sm(0.3, 1, p)),
  }),

  io, auto, combine,
  deform: (p, e) => deform(p, e, combined(e)),
  diffuse: (p, e) => diffuse(p, e, deformed(e, combined(e))),
  dawn,

  // home: one light moment carries the thinking; the ignition flows into the cut, then dawn
  moment: (p, e) => {
    const me: Env = { ...e, ox: e.m ? 0 : e.a * 0.5 * 0.34 };
    let s: State;
    if (p < 0.2) s = io(p / 0.2, me);
    else if (p < 0.52) s = auto((p - 0.2) / 0.32, me);
    else s = deform(Math.min(1, (p - 0.52) / 0.36), me, ignited(me));
    // the evening lifts toward dawn as the moment ends
    const lift = sm(0.9, 1.0, p);
    if (lift > 0) s = mixS(s, { ...dawn(0.85, me), paint: 0, emitCore: 0, halo: 0, seam: 0, field: 0 }, lift);
    return s;
  },

  // Research: pale silver, a faint cool band high up (Brindle, "Distant Light"), no line
  research: () => ({
    ...paleRoom(), wallTop: C.silver, wallMid: C.silver, wallBot: C.silverLow, horizon: 0.3, horizonSoft: 0.3,
    horizonGlow: C.faintBlue, horizonGlowAmt: 0.035, horizonGlowW: 0.12,
  }),

  // Reading and company: almost nothing, so the text is undisturbed
  read: () => ({ ...paleRoom(), roomLight: 0, vignette: 0.06, grain: 0.014 }),
  company: () => ({ ...paleRoom() }),

  // Contact: the whole room is the light (Turrell, "Breathing Light": the hue turns while the value
  // barely moves; one soft brighter band)
  contact: () => ({
    wallTop: C.gPeach, wallMid: C.gApricot, wallBot: C.gRose, horizon: -0.12, horizonSoft: 0.45,
    horizonGlow: [1.0, 0.9, 0.84], horizonGlowAmt: 0.14, horizonGlowW: 0.14,
    roomLight: 0.22, vignette: 0.1, grain: 0.022,
  }),

  // plates: stills from the rooms, for research and team images
  'plate-column': (p, e) => ({ ...litRoom(), ...lit(C.frostDay), volC: heroC(e), volR: heroR(e), vignette: 0.05 }),
  'plate-ignite': (p, e) => ({ ...auto(0.95, e), vignette: 0.05 }),
  'plate-combine': (p, e) => ({ ...combine(0.8, e), vignette: 0.05 }),
  'plate-cut': (p, e) => ({ ...deform(0.63, e, ignited(e)), vignette: 0.05 }),
  'plate-diffuse': (p, e) => ({ ...diffuse(0.75, e, deformed(e, ignited(e))), vignette: 0.05 }),
  'plate-dawn': (p, e) => ({ ...dawn(0.85, e), field: 0, vignette: 0.05 }),
};
