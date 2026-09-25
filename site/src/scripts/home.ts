// Home: two uses of the one drawing, both rendered on demand.
//   hero      the organisation as a living cell, behind the name and headline; the pointer presses its wall
//   approach  the same drawing told in four beats (01–04): it plays through once when it comes into view,
//             and each beat can be chosen; transitions scrub the story position `s` smoothly
import { Specimen } from './specimen';
import { live } from './live';
import { beats } from '../config/site';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// hero aperture: to the right of the copy on desktop, above it on phones
export const heroLayout = (w: number, h: number) => {
  if (w < 760) { const R = Math.min(w * 0.4, innerHeight * 0.19, 170); return { cx: w / 2, cy: 64 + R + 4, R }; }
  const m = Math.max(w * 0.05, 56);
  const R = Math.max(210, Math.min(h * 0.4, w * 0.28, (w - m - 600) / 2));
  return { cx: w - R - m, cy: h * 0.52 + 14, R };
};

function initHero(RM: boolean) {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-specimen]');
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!canvas || !hero) return;
  const root = document.documentElement;
  const sp = new Specimen({ canvas, plate: -1, reduced: RM, layout: heroLayout });
  const L = live(sp);
  hero.addEventListener('pointermove', (e) => { sp.setPointer(e.clientX, e.clientY, true); L.wake(1400); });
  hero.addEventListener('pointerleave', () => { sp.setPointer(0, 0, false); L.wake(1200); });
  let rz = 0;
  addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { sp.resize(); L.wake(300); }); });
  new IntersectionObserver(([en]) => L.setVisible(en.isIntersecting, 5000)).observe(hero);
  const past = () => root.classList.toggle('past-hero', scrollY > hero.offsetHeight * 0.55);
  addEventListener('scroll', past, { passive: true }); past();
  L.wake(6500);
  (window as any).__specimen = sp; // for headless review
}

function initApproach(RM: boolean) {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-approach]');
  const btns = [...document.querySelectorAll<HTMLButtonElement>('[data-beat]')];
  if (!canvas || !btns.length) return;
  const sp = new Specimen({ canvas, plate: beats[0].s, reduced: RM, closed: true, layout: (w, h) => ({ cx: w / 2, cy: h / 2, R: Math.min(w, h) * 0.47 }) });
  const DWELL = 2.4;
  let cur = 0, from = beats[0].s, to = beats[0].s, t = 0, dur = 0, auto = !RM, playing = false, dwell = 0;

  const mark = () => btns.forEach((b, i) => {
    b.setAttribute('aria-pressed', String(i === cur));
    b.style.setProperty('--p', i < cur ? '1' : '0');
  });
  const go = (i: number) => {
    cur = i; from = sp.s; to = beats[i].s; t = 0; dwell = 0;
    const d = Math.abs(to - from);
    dur = RM ? 0 : clamp(d * (to < from ? 0.55 : 1.35), 0.6, 3);
    canvas.setAttribute('aria-label', `${beats[i].n} ${beats[i].title}`);
    mark();
  };
  const step = (dt: number) => {
    if (t < dur) { t += dt; sp.s = sp.sTarget = from + (to - from) * ease(clamp(t / dur)); }
    else { sp.s = sp.sTarget = to; }
    const active = btns[cur];
    if (auto && playing && t >= dur) {
      dwell += dt;
      active.style.setProperty('--p', cur < beats.length - 1 ? clamp(dwell / DWELL).toFixed(3) : '1');
      if (dwell >= DWELL) { if (cur < beats.length - 1) go(cur + 1); else auto = false; }
    } else if (!auto) active.style.setProperty('--p', '1');
    return t < dur || (auto && playing);
  };
  const L = live(sp, step);
  btns.forEach((b, i) => b.addEventListener('click', () => { auto = false; go(i); btns[i].style.setProperty('--p', '1'); L.wake(RM ? 0 : dur * 1000 + 2500); }));
  go(0);
  let rz = 0;
  addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { sp.resize(); L.wake(300); }); });
  new IntersectionObserver(([en]) => {
    L.setVisible(en.isIntersecting, 3000);
    if (en.isIntersecting && en.intersectionRatio >= 0.45 && auto && !playing) { playing = true; dwell = 0; L.wake(DWELL * 1000); }
  }, { threshold: [0, 0.45] }).observe(canvas);
  if (RM) { sp.draw(); }
  (window as any).__approach = { sp, go };
}

export function initHome() {
  const RM = document.documentElement.classList.contains('rm');
  initHero(RM);
  initApproach(RM);
}
