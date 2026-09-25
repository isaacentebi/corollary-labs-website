// The Approach figure — one sticky stage, one scroll progress p ∈ [0,1], four labelled beats.
//
//   0.00–0.58  01–03       the firm: the organisation → an agent enters → it reorganises (figs 1–4 of the diagram;
//                          throughput dots flow input → output the whole time; only the machinery changes)
//   0.58–0.66  04 PULL BACK the recomposed firm shrinks back into its node; the field returns around it
//   0.66–0.84  04 SPREAD    diffusion: the same reorganisation spreads node to node through the field
//   0.84–0.88  LIFT        the lattice is seen from above, then tilts into 3D
//   0.88–1.00  CODA        homotopy: the sheet twists, tears and re-glues into a torus
import { gsap, ScrollTrigger, onDispose, reduced, lenis } from './core';
import { DiffusionField } from './field';
import { HomotopySurface } from './surface';

const NS = 'http://www.w3.org/2000/svg';
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const sm = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mobile = () => innerWidth < 700;
const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

const P = { figs: [0, 0.58], back: [0.58, 0.66], diff: [0.66, 0.84], lift: [0.84, 0.88], coda: [0.88, 1] } as const;

// ── the diagram (see storyboard/index.html). One change per figure; state is animated by a timeline and rendered every
//    frame. Geometry is written along the flow (u) and across it (v); phones turn the flow vertical.
//   FIG 1  THE FIRM          inputs pass person to person to OUTPUT A; every step takes instructions from one COORDINATION centre
//   FIG 2  AUTOMATION ENTERS green arrives through the same door as the inputs and settles at one step as an AGENT;
//                            the person there steps aside; the wiring and the output are unchanged
//   FIG 3  WHAT IT NEEDS     that step's bundle of instructions dies; one green GOAL line replaces it
//   FIG 4  REORGANISATION    the instructions retract and coordination collapses into small agents that settle between the
//                            steps as a mesh (work passes back and forth); the agent spreads to every step;
//                            to each other; people move to the edges, where a loop runs out of the flow, through them and
//                            back in (left unlabelled: it reads as steering, review or recursion); one moves to new work; the boundary is redrawn and opened; OUTPUT A fades, OUTPUT B and C appear
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
// a stretch of a polyline between two distances (the travelling green "comet")
const polySlice = (pts: Pt[], d0: number, d1: number, n = 10): Pt[] => Array.from({ length: n + 1 }, (_, i) => polyAt(pts, lerp(Math.max(0, d0), d1, i / n)));

