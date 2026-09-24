// Home: scroll position → story position `s` for the specimen, legend fades, and the key layer.
// Block k (1..5) maps to s ∈ [k-1, k]; the hero is s ∈ [-1, 0]; the tail opens the aperture (s ∈ [5, 6]).
import { Specimen, type Label } from './specimen';
import { lerp } from './draw';

/** Aperture placement. Desktop: right of the legends (figs 1–3), then left and larger (fig 4 onward: `compose`). */
export const homeLayout = (w: number, h: number, compose: number) => {
  if (w < 760) { const R = Math.min(w * 0.53, h * 0.245); return { cx: w / 2, cy: 42 + R * 0.95, R }; }
  const R1 = Math.min(h * 0.42, w * 0.29), R2 = Math.min(h * 0.45, w * 0.31);
  return { cx: lerp(w * 0.665, w * 0.36, compose), cy: h * 0.5 + 8, R: lerp(R1, R2, compose) };
};

export function initHome() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-specimen]');
  const home = document.querySelector<HTMLElement>('[data-home]');
  const keysEl = document.querySelector<HTMLElement>('[data-keys]');
  if (!canvas || !home || !keysEl) return;
  const root = document.documentElement;
  const RM = root.classList.contains('rm');
  const sp = new Specimen({ canvas, reduced: RM, layout: homeLayout, labels: true });
  const blocks = [...document.querySelectorAll<HTMLElement>('[data-block]')];
  const legends = [...document.querySelectorAll<HTMLElement>('[data-legend]')];
  const mobile = () => innerWidth < 760;

  // key layer: one element per label id, positioned every frame
  const els = new Map<string, HTMLSpanElement>();
  sp.onLabels = (ls: Label[]) => {
    for (const l of ls) {
      let e = els.get(l.id);
      if (!e) { e = document.createElement('span'); e.textContent = l.text; e.className = l.key ? '-key' : '-word'; keysEl.appendChild(e); els.set(l.id, e); }
      if (!l.key) { const dx = l.x - l.ax; e.classList.toggle('-l', dx < -8); e.classList.toggle('-c', Math.abs(dx) <= 8); }
      e.style.opacity = l.a.toFixed(3);
      e.style.visibility = l.a > 0.01 ? 'visible' : 'hidden';
      if (l.a > 0.01) {
        // keep every label on screen (the phone aperture is wider than the screen)
        let x = l.x; const W = innerWidth;
        if (l.key) x = Math.min(W - 14, Math.max(14, x));
        else { const w = e.offsetWidth; const left = e.classList.contains('-l') ? x - w : e.classList.contains('-c') ? x - w / 2 : x; x += Math.max(0, 10 - left) - Math.max(0, left + w - (W - 10)); }
        e.style.transform = `translate(${x.toFixed(1)}px, ${l.y.toFixed(1)}px)`;
      }
    }
  };

  const setApertureVars = () => {
    const L = homeLayout(innerWidth, innerHeight, 0);
    if (mobile()) home.style.setProperty('--ap-b', `${Math.round(L.cy + L.R + 10)}px`);
    else home.style.removeProperty('--ap-b');
    const last = legends[legends.length - 1];
    if (last && mobile()) home.style.setProperty('--last-top', `${Math.round(innerHeight - last.offsetHeight)}px`);
  };

  const measure = () => {
    const vh = innerHeight; const anchor = vh * (mobile() ? 0.97 : 0.82);
    let s = -1;
    for (const b of blocks) {
      const k = +b.dataset.block!; const r = b.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (anchor - r.top) / r.height));
      if (anchor >= r.top) s = k === 0 ? -1 + p : k - 1 + p;
    }
    if (RM) s = s < 0 ? -1 : Math.min(6, Math.ceil(s - 0.15)); // reduced motion: settled states only
    sp.sTarget = s; if (RM) sp.s = s;
    sp.heroA = 1 - Math.min(1, Math.max(0, scrollY / (vh * (mobile() ? 0.09 : 0.3))));
    // legend k is fully visible for s ∈ [k-1+0.1, k-0.1]
    legends.forEach((lg) => {
      const k = +lg.dataset.legend!;
      const a = RM ? (Math.round(s) === k || (s >= 5 && k === 5) ? 1 : 0)
        : Math.min(1, Math.max(0, (s - (k - 1 + (k === 4 && !mobile() ? 0.2 : 0.04))) / 0.08)) * Math.min(1, Math.max(0, (k + (k === 5 ? 0.45 : 0) + 0.05 - s) / 0.08));
      lg.style.opacity = a.toFixed(3);
      lg.style.visibility = a > 0.005 ? 'visible' : 'hidden';
    });
    home.classList.toggle('is-open', s > 4.45);
    if (RM) sp.draw();
  };

  canvas.addEventListener('pointermove', (e) => sp.setPointer(e.clientX, e.clientY, true));
  canvas.addEventListener('pointerleave', () => sp.setPointer(0, 0, false));
  addEventListener('scroll', measure, { passive: true });
  let rz = 0;
  addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { setApertureVars(); sp.resize(); measure(); }); });
  setApertureVars(); measure(); sp.s = sp.sTarget;
  document.fonts?.ready.then(() => { setApertureVars(); sp.draw(); });

  if (RM) { sp.draw(); return; }
  let inView = true;
  const io = new IntersectionObserver(([en]) => { inView = en.isIntersecting; if (inView && !document.hidden) sp.start(); else sp.stop(); });
  io.observe(home);
  document.addEventListener('visibilitychange', () => { if (document.hidden || !inView) sp.stop(); else sp.start(); });
  (window as any).__specimen = sp; // for headless review
}
