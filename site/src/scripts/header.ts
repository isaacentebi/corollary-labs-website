// Ref A header behaviour: hide on scroll down / show on scroll up (0.2 s easeOutCubic via CSS),
// transparent over the hero, live "adoption" readout, mobile menu with shuffle on open.
import { onScroll, onDispose, scrollState, lenis } from './core';
import { shuffle } from './text';

const logistic = (x: number) => 1 / (1 + Math.exp(-(x - 0.55) * 9));
export const adoptionAt = (p: number) => Math.max(0, Math.min(1, (logistic(p) - logistic(0)) / (logistic(1) - logistic(0))));

export function initHeader() {
  const root = document.documentElement;
  const readout = document.querySelector<HTMLElement>('[data-readout-value]');
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  let lastY = scrollState.y;
  const update = () => {
    const y = scrollState.y;
    const dy = y - lastY;
    if (Math.abs(dy) > 2) {
      root.classList.toggle('is-scrolling-down', dy > 0 && y > 80);
      root.classList.toggle('is-scrolling-up', dy < 0);
      lastY = y;
    }
    root.classList.toggle('is-top', y < 10);
    root.classList.toggle('is-over-hero', !!hero && y < (hero.offsetHeight - 64));
    if (readout) readout.textContent = (adoptionAt(scrollState.progress) * 100).toFixed(1).padStart(4, '0');
  };
  update();
  onDispose(onScroll(update));

  // mobile menu
  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  const label = document.querySelector<HTMLElement>('[data-menu-label]');
  if (toggle && menu && label) {
    const set = (open: boolean) => {
      root.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-hidden', String(!open));
      label.textContent = open ? 'Close' : 'Menu';
      shuffle(label);
      if (open) { lenis?.stop(); menu.querySelectorAll('a').forEach((a, i) => setTimeout(() => shuffle(a, { steps: 4 }), i * 40)); }
      else lenis?.start();
    };
    const onClick = () => set(!root.classList.contains('menu-open'));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && root.classList.contains('menu-open')) set(false); };
    toggle.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => set(false)));
    onDispose(() => { document.removeEventListener('keydown', onKey); root.classList.remove('menu-open'); lenis?.start(); });
  }
}
