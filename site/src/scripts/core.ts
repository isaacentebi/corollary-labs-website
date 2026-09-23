// Motion core: Lenis smooth scroll + GSAP/ScrollTrigger on one ticker, shared tokens, page-scoped cleanup.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

// ── extracted motion tokens (DESIGN.md §4) ──────────────────────────────
export const EASE = {
  out: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
  expo: 'cubic-bezier(0.23, 1, 0.32, 1)',
  inOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
};
// GSAP equivalents of the CSS curves
export const G = {
  out: 'power3.out', // ≈ easeOutCubic (0.215,0.61,0.355,1)
  expo: 'expo.out', // ≈ easeOutQuint (0.23,1,0.32,1)
  inOut: 'power4.inOut', // ≈ (0.77,0,0.175,1)
  power4: 'power4.out',
};
export const DUR = { d100: 0.1, d150: 0.15, d180: 0.18, d200: 0.2, d250: 0.25, d280: 0.28, d300: 0.3, d450: 0.45, d600: 0.6, d900: 0.9 };
export const STAGGER = { char: 0.01, char2: 0.02, char3: 0.025, dot: 0.04, glyph: 0.05, line: 0.08, row: 0.1 };
// Ref A preloader: 5 glyph swaps × 16 ms per char
export const SCRAMBLE = { swaps: 5, step: 16 };

export const reduced = () => document.documentElement.classList.contains('rm');

gsap.defaults({ ease: G.out, duration: DUR.d600 });
gsap.config({ force3D: true, nullTargetWarn: false });

// ── Lenis (Ref A: lerp 0.1, default exponential easing) ────────────────
export let lenis: Lenis | null = null;
export const scrollState = { y: 0, v: 0, dir: 0, limit: 1, progress: 0 };
const scrollListeners = new Set<(s: typeof scrollState) => void>();
export const onScroll = (fn: (s: typeof scrollState) => void) => { scrollListeners.add(fn); return () => scrollListeners.delete(fn); };

export function initScroll() {
  if (lenis) return lenis;
  if (!reduced()) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, touchMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', (l: Lenis) => {
      scrollState.y = l.scroll; scrollState.v = l.velocity; scrollState.dir = l.direction; scrollState.limit = l.limit || 1;
      scrollState.progress = l.progress || 0;
      ScrollTrigger.update();
      scrollListeners.forEach((f) => f(scrollState));
    });
    gsap.ticker.add((t) => lenis!.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const upd = () => {
      const lim = document.documentElement.scrollHeight - innerHeight;
      scrollState.y = scrollY; scrollState.limit = Math.max(1, lim); scrollState.progress = scrollY / Math.max(1, lim); scrollState.v = 0;
      scrollListeners.forEach((f) => f(scrollState));
    };
    addEventListener('scroll', upd, { passive: true });
    upd();
  }
  return lenis;
}

// ── page-scoped disposers (cleared on every client-side navigation) ────
const disposers: Array<() => void> = [];
export const onDispose = (fn: () => void) => disposers.push(fn);
export function disposePage() {
  while (disposers.length) { try { disposers.pop()!(); } catch (e) { console.warn(e); } }
  ScrollTrigger.getAll().forEach((t) => t.kill());
  gsap.globalTimeline.getChildren(false, true, true).forEach((t) => { if (!(t as any).data?.persist) t.kill(); });
}

export { gsap, ScrollTrigger, SplitText };
