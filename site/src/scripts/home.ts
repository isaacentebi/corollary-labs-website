// Home page: title-plate field, scroll-scrubbed figures 1–4, and the dependency-graph rail.
import { initField } from './field';
import { Diagram, type Palette } from './diagram';
import { fig1, fig1Types, fig2, fig2Types, fig3, fig3Types, type TypeLine } from './figs';
import { makeEconomy } from './economy';

const RM = document.documentElement.classList.contains('rm');
const css = getComputedStyle(document.documentElement);
const v = (n: string) => css.getPropertyValue(n).trim();
const PAPER: Palette = { ink: v('--ink'), paper: v('--paper-3'), blue: v('--blue') };

const hero = document.querySelector<HTMLCanvasElement>('[data-field]');
if (hero) {
  const q = (s: string) => document.querySelector<HTMLElement>(s);
  const cap = q('.plate0__cap');
  if (cap) document.documentElement.style.setProperty('--cap-h', `${cap.offsetHeight + 16}px`);
  const obstacles = [
    { el: q('.plate0__mark'), dir: 'down' as const },
    { el: q('.plate0__cap'), dir: (window.innerWidth < 700 ? 'up' : 'down') as 'up' | 'down' },
    { el: q('.plate0__text'), dir: 'up' as const },
  ].filter((o): o is { el: HTMLElement; dir: 'up' | 'down' } => !!o.el);
  initField(hero, { reduced: RM, obstacles });
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => x * x * (3 - 2 * x);

interface Ctl { sec: HTMLElement; blocks: HTMLElement[]; states: number[]; mode: 'hold' | 'linear'; apply: (s: number) => void; s: number; last: number }
const ctls: Ctl[] = [];

/** The reading line (viewport px) for a section: just under its figure when the figure is pinned above the text
 * (phones, and §3 on desktop), otherwise half-way down the screen. */
export function readingLine(sec: HTMLElement) {
  const top = window.innerWidth < 900 || sec.classList.contains('-wide');
  if (!top) return window.innerHeight * 0.5;
  const f = sec.querySelector<HTMLElement>('.fig');
  const b = f ? Math.min(f.getBoundingClientRect().bottom, window.innerHeight * 0.8) : window.innerHeight * 0.6;
  return Math.max(b, 0) + 48;
}
(window as any).__proofLine = (k: string) => readingLine(document.querySelector<HTMLElement>(`[data-sec="${k}"]`)!);

/** Continuous state for a section, from the positions of its statement blocks relative to a reading line. */
function stateFor(c: Ctl) {
  const line = window.scrollY + readingLine(c.sec);
  const tops = c.blocks.map((b) => b.getBoundingClientRect().top + window.scrollY);
  if (line <= tops[0]) return c.states[0];
  for (let k = 0; k < tops.length - 1; k++) {
    if (line < tops[k + 1]) {
      const f = (line - tops[k]) / (tops[k + 1] - tops[k]);
      const u = c.mode === 'hold' ? ease(clamp((f - 0.45) / 0.5)) : f;
      const raw = c.states[k] + (c.states[k + 1] - c.states[k]) * u;
      return RM && c.mode === 'hold' ? Math.round(raw) : raw;
    }
  }
  if (c.mode === 'linear') {
    // t reaches 1 when the last statement is 60% of the way past the reading line, so it is still being read
    const lastTop = tops[tops.length - 1], last = c.blocks[c.blocks.length - 1];
    const end = lastTop + Math.max(120, last.offsetHeight * 0.6);
    const f = clamp((line - lastTop) / Math.max(1, end - lastTop));
    return c.states[c.states.length - 1] + f * (1 - c.states[c.states.length - 1]);
  }
  return c.states[c.states.length - 1];
}

function setType(el: Element | null, types: TypeLine[], s: number, base = 0) {
  if (!el) return;
  const i = Math.max(0, Math.min(types.length - 1, Math.round(s)));
  if ((el as HTMLElement).dataset.cur !== String(i)) {
    (el as HTMLElement).dataset.cur = String(i);
    el.innerHTML = `<span class="fig__t">${types[i].t}</span>${types[i].g ? `<span class="fig__gl">${types[i].g}</span>` : ''}`;
    el.classList.toggle('-changed', types[i].t !== types[base].t);
  }
}

function mountDiagram(key: string, states: typeof fig1, types: TypeLine[]) {
  const sec = document.querySelector<HTMLElement>(`[data-sec="${key}"]`);
  if (!sec) return null;
  const svg = sec.querySelector<SVGSVGElement>('svg[data-dg]')!;
  const d = new Diagram(svg, states, PAPER);
  const typeEl = sec.querySelector('[data-type]');
  const blocks = [...sec.querySelectorAll<HTMLElement>('[data-state]')];
  const ctl: Ctl = { sec, blocks, states: blocks.map((b) => +b.dataset.state!), mode: 'hold', s: -1, last: -1, apply: () => {} };
  ctl.apply = (s) => { d.render(s); setType(typeEl, types, s); };
  ctls.push(ctl);
  return { ctl, d, typeEl };
}

mountDiagram('1', fig1, fig1Types);
mountDiagram('2', fig2, fig2Types);
const f3 = mountDiagram('3', fig3, fig3Types);
if (f3) {
  // near state 2 (the deformation) the boxes keep moving: a continuous planar isotopy, shown live
  const seeds: Record<string, number> = { c: 0.3, e1: 1.7, e2: 3.1, e3: 4.4 };
  f3.ctl.apply = (s) => {
    const a = RM ? 0 : Math.max(0, 1 - Math.abs(s - 2) * 1.6);
    const now = performance.now() / 1000;
    f3.d.render(s, a > 0 ? (k) => [0, a * 10 * Math.sin(now * 0.9 + (seeds[k] ?? 0))] : undefined);
    setType(f3.typeEl, fig3Types, s);
  };
}

const eco = document.querySelector<HTMLElement>('[data-sec="4"]');
if (eco) {
  const svg = eco.querySelector<SVGSVGElement>('svg[data-eco]')!;
  const mobile = window.innerWidth < 700;
  const E = makeEconomy(svg, mobile ? { cols: 5, rows: 5, W: 500, H: 560 } : { cols: 8, rows: 6, W: 1000, H: 560 });
  svg.setAttribute('viewBox', mobile ? '0 0 500 560' : '0 0 1000 560');
  const count = eco.querySelector('[data-count]');
  const blocks = [...eco.querySelectorAll<HTMLElement>('[data-state]')];
  ctls.push({
    sec: eco, blocks, states: blocks.map((b) => +b.dataset.state!), mode: 'linear', s: -1, last: -1,
    apply: (t) => { E.render(t); if (count) count.textContent = `${E.changedCount(t)} / ${E.total}`; },
  });
}

// ── rail: the statements as a dependency graph; the one being read is blue, read ones are filled ──
const rail = document.querySelector<HTMLElement>('[data-rail]');
const stmts = [...document.querySelectorAll<HTMLElement>('[data-stmt]')];
function updateRail() {
  if (!rail) return;
  const line = window.innerHeight * 0.55;
  let cur = -1;
  stmts.forEach((s, i) => { if (s.getBoundingClientRect().top < line) cur = i; });
  rail.querySelectorAll<SVGGElement>('[data-node]').forEach((n) => {
    const i = stmts.findIndex((s) => s.id === n.dataset.node);
    n.classList.toggle('-cur', i === cur);
    n.classList.toggle('-read', i >= 0 && i < cur);
  });
  const plate = document.querySelector('[data-plate]')?.getBoundingClientRect();
  const hero = document.querySelector('[data-hero]')?.getBoundingClientRect();
  const bib = document.querySelector('.biblio')?.getBoundingClientRect();
  const inBand = [...document.querySelectorAll('.sec.-wide .sec__grid')].some((g) => {
    const band = g.getBoundingClientRect();
    return band.top < window.innerHeight * 0.6 && band.bottom > window.innerHeight * 0.4;
  });
  const hide = (plate && plate.top < window.innerHeight * 0.75 && plate.bottom > window.innerHeight * 0.25) || (hero && hero.bottom > window.innerHeight * 0.3) || (bib && bib.top < window.innerHeight * 0.8) || inBand;
  rail.classList.toggle('-hide', !!hide);
}

// labels inside the figures keep a readable size on small screens: --s is the SVG's scale (CSS px per user unit)
function fitLabels() {
  document.querySelectorAll<SVGSVGElement>('svg.dg').forEach((svg) => {
    const vb = svg.viewBox.baseVal; const w = svg.getBoundingClientRect().width;
    if (vb && w) svg.style.setProperty('--s', String(Math.min(w / vb.width, (svg.getBoundingClientRect().height || 1e9) / vb.height)));
  });
}
fitLabels();
window.addEventListener('resize', fitLabels);

let ticking = false;
function frame() {
  ticking = false;
  for (const c of ctls) {
    const r = c.sec.getBoundingClientRect();
    if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
    const s = stateFor(c);
    if (Math.abs(s - c.s) > 1e-4 || c === f3?.ctl) { c.s = s; c.apply(s); }
  }
  updateRail();
}
const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
window.addEventListener('scroll', req, { passive: true });
window.addEventListener('resize', req);
// figure 3 animates on its own while the deformation state is on screen
if (f3 && !RM) {
  const tick = () => {
    const r = f3.ctl.sec.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0 && Math.abs(f3.ctl.s - 2) < 0.7) f3.ctl.apply(f3.ctl.s);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
for (const c of ctls) { c.s = stateFor(c); c.apply(c.s); }
updateRail();

(window as any).__proofS = () => ctls.map((c) => c.s);
