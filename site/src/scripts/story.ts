// The home story (Plotsoft) — one stage, one scroll progress p ∈ [0,1], compressed to ~4 screen heights.
//
//   0.00–0.07  HERO        the soft field; the name lives in it (cursor reveals, clicks send soft rings)
//   0.07–0.15  DIVE        the camera falls into one node; it resolves into the firm
//   0.15–0.60  FIGS 1–3    the firm → an agent enters with the inputs and its instructions become one goal → reorganisation
//   0.60–0.67  PULL BACK   the recomposed firm shrinks back into its node; the field returns around it
//   0.67–0.80  FIG 4       diffusion: the same reorganisation spreads node to node through the field
//   0.80–0.84  LIFT        the lattice is seen from above, then tilts into 3D
//   0.84–1.00  CODA        homotopy: the sheet twists, tears and re-glues into a torus, which turns jade
//
// Plotter's geometry and timeline are kept; the drawing is softened: a breathing rounded boundary with a tonal wash instead
// of a hatched rectangle, curved wires and hanging instruction cords, round points, glowing agents, springy easing, and a
// spring between the scroll and everything it drives.
import { gsap, ScrollTrigger, onDispose, reduced } from './core';
import { DiffusionField } from './field';
import { HomotopySurface } from './surface';

const NS = 'http://www.w3.org/2000/svg';
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const sm = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mobile = () => innerWidth < 700;
const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// scenes overlap: the network starts growing round the firm while it is still shrinking into its node
const P = { dive: [0.07, 0.15], figs: [0.15, 0.58], back: [0.58, 0.68], diff: [0.6, 0.8], lift: [0.8, 0.85], coda: [0.85, 1] } as const;

