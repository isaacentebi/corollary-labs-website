// Smaller grounds for the inner pages. Each [data-band] carries a JSON config:
//   stones: [{ x, y, r, a?, rot?, rose?, k? }]  x, y as fractions of the band (-0.5..0.5), r as a fraction of min(w, h)
//   clear:  a selector whose box becomes a clearing in the lines (a heading resting on the ground)
//   hover:  a selector; hovering the i-th match lifts and warms stone i
import { Ground } from './ground';
import { stone, step, type Stone } from './stones';

type Cfg = {
  stones: { x: number; y: number; r: number; a?: number; rot?: number; rose?: number; k?: number }[];
  mstones?: { x: number; y: number; r: number }[];   // positions on narrow screens (same stones, same order)
  clear?: string; hover?: string; space?: number; zoom?: number;
};

export function initBands(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-band]').forEach((el) => {
    try { band(el); } catch (e) { el.classList.add('no-gl'); }
  });
}

function band(el: HTMLElement) {
  const cfg: Cfg = JSON.parse(el.dataset.band || '{}');
  const canvas = document.createElement('canvas');
  canvas.className = 'band__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  el.prepend(canvas);
  const ground = new Ground(canvas, { maxScale: 1.5 });
  el.classList.add('has-gl');
  const reduced = document.documentElement.classList.contains('rm');

  let W = 0, H = 0, unit = 1;
  const stones: (Stone & { tr0: number })[] = cfg.stones.map((s, i) => stone({ x: 0, y: 0, r: 10, aspect: s.a ?? 1.12, rot: s.rot ?? i * 1.3, k: s.k ?? 1.7, rose: s.rose ?? 0, trose: s.rose ?? 0, lift: 0, tlift: 1 }) as Stone & { tr0: number });
  let cap: any = null;
  const clearEl = cfg.clear ? el.querySelector<HTMLElement>(cfg.clear) ?? document.querySelector<HTMLElement>(cfg.clear) : null;

  function layout() {
    const r = el.getBoundingClientRect();
    W = r.width; H = r.height;
    if (W < 2 || H < 2) return;
    unit = Math.min(W, H);
    ground.resize(W, H, Math.min(window.devicePixelRatio || 1, W < 720 ? 1.5 : 1.25));
    const narrow = W < 720 && cfg.mstones;
    cfg.stones.forEach((c0, i) => {
      const s = stones[i];
      const c = narrow ? { ...c0, ...cfg.mstones![i] } : c0;
      s.tx = c.x * W; s.ty = c.y * H; s.tr = s.tr0 = c.r * unit;
      if (s.lift === 0) { s.x = s.tx; s.y = s.ty; s.r = s.tr; }
    });
    if (clearEl) {
      const b = clearEl.getBoundingClientRect();
      const cx = b.left + b.width / 2 - r.left - W / 2, cy = b.top + b.height / 2 - r.top - H / 2;
      const hw = b.width / 2, hh = b.height / 2, rr = Math.min(hw, hh), isl = rr * 1.1 + 12;
      cap = hw >= hh
        ? { ax: cx - hw + rr * 0.6, ay: cy, bx: cx + hw - rr * 0.6, by: cy, R: 1, clear: isl, k: 1 }
        : { ax: cx, ay: cy - hh + rr * 0.6, bx: cx, by: cy + hh - rr * 0.6, R: 1, clear: isl, k: 1 };
    }
  }

  const mouse = { x: 0, y: 0, s: 0, ts: 0 };
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    mouse.x = e.clientX - r.left - W / 2; mouse.y = e.clientY - r.top - H / 2; mouse.ts = 0.8; kick();
  });
  el.addEventListener('pointerleave', () => { mouse.ts = 0; kick(); });

  if (cfg.hover) {
    document.querySelectorAll<HTMLElement>(cfg.hover).forEach((h, i) => {
      const s = stones[i]; if (!s) return;
      const base = cfg.stones[i];
      const on = () => { s.trose = 1; s.tr = s.tr0 * 1.1; kick(); };
      const off = () => { s.trose = base.rose ?? 0; s.tr = s.tr0; kick(); };
      h.addEventListener('pointerenter', on); h.addEventListener('pointerleave', off);
      h.addEventListener('focusin', on); h.addEventListener('focusout', off);
    });
  }

  let raf = 0, last = performance.now(), visible = false, open = reduced ? 1 : 0;
  const t0 = performance.now();
  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    mouse.s += (mouse.ts - mouse.s) * (1 - Math.exp(-5 * dt));
    step(stones, dt, { instant: reduced, gap: 6 });
    open = Math.min(1, open + dt / 1.6);
    const ok = open * open * (3 - 2 * open);
    ground.draw({
      cam: [0, 0], zoom: cfg.zoom ?? 1, space: cfg.space ?? (W < 720 ? 9 : 13), time: reduced ? 0 : (now - t0) / 1000,
      stones, cap: cap ? { ...cap, k: ok } : null, mouse: reduced ? null : { x: mouse.x, y: mouse.y, s: mouse.s, R: 34 },
    });
    const moving = stones.some((s) => Math.abs(s.vx) + Math.abs(s.vy) > 0.02 || Math.abs(s.lift - s.tlift) > 0.002 || Math.abs(s.rose - s.trose) > 0.002 || Math.abs(s.r - s.tr) > 0.05) || Math.abs(mouse.s - mouse.ts) > 0.002 || open < 1;
    if (visible && moving) kick();
  }
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { last = performance.now(); kick(); } }).observe(el);
  new ResizeObserver(() => { layout(); kick(); }).observe(el);
  layout();
  if (document.fonts) document.fonts.ready.then(() => { layout(); kick(); });
}
