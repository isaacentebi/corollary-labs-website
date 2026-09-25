// Every state the light can be in. A state is a function of local scroll progress p (0..1 through its
// section) and the viewport. Adjacent states are written to meet, so scrolling is one continuous change.
import { C } from './palette';
import { smooth as sm, lerp, lerpV, clamp, type State, type Vec } from './params';

export interface Env { a: number; m: boolean; ox: number; nodeSeed: [number, number, number] }
export type StateFn = (p: number, e: Env) => State;

const grey = (v: number): Vec => [v, v, v];
const mul = (c: Vec, k: number): Vec => c.map((x) => x * k);
const BRASS: Vec = [0.72, 0.6, 0.45];
const CHROME: Vec = [0.8, 0.82, 1];

// ---------- rooms
const dayRoom = (e: Env): State => ({
  wallTop: C.wallHi, wallMid: C.wall, wallBot: C.floor,
  horizon: e.m ? -0.36 : -0.36, horizonSoft: 0.0025,
  horizonGlow: C.white, horizonGlowAmt: 0, horizonGlowW: 0.04, horizonLine: 0,
  roomLight: 0.1, vignette: 0.16, grain: 0.022, refl: 1,
});

const duskRoom = (e: Env): State => ({
  wallTop: C.duskTop, wallMid: C.duskMid, wallBot: C.duskLow,
  horizon: -0.3, horizonSoft: 0.004,
  horizonGlow: C.duskBand, horizonGlowAmt: 0.55, horizonGlowW: 0.035, horizonLine: 0.7,
  roomLight: 0.18, vignette: 0.3, grain: 0.032, refl: 0,
  // when the text sits on the left, the incoming light starts beside it, not behind it
  beamFrom: e.ox > 0 ? 0.05 : -2,
});

// phones: high, above the caption panel; beside a text column: low, below the text
export const nightHorizon = (e: { m: boolean; ox: number }) => (e.m ? 0.22 : e.ox > 0 ? -0.17 : 0.06);

const nightRoom = (e: Env): State => ({
  wallTop: C.night, wallMid: mul(C.duskMid, 0.5), wallBot: mul(C.duskLow, 0.6),
  horizon: nightHorizon(e), horizonSoft: 0.003,
  horizonGlow: C.duskBand, horizonGlowAmt: 0.5, horizonGlowW: 0.05, horizonLine: 0.8,
  roomLight: 0.08, vignette: 0.35, grain: 0.03, refl: 0,
});

// where the thinking rooms put the volume
const roomC = (e: Env): Vec => (e.m ? [0, 0.19] : [e.ox, 0.04]);
const roomR = (e: Env): Vec => (e.m ? [0.12, 0.14] : [0.17, 0.21]);

// The volume as the hero shows it: after Niesche's squircle gradients (core, pale crossing ring, lilac edge)
const heroVolume = (e: Env): State => ({
  volC: e.m ? [0, 0.235] : [e.a * 0.5 * 0.46, 0.03],
  volR: e.m ? [0.11, 0.12] : [0.2, 0.25],
  volN: 3.4, volSoft: 0.006, volBody: 0, paint: 1, volTint: C.lilac,
  lit: 0, emitRim: 0.25, rimCol: C.paleRing, ringPos: 0.66, ringW: 0.15,
  emitCore: 0.55, coreCol: C.core, halo: 0.7, haloCol: C.ring, sheen: 0.25,
  frame: 0.5, frameCol: BRASS,
});

