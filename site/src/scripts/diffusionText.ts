// Velocity diffusion for long-form text — Ref B's model, our glyphs, our reading guarantee.
//   energy: 0.7·|v|/1800 + 0.55·max(|a|/14000, wheel/140), attack 50/s, release 3/s   (Ref B Hr())
//   replacement probability: energy · rim(y) · density 0.5, noise-gated, phase = floor(scrollY/24) (Ref B Ur())
//   glyphs: the word's own letters shuffled (Ref A lg), '·' at high energy (ours)
//   rim: the leading 22% of the viewport in the scroll direction only — the reading band never changes.
// Words are wrapped lazily (warm overscan 1 viewport, Ref B), widths are locked, positions cached, so the
// per-frame loop never reads layout.
import { gsap, onDispose, reduced, scrollState } from './core';

type Word = { el: HTMLElement; orig: string; cur: string; y: number; h: number; idx: number; forced: boolean };
type Block = { el: HTMLElement; words: Word[]; mat: boolean; top: number; bottom: number; seen: boolean };

const RIM = 0.22, DENSITY = 0.5, VEL_REF = 1800, ACC_REF = 14000, ATTACK = 50, RELEASE = 3;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const noise = (x: number, y: number) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };

function scrambleWord(w: string, idx: number, phase: number, amount: number) {
  const letters = [...w];
  const alpha = letters.map((c, i) => (/\p{L}|\d/u.test(c) ? i : -1)).filter((i) => i >= 0);
  if (alpha.length < 2 && amount < 0.6) return w;
  const vals = alpha.map((i) => letters[i]);
  for (let i = vals.length - 1; i > 0; i--) { const j = Math.floor(noise(idx * 13 + i, phase * 0.37) * (i + 1)); [vals[i], vals[j]] = [vals[j], vals[i]]; }
  alpha.forEach((pos, k) => { letters[pos] = amount > 0.6 && noise(idx + k, phase) < (amount - 0.6) ? '·' : vals[k]; });
  return letters.join('');
}

