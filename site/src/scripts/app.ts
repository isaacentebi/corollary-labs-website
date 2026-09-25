import { mountScene } from './light/scene';
import { paintPlates } from './plates';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

mountScene();
paintPlates();

// ---- nav tone follows the section behind it
const nav = document.querySelector<HTMLElement>('[data-nav]');
const toned = [...document.querySelectorAll<HTMLElement>('[data-tone-section]')];
function navTone() {
  const y = 28;
  let tone = root.dataset.tone || 'day';
  for (const s of toned) {
    const r = s.getBoundingClientRect();
    if (r.top <= y && r.bottom > y) { tone = s.dataset.toneSection!; break; }
  }
  root.dataset.navTone = tone;
  nav?.classList.toggle('is-scrolled', window.scrollY > 8);
}
navTone();
window.addEventListener('scroll', navTone, { passive: true });
window.addEventListener('resize', navTone);

// ---- room captions: one at a time; each fades in as its room arrives and out before the next one
const roomTexts = [...document.querySelectorAll<HTMLElement>('[data-room-text]')];
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
function fadeRooms() {
  const vh = window.innerHeight;
  for (const t of roomTexts) {
    const r = t.parentElement!.getBoundingClientRect();
    const inn = clamp01((vh * 0.78 - r.top) / (vh * 0.26));
    const out = clamp01((r.bottom - vh * 0.8) / (vh * 0.2));
    const o = Math.min(inn, out);
    t.style.opacity = o.toFixed(3);
    t.style.filter = reduced || o > 0.995 ? '' : `blur(${((1 - o) * 7).toFixed(2)}px)`;
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
  if (open) { menu!.hidden = false; requestAnimationFrame(() => menu!.classList.add('is-open')); }
  else { menu!.classList.remove('is-open'); window.setTimeout(() => { menu!.hidden = true; }, reduced ? 0 : 320); }
  root.classList.toggle('menu-open', open);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') toggle.click(); });

// ---- text arrives as the light reaches it
const io = new IntersectionObserver((entries) => {
  for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
}, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
document.querySelectorAll('[data-reveal]').forEach((el) => (reduced ? el.classList.add('in') : io.observe(el)));
