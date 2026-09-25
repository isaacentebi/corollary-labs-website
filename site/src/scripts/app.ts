import { mountScene } from './light/scene';
import { KEYS, SIZES } from './light/params';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const field = mountScene();

// ---- the navigation and the text follow the light behind them
const nav = document.querySelector<HTMLElement>('[data-nav]');
const toned = [...document.querySelectorAll<HTMLElement>('[data-tone-section]')];
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// relative luminance of the field at a height on screen (the same gradient the shader draws, without
// its horizontal variation), so text is judged against the light actually behind it
const OFF: Record<string, number> = {};
{ let o = 0; KEYS.forEach((k, i) => { OFF[k] = o; o += SIZES[i]; }); }
const L = (v: number) => Math.pow(Math.max(v, 0), 2.2);
function fieldAt(c: Float32Array, yPx: number): number[] {
  const y = 0.5 - yPx / window.innerHeight;
  const g = (k: string, j = 0) => c[OFF[k] + j];
  const h = g('horizon');
  const out = [0, 0, 0];
  for (let ch = 0; ch < 3; ch++) {
    let v: number;
    if (y > h) {
      const t = Math.pow(sstep(h, 0.6, y), 0.7);
      v = L(g('wallMid', ch)) + (L(g('wallTop', ch)) - L(g('wallMid', ch))) * t;
      v += L(g('glowCol', ch)) * g('glowAmt') * Math.exp(-(y - h) / Math.max(g('glowW'), 1e-3)) * 0.8;
    } else {
      const t = sstep(h, -0.6, y);
      v = L(g('groundTop', ch)) + (L(g('groundBot', ch)) - L(g('groundTop', ch))) * t;
      v += L(g('glowCol', ch)) * g('glowAmt') * g('groundGlow') * Math.exp(-(h - y) / Math.max(g('glowW') * 0.35, 1e-3)) * 0.7;
    }
    out[ch] = Math.min(v, 0.88);
  }
  return out;
}
const lumAt = (c: Float32Array, yPx: number) => { const f = fieldAt(c, yPx); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
// dark ink (#16151b) and near-white text have equal contrast against a background of about 0.19
const FLIP = 0.19;
const footer = document.querySelector<HTMLElement>('.footer');
function navTone() {
  let tone = root.dataset.tone || 'day';
  if (field) {
    const c = field.cur;
    tone = lumAt(c, 30) < FLIP ? 'dusk' : 'day';
    // a section's text shows only where the light behind it can carry it (dark text on a light field,
    // light text on a dark one), so text and light always change at the same point
    const vh = window.innerHeight;
    for (const s of toned) {
      const r = s.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) continue;
      const probe = (s.querySelector<HTMLElement>('[data-tone-probe]') ?? s).getBoundingClientRect();
      const yc = Math.min(vh - 1, Math.max(0, (Math.max(probe.top, 0) + Math.min(probe.bottom, vh)) / 2));
      const lum = lumAt(c, yc);
      const o = s.dataset.toneSection === 'dusk' ? 1 - sstep(FLIP - 0.06, FLIP + 0.06, lum) : sstep(FLIP - 0.06, FLIP + 0.06, lum);
      s.style.opacity = o > 0.995 ? '' : o.toFixed(3);
    }
    if (footer) {
      const r = footer.getBoundingClientRect();
      if (r.top < vh) footer.dataset.ft = lumAt(c, Math.min(vh - 1, Math.max(0, (r.top + Math.min(r.bottom, vh)) / 2))) < FLIP ? 'dark' : 'light';
    }
  } else {
    for (const s of toned) {
      const r = s.getBoundingClientRect();
      if (r.top <= 28 && r.bottom > 28) { tone = s.dataset.toneSection!; break; }
    }
  }
  if (root.dataset.navTone !== tone) root.dataset.navTone = tone;
  // the navigation steps out of the way while reading down, and returns when scrolling up (over a
  // fade of the field's own colour, so nothing collides with it)
  const y = window.scrollY;
  if (!root.classList.contains('menu-open')) {
    if (y > 120 && y > lastY + 4) nav?.classList.add('is-away');
    else if (y < lastY - 4 || y <= 120) nav?.classList.remove('is-away');
  }
  lastY = y;
  nav?.classList.toggle('is-scrolled', y > 8);
  if (field) {
    const f = fieldAt(field.cur, 12).map((v) => Math.round(Math.pow(v, 1 / 2.2) * 255));
    root.style.setProperty('--nav-tint', `${f[0]} ${f[1]} ${f[2]}`);
  }
}
let lastY = window.scrollY;
if (field) field.onFrame = navTone;
navTone();
window.addEventListener('scroll', navTone, { passive: true });
window.addEventListener('resize', navTone);

