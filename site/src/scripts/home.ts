// Home page: title-plate field, scroll-scrubbed figures 1–4, and the dependency-graph rail.
import { initField } from './field';
import { Diagram, type Palette } from './diagram';
import { fig1, fig1Types, fig2, fig2Types, fig3, fig3Types } from './figs';
import { makeEconomy } from './economy';

const RM = document.documentElement.classList.contains('rm');
const css = getComputedStyle(document.documentElement);
const v = (n: string) => css.getPropertyValue(n).trim();
const PAPER: Palette = { ink: v('--ink'), paper: v('--paper-3'), blue: v('--blue') };

const hero = document.querySelector<HTMLCanvasElement>('[data-field]');
if (hero) initField(hero, { reduced: RM, title: document.querySelector<HTMLElement>('.plate0__title') });

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => x * x * (3 - 2 * x);

interface Ctl { sec: HTMLElement; blocks: HTMLElement[]; states: number[]; mode: 'hold' | 'linear'; apply: (s: number) => void; s: number; last: number }
const ctls: Ctl[] = [];

/** Continuous state for a section, from the positions of its statement blocks relative to a reading line. */
function stateFor(c: Ctl) {
  const mobile = window.innerWidth < 900;
  const line = window.scrollY + window.innerHeight * (mobile ? 0.78 : 0.6);
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
    const lastTop = tops[tops.length - 1], sec = c.sec.getBoundingClientRect();
    const end = sec.bottom + window.scrollY - window.innerHeight * 0.4;
    const f = clamp((line - lastTop) / Math.max(1, end - lastTop));
    return c.states[c.states.length - 1] + f * (1 - c.states[c.states.length - 1]);
  }
  return c.states[c.states.length - 1];
}

function setType(el: Element | null, types: string[], s: number, base = 0) {
  if (!el) return;
  const i = Math.round(s);
  const html = types[Math.max(0, Math.min(types.length - 1, i))];
  if ((el as HTMLElement).dataset.cur !== String(i)) {
    (el as HTMLElement).dataset.cur = String(i);
    el.innerHTML = html;
    el.classList.toggle('-changed', types[i] !== types[base]);
  }
}

function mountDiagram(key: string, states: typeof fig1, types: string[]) {
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
  const E = makeEconomy(svg, mobile ? { cols: 5, rows: 6, W: 500, H: 620 } : { cols: 8, rows: 6, W: 1000, H: 560 });
  svg.setAttribute('viewBox', mobile ? '0 0 500 620' : '0 0 1000 560');
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
  const line = window.innerHeight * 0.6;
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
  const hide = (plate && plate.top < window.innerHeight * 0.75 && plate.bottom > window.innerHeight * 0.25) || (hero && hero.bottom > window.innerHeight * 0.3) || (bib && bib.top < window.innerHeight * 0.8);
  rail.classList.toggle('-hide', !!hide);
}

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
