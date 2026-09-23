// Text motion vocabulary (DESIGN.md §4c).
//   scrambleIn   — Ref A preloader char routine: show char at i·stagger, 5 random swaps × 16 ms, settle.
//   shuffle      — Ref A in-word shuffle (ld/lg): letters permuted inside each word, restored after.
//   revealLines  — masked line rise (SplitText lines + mask), power4.out, stagger 0.08.
//   scrambleText — label resolve (ScrambleText), 0.25 s + 0.02 s/char.
import { gsap, SplitText, ScrollTrigger, G, DUR, STAGGER, SCRAMBLE, reduced, onDispose } from './core';

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = LOWER.toUpperCase();
const DIGIT = '0123456789';
const MARKS = '·+×/\\=<>';
const pool = (ch: string) => (/[a-z]/.test(ch) ? LOWER + '·' : /[A-Z]/.test(ch) ? UPPER : /\d/.test(ch) ? DIGIT : MARKS);
export const randomGlyph = (ch: string) => { const p = pool(ch); return p[(Math.random() * p.length) | 0]; };

// ── in-word shuffle (Ref A) ───────────────────────────────────────────
const shuffleWord = (w: string) => {
  const a = [...w];
  if (a.length < 2) return w;
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a.join('');
};
const textNodes = (el: Element) => {
  const out: Text[] = [];
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  while (tw.nextNode()) out.push(tw.currentNode as Text);
  return out;
};
const ORIG = new WeakMap<Text, string>();
const RUNNING = new WeakMap<Element, gsap.core.Timeline>();

/** Shuffle letters within words for `steps` steps spread over `duration`, then restore. */
export function shuffle(el: Element, { steps = 4, duration = DUR.d250 } = {}) {
  if (reduced()) return;
  RUNNING.get(el)?.progress(1).kill();
  const nodes = textNodes(el);
  nodes.forEach((n) => { if (!ORIG.has(n)) ORIG.set(n, n.nodeValue!); });
  (el as HTMLElement).style.fontKerning = 'none';
  const tl = gsap.timeline({
    onComplete: () => { nodes.forEach((n) => (n.nodeValue = ORIG.get(n)!)); (el as HTMLElement).style.fontKerning = ''; RUNNING.delete(el); },
    onInterrupt: () => nodes.forEach((n) => (n.nodeValue = ORIG.get(n)!)),
  });
  for (let s = 0; s < steps; s++) {
    tl.call(() => nodes.forEach((n) => { n.nodeValue = ORIG.get(n)!.split(/(\s+)/).map((w) => (/\s/.test(w) ? w : shuffleWord(w))).join(''); }), [], (duration / steps) * s);
  }
  tl.call(() => {}, [], duration);
  RUNNING.set(el, tl);
  return tl;
}

/** Bind hover/focus shuffle to [data-shuffle-hover] (target = [data-shuffle-target] inside, or self). */
export function bindHoverShuffle(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-shuffle-hover]').forEach((el) => {
    if ((el as any).__shuf) return;
    (el as any).__shuf = true;
    const target = el.querySelector('[data-shuffle-target]') || el;
    const run = () => shuffle(target, { steps: 4, duration: DUR.d250 });
    el.addEventListener('mouseenter', run);
    el.addEventListener('focus', run);
  });
}

// ── scramble-in per char (Ref A preloader / Lisa) ────────────────────
export function scrambleIn(el: HTMLElement, { stagger = STAGGER.char2, delay = 0, lineGap = 0.25 } = {}) {
  el.classList.add('is-revealed');
  if (reduced()) return null;
  const split = SplitText.create(el, { type: 'lines,words,chars', linesClass: 'split-line', aria: 'auto' });
  const tl = gsap.timeline({ delay, onComplete: () => split.revert() });
  let t = 0;
  split.lines.forEach((line, li) => {
    const chars = split.chars.filter((c) => line.contains(c));
    chars.forEach((c, i) => {
      const at = li * lineGap * 0.4 + i * stagger;
      const orig = c.textContent || '';
      tl.set(c, { opacity: 0 }, 0);
      tl.set(c, { opacity: 1 }, at);
      tl.call(() => {
        for (let k = 0; k < SCRAMBLE.swaps; k++) setTimeout(() => (c.textContent = randomGlyph(orig)), k * SCRAMBLE.step);
        setTimeout(() => (c.textContent = orig), SCRAMBLE.swaps * SCRAMBLE.step);
      }, [], at);
      t = Math.max(t, at);
    });
  });
  tl.call(() => {}, [], t + (SCRAMBLE.swaps * SCRAMBLE.step) / 1000 + 0.02);
  return tl;
}

// ── masked line rise ─────────────────────────────────────────────────
export function revealLines(el: HTMLElement, { delay = 0, stagger = STAGGER.line, duration = DUR.d900 } = {}) {
  el.classList.add('is-revealed');
  if (reduced()) return null;
  const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line', aria: 'auto' });
  return gsap.from(split.lines, {
    yPercent: 105, duration, ease: G.power4, stagger, delay,
    onComplete: () => split.revert(),
  });
}

// ── label scramble (ScrambleText) ─────────────────────────────────────
export function scrambleText(el: HTMLElement, { delay = 0 } = {}) {
  el.classList.add('is-revealed');
  if (reduced()) return null;
  const text = el.textContent || '';
  return gsap.fromTo(el, { scrambleText: { text: ' ', chars: 'lowerCase' } }, {
    scrambleText: { text, chars: 'lowerCase', revealDelay: 0.05, speed: 1 },
    duration: DUR.d250 + text.length * STAGGER.char2, delay, ease: 'none',
  });
}

// ── generic reveal registry ([data-reveal]) ──────────────────────────
type Kind = 'chars' | 'lines' | 'scramble' | 'fade' | 'rule' | 'rows' | 'rise';
export function initReveals(root: ParentNode = document) {
  const els = root.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-revealed)');
  els.forEach((el) => {
    const kind = (el.dataset.reveal || 'lines') as Kind;
    const delay = parseFloat(el.dataset.delay || '0');
    if (el.hasAttribute('data-reveal-manual')) return; // driven by a section script
    if (reduced()) { el.classList.add('is-revealed'); return; }
    const run = () => play(el, kind, delay);
    const st = ScrollTrigger.create({ trigger: el, start: el.dataset.start || 'top 90%', once: true, onEnter: run });
    onDispose(() => st.kill());
  });
}

export function play(el: HTMLElement, kind: Kind, delay = 0) {
  switch (kind) {
    case 'chars': return scrambleIn(el, { delay });
    case 'lines': return revealLines(el, { delay });
    case 'scramble': return scrambleText(el, { delay });
    case 'fade':
      el.classList.add('is-revealed');
      return gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: DUR.d600, ease: G.out, delay });
    case 'rise':
      el.classList.add('is-revealed');
      return gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: DUR.d900, ease: G.power4, delay, clearProps: 'transform' });
    case 'rule':
      el.classList.add('is-revealed');
      return gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: DUR.d900, ease: G.out, delay, transformOrigin: '0 50%' });
    case 'rows': {
      el.classList.add('is-revealed');
      const kids = [...el.children] as HTMLElement[];
      return gsap.fromTo(kids, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: DUR.d600, ease: G.out, stagger: STAGGER.row, delay, clearProps: 'transform' });
    }
  }
}