// ---- the home moment's text fades with its section; its line changes when the light is reshaped
// (the Thinking page's texts do the same: one at a time, gone before the next one arrives)
const roomTexts = [...document.querySelectorAll<HTMLElement>('.moment__text, .idea__text')];
const momentLines = [...document.querySelectorAll<HTMLElement>('[data-moment-line]')];
function fadeRooms() {
  const vh = window.innerHeight;
  for (const t of roomTexts) {
    const r = t.closest('section')!.getBoundingClientRect();
    const idea = t.classList.contains('idea__text');
    const inn = idea ? clamp01((vh * 0.55 - r.top) / (vh * 0.2)) : clamp01((vh * 0.3 - r.top) / (vh * 0.15));
    // an idea's text fades as the end of its section starts to push it up
    const outAt = window.innerWidth < 760 ? 0.7 : 0.8;
    const out = idea ? clamp01((r.bottom - vh * outAt) / (vh * 0.18)) : clamp01((r.bottom - vh * 0.5) / (vh * 0.2));
    t.style.opacity = Math.min(inn, out).toFixed(3);
    const k = (vh * 0.5 - r.top) / r.height > 0.46 ? 1 : 0;
    momentLines.forEach((l) => l.classList.toggle('is-on', +l.dataset.momentLine! === k));
  }
}
if (roomTexts.length) {
  fadeRooms();
  window.addEventListener('scroll', () => requestAnimationFrame(fadeRooms), { passive: true });
  window.addEventListener('resize', fadeRooms);
}

// ---- mobile menu
const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menu = document.querySelector<HTMLElement>('[data-menu]');
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  if (open) {
    menu!.hidden = false;
    menu!.inert = false;
    requestAnimationFrame(() => menu!.classList.add('is-open'));
    menu!.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
  } else {
    menu!.classList.remove('is-open');
    menu!.inert = true;
    window.setTimeout(() => { if (toggle.getAttribute('aria-expanded') !== 'true') menu!.hidden = true; }, reduced ? 0 : 320);
  }
  toggle.querySelector('.nav__toggle-label')!.textContent = open ? 'Close' : 'Menu';
  root.classList.toggle('menu-open', open);
  // everything behind the menu is out of reach while it is open
  for (const el of document.querySelectorAll<HTMLElement>('main, .footer, .nav__brand')) el.inert = open;
});
document.addEventListener('keydown', (e) => {
  if (!toggle || toggle.getAttribute('aria-expanded') !== 'true') return;
  if (e.key === 'Escape') { toggle.click(); toggle.focus(); return; }
  if (e.key === 'Tab') {
    // Tab loops between the menu's links and the Close button
    const items = [...menu!.querySelectorAll<HTMLElement>('a'), toggle];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 || i < 0 ? 0 : i + 1);
    e.preventDefault();
    items[next].focus();
  }
});

// ---- text arrives as the light reaches it
const io = new IntersectionObserver((entries) => {
  for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
document.querySelectorAll('[data-reveal]').forEach((el) => {
  // whatever is on the first screen arrives at once; the rest as it is reached
  if (reduced || el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in');
  else io.observe(el);
});
