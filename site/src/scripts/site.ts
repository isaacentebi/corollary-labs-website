// Site-wide behaviour: the dividing menu, soft reveals, and the footer tissue.
import { palette, clamp } from './draw';
import { makeTissue, stepTissue, drawTissue, tissueHit, type Tissue } from './tissue';

const root = document.documentElement;
const RM = root.classList.contains('rm');

// ── menu: the mark divides into one cell per page ───────────────────────
function initMenu() {
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  const btn = document.querySelector<HTMLButtonElement>('[data-nav-btn]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  if (!nav || !btn || !menu) return;
  const cells = [...menu.querySelectorAll<HTMLAnchorElement>('.menu__cell, .menu__foot a')];
  const set = (open: boolean) => {
    // daughter cells start where the mark is
    const m = btn.querySelector('svg')!.getBoundingClientRect();
    menu.querySelectorAll<HTMLElement>('.menu__cell').forEach((c) => {
      const cs = getComputedStyle(c);
      const x = (parseFloat(cs.getPropertyValue('--x')) / 100) * innerWidth, y = (parseFloat(cs.getPropertyValue('--y')) / 100) * innerHeight;
      c.style.setProperty('--fx', `${m.left + m.width / 2 - x}px`); c.style.setProperty('--fy', `${m.top + m.height / 2 - y}px`);
    });
    nav.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    cells.forEach((c) => (c.tabIndex = open ? 0 : -1));
    if (open) setTimeout(() => (menu.querySelector('.menu__cell') as HTMLElement)?.focus({ preventScroll: true }), 60);
  };
  set(false);
  btn.addEventListener('click', () => set(!nav.classList.contains('is-open')));
  menu.querySelector('[data-nav-close]')?.addEventListener('click', () => set(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { set(false); btn.focus(); } });
}

// ── reveals ─────────────────────────────────────────────────────────────
function initReveals() {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (RM || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((ens) => ens.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
}

// ── footer tissue ──────────────────────────────────────────────────────
export function tissueCanvas(canvas: HTMLCanvasElement, opts: { cell?: number; seed?: number; stainFrom?: number; stainSpeed?: number } = {}) {
  const ctx = canvas.getContext('2d')!; const P = palette();
  let T: Tissue; let w = 0, h = 0, dpr = 1, unit = 1;
  let t = 0, st = opts.stainFrom ?? 0, last = 0, raf = 0, running = false, hot = -1, px = -1e9, py = -1e9;
  const build = () => {
    const r = canvas.getBoundingClientRect(); w = r.width; h = r.height; dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    unit = opts.cell ?? (w < 700 ? 44 : 64); // px per tissue unit
    T = makeTissue(opts.seed ?? 3, w / unit + 4, h / unit + 4, 1.9, { divide: 0.12, shrink: 0.08, origin: [-(w / unit) * 0.28, (h / unit) * 0.18] });
  };
  const draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * unit, 0, 0, dpr * unit, (dpr * w) / 2, (dpr * h) / 2);
    stepTissue(T, st, t, RM ? 0 : 1);
    const hx = (px - w / 2) / unit, hy = (py - h / 2) / unit;
    hot = px > -1e8 ? tissueHit(T, hx, hy) : -1;
    drawTissue(ctx, T, { P, px: 1 / unit, st, t, hot, alpha: 0.9, view: [-w / 2 / unit, -h / 2 / unit, w / 2 / unit, h / 2 / unit] });
  };
  const loop = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    t += dt; st = clamp(st + dt * (opts.stainSpeed ?? 0.03), 0, 0.95);
    draw(); raf = requestAnimationFrame(loop);
  };
  build();
  if (RM) { st = 0.95; draw(); }
  else draw();
  const start = () => { if (running || RM) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const io = new IntersectionObserver(([en]) => (en.isIntersecting ? start() : stop()));
  io.observe(canvas);
  let rz = 0; addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { build(); draw(); }); });
  const host = canvas.parentElement!;
  host.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top; if (RM) draw(); });
  host.addEventListener('pointerleave', () => { px = py = -1e9; if (RM) draw(); });
  return { start, stop };
}

function initFooter() {
  const c = document.querySelector<HTMLCanvasElement>('[data-tissue]');
  if (c) tissueCanvas(c, { stainFrom: root.dataset.page === 'home' ? 0.95 : 0 });
  document.querySelectorAll('[data-to-top]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }); }));
}

initMenu();
initReveals();
initFooter();
