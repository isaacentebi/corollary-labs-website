// A single specimen plate (About, Contact): the organisation at a fixed story position, alive for a few
// seconds when it comes into view or is touched, then still (rendered on demand).
import { Specimen } from './specimen';
import { live } from './live';

export function initPlates() {
  const RM = document.documentElement.classList.contains('rm');
  document.querySelectorAll<HTMLCanvasElement>('[data-plate]').forEach((canvas) => {
    const sp = new Specimen({ canvas, plate: +(canvas.dataset.plate || -1), reduced: RM, closed: true, layout: (w, h) => ({ cx: w / 2, cy: h / 2, R: Math.min(w, h) * 0.47 }) });
    const L = live(sp);
    canvas.addEventListener('pointermove', (e) => { sp.setPointer(e.clientX, e.clientY, true); L.wake(1400); });
    canvas.addEventListener('pointerleave', () => { sp.setPointer(0, 0, false); L.wake(1000); });
    let rz = 0; addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { sp.resize(); L.wake(300); }); });
    new IntersectionObserver(([en]) => L.setVisible(en.isIntersecting, 5000)).observe(canvas);
  });
}