type Pt = { x: number; y: number };
const polyLen = (pts: Pt[]) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; };
const polyAt = (pts: Pt[], d: number): Pt => {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= l || i === pts.length - 1) { const t = l ? clamp(d / l) : 0; return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }
    d -= l;
  }
  return pts[pts.length - 1];
};
const polyD = (pts: Pt[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ');
const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const quad = (a: Pt, c: Pt, b: Pt, n = 16): Pt[] => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return { x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y }; });
/** a soft arc from a to b: the control point sits off the chord by `bow` × its length */
const bowed = (a: Pt, b: Pt, bow: number, n = 18): Pt[] => { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y; return quad(a, { x: mx - dy * bow, y: my + dx * bow }, b, n); };
/** a Catmull–Rom curve through the given points */
const smooth = (p: Pt[], n = 12): Pt[] => {
  if (p.length < 3) return p;
  const out: Pt[] = [p[0]];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    for (let k = 1; k <= n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return out;
};
// a stretch of a polyline between two distances (used to trim curves at circles, and for the travelling comet)
const polySlice = (pts: Pt[], d0: number, d1: number, n = 14): Pt[] => Array.from({ length: n + 1 }, (_, i) => polyAt(pts, lerp(Math.max(0, d0), d1, i / n)));
const trimC = (pts: Pt[], ra: number, rb: number, n = 20) => { const L = polyLen(pts); return polySlice(pts, ra, Math.max(ra + 0.1, L - rb), n); };

function makeDiagram(root: SVGGElement, small = false) {
  let host: Element = root; // everything after the boundary goes into a detail group that can fade as a whole
  const el = (tag: string, attrs: Record<string, string | number> = {}, parent: Element = host) => {
    const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); parent.appendChild(e); return e;
  };
  const signal = css('--signal'), ink3 = css('--ink-3');

  // flow coordinates → viewBox (unchanged from Plotter; phones turn the flow vertical)
  const M = (u: number, v: number): Pt => (small ? { x: 560 + (v - 190) * 1.5, y: -20 + u * 0.88 } : { x: 150 + u * 1.1, y: 150 + v * 1.1 });
  const FL = 180, U0 = 40, END = small ? 730 : 760;
  const ST = [278, 398, 518].map((u) => M(u, FL));
  const W0 = { u0: 200, u1: 600, v0: 90, v1: 330 }, W1 = { u0: 170, u1: 640, v0: 30, v1: 300 };
  const CTRL = M(400, 286), ANCH = [353, 400, 447].map((u) => M(u, 272));
  const ASIDE = M(455, 128), GOALP = M(279, 105), REVP = M(520, 105), NEWP = M(600, 236);
  const OUTV = { A: 180, B: 120, C: 236 } as const;
  type Out = keyof typeof OUTV;
  const MESH = [M(322, 236), M(361, 263), M(400, 238), M(439, 263), M(478, 236)];
  const MESH_LINKS: [Pt, Pt][] = [[ST[0], MESH[0]], [MESH[0], MESH[1]], [MESH[1], MESH[2]], [MESH[2], MESH[3]], [MESH[3], MESH[4]], [MESH[4], ST[2]], [MESH[0], MESH[2]], [MESH[2], MESH[4]], [MESH[2], ST[1]]];
  const MESH_R = 6;
  const IN = M(U0, FL);
  const PERSON_R = 15, AGENT_R = 25;

  // the curves (fixed geometry, sampled once)
  const FLOW_SEG = [bowed(IN, ST[0], 0.035), bowed(ST[0], ST[1], -0.07), bowed(ST[1], ST[2], 0.07)];
  const OUT_A = bowed(ST[2], M(END, FL), -0.04);
  const outCurve = (k: Out): Pt[] => (k === 'A' ? OUT_A : smooth([ST[2], M(k === 'C' ? 590 : 630, lerp(FL, OUTV[k], 0.8)), M(END - 40, OUTV[k]), M(END, OUTV[k])], 10));
  const OUT_C = { B: outCurve('B'), C: outCurve('C') };
  const MESH_C = MESH_LINKS.map(([a, b], i) => bowed(a, b, (i % 2 ? 0.16 : -0.16) * (small ? -1 : 1)));
  const BACK = smooth([ST[2], MESH[4], MESH[3], MESH[2], MESH[1], MESH[0], ST[0]], 10); // work passed back upstream through the mesh
  const ROUTE = { A: [...FLOW_SEG[0], ...FLOW_SEG[1], ...FLOW_SEG[2], ...OUT_A] } as Record<string, Pt[]>;
  ROUTE.B = [...FLOW_SEG[0], ...FLOW_SEG[1], ...FLOW_SEG[2], ...OUT_C.B];
  ROUTE.C = [...FLOW_SEG[0], ...FLOW_SEG[1], ...FLOW_SEG[2], ...OUT_C.C];
  const ENTER = [...FLOW_SEG[0], ...FLOW_SEG[1]];

  const S = {
    w: 0, open: 0, fa: 0, hatch: 0, title: 0, collapse: 0, wash: 0,
    mesh: [0, 1, 2, 3, 4].map(() => ({ k: 0 })), meshL: 0,
    inL: 0, io: 0, flow: [0, 1].map(() => ({ v: 0 })), outA: 0, aFade: 1,
    ctrl: 0,
    bund: [0, 1, 2].map(() => ({ v: 0, die: 0 })),
    people: [0, 1, 2].map(() => ({ a: 0, k: 0, k2: 0 })),
    agents: [0, 1, 2].map(() => ({ a: 0, pulse: 0 })),
    enter: 0, spread: 0, goal3: 0,
    goalL: 0, revL: 0, fb: 0, bL: 0, cL: 0, bcT: 0, fast: 0,
    m: 0,
  };

  const wall = () => { const t = S.w; return { u0: lerp(W0.u0, W1.u0, t), u1: lerp(W0.u1, W1.u1, t), v0: lerp(W0.v0, W1.v0, t), v1: lerp(W0.v1, W1.v1, t) }; };
  const box = (w: { u0: number; u1: number; v0: number; v1: number }) => { const a = M(w.u0, w.v0), b = M(w.u1, w.v1); return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }; };
  const home = (() => { const b = box(W0); return { x: b.x + b.w / 2, y: b.y + b.h / 2, r: Math.max(b.w, b.h) / 2 }; })();

  // the boundary: a rounded outline in flow coordinates, walked from the output side's upper gap edge round to the lower one
  const RAD = 50;
  const outline = (w: ReturnType<typeof wall>, gA: number, gB: number, t: number): Pt[] => {
    const r = Math.min(RAD, (w.u1 - w.u0) / 2, (w.v1 - w.v0) / 2), pts: Pt[] = [];
    const line = (u0: number, v0: number, u1: number, v1: number) => { const n = Math.max(2, Math.ceil(Math.hypot(u1 - u0, v1 - v0) / 8)); for (let i = 0; i <= n; i++) pts.push({ x: lerp(u0, u1, i / n), y: lerp(v0, v1, i / n) }); };
    const arc = (cu: number, cv: number, a0: number, a1: number) => { for (let i = 1; i <= 10; i++) { const a = lerp(a0, a1, i / 10); pts.push({ x: cu + Math.cos(a) * r, y: cv + Math.sin(a) * r }); } };
    // the opening never reaches into the corners, so the wall always ends on its straight side
    gA = Math.max(w.v0 + r, gA); gB = Math.min(w.v1 - r, gB);
    line(w.u1, gA, w.u1, w.v0 + r); arc(w.u1 - r, w.v0 + r, 0, -Math.PI / 2);
    line(w.u1 - r, w.v0, w.u0 + r, w.v0); arc(w.u0 + r, w.v0 + r, -Math.PI / 2, -Math.PI);
    line(w.u0, w.v0 + r, w.u0, w.v1 - r); arc(w.u0 + r, w.v1 - r, Math.PI, Math.PI / 2);
    line(w.u0 + r, w.v1, w.u1 - r, w.v1); arc(w.u1 - r, w.v1 - r, Math.PI / 2, 0);
    line(w.u1, w.v1 - r, w.u1, gB);
    // breathing: a slow swell travels round the edge along its normal
    const out: Pt[] = []; let s = 0; const Ltot = polyLen(pts);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      if (i) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      const taper = sm(clamp(s / 40)) * sm(clamp((Ltot - s) / 40)); // the two ends of the opening stay put, so the wall closes cleanly
      const amp = (1.7 * Math.sin(s * 0.019 + t * 0.8) + 0.8 * Math.sin(s * 0.047 - t * 0.55)) * taper;
      out.push(M(pts[i].x + (dy / d) * amp, pts[i].y - (dx / d) * amp));
    }
    return out;
  };

  const defs = root.ownerSVGElement!.querySelector('defs')!;
  const grad = (id: string, stops: [number, string, number][]) => { const g = el('radialGradient', { id, cx: '42%', cy: '40%', r: '75%' }, defs); stops.forEach(([o, c, a]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g)); };
  grad('dg-warm', [[0, css('--haze-warm') || '#f8f1e7', 0.95], [1, css('--paper-2') || '#e9e5dd', 0.9]]);
  grad('dg-jade', [[0, '#f4faf7', 0.95], [1, css('--wash') || '#dcefe6', 0.95]]);
  // the wash is feathered toward the output side as the wall opens (a mask whose gradient follows the wall)
  const fade = el('linearGradient', { id: 'dg-fade', gradientUnits: 'userSpaceOnUse' }, defs);
  el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 1 }, fade); const fadeEnd = el('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 1 }, fade);
  const mask = el('mask', { id: 'dg-fillmask', maskUnits: 'userSpaceOnUse', x: -2000, y: -2000, width: 6000, height: 6000 }, defs);
  el('rect', { x: -2000, y: -2000, width: 6000, height: 6000, fill: 'url(#dg-fade)' }, mask);
  const gForm = el('g', {});
  const gFill = el('g', { mask: 'url(#dg-fillmask)' }, gForm);
  const fillWarm = el('path', { class: 'dg-fill', fill: 'url(#dg-warm)' }, gFill);
  const fillJade = el('path', { class: 'dg-fill', fill: 'url(#dg-jade)' }, gFill);
  const form = el('path', { class: 'dg-form' }, gForm);
  const gDetail = el('g', {}); host = gDetail;
  const title = el('g', { class: 'dg-chip' }); el('rect', { width: 84, height: 30, rx: 15 }, title); const titleT = el('text', { x: 42, y: 20, 'text-anchor': 'middle', class: 'dg-label -strong' }, title); titleT.textContent = 'FIRM';

  const wire = (cls = 'dg-link') => el('path', { class: cls, pathLength: 1 }) as SVGPathElement;
  const glowG = el('g', { class: 'dg-glows' });
  const bundW = S.bund.map(() => [0, 1, 2].map(() => wire('dg-link -thin')));
  const goal3W = wire('dg-link -signal'); const goal3H = el('path', { class: 'dg-head -signal' });
  const ctrl = el('g', { class: 'dg-chip', transform: `translate(${CTRL.x} ${CTRL.y})` }); el('rect', { x: -84, y: -16, width: 168, height: 32, rx: 16 }, ctrl);
  const ctrlT = el('text', { class: 'dg-label', 'text-anchor': 'middle', y: 5 }, ctrl); ctrlT.textContent = 'COORDINATION';
  const inW = wire(), flowW = S.flow.map(() => wire()), aW = wire(), bW = wire('dg-link -signal'), cW = wire('dg-link -signal');
  const heads = { A: el('path', { class: 'dg-head' }), B: el('path', { class: 'dg-head -signal' }), C: el('path', { class: 'dg-head -signal' }) };
  const meshW = MESH_LINKS.map(() => wire('dg-link -signal -thin'));
  const meshGlow = MESH.map(() => el('circle', { class: 'dg-glow', r: MESH_R * 2.4 }, glowG) as SVGCircleElement);
  const meshEls = MESH.map(() => el('circle', { class: 'dg-form -signal -agent', r: MESH_R }) as SVGCircleElement);
  const meshPulse = MESH.map(() => el('circle', { class: 'dg-pulse' }) as SVGCircleElement);
  const goalW = wire('dg-link -signal'), revW = wire('dg-link -signal'), fbW = wire('dg-link -signal');
  const goalH = el('path', { class: 'dg-head -signal' }), revH = el('path', { class: 'dg-head -signal' }), fbH = el('path', { class: 'dg-head -signal' });
  const fbPts = quad(REVP, M(400, 30), GOALP, 24);
  const comet = wire('dg-link -signal -comet'), cometGlow = wire('dg-link -glow');
  const spreadW = [wire('dg-link -signal -comet'), wire('dg-link -signal -comet')];
  const pulses = S.agents.map(() => el('circle', { class: 'dg-pulse', r: AGENT_R }) as SVGCircleElement);
  const agentGlow = S.agents.map((_, i) => el('circle', { class: 'dg-glow', cx: ST[i].x, cy: ST[i].y, r: AGENT_R * 1.9 }, glowG) as SVGCircleElement);
  const agentEls = S.agents.map((_, i) => { const g = el('g', {}); const c = el('circle', { class: 'dg-form -signal -agent', cx: ST[i].x, cy: ST[i].y, r: AGENT_R, pathLength: 1 }, g) as SVGCircleElement; const t = el('text', { class: 'dg-label -tiny -signal', 'text-anchor': 'middle', x: ST[i].x, y: ST[i].y + 4 }, g); t.textContent = 'AGENT'; return { g, c, t }; });
  const personEls = S.people.map(() => el('circle', { class: 'dg-role', r: PERSON_R }) as SVGCircleElement);

  type LP = { dx: number; dy: number; a: 'start' | 'middle' | 'end' };
  const label = (t: string, at: Pt, d: LP, m: LP, cls = 'dg-label') => { const o = small ? m : d; const e = el('text', { class: cls, x: at.x + o.dx, y: at.y + o.dy, 'text-anchor': o.a }); e.textContent = t; return e; };
  const inT = label('INPUTS', IN, { dx: 0, dy: -16, a: 'start' }, { dx: 14, dy: 6, a: 'start' });
  const outT = {
    A: label('OUTPUT A', M(END, FL), { dx: 0, dy: -16, a: 'end' }, { dx: 0, dy: 30, a: 'middle' }),
    B: label('OUTPUT B', M(END, OUTV.B), { dx: 0, dy: -16, a: 'end' }, { dx: -12, dy: 6, a: 'end' }),
    C: label('OUTPUT C', M(END, OUTV.C), { dx: 0, dy: -16, a: 'end' }, { dx: 12, dy: 6, a: 'start' }),
  };
  const g3Mid = lerpPt(ANCH[1], ST[1], 0.5);
  // phones: the arrow is short and horizontal, so GOAL sits to its left, clear of the COORDINATION pill
  const goal3T = label('GOAL', g3Mid, { dx: 14, dy: 6, a: 'start' }, { dx: ST[1].x - g3Mid.x - AGENT_R - 10, dy: 5, a: 'end' }, 'dg-label -small -signal');

  const gDots = el('g', {});
  type Dot = { s: number; route: Out | 'back'; i: number; el: SVGCircleElement };
  const dots: Dot[] = [
    ...Array.from({ length: 14 }, (_, k): Dot => ({ s: k / 14, route: 'A', i: 0, el: el('circle', { class: 'dg-dot', r: 3.4 }, gDots) as SVGCircleElement })),
    ...Array.from({ length: 5 }, (_, k): Dot => ({ s: k / 5, route: 'back', i: k % 3, el: el('circle', { class: 'dg-dot', r: 2.8 }, gDots) as SVGCircleElement })),
  ];

  // a soft chevron
  const head = (x: number, y: number, ang: number, l = 10, w = 0.46) => `M${x - l * Math.cos(ang - w)} ${y - l * Math.sin(ang - w)} Q${x - l * 0.25 * Math.cos(ang)} ${y - l * 0.25 * Math.sin(ang)} ${x} ${y} Q${x - l * 0.25 * Math.cos(ang)} ${y - l * 0.25 * Math.sin(ang)} ${x - l * Math.cos(ang + w)} ${y - l * Math.sin(ang + w)}`;
  const headAt = (pts: Pt[]) => { const b = pts[pts.length - 1], a = pts[pts.length - 3] ?? pts[0]; return head(b.x, b.y, Math.atan2(b.y - a.y, b.x - a.x)); };
  const draw = (e: SVGGeometryElement, p: number, a = 1) => { e.style.strokeDasharray = p >= 0.995 ? '' : '1 1'; e.style.strokeDashoffset = p >= 0.995 ? '' : String(1 - p); e.style.opacity = p > 0.001 ? String(a) : '0'; };
  const personPos = (i: number) => { const p = S.people[i]; const mid = i === 1 ? lerpPt(ST[1], ASIDE, p.k) : ST[i]; return lerpPt(mid, [GOALP, REVP, NEWP][i], p.k2); };
  const stepR = (i: number) => { const here = 1 - clamp((S.people[i].k + S.people[i].k2) * 4); return Math.max(3, here * PERSON_R, S.agents[i].a * AGENT_R); };

  let last = performance.now(), clock = 0;
  function render(now = performance.now()) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    const breathe = (i: number, amp = 0.035) => 1 + amp * Math.sin(clock * 1.5 + i * 1.9);
    // boundary
    const w = wall(), b = box(w), mid = (w.v0 + w.v1) / 2;
    const gA = lerp(mid, w.v0 + 70, S.open), gB = lerp(mid, w.v1 - 40, S.open);
    const ol = outline(w, gA, gB, clock);
    const d = polyD(ol);
    form.setAttribute('d', d);
    const closed = d + ' Z';
    fillWarm.setAttribute('d', closed); fillJade.setAttribute('d', closed);
    { const f0 = M(w.u1 - 110, mid), f1 = M(w.u1 + 6, mid); fade.setAttribute('x1', f0.x.toFixed(1)); fade.setAttribute('y1', f0.y.toFixed(1)); fade.setAttribute('x2', f1.x.toFixed(1)); fade.setAttribute('y2', f1.y.toFixed(1)); fadeEnd.setAttribute('stop-opacity', (1 - 0.97 * clamp(S.open)).toFixed(3)); }
    (form as SVGElement).style.opacity = String(S.fa);
    fillWarm.style.opacity = String(S.hatch * (1 - S.wash)); fillJade.style.opacity = String(S.hatch * S.wash);
    title.setAttribute('transform', `translate(${(b.x + (small ? 24 : 74)).toFixed(1)} ${(b.y - 15).toFixed(1)})`); title.style.opacity = String(S.title);
    // coordination collapses to a point, and small agents burst out of it
    const cs = 1 - S.collapse;
    ctrl.setAttribute('transform', `translate(${CTRL.x} ${CTRL.y}) scale(${Math.max(0.001, cs).toFixed(3)} ${Math.max(0.001, cs * cs).toFixed(3)})`);
    ctrl.style.opacity = String(S.ctrl * (S.collapse < 0.98 ? 1 : 0)); ctrlT.style.opacity = String(1 - clamp(S.collapse * 2.5));
    // instruction cords: three strands leave coordination spread apart and gather at the step, hanging slightly
    S.bund.forEach((bd, i) => {
      const a0 = ANCH[i], b0 = ST[i], dd = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1, nx = -(b0.y - a0.y) / dd, ny = (b0.x - a0.x) / dd;
      bundW[i].forEach((e, j) => {
        const o = (j - 1) * 9, oe = (j - 1) * 3, sway = Math.sin(clock * 0.8 + i + j) * 0.02;
        const pts = trimC(bowed({ x: a0.x + nx * o, y: a0.y + ny * o }, { x: b0.x + nx * oe, y: b0.y + ny * oe }, (j - 1) * 0.1 + sway), 0, stepR(i) + 3);
        e.setAttribute('d', polyD(pts));
        draw(e, bd.v, 1 - 0.55 * bd.die); e.classList.toggle('-dead', bd.die > 0.5);
      });
    });
    const g3 = trimC(bowed(ANCH[1], ST[1], 0.05), 0, AGENT_R + 5);
    goal3W.setAttribute('d', polyD(g3)); draw(goal3W, S.goal3);
    goal3H.setAttribute('d', headAt(g3)); goal3H.style.opacity = S.goal3 > 0.97 ? '1' : '0';
    goal3T.style.opacity = String(S.goal3 > 0.9 ? 1 : 0);
    // the flow
    const r = [0, 1, 2].map(stepR);
    const inP = trimC(FLOW_SEG[0], 0, r[0] + 3); inW.setAttribute('d', polyD(inP)); draw(inW, S.inL);
    S.flow.forEach((f, i) => { const p = trimC(FLOW_SEG[i + 1], r[i] + 3, r[i + 1] + 3); flowW[i].setAttribute('d', polyD(p)); draw(flowW[i], f.v); flowW[i].classList.toggle('-signal', S.agents[i].a > 0.9 && S.agents[i + 1].a > 0.9); });
    const aP = trimC(OUT_A, r[2] + 3, 0);
    aW.setAttribute('d', polyD(aP)); draw(aW, S.outA, lerp(1, 0.55, 1 - S.aFade)); aW.classList.toggle('-dead', S.aFade < 0.6);
    heads.A.setAttribute('d', headAt(aP)); heads.A.style.opacity = S.outA > 0.97 ? String(lerp(0.55, 1, S.aFade)) : '0'; heads.A.style.stroke = S.aFade < 0.6 ? ink3 : '';
    const bP = trimC(OUT_C.B, AGENT_R + 3, 0), cP = trimC(OUT_C.C, AGENT_R + 3, 0);
    bW.setAttribute('d', polyD(bP)); draw(bW, S.bL); heads.B.setAttribute('d', headAt(bP)); heads.B.style.opacity = S.bL > 0.97 ? '1' : '0';
    cW.setAttribute('d', polyD(cP)); draw(cW, S.cL); heads.C.setAttribute('d', headAt(cP)); heads.C.style.opacity = S.cL > 0.97 ? '1' : '0';
    inT.style.opacity = String(S.io); outT.A.style.opacity = String(S.io * lerp(0.5, 1, S.aFade)); outT.A.style.fill = S.aFade < 0.6 ? ink3 : '';
    outT.B.style.opacity = outT.C.style.opacity = String(S.bcT);
    // people and agents (they breathe)
    S.people.forEach((p, i) => { const q = personPos(i); personEls[i].setAttribute('cx', q.x.toFixed(1)); personEls[i].setAttribute('cy', q.y.toFixed(1)); personEls[i].setAttribute('r', (PERSON_R * breathe(i + 3, 0.03)).toFixed(2)); personEls[i].style.opacity = String(p.a); });
    S.agents.forEach((a, i) => {
      // agents swell into place as whole circles (springy), rather than being traced
      agentEls[i].c.style.opacity = a.a > 0.01 ? '1' : '0'; agentEls[i].c.setAttribute('r', (AGENT_R * Math.max(0.01, a.a) * breathe(i)).toFixed(2));
      agentEls[i].t.style.opacity = String(a.a > 0.9 ? 1 : 0);
      agentGlow[i].style.opacity = String(clamp(a.a) * (0.5 + 0.12 * Math.sin(clock * 1.5 + i * 1.9)));
      const pl = pulses[i]; pl.setAttribute('cx', String(ST[i].x)); pl.setAttribute('cy', String(ST[i].y)); pl.setAttribute('r', (AGENT_R + a.pulse * 52).toFixed(1));
      pl.style.opacity = a.pulse > 0 && a.pulse < 1 ? String((1 - a.pulse) ** 2 * 0.9) : '0';
    });
    // jade arriving along the input line, then spreading from the agent to its neighbours
    const eL = polyLen(ENTER), eD = S.enter * eL;
    const cd = polyD(polySlice(ENTER, eD - 110, eD, 18));
    comet.setAttribute('d', cd); cometGlow.setAttribute('d', cd);
    comet.style.opacity = cometGlow.style.opacity = S.enter > 0 && S.enter < 1 ? '1' : '0';
    [FLOW_SEG[1].slice().reverse(), FLOW_SEG[2]].forEach((seg2, i) => { const L = polyLen(seg2), dd = S.spread * L; spreadW[i].setAttribute('d', polyD(polySlice(seg2, dd - 70, dd))); spreadW[i].style.opacity = S.spread > 0 && S.spread < 1 ? '1' : '0'; });
    // fig 3 relations (mesh settles with a springy overshoot)
    S.mesh.forEach((m, i) => {
      const q = lerpPt(CTRL, MESH[i], m.k), on = m.k > 0.001;
      meshEls[i].setAttribute('cx', q.x.toFixed(1)); meshEls[i].setAttribute('cy', q.y.toFixed(1));
      meshEls[i].setAttribute('r', (MESH_R * (1 + 0.6 * Math.sin(Math.PI * clamp(m.k))) * breathe(i + 7, 0.06)).toFixed(2)); meshEls[i].style.opacity = on ? '1' : '0';
      meshGlow[i].setAttribute('cx', q.x.toFixed(1)); meshGlow[i].setAttribute('cy', q.y.toFixed(1)); meshGlow[i].style.opacity = on ? String(0.45 * clamp(m.k)) : '0';
      const pk = seg(m.k, 0.8, 1); meshPulse[i].setAttribute('cx', MESH[i].x.toFixed(1)); meshPulse[i].setAttribute('cy', MESH[i].y.toFixed(1)); meshPulse[i].setAttribute('r', (MESH_R + pk * 20).toFixed(1));
      meshPulse[i].style.opacity = pk > 0 && pk < 1 ? String((1 - pk) ** 2) : '0';
    });
    MESH_C.forEach((c, i) => { const [a, b2] = MESH_LINKS[i]; const ra = ST.includes(a) ? AGENT_R + 3 : MESH_R + 3, rb = ST.includes(b2) ? AGENT_R + 3 : MESH_R + 3; meshW[i].setAttribute('d', polyD(trimC(c, ra, rb))); draw(meshW[i], S.meshL, 0.85); });
    const gP = trimC(bowed(GOALP, ST[0], -0.12), PERSON_R + 3, AGENT_R + 5); goalW.setAttribute('d', polyD(gP)); draw(goalW, S.goalL); goalH.setAttribute('d', headAt(gP)); goalH.style.opacity = S.goalL > 0.97 ? '1' : '0';
    const rP = trimC(bowed(ST[2], REVP, -0.12), AGENT_R + 3, PERSON_R + 5); revW.setAttribute('d', polyD(rP)); draw(revW, S.revL); revH.setAttribute('d', headAt(rP)); revH.style.opacity = S.revL > 0.97 ? '1' : '0';
    const fP = fbPts.slice(2, -2); fbW.setAttribute('d', polyD(fP)); draw(fbW, S.fb); fbH.setAttribute('d', headAt(fP)); fbH.style.opacity = S.fb > 0.97 ? '1' : '0';
    // throughput
    const firstAgent = S.agents[0].a > 0.9 ? 0 : S.agents[1].a > 0.9 ? 1 : -1;
    const toAgent = firstAgent < 0 ? 0 : polyLen([...FLOW_SEG[0], ...(firstAgent ? FLOW_SEG[1] : [])]);
    for (const dt0 of dots) {
      const pts = dt0.route === 'back' ? BACK : ROUTE[dt0.route];
      const L = polyLen(pts);
      dt0.s += (dt * (dt0.route === 'back' ? 80 : 140 + 70 * S.fast)) / L;
      if (dt0.s >= 1) {
        dt0.s -= 1;
        if (dt0.route === 'back') dt0.i = Math.floor(Math.random() * 3);
        else dt0.route = Math.random() < S.m && S.bL > 0.95 && S.cL > 0.95 ? (Math.random() < 0.5 ? 'B' : 'C') : 'A';
      }
      const dist = dt0.s * L, q = polyAt(pts, dist);
      let hide = false;
      for (let i = 0; i < 3; i++) if (Math.hypot(q.x - ST[i].x, q.y - ST[i].y) < r[i] + 2) hide = true;
      if (Math.hypot(q.x - NEWP.x, q.y - NEWP.y) < PERSON_R + 2 && S.people[2].k2 > 0.9) hide = true;
      let on: boolean, green: boolean;
      if (dt0.route === 'back') {
        on = S.meshL > 0.95; green = true;
        for (const mq of MESH) if (Math.hypot(q.x - mq.x, q.y - mq.y) < MESH_R + 2) hide = true;
      } else {
        on = S.inL > 0.95 && S.flow.every((f) => f.v > 0.95) && (dt0.route === 'A' ? S.outA > 0.95 : dt0.route === 'B' ? S.bL > 0.95 : S.cL > 0.95);
        green = firstAgent >= 0 && dist > toAgent;
      }
      dt0.el.setAttribute('cx', q.x.toFixed(1)); dt0.el.setAttribute('cy', q.y.toFixed(1));
      dt0.el.style.opacity = on && !hide ? String(dt0.route === 'A' ? lerp(0.45, 1, S.aFade) : 1) : '0';
      dt0.el.style.fill = green ? signal : dt0.route === 'A' && S.aFade < 0.6 ? ink3 : '';
    }
  }

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'sine.inOut' } });
  // FIG 1 — the firm: people in a line, every step instructed by one centre
  tl.to(S, { fa: 1, duration: 0.2 }, 0).to(S, { hatch: 1, duration: 0.35, ease: 'none' }, 0.12).to(S, { title: 1, duration: 0.15 }, 0.25);
  S.people.forEach((p, i) => tl.to(p, { a: 1, duration: 0.14, ease: 'none' }, 0.3 + i * 0.05));
  tl.to(S, { inL: 1, duration: 0.22 }, 0.35).to(S.flow[0], { v: 1, duration: 0.14 }, 0.45).to(S.flow[1], { v: 1, duration: 0.14 }, 0.52)
    .to(S, { outA: 1, io: 1, duration: 0.2 }, 0.58).to(S, { ctrl: 1, duration: 0.14, ease: 'none' }, 0.62);
  S.bund.forEach((bd, i) => tl.to(bd, { v: 1, duration: 0.2, ease: 'power2.out' }, 0.66 + i * 0.05));
  // FIG 2 — an agent enters with the inputs and settles at one step; its instructions give way to one goal
  tl.to(S, { enter: 1, duration: 0.45, ease: 'power1.in' }, 1.08)
    .to(S.people[1], { k: 1, duration: 0.32, ease: 'back.inOut(1.2)' }, 1.38)
    .to(S.agents[1], { a: 1, duration: 0.32, ease: 'back.out(1.8)' }, 1.5).to(S.agents[1], { pulse: 1, duration: 0.5, ease: 'power2.out' }, 1.5)
    .to(S.bund[1], { die: 1, duration: 0.2, ease: 'none' }, 1.82).to(S, { goal3: 1, duration: 0.25, ease: 'power2.out' }, 2.02);
  // FIG 3 — reorganisation (Plotter's fig 4, one change at a time)
  const F = 2.5;
  S.bund.forEach((bd) => tl.to(bd, { v: 0, duration: 0.22, ease: 'power2.in' }, F));
  tl.to(S, { goal3: 0, duration: 0.2 }, F).to(S, { collapse: 1, duration: 0.2, ease: 'power2.in' }, F + 0.15);
  S.mesh.forEach((m, i) => tl.to(m, { k: 1, duration: 0.5, ease: 'elastic.out(1, 0.6)' }, F + 0.31 + i * 0.04));
  tl.to(S, { spread: 1, duration: 0.3, ease: 'power1.in' }, F + 0.25).to(S, { w: 1, duration: 0.5, ease: 'back.inOut(1.1)' }, F + 0.25).to(S, { wash: 1, duration: 0.6, ease: 'sine.inOut' }, F + 0.45);
  S.people.forEach((p, i) => tl.to(p, { k2: 1, duration: 0.45, ease: 'back.inOut(1.2)' }, F + 0.37 + i * 0.05));
  // the outer steps become agents only once their people have moved clear
  [0, 2].forEach((i) => tl.to(S.agents[i], { a: 1, duration: 0.3, ease: 'back.out(1.8)' }, F + 0.86).to(S.agents[i], { pulse: 1, duration: 0.5, ease: 'power2.out' }, F + 0.86));
  tl.to(S, { meshL: 1, duration: 0.25 }, F + 0.7)
    .to(S, { open: 1, duration: 0.25, ease: 'back.out(1.4)' }, F + 1.07)
    .to(S, { aFade: 0, duration: 0.35, ease: 'none' }, F + 0.9)
    .to(S, { bL: 1, duration: 0.2 }, F + 1.07).to(S, { cL: 1, duration: 0.2 }, F + 1.12).to(S, { bcT: 1, duration: 0.12 }, F + 1.2)
    .to(S, { goalL: 1, revL: 1, duration: 0.15 }, F + 1.17).to(S, { fb: 1, duration: 0.25 }, F + 1.27)
    .to(S, { m: 0.85, fast: 1, duration: 0.2 }, F + 1.25);
  tl.to({}, { duration: 0.01 }, F + 1.75);
  // captions switch where each figure's change becomes visible: the agent settling, coordination collapsing
  const figStarts = [0, 1.45, F + 0.15];
  const setDetail = (a: number) => { gDetail.style.opacity = a >= 0.999 ? '' : a.toFixed(3); };
  return { S, tl, render, home, figStarts, setDetail, boundaryCenter: () => { const bb = box(wall()); return { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2, r: Math.max(bb.w, bb.h) / 2 }; } };
}

