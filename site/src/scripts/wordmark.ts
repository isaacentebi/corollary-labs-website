// Wordmark choreography: dots adopt left→right (stagger 0.04, Ref A char stagger), the front dot flashes
// signal, the word shuffles (Ref A in-word shuffle). Replays on hover/focus.
import { gsap, reduced, STAGGER } from './core';
import { shuffle } from './text';

const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function playWordmark(scope: Element, adoptedCount = 5) {
  if (reduced()) return;
  const dots = [...scope.querySelectorAll<SVGCircleElement>('.wordmark__glyph circle')];
  const ink = css('--ink'), ink3 = css('--ink-3'), signal = css('--signal');
  dots.forEach((d) => { d.setAttribute('fill', 'none'); d.setAttribute('stroke', ink3); });
  dots.forEach((d, i) => {
    const adopted = i < adoptedCount;
    gsap.delayedCall(i * STAGGER.dot, () => {
      d.setAttribute('fill', signal); d.setAttribute('stroke', 'none');
      gsap.delayedCall(0.12, () => {
        if (adopted) d.setAttribute('fill', ink);
        else { d.setAttribute('fill', 'none'); d.setAttribute('stroke', ink3); }
      });
    });
  });
  // the next dot beyond the adopted set stays on the front
  gsap.delayedCall(dots.length * STAGGER.dot + 0.15, () => { const f = dots[adoptedCount]; if (f) { f.setAttribute('fill', signal); f.setAttribute('stroke', 'none'); gsap.delayedCall(0.6, () => { f.setAttribute('fill', 'none'); f.setAttribute('stroke', ink3); }); } });
  const word = scope.querySelector('.wordmark__word');
  if (word) shuffle(word, { steps: 4, duration: 0.25 });
}

export function initWordmarks() {
  document.querySelectorAll<HTMLElement>('[data-wordmark]').forEach((w) => {
    if ((w as any).__wm) return; (w as any).__wm = true;
    const run = () => playWordmark(w);
    w.addEventListener('mouseenter', run);
    w.addEventListener('focus', run);
  });
  const header = document.querySelector('.c-header [data-wordmark]');
  if (header && document.documentElement.classList.contains('intro-seen')) playWordmark(header);
}
