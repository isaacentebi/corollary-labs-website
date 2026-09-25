// Boot: smooth scroll, soft reveals, and the page's own ground.
import Lenis from 'lenis';
import { initHome } from './home';
import { initBands } from './band';

const d = document.documentElement;
const reduced = d.classList.contains('rm');

if (!reduced) {
  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
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

// the nav softens once the page scrolls under it
const nav = document.querySelector<HTMLElement>('[data-nav]');
const onScroll = () => nav?.classList.toggle('is-scrolled', window.scrollY > 24);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

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
