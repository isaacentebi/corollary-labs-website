// Tektonik — the home story, drawn on one canvas.
// A · a flat composition of planes in tension, the name set on its axis.
// B · an agent crosses the grain and strikes; each plane cracks along cuts it always had, and the pieces
//     are thrown along the agent's vector.
// C · the same pieces, none removed, turn into a spatial construction around the agent — one continuous,
//     scrubbed move.
// D · the camera pulls back and tilts the world: other compositions float in a fan, still flat. The change
//     reaches them as bending — whole at the first step, weaker at each step after. Click a flat one and an
//     agent enters it; the change spreads from there.
// Flat, art-directed colour per face (no lighting), hairline edges; orthographic → light perspective.
// Renders on demand only: scroll, pointer, and time-bound transitions request frames; idle = no frames.
import {
  type V3, type Q, v, add, sub, scale, len, norm, lerp, lerp3, clamp, smooth, easeOut3, easeInOut3, easeOutExpo, easeIn2,
  qMul, qX, qY, qZ, qConj, qRot, qSlerp, qAxis, qLook, qId, rng,
} from './math3';
import {
  buildComposition, place, type Parent, type Frag, type Pose, type Mat,
  IMPACT, AGENT_START_L, AGENT_START_P, AGENT_H, AGENT_C,
} from './compose';

// ---------- materials: one colour per face, chosen, not lit ----------
type Face = 'f' | 'b' | 'y' | 'x';
const hex = (h: string): V3 => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const MAT: Record<Mat, Record<Face, V3> & { line: string; crack: string }> = {
  chalk: { f: hex('#ece9e0'), b: hex('#d3cec1'), y: hex('#b8b1a1'), x: hex('#878ea6'), line: 'rgba(12,17,40,0.34)', crack: 'rgba(12,17,40,0.9)' },
  haze: { f: hex('#a8b2cc'), b: hex('#8f99b4'), y: hex('#d7dbe5'), x: hex('#666f8e'), line: 'rgba(12,17,40,0.32)', crack: 'rgba(12,17,40,0.85)' },
  pewter: { f: hex('#6c7594'), b: hex('#5a627f'), y: hex('#a3adc7'), x: hex('#434b6b'), line: 'rgba(236,233,224,0.2)', crack: 'rgba(12,17,40,0.9)' },
  slate: { f: hex('#27315c'), b: hex('#20284f'), y: hex('#46528c'), x: hex('#181f45'), line: 'rgba(168,178,204,0.34)', crack: 'rgba(168,178,204,0.7)' },
  graphite: { f: hex('#060913'), b: hex('#0a0e1e'), y: hex('#394578'), x: hex('#131a39'), line: 'rgba(168,178,204,0.62)', crack: 'rgba(168,178,204,0.8)' },
  cad: { f: hex('#f7c910'), b: hex('#e2b50b'), y: hex('#ffe27a'), x: hex('#c89905'), line: 'rgba(12,17,40,0.25)', crack: 'rgba(12,17,40,0.3)' },
};
const GROUND: V3 = [12, 17, 40];
const FACES: [number, number, number[], Face][] = [
  // axis (0=x,1=y,2=z), sign, corner indices (bit0=x, bit1=y, bit2=z), colour slot
  [0, 1, [1, 3, 7, 5], 'x'], [0, -1, [0, 4, 6, 2], 'x'],
  [1, 1, [2, 6, 7, 3], 'y'], [1, -1, [0, 1, 5, 4], 'y'],
  [2, 1, [4, 5, 7, 6], 'f'], [2, -1, [0, 2, 3, 1], 'b'],
];

// ---------- timeline (scroll progress p ∈ [0,1]) ----------
const T = { depart: 0.05, strike: 0.2, build0: 0.22, build1: 0.66, pull0: 0.68, field: 0.82, wave0: 0.84, step: 0.052, waveDur: 0.07 };
const FINAL = { pitch: 0.46, yaw: -0.96, roll: 0.19, invD: 1 / 12 };
const STOPS_RM = [0, 0.42, T.build1, 1];

const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
const bez = (a: V3, c: V3, b: V3, t: number): V3 => {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], u * u * a[2] + 2 * u * t * c[2] + t * t * b[2]];
};
const qBez = (a: Q, c: Q, b: Q, t: number) => qSlerp(qSlerp(a, c, t), qSlerp(c, b, t), t);
/** scene progress of the first composition (0 = picture, 1 = construction) */
const buildS = (p: number) => clamp((p - T.build0) / (T.build1 - T.build0));

