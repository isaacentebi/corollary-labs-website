// Plotter plates controller: builds one GSAP timeline (4 units = 4 figures) from data attributes and scrubs it
// with scroll through a pinned section. Lines "boil" (a displacement filter re-seeded every 140 ms) so the
// drawing reads as plotted by hand, not rendered.
import { gsap, ScrollTrigger, onDispose, reduced } from './core';

export function initPlates() {
  const sec = document.querySelector<HTMLElement>('[data-plates]');
  const svg = sec?.querySelector<SVGSVGElement>('[data-plates-svg]');
  if (!sec || !svg) return;
  const figs = [...sec.querySelectorAll<HTMLElement>('[data-fig]')];
  const setFig = (k: number) => figs.forEach((f, i) => f.classList.toggle('is-active', i === k));
  if (reduced()) { setFig(-1); figs.forEach((f) => f.classList.add('is-active')); return; }

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
  svg.querySelectorAll<SVGElement>('[data-k]').forEach((el) => {
    const k = el.dataset.k, p = +el.dataset.p!, d = +(el.dataset.d || 0.25), out = el.dataset.out ? +el.dataset.out : null;
    if (k === 'draw') {
      tl.fromTo(el, { strokeDasharray: 1, strokeDashoffset: 1, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: d }, p);
      if (out != null) tl.to(el, { strokeDashoffset: -1, duration: 0.25 }, out);
    } else if (k === 'fade') {
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: d, ease: 'none' }, p);
      if (out != null) tl.to(el, { opacity: 0, duration: 0.2, ease: 'none' }, out);
    } else if (k === 'hatch') {
      const r = svg.querySelector<SVGRectElement>(`[data-sweep="${el.dataset.i}"]`)!;
      const w = +r.getAttribute('width')!;
      tl.fromTo(r, { attr: { width: 0 } }, { attr: { width: w }, duration: d, ease: 'none' }, p);
    } else if (k === 'boundary') {
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: d, ease: 'none' }, p);
      for (const kv of (el.dataset.keys || '').split(',').filter(Boolean)) {
        const [t, r] = kv.split(':').map(Number);
        tl.to(el, { attr: { r }, duration: 0.3, ease: 'power3.inOut' }, t);
      }
    }
  });
  tl.to({}, { duration: 0.01 }, 4);

  let cur = -1;
  const st = ScrollTrigger.create({
    trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 0.5,
    onUpdate: (s) => {
      const t = s.progress * 4;
      tl.progress(Math.min(1, t / 4));
      const k = Math.min(3, Math.floor(t));
      if (k !== cur) { cur = k; setFig(k); }
    },
  });
  setFig(0);
  // boil: re-seed the displacement noise so lines tremble like plotted ink
  const turb = svg.querySelector('[data-boil]');
  let seed = 1;
  const iv = window.setInterval(() => { if (turb) turb.setAttribute('seed', String((seed = (seed % 6) + 1))); }, 140);
  onDispose(() => { st.kill(); tl.kill(); clearInterval(iv); });
}
