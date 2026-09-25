// Every state the light can be in: a function of local scroll progress p (0..1 through its section)
// and the viewport. Everything is frontal: a field, the line (the firm's boundary, vertical), a disc,
// soft fields of light, soft vertical bands. Adjacent states meet, so scrolling is one continuous change.
import { C } from './palette';
import { smooth as sm, lerp, lerpV, type State, type Vec } from './params';

export interface Env { a: number; m: boolean; ox: number }
export type StateFn = (p: number, e: Env) => State;

const half = (e: Env) => e.a * 0.5;
// where the line stands: right of the text on wide screens, centred in the upper part on phones
const LX = (e: Env) => (e.m ? 0 : half(e) * 0.36);
const lineSpan = (e: Env): State => (e.m ? { lineTop: 0.7, lineBot: 0.02 } : { lineTop: 0.7, lineBot: -0.7 });
const discC = (e: Env): Vec => (e.m ? [0, 0.24] : [LX(e), 0.02]);

// ---------- keys
// the first screen: blue-black, one electric band standing in it, glowing blue on one side and
// violet on the other (Ando, "Meditation Blue Black"; Brindle's Portal works)
const abyss = (e: Env): State => {
  const x = e.m ? half(e) * 0.84 : half(e) * 0.46;
  return {
    fieldTop: C.abyss, fieldBot: C.abyssLow, fieldGlowCol: C.bandBlue, fieldGlowAmt: 0.2, fieldGlowC: [x, 0], fieldGlowR: [e.m ? 0.25 : 0.45, 1.1],
    lineX: x, lineTop: 0.7, lineBot: -0.7, lineAmt: 0.95, lineW: 1.6, lineColL: C.bandCore, lineColR: C.bandCore, lineSplitY: 0,
    glowUp: C.bandBlue, glowDn: C.bandViolet, lineGlowAmt: 0.6, lineGlowW: e.m ? 0.05 : 0.08,
    vignette: 0.14, grain: 0.02,
  };
};
// reading surfaces: pale silver-blue, one faint frontal band (Ando, "Hakanai")
const pale = (): State => ({
  fieldTop: C.paleTop, fieldBot: C.paleBot, fieldGlowCol: C.paleGlow, fieldGlowAmt: 0.25, fieldGlowC: [0, 0.18], fieldGlowR: [2, 0.2],
  lineAmt: 0, lineGlowAmt: 0, vignette: 0.06, grain: 0.016,
});

