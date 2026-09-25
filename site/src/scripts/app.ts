import { mountScene } from './light/scene';
import { paintPlates } from './plates';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const field = mountScene();
paintPlates();

// ---- the navigation and the text follow the light behind them
const nav = document.querySelector<HTMLElement>('[data-nav]');
const toned = [...document.querySelectorAll<HTMLElement>('[data-tone-section]')];
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lumOf = (c: Float32Array, o: number) => 0.2126 * c[o] + 0.7152 * c[o + 1] + 0.0722 * c[o + 2];
function navTone() {
  let tone = root.dataset.tone || 'day';
  if (field) {
    const c = field.cur; // wallTop, wallMid are the first two parameters
    const top = lumOf(c, 0), wall = (top + lumOf(c, 3) + lumOf(c, 6)) / 3;
    tone = top < 0.55 ? 'dusk' : 'day';
    // the nav gets a plain tint of the wall behind it, fading out by ~80px
    root.style.setProperty('--nav-tint', `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)})`);
    // a section's text shows only where the light behind it can carry it (dark text on a light wall,
    // light text on a dark one), so text and light always change at the same point
    const vh = window.innerHeight;
    for (const s of toned) {
      const r = s.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) continue;
      const o = s.dataset.toneSection === 'dusk' ? 1 - sstep(0.5, 0.64, wall) : sstep(0.44, 0.6, wall);
      s.style.opacity = o > 0.995 ? '' : o.toFixed(3);
    }
  } else {
    for (const s of toned) {
      const r = s.getBoundingClientRect();
      if (r.top <= 28 && r.bottom > 28) { tone = s.dataset.toneSection!; break; }
    }
  }
  if (root.dataset.navTone !== tone) root.dataset.navTone = tone;
  nav?.classList.toggle('is-scrolled', window.scrollY > 8);
}
if (field) field.onFrame = navTone;
navTone();
window.addEventListener('scroll', navTone, { passive: true });
window.addEventListener('resize', navTone);

// ---- the home moment's text fades with its section; its line changes when the light is reshaped
const roomTexts = [...document.querySelectorAll<HTMLElement>('.moment__text')];
const momentLines = [...document.querySelectorAll<HTMLElement>('[data-moment-line]')];
function fadeRooms() {
  const vh = window.innerHeight;
  for (const t of roomTexts) {
    const r = t.closest('section')!.getBoundingClientRect();
    const inn = clamp01((vh * 0.55 - r.top) / (vh * 0.2));
    const out = clamp01((r.bottom - vh * 0.5) / (vh * 0.2));
    t.style.opacity = Math.min(inn, out).toFixed(3);
    const k = (vh * 0.5 - r.top) / r.height > 0.55 ? 1 : 0;
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
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') { toggle.click(); toggle.focus(); }
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