interface WFrag extends Frag { ctrl: V3; qc: Q }
interface WParent extends Parent { frags: WFrag[] }
interface Node {
  primary: boolean; parents: WParent[]; pos: V3; k: number; ring: number;
  sScroll: number; s: number; lvl: { from: number; to: number; t0: number; dur: number };
  agent: { t0: number; start: V3; impact: V3; C: Pose } | null;
  sx: number; sy: number; sr: number; hov: number; qA: Q; qC: Q;
}

export interface TkOptions {
  /** text printed on the dominant plane */
  name?: string;
  /** the pulled-back field of other compositions (home only) */
  field?: boolean;
  /** page mode: scroll drives only the strike and the rebuild */
  page?: boolean;
  variant?: number;
  slabH?: number;
}

export function mountTektonik(stage: HTMLElement, track: HTMLElement, opts: TkOptions = {}) {
  const FIELD = opts.field !== false;
  const PAGE = !!opts.page;
  const canvas = stage.querySelector<HTMLCanvasElement>('canvas[data-tektonik]')!;
  const ctx = canvas.getContext('2d')!;
  const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

  let W = 0, H = 0, dpr = 1, S = 1, zD = 0.3, portrait = false;
  let nodes: Node[] = [];
  let adj: number[][] = [];
  let agentStart = AGENT_START_L;
  let qFace: Q = qId();
  let tgtField: V3 = v();
  let nameK = 0; // world units per text pixel for the name
  const NAME = opts.name ?? 'Corollary Labs';
  // long names set in two lines, balanced on the space nearest the middle
  const LINES = (() => {
    if (NAME.length <= 16) return [NAME];
    const mid = NAME.length / 2;
    let best = -1;
    for (let i = 0; i < NAME.length; i++) if (NAME[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    return best < 0 ? [NAME] : [NAME.slice(0, best), NAME.slice(best + 1)];
  })();
  let nameLead = 0; // line advance in text px
  let tPrimaryDir: V3 = v(1, 0, 0);

  // ---------- scene ----------
  const toWorld = (parents: Parent[], pos: V3, qA: Q, qC: Q, k: number, gentle: boolean): WParent[] =>
    parents.map((pa) => ({
      ...pa,
      h: scale(pa.h, k),
      A: place(pa.A, pos, qA, k),
      cuts: pa.cuts.map((c) => c * k),
      frags: pa.frags.map((f) => {
        const A = place(f.A, pos, qA, k), B = place(f.B, pos, qA, k), C = place(f.C, pos, qC, k);
        const mid = scale(add(A.p, C.p), 0.5);
        const through = sub(scale(B.p, 2), mid); // control point that makes the path pass through B
        // field compositions never pass through the scatter: they lift straight into their own construction
        const ctrl = gentle ? add(mid, scale(sub(qRot(qA, v(0, 0, 1)), v(0, 0, 0)), 0.12 * k)) : through;
        const qc = gentle ? qSlerp(A.q, C.q, 0.5) : B.q;
        return { ...f, h: scale(f.h, k), A, B, C, ctrl, qc };
      }),
    }));

  const build = () => {
    portrait = W < H * 0.9;
    agentStart = portrait ? AGENT_START_P : AGENT_START_L;
    tPrimaryDir = norm(sub(IMPACT, agentStart));
    const base = buildComposition(agentStart, 7, { variant: opts.variant, slabH: opts.slabH });
    const qFinal = qMul(qZ(FINAL.roll), qMul(qX(FINAL.pitch), qY(FINAL.yaw)));
    qFace = qConj(qFinal);
    const Y0 = portrait ? 3.1 : 1.55;
    tgtField = qRot(qFace, v(0, Y0, 0));
    const halfW = portrait ? 2.9 : 5.0;
    zD = W / 2 / (S * halfW);

    nodes = [{
      primary: true, parents: toWorld(base, v(), qId(), qId(), 1, false), pos: v(), k: 1, ring: 0,
      sScroll: 0, s: 0, lvl: { from: 0, to: 0, t0: 0, dur: 1 }, agent: null, sx: 0, sy: 0, sr: 0, hov: 0, qA: qId(), qC: qId(),
    }];
    // the fan: positions in the final view (x right, y up, z toward the viewer), relative to the camera target
    const L = [
      { v: v(-1.2, 1.1, -0.7), roll: 0.25, k: 0.74 }, { v: v(-2.85, 0.75, -1.5), roll: 0.62, k: 0.66 }, { v: v(-3.85, -0.75, -2.3), roll: 0.98, k: 0.6 },
      { v: v(1.27, 0.9, -0.7), roll: -0.22, k: 0.74 }, { v: v(2.9, 0.5, -1.5), roll: -0.6, k: 0.66 }, { v: v(3.85, -1.0, -2.3), roll: -0.95, k: 0.6 },
    ];
    const P = [
      { v: v(-0.95, -0.35, -0.7), roll: 0.2, k: 0.7 }, { v: v(-1.2, 2.05, -1.5), roll: 0.42, k: 0.64 }, { v: v(-0.55, 4.3, -2.3), roll: 0.6, k: 0.58 },
      { v: v(1.0, -0.85, -0.7), roll: -0.18, k: 0.7 }, { v: v(1.25, 1.55, -1.5), roll: -0.4, k: 0.64 }, { v: v(0.75, 3.8, -2.3), roll: -0.62, k: 0.58 },
    ];
    const R = rng(31);
    if (!FIELD) { adj = [[]]; return; }
    (portrait ? P : L).forEach((d, i) => {
      const pos = add(tgtField, qRot(qFace, d.v));
      const qA = qMul(qFace, qZ(d.roll));
      const qC = qMul(qAxis(v(R() - 0.5, 0, R() - 0.5), (R() - 0.5) * 0.6), qY(R() * Math.PI * 2));
      nodes.push({
        primary: false, parents: toWorld(base, pos, qA, qC, d.k, true), pos, k: d.k, ring: (i % 3) + 1,
        sScroll: 0, s: 0, lvl: { from: 0, to: 0, t0: 0, dur: 1 }, agent: null, sx: 0, sy: 0, sr: 0, hov: 0, qA, qC,
      });
    });
    // chain: 0–1–2–3 and 0–4–5–6, the two first steps also touch
    adj = [[1, 4], [0, 2, 4], [1, 3], [2], [0, 5, 1], [4, 6], [5]];
  };

  // ---------- state ----------
  let pT = 0, p = 0, exitT = 0;
  let px = 0, py = 0, pxT = 0, pyT = 0, hov = 0, hovT = 0, mx = -1e4, my = -1e4;
  let introT0 = -1;
  const pulses: { t0: number; x: number; y: number }[] = [];
  let running = false, visible = true, lastState = -1, hoverNode = -1;

  const measure = () => {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const port = W < H * 0.9;
    S = port ? Math.min(W * 0.63, H * 0.36) : Math.min(W * 0.36, H * 0.5);
    build();
    measureName();
  };
  const setNameFont = () => {
    ctx.font = '800 100px "Archivo Variable", "Archivo", sans-serif';
    const c = ctx as CanvasRenderingContext2D & { fontStretch?: string; letterSpacing?: string };
    if ('fontStretch' in c) c.fontStretch = 'expanded';
    if ('letterSpacing' in c) c.letterSpacing = '-3px';
  };
  const measureName = () => {
    setNameFont();
    const m = Math.max(...LINES.map((l) => ctx.measureText(l).width)) || 1;
    const pa = nodes[0].parents[0];
    nameLead = 96;
    const byW = (pa.h[0] * 2 * 0.86) / m;
    const byH = (pa.h[1] * 2 * (LINES.length > 1 ? 0.8 : 0.6)) / (72 + nameLead * (LINES.length - 1));
    nameK = Math.min(byW, byH);
  };

  const readScroll = () => {
    const r = track.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    const raw = span > 0 ? clamp(-r.top / span) : 0;
    exitT = span > 0 ? clamp((-r.top - span) / (window.innerHeight * 0.6)) : 0;
    if (PAGE) pT = rm ? 0 : T.build1 * clamp((raw - 0.03) / 0.9);
    else if (rm) { let best = 0; for (const st of STOPS_RM) if (raw >= st - 0.12) best = st; pT = best; }
    else pT = raw;
  };

  // ---------- camera ----------
  const KEYS = () => [
    [0, 0, 0, 0, 0, 0, 0],
    [T.strike, 0.0, -0.03, Math.log(1.0), 0, 0, 0],
    [0.44, 0.26, -0.34, Math.log(portrait ? 0.77 : 0.97), 0, 0, 0],
    [T.build1, 0.5, -0.72, Math.log(portrait ? 0.66 : 1.0), 0, 0, 0],
    [T.field, FINAL.pitch, FINAL.yaw, Math.log(zD), FINAL.roll, FINAL.invD, 1],
    [1, FINAL.pitch + 0.02, FINAL.yaw - 0.05, Math.log(zD * 1.03), FINAL.roll, FINAL.invD, 1],
  ];
  const camera = (pp: number) => {
    const K = KEYS();
    let i = 0;
    while (i < K.length - 2 && pp > K[i + 1][0]) i++;
    const k0 = K[Math.max(0, i - 1)], k1 = K[i], k2 = K[i + 1], k3 = K[Math.min(K.length - 1, i + 2)];
    const t = clamp((pp - k1[0]) / (k2[0] - k1[0]));
    const te = smooth(t) * 0.6 + t * 0.4;
    const lin = (j: number) => lerp(k1[j], k2[j], smooth(t));
    return {
      pitch: cr(k0[1], k1[1], k2[1], k3[1], te), yaw: cr(k0[2], k1[2], k2[2], k3[2], te),
      zoom: Math.exp(lin(3)), roll: lin(4), invD: lin(5), tmix: lin(6),
    };
  };

  // ---------- projection ----------
  let qV = qId(), qS = qId(), tgt = v(), Z = 1, cx = 0, cy = 0, invD = 0;
  const persp = (z: number) => (invD > 0 ? 1 / Math.max(0.15, 1 - z * invD) : 1);
  const proj = (w: V3): [number, number, number] => {
    const c = qRot(qV, sub(w, tgt));
    const f = persp(c[2]);
    return [cx + c[0] * Z * f, cy - c[1] * Z * f, c[2]];
  };

  type Line = [number, number, number, number, string, number];
  type Item = { z: number; pts: number[]; faces: { idx: number[]; fill: string }[]; alpha: number; line: string; lines?: Line[]; front: boolean; after?: () => void };

  const faceFill = (rgb: V3, tint: number, fog: number) =>
    `rgb(${lerp(rgb[0] + tint, GROUND[0], fog) | 0},${lerp(rgb[1] + tint, GROUND[1], fog) | 0},${lerp(rgb[2] + tint * 1.2, GROUND[2], fog) | 0})`;

  const boxItem = (pose: Pose, h: V3, mat: Mat, alpha: number, tint = 0): Item | null => {
    const hx = h[0] * pose.s[0], hy = h[1] * pose.s[1], hz = h[2] * pose.s[2];
    if (hx < 1e-4 || alpha < 0.01) return null;
    const qT = qMul(qV, pose.q);
    const c = qRot(qV, sub(pose.p, tgt));
    if (invD > 0 && c[2] * invD > 0.78) return null;
    const ax = qRot(qT, [hx, 0, 0]), ay = qRot(qT, [0, hy, 0]), az = qRot(qT, [0, 0, hz]);
    const pts: number[] = [];
    for (let i = 0; i < 8; i++) {
      const sx = i & 1 ? 1 : -1, sy = i & 2 ? 1 : -1, sz = i & 4 ? 1 : -1;
      const x = c[0] + sx * ax[0] + sy * ay[0] + sz * az[0];
      const y = c[1] + sx * ax[1] + sy * ay[1] + sz * az[1];
      const z = c[2] + sx * ax[2] + sy * ay[2] + sz * az[2];
      const f = persp(z);
      pts.push(cx + x * Z * f, cy - y * Z * f);
    }
    const fog = clamp((-c[2] - 1.2) / 10) * 0.42;
    const m = MAT[mat];
    const faces: Item['faces'] = [];
    let front = false;
    for (const [, , idx, slot] of FACES) {
      let area = 0;
      for (let j = 0; j < 4; j++) {
        const a = idx[j] * 2, b = idx[(j + 1) % 4] * 2;
        area += pts[a] * pts[b + 1] - pts[b] * pts[a + 1];
      }
      if (area > -0.8) continue;
      if (slot === 'f') front = true;
      faces.push({ idx, fill: faceFill(m[slot], tint, fog) });
    }
    return { z: qRot(qS, sub(pose.p, tgt))[2], pts, faces, alpha, line: m.line, front };
  };

  /** hairlines across the front face at each cut: the cracks the plane always had */
  const crackLines = (pa: WParent, pose: Pose, a: number): Line[] => {
    const out: Line[] = [];
    const hy = pa.h[1], hz = pa.h[2];
    for (const cu of pa.cuts) {
      const p0 = add(pose.p, qRot(pose.q, v(cu, -hy, hz))), p1 = add(pose.p, qRot(pose.q, v(cu, hy, hz)));
      const s0 = proj(p0), s1 = proj(p1);
      out.push([s0[0], s0[1], s1[0], s1[1], MAT[pa.mat].crack, a]);
    }
    return out;
  };

  const drawItem = (it: Item) => {
    const P = it.pts;
    for (const f of it.faces) {
      ctx.globalAlpha = it.alpha;
      ctx.beginPath();
      ctx.moveTo(P[f.idx[0] * 2], P[f.idx[0] * 2 + 1]);
      for (let j = 1; j < 4; j++) ctx.lineTo(P[f.idx[j] * 2], P[f.idx[j] * 2 + 1]);
      ctx.closePath();
      ctx.fillStyle = f.fill;
      ctx.fill();
      ctx.strokeStyle = f.fill; ctx.lineWidth = 0.6; ctx.stroke(); // seal seams
      ctx.strokeStyle = it.line; ctx.lineWidth = 0.7; ctx.stroke(); // hairline edge
    }
    if (it.lines) for (const l of it.lines) {
      ctx.globalAlpha = it.alpha * l[5];
      ctx.strokeStyle = l[4]; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke();
    }
    if (it.after) it.after();
  };

  /** the name, printed on the dominant plane — it breaks along the same cuts and leaves with the pieces */
  const nameOn = (it: Item, pose: Pose, pa: WParent, mid: number, a: number) => {
    if (!it.front || a < 0.01 || !nameK) return;
    it.after = () => {
      const hz = pa.h[2] * pose.s[2];
      const O = proj(add(pose.p, qRot(pose.q, v(-mid, 0, hz))));
      const X = proj(add(pose.p, qRot(pose.q, v(1 - mid, 0, hz))));
      const Y = proj(add(pose.p, qRot(pose.q, v(-mid, 1, hz))));
      const P = it.pts;
      ctx.save();
      ctx.beginPath();
      const f = [4, 5, 7, 6];
      ctx.moveTo(P[f[0] * 2], P[f[0] * 2 + 1]);
      for (let j = 1; j < 4; j++) ctx.lineTo(P[f[j] * 2], P[f[j] * 2 + 1]);
      ctx.closePath();
      ctx.clip();
      const k = nameK;
      ctx.setTransform(dpr * (X[0] - O[0]) * k, dpr * (X[1] - O[1]) * k, -dpr * (Y[0] - O[0]) * k, -dpr * (Y[1] - O[1]) * k, dpr * O[0], dpr * O[1]);
      setNameFont();
      ctx.globalAlpha = 1; // the type keeps its exact colour on every piece
      ctx.fillStyle = '#0c1128';
      ctx.textBaseline = 'alphabetic';
      const x0 = (-pa.h[0] + pa.h[0] * 2 * 0.07) / k;
      // block of lines centred on the plane: cap height ≈ 72 text px, then one lead per extra line
      const block = 72 + nameLead * (LINES.length - 1);
      const top = (pa.h[1] / k) - ((pa.h[1] * 2) / k - block) / 2; // distance from centre to block top, in text px (up)
      LINES.forEach((ln, i) => ctx.fillText(ln, x0, -(top - 72 - i * nameLead)));
      ctx.restore();
    };
  };

  // ---------- poses ----------
  const fragAt = (f: WFrag, s: number, field = false): Pose => {
    const u = fragU(f, s, field);
    if (u <= 0) return f.A;
    if (u >= 1) return f.C;
    const t = easeInOut3(u);
    return { p: bez(f.A.p, f.ctrl, f.C.p, t), q: qBez(f.A.q, f.qc, f.C.q, t), s: lerp3(f.A.s, f.C.s, t) };
  };
  // field: a partial change means some pieces fully rebuilt (nearest the agent's side) and the rest still in the picture
  const fragU = (f: WFrag, s: number, field = false) => (field ? clamp((s * 1.7 - f.o) / 0.7) : clamp((s - f.o * 0.3) / 0.7));

  /** the agent: waits, crosses the grain, strikes, keeps its vector, turns into the keystone */
  const agentAt = (start: V3, impact: V3, C: Pose, dir: V3, travel: number, build: number): Pose => {
    const qT = qLook(dir, v(0, 1, 0));
    if (build <= 0) return { p: lerp3(start, impact, easeIn2(travel)), q: qT, s: v(1 + travel * 0.5, 1, 1) };
    const t = easeInOut3(build);
    const ctrl = add(impact, scale(dir, 0.95 * len(sub(C.p, impact)) + 0.35));
    const qMid = qMul(qAxis(v(0, 0, 1), 0.35), qT);
    return { p: bez(impact, ctrl, C.p, t), q: qBez(qT, qMid, C.q, t), s: lerp3(v(1.5, 1, 1), C.s, t) };
  };

  // ---------- render ----------
  const render = (now: number) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round';

    const cam = camera(p);
    const calm = 1 - smooth((p - T.build1) / 0.12) * 0.7;
    const tiltY = rm ? 0 : px * 0.18 * calm, tiltX = rm ? 0 : -py * 0.12 * calm;
    qV = qMul(qZ(cam.roll), qMul(qX(cam.pitch + tiltX), qY(cam.yaw + tiltY)));
    qS = qMul(qZ(cam.roll), qMul(qX(cam.pitch), qY(cam.yaw))); // depth order ignores the pointer tilt
    Z = S * cam.zoom;
    invD = cam.invD;
    tgt = lerp3(v(0, 0.05, 0), tgtField, cam.tmix);
    cx = W * (portrait ? 0.5 : 0.54);
    cy = H * (portrait ? (PAGE ? 0.45 : 0.54) : 0.47);

    const sP = buildS(p);
    const fieldA = FIELD ? clamp((p - T.pull0 - 0.02) / 0.12) : 0;
    // scrolling back out of the field resets what was seeded there
    if (FIELD && p < T.pull0) for (const n of nodes) if (!n.primary && (n.agent || n.lvl.to > 0)) { n.agent = null; n.lvl = { from: 0, to: 0, t0: 0, dur: 1 }; }
    const introT = introT0 >= 0 && !rm ? clamp((now - introT0) / 1700) : 1;
    const items: Item[] = [];

    // ----- first composition -----
    const primary = nodes[0];
    const pw = v((mx - cx) / Z, -(my - cy) / Z, 0); // pointer on the picture plane (valid while frontal)
    const hovK = hov * (1 - smooth(p / 0.1));
    let J = 0;
    for (const pu of pulses) { const x = (now - pu.t0) / 900; if (x > 0 && x < 1) J += Math.sin(Math.PI * x) * Math.exp(-2.4 * x) * 1.6; }
    const crackP = clamp((p - T.strike + 0.004) / 0.035);
    const nameA = 1;

    primary.parents.forEach((pa, pi) => {
      const moving = pa.frags.some((f) => fragU(f, sP) > 0);
      // hover lift and pulse: whole planes lean out of the picture toward the pointer
      const lean = (pose: Pose, g: number): Pose => {
        if (g < 0.002) return pose;
        const dx = pose.p[0] - pw[0], dy = pose.p[1] - pw[1];
        return { ...pose, p: add(pose.p, v(dx * 0.05 * g, dy * 0.05 * g, 0.2 * g)), q: qMul(qAxis(v(-dy, dx, 0.001), 0.45 * g), pose.q) };
      };
      const shift = (pose: Pose, i: number): Pose => {
        let q = pose;
        if (introT < 1) {
          const u = easeOutExpo(clamp((introT - (pi * 0.07) % 0.4) / 0.6));
          const sg = pi % 2 ? 1 : -1;
          q = { ...q, p: add(q.p, v(Math.cos(0.49) * sg * (1 - u) * 3.2, Math.sin(0.49) * sg * (1 - u) * 3.2, 0)) };
        }
        if (J > 0.001) q = { ...q, p: add(q.p, add(scale(tPrimaryDir, 0.07 * J * (0.4 + 0.6 * Math.exp(-len(sub(q.p, IMPACT)) * 1.4))), v(0, 0, 0.12 * J * (i % 2 ? 1 : -1)))) };
        return q;
      };
      if (!moving) {
        let pose = shift(pa.A, 0);
        if (hovK > 0.001) {
          const dx = pa.A.p[0] - pw[0], dy = pa.A.p[1] - pw[1];
          pose = lean(pose, Math.exp(-(dx * dx + dy * dy) / Math.max(0.12, pa.h[0] * pa.h[0] * 0.9)) * hovK);
        }
        const it = boxItem(pose, pa.h, pa.mat, 1, pa.tint * 2);
        if (it && pi === 0) nameOn(it, pose, pa, 0, nameA);
        if (it) {
          const ca = clamp(crackP * 1.6 - pa.o * 0.6);
          if (ca > 0 && pa.cuts.length) it.lines = crackLines(pa, pose, ca);
          items.push(it);
        }
      } else {
        pa.frags.forEach((f, i) => {
          const pose = shift(fragAt(f, sP), i);
          const it = boxItem(pose, f.h, f.mat, 1, f.tint * 2);
          if (it && pi === 0 && fragU(f, sP) < 0.4) nameOn(it, pose, pa, f.mid, nameA); // leaves the piece mid-flight
          if (it) items.push(it);
        });
      }
    });

    // the agent
    {
      const travel = clamp((p - T.depart) / (T.strike - T.depart));
      const pose0 = agentAt(agentStart, IMPACT, AGENT_C, tPrimaryDir, travel, sP);
      let pose = pose0;
      if (introT < 1) pose = { ...pose, s: v(pose.s[0] * easeOutExpo(clamp((introT - 0.5) / 0.5)), pose.s[1], pose.s[2]) };
      if (J > 0.001) pose = { ...pose, p: add(pose.p, scale(tPrimaryDir, -0.05 * J)) };
      const it = boxItem(pose, AGENT_H, 'cad', 1);
      if (it) {
        // a short streak behind it, only while it moves fast
        if (!rm && p > T.depart && p < T.build0 + 0.1) {
          const pb = agentAt(agentStart, IMPACT, AGENT_C, tPrimaryDir, clamp((p - 0.012 - T.depart) / (T.strike - T.depart)), buildS(p - 0.012));
          const a = proj(pose.p), b = proj(pb.p);
          const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (d > 1.5) {
            const hx = AGENT_H[0] * pose.s[0], hy = AGENT_H[1];
            const r1 = proj(add(pose.p, qRot(pose.q, v(-hx, hy, 0)))), r2 = proj(add(pose.p, qRot(pose.q, v(-hx, -hy, 0))));
            const L = Math.min(Z * 0.4, d * 6);
            const ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d;
            const smA = clamp(d / 10) * 0.55;
            it.after = () => {
              const g = ctx.createLinearGradient(r1[0], r1[1], r1[0] + ux * L, r1[1] + uy * L);
              g.addColorStop(0, `rgba(247,201,16,${smA})`); g.addColorStop(1, 'rgba(247,201,16,0)');
              ctx.globalAlpha = 1; ctx.fillStyle = g;
              ctx.beginPath(); ctx.moveTo(r1[0], r1[1]); ctx.lineTo(r2[0], r2[1]);
              ctx.lineTo(r2[0] + ux * L, r2[1] + uy * L); ctx.lineTo(r1[0] + ux * L, r1[1] + uy * L); ctx.closePath(); ctx.fill();
            };
          }
        }
        it.z += 0.03;
        items.push(it);
      }
    }

    // ----- the field -----
    if (fieldA > 0.01) {
      for (let ni = 1; ni < nodes.length; ni++) {
        const n = nodes[ni];
        const wStart = T.wave0 + (n.ring - 1) * T.step;
        const strength = [0, 0.56, 0.24, 0][n.ring];
        n.sScroll = strength * smooth((p - wStart) / T.waveDur);
        const l = n.lvl;
        const lt = rm ? 1 : clamp((now - l.t0) / l.dur);
        const sClick = now < l.t0 ? l.from : lerp(l.from, l.to, easeInOut3(lt));
        n.hov += ((ni === hoverNode ? 1 : 0) - n.hov) * 0.2;
        // under the pointer a flat composition shows its cuts and starts to give
        n.s = Math.max(n.sScroll, sClick, rm ? 0 : 0.075 * n.hov);
        const c = proj(n.pos); n.sx = c[0]; n.sy = c[1]; n.sr = Z * persp(c[2]) * n.k * 1.05;

        const alpha = 1;
        n.parents.forEach((pa, pi) => {
          const moving = pa.frags.some((f) => fragU(f, n.s, true) > 0);
          const lay = easeOut3(clamp(fieldA * 1.7 - ((pi * 0.13 + n.ring * 0.17) % 0.7)));
          if (lay <= 0.001) return;
          if (!moving) {
            let pose = pa.A;
            if (lay < 1) pose = { ...pose, s: v(lay, 1, 1) };
            const it = boxItem(pose, pa.h, pa.mat, alpha, pa.tint * 2);
            if (it) {
              const ca = clamp(n.s * 12);
              if (ca > 0 && pa.cuts.length) it.lines = crackLines(pa, pose, ca);
              items.push(it);
            }
          } else pa.frags.forEach((f) => { const it = boxItem(fragAt(f, n.s, true), f.h, f.mat, alpha, f.tint * 2); if (it) items.push(it); });
        });
        if (n.agent) {
          const e = rm ? 1 : clamp((now - n.agent.t0) / 1500);
          const travel = clamp(e / 0.3), bld = clamp((e - 0.3) / 0.7);
          const dir = norm(sub(n.agent.impact, n.agent.start));
          const pose = agentAt(n.agent.start, n.agent.impact, n.agent.C, dir, travel, bld);
          const it = boxItem(pose, scale(AGENT_H, n.k), 'cad', alpha);
          if (it) { it.z += 0.03; items.push(it); }
        }
      }
    }

    items.sort((a, b) => a.z - b.z);
    for (const it of items) drawItem(it);
    ctx.globalAlpha = 1;

    // DOM state, tied to what the scene shows
    const st = p < T.strike ? 0 : sP < 0.5 ? 1 : fieldA < 0.5 ? 2 : 3;
    if (st !== lastState) { stage.dataset.state = String(st); lastState = st; }
    stage.style.setProperty('--p', p.toFixed(4));
    stage.style.setProperty('--exit', exitT.toFixed(3));
    stage.style.setProperty('--field', fieldA.toFixed(3));
    canvas.style.cursor = hoverNode > 0 ? 'pointer' : p < T.pull0 ? 'crosshair' : 'default';
  };

  // ---------- loop ----------
  const frame = (now: number) => {
    let busy = false;
    if (rm) p = pT;
    else { p += (pT - p) * 0.13; if (Math.abs(pT - p) > 0.0003) busy = true; else p = pT; }
    px += (pxT - px) * 0.1; py += (pyT - py) * 0.1; hov += (hovT - hov) * 0.1;
    if (Math.abs(pxT - px) + Math.abs(pyT - py) + Math.abs(hovT - hov) > 0.002) busy = true;
    if (introT0 >= 0 && now - introT0 < 1750) busy = true;
    for (let i = pulses.length - 1; i >= 0; i--) if (now - pulses[i].t0 > 950) pulses.splice(i, 1);
    if (pulses.length) busy = true;
    for (const n of nodes) {
      if (!n.primary && now < n.lvl.t0 + n.lvl.dur + 30) busy = true;
      if (n.agent && now - n.agent.t0 < 1550) busy = true;
      if (Math.abs((nodes.indexOf(n) === hoverNode ? 1 : 0) - n.hov) > 0.01) busy = true;
    }
    if (visible) render(now);
    if (busy && visible) requestAnimationFrame(frame);
    else running = false;
  };
  const request = () => { if (!running) { running = true; requestAnimationFrame(frame); } };

  // ---------- input ----------
  window.addEventListener('scroll', () => { readScroll(); if (visible) request(); }, { passive: true });
  new ResizeObserver(() => { measure(); readScroll(); request(); }).observe(canvas);
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) request(); }).observe(stage);

  const nodeAt = (x: number, y: number) => {
    let best = -1, bd = Infinity;
    nodes.forEach((n, i) => { if (i === 0) return; const d = Math.hypot(n.sx - x, n.sy - y) / n.sr; if (d < bd) { bd = d; best = i; } });
    return bd < 1 ? best : -1;
  };

  stage.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left; my = e.clientY - r.top;
    if (fine && !rm) { pxT = clamp((mx / W) * 2 - 1, -1, 1); pyT = clamp((my / H) * 2 - 1, -1, 1); hovT = 1; }
    const hn = p > T.field - 0.02 ? nodeAt(mx, my) : -1;
    if (hn !== hoverNode) hoverNode = hn;
    request();
  });
  stage.addEventListener('pointerleave', () => { pxT = 0; pyT = 0; hovT = 0; hoverNode = -1; request(); });

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const now = performance.now();
    if (p < T.pull0) { if (!rm) pulses.push({ t0: now, x, y }); request(); return; }
    const j = nodeAt(x, y);
    if (j < 1) return;
    const n = nodes[j];
    // an agent enters this composition; the change spreads along the fan, weaker at each step
    if (!n.agent) {
      n.agent = {
        t0: now,
        start: add(n.pos, qRot(n.qA, scale(AGENT_START_L, n.k))),
        impact: add(n.pos, qRot(n.qA, scale(IMPACT, n.k))),
        C: place(AGENT_C, n.pos, n.qC, n.k),
      };
    }
    const dist = new Map<number, number>([[j, 0]]);
    const queue = [j];
    while (queue.length) {
      const c = queue.shift()!;
      for (const nb of adj[c]) if (!dist.has(nb)) { dist.set(nb, dist.get(c)! + 1); queue.push(nb); }
    }
    dist.forEach((d, i) => {
      if (i === 0) return;
      const m = nodes[i];
      const target = d === 0 ? 1 : [1, 0.56, 0.24, 0.1][Math.min(d, 3)];
      if (target <= m.s + 0.02) return;
      m.lvl = { from: m.s, to: target, t0: now + (d === 0 ? 420 : 420 + d * 520), dur: d === 0 ? 1150 : 1300 };
    });
    request();
  });

  // test hook: screen positions and levels of the compositions
  (window as unknown as { __tk: unknown }).__tk = () => nodes.map((n) => [Math.round(n.sx), Math.round(n.sy), +n.s.toFixed(2)]);

  // ---------- boot ----------
  measure();
  readScroll();
  p = pT;
  document.fonts?.load('800 100px "Archivo Variable"').then(() => { measureName(); request(); }).catch(() => {});
  if (!rm && pT < 0.02) introT0 = performance.now();
  stage.classList.add('is-live');
  request();
}