export function initStory(introDone: Promise<void>, arrived: boolean) {
  const sec = document.querySelector<HTMLElement>('[data-story]');
  if (!sec) return;
  const RM = reduced();
  const cA = sec.querySelector<HTMLCanvasElement>('[data-field="hero"]')!;
  const cB = sec.querySelector<HTMLCanvasElement>('[data-field="diffuse"]')!;
  const svg = sec.querySelector<SVGSVGElement>('[data-diagram]')!;
  const dg = svg.querySelector<SVGGElement>('[data-dg]')!;
  const inkG = svg.querySelector<SVGGElement>('[data-ink]')!;
  const cS = sec.querySelector<HTMLCanvasElement>('[data-surface]')!;
  const figs = [...sec.querySelectorAll<HTMLElement>('[data-fig]')];
  const cue = sec.querySelector<HTMLElement>('[data-hero-scroll]');
  const stmt = sec.querySelector<HTMLElement>('.story__statement');
  svg.setAttribute('viewBox', mobile() ? '295 -20 500 690' : '180 160 820 400');
  if (!mobile()) svg.setAttribute('preserveAspectRatio', 'xMidYMin meet'); // the diagram's top lines up with the statement

  const opts = { spacing: mobile() ? 20 : 26, seed: 11 };
  const A = new DiffusionField(cA, { ...opts, mode: 'progress', staticT: 0.34, word: true, wordBase: 0.72, global: true, seeds: [[0.14, 0.34], [0.62, 0.2], [0.86, 0.58], [0.4, 0.82]] });
  (window as any).__heroField = A;
  const focus = A.nearest(A.w * 0.46, A.h * 0.5);
  // the diffusion: half the hero's density, no old lattice, adopted nodes stay jade over a pale wash; the firm is marked
  const B = new DiffusionField(cB, { spacing: mobile() ? 27 : 36, seed: 11, mode: 'progress', staticT: 0.62, pointer: true, drawLattice: false, adoptedSignal: true, seeds: [[focus.x / A.w, focus.y / A.h]] });
  B.mark = B.nearest(focus.x, focus.y).k;
  const surf = new HomotopySurface(cS);
  const D = makeDiagram(inkG, mobile());
  const F = D.home;
  onDispose(() => { A.destroy(); B.destroy(); surf.destroy(); if ((window as any).__heroField === A) delete (window as any).__heroField; });

  const setFig = (k: number) => figs.forEach((f, i) => f.classList.toggle('is-active', i === k));

  if (RM) {
    D.tl.progress(1); D.render();
    // reduced motion: one calm, composed frame — the reorganised firm over a faint field, with its caption
    // the field stays to the right of the text column (CSS mask)
    cA.style.opacity = mobile() ? '0' : '0.55'; cB.style.opacity = '0'; cS.style.opacity = '0'; svg.style.opacity = '1'; if (stmt) stmt.style.opacity = '1';
    setFig(2);
    return;
  }

  if (arrived) {
    A.reveal = 1; A.sweep = -1;
    const box = { x: -260 };
    gsap.to(box, { x: innerWidth + 260, duration: 2.2, delay: 0.7, ease: 'sine.inOut', onUpdate: () => { A.sweep = box.x; }, onComplete: () => { A.reveal = 0; A.sweep = -1; } });
  }

  const toScreen = (x: number, y: number) => { const m = svg.getScreenCTM()!, r = svg.getBoundingClientRect(); const pt = new DOMPoint(x, y).matrixTransform(m); return { x: pt.x - r.left, y: pt.y - r.top, k: m.a }; };
  const toSvg = (x: number, y: number) => { const m = svg.getScreenCTM()!.inverse(), r = svg.getBoundingClientRect(); const pt = new DOMPoint(x + r.left, y + r.top).matrixTransform(m); return { x: pt.x, y: pt.y }; };

  let p = 0, curFig = -2;
  const apply = () => {
    const dive = sm(seg(p, P.dive[0], P.dive[1]));
    const back = sm(seg(p, P.back[0], P.back[1]));
    const inFirm = p >= P.dive[0] && p < P.back[1];
    A.wordMul = 1 - sm(seg(p, 0.012, 0.06));
    A.setProgress(0.06 + sm(seg(p, 0, P.dive[0])) * 0.06);
    const bc = D.boundaryCenter();
    const bcs = toScreen(F.x, F.y);
    A.camFocus = [focus.x, focus.y];
    A.camTo = [lerp(focus.x, bcs.x, dive), lerp(focus.y, bcs.y, dive)];
    A.camScale = lerp(1, 9, dive * dive);
    cA.style.opacity = String(p < P.back[0] ? 1 - sm(seg(dive, 0.45, 0.9)) : 0);
    const nodeSvg = toSvg(focus.x, focus.y);
    // on the way out the firm IS the diffusion's marked node: the field's camera zooms out about that node while carrying it from
    // where the firm sits to where the node belongs, and the firm drawing rides on exactly the same point
    const es = 1 - (1 - back) ** 2.2, mk = B.mark, mx0 = B.sx.length > mk ? B.sx[mk] : B.nx[mk], my0 = B.sy.length > mk ? B.sy[mk] : B.ny[mk];
    const bcS = toScreen(bc.x, bc.y), camTo: [number, number] = [lerp(bcS.x, mx0, es), lerp(bcS.y, my0, es)];
    const markSvg = toSvg(camTo[0], camTo[1]);
    const s0 = 3 / Math.max(1, bcs.k * F.r), sEnd = 11 / Math.max(1, bcs.k * F.r); // the firm lands as a node the size of the marked ring
    let s = 1, tx = 0, ty = 0, dop = 0;
    if (p < P.back[0]) { const e = dive; s = lerp(s0, 1, e * e); tx = lerp(nodeSvg.x - F.x, 0, e); ty = lerp(nodeSvg.y - F.y, 0, e); dop = sm(seg(e, 0.02, 0.3)); }
    else { const e = back; s = lerp(1, sEnd * (F.r / bc.r), 1 - (1 - e) ** 2.2); tx = markSvg.x - bc.x; ty = markSvg.y - bc.y; dop = 1 - sm(seg(e, 0.72, 0.98)); }
    const ox = p < P.back[0] ? F.x : bc.x, oy = p < P.back[0] ? F.y : bc.y;
    dg.setAttribute('transform', `translate(${(ox + tx).toFixed(2)} ${(oy + ty).toFixed(2)}) scale(${s.toFixed(4)}) translate(${-ox} ${-oy})`);
    // once the firm is smaller than ~120px on screen its internals fade and it reads as the marked node
    const wPx = s * bc.r * 2 * bcs.k, detail = p < P.back[0] ? 1 : sm(seg(wPx, 60, 125));
    D.setDetail(detail);
    if (p >= P.back[0]) dop = Math.min(dop, sm(seg(wPx, 20, 60)));
    svg.style.opacity = String(inFirm ? dop : 0);
    if (stmt) { const so = inFirm ? sm(seg(dive, 0.55, 1)) * (1 - sm(seg(back, 0, 0.35))) : 0; stmt.style.opacity = String(so); stmt.style.filter = so < 0.99 ? `blur(${((1 - so) * 8).toFixed(1)}px)` : ''; }
    D.tl.progress(seg(p, P.dive[0] + 0.02, P.figs[1]));
    if (p < P.back[0]) D.S.fa = Math.max(D.S.fa, sm(seg(dive, 0, 0.25)));
    A.running && !(p < P.back[0]) && A.stop();
    if (p < P.back[0] && !A.running && A.visible) A.start();
    const bIn = p >= P.back[0];
    B.camFocus = [mx0, my0]; B.camTo = camTo;
    B.camScale = lerp(9, 1, es);
    // adoption is a pure function of scroll: it only grows as you scroll down
    B.setProgress(sm(seg(p, P.diff[0], P.diff[1])));
    B.markA = (1 - sm(seg(wPx, 40, 110))) * (1 - sm(seg(p, P.lift[0] - 0.01, P.lift[0] + 0.01)));
    cB.style.opacity = String(bIn ? sm(seg(back, 0, 0.35)) * (1 - sm(seg(p, P.lift[0] + 0.004, P.lift[0] + 0.016))) : 0);
    if (bIn && !B.running) B.start(); if (!bIn && B.running) B.stop();
    cS.style.opacity = String(sm(seg(p, P.lift[0] - 0.004, P.lift[0] + 0.012)));
    surf.tilt = sm(seg(p, P.lift[0] + 0.012, P.lift[1] + 0.02));
    surf.setProgress(sm(seg(p, P.coda[0], P.coda[1] - 0.04)));
    if (p >= P.lift[0]) { if (!surf.running) surf.start(); } else if (surf.running) surf.stop();
    let k = -1;
    if (p >= P.figs[0] - 0.01 && p < P.back[0] + 0.05) { const t = D.tl.time(); k = D.figStarts.filter((s1) => t >= s1).length - 1; }
    else if (p >= P.back[0] + 0.05 && p < P.lift[0]) k = 3;
    else if (p >= P.lift[0]) k = 4;
    if (k !== curFig) { curFig = k; setFig(k); }
  };

  // a critically damped spring sits between the scroll and the scene, so every change glides in
  let pT = 0, pv = 0;
  const st = ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', onUpdate: (s) => { pT = s.progress; } });
  onDispose(() => st.kill());
  pT = p = st.progress;
  const tick = (_t: number, dms: number) => {
    const dt = Math.min(0.05, dms / 1000), W = 7.5;
    if (Math.abs(pT - p) > 1e-5 || Math.abs(pv) > 1e-5) {
      pv += (W * W * (pT - p) - 2 * W * pv) * dt; p += pv * dt;
      if (Math.abs(pT - p) < 1e-5 && Math.abs(pv) < 1e-4) { p = pT; pv = 0; }
      apply();
    }
    if (svg.style.opacity !== '0') D.render();
  };
  gsap.ticker.add(tick);
  onDispose(() => gsap.ticker.remove(tick));
  D.render(); apply();

  if (cue) {
    gsap.set(cue, { opacity: 0 });
    introDone.then(() => gsap.to(cue, { opacity: 1, duration: 1.2, delay: 1.2, ease: 'sine.out' }));
    const hide = ScrollTrigger.create({ trigger: sec, start: 'top top', end: '+=160', onUpdate: (s) => { cue.style.visibility = s.progress > 0.5 ? 'hidden' : 'visible'; } });
    onDispose(() => hide.kill());
  }
}