function makeDiagram(root: SVGGElement, small = false) {
  const el = (tag: string, attrs: Record<string, string | number> = {}, parent: Element = root) => {
    const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); parent.appendChild(e); return e;
  };
  const signal = css('--signal'), ink3 = css('--ink-3');

  // flow coordinates → viewBox
  const M = (u: number, v: number): Pt => (small ? { x: 560 + (v - 190) * 1.5, y: -20 + u * 0.88 } : { x: 150 + u * 1.1, y: 150 + v * 1.1 });
  const FL = 180, U0 = 40, END = small ? 730 : 760;
  const ST = [278, 398, 518].map((u) => M(u, FL)); // the three steps
  const W0 = { u0: 200, u1: 600, v0: 90, v1: 330 }, W1 = { u0: 170, u1: 640, v0: 30, v1: 300 };
  const CTRL = M(400, 286), ANCH = [353, 400, 447].map((u) => M(u, 272));
  const ASIDE = M(455, 128), GOALP = M(279, 105), REVP = M(520, 105), NEWP = M(600, 236);
  const OUTV = { A: 180, B: 120, C: 236 } as const;
  type Out = keyof typeof OUTV;
  const outPts = (k: Out): Pt[] => (k === 'A' ? [ST[2], M(END, FL)] : [ST[2], M(k === 'C' ? 600 : 640, OUTV[k]), M(END, OUTV[k])]); // new work on C passes through a person
  // coordination's small agents: where they settle, and how they link to each other and to the steps
  const MESH = [M(322, 236), M(361, 263), M(400, 238), M(439, 263), M(478, 236)];
  const MESH_LINKS: [Pt, Pt][] = [[ST[0], MESH[0]], [MESH[0], MESH[1]], [MESH[1], MESH[2]], [MESH[2], MESH[3]], [MESH[3], MESH[4]], [MESH[4], ST[2]], [MESH[0], MESH[2]], [MESH[2], MESH[4]], [MESH[2], ST[1]]];
  const BACK = [ST[2], MESH[4], MESH[3], MESH[2], MESH[1], MESH[0], ST[0]]; // work passed back upstream through the mesh
  const MESH_R = 6;
  const IN = M(U0, FL);
  const PERSON_R = 15, AGENT_R = 25;

  const S = {
    w: 0, open: 0, fa: 0, hatch: 0, title: 0, collapse: 0,
    mesh: [0, 1, 2, 3, 4].map(() => ({ k: 0 })), meshL: 0,
    inL: 0, io: 0, flow: [0, 1].map(() => ({ v: 0 })), outA: 0, aFade: 1,
    ctrl: 0,
    bund: [0, 1, 2].map(() => ({ v: 0, die: 0 })),
    people: [0, 1, 2].map(() => ({ a: 0, k: 0, k2: 0 })),
    agents: [0, 1, 2].map(() => ({ a: 0, pulse: 0 })),
    enter: 0, spread: 0, goal3: 0,
    goalL: 0, revL: 0, fb: 0, bL: 0, cL: 0, bcT: 0, fast: 0,
    m: 0, // share of throughput on the new outputs
  };

  // boundary: rect interpolated W0 → W1, opened on the output side
  const wall = () => { const t = S.w; return { u0: lerp(W0.u0, W1.u0, t), u1: lerp(W0.u1, W1.u1, t), v0: lerp(W0.v0, W1.v0, t), v1: lerp(W0.v1, W1.v1, t) }; };
  const box = (w: { u0: number; u1: number; v0: number; v1: number }) => { const a = M(w.u0, w.v0), b = M(w.u1, w.v1); return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }; };
  const home = (() => { const b = box(W0); return { x: b.x + b.w / 2, y: b.y + b.h / 2, r: Math.max(b.w, b.h) / 2 }; })();

  const defs = root.ownerSVGElement!.querySelector('defs')!;
  const clip = el('clipPath', { id: 'firm-clip' }, defs); const clipR = el('rect', {}, clip);
  const gForm = el('g', {});
  const hatchG = el('g', { 'clip-path': 'url(#firm-clip)' }, gForm);
  let hd = ''; for (let k = -1400; k <= 1400; k += 13) hd += `M${600 + k - 500} ${350 + 500} L${600 + k + 500} ${350 - 500} `;
  el('path', { class: 'dg-hatch -light', d: hd }, hatchG);
  const form = el('path', { class: 'dg-form' }, gForm);
  const title = el('g', { class: 'dg-chip' }); el('rect', { width: 96, height: 32, rx: 1 }, title); const titleT = el('text', { x: 48, y: 22, 'text-anchor': 'middle', class: 'dg-label -strong' }, title); titleT.textContent = 'FIRM';

  const wire = (cls = 'dg-link') => el('path', { class: cls, pathLength: 1 }) as SVGPathElement;
  // control and its instruction bundles (three strands per step)
  const bundW = S.bund.map(() => [0, 1, 2].map(() => wire('dg-link -thin')));
  const goal3W = wire('dg-link -signal'); const goal3H = el('path', { class: 'dg-head -signal' });
  const ctrl = el('g', { class: 'dg-chip', transform: `translate(${CTRL.x} ${CTRL.y})` }); const ctrlR = el('rect', { x: -80, y: -15, width: 160, height: 30, rx: 1 }, ctrl);
  const ctrlT = el('text', { class: 'dg-label', 'text-anchor': 'middle', y: 6 }, ctrl); ctrlT.textContent = 'COORDINATION';
  // the flow
  const inW = wire(), flowW = S.flow.map(() => wire()), aW = wire(), bW = wire('dg-link -signal'), cW = wire('dg-link -signal');
  const heads = { A: el('path', { class: 'dg-head' }), B: el('path', { class: 'dg-head -signal' }), C: el('path', { class: 'dg-head -signal' }) };
  // fig 4 relations
  const meshW = MESH_LINKS.map(() => wire('dg-link -signal -thin'));
  const meshEls = MESH.map(() => el('circle', { class: 'dg-form -signal -agent', r: MESH_R }) as SVGCircleElement);
  const meshPulse = MESH.map(() => el('circle', { class: 'dg-pulse' }) as SVGCircleElement);
  const goalW = wire('dg-link -signal'), revW = wire('dg-link -signal'), fbW = wire('dg-link -signal');
  const goalH = el('path', { class: 'dg-head -signal' }), revH = el('path', { class: 'dg-head -signal' }), fbH = el('path', { class: 'dg-head -signal' });
  const fbPts = quad(REVP, M(400, 30), GOALP, 24);
  // comets and pulses
  const comet = wire('dg-link -signal -comet');
  const spreadW = [wire('dg-link -signal -comet'), wire('dg-link -signal -comet')];
  const pulses = S.agents.map(() => el('circle', { class: 'dg-pulse', r: AGENT_R }) as SVGCircleElement);
  // people and agents
  const agentEls = S.agents.map((_, i) => { const g = el('g', {}); const c = el('circle', { class: 'dg-form -signal -agent', cx: ST[i].x, cy: ST[i].y, r: AGENT_R, pathLength: 1 }, g) as SVGCircleElement; const t = el('text', { class: 'dg-label -tiny -signal', 'text-anchor': 'middle', x: ST[i].x, y: ST[i].y + 4 }, g); t.textContent = 'AGENT'; return { g, c, t }; });
  const personEls = S.people.map(() => el('circle', { class: 'dg-role', r: PERSON_R }) as SVGCircleElement);

  // labels: desktop and phone placements differ
  type LP = { dx: number; dy: number; a: 'start' | 'middle' | 'end' };
  const label = (t: string, at: Pt, d: LP, m: LP, cls = 'dg-label') => { const o = small ? m : d; const e = el('text', { class: cls, x: at.x + o.dx, y: at.y + o.dy, 'text-anchor': o.a }); e.textContent = t; return e; };
  const inT = label('INPUTS', IN, { dx: 0, dy: -14, a: 'start' }, { dx: 14, dy: 6, a: 'start' });
  const outT = {
    A: label('OUTPUT A', M(END, OUTV.A), { dx: 0, dy: -14, a: 'end' }, { dx: 0, dy: 30, a: 'middle' }),
    B: label('OUTPUT B', M(END, OUTV.B), { dx: 0, dy: -14, a: 'end' }, { dx: -12, dy: 6, a: 'end' }),
    C: label('OUTPUT C', M(END, OUTV.C), { dx: 0, dy: -14, a: 'end' }, { dx: 12, dy: 6, a: 'start' }),
  };
  const g3Mid = lerpPt(ANCH[1], ST[1], 0.5);
  const goal3T = label('GOAL', g3Mid, { dx: 12, dy: 6, a: 'start' }, { dx: 0, dy: -12, a: 'middle' }, 'dg-label -small -signal');

  // throughput
  const gDots = el('g', {});
  type Dot = { s: number; route: Out | 'back'; i: number; el: SVGRectElement };
  const dots: Dot[] = [
    ...Array.from({ length: 14 }, (_, k): Dot => ({ s: k / 14, route: 'A', i: 0, el: el('rect', { class: 'dg-dot', width: 6, height: 6 }, gDots) as SVGRectElement })),
    ...Array.from({ length: 5 }, (_, k): Dot => ({ s: k / 5, route: 'back', i: k % 3, el: el('rect', { class: 'dg-dot', width: 5, height: 5 }, gDots) as SVGRectElement })),
  ];

  const head = (x: number, y: number, ang: number, l = 11, w = 0.38) => `M${x - l * Math.cos(ang - w)} ${y - l * Math.sin(ang - w)} L${x} ${y} L${x - l * Math.cos(ang + w)} ${y - l * Math.sin(ang + w)}`;
  const headAt = (pts: Pt[], back = 0) => { const b = pts[pts.length - 1], a = pts[pts.length - 2]; const ang = Math.atan2(b.y - a.y, b.x - a.x); return head(b.x - Math.cos(ang) * back, b.y - Math.sin(ang) * back, ang); };
  const draw = (e: SVGGeometryElement, p: number, a = 1) => { e.style.strokeDasharray = p >= 0.995 ? 'none' : '1 1'; e.style.strokeDashoffset = String(1 - p); e.style.opacity = p > 0.001 ? String(a) : '0'; };
  const trim = (a: Pt, b: Pt, ra: number, rb: number): Pt[] => { const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d; return [{ x: a.x + ux * ra, y: a.y + uy * ra }, { x: b.x - ux * rb, y: b.y - uy * rb }]; };
  const personPos = (i: number) => { const p = S.people[i]; const mid = i === 1 ? lerpPt(ST[1], ASIDE, p.k) : ST[i]; return lerpPt(mid, [GOALP, REVP, NEWP][i], p.k2); };
  const stepR = (i: number) => { const here = 1 - clamp((S.people[i].k + S.people[i].k2) * 4); return Math.max(3, here * PERSON_R, S.agents[i].a * AGENT_R); };

  let last = performance.now();
  function render(now = performance.now()) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    // boundary
    const w = wall(), b = box(w), mid = (w.v0 + w.v1) / 2;
    const gA = lerp(mid, w.v0 + 70, S.open), gB = lerp(mid, w.v1 - 40, S.open);
    form.setAttribute('d', polyD([M(w.u1, gA), M(w.u1, w.v0), M(w.u0, w.v0), M(w.u0, w.v1), M(w.u1, w.v1), M(w.u1, gB)]));
    for (const [k, v] of Object.entries({ x: b.x, y: b.y, width: b.w, height: b.h })) clipR.setAttribute(k, v.toFixed(1));
    (form as SVGElement).style.opacity = String(S.fa); hatchG.style.opacity = String(S.hatch * 0.55);
    title.setAttribute('transform', `translate(${(b.x + 16).toFixed(1)} ${(b.y - 16).toFixed(1)})`); title.style.opacity = String(S.title);
    // control, dying in fig 4
    // coordination collapses to a point, and small agents burst out of it
    const dead = false, cs = 1 - S.collapse;
    ctrl.setAttribute('transform', `translate(${CTRL.x} ${CTRL.y}) scale(${Math.max(0.001, cs).toFixed(3)} ${Math.max(0.001, cs * cs).toFixed(3)})`);
    ctrl.style.opacity = String(S.ctrl * (S.collapse < 0.98 ? 1 : 0)); ctrlT.style.opacity = String(1 - clamp(S.collapse * 2.5));
    S.bund.forEach((bd, i) => {
      const [a0, b0] = trim(ANCH[i], ST[i], 0, stepR(i) + 2);
      const d = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1, nx = -(b0.y - a0.y) / d, ny = (b0.x - a0.x) / d;
      const die = bd.die;
      bundW[i].forEach((e, j) => {
        const o = (j - 1) * 7;
        e.setAttribute('d', polyD([{ x: a0.x + nx * o, y: a0.y + ny * o }, { x: b0.x + nx * o, y: b0.y + ny * o }]));
        draw(e, bd.v, 1 - 0.65 * die); e.classList.toggle('-dead', die > 0.5);
      });
    });
    const g3 = trim(ANCH[1], ST[1], 0, AGENT_R + 4);
    goal3W.setAttribute('d', polyD(g3)); draw(goal3W, S.goal3);
    goal3H.setAttribute('d', headAt(g3)); goal3H.style.opacity = S.goal3 > 0.97 && !dead ? '1' : '0';
    goal3T.style.opacity = String(S.goal3 > 0.9 ? 1 : 0);
    // the flow
    const r = [0, 1, 2].map(stepR);
    const inP = trim(IN, ST[0], 0, r[0] + 2); inW.setAttribute('d', polyD(inP)); draw(inW, S.inL);
    S.flow.forEach((f, i) => { const p = trim(ST[i], ST[i + 1], r[i] + 2, r[i + 1] + 2); flowW[i].setAttribute('d', polyD(p)); draw(flowW[i], f.v); flowW[i].classList.toggle('-signal', S.agents[i].a > 0.9 && S.agents[i + 1].a > 0.9); });
    const aP = trim(ST[2], M(END, FL), r[2] + 2, 0);
    aW.setAttribute('d', polyD(aP)); draw(aW, S.outA, lerp(1, 0.55, 1 - S.aFade)); aW.classList.toggle('-dead', S.aFade < 0.6);
    heads.A.setAttribute('d', headAt(aP)); heads.A.style.opacity = S.outA > 0.97 ? String(lerp(0.55, 1, S.aFade)) : '0'; heads.A.style.stroke = S.aFade < 0.6 ? ink3 : '';
    const bP = outPts('B'), cP = outPts('C'); bP[0] = trim(ST[2], bP[1], AGENT_R + 2, 0)[0]; cP[0] = trim(ST[2], cP[1], AGENT_R + 2, 0)[0];
    bW.setAttribute('d', polyD(bP)); draw(bW, S.bL); heads.B.setAttribute('d', headAt(bP)); heads.B.style.opacity = S.bL > 0.97 ? '1' : '0';
    cW.setAttribute('d', polyD(cP)); draw(cW, S.cL); heads.C.setAttribute('d', headAt(cP)); heads.C.style.opacity = S.cL > 0.97 ? '1' : '0';
    inT.style.opacity = String(S.io); outT.A.style.opacity = String(S.io * lerp(0.5, 1, S.aFade)); outT.A.style.fill = S.aFade < 0.6 ? ink3 : '';
    outT.B.style.opacity = outT.C.style.opacity = String(S.bcT);
    // people and agents
    S.people.forEach((p, i) => { const q = personPos(i); personEls[i].setAttribute('cx', q.x.toFixed(1)); personEls[i].setAttribute('cy', q.y.toFixed(1)); personEls[i].style.opacity = String(p.a); });
    S.agents.forEach((a, i) => {
      draw(agentEls[i].c, a.a); agentEls[i].t.style.opacity = String(a.a > 0.9 ? 1 : 0);
      const pl = pulses[i]; pl.setAttribute('cx', String(ST[i].x)); pl.setAttribute('cy', String(ST[i].y)); pl.setAttribute('r', (AGENT_R + a.pulse * 46).toFixed(1));
      pl.style.opacity = a.pulse > 0 && a.pulse < 1 ? String((1 - a.pulse) * 0.9) : '0';
    });
    // green arriving through the same door as the inputs, then spreading from the agent to its neighbours
    const enterPath = [IN, ST[0], ST[1]], eL = polyLen(enterPath), eD = S.enter * eL;
    comet.setAttribute('d', polyD(polySlice(enterPath, eD - 90, eD))); comet.style.opacity = S.enter > 0 && S.enter < 1 ? '1' : '0';
    [[ST[1], ST[0]], [ST[1], ST[2]]].forEach((seg2, i) => { const L = polyLen(seg2), d = S.spread * L; spreadW[i].setAttribute('d', polyD(polySlice(seg2, d - 60, d))); spreadW[i].style.opacity = S.spread > 0 && S.spread < 1 ? '1' : '0'; });
    // fig 4 relations
    S.mesh.forEach((m, i) => {
      const q = lerpPt(CTRL, MESH[i], sm(m.k)), on = m.k > 0.001;
      meshEls[i].setAttribute('cx', q.x.toFixed(1)); meshEls[i].setAttribute('cy', q.y.toFixed(1));
      meshEls[i].setAttribute('r', (MESH_R * (1 + 0.7 * Math.sin(Math.PI * clamp(m.k)))).toFixed(1)); meshEls[i].style.opacity = on ? '1' : '0';
      const pk = seg(m.k, 0.85, 1); meshPulse[i].setAttribute('cx', MESH[i].x.toFixed(1)); meshPulse[i].setAttribute('cy', MESH[i].y.toFixed(1)); meshPulse[i].setAttribute('r', (MESH_R + pk * 18).toFixed(1));
      meshPulse[i].style.opacity = pk > 0 && pk < 1 ? String(1 - pk) : '0';
    });
    MESH_LINKS.forEach(([a, b2], i) => { const ra = ST.includes(a) ? AGENT_R + 2 : MESH_R + 2, rb = ST.includes(b2) ? AGENT_R + 2 : MESH_R + 2; meshW[i].setAttribute('d', polyD(trim(a, b2, ra, rb))); draw(meshW[i], S.meshL, 0.85); });
    const gP = trim(GOALP, ST[0], PERSON_R + 2, AGENT_R + 4); goalW.setAttribute('d', polyD(gP)); draw(goalW, S.goalL); goalH.setAttribute('d', headAt(gP)); goalH.style.opacity = S.goalL > 0.97 ? '1' : '0';
    const rP = trim(ST[2], REVP, AGENT_R + 2, PERSON_R + 4); revW.setAttribute('d', polyD(rP)); draw(revW, S.revL); revH.setAttribute('d', headAt(rP)); revH.style.opacity = S.revL > 0.97 ? '1' : '0';
    const fP = fbPts.slice(2, -2); fbW.setAttribute('d', polyD(fP)); draw(fbW, S.fb); fbH.setAttribute('d', headAt(fP)); fbH.style.opacity = S.fb > 0.97 ? '1' : '0';
    // throughput: inputs → the steps → outputs; in fig 4 the agents also pass work back to each other
    const firstAgent = S.agents[0].a > 0.9 ? 0 : S.agents[1].a > 0.9 ? 1 : -1;
    for (const d of dots) {
      let pts: Pt[];
      if (d.route === 'back') pts = BACK;
      else pts = [IN, ...ST, ...(d.route === 'A' ? [M(END, FL)] : outPts(d.route).slice(1))];
      const L = polyLen(pts);
      d.s += (dt * (d.route === 'back' ? 80 : 150 + 70 * S.fast)) / L; // throughput rises after the reorganisation
      if (d.s >= 1) {
        d.s -= 1;
        if (d.route === 'back') d.i = Math.floor(Math.random() * 3);
        else d.route = Math.random() < S.m && S.bL > 0.95 && S.cL > 0.95 ? (Math.random() < 0.5 ? 'B' : 'C') : 'A';
      }
      const dist = d.s * L, q = polyAt(pts, dist);
      let hide = false;
      for (let i = 0; i < 3; i++) if (Math.hypot(q.x - ST[i].x, q.y - ST[i].y) < r[i] + 2) hide = true;
      if (Math.hypot(q.x - NEWP.x, q.y - NEWP.y) < PERSON_R + 2 && S.people[2].k2 > 0.9) hide = true;
      let on: boolean, green: boolean;
      if (d.route === 'back') {
        on = S.meshL > 0.95; green = true;
        for (const mq of MESH) if (Math.hypot(q.x - mq.x, q.y - mq.y) < MESH_R + 2) hide = true;
      } else {
        on = S.inL > 0.95 && S.flow.every((f) => f.v > 0.95) && (d.route === 'A' ? S.outA > 0.95 : d.route === 'B' ? S.bL > 0.95 : S.cL > 0.95);
        green = firstAgent >= 0 && dist > polyLen([IN, ...ST.slice(0, firstAgent + 1)]);
      }
      d.el.setAttribute('x', (q.x - 3).toFixed(1)); d.el.setAttribute('y', (q.y - 3).toFixed(1));
      d.el.style.opacity = on && !hide ? String(d.route === 'A' ? lerp(0.45, 1, S.aFade) : 1) : '0';
      d.el.style.fill = green ? signal : d.route === 'A' && S.aFade < 0.6 ? ink3 : '';
    }
  }

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
  // FIG 1 — the firm: people in a line, every step instructed by one centre
  tl.to(S, { fa: 1, duration: 0.2 }, 0).to(S, { hatch: 1, duration: 0.3, ease: 'none' }, 0.15).to(S, { title: 1, duration: 0.15 }, 0.25);
  S.people.forEach((p, i) => tl.to(p, { a: 1, duration: 0.1, ease: 'none' }, 0.3 + i * 0.04));
  tl.to(S, { inL: 1, duration: 0.2 }, 0.35).to(S.flow[0], { v: 1, duration: 0.12 }, 0.45).to(S.flow[1], { v: 1, duration: 0.12 }, 0.52)
    .to(S, { outA: 1, io: 1, duration: 0.2 }, 0.58).to(S, { ctrl: 1, duration: 0.12, ease: 'none' }, 0.62);
  S.bund.forEach((bd, i) => tl.to(bd, { v: 1, duration: 0.18 }, 0.66 + i * 0.05));
  // FIG 2 — automation enters through the same door as the inputs and settles at one step
  tl.to(S, { enter: 1, duration: 0.45, ease: 'power1.in' }, 1.08)
    .to(S.people[1], { k: 1, duration: 0.3, ease: 'power3.inOut' }, 1.38)
    .to(S.agents[1], { a: 1, duration: 0.25 }, 1.5).to(S.agents[1], { pulse: 1, duration: 0.45, ease: 'power2.out' }, 1.5);
  // FIG 3 — what the agent needs: its bundle of instructions dies; a single goal replaces it
  tl.to(S.bund[1], { die: 1, duration: 0.25, ease: 'none' }, 2.1).to(S, { goal3: 1, duration: 0.25 }, 2.4);
  // FIG 4 — reorganisation, one change at a time: the instructions retract → coordination collapses into small agents that
  //          settle between the steps → the boundary is redrawn, the agent spreads to every step, people move to the edges → the mesh links up →
  //          the boundary opens → the old output fades, new outputs → the loop closes
  S.bund.forEach((bd) => tl.to(bd, { v: 0, duration: 0.2 }, 3.05));
  tl.to(S, { goal3: 0, duration: 0.2 }, 3.05).to(S, { collapse: 1, duration: 0.2, ease: 'power2.in' }, 3.2);
  S.mesh.forEach((m, i) => tl.to(m, { k: 1, duration: 0.35, ease: 'power2.out' }, 3.36 + i * 0.04));
  tl.to(S, { spread: 1, duration: 0.3, ease: 'power1.in' }, 3.3).to(S, { w: 1, duration: 0.45, ease: 'power3.inOut' }, 3.3);
  S.people.forEach((p, i) => tl.to(p, { k2: 1, duration: 0.45, ease: 'power3.inOut' }, 3.42 + i * 0.05));
  [0, 2].forEach((i) => tl.to(S.agents[i], { a: 1, duration: 0.2 }, 3.6).to(S.agents[i], { pulse: 1, duration: 0.45, ease: 'power2.out' }, 3.6));
  tl.to(S, { meshL: 1, duration: 0.25 }, 3.75)
    .to(S, { open: 1, duration: 0.2 }, 4.12)
    .to(S, { aFade: 0, duration: 0.35, ease: 'none' }, 3.95)
    .to(S, { bL: 1, duration: 0.2 }, 4.12).to(S, { cL: 1, duration: 0.2 }, 4.17).to(S, { bcT: 1, duration: 0.12 }, 4.25)
    .to(S, { goalL: 1, revL: 1, duration: 0.15 }, 4.22).to(S, { fb: 1, duration: 0.25 }, 4.32)
    .to(S, { m: 0.85, fast: 1, duration: 0.2 }, 4.3);
  tl.to({}, { duration: 0.01 }, 4.6);
  // when each figure's first visible change begins on the timeline: the caption switches exactly there
  const figStarts = [0, 1.08, 2.1, 3.05];
  return { S, tl, render, home, figStarts, boundaryCenter: () => { const bb = box(wall()); return { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2, r: Math.max(bb.w, bb.h) / 2 }; } };
}

