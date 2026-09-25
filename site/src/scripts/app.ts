import { initStage, drawStatic } from './stage';
import { figureStruct } from './city';

document.querySelectorAll<HTMLElement>('[data-stage]').forEach((el) => initStage(el, el.dataset.stage === 'story' ? 'story' : 'hero'));

// static axonometric figures (essays, inner pages): drawn once, redrawn on resize
const figs = [...document.querySelectorAll<HTMLCanvasElement>('canvas[data-axon]')];
if (figs.length) {
  const draw = (c: HTMLCanvasElement) => {
    const kind = c.dataset.axon || 'org';
    const S = (c as any).__s || ((c as any).__s = figureStruct(kind));
    drawStatic(c, S, { th: Number(c.dataset.th ?? -0.62), t: 1, pad: Number(c.dataset.pad ?? 20) });
  };
  const ro = new ResizeObserver((es) => es.forEach((e) => draw(e.target as HTMLCanvasElement)));
  figs.forEach((c) => ro.observe(c));
}

// quiet reveal for blocks below the fold
const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('reveal-on');
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
}
