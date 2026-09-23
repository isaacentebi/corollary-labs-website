// Essays index: rows' inline curve fronts ride along on hover (the glyph is alive), everything else is
// handled by the shared reveal/hover systems.
import { gsap, reduced, onDispose } from './core';
import { DiffusionField } from './field';

export function initIndex(_introDone: Promise<void>) {
  const band = document.querySelector<HTMLCanvasElement>('[data-field="index"]');
  if (band) {
    const f = new DiffusionField(band, {
      mode: 'auto', spacing: innerWidth < 700 ? 18 : 24, autoSpeed: 0.02, autoMax: 0.34, staticT: 0.34, seed: 29, word: true, wordBase: 0.5,
      wordLayout: { text: 'Essays', wFrac: innerWidth < 700 ? 0.78 : 0.56, hFrac: 0.62, baseFrac: 0.7 },
      seeds: [[0.1, 0.3], [0.55, 0.15], [0.88, 0.7]],
    });
    onDispose(() => f.destroy());
  }
  if (reduced()) return;
  document.querySelectorAll<HTMLElement>('.index-row').forEach((row) => {
    const svg = row.querySelector('svg'); const path = svg?.querySelector('path'); const dot = svg?.querySelector<SVGCircleElement>('[data-front]');
    if (!path || !dot) return;
    const len = path.getTotalLength();
    const o = { p: 0.2 };
    let tw: gsap.core.Tween | null = null;
    const move = () => { const pt = path.getPointAtLength(len * o.p); dot.setAttribute('cx', String(pt.x)); dot.setAttribute('cy', String(pt.y)); };
    const enter = () => { tw?.kill(); tw = gsap.to(o, { p: 0.95, duration: 0.9, ease: 'power2.inOut', onUpdate: move }); };
    const leave = () => { tw?.kill(); tw = gsap.to(o, { p: 0.2, duration: 0.45, ease: 'power3.out', onUpdate: move }); };
    row.addEventListener('mouseenter', enter); row.addEventListener('focus', enter);
    row.addEventListener('mouseleave', leave); row.addEventListener('blur', leave);
    onDispose(() => tw?.kill());
  });
}
