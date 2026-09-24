// A single specimen plate (About, Contact): the firm at a fixed story position, alive, no labels.
import { Specimen } from './specimen';

export function initPlates() {
  const RM = document.documentElement.classList.contains('rm');
  document.querySelectorAll<HTMLCanvasElement>('[data-plate]').forEach((canvas) => {
    const sp = new Specimen({ canvas, plate: +(canvas.dataset.plate || -1), reduced: RM, layout: (w, h) => ({ cx: w / 2, cy: h / 2, R: Math.min(w, h) * 0.47 }) });
    if (canvas.dataset.plate === '-1') {
      canvas.addEventListener('pointermove', (e) => sp.setPointer(e.clientX, e.clientY, true));
      canvas.addEventListener('pointerleave', () => sp.setPointer(0, 0, false));
    }
    let rz = 0; addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => sp.resize()); });
    document.fonts?.ready.then(() => sp.draw());
    if (RM) { sp.draw(); return; }
    new IntersectionObserver(([en]) => (en.isIntersecting ? sp.start() : sp.stop())).observe(canvas);
  });
}
