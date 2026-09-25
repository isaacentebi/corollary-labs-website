import { mountScene } from './light/scene';
import { KEYS, SIZES } from './light/params';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const field = mountScene();

// ---- text colour follows the light behind it. Text is never faded to reach contrast: its colour
// switches (dark ink on light, near-white on dark) at the luminance where both have equal contrast.
const OFF: Record<string, number> = {};
{ let o = 0; KEYS.forEach((k, i) => { OFF[k] = o; o += SIZES[i]; }); }
const L = (v: number) => Math.pow(Math.max(v, 0), 2.2);
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function fieldAt(c: Float32Array, xPx: number, yPx: number): number[] {
  const vh = window.innerHeight;
  const x = (xPx - window.innerWidth / 2) / vh, y = 0.5 - yPx / vh;
  const g = (k: string, j = 0) => c[OFF[k] + j];
  const out = [0, 0, 0];
  const t = sstep(-0.55, 0.55, y);
  const gx = (x - g('fieldGlowC')) / Math.max(g('fieldGlowR'), 0.01), gy = (y - g('fieldGlowC', 1)) / Math.max(g('fieldGlowR', 1), 0.01);
  const dist = x - g('lineX');
  const ext = (y > g('lineBot') && y < g('lineTop')) ? 1 : 0;
  for (let ch = 0; ch < 3; ch++) {
    let v = L(g('fieldBot', ch)) + (L(g('fieldTop', ch)) - L(g('fieldBot', ch))) * t;
    v += L(g('fieldGlowCol', ch)) * g('fieldGlowAmt') * Math.exp(-(gx * gx + gy * gy));
    const w = Math.max(g('lineGlowW'), 1e-3);
    v += (dist < 0 ? L(g('glowUp', ch)) * Math.exp(dist / w) : L(g('glowDn', ch)) * Math.exp(-dist / w)) * g('lineGlowAmt') * ext;
    // soft fields of light (screen)
    for (const [b, bc] of [['blob0', 'blobCol0'], ['blob1', 'blobCol1'], ['blob2', 'blobCol2']]) {
      const dx = Math.abs(x - g(b)) / Math.max(g(b, 2), 1e-3), dy = Math.abs(y - g(b, 1)) / Math.max(g(b, 3), 1e-3);
      const d = Math.pow(Math.pow(dx, 2.4) + Math.pow(dy, 2.4), 1 / 2.4) - 1;
      const a = 1 - sstep(-0.7, 0.35, d);
      v = 1 - (1 - v) * (1 - L(g(bc, ch)) * a * g('mixAmt'));
    }
    // bands are deep: treat them as dark
    v = v + (0.012 - v) * g('bandAmt');
    out[ch] = Math.min(v, 0.86);
  }
  return out;
}
const lumAt = (c: Float32Array, x: number, y: number) => { const f = fieldAt(c, x, y); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
const FLIP = 0.19;

const nav = document.querySelector<HTMLElement>('[data-nav]');
const toned = [...document.querySelectorAll<HTMLElement>('[data-tone-section], .footer')];
let lastY = window.scrollY;
let queued = false;
function syncTone() {
  queued = false;
  const vh = window.innerHeight, vw = window.innerWidth;
  // reads first
  const y = window.scrollY;
  const rects = toned.map((s) => {
    const r = s.getBoundingClientRect();
    if (r.bottom < -40 || r.top > vh + 40) return null;
    const probe = (s.querySelector<HTMLElement>('[data-tone-probe]') ?? s).getBoundingClientRect();
    return { x: Math.min(vw - 1, Math.max(0, probe.left + Math.min(probe.width, vw) / 2)), y: Math.min(vh - 1, Math.max(0, (Math.max(probe.top, 0) + Math.min(probe.bottom, vh)) / 2)) };
  });
  // then writes
  if (field) {
    const c = field.cur;
    const navTone = lumAt(c, vw / 2, 30) < FLIP ? 'dusk' : 'day';
    if (root.dataset.navTone !== navTone) root.dataset.navTone = navTone;
    toned.forEach((s, i) => {
      const r = rects[i];
      if (!r) return;
      const ink = lumAt(c, r.x, r.y) < FLIP ? 'light' : 'dark';
      if (s.dataset.ink !== ink) s.dataset.ink = ink;
    });
    // the page colour follows the field, so no edge of the page ever shows another colour
    const f = fieldAt(c, vw / 2, vh / 2).map((v) => Math.round(Math.pow(v, 1 / 2.2) * 255));
    root.style.setProperty('--field', `rgb(${f[0]} ${f[1]} ${f[2]})`);
  }
  if (!root.classList.contains('menu-open')) {
    if (y > 120 && y > lastY + 4) nav?.classList.add('is-away');
    else if (y < lastY - 4 || y <= 120) nav?.classList.remove('is-away');
  }
  lastY = y;
  nav?.classList.toggle('is-scrolled', y > 8);
}
const request = () => { if (!queued) { queued = true; requestAnimationFrame(syncTone); } };
if (field) field.onFrame = request;
syncTone();
window.addEventListener('scroll', request, { passive: true });
window.addEventListener('resize', request);

// ---- mobile menu
const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menu = document.querySelector<HTMLElement>('[data-menu]');
function setMenu(open: boolean) {
  if (!toggle || !menu) return;
  toggle.setAttribute('aria-expanded', String(open));
  if (open) {
    menu.hidden = false;
    menu.inert = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    menu.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
  } else {
    menu.classList.remove('is-open');
    menu.inert = true;
    window.setTimeout(() => { if (toggle.getAttribute('aria-expanded') !== 'true') menu.hidden = true; }, reduced ? 0 : 320);
  }
  toggle.querySelector('.nav__toggle-label')!.textContent = open ? 'Close' : 'Menu';
  root.classList.toggle('menu-open', open);
  // everything behind the menu is out of reach while it is open
  for (const el of document.querySelectorAll<HTMLElement>('main, .footer, .nav__brand')) el.inert = open;
}
toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
menu?.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('a')) setMenu(false); });
matchMedia('(min-width: 760px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
document.addEventListener('keydown', (e) => {
  if (!toggle || toggle.getAttribute('aria-expanded') !== 'true') return;
  if (e.key === 'Escape') { setMenu(false); toggle.focus(); return; }
  if (e.key === 'Tab') {
    // Tab loops between the menu's links and the Close button
    const items = [...menu!.querySelectorAll<HTMLElement>('a'), toggle];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 || i < 0 ? 0 : i + 1);
    e.preventDefault();
    items[next].focus();
  }
});

// ---- text arrives as it is reached (a short fade on arrival only; never used for contrast)
const io = new IntersectionObserver((entries) => {
  for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
}, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
document.querySelectorAll('[data-reveal]').forEach((el) => {
  if (reduced || el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in');
  else io.observe(el);
});
