// The sheet: routing between regions as a continuous deformation, and the state fed to the renderer.
// The renderer draws only when something changes (scroll, pointer, a transition, a click ring) and stops once settled.
import { createRenderer, type Frame, type BandFrame } from './gl';

const root = document.documentElement;
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
const canvas = document.querySelector<HTMLCanvasElement>('canvas.gl')!;
const folds = [...document.querySelectorAll<HTMLAnchorElement>('.fold')];
const leaf = document.querySelector<HTMLElement>('main.leaf')!;
let active = +(leaf.dataset.k ?? 0);

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const isPhone = () => window.matchMedia('(max-width: 900px)').matches;

// ---------------------------------------------------------------- motion preference (system, or the Motion switch)
const sysReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const readPref = () => { try { return localStorage.getItem('cl-motion'); } catch { return null; } };
let still = readPref() === 'off' || (readPref() !== 'on' && sysReduce.matches);
const motionBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-motion]')];
function applyMotion() {
  root.classList.toggle('still', still);
  for (const b of motionBtns) { b.setAttribute('aria-pressed', String(!still)); b.querySelector('b')!.textContent = still ? 'off' : 'on'; }
  kick();
}
document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('[data-motion]')) return;
  still = !still;
  try { localStorage.setItem('cl-motion', still ? 'off' : 'on'); } catch { /* private mode */ }
  applyMotion();
  maskKey = ''; buildMask();
});

// ---------------------------------------------------------------- renderer
const R = createRenderer(canvas);
if (R) root.classList.add('gl-on');

// ---------------------------------------------------------------- band + latent title
let band: HTMLElement | null = null;
let story: HTMLElement | null = null;
let storyBand: HTMLElement | null = null;
let maskKey = '';
const maskCanvas = document.createElement('canvas');

function stretchKeyword(pct: number) {
  const k: [number, string][] = [[50, 'ultra-condensed'], [62.5, 'extra-condensed'], [75, 'condensed'], [87.5, 'semi-condensed'], [100, 'normal'], [112.5, 'semi-expanded'], [125, 'expanded'], [150, 'extra-expanded'], [200, 'ultra-expanded']];
  return k.reduce((best, c) => (Math.abs(c[0] - pct) < Math.abs(best[0] - pct) ? c : best))[1];
}

function findBands() {
  // [0] the band that carries the title (or the page's first band), [1] the approach figure
  const title = leaf.querySelector<HTMLElement>('[data-latent]');
  band = title?.closest<HTMLElement>('[data-band]') || leaf.querySelector<HTMLElement>('[data-band]:not([data-state="story"])');
  story = leaf.querySelector<HTMLElement>('[data-story]');
  storyBand = story?.querySelector<HTMLElement>('[data-band]') || null;
}

function buildMask() {
  const title = band?.querySelector<HTMLElement>('[data-latent]');
  if (!band || !title || !R) { R?.setMask(null); maskKey = ''; kick(); return; }
  // draw nothing until the display face is in: the title must never be set in a fallback font
  if (document.fonts && !document.fonts.check(`800 40px "Anybody Variable"`)) { R.setMask(null); maskKey = ''; return; }
  const br = band.getBoundingClientRect();
  const w = band.offsetWidth, h = band.offsetHeight;
  const scale = Math.min(2, window.devicePixelRatio || 1);
  const lr = title.getBoundingClientRect();
  const key = `${leaf.dataset.page}|${w}|${h}|${scale}|${getComputedStyle(title).fontSize}|${Math.round(lr.left - br.left)}|${Math.round(lr.top - br.top)}|${Math.round(lr.width)}`;
  if (key === maskKey) return;
  maskKey = key;
  maskCanvas.width = Math.max(1, Math.round(w * scale)); maskCanvas.height = Math.max(1, Math.round(h * scale));
  const ctx = maskCanvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  ctx.scale(scale, scale);
  const cs = getComputedStyle(title);
  ctx.font = `${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`;
  try { (ctx as any).fontStretch = stretchKeyword(parseFloat(cs.fontStretch) || 100); } catch { /* older engines */ }
  (ctx as any).letterSpacing = cs.letterSpacing !== 'normal' ? cs.letterSpacing : '0px';
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
  // one baseline rule for every line (the same font metrics), so words set side by side share a baseline
  const fm = ctx.measureText('Hg');
  const asc = fm.fontBoundingBoxAscent ?? fm.actualBoundingBoxAscent, desc = fm.fontBoundingBoxDescent ?? fm.actualBoundingBoxDescent;
  for (const line of title.querySelectorAll<HTMLElement>('.band__line')) {
    const r = line.getBoundingClientRect();
    ctx.fillText(line.textContent || '', r.left - br.left, r.top - br.top + (r.height - (asc + desc)) / 2 + asc);
  }
  R.setMask(maskCanvas);
  kick();
}

