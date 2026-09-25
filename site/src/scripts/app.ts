// Boot: smooth scroll, soft reveals, and the page's own ground.
import Lenis from 'lenis';
import { initHome } from './home';
import { initBands } from './band';

const d = document.documentElement;
const reduced = d.classList.contains('rm');

if (!reduced) {
  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true, anchors: { duration: 1.4 } });
  const raf = (t: number) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  (window as any).__lenis = lenis;
}

// soft reveals: elements rise and unblur once, when they first enter
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

const main = document.querySelector<HTMLElement>('main');
if (main) {
  if (main.dataset.page === 'home') initHome(main);
  initBands(main);
}

// the nav gets a soft backing once content runs under it, and turns light over the dark ground
const nav = document.querySelector<HTMLElement>('[data-nav]');
let navQueued = false;
const navCheck = () => {
  navQueued = false;
  if (!nav) return;
  // transparent over a live ground; backed only when text runs under it
  let overGround = false;
  document.querySelectorAll<HTMLElement>('.field__stick, .band').forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < 8 && r.bottom > 64) overGround = true; });
  nav.classList.toggle('is-scrolled', window.scrollY > 24 && !overGround);
  let dark = false;
  document.querySelectorAll<HTMLElement>('[data-dark]').forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < 30 && r.bottom > 30) dark = true; });
  nav.classList.toggle('on-dark', dark);
  // on home, the link of the section in view is marked
  if (spy.length) {
    let cur = '';
    for (const [key, el] of spy) { const r = el.getBoundingClientRect(); if (r.top < window.innerHeight * 0.4 && r.bottom > window.innerHeight * 0.4) cur = key; }
    nav.querySelectorAll<HTMLElement>('[data-key]').forEach((a) => (a.dataset.key === cur ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
  }
};
const spy: [string, HTMLElement][] = main?.dataset.page === 'home'
  ? (['capabilities', 'approach', 'company', 'contact'] as const).flatMap((k) => { const el = document.getElementById(k); return el ? [[k === 'company' ? 'about' : k, el] as [string, HTMLElement]] : []; })
  : [];
const onScroll = () => { if (!navQueued) { navQueued = true; requestAnimationFrame(navCheck); } };
window.addEventListener('scroll', onScroll, { passive: true });
new MutationObserver(onScroll).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-dark'] });
navCheck();

// essays: sidenotes sit level with the note they belong to (wide screens only)
const prose = document.querySelector<HTMLElement>('.prose');
if (prose) {
  const place = () => {
    const wide = window.matchMedia('(min-width: 1180px)').matches;
    let floor = -Infinity;
    const top0 = prose.getBoundingClientRect().top;
    prose.querySelectorAll<HTMLElement>('.sidenote').forEach((n) => {
      if (!wide) { n.style.removeProperty('--y'); return; }
      const ref = document.getElementById(`ref-${n.dataset.note}`);
      if (!ref) return;
      const y = Math.max(ref.getBoundingClientRect().top - top0 - 4, floor);
      n.style.setProperty('--y', `${y}px`);
      floor = y + n.offsetHeight + 18;
    });
  };
  place();
  window.addEventListener('resize', place);
  document.fonts?.ready.then(place);
}