export function initStory() {
  const sec = document.querySelector<HTMLElement>('[data-story]');
  if (!sec) return;
  const RM = reduced();
  const cB = sec.querySelector<HTMLCanvasElement>('[data-field="diffuse"]')!;
  const svg = sec.querySelector<SVGSVGElement>('[data-diagram]')!;
  const dg = svg.querySelector<SVGGElement>('[data-dg]')!;
  const inkG = svg.querySelector<SVGGElement>('[data-ink]')!;
  const cS = sec.querySelector<HTMLCanvasElement>('[data-surface]')!;
  const beats = [...sec.querySelectorAll<HTMLButtonElement>('[data-beat]')];
  svg.setAttribute('viewBox', mobile() ? '295 -20 500 690' : '175 140 830 420'); // crop to the firm

  const D = makeDiagram(inkG, mobile());
  const F = D.home; // where the firm sits in the diagram
  // map a diagram point (viewBox units) to stage pixels and back
  const toScreen = (x: number, y: number) => { const m = svg.getScreenCTM()!, r = svg.getBoundingClientRect(); const pt = new DOMPoint(x, y).matrixTransform(m); return { x: pt.x - r.left, y: pt.y - r.top, k: m.a }; };
  const toSvg = (x: number, y: number) => { const m = svg.getScreenCTM()!.inverse(), r = svg.getBoundingClientRect(); const pt = new DOMPoint(x + r.left, y + r.top).matrixTransform(m); return { x: pt.x, y: pt.y }; };

  // the field the firm pulls back into: seeded at the firm's own node
  const home0 = toScreen(F.x, F.y), sr = cB.getBoundingClientRect();
  const B = new DiffusionField(cB, { mode: 'progress', spacing: mobile() ? 20 : 26, seed: 11, staticT: 0.5, pointer: true, seeds: [[home0.x / Math.max(1, sr.width), home0.y / Math.max(1, sr.height)]] });
  const focus = B.nearest(home0.x, home0.y);
  const surf = new HomotopySurface(cS);
  B.enabled = false; surf.enabled = false; B.stop(); surf.stop();
  onDispose(() => { B.destroy(); surf.destroy(); });

  let curBeat = -2;
  const setBeat = (k: number) => beats.forEach((b, i) => { b.classList.toggle('is-active', i === k); b.classList.toggle('is-past', i < k); b.setAttribute('aria-current', i === k ? 'step' : 'false'); });

  if (RM) {
    D.tl.progress(1); D.render();
    cB.style.opacity = '0'; cS.style.opacity = '0'; svg.style.opacity = '1';
    beats.forEach((b) => b.classList.add('is-active'));
    return;
  }

  let p = 0, onStage = false;
  const apply = () => {
    const back = sm(seg(p, P.back[0], P.back[1]));
    const inFirm = p < P.back[1];
    const bc = D.boundaryCenter();
    const bcs = toScreen(F.x, F.y);
    // diagram: full size through beats 01–03, then shrinks back into its node
    const nodeSvg = toSvg(focus.x, focus.y);
    const s0 = 3 / Math.max(1, bcs.k * F.r);
    let s = 1, tx = 0, ty = 0, dop = 1;
    if (p >= P.back[0]) { const e = back; s = lerp(1, s0 * (F.r / bc.r), e * e * 0.999 + 0.001 * e); tx = lerp(0, nodeSvg.x - bc.x, e); ty = lerp(0, nodeSvg.y - bc.y, e); dop = 1 - sm(seg(e, 0.35, 0.8)); }
    const ox = p < P.back[0] ? F.x : bc.x, oy = p < P.back[0] ? F.y : bc.y;
    dg.setAttribute('transform', `translate(${(ox + tx).toFixed(2)} ${(oy + ty).toFixed(2)}) scale(${s.toFixed(4)}) translate(${-ox} ${-oy})`);
    svg.style.opacity = String(inFirm ? dop : 0);
    D.tl.progress(seg(p, P.figs[0], P.figs[1] - 0.03));
    // field B: returns around the node, then the recomposition spreads from it
    const bIn = p >= P.back[0] && p < P.lift[1];
    B.camFocus = [focus.x, focus.y]; B.camTo = [focus.x, focus.y];
    B.camScale = lerp(9, 1, back);
    B.setProgress(sm(seg(p, P.diff[0], P.diff[1])));
    cB.style.opacity = String(p >= P.back[0] ? sm(seg(back, 0.3, 0.8)) * (1 - sm(seg(p, P.lift[0] + 0.012, P.lift[1]))) : 0);
    B.enabled = bIn && onStage; if (B.enabled && !B.running) B.start(); if (!B.enabled && B.running) B.stop();
    // coda: the lattice seen from above tilts into 3D and deforms
    cS.style.opacity = String(sm(seg(p, P.lift[0] - 0.008, P.lift[0] + 0.022)));
    surf.tilt = sm(seg(p, P.lift[1], P.coda[0] + 0.03));
    // desktop: as the sheet tilts into the torus it slides right, clear of the legend
    cS.style.transform = mobile() ? '' : `translateX(${(surf.tilt * 15).toFixed(2)}vw)`;
    surf.setProgress(sm(seg(p, P.coda[0], P.coda[1] - 0.02)));
    surf.enabled = p >= P.lift[0] - 0.01 && onStage; if (surf.enabled && !surf.running) surf.start(); if (!surf.enabled && surf.running) surf.stop();
    // legend: 01 the organisation · 02 an agent enters (figs 2–3) · 03 it reorganises · 04 the change spreads
    const t = D.tl.time();
    const k = p >= P.back[0] ? 3 : t >= D.figStarts[3] ? 2 : t >= D.figStarts[1] ? 1 : 0;
    if (k !== curBeat) { curBeat = k; setBeat(k); }
  };

  const st = ScrollTrigger.create({ trigger: sec, start: mobile() ? 'top 35%' : 'top 45%', end: 'bottom bottom', onUpdate: (self) => { p = self.progress; apply(); } });
  onDispose(() => st.kill());
  // the legend is also a control: each beat scrolls the figure to where that beat begins
  const beatP = [0.005, seg(D.figStarts[1] + 0.05, 0, D.tl.duration()) * (P.figs[1] - 0.03), seg(D.figStarts[3] + 0.05, 0, D.tl.duration()) * (P.figs[1] - 0.03), P.diff[1] - 0.02];
  beats.forEach((b, i) => {
    const go = () => { const y = st.start + (st.end - st.start) * beatP[i]; lenis ? lenis.scrollTo(y, { duration: 1.2 }) : scrollTo({ top: y, behavior: 'smooth' }); };
    b.addEventListener('click', go);
  });
  // render on demand: the diagram's own frame loop and its ink boil only run while the stage is on screen
  const io = new IntersectionObserver((e) => { onStage = e[0].isIntersecting; apply(); }, { rootMargin: '5% 0px' });
  io.observe(sec.querySelector('[data-stage]')!);
  onDispose(() => io.disconnect());
  const tick = () => { if (onStage && svg.style.opacity !== '0') D.render(); };
  gsap.ticker.add(tick);
  onDispose(() => gsap.ticker.remove(tick));
  const turb = svg.querySelector('[data-boil]'); let seed = 1;
  const iv = window.setInterval(() => { if (onStage && turb && svg.style.opacity !== '0') turb.setAttribute('seed', String((seed = (seed % 6) + 1))); }, 140);
  onDispose(() => clearInterval(iv));
  D.render(); apply();
}