// ---------------------------------------------------------------- pointer
const cursor = { x: -9999, y: -9999, tx: -9999, ty: -9999, s: 0, ts: 0, last: 0 };
const ripples: { x: number; y: number; t: number }[] = [];
let hovered = -1;
window.addEventListener('pointermove', (e) => {
  if (still || e.pointerType !== 'mouse') return;
  cursor.tx = e.clientX; cursor.ty = e.clientY; cursor.last = performance.now();
  if (cursor.x < -9000) { cursor.x = e.clientX; cursor.y = e.clientY; }
  cursor.ts = 1; kick();
}, { passive: true });
document.addEventListener('pointerleave', () => { cursor.ts = 0; kick(); });
window.addEventListener('pointerdown', (e) => {
  if (still) return;
  const t = e.target as HTMLElement;
  if (t.closest('a, button, input, textarea') || !t.closest('[data-band]')) return;
  ripples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  if (ripples.length > 4) ripples.shift();
  kick();
});
folds.forEach((f, i) => {
  const on = () => { hovered = i; prefetch(f.href).catch(() => {}); kick(); };
  const off = () => { if (hovered === i) { hovered = -1; kick(); } };
  f.addEventListener('pointerenter', on); f.addEventListener('pointerleave', off);
  f.addEventListener('focus', on); f.addEventListener('blur', off);
});

// ---------------------------------------------------------------- page states
let storyP = 0;
let pickedBeat = 3;   // with motion off, the legend picks the beat shown (the whole story by default)
let storyMeter: HTMLElement | null = null;
const BEAT_AT = [0, 0.4, 0.66, 1];          // the state each beat settles on (motion off, and legend jumps)
const BEAT_SCROLL = [0.02, 0.36, 0.62, 1];  // where a legend jump scrolls to, as progress through the figure

const titleRO = new ResizeObserver(() => buildMask());
function pageInit() {
  titleRO.disconnect();
  findBands();
  storyMeter = leaf.querySelector('[data-story-meter]');
  maskKey = '';
  buildMask();
  const t = leaf.querySelector('[data-latent]'); if (t) titleRO.observe(t);
}

// progress through the pinned approach figure: 0 when its stage reaches the top, 1 when it is released
function storyProgress() {
  if (!story) return 0;
  if (still) return BEAT_AT[pickedBeat];
  const r = story.getBoundingClientRect();
  const stage = storyBand!;
  const run = r.height - stage.offsetHeight;
  return run > 0 ? clamp((stripH0() - r.top) / run) : 0;
}
const stripH0 = () => (isPhone() ? stripH : 0);
const beatOf = (p: number) => (p < 0.2 ? 0 : p < 0.5 ? 1 : p < 0.8 ? 2 : 3);

// the organisation: seven points in the figure's free area; the agent enters from the left and settles among them
const ORG = [[0.08, 0.2], [0.38, 0.1], [0.74, 0.22], [0.16, 0.72], [0.56, 0.56], [0.92, 0.66], [0.7, 0.92]];
const AGENT = [0.4, 0.4];