// ---------- the ideas
// I. what comes in (warm, above) and what goes out (cool, below) along the line, through a disc
function io(p: number, e: Env): State {
  const k = sm(0.0, 0.5, p), c = discC(e);
  return {
    fieldTop: C.steel, fieldBot: C.steelLow, fieldGlowCol: C.silverBlue, fieldGlowAmt: 0.14, fieldGlowC: c, fieldGlowR: [0.4, 0.7],
    lineX: LX(e), ...lineSpan(e), lineAmt: 1, lineW: 2.2, lineColL: C.warmIn, lineColR: C.silverCore, lineSplitY: c[1],
    glowUp: C.silverBlue, glowDn: [0.35, 0.42, 0.62], lineGlowAmt: 0.35, lineGlowW: 0.07,
    lensC: c, lensR: e.m ? 0.13 : 0.2, lensAmt: k, lensMag: 0.78, menY: -0.2, fillAmt: 0, fillCol: C.emberFill,
    lensGlow: 0.22, lensTint: C.silverBlue, vignette: 0.14, grain: 0.02,
  };
}
// II. the disc fills with light from below its meniscus; the meniscus rises, first to half
// (execution), then almost to the top (planning). The main event.
function auto(p: number, e: Env): State {
  const ex = sm(0.08, 0.45, p), pl = sm(0.5, 0.88, p), c = discC(e);
  const R = e.m ? 0.17 : 0.3;
  return {
    fieldTop: C.emberBlack, fieldBot: C.emberLow, fieldGlowCol: C.ember, fieldGlowAmt: lerp(0.08, 0.22, pl), fieldGlowC: c, fieldGlowR: [R * 1.8, R * 2.4],
    lineX: LX(e), ...lineSpan(e), lineAmt: 0.85, lineW: 1.5, lineColL: C.emberCore, lineColR: C.emberCore, lineSplitY: 0,
    glowUp: C.ember, glowDn: [0.55, 0.18, 0.12], lineGlowAmt: 0.3, lineGlowW: 0.06,
    lensC: c, lensR: R, lensAmt: 1, lensMag: 0.8,
    menY: lerp(-0.85, lerp(0.0, 0.62, pl), ex), fillAmt: lerp(0.15, 0.95, ex), fillCol: C.emberFill,
    lensGlow: lerp(0.04, 0.28, pl), lensTint: C.emberCore, vignette: 0.16, grain: 0.022,
  };
}
// III. soft fields of light drift into a new overlapping arrangement; overlaps are brighter and a hue
// none of them has (screen)
function combine(p: number, e: Env): State {
  const k = sm(0.0, 0.25, p), re = sm(0.25, 0.85, p);
  const h = half(e);
  const cx = e.m ? 0 : h * 0.34, cy = e.m ? 0.22 : 0;
  const s = e.m ? 0.58 : 1;
  const blob = (a: Vec, b: Vec, rx: number, ry: number): Vec => [cx + lerp(a[0], b[0], re) * s, cy + lerp(a[1], b[1], re) * s, rx * s, ry * s];
  return {
    fieldTop: C.violetDeep, fieldBot: C.violetLow, fieldGlowCol: C.lilac, fieldGlowAmt: 0.06, fieldGlowC: [cx, cy], fieldGlowR: [h, 0.5],
    lineX: LX(e), ...lineSpan(e), lineAmt: 0.2, lineW: 1.2, lineColL: C.lilac, lineColR: C.lilac, glowUp: C.lilac, glowDn: C.rose, lineGlowAmt: 0.06, lineGlowW: 0.06,
    mixAmt: k * 0.62,
    blob0: blob([-0.36, 0.1], [-0.1, 0.05], 0.2, 0.32),
    blob1: blob([0.0, -0.08], [0.1, 0.08], 0.2, 0.3),
    blob2: blob([0.36, 0.06], [-0.02, -0.1], 0.19, 0.29),
    blobCol0: C.lilac, blobCol1: C.rose, blobCol2: C.cyan, vignette: 0.14, grain: 0.022,
  };
}
// IV. the line bends without breaking; then it is cut: a gap opens, light pools at the two ends, the
// ends close, and the join flashes once
function deform(p: number, e: Env): State {
  const b = sm(0.05, 0.4, p), open = sm(0.45, 0.55, p), close = sm(0.66, 0.78, p), w = sm(0.76, 0.8, p) * (1 - sm(0.8, 0.92, p));
  const gap = (e.m ? 0.05 : 0.08) * open * (1 - close);
  return {
    fieldTop: C.smoke, fieldBot: C.smokeLow, fieldGlowCol: C.smokeGlow, fieldGlowAmt: 0.22, fieldGlowC: [LX(e), e.m ? 0.25 : 0], fieldGlowR: [0.5, 1.2],
    lineX: LX(e), ...lineSpan(e), lineAmt: 1, lineW: e.m ? 2.2 : 2.6, lineColL: C.amberCore, lineColR: C.amberCore,
    glowUp: C.amber, glowDn: [0.45, 0.5, 0.2], lineGlowAmt: 0.42, lineGlowW: 0.05,
    bend: b * (1 - 0.4 * close), bendPhase: 0.6,
    cutX: e.m ? 0.26 : 0.04, cutGap: gap, poolAmt: 1.4 * open * (1 - close), weld: 1.6 * w,
    vignette: 0.16, grain: 0.022,
  };
}
// V. soft vertical fields turn colour one after another, outward from the middle, unevenly
function diffuse(p: number, e: Env): State {
  return {
    fieldTop: C.neutral, fieldBot: C.neutral, fieldGlowAmt: 0,
    lineX: LX(e), ...lineSpan(e), lineAmt: 0.5, lineW: 1.3, lineColL: C.bandCore, lineColR: C.bandCore, glowUp: [0.3, 0.3, 0.34], glowDn: [0.3, 0.3, 0.34], lineGlowAmt: 0.1, lineGlowW: 0.05,
    bandAmt: 1, bandProg: sm(0.05, 0.95, p), bandAll: 0, bandBase: C.neutralBand, vignette: 0.12, grain: 0.022,
  };
}
// Contact: the finished field, every band turned
const finished = (e: Env): State => ({ ...diffuse(1, e), bandProg: 1, bandAll: 1, lineAmt: 0.35, lineGlowAmt: 0.1, lineTop: 0.7, lineBot: -0.7 });

// home: one moment carries the thinking. The disc on the line fills (execution, then planning); then
// the disc goes and the line bends, is cut and re-joined.
function moment(p: number, e: Env): State {
  const a = auto(Math.min(1, p / 0.5), e);
  const d = deform(Math.max(0, (p - 0.5) / 0.5), e);
  const t = sm(0.42, 0.56, p);
  return {
    ...a,
    lensAmt: 1 - t,
    bend: d.bend! * t, bendPhase: 0.6, cutX: d.cutX, cutGap: d.cutGap! * t, poolAmt: d.poolAmt! * t, weld: d.weld! * t,
    lineW: lerp(1.5, 2.4, t), lineAmt: lerp(0.85, 1, t), lineColL: lerpV(C.emberCore, C.amberCore, t), lineColR: lerpV(C.emberCore, C.amberCore, t),
  };
}

export const states: Record<string, StateFn> = {
  // before the light comes on: the same blue-black field, the band dark (a Skyspace before the light)
  dark: (p, e) => ({ ...abyss(e), lineAmt: 0, lineGlowAmt: 0, fieldGlowAmt: 0 }),
  hero: (p, e) => abyss(e),
  work: (p, e) => ({ ...abyss(e), lineAmt: 0, lineGlowAmt: 0.1, fieldGlowAmt: 0.08 }),
  io, auto, combine, deform, diffuse, moment,
  research: () => pale(),
  read: () => ({ ...pale(), fieldGlowAmt: 0.15 }),
  company: () => pale(),
  contact: (p, e) => finished(e),
};
