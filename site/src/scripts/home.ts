// Home: scroll position → story position `s` for the specimen.
// Block k (1..5) maps to s ∈ [k-1, k]; the hero is s ∈ [-1, 0]; the tail opens the aperture (s ∈ [5, 6]).
import { Specimen } from './specimen';

export const homeLayout = (w: number, h: number) => {
  if (w < 760) { const R = Math.min(w * 0.43, h * 0.25); return { cx: w / 2, cy: 70 + R, R }; }
  const R = Math.min(h * 0.42, w * 0.29); return { cx: w * 0.665, cy: h * 0.5, R };
};

export function initHome() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-specimen]');
  if (!canvas) return;
  const root = document.documentElement;
  const RM = root.classList.contains('rm');
  const sp = new Specimen({ canvas, reduced: RM, layout: homeLayout });
  const blocks = [...document.querySelectorAll<HTMLElement>('[data-block]')];
  const figs = blocks.filter((b) => b.classList.contains('fig'));

  const measure = () => {
    const vh = innerHeight; const anchor = vh * (innerWidth < 760 ? 0.72 : 0.62);
    let s = -1;
    for (const b of blocks) {
      const k = +b.dataset.block!; const r = b.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (anchor - r.top) / r.height));
      if (anchor >= r.top) s = k === 0 ? -1 + p : k - 1 + p;
    }
    if (RM) {
      // reduced motion: show each figure's settled state, no in-betweens
      s = s < 0 ? -1 : Math.min(6, Math.ceil(s - 0.15));
    }
    sp.sTarget = s; if (RM) sp.s = s;
    const active = Math.floor(s) + 1; // 1-based figure index
    figs.forEach((f) => f.classList.toggle('is-active', +f.dataset.block! === Math.min(5, Math.max(0, s < 0 ? 0 : active))));
    root.classList.toggle('past-hero', scrollY > innerHeight * 0.45);
    if (RM) sp.draw();
  };

  const onPointer = (e: PointerEvent) => sp.setPointer(e.clientX, e.clientY, true);
  canvas.addEventListener('pointermove', onPointer);
  canvas.addEventListener('pointerleave', () => sp.setPointer(0, 0, false));

  addEventListener('scroll', measure, { passive: true });
  let rz = 0;
  addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { sp.resize(); measure(); }); });
  measure(); sp.s = sp.sTarget;
  document.fonts?.ready.then(() => sp.draw());

  if (RM) { sp.draw(); return; }
  let inView = true;
  const io = new IntersectionObserver(([en]) => { inView = en.isIntersecting; if (inView && !document.hidden) sp.start(); else sp.stop(); });
  io.observe(document.querySelector('[data-home]')!);
  document.addEventListener('visibilitychange', () => { if (document.hidden || !inView) sp.stop(); else sp.start(); });
  (window as any).__specimen = sp; // for headless review
}