function bandState(el: HTMLElement, w: number, h: number): { agents: number[][]; front: number[] } {
  const state = el.dataset.state || 'rest';
  const phone = isPhone();
  const m = Math.min(w, h);
  let agents: number[][] = [];
  let front = [0, 0, 100];
  if (state === 'story') {
    // the figure's free area: right of the legend on wide screens, above it on phones
    const ax = phone ? [0.1 * w, 0.9 * w] : [0.4 * w, 0.95 * w];
    const ay = phone ? [0.1 * h, 0.58 * h] : [0.14 * h, 0.86 * h];
    const X = (f: number) => lerp(ax[0], ax[1], f), Y = (f: number) => lerp(ay[0], ay[1], f);
    const p = storyP;
    const enter = smooth(0.14, 0.4, p);          // 02 an agent enters
    const reorg = smooth(0.44, 0.66, p);         // 03 the points around it move
    const spread = smooth(0.7, 0.98, p);         // 04 a front crosses the sheet
    const relax = lerp(1, 0.3, smooth(0.8, 1, p));
    const gx = X(AGENT[0]), gy = Y(AGENT[1]);
    const sig = m * 0.075 + 22;
    agents = ORG.map(([fx, fy]) => {
      const x = X(fx), y = Y(fy);
      return [lerp(x, lerp(x, gx, 0.3), reorg), lerp(y, lerp(y, gy, 0.3), reorg), 0.005 + 1.5 * reorg * relax, sig * 0.8];
    });
    agents.push([lerp(-30, gx, easeOut(enter)), gy, enter > 0 ? 0.005 + 2.2 * smooth(0, 0.6, enter) * relax : 0, -sig]);
    front = [spread * Math.hypot(w, h) * 1.05, 3.5 * smooth(0.66, 0.74, p), phone ? 60 : 110];
  } else if (state === 'hero') {
    // one agent already at work in the open sheet above the name; the pointer bends the sheet around it
    agents = [[w * (phone ? 0.74 : 0.8), h * (phone ? 0.2 : 0.24), 2.2, -(m * (phone ? 0.1 : 0.09) + 20)]];
    front = [m * (phone ? 0.16 : 0.15), 3.5, phone ? 26 : 40];
  } else if (state === 'front') {
    agents = [[w * 0.72, -w * 0.9, 0, 1]];
    front = [w * 0.9 + h * 0.18, 3.5, phone ? 40 : 70];
  } else if (state === 'plate') {
    agents = [[-w * 0.15, h * 1.2, 0, 1]];
    front = [w * 0.5, 3.5, 110];
  } else if (state === 'agent') {
    agents = [[w * (phone ? 0.86 : 0.93), h * 0.2, 2.4, -(m * (phone ? 0.1 : 0.12) + 20)]];
    front = [m * (phone ? 0.18 : 0.22), 3.5, phone ? 30 : 50];
  } else if (state === 'four') {
    agents = [0, 1, 2, 3].map((i) => [w * (0.56 + i * 0.12), h * (0.26 + 0.07 * Math.sin(i * 2.1)), 2, m * 0.07 + 12]);
    front = [m * 0.09, 2.5, 22];
  } else if (state === 'lost') {
    agents = [[w * 0.7, h * 0.4, 2.6, m * 0.16 + 20]];
    front = [0, 0, 1];
  }
  return { agents, front };
}

// legend: jump to a beat (scrolls through the figure; with motion off, shows that beat)
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-beat-to]');
  if (!b || !story) return;
  const i = +(b.dataset.beatTo || 0);
  if (still) { pickedBeat = i; kick(); return; }
  const r = story.getBoundingClientRect();
  const run = r.height - storyBand!.offsetHeight;
  window.scrollTo({ top: window.scrollY + r.top - stripH0() + BEAT_SCROLL[i] * run, behavior: 'smooth' });
});

// ---------------------------------------------------------------- render on demand
let wave = [0, 0, 180];
let bandClip = [-1e5, 1e5];
let snap = false;
let transitioning = false;
const comps = [0, 0, 0, 0, 0];
let dim = 1;
const bootAt = performance.now();
let running = false, lastSig = '', quiet = 0;
let stripH = 50;
const readStrip = () => { stripH = parseFloat(getComputedStyle(root).getPropertyValue('--strip')) || 50; };
readStrip();

