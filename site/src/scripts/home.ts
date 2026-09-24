// Home: scroll → story position `s` for the drawing, over about three screens.
//   hero   0.0–0.3 vh   s −1 → 0     (the hero copy fades; the firm idles)
//   fig 1  0.3–1.0 vh   s  0 → 1     the firm
//   fig 2  1.0–2.2 vh   s  1 → 4     an agent enters, plan-making, reorganisation
//   fig 3  2.2–2.9 vh   s  4 → 5.2   the change spreads; the aperture opens
import { Specimen } from './specimen';

export const homeLayout = (w: number, h: number) => {
  if (w < 760) { const R = Math.min(w * 0.53, h * 0.245); return { cx: w / 2, cy: 42 + R * 0.95, R }; }
  const R = Math.min(h * 0.42, w * 0.29);
  return { cx: w * 0.665, cy: h * 0.5 + 8, R };
};

const MAP: [number, number, number, number][] = [[0, 0.3, -1, 0], [0.3, 1.0, 0, 1], [1.0, 2.2, 1, 4], [2.2, 2.9, 4, 5.2]];
const toS = (y: number) => {
  for (const [a, b, s0, s1] of MAP) if (y <= b) return s0 + (Math.max(0, y - a) / (b - a)) * (s1 - s0);
  return 5.2;
};

export function initHome() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-specimen]');
  const home = document.querySelector<HTMLElement>('[data-home]');
  if (!canvas || !home) return;
  const root = document.documentElement;
  const RM = root.classList.contains('rm');
  const sp = new Specimen({ canvas, reduced: RM, layout: homeLayout, labels: false });
  const legends = [...document.querySelectorAll<HTMLElement>('[data-legend]')];
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const mobile = () => innerWidth < 760;

  const setVars = () => {
    const L = homeLayout(innerWidth, innerHeight);
    if (mobile()) home.style.setProperty('--ap-b', `${Math.round(L.cy + L.R + 10)}px`);
    else home.style.removeProperty('--ap-b');
  };

  const measure = () => {
    const vh = innerHeight;
    const y = (scrollY - home.offsetTop) / vh;
    let s = toS(y);
    if (RM) s = y < 0.3 ? -1 : y < 1.0 ? 1 : y < 2.2 ? 3.98 : 5.2; // reduced motion: settled states only
    sp.sTarget = s; if (RM) sp.s = s;
    legends.forEach((lg, i) => {
      const s0 = +lg.dataset.s0!, s1 = +lg.dataset.s1!, last = i === legends.length - 1;
      const inAt = s0 + (i === 0 ? 0.12 : 0.04), outAt = last ? 99 : s1 + 0.04;
      const a = RM ? (s >= s0 && (s < s1 || last) ? 1 : 0)
        : Math.min(1, Math.max(0, (s - inAt) / 0.08)) * Math.min(1, Math.max(0, (outAt - s) / 0.08));
      lg.style.opacity = a.toFixed(3);
      lg.style.visibility = a > 0.005 ? 'visible' : 'hidden';
    });
    if (hero) { const ha = RM ? (y < 0.3 ? 1 : 0) : 1 - Math.min(1, Math.max(0, (y - 0.03) / 0.25)); hero.style.opacity = ha.toFixed(3); }
    home.classList.toggle('is-open', s > 4.45);
    root.classList.toggle('is-dark', s > 3.06 && s < 4.0);
    root.classList.toggle('past-hero', y > 0.3);
    if (RM) sp.draw();
  };

  canvas.addEventListener('pointermove', (e) => sp.setPointer(e.clientX, e.clientY, true));
  canvas.addEventListener('pointerleave', () => sp.setPointer(0, 0, false));
  addEventListener('scroll', measure, { passive: true });
  let rz = 0;
  addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { setVars(); sp.resize(); measure(); }); });
  setVars(); measure(); sp.s = sp.sTarget;

  if (RM) { sp.draw(); return; }
  let inView = true;
  const io = new IntersectionObserver(([en]) => { inView = en.isIntersecting; if (inView && !document.hidden) sp.start(); else sp.stop(); });
  io.observe(home);
  document.addEventListener('visibilitychange', () => { if (document.hidden || !inView) sp.stop(); else sp.start(); });
  (window as any).__specimen = sp; // for headless review
}
