// The home story — one stage, one scroll progress p ∈ [0,1], three zoom levels.
//
//   0.00–0.06  HERO        the diffusion field; the name lives in it (cursor reveals, clicks seed)
//   0.06–0.15  DIVE        the camera falls into one node; it resolves into the firm
//   0.15–0.62  FIGS 1–4    the firm: holding routines → decoupling → redundancy → recomposition
//                          (throughput dots flow input → output the whole time; only the machinery changes)
//   0.62–0.70  PULL BACK   the recomposed firm shrinks back into its node; the field returns around it
//   0.70–0.84  FIG 5       diffusion: the same recomposition spreads node to node through the field
//   0.84–0.88  LIFT        the lattice is seen from above, then tilts into 3D
//   0.88–1.00  CODA        homotopy: the sheet twists, tears and re-glues into a torus
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

const P = { dive: [0.06, 0.15], figs: [0.15, 0.62], back: [0.62, 0.7], diff: [0.7, 0.84], lift: [0.84, 0.88], coda: [0.88, 1] } as const;

// ── the diagram: named forms, one change per figure. State is animated by a timeline and rendered every frame.
//   FIG 1  a firm (large hatched form) holding JUDGEMENT · RISK · RELATIONS · EXECUTION; three roles run execution
//   FIG 2  EXECUTION leaves the form and becomes an AGENT outside it; the firm now BUYS what it used to make
//   FIG 3  the roles that ran execution lose their work (grey), then their tethers
//   FIG 4  the form contracts until it holds only JUDGEMENT · RISK · RELATIONS
export const FIRM = { x: 560, y: 380, r: 205 };
function makeDiagram(root: SVGGElement, small = false) {
  const el = (tag: string, attrs: Record<string, string | number> = {}, parent: Element = root) => {
    const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); parent.appendChild(e); return e;
  };
  const signal = css('--signal'), ink = css('--ink'), ink3 = css('--ink-3');
  const S = {
    r: FIRM.r, fa: 0, hatch: 0, // firm form
    io: 0, inL: 0, outL: 0, // input/output arrows
    title: 0,
    lines: [
      { t: 'JUDGEMENT', a: 0, y: 0 },
      { t: 'RISK', a: 0, y: 0 },
      { t: 'RELATIONS', a: 0, y: 0 },
    ],
    ex: { a: 0, x: FIRM.x, y: FIRM.y + 92, green: 0 }, // EXECUTION chip
    roles: [0, 1, 2].map((i) => ({ a: 0, grey: 0, tether: 0, x: FIRM.x - 46 + i * 46, y: FIRM.y + 150 })),
    agent: small ? { a: 0, x: 770, y: 90, r: 68 } : { a: 0, x: 930, y: 175, r: 72 },
    buys: 0, supplies: 0, // market links
    m: 0, // share of throughput routed through the agent
  };
  const lineY = (i: number, n: number, r: number) => FIRM.y - 34 * ((n - 1) / 2) + i * 34 - (r > 170 ? 38 : 0);
  S.lines.forEach((l, i) => (l.y = lineY(i, 3, FIRM.r)));

  // defs: clip for the form's hatching follows its radius
  const defs = root.ownerSVGElement!.querySelector('defs')!;
  const clip = el('clipPath', { id: 'firm-clip' }, defs); const clipC = el('circle', { cx: FIRM.x, cy: FIRM.y, r: FIRM.r }, clip);
  // layers
  const gForm = el('g', {});
  const hatchG = el('g', { 'clip-path': 'url(#firm-clip)' }, gForm);
  let hd = ''; for (let k = -700; k <= 700; k += 13) hd += `M${FIRM.x + k - 300} ${FIRM.y + 300} L${FIRM.x + k + 300} ${FIRM.y - 300} `;
  el('path', { class: 'dg-hatch -light', d: hd }, hatchG);
  const form = el('circle', { class: 'dg-form', cx: FIRM.x, cy: FIRM.y, r: FIRM.r }, gForm);
  const title = el('g', { class: 'dg-chip' }); el('rect', { width: 96, height: 32, rx: 1 }, title); const titleT = el('text', { x: 48, y: 22, 'text-anchor': 'middle', class: 'dg-label -strong' }, title); titleT.textContent = 'FIRM';
  const lineEls = S.lines.map((l) => { const g = el('g', { class: 'dg-chip -plain' }); const t = el('text', { class: 'dg-label', 'text-anchor': 'middle' }, g); t.textContent = l.t; return g; });
  // roles + tethers
  const tethers = S.roles.map(() => el('line', { class: 'dg-link -thin', pathLength: 1 }) as SVGLineElement);
  const roleEls = S.roles.map(() => el('circle', { class: 'dg-role', r: 11 }) as SVGCircleElement);
  // market links (curved), with labels
  const buysP = el('path', { class: 'dg-link -signal', pathLength: 1 }) as SVGPathElement;
  const supP = el('path', { class: 'dg-link -signal', pathLength: 1 }) as SVGPathElement;
  const buysH = el('path', { class: 'dg-head -signal' }); const supH = el('path', { class: 'dg-head -signal' });
  // agent form
  const gAgent = el('g', {});
  const agentC = el('circle', { class: 'dg-form -signal', r: S.agent.r, pathLength: 1 }, gAgent) as SVGCircleElement;
  // execution chip (moves from inside the firm to the agent)
  const ex = el('g', { class: 'dg-chip' }); const exR = el('rect', { width: 124, height: 30, x: -62, y: -21, rx: 1 }, ex); const exT = el('text', { class: 'dg-label', 'text-anchor': 'middle' }, ex); exT.textContent = 'EXECUTION';
  const agentT = el('text', { class: 'dg-label -small -signal', 'text-anchor': 'middle' }); agentT.textContent = 'AGENT';
  // input / output
  const IN = { x: small ? 262 : 190, y: FIRM.y }, OUT = { x: small ? 858 : 1010, y: FIRM.y };
  const inLine = el('line', { class: 'dg-link', pathLength: 1 }) as SVGLineElement; const inH = el('path', { class: 'dg-head' });
  const outLine = el('line', { class: 'dg-link', pathLength: 1 }) as SVGLineElement; const outH = el('path', { class: 'dg-head' });
  const inT = el('text', { class: 'dg-label', x: IN.x, y: IN.y - 16 }); inT.textContent = 'INPUT';
  const outT = el('text', { class: 'dg-label', x: OUT.x, y: OUT.y - 16, 'text-anchor': 'end' }); outT.textContent = 'OUTPUT';
  const gDots = el('g', {});
  const dots = Array.from({ length: 14 }, (_, i) => ({ s: i / 14, route: 0, el: el('rect', { class: 'dg-dot', width: 6, height: 6 }, gDots) as SVGRectElement }));

  const head = (x: number, y: number, ang: number, l = 11, w = 0.38) => `M${x - l * Math.cos(ang - w)} ${y - l * Math.sin(ang - w)} L${x} ${y} L${x - l * Math.cos(ang + w)} ${y - l * Math.sin(ang + w)}`;
  const draw = (e: SVGGeometryElement, p: number) => { e.style.strokeDasharray = p >= 0.995 ? 'none' : '1 1'; e.style.strokeDashoffset = String(1 - p); e.style.opacity = p > 0.001 ? '1' : '0'; };
  // market curves between the firm's rim and the agent's rim
  const curve = (off: number) => {
    const ang = Math.atan2(S.agent.y - FIRM.y, S.agent.x - FIRM.x);
    const a = { x: FIRM.x + Math.cos(ang + off) * (S.r + 6), y: FIRM.y + Math.sin(ang + off) * (S.r + 6) };
    const b = { x: S.agent.x - Math.cos(ang - off) * (S.agent.r + 8), y: S.agent.y - Math.sin(ang - off) * (S.agent.r + 8) };
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1, bow = off > 0 ? 34 : -34;
    return { a, b, c: { x: mx + (nx / nl) * bow, y: my + (ny / nl) * bow } };
  };
  const qpt = (q: ReturnType<typeof curve>, t: number) => ({ x: (1 - t) ** 2 * q.a.x + 2 * (1 - t) * t * q.c.x + t * t * q.b.x, y: (1 - t) ** 2 * q.a.y + 2 * (1 - t) * t * q.c.y + t * t * q.b.y });

  let last = performance.now();
  function render(now = performance.now()) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    // form
    form.setAttribute('r', S.r.toFixed(1)); clipC.setAttribute('r', S.r.toFixed(1));
    (form as SVGElement).style.opacity = String(S.fa); hatchG.style.opacity = String(S.hatch * 0.55);
    title.setAttribute('transform', `translate(${FIRM.x - 48} ${(FIRM.y - S.r - 16).toFixed(1)})`); title.style.opacity = String(S.title);
    // held lines: centred in the form (re-spaced as the form contracts)
    const n = S.lines.length, block = clamp((S.r - 138) / (FIRM.r - 138)) * 38; // lines rise to make room for execution, then settle centred
    S.lines.forEach((l, i) => {
      const y = FIRM.y - 34 * ((n - 1) / 2) + i * 34 - block;
      lineEls[i].setAttribute('transform', `translate(${FIRM.x} ${y.toFixed(1)})`); lineEls[i].style.opacity = String(l.a);
      (lineEls[i].querySelector('text') as SVGTextElement).setAttribute('y', '6');
    });
    // roles + tethers to the execution chip
    S.roles.forEach((r, i) => {
      roleEls[i].setAttribute('cx', String(r.x)); roleEls[i].setAttribute('cy', String(r.y));
      roleEls[i].style.opacity = String(r.a); roleEls[i].style.stroke = r.grey > 0.5 ? ink3 : ink; roleEls[i].style.fill = r.grey > 0.5 ? 'none' : '';
      const t = tethers[i]; t.setAttribute('x1', String(r.x)); t.setAttribute('y1', String(r.y - 12)); t.setAttribute('x2', String(FIRM.x + (i - 1) * 24)); t.setAttribute('y2', String(FIRM.y + 92 + 10));
      draw(t, r.tether);
    });
    // execution chip → agent
    ex.setAttribute('transform', `translate(${S.ex.x.toFixed(1)} ${S.ex.y.toFixed(1)})`); ex.style.opacity = String(S.ex.a);
    exR.style.stroke = S.ex.green > 0.5 ? signal : ''; exT.style.fill = S.ex.green > 0.5 ? signal : '';
    exT.setAttribute('y', '0');
    // agent
    agentC.setAttribute('cx', String(S.agent.x)); agentC.setAttribute('cy', String(S.agent.y)); draw(agentC, S.agent.a);
    agentT.setAttribute('x', String(S.agent.x)); agentT.setAttribute('y', String(S.agent.y - S.agent.r - 14)); agentT.style.opacity = String(S.agent.a > 0.9 ? 1 : 0);
    // market
    const qb = curve(0.32), qs = curve(-0.32);
    buysP.setAttribute('d', `M${qb.a.x} ${qb.a.y} Q${qb.c.x} ${qb.c.y} ${qb.b.x} ${qb.b.y}`); draw(buysP, S.buys);
    supP.setAttribute('d', `M${qs.b.x} ${qs.b.y} Q${qs.c.x} ${qs.c.y} ${qs.a.x} ${qs.a.y}`); draw(supP, S.supplies);
    const hb = qpt(qb, 0.985), hs = qpt(qs, 0.015);
    buysH.setAttribute('d', head(qb.b.x, qb.b.y, Math.atan2(qb.b.y - hb.y, qb.b.x - hb.x))); buysH.style.opacity = S.buys > 0.97 ? '1' : '0';
    supH.setAttribute('d', head(qs.a.x, qs.a.y, Math.atan2(qs.a.y - hs.y, qs.a.x - hs.x))); supH.style.opacity = S.supplies > 0.97 ? '1' : '0';
    // input / output arrows meet the form's rim
    const inEnd = FIRM.x - S.r - 6, outStart = FIRM.x + S.r + 6;
    inLine.setAttribute('x1', String(IN.x)); inLine.setAttribute('x2', String(inEnd)); inLine.setAttribute('y1', String(IN.y)); inLine.setAttribute('y2', String(IN.y)); draw(inLine, S.inL);
    inH.setAttribute('d', head(inEnd, IN.y, 0)); inH.style.opacity = S.inL > 0.97 ? '1' : '0';
    outLine.setAttribute('x1', String(outStart)); outLine.setAttribute('x2', String(OUT.x)); outLine.setAttribute('y1', String(OUT.y)); outLine.setAttribute('y2', String(OUT.y)); draw(outLine, S.outL);
    outH.setAttribute('d', head(OUT.x, OUT.y, 0)); outH.style.opacity = S.outL > 0.97 ? '1' : '0';
    inT.style.opacity = outT.style.opacity = String(S.io);
    // throughput: dots travel input → (through the firm | out to the agent and back) → output; hidden inside forms
    const on = S.inL > 0.95 && S.outL > 0.95;
    for (const d of dots) {
      d.s += dt * (d.route ? 0.16 : 0.2);
      if (d.s >= 1) { d.s -= 1; d.route = Math.random() < S.m ? 1 : 0; }
      let x = 0, y = 0, hidden = false;
      const legIn = (inEnd - IN.x), legOut = (OUT.x - outStart);
      if (!d.route) {
        const L = legIn + S.r * 2 + legOut, dd = d.s * L;
        if (dd < legIn) { x = IN.x + dd; y = IN.y; } else if (dd < legIn + S.r * 2) { hidden = true; } else { x = outStart + (dd - legIn - S.r * 2); y = OUT.y; }
      } else {
        const s = d.s;
        if (s < 0.25) { x = IN.x + (s / 0.25) * legIn; y = IN.y; }
        else if (s < 0.3) hidden = true;
        else if (s < 0.5) { const q = qpt(qb, (s - 0.3) / 0.2); x = q.x; y = q.y; }
        else if (s < 0.55) hidden = true;
        else if (s < 0.75) { const q = qpt(qs, 1 - (s - 0.55) / 0.2); x = q.x; y = q.y; }
        else if (s < 0.8) hidden = true;
        else { x = outStart + ((s - 0.8) / 0.2) * legOut; y = OUT.y; }
        if (S.buys < 0.95 || S.supplies < 0.95) hidden = true;
      }
      d.el.setAttribute('x', (x - 3).toFixed(1)); d.el.setAttribute('y', (y - 3).toFixed(1));
      d.el.style.opacity = on && !hidden ? '1' : '0'; d.el.style.fill = d.route ? signal : ink;
    }
  }

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
  // FIG 1 — the firm and what it holds
  tl.to(S, { fa: 1, duration: 0.2 }, 0.0).to(S, { hatch: 1, duration: 0.3, ease: 'none' }, 0.15).to(S, { title: 1, duration: 0.15 }, 0.3);
  S.lines.forEach((l, i) => tl.to(l, { a: 1, duration: 0.15, ease: 'none' }, 0.35 + i * 0.08));
  tl.to(S.ex, { a: 1, duration: 0.15, ease: 'none' }, 0.6);
  S.roles.forEach((r, i) => tl.to(r, { a: 1, tether: 1, duration: 0.2 }, 0.62 + i * 0.05));
  tl.to(S, { inL: 1, duration: 0.2 }, 0.45).to(S, { outL: 1, duration: 0.2 }, 0.6).to(S, { io: 1, duration: 0.15 }, 0.5);
  // FIG 2 — execution leaves; the firm now buys it
  tl.to(S.ex, { x: S.agent.x, y: S.agent.y + 6, green: 1, duration: 0.5, ease: 'power3.inOut' }, 1.1)
    .to(S.agent, { a: 1, duration: 0.3 }, 1.45)
    .to(S, { buys: 1, duration: 0.2 }, 1.7).to(S, { supplies: 1, duration: 0.2 }, 1.78)
    .to(S, { m: 0.6, duration: 0.15 }, 1.85);
  // FIG 3 — the roles built around execution lose their work, then their links
  S.roles.forEach((r, i) => tl.to(r, { grey: 1, duration: 0.15, ease: 'none' }, 2.05 + i * 0.06));
  S.roles.forEach((r, i) => tl.to(r, { tether: 0, duration: 0.2 }, 2.35 + i * 0.08));
  tl.to(S.roles, { a: 0, duration: 0.2 }, 2.75).to(S, { m: 1, duration: 0.2 }, 2.3);
  // FIG 4 — the form contracts around what cannot be automated
  tl.to(S, { r: 138, duration: 0.55, ease: 'power3.inOut' }, 3.1);
  tl.to({}, { duration: 0.01 }, 4);
  return { S, tl, render, boundaryCenter: () => ({ x: FIRM.x, y: FIRM.y, r: S.r }) };
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
  svg.setAttribute('viewBox', mobile() ? '250 -50 620 720' : '150 30 900 660'); // crop to the firm

  const opts = { spacing: mobile() ? 20 : 26, seed: 11 };
  const A = new DiffusionField(cA, { ...opts, mode: 'progress', staticT: 0.34, word: true, global: true, seeds: [[0.14, 0.34], [0.62, 0.2], [0.86, 0.58], [0.4, 0.82]] });
  (window as any).__heroField = A;
  // the firm we dive into: the node nearest the centre-left of the screen
  const focus = A.nearest(A.w * 0.46, A.h * 0.5);
  const B = new DiffusionField(cB, { ...opts, mode: 'progress', staticT: 0.5, pointer: true, seeds: [[focus.x / A.w, focus.y / A.h]] });
  const surf = new HomotopySurface(cS);
  const D = makeDiagram(inkG, mobile());
  onDispose(() => { A.destroy(); B.destroy(); surf.destroy(); if ((window as any).__heroField === A) delete (window as any).__heroField; });

  const setFig = (k: number) => figs.forEach((f, i) => f.classList.toggle('is-active', i === k));

  if (RM) {
    D.tl.progress(1); D.render();
    cB.style.opacity = '0'; cS.style.opacity = '0'; svg.style.opacity = '1';
    figs.forEach((f) => f.classList.add('is-active'));
    return;
  }

  if (arrived) {
    A.reveal = 1; A.sweep = -1;
    const box = { x: -260 };
    gsap.to(box, { x: innerWidth + 260, duration: 1.6, delay: 0.7, ease: 'power2.inOut', onUpdate: () => { A.sweep = box.x; }, onComplete: () => { A.reveal = 0; A.sweep = -1; } });
  }

  // map a diagram point (viewBox units) to stage pixels and back
  const toScreen = (x: number, y: number) => { const m = svg.getScreenCTM()!, r = svg.getBoundingClientRect(); const pt = new DOMPoint(x, y).matrixTransform(m); return { x: pt.x - r.left, y: pt.y - r.top, k: m.a }; };
  const toSvg = (x: number, y: number) => { const m = svg.getScreenCTM()!.inverse(), r = svg.getBoundingClientRect(); const pt = new DOMPoint(x + r.left, y + r.top).matrixTransform(m); return { x: pt.x, y: pt.y }; };

  let p = 0, curFig = -2;
  const apply = () => {
    // HERO → DIVE
    const dive = sm(seg(p, P.dive[0], P.dive[1]));
    const back = sm(seg(p, P.back[0], P.back[1]));
    const inFirm = p >= P.dive[0] && p < P.back[1];
    A.wordMul = 1 - sm(seg(p, 0.01, 0.05));
    A.setProgress(0.06 + sm(seg(p, 0, P.dive[0])) * 0.06);
    const bc = D.boundaryCenter();
    // field A: zoom into the focus node, carrying it to where the firm's boundary will sit
    const bcs = toScreen(FIRM.x, FIRM.y);
    A.camFocus = [focus.x, focus.y];
    A.camTo = [lerp(focus.x, bcs.x, dive), lerp(focus.y, bcs.y, dive)];
    A.camScale = lerp(1, 9, dive * dive);
    cA.style.opacity = String(p < P.back[0] ? 1 - sm(seg(dive, 0.45, 0.9)) : 0);
    // diagram: grows out of the node on the way in, shrinks back into it on the way out
    const nodeSvg = toSvg(focus.x, focus.y);
    const s0 = 3 / Math.max(1, bcs.k * FIRM.r);
    let s = 1, tx = 0, ty = 0, dop = 0;
    if (p < P.back[0]) { const e = dive; s = lerp(s0, 1, e * e); tx = lerp(nodeSvg.x - FIRM.x, 0, e); ty = lerp(nodeSvg.y - FIRM.y, 0, e); dop = sm(seg(e, 0.02, 0.3)); }
    else { const e = back; s = lerp(1, s0 * (FIRM.r / bc.r), e * e * 0.999 + 0.001 * e); tx = lerp(0, nodeSvg.x - bc.x, e); ty = lerp(0, nodeSvg.y - bc.y, e); dop = 1 - sm(seg(e, 0.35, 0.8)); }
    const ox = p < P.back[0] ? FIRM.x : bc.x, oy = p < P.back[0] ? FIRM.y : bc.y;
    dg.setAttribute('transform', `translate(${(ox + tx).toFixed(2)} ${(oy + ty).toFixed(2)}) scale(${s.toFixed(4)}) translate(${-ox} ${-oy})`);
    svg.style.opacity = String(inFirm ? dop : 0);
    // figs 1–4 time
    D.tl.progress(seg(p, P.dive[0] + 0.02, P.figs[1]));
    if (p < P.back[0]) D.S.fa = Math.max(D.S.fa, sm(seg(dive, 0, 0.25))); // the node's outline is the firm's boundary from the start
    // field B: returns around the node, then the recomposition spreads from it
    A.running && !(p < P.back[0]) && A.stop();
    if (p < P.back[0] && !A.running && A.visible) A.start();
    const bIn = p >= P.back[0];
    B.camFocus = [focus.x, focus.y]; B.camTo = [focus.x, focus.y];
    B.camScale = lerp(9, 1, back);
    B.setProgress(0.0 + sm(seg(p, P.diff[0], P.diff[1])) * 1.0);
    const lift = seg(p, P.lift[0], P.lift[1]);
    cB.style.opacity = String(bIn ? sm(seg(back, 0.3, 0.8)) * (1 - sm(seg(p, P.lift[0] + 0.012, P.lift[1]))) : 0);
    if (bIn && !B.running) B.start(); if (!bIn && B.running) B.stop();
    // coda: the lattice seen from above tilts into 3D and deforms
    cS.style.opacity = String(sm(seg(p, P.lift[0] - 0.008, P.lift[0] + 0.022))); // surface is fully in before the field lets go
    surf.tilt = sm(seg(p, P.lift[1], P.coda[0] + 0.03));
    surf.setProgress(sm(seg(p, P.coda[0], P.coda[1] - 0.02)));
    if (p >= P.lift[0]) { if (!surf.running) surf.start(); } else if (surf.running) surf.stop();
    // captions
    let k = -1;
    if (p >= P.figs[0] - 0.01 && p < P.figs[1]) k = Math.min(3, Math.floor(seg(p, P.figs[0], P.figs[1]) * 4));
    else if (p >= P.back[1] - 0.01 && p < P.lift[0]) k = 4;
    if (k !== curFig) { curFig = k; setFig(k); }
  };

  const st = ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', onUpdate: (s) => { p = s.progress; apply(); } });
  onDispose(() => st.kill());
  // the diagram's own frame loop: throughput never stops
  const tick = () => { if (svg.style.opacity !== '0') D.render(); };
  gsap.ticker.add(tick);
  onDispose(() => gsap.ticker.remove(tick));
  // boil: re-seed the displacement noise so lines tremble like plotted ink
  const turb = svg.querySelector('[data-boil]'); let seed = 1;
  const iv = window.setInterval(() => { if (turb && svg.style.opacity !== '0') turb.setAttribute('seed', String((seed = (seed % 6) + 1))); }, 140);
  onDispose(() => clearInterval(iv));
  D.render(); apply();

  if (cue) {
    gsap.set(cue, { opacity: 0 });
    introDone.then(() => {
      gsap.to(cue, { opacity: 1, duration: 0.6, delay: 1.4 });
      gsap.to(cue, { y: 6, duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 2 });
    });
    const hide = ScrollTrigger.create({ trigger: sec, start: 'top top', end: '+=160', onUpdate: (s) => { cue.style.visibility = s.progress > 0.5 ? 'hidden' : 'visible'; } });
    onDispose(() => hide.kill());
  }
}