function kick() { if (!running) { running = true; quiet = 0; requestAnimationFrame(frame); } }
window.addEventListener('scroll', kick, { passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

function foldWidthPx() {
  const other = folds.find((f) => !f.classList.contains('is-open')) || folds[0];
  return other.getBoundingClientRect().width;
}

function frame(now: number) {
  if (document.hidden) { running = false; return; }
  if (story) {
    storyP = storyProgress();
    storyMeter?.parentElement!.style.setProperty('--p', storyP.toFixed(3));
    const beat = String(beatOf(storyP));
    if (story.dataset.beat !== beat) {
      story.dataset.beat = beat;
      story.querySelectorAll('[data-beat-to]').forEach((b) => { if ((b as HTMLElement).dataset.beatTo === beat) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    }
  }
  if (!R) { running = false; return; }

  const W = window.innerWidth, H = window.innerHeight;
  const phone = isPhone();
  const rects = folds.map((f) => f.getBoundingClientRect());
  const s = foldWidthPx();
  const openW = W - 4 * s;
  const bounds = [0, ...rects.slice(0, 4).map((r) => r.right), W];
  rects.forEach((r, i) => {
    let target = openW - s > 1 ? 1 - clamp((r.width - s) / (openW - s)) : 1;
    if (i === hovered && i !== active && !transitioning && !still) target = 0;
    comps[i] = transitioning || still || snap ? target : lerp(comps[i], target, 0.16);
  });

  cursor.x = lerp(cursor.x, cursor.tx, 0.22); cursor.y = lerp(cursor.y, cursor.ty, 0.22);
  const recent = now - cursor.last < 1400 ? 1 : 0.5;
  cursor.s = lerp(cursor.s, still ? 0 : cursor.ts * recent, 0.08);

  let dimTarget = 0.28;
  let curAmp = 0;
  const bands = [band, storyBand].map((el): BandFrame | null => {
    if (!el || !el.isConnected) return null;
    const b = el.getBoundingClientRect();
    if (b.bottom <= 0 || b.top >= H) return null;
    if (b.bottom > H * 0.35) dimTarget = 1;
    if (el.dataset.state === 'hero' && !still) curAmp = 1.5;
    return { rect: [b.left, b.top, b.width, b.height], ...bandState(el, el.offsetWidth, el.offsetHeight) };
  });
  if (transitioning) dimTarget = 1;
  dim = still ? dimTarget : lerp(dim, dimTarget, 0.12);
  snap = false;

  for (let i = ripples.length - 1; i >= 0; i--) if (now - ripples[i].t > 3200) ripples.splice(i, 1);
  const rip = ripples.map((r) => [r.x, r.y, (now - r.t) / 1000, 1]);
  const intro = still ? 1 : clamp(((now - bootAt) / 1000 - 0.15) / 0.7);

  const f: Frame = {
    bounds, comps: comps.slice(), strip: phone ? stripH : 1e5, dim,
    bands, curAmp,
    cursor: [cursor.x, cursor.y, cursor.s], wave, ripples: rip,
    pitch: phone ? 8 : 9, intro, clip: transitioning ? bandClip : [-1e5, 1e5],
  };
  // draw only if something visible changed; stop the loop once it has been quiet for a few frames
  const sig = JSON.stringify([bounds.map(Math.round), comps.map((c) => c.toFixed(3)), bands.map((b) => b && [b.rect.map(Math.round), b.agents.map((a) => a.map((v) => v.toFixed(2))), b.front.map((v) => v.toFixed(1))]), Math.round(cursor.x), Math.round(cursor.y), cursor.s.toFixed(3), dim.toFixed(3), wave.map((v) => v.toFixed(1)), intro.toFixed(3), W, H]);
  const live = rip.length > 0 || transitioning;
  if (sig !== lastSig || live) { R.draw(f); lastSig = sig; quiet = 0; } else quiet++;
  if (quiet > 6 && !live) { running = false; return; }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- router
const cache = new Map<string, Promise<string>>();
function prefetch(href: string) {
  const u = new URL(href, location.href);
  u.hash = '';
  const k = u.href;
  if (!cache.has(k)) cache.set(k, fetch(k, { credentials: 'same-origin' }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); }).catch((e) => { cache.delete(k); throw e; }));
  return cache.get(k)!;
}

// fold rectangles [x, w] for an open region k (k = -1: nothing open, every fold at the right edge)
function layoutFor(k: number, W: number, s: number) {
  return [0, 1, 2, 3, 4].map((i) => (k < 0 ? [W - (5 - i) * s, s] : i < k ? [i * s, s] : i === k ? [k * s, W - 4 * s] : [W - (5 - i) * s, s]));
}
function placeCSS(k: number) {
  folds.forEach((f, i) => {
    const x = k < 0 || i > k ? `calc(100% - ${5 - i} * var(--s))` : `calc(${i} * var(--s))`;
    f.style.setProperty('--x', x);
    f.style.setProperty('--w', i === k ? 'calc(100% - 4 * var(--s))' : 'var(--s)');
    f.classList.toggle('is-open', i === k);
    if (i === k) f.setAttribute('aria-current', 'page'); else f.removeAttribute('aria-current');
  });
}

let busy = false;
async function go(href: string, push = true) {
  if (busy) return;
  const url = new URL(href, location.href);
  busy = true;
  let html: string;
  try { html = await prefetch(url.href); } catch { location.href = url.href; return; }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const next = doc.querySelector<HTMLElement>('main.leaf');
  if (!next) { location.href = url.href; return; }
  const from = active, to = +(next.dataset.k ?? 0);
  if (push) history.pushState({}, '', url.href);

  const W = window.innerWidth, s = foldWidthPx(), phone = isPhone();
  const A = layoutFor(from, W, s), B = layoutFor(to, W, s);
  const stripOf = (L: number[][], k: number) => (k < 0 ? [W, 0] : L[k]);
  const before = leaf.getBoundingClientRect();

  // a frozen copy of the page being left, so both regions can move at the same time
  let ghost: HTMLElement | null = null;
  // pinned stages keep where they are on screen (sticky does not apply inside the frozen copy)
  const stOffs = [...leaf.querySelectorAll<HTMLElement>('[data-sticky]')].map((el) => el.getBoundingClientRect().top - (el.parentElement as HTMLElement).getBoundingClientRect().top);
  if (!still && from !== to) {
    ghost = leaf.cloneNode(true) as HTMLElement;
    ghost.querySelectorAll<HTMLElement>('[data-sticky]').forEach((el, i) => { el.style.position = 'relative'; el.style.top = `${stOffs[i] || 0}px`; });
    ghost.removeAttribute('id'); ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
    ghost.classList.add('ghost');
    Object.assign(ghost.style, { left: `${before.left}px`, top: `${before.top}px`, width: `${before.width}px` });
    document.body.appendChild(ghost);
  }

  // the new page goes in at once, laid out at its final size
  leaf.innerHTML = next.innerHTML;
  leaf.dataset.k = String(to); leaf.dataset.page = next.dataset.page || '';
  root.dataset.page = next.dataset.page || '';
  root.style.setProperty('--a', String(Math.max(0, to)));
  if (to < 0) root.style.setProperty('--rn', '5'); else root.style.removeProperty('--rn');
  document.title = doc.title;
  const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content');
  if (desc) document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
  active = to;
  window.scrollTo(0, 0);
  pageInit();
  motionBtns.splice(0, motionBtns.length, ...document.querySelectorAll<HTMLButtonElement>('[data-motion]'));
  applyMotion();

  if (!ghost) {
    placeCSS(to); busy = false; leaf.focus({ preventScroll: true }); kick();
    if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView();
    return;
  }

  transitioning = true;
  leaf.classList.add('is-moving');
  ghost.classList.add('is-moving');
  hovered = -1;
  const movingFolds = [folds[from], folds[to]].filter(Boolean);
  movingFolds.forEach((f) => f.classList.add('is-moving'));
  const box = leaf.getBoundingClientRect();
  const dur = 720, start = performance.now();
  const inset = (el: DOMRect, x: number, w: number) => `inset(0 ${Math.max(0, el.left + el.width - (x + w))}px 0 ${Math.max(0, x - el.left)}px)`;
  kick();
  await new Promise<void>((done) => {
    const step = (now: number) => {
      const ms = now - start;
      const t = clamp(ms / dur), e = easeInOut(t);
      folds.forEach((f, i) => {
        f.style.setProperty('--x', `${lerp(A[i][0], B[i][0], e)}px`);
        f.style.setProperty('--w', `${lerp(A[i][1], B[i][1], e)}px`);
      });
      // the old region closes into its strip while the new one opens out of its own, together, text unscaled
      const go0 = stripOf(A, from), go1 = stripOf(B, from);
      const gx = lerp(go0[0], go1[0], e), gw = lerp(go0[1], go1[1], e);
      const no0 = stripOf(A, to), no1 = stripOf(B, to);
      const nx = lerp(no0[0], no1[0], e), nw = lerp(no0[1], no1[1], e);
      // desktop: the old page closes into its strip. phone: the new page wipes across the old one.
      // Either way both pages stay whole (band and body) and are cut at the same edge.
      ghost!.style.clipPath = phone
        ? `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${nx - before.left}px 0, ${nx + nw - before.left}px 0, ${nx + nw - before.left}px 100%, ${nx - before.left}px 100%, ${nx - before.left}px 0)`
        : inset(before, gx, gw);
      bandClip = [nx, nx + nw];
      leaf.style.clipPath = inset(box, nx, nw);
      // the strain wave rides the seam that moves furthest
      const dl = Math.abs(no1[0] - no0[0]), dr = Math.abs(no1[0] + no1[1] - (no0[0] + no0[1]));
      const seam = dl > dr ? nx : nx + nw;
      wave = [seam, 2.2 * Math.sin(Math.PI * t), phone ? 60 : 110];
      if (t < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });

  ghost.remove();
  leaf.style.clipPath = '';
  movingFolds.forEach((f) => f.classList.remove('is-moving'));
  bandClip = [-1e5, 1e5];
  snap = true;
  leaf.classList.remove('is-moving');
  placeCSS(to);
  wave = [0, 0, 180];
  transitioning = false;
  maskKey = ''; buildMask();
  leaf.focus({ preventScroll: true });
  if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView();
  busy = false;
  kick();
}

function internal(a: HTMLAnchorElement) {
  if (a.target && a.target !== '_self') return false;
  if (a.hasAttribute('download') || a.dataset.astroReload !== undefined) return false;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || !u.pathname.startsWith(BASE)) return false;
  if (u.pathname === location.pathname && u.hash) return false;
  if (/\.(xml|svg|png|jpg|pdf|txt)$/i.test(u.pathname)) return false;
  return true;
}

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
  if (!a || !internal(a)) return;
  e.preventDefault();
  if (new URL(a.href, location.href).pathname === location.pathname) { window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' }); return; }
  go(a.href);
});
document.addEventListener('pointerover', (e) => {
  const a = (e.target as HTMLElement).closest?.<HTMLAnchorElement>('a[href]');
  if (a && internal(a)) prefetch(a.href).catch(() => {});
}, { passive: true });
window.addEventListener('popstate', () => go(location.href, false));

// ---------------------------------------------------------------- boot
let rz = 0;
window.addEventListener('resize', () => {
  R?.resize(); readStrip(); kick();
  clearTimeout(rz); rz = window.setTimeout(() => { maskKey = ''; buildMask(); }, 120);
});
sysReduce.addEventListener?.('change', () => { if (!readPref()) { still = sysReduce.matches; applyMotion(); } });
applyMotion();
pageInit();
document.fonts?.ready.then(() => { maskKey = ''; buildMask(); });
document.fonts?.addEventListener?.('loadingdone', () => { maskKey = ''; buildMask(); });
kick();
