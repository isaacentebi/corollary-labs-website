// Binds the light to the page: each [data-light] section names a state; scroll position picks the state
// and its local progress; neighbouring states are blended across each boundary so the light never cuts.
import { LightField } from './engine';
import { states, fieldHorizon, type Env } from './states';
import { layoutField } from './diffusion';
import { pack, mixInto, LENGTH, smooth, clamp, KEYS, SIZES } from './params';

const KEY_P: Record<string, number> = { io: 0.8, auto: 1, combine: 1, deform: 0.62, diffuse: 1, dawn: 1, moment: 0.36 };
const STORE = 'cl-light';

export function mountScene() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-field]');
  if (!canvas) return null;
  const reducedQ = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reducedQ.matches;
  const field = new LightField(canvas);
  if (!field.ok) { document.documentElement.classList.add('no-gl'); return null; }
  document.documentElement.classList.add('has-gl');

  const sections = [...document.querySelectorAll<HTMLElement>('[data-light]')];
  let tops: number[] = [], bottoms: number[] = [];
  const env: Env = { a: 1.6, m: false, ox: 0, nodeSeed: [0, -0.2, 0.02] };
  const A = new Float32Array(LENGTH), B = new Float32Array(LENGTH), OUT = new Float32Array(LENGTH);
  let lastIndex = -1;

  function measure() {
    const y = window.scrollY;
    tops = sections.map((s) => s.getBoundingClientRect().top + y);
    bottoms = sections.map((s) => s.getBoundingClientRect().bottom + y);
  }

  function computeEnv() {
    field.resize();
    const w = canvas!.clientWidth, h = canvas!.clientHeight;
    env.a = w / Math.max(1, h);
    env.m = w < 760;
    const shift = canvas!.dataset.shift;
    env.ox = env.m ? 0 : shift === 'right' ? env.a * 0.5 * 0.42 : 0;
    const fl = layoutField(env.a, fieldHorizon(env), 0);
    field.setNodes(fl.nodes);
    env.nodeSeed = [fl.seed[0], fl.seed[1], fl.seed[2]];
  }

  // Between two scenes whose volumes are different objects (a lens and a band, say), the volume does
  // not morph from one into the other: it fades out, changes shape while invisible, and fades in.
  // Within a scene the shape still deforms continuously.
  const offs: Record<string, [number, number]> = {};
  { let o = 0; KEYS.forEach((k, i) => { offs[k] = [o, SIZES[i]]; o += SIZES[i]; }); }
  const SHAPE = ['volC', 'volR', 'volN', 'lensMag', 'warp', 'warpPhase', 'bend', 'cutAngle', 'cutOffset', 'cutAmt'];
  const VIS = ['lens', 'paint', 'emitCore', 'emitRim', 'halo', 'rimAmt', 'lit', 'beamIn', 'beamOut', 'seam', 'volBody'];
  function blend(out: Float32Array, a: Float32Array, b: Float32Array, t: number) {
    mixInto(out, a, b, t);
    const [ro, rn] = offs.volR, [co] = offs.volC;
    const dR = Math.abs(a[ro] - b[ro]) + Math.abs(a[ro + 1] - b[ro + 1]);
    const dC = Math.abs(a[co] - b[co]) + Math.abs(a[co + 1] - b[co + 1]);
    if (dR + dC < 0.08) return out;
    const src = t < 0.5 ? a : b;
    for (const k of SHAPE) { const o = offs[k]; if (!o) continue; for (let j = 0; j < o[1]; j++) out[o[0] + j] = src[o[0] + j]; }
    const fade = Math.abs(2 * t - 1);
    for (const k of VIS) { const o = offs[k]; if (!o) continue; out[o[0]] = src[o[0]] * fade; }
    void rn;
    return out;
  }

  const stateAt = (i: number, p: number, out: Float32Array) => {
    const name = sections[i].dataset.light!;
    const fn = states[name] ?? states.hero;
    const pp = reduced ? (sections[i].dataset.key ? +sections[i].dataset.key! : KEY_P[name] ?? 0.5) : p;
    return pack(fn(pp, env), out);
  };

  function update() {
    if (!sections.length) return;
    const vh = window.innerHeight;
    const focus = window.scrollY + vh * 0.5;
    let i = sections.length - 1;
    for (let k = 0; k < sections.length; k++) if (focus < bottoms[k]) { i = k; break; }
    const span = Math.max(1, bottoms[i] - tops[i]);
    const p = clamp((focus - tops[i]) / span);
    const Z = reduced ? 1 : Math.min(vh * 0.22, span * 0.4);
    stateAt(i, p, A);
    let result = A;
    if (i > 0 && focus - tops[i] < Z) {
      const pb = clamp((focus - tops[i - 1]) / Math.max(1, bottoms[i - 1] - tops[i - 1]));
      stateAt(i - 1, pb, B);
      result = blend(OUT, B, A, smooth(-Z, Z, focus - tops[i]));
    } else if (i < sections.length - 1 && bottoms[i] - focus < Z) {
      const pn = clamp((focus - tops[i + 1]) / Math.max(1, bottoms[i + 1] - tops[i + 1]));
      stateAt(i + 1, pn, B);
      result = blend(OUT, A, B, smooth(-Z, Z, focus - bottoms[i]));
    }
    // reduced motion: each section shows one still state, and the light snaps between them at the
    // boundary (never fading through the page colour)
    field.setTarget(result);
    if (reduced) field.snap();
    lastIndex = i;
    document.documentElement.dataset.section = sections[i].dataset.light;
  }

  // pointer: only the thin-film sheen follows the viewer
  window.addEventListener('pointermove', (ev) => {
    if (reduced || ev.pointerType !== 'mouse') return;
    const h = window.innerHeight;
    field.setPointer((ev.clientX - window.innerWidth / 2) / h, -(ev.clientY - h / 2) / h);
  }, { passive: true });

  computeEnv();
  measure();
  update();

  // continuity across pages: start from where the previous page left the light
  let prev: Float32Array | null = null;
  try {
    const s = sessionStorage.getItem(STORE);
    if (s) { const arr = JSON.parse(s); if (Array.isArray(arr) && arr.length === LENGTH) prev = new Float32Array(arr); }
  } catch {}
  const intro = canvas.dataset.intro === 'on' && !document.documentElement.classList.contains('returning');
  if (reduced) {
    field.snap();
  } else if (intro && window.scrollY < 10) {
    // the room first, then its light comes on
    field.tween(pack(states.dark(0, env)), 3.2);
  } else if (prev) {
    field.tween(prev, 1.1);
  } else {
    field.snap();
  }
  canvas.classList.add('is-on');

  window.addEventListener('pagehide', () => {
    try { sessionStorage.setItem(STORE, JSON.stringify(Array.from(field.tgt))); } catch {}
  });

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  }, { passive: true });
  const onResize = () => { computeEnv(); measure(); update(); if (reduced) field.snap(); };
  window.addEventListener('resize', onResize);
  new ResizeObserver(() => { measure(); update(); }).observe(document.body);
  reducedQ.addEventListener('change', () => { reduced = reducedQ.matches; update(); field.snap(); });
  return field;
}
