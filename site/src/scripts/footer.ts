// Footer live readout (page scroll mapped through a logistic = "the front") and back-to-top.
import { onScroll, onDispose, scrollState } from './core';
import { adoptionAt } from './header';

export function initFooter() {
  const live = document.querySelector<HTMLElement>('[data-live-adoption]');
  const curve = document.querySelector<SVGSVGElement>('.c-footer [data-inline-curve]');
  const front = curve?.querySelector<SVGCircleElement>('[data-front]');
  const path = curve?.querySelector<SVGPathElement>('path');
  const upd = () => {
    const a = adoptionAt(scrollState.progress);
    if (live) live.textContent = (a * 100).toFixed(2).padStart(5, '0') + '%';
    if (front && path) {
      const len = path.getTotalLength();
      const pt = path.getPointAtLength(len * Math.min(1, scrollState.progress));
      front.setAttribute('cx', pt.x.toFixed(2)); front.setAttribute('cy', pt.y.toFixed(2));
    }
  };
  upd();
  onDispose(onScroll(upd));
}