export function initDiffusionText(body: HTMLElement) {
  if (reduced()) return { energy: () => 0 };
  const els = [...body.querySelectorAll<HTMLElement>(':scope > p, :scope > ul > li, :scope > ol > li, :scope > h3')];
  let wid = 0;
  const blocks: Block[] = els.map((el) => ({ el, words: [], mat: false, top: 0, bottom: 0, seen: false }));
  const replaced = new Set<Word>();

  const measure = (b: Block) => {
    const sy = scrollY;
    b.words.forEach((w) => (w.el.style.width = ''));
    const rects = b.words.map((w) => w.el.getBoundingClientRect());
    b.words.forEach((w, i) => { w.el.style.width = `${rects[i].width}px`; w.y = rects[i].top + sy; w.h = rects[i].height; });
    const r = b.el.getBoundingClientRect(); b.top = r.top + sy; b.bottom = r.bottom + sy;
  };

  const materialize = (b: Block) => {
    if (b.mat) return; b.mat = true;
    const tw = document.createTreeWalker(b.el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => ((n.parentElement?.closest('.note-ref, .term, .term__def, code, .dw')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes: Text[] = []; while (tw.nextNode()) nodes.push(tw.currentNode as Text);
    for (const n of nodes) {
      const parts = (n.nodeValue || '').split(/(\s+)/);
      const frag = document.createDocumentFragment();
      for (const p of parts) {
        if (!p) continue;
        if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); continue; }
        const s = document.createElement('span'); s.className = 'dw'; s.textContent = p;
        frag.appendChild(s);
        b.words.push({ el: s, orig: p, cur: p, y: 0, h: 0, idx: wid++, forced: false });
      }
      n.parentNode!.replaceChild(frag, n);
    }
    measure(b);
  };

  // warm overscan: materialise one viewport ahead (Ref B warmOverscanRatio 1)
  const warm = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) materialize(blocks[els.indexOf(e.target as HTMLElement)]); }), { rootMargin: '100% 0px 100% 0px' });
  // entering reveal: words resolve in order as the block crosses the bottom rim
  const enter = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    const b = blocks[els.indexOf(e.target as HTMLElement)];
    if (b.seen) return; b.seen = true; enter.unobserve(b.el);
    materialize(b);
    const n = b.words.length, step = Math.min(0.012, 0.55 / Math.max(1, n));
    b.words.forEach((w) => { w.forced = true; replaced.add(w); });
    b.words.forEach((w, i) => gsap.delayedCall(i * step + 0.05, () => { w.forced = false; }));
    wake();
  }), { rootMargin: '0px 0px -4% 0px' });
  els.forEach((el) => { warm.observe(el); enter.observe(el); });

  const ro = new ResizeObserver(() => { clearTimeout(rt); rt = window.setTimeout(() => blocks.forEach((b) => b.mat && measure(b)), 120); });
  let rt = 0; ro.observe(body);

  // energy integrator (Ref B)
  let lastT = performance.now(), lastY = scrollState.y, m = 0, h = 0, c = 0, wb = 0;
  const onWheel = (e: WheelEvent) => { wb = Math.max(wb, clamp(Math.abs(e.deltaY) / 140)); wake(); };
  addEventListener('wheel', onWheel, { passive: true });
  const onTouch = () => wake();
  addEventListener('touchmove', onTouch, { passive: true });

  let running = false;
  const fadeTargets = [...body.querySelectorAll<HTMLElement>('.sidenote, .fig')];
  const tick = () => {
    const now = performance.now();
    const dt = Math.max(1 / 240, (now - lastT) / 1000); lastT = now;
    const y = scrollState.y, q = (y - lastY) / dt, V = (q - m) / dt; lastY = y;
    h += (V - h) * (1 - Math.exp(-dt * 10)); m += (q - m) * (1 - Math.exp(-dt * 16)); wb *= Math.exp(-dt * 7);
    const O = clamp(clamp(Math.abs(m) / VEL_REF) * 0.7 + clamp(Math.max(Math.abs(h) / ACC_REF, wb)) * 0.55);
    c += (O - c) * (O > c ? 1 - Math.exp(-dt * ATTACK) : 1 - Math.exp(-dt * RELEASE));
    if (c < 0.001) c = 0;

    const vh = innerHeight, rim = vh * RIM, dir = scrollState.dir >= 0 ? 1 : -1, phase = Math.floor(y / 24);
    for (const b of blocks) {
      if (!b.mat || b.bottom < y - 50 || b.top > y + vh + 50) continue;
      for (const w of b.words) {
        const vy = w.y - y;
        let next = w.orig;
        if (w.forced) next = scrambleWord(w.orig, w.idx, phase + ((now / 60) | 0), 0.4);
        else if (c > 0 && vy + w.h > 0 && vy < vh) {
          const rimAmt = dir > 0 ? clamp((vy + w.h - (vh - rim)) / rim) : clamp((rim - vy) / rim);
          const a = c * rimAmt;
          if (a > 0.001 && noise(w.idx * 0.37, phase * 0.082) <= clamp(a * DENSITY * 1.6)) next = scrambleWord(w.orig, w.idx, phase, a);
        }
        if (next !== w.cur) { w.el.textContent = next; w.cur = next; next === w.orig ? replaced.delete(w) : replaced.add(w); }
      }
    }
    // Ref B fadeOnly: notes/figures dim with energy (1 − 0.72·e), ours softer
    const fade = (1 - 0.45 * c).toFixed(3);
    fadeTargets.forEach((t) => t.style.setProperty('--diff-fade', fade));
    if (c === 0 && replaced.size === 0 && Math.abs(m) < 8 && wb < 0.02) { running = false; gsap.ticker.remove(tick); }
  };
  const wake = () => { if (!running) { running = true; lastT = performance.now(); lastY = scrollState.y; gsap.ticker.add(tick); } };
  const onScrollWake = () => wake();
  addEventListener('scroll', onScrollWake, { passive: true });

  onDispose(() => {
    gsap.ticker.remove(tick); warm.disconnect(); enter.disconnect(); ro.disconnect();
    removeEventListener('wheel', onWheel); removeEventListener('touchmove', onTouch); removeEventListener('scroll', onScrollWake);
    replaced.forEach((w) => (w.el.textContent = w.orig));
  });
  return { energy: () => c };
}
