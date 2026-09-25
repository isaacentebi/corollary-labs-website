// One field for the whole visit. The canvas persists across page swaps; each page re-scales,
// re-colours and reorganises the same surface (tiles turn to the page's pattern, colour changes tile by tile).
import { LoopField, type Mode } from './field';
import { story, HOME_SEED } from './story';

const small = () => innerWidth < 700;
const MODES: Record<string, () => Mode> = {
  home: () => ({ pattern: 'mixed', density: 0.55, seed: HOME_SEED, cell: small() ? 30 : 44, theme: 'violet', ambient: 2.6, width: 0.17, cam: [32.5, 32.5] }),
  essays: () => ({ pattern: 'random', seed: 4, cell: small() ? 26 : 34, theme: 'deep', agents: 6, ambient: 2, width: 0.17 }),
  essay: () => ({ pattern: 'random', seed: 8, cell: small() ? 26 : 32, theme: 'paper', agents: 5, interactive: false, width: 0.14 }),
  about: () => ({ pattern: 'random', seed: 5, cell: small() ? 56 : 96, theme: 'violet', agents: 4, ambient: 1.2, width: 0.15 }),
  team: () => ({ pattern: 'random', seed: 12, cell: small() ? 40 : 56, theme: 'violet', agents: 5, ambient: 1.6, width: 0.17 }),
  contact: () => ({ pattern: 'diagonal', seed: 2, cell: small() ? 48 : 72, theme: 'deep', agents: 2, ambient: 1.2, width: 0.2 }),
  notfound: () => ({ pattern: 'random', seed: 404, cell: small() ? 30 : 44, theme: 'deep', agents: 0, ambient: 2 }),
};

let field: LoopField | null | undefined;
let cleanup: (() => void) | null = null;

/** Panels painted by the field: every visible .cut, except story beats that are hidden. */
const panels = () => [...document.querySelectorAll('.cut')].filter((el) => !el.closest('[data-beat]:not(.on)'));

function onLoad() {
  const root = document.documentElement;
  const canvas = document.getElementById('field') as HTMLCanvasElement | null;
  if (!canvas) return;
  const first = field === undefined;
  if (first) {
    field = LoopField.create(canvas);
    (window as any).__field = field;
    if (!field) root.classList.add('no-gl');
  }
  cleanup?.(); cleanup = null;
  if (!field) return;
  const page = root.dataset.page || 'home';
  const mode = (MODES[page] || MODES.home)();
  field.scrollPx = () => scrollY;
  field.rectEls = panels;
  root.style.setProperty('--cell', `${Math.max(mode.cell, field.minCell).toFixed(2)}px`);
  if (first) {
    // arrive: every tile aligned, then the page's pattern turns in from the centre
    field.apply({ ...mode, pattern: 'diagonal', agents: 0 }, { instant: true });
    field.apply(mode);
  } else field.apply(mode);
  if (page === 'home') cleanup = story(field, field.pattern(mode.pattern, mode.seed, mode.density));
  root.classList.add('field-on');
}

document.addEventListener('astro:page-load', onLoad);

// header: hidden while scrolling down, back on the way up
{
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY, top = document.querySelector('.top');
    if (top) top.classList.toggle('top--away', y > lastY && y > 140);
    lastY = y;
  }, { passive: true });
  document.addEventListener('astro:after-swap', () => { lastY = 0; document.querySelector('.top')?.classList.remove('top--away'); });
}

// Over open field, the pointer shows a small ring: turning tiles and placing agents happen there.
if (matchMedia('(pointer: fine)').matches) {
  let x = -99, y = -99, tx = -99, ty = -99, raf = 0;
  const probe = () => document.querySelector<HTMLElement>('.probe');
  const tick = () => { x += (tx - x) * 0.35; y += (ty - y) * 0.35; const p = probe(); if (p) p.style.transform = `translate(${x}px, ${y}px)`; raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(tick) : 0; };
  addEventListener('pointermove', (e) => {
    const p = probe();
    if (!p || !field) return;
    const t = e.target as HTMLElement;
    const over = field.interactive && !t.closest('.cut, a, button, .top, input, textarea') && !field.overPanel(e.clientX, e.clientY);
    p.classList.toggle('on', over);
    tx = e.clientX; ty = e.clientY;
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: true });
  document.addEventListener('pointerleave', () => probe()?.classList.remove('on'));
  addEventListener('pointerdown', () => { const p = probe(); if (p?.classList.contains('on')) { p.classList.remove('tap'); void p.offsetWidth; p.classList.add('tap'); } });
}