// ---------- states
export const states: Record<string, StateFn> = {
  // the room before the light is on (intro)
  dark: (p, e) => ({
    ...dayRoom(e), ...heroVolume(e),
    wallTop: [0.7, 0.69, 0.68], wallMid: [0.66, 0.65, 0.64], wallBot: [0.56, 0.55, 0.54],
    paint: 0.08, volTint: [0.8, 0.78, 0.84], coreCol: [0.72, 0.7, 0.76], emitRim: 0, emitCore: 0, halo: 0, volBody: 0.35, sheen: 0, frame: 0.6, refl: 0.1,
  }),

  hero: (p, e) => ({ ...dayRoom(e), ...heroVolume(e) }),

  // What we do: the volume stands as a column (Pashgian's columns), the day warms toward evening
  work: (p, e) => {
    const k = sm(0.2, 1, p);
    return {
      ...dayRoom(e),
      wallTop: lerpV(C.wallHi, [0.9, 0.87, 0.88], k), wallMid: lerpV(C.wall, [0.95, 0.85, 0.78], k),
      horizonGlow: C.amber, horizonGlowAmt: 0.22 * k, horizonGlowW: 0.05,
      // on phones the column rises out of the way as the list arrives
      volC: e.m ? [0, lerp(0.25, 0.78, sm(0.12, 0.42, p))] : [-e.a * 0.5 * 0.5 + e.ox, 0.0],
      volR: e.m ? [0.055, 0.12] : [0.085, 0.3],
      volN: 2.6, volSoft: 0.006, volBody: 0, paint: 1, volTint: lerpV(C.lilac, C.ring, k),
      emitRim: 0.25, rimCol: C.paleRing, ringPos: 0.62, ringW: 0.16,
      emitCore: lerp(0.55, 0.8, k), coreCol: lerpV(C.core, C.amber, k), halo: 0.7, haloCol: C.ring, sheen: 0.2,
      frame: 0.4, frameCol: BRASS,
    };
  },

  // I. Inputs and outputs: a translucent volume known only by the light that passes through it
  io: (p, e) => {
    const inn = sm(0.0, 0.35, p), out = sm(0.3, 0.7, p);
    return {
      ...duskRoom(e),
      volC: roomC(e), volR: roomR(e), volN: 3.2, volSoft: 0.008,
      volBody: 1, volTint: [0.62, 0.66, 0.9],
      litDir: [-1, 0.05], lit: 0.55 * inn, litCol: C.sun,
      emitRim: 0.12 * out, rimCol: C.cyan, ringPos: 0.8, ringW: 0.2, emitCore: 0, coreCol: C.sun,
      halo: 0.3, haloCol: C.sun, sheen: 0.6, frame: 0.25, frameCol: CHROME,
      beamIn: 0.55 * inn, beamInW: e.m ? 0.045 : 0.07, beamInCol: C.sun,
      beamOut: 0.5 * out, beamOutW: e.m ? 0.055 : 0.085, beamOutCol: C.cyan,
    };
  },

  // II. Automation: the light moves inside. First the rim (execution), then the core (planning).
  // The boundary moves outward; what still comes in narrows to a thread (objectives).
  auto: (p, e) => {
    const ex = sm(0.05, 0.45, p), pl = sm(0.45, 0.85, p);
    const R0 = roomR(e);
    const grow = 1 + 0.22 * pl + 0.06 * ex;
    return {
      ...duskRoom(e),
      volC: roomC(e), volR: [R0[0] * grow, R0[1] * grow], volN: 3.2, volSoft: 0.008,
      volBody: 1 - pl, paint: pl, volTint: lerpV([0.62, 0.66, 0.9], C.lilac, pl),
      litDir: [-1, 0.05], lit: 0.55 * (1 - ex), litCol: C.sun,
      emitRim: lerp(0.12, 1.0, ex), rimCol: lerpV(C.cyan, C.paleRing, pl), ringPos: lerp(0.8, 0.66, pl), ringW: 0.2,
      emitCore: 1.05 * pl, coreCol: C.core,
      halo: lerp(0.3, 0.8, ex), haloCol: lerpV(C.sun, C.ring, pl), sheen: 0.6, frame: 0.25, frameCol: CHROME,
      beamIn: lerp(0.55, 0.3, ex) * (1 - 0.4 * pl), beamInW: lerp(e.m ? 0.045 : 0.07, 0.005, clamp(ex * 0.5 + pl)), beamInCol: C.sun,
      beamOut: lerp(0.5, 0.75, pl), beamOutW: e.m ? 0.055 : 0.085, beamOutCol: lerpV(C.cyan, C.ring, pl * 0.5),
    };
  },

  // III. New combinations: the volume parts into three translucent panes; they separate (the old
  // arrangement gives way) and settle overlapping in a new one, where colours appear that none had.
  combine: (p, e) => {
    const k = sm(0.02, 0.36, p), apart = sm(0.08, 0.4, p), settle = sm(0.46, 0.82, p);
    const fade = sm(0.0, 0.22, p);
    const c = roomC(e);
    const s = e.m ? 0.55 : 1;
    const R0 = roomR(e);
    const ax = e.m ? 0.62 : 1; // phones: the row of panes stays on screen
    const pane = (a: Vec, b: Vec, r: number): Vec => {
      const x = lerp(0, lerp(a[0] * ax, b[0], settle), apart), y = lerp(0, lerp(a[1], b[1], settle), apart);
      return [c[0] + x * s, c[1] + y * s, lerp(R0[0] * 1.1, r * s, k)];
    };
    return {
      ...duskRoom(e),
      roomLight: 0.1,
      volC: c, volR: [R0[0] * 1.28, R0[1] * 1.28], volN: 3.2, volSoft: 0.008,
      volBody: 0, paint: 1 - fade, volTint: C.lilac,
      emitRim: 1 - fade, rimCol: C.paleRing, ringPos: 0.66, ringW: 0.2,
      emitCore: 1.05 * (1 - fade), coreCol: C.core, halo: 0.8 * (1 - fade), haloCol: C.ring, frame: 0.25 * (1 - fade), frameCol: CHROME,
      beamIn: 0.18 * (1 - fade), beamInW: 0.005, beamInCol: C.sun, beamOut: 0.75 * (1 - fade), beamOutW: 0.085, beamOutCol: C.ring,
      // apart in a row, then a new overlapping arrangement
      disc0: pane([-0.36, 0.0], [-0.1, 0.07], 0.14),
      disc1: pane([0.0, 0.0], [0.07, 0.1], 0.13),
      disc2: pane([0.36, 0.0], [0.0, -0.06], 0.135),
      discCol0: mul(C.magenta, 0.8), discCol1: mul(C.cyan, 0.75), discCol2: mul(C.amber, 0.85),
      discAmt: 0.6 * k * k, discSoft: 0.004,
    };
  },

  // IV. Continuous deformation: one form bends into a new shape without tearing; where it cannot
  // bend it is cut, slides, and is re-joined along a seam.
  deform: (p, e) => {
    const gather = sm(0.0, 0.2, p), bendK = sm(0.12, 0.55, p);
    const cut = sm(0.55, 0.64, p), rejoin = sm(0.72, 0.9, p);
    const c = roomC(e);
    const s = e.m ? 0.55 : 1;
    const Ra: Vec = e.m ? [0.12, 0.14] : [0.17, 0.21];
    const Rb: Vec = e.m ? [0.165, 0.07] : [0.36, 0.1];
    const pane = (dx: number, dy: number, r: number): Vec => [c[0] + dx * s * (1 - gather), c[1] + dy * s * (1 - gather), lerp(r * s, Ra[0], gather)];
    return {
      ...duskRoom(e),
      volC: c, volR: lerpV(Ra, Rb, bendK), volN: lerp(3.2, 2.6, bendK), volSoft: 0.006,
      volBody: 0, paint: gather, volTint: lerpV(C.lilac, [0.55, 0.45, 0.95], bendK),
      emitRim: gather, rimCol: lerpV(C.paleRing, C.cyan, 0.3), ringPos: 0.66, ringW: 0.2,
      emitCore: 0.95 * gather, coreCol: lerpV(C.core, C.magenta, 0.2), halo: 0.75 * gather, haloCol: C.ring,
      sheen: 0.4, frame: 0.25 * gather, frameCol: CHROME,
      disc0: pane(-0.1, 0.07, 0.14), disc1: pane(0.07, 0.1, 0.13), disc2: pane(0.0, -0.06, 0.135),
      discCol0: mul(C.magenta, 0.8), discCol1: mul(C.cyan, 0.75), discCol2: mul(C.amber, 0.85),
      discAmt: 0.6 * (1 - gather), discSoft: 0.004,
      warp: 0.16 * bendK, warpFreq: 1.6, warpPhase: 1.2 + p * 2.4, bend: 0.5 * bendK,
      cutAmt: cut, cutAngle: 1.12, cutOffset: (e.m ? 0.06 : 0.1) * cut * (1 - rejoin), seam: cut * lerp(1, 0.5, rejoin),
    };
  },

  // V. Diffusion: the firm is one of many; light reaches the others from their neighbours, unevenly
  diffuse: (p, e) => {
    const back = sm(0.0, 0.3, p), prog = sm(0.22, 0.92, p);
    const c = roomC(e);
    const Rb: Vec = e.m ? [0.165, 0.07] : [0.36, 0.1];
    const seed = e.nodeSeed;
    const room = duskRoom(e);
    const night = nightRoom(e);
    return {
      ...room,
      wallTop: lerpV(room.wallTop!, night.wallTop!, back), wallMid: lerpV(room.wallMid!, night.wallMid!, back),
      wallBot: lerpV(room.wallBot!, night.wallBot!, back), horizon: lerp(room.horizon!, night.horizon!, back),
      horizonGlowAmt: lerp(0.55, 0.3 + 0.4 * prog, back), horizonLine: lerp(0.7, 0.45 + 0.5 * prog, back),
      volC: lerpV(c, [seed[0], seed[1]], back), volR: lerpV(Rb, [seed[2] * 1.1, seed[2]], back), volN: lerp(2.6, 3.4, back),
      volSoft: 0.006, volBody: 0, paint: 1 - back, volTint: C.lilac,
      emitRim: 1 - back, rimCol: lerpV(C.paleRing, C.cyan, 0.3), ringPos: 0.66, ringW: 0.2,
      emitCore: 0.95 * (1 - back), coreCol: lerpV(C.core, C.magenta, 0.2), halo: 0.75 * (1 - back), haloCol: C.ring,
      warp: 0.16 * (1 - back), warpFreq: 1.6, warpPhase: 3.6, bend: 0.5 * (1 - back),
      cutAmt: 1 - back, cutAngle: 1.12, cutOffset: 0, seam: 0.5 * (1 - back),
      field: back, fieldProg: prog, fieldHaze: 1,
    };
  },

  // Dawn, between the night field and the day: amber over navy with a coral line (Witmer)
  dawn: (p, e) => {
    const night = nightRoom(e);
    const k = sm(0.0, 1.0, p);
    return {
      ...night,
      // blue above, a pale neutral lighter than both at the crossing (Pastine), amber at the horizon
      wallTop: lerpV(night.wallTop!, [0.3, 0.34, 0.66], k), wallMid: lerpV(night.wallMid!, [0.94, 0.9, 0.86], k), wallBot: lerpV(night.wallBot!, C.dawnTop, k),
      horizon: lerp(night.horizon!, -0.02, k), horizonGlow: lerpV(C.duskBand, C.dawnAmber, k), horizonGlowAmt: lerp(0.5, 0.85, k), horizonGlowW: lerp(0.05, 0.1, k), horizonLine: 0.9,
      volC: e.nodeSeed.slice(0, 2), volR: [0.001, 0.001],
      coreCol: lerpV(C.core, C.magenta, 0.2), rimCol: lerpV(C.paleRing, C.cyan, 0.3), haloCol: C.ring,
      field: 1 - k, fieldProg: 1, fieldHaze: 1,
    };
  },

  // Research: a pale field with one thin blue horizon (Brindle, "Distant Light")
  research: (p, e) => ({
    ...dayRoom(e),
    wallTop: [0.925, 0.93, 0.945], wallMid: [0.9, 0.905, 0.92], wallBot: [0.935, 0.935, 0.94],
    horizon: e.m ? 0.3 : 0.26, horizonSoft: 0.0015, horizonGlow: [0.13, 0.28, 0.85], horizonGlowAmt: 0.16, horizonGlowW: 0.018, horizonLine: 0.6,
    volC: [e.ox, 0.3], volR: [0.001, 0.001], roomLight: 0.04, vignette: 0.1, refl: 0,
  }),

  // Reading: almost nothing, so the text is undisturbed
  read: (p, e) => ({
    ...dayRoom(e),
    wallTop: [0.95, 0.948, 0.944], wallMid: [0.945, 0.942, 0.937], wallBot: [0.945, 0.942, 0.937],
    horizon: 0.52, horizonSoft: 0.002, horizonGlow: [0.13, 0.28, 0.85], horizonGlowAmt: 0.05, horizonGlowW: 0.02, horizonLine: 0.25,
    volR: [0.001, 0.001], roomLight: 0, vignette: 0.06, grain: 0.014, refl: 0,
  }),

  // Company: day, a small warm volume
  company: (p, e) => ({
    ...dayRoom(e), ...heroVolume(e),
    volC: e.m ? [0.1, 0.3] : [e.a * 0.5 * 0.56, 0.06], volR: e.m ? [0.07, 0.075] : [0.11, 0.135],
    emitCore: 0.6, sheen: 0.3,
  }),

  // Contact: the whole room is the light (Turrell, "Breathing Light": a frameless field whose hue
  // shifts while its lightness barely moves, with a hotter inner rectangle low in the room)
  // The hue turns (peach → apricot → rose) while the lightness hardly moves; a ghost rectangle a few
  // percent warmer floats low in the field, and one soft band crosses it about 70% of the way down.
  contact: (p, e) => ({
    wallTop: [1.0, 0.83, 0.74], wallMid: [1.0, 0.7, 0.6], wallBot: [0.99, 0.6, 0.62],
    horizon: -0.22, horizonSoft: 0.12, horizonGlow: [1.0, 0.86, 0.8], horizonGlowAmt: 0.12, horizonGlowW: 0.05, horizonLine: 0,
    roomLight: 0.12, vignette: 0.16, grain: 0.028, refl: 0,
    volC: [e.ox, e.m ? -0.02 : -0.03], volR: e.m ? [0.17, 0.26] : [0.52, 0.28], volN: 5, volSoft: 0.05,
    volBody: 0, paint: 0.32, volTint: [1.0, 0.66, 0.6], coreCol: [1.0, 0.56, 0.56], rimCol: [1.0, 0.66, 0.6], ringPos: 0.7, ringW: 0.01,
    emitCore: 0.0, emitRim: 0, halo: 0, haloCol: C.rose, sheen: 0, frame: 0,
  }),
};
