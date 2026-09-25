// On-demand rendering for a Specimen: the frame loop runs only while something is changing
// (a story transition, the pointer, or a short window of life after a wake), then stops.
import type { Specimen } from './specimen';

export function live(sp: Specimen, step?: (dt: number) => boolean) {
  const RM = document.documentElement.classList.contains('rm');
  let raf = 0, last = 0, until = 0, visible = true;
  const loop = (now: number) => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    const busy = step ? step(dt) : false;
    sp.tick(dt); sp.draw();
    const moving = Math.abs(sp.sTarget - sp.s) > 1e-4 || Math.abs(sp.pointer.tx - sp.pointer.x) + Math.abs(sp.pointer.ty - sp.pointer.y) > 1e-3;
    raf = visible && !document.hidden && (busy || moving || now < until) ? requestAnimationFrame(loop) : 0;
  };
  const wake = (ms = 1500) => {
    if (RM) { step?.(1); sp.tick(0); sp.draw(); return; }
    until = Math.max(until, performance.now() + ms);
    if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); }
  };
  const setVisible = (v: boolean, ms = 4000) => { visible = v; if (v) wake(ms); else { cancelAnimationFrame(raf); raf = 0; } };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) wake(1500); });
  return { wake, setVisible };
}
