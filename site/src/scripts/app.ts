// Entry: boots the motion core once, then (re)initialises each page on Astro client-side navigation.
// Page transitions = Ref A's text shuffle (leave: 16 steps/s for 0.25 s; enter: 4 steps over 0.25 s)
// + Ref B's block fade (opacity 0.2 s ease-in).
import { initScroll, lenis, disposePage, reduced, gsap, ScrollTrigger, DUR, scrollState } from './core';
import { shuffle, initReveals, bindHoverShuffle } from './text';
import { initHeader } from './header';
import { runPreloader } from './preloader';
import { initWordmarks } from './wordmark';
import { initHome } from './home';
import { initEssay } from './essay';
import { initIndex } from './indexPage';
import { initFooter } from './footer';
import { DiffusionField } from './field';
import { MorphField } from './morph';

const root = document.documentElement;
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function restoreRootClasses() {
  root.classList.add('js');
  if (RM()) root.classList.add('rm');
  try { if (sessionStorage.getItem('corollary.intro')) root.classList.add('intro-seen'); } catch {}
  if (lenis) root.classList.add('lenis', 'lenis-smooth');
}

let booted = false;
let firstLoad = true;

async function initPage() {
  restoreRootClasses();
  DiffusionField.reduced = reduced();
  MorphField.reduced = reduced();
  clearTimeout((window as any).__motionFailsafe);
  const page = root.dataset.page;
  initHeader();
  initWordmarks();
  bindHoverShuffle();
  initFooter();

  let introDone: Promise<void> = Promise.resolve();
  if (firstLoad) introDone = runPreloader();
  else document.querySelector('[data-preloader]')?.remove();
  firstLoad = false;

  if (page === 'home') initHome(introDone);
  else if (page === 'essay') initEssay(introDone);
  else if (page === 'index' || page === 'about' || page === 'team') initIndex(introDone); // both open on a field band with a word in it

  await introDone;
  initReveals();
  root.classList.add('motion-ready');
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

// ── leave animation: shuffle visible leaf text + fade blocks ─────────
function leaveAnimation(): Promise<void> {
  if (reduced()) return Promise.resolve();
  return new Promise((resolve) => {
    const scope = document.querySelectorAll<HTMLElement>('[data-page-root] *, .c-header *');
    const vh = innerHeight;
    const leaves: Element[] = [];
    scope.forEach((el) => {
      if (el.children.length || !el.textContent?.trim()) return;
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh && r.width > 0) leaves.push(el);
    });
    leaves.slice(0, 400).forEach((el) => shuffle(el, { steps: 4, duration: DUR.d250 }));
    root.classList.add('is-navigating');
    gsap.delayedCall(DUR.d250, resolve);
  });
}

function enterAnimation() {
  root.classList.remove('is-navigating');
  if (reduced()) return;
  const vh = innerHeight;
  document.querySelectorAll<HTMLElement>('.c-header a, .c-header span').forEach((el) => {
    if (el.children.length || !el.textContent?.trim()) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < vh) shuffle(el, { steps: 4, duration: DUR.d250 });
  });
}

function boot() {
  if (booted) return; booted = true;
  initScroll();
  if (lenis) root.classList.add('lenis', 'lenis-smooth');

  document.addEventListener('astro:page-load', () => { initPage(); });

  document.addEventListener('astro:before-preparation', (ev: any) => {
    const original = ev.loader;
    ev.loader = async () => { await Promise.all([leaveAnimation(), original()]); };
  });
  document.addEventListener('astro:before-swap', () => {
    disposePage();
  });
  document.addEventListener('astro:after-swap', () => {
    restoreRootClasses();
    root.classList.add('is-navigating');
    const hash = location.hash;
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true }); else scrollTo(0, 0);
    scrollState.y = 0;
    requestAnimationFrame(() => {
      enterAnimation();
      if (hash) { const t = document.querySelector(hash); if (t) lenis ? lenis.scrollTo(t as HTMLElement, { offset: -60, duration: 1.2 }) : t.scrollIntoView(); }
    });
  });

  // in-page anchor links → Lenis
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.pathname === location.pathname && url.hash) {
      const t = url.hash === '#top' ? document.body : document.querySelector(url.hash);
      if (t) {
        e.preventDefault();
        root.classList.remove('menu-open');
        if (lenis) lenis.scrollTo(t as HTMLElement, { offset: url.hash === '#top' ? 0 : -40, duration: 1.4 });
        else (t as HTMLElement).scrollIntoView();
        history.replaceState(null, '', url.hash === '#top' ? url.pathname : url.hash);
      }
    }
  });
}

boot();
