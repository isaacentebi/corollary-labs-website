// Home page: the title-plate field and the Approach figure (four steps: the organisation, an agent enters,
// it reorganises, the change spreads). Everything renders on demand: tweens run only while something moves.
import { initField } from './field';
import { Diagram, type Palette } from './diagram';
import { fig3 } from './figs';
import { makeEconomy } from './economy';

const RM = document.documentElement.classList.contains('rm');
const css = getComputedStyle(document.documentElement);
const v = (n: string) => css.getPropertyValue(n).trim();
const PAPER: Palette = { ink: v('--ink'), paper: v('--paper-3'), blue: v('--blue') };

// ── hero plate: wires bend around the nav and the text block ──
const hero = document.querySelector<HTMLCanvasElement>('[data-field]');
if (hero) {
  const q = (s: string) => document.querySelector<HTMLElement>(s);
  const obstacles = [
    { el: q('[data-nav]'), dir: 'down' as const },
    { el: q('.plate0__text'), dir: 'up' as const },
  ].filter((o): o is { el: HTMLElement; dir: 'up' | 'down' } => !!o.el);
  initField(hero, { reduced: RM, obstacles });
}

// ── Approach figure ──
const ap = document.querySelector<HTMLElement>('[data-ap]');
if (ap) {
  const dgSvg = ap.querySelector<SVGSVGElement>('svg[data-dg]')!;
  const ecoSvg = ap.querySelector<SVGSVGElement>('svg[data-eco]')!;
  const buttons = [...ap.querySelectorAll<HTMLButtonElement>('[data-beat]')];
  const D = new Diagram(dgSvg, fig3, PAPER);
  const mobile = window.innerWidth < 700;
  const E = makeEconomy(ecoSvg, mobile ? { cols: 6, rows: 5, W: 1000, H: 600 } : { cols: 8, rows: 6, W: 1000, H: 560 });
  ecoSvg.setAttribute('viewBox', mobile ? '0 0 1000 600' : '0 0 1000 560');

  // fig3 states: 0 people only, 1 one process done by an agent, 2 the deformation, 3 reorganised
  const S = [0, 1, 3];
  let s = 0, t = 0, beat = 0, raf = 0;
  let anim: { from: number; to: number; key: 's' | 't'; t0: number; dur: number } | null = null;

  const fitLabels = () => {
    const vb = dgSvg.viewBox.baseVal, r = dgSvg.getBoundingClientRect();
    if (vb && r.width) dgSvg.style.setProperty('--s', String(Math.min(r.width / vb.width, r.height / vb.height)));
  };
  const paint = () => { D.render(s); E.render(t); };

  const step = (now: number) => {
    raf = 0;
    if (!anim) return;
    const u = Math.max(0, Math.min(1, (now - anim.t0) / anim.dur));
    const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
    const val = anim.from + (anim.to - anim.from) * (anim.key === 't' ? u : e);
    if (anim.key === 's') s = val; else t = val;
    paint();
    if (u < 1) raf = requestAnimationFrame(step); else anim = null;
  };

  function go(i: number) {
    beat = i;
    ap!.dataset.beat = String(i);
    buttons.forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false'));
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (i < 3) {
      t = 0;
      const to = S[i];
      if (RM) { s = to; anim = null; paint(); return; }
      anim = { from: s, to, key: 's', t0: performance.now(), dur: 900 + 500 * Math.abs(to - s) };
    } else {
      s = 3;
      if (RM) { t = 1; anim = null; paint(); return; }
      anim = { from: 0, to: 1, key: 't', t0: performance.now() + 350, dur: 4200 };
      t = 0;
    }
    paint();
    raf = requestAnimationFrame(step);
  }

  // autoplay once, the first time the figure is in view; any click takes over
  let auto: number[] = [];
  const stopAuto = () => { auto.forEach(clearTimeout); auto = []; };
  buttons.forEach((b, k) => b.addEventListener('click', () => { stopAuto(); go(k); }));
  if (!RM) {
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      [1, 2, 3].forEach((k, j) => auto.push(window.setTimeout(() => go(k), 1600 + j * 3200)));
    }, { threshold: 0.55 });
    io.observe(ap.querySelector('.ap__box')!);
  }

  fitLabels();
  paint();
  window.addEventListener('resize', () => { fitLabels(); paint(); });
  document.fonts?.ready.then(() => { fitLabels(); paint(); });
  (window as any).__proofBeat = (i: number) => { stopAuto(); go(i); };
  (window as any).__proofState = () => ({ beat, s, t });
}
