// The sheet: routing between regions as a continuous deformation, and the state fed to the renderer.
import { createRenderer, type Frame } from './gl';

const root = document.documentElement;
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
const still = root.classList.contains('still');
const canvas = document.querySelector<HTMLCanvasElement>('canvas.gl')!;
const folds = [...document.querySelectorAll<HTMLAnchorElement>('.fold')];
let leaf = document.querySelector<HTMLElement>('main.leaf')!;
let active = +(leaf.dataset.k || 0);

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const isPhone = () => window.matchMedia('(max-width: 760px)').matches;

// ---------------------------------------------------------------- renderer
const R = createRenderer(canvas);
if (R) root.classList.add('gl-on');

// ---------------------------------------------------------------- band + latent title
let band: HTMLElement | null = null;
let maskKey = '';
const maskCanvas = document.createElement('canvas');

function stretchKeyword(pct: number) {
  const k: [number, string][] = [[50, 'ultra-condensed'], [62.5, 'extra-condensed'], [75, 'condensed'], [87.5, 'semi-condensed'], [100, 'normal'], [112.5, 'semi-expanded'], [125, 'expanded'], [150, 'extra-expanded'], [200, 'ultra-expanded']];
  return k.reduce((best, c) => (Math.abs(c[0] - pct) < Math.abs(best[0] - pct) ? c : best))[1];
}

function buildMask() {
  band = leaf.querySelector<HTMLElement>('[data-band]');
  const title = band?.querySelector<HTMLElement>('[data-latent]');
  if (!band || !title) { R?.setMask(null); maskKey = ''; return; }
  // fit the title to the band (the widest line may not exceed the band's inner width)
  title.style.fontSize = '';
  const inner = band.clientWidth - parseFloat(getComputedStyle(band).paddingLeft) * 2;
  const widest = Math.max(...[...title.querySelectorAll<HTMLElement>('.band__line')].map((l) => l.offsetWidth));
  if (widest > inner) title.style.fontSize = `${(parseFloat(getComputedStyle(title).fontSize) * inner) / widest * 0.98}px`;
  if (!R) return;
  const br = band.getBoundingClientRect();
  const w = band.offsetWidth, h = band.offsetHeight;
  const scale = Math.min(2, window.devicePixelRatio || 1);
  const key = `${leaf.dataset.page}|${w}|${h}|${scale}|${document.fonts.status}`;
  if (key === maskKey) return;
  maskKey = key;
  maskCanvas.width = Math.max(1, Math.round(w * scale)); maskCanvas.height = Math.max(1, Math.round(h * scale));
  const ctx = maskCanvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  ctx.scale(scale, scale);
  const cs = getComputedStyle(title);
  const size = parseFloat(cs.fontSize);
  const stretch = parseFloat(cs.fontStretch) || 100;
  ctx.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
  try { (ctx as any).fontStretch = stretchKeyword(stretch); } catch { /* older engines */ }
  (ctx as any).letterSpacing = cs.letterSpacing !== 'normal' ? cs.letterSpacing : '0px';
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
  // the band's rect may be squashed mid-transition: lay out in its untransformed box
  const sx = br.width / w || 1;
  for (const line of title.querySelectorAll<HTMLElement>('.band__line')) {
    const r = line.getBoundingClientRect();
    const text = line.textContent || '';
    const m = ctx.measureText(text);
    const x = (r.left - br.left) / sx;
    const y = r.top - br.top + r.height / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    ctx.fillText(text, x, y);
  }
  R.setMask(maskCanvas);
}

// ---------------------------------------------------------------- pointer
const cursor = { x: -9999, y: -9999, tx: -9999, ty: -9999, s: 0, ts: 0, last: 0 };
const ripples: { x: number; y: number; t: number }[] = [];
let hovered = -1;
if (!still) {
  window.addEventListener('pointermove', (e) => {
    cursor.tx = e.clientX; cursor.ty = e.clientY; cursor.last = performance.now();
    if (cursor.x < -9000) { cursor.x = e.clientX; cursor.y = e.clientY; }
    cursor.ts = e.pointerType === 'mouse' ? 1 : 0.8;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { cursor.ts = 0; });
  window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') cursor.ts = 0; });
  window.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('a, button, input, textarea')) return;
    if (!t.closest('[data-band]')) return;
    ripples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (ripples.length > 4) ripples.shift();
  });
}
folds.forEach((f, i) => {
  f.addEventListener('pointerenter', () => { hovered = i; prefetch(f.href); });
  f.addEventListener('pointerleave', () => { if (hovered === i) hovered = -1; });
  f.addEventListener('focus', () => { hovered = i; prefetch(f.href); });
  f.addEventListener('blur', () => { if (hovered === i) hovered = -1; });
});

// ---------------------------------------------------------------- page states
let homeP = 0;
let meter: HTMLElement | null = null;
let hero: HTMLElement | null = null;

function pageInit() {
  hero = leaf.querySelector('[data-hero]');
  meter = leaf.querySelector('[data-meter]');
  maskKey = '';
  buildMask();
}

function homeProgress() {
  if (!hero) return 0;
  if (still) return 0.64;
  const r = hero.getBoundingClientRect();
  const stage = hero.firstElementChild as HTMLElement;
  const run = r.height - stage.offsetHeight;
  return clamp(-r.top / (run * 0.92));
}

const HOME_AGENTS = [
  { y: 0.26, tx: 0.16, t0: 0.03 },
  { y: 0.7, tx: 0.37, t0: 0.1 },
  { y: 0.16, tx: 0.6, t0: 0.17 },
  { y: 0.82, tx: 0.77, t0: 0.24 },
  { y: 0.44, tx: 0.9, t0: 0.31 },
];

function bandState(w: number, h: number, t: number) {
  const state = band?.dataset.state || 'rest';
  const phone = isPhone();
  const m = Math.min(w, h);
  let agents: number[][] = [];
  let front = [0, 0, 100];
  let breath = 0;
  if (state === 'home') {
    const p = homeP;
    agents = HOME_AGENTS.map((a, i) => {
      const k = clamp((p - a.t0) / 0.22);
      const x = lerp(-60, a.tx * w, easeOut(k));
      const pulse = still ? 0 : 0.25 * Math.sin(t * 1.3 + i * 1.7);
      const amp = k <= 0 ? 0 : (2.6 + pulse) * smooth(0, 0.35, k) * (1 - 0.35 * smooth(0.8, 1, p));
      return [x, a.y * h, amp, m * 0.07 + 26];
    });
    const R0 = Math.hypot(w, h) * 1.08;
    front = [smooth(0.34, 0.97, p) * R0, 6.5 * smooth(0.3, 0.42, p), phone ? 80 : 150];
    
  } else if (state === 'front') {
    // a front coming down from above, stopping short of the title
    const src = [w * 0.72, -w * 0.9];
    agents = [[src[0], src[1], 0, 1]];
    front = [Math.hypot(w * 0.72, w * 0.9) * 0.985 + h * (0.2 + (still ? 0 : 0.03 * Math.sin(t * 0.35))), 6.5, phone ? 40 : 70];
  } else if (state === 'plate') {
    agents = [[-w * 0.15, h * 1.2, 0, 1]];
    front = [w * (0.5 + (still ? 0 : 0.03 * Math.sin(t * 0.3))), 6.5, 110];
  } else if (state === 'agent') {
    const x = w * 0.86, y = h * (phone ? 0.2 : 0.24);
    agents = [[x, y, 2.8 + (still ? 0 : 0.35 * Math.sin(t * 1.1)), m * (phone ? 0.1 : 0.12) + 20]];
    front = [m * (phone ? 0.2 : 0.26), 5.5, phone ? 36 : 60];
  } else if (state === 'four') {
    agents = [0, 1, 2, 3].map((i) => [w * (0.52 + i * 0.13), h * (0.34 + 0.08 * Math.sin(i * 2.1)), 2.2 + (still ? 0 : 0.3 * Math.sin(t * 1.2 + i)), m * 0.08 + 14]);
    front = [m * 0.12, 3.5, 28];
  }
  return { agents, front, breath };
}

// ---------------------------------------------------------------- render loop
let wave = [0, 0, 180];
let transitioning = false;
let bandOn = 1;
const comps = [0, 0, 0, 0, 0];
const t0 = performance.now();
let lastDraw = 0;
let lastActivity = performance.now();
['scroll', 'pointermove', 'resize'].forEach((ev) => window.addEventListener(ev, () => { lastActivity = performance.now(); }, { passive: true }));

function foldWidthPx() {
  const other = folds[active === 0 ? 1 : 0];
  return other.getBoundingClientRect().width;
}

function frame(now: number) {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  // idle: 30 fps is plenty for the slow drift
  const idle = now - lastActivity > 2500 && !transitioning;
  if (idle && now - lastDraw < 32) return;
  lastDraw = now;
  const t = still ? 0 : (now - t0) / 1000;

  if (hero) {
    homeP = homeProgress();
    if (meter) meter.parentElement!.style.setProperty('--p', homeP.toFixed(3));
  }
  if (!R) return;

  const W = window.innerWidth, H = window.innerHeight;
  const phone = isPhone();
  const rects = folds.map((f) => f.getBoundingClientRect());
  const s = foldWidthPx();
  const openW = W - 4 * s;
  const bounds = [rects[0].left, ...rects.map((r) => r.right)];
  bounds[0] = 0; bounds[5] = W;
  rects.forEach((r, i) => {
    let target = openW - s > 1 ? 1 - clamp((r.width - s) / (openW - s)) : 1;
    if (i === hovered && i !== active && !transitioning) target = 0.45;
    comps[i] = transitioning ? target : lerp(comps[i], target, 0.12);
  });

  // pointer easing
  cursor.x = lerp(cursor.x, cursor.tx, 0.2); cursor.y = lerp(cursor.y, cursor.ty, 0.2);
  const recent = now - cursor.last < 1600 ? 1 : 0.55;
  cursor.s = lerp(cursor.s, cursor.ts * recent, 0.06);

  let bandRect: number[] | null = null;
  let st = { agents: [] as number[][], front: [0, 0, 100], breath: 0 };
  if (band && band.isConnected) {
    const b = band.getBoundingClientRect();
    if (b.bottom > 0 && b.top < H) {
      bandRect = [b.left, b.top, b.width, b.height];
      st = bandState(band.offsetWidth, band.offsetHeight, t);
      // agents are laid out in the band's own box: follow it when it is squashed mid-transition
      const sx = b.width / (band.offsetWidth || 1);
      st.agents = st.agents.map((a) => [a[0] * sx, a[1], a[2], a[3]]);
      st.front = [st.front[0] * Math.max(sx, 0.05), st.front[1], st.front[2]];
    }
  }

  const rip = ripples.map((r) => [r.x, r.y, (now - r.t) / 1000, 1]).filter((r) => r[2] < 3.5);
  const f: Frame = {
    bounds, comps: comps.slice(), strip: phone ? parseFloat(getComputedStyle(root).getPropertyValue('--strip')) || 50 : 1e5,
    band: bandRect, bandOn,
    agents: st.agents, front: st.front, breath: still ? 0 : st.breath,
    cursor: [cursor.x, cursor.y, still ? 0 : cursor.s], wave, ripples: rip,
    time: t, pitch: phone ? 6 : 7,
  };
  R.draw(f);
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

function layoutFor(k: number, W: number, s: number) {
  return [0, 1, 2, 3, 4].map((i) => (i < k ? [i * s, s] : i === k ? [k * s, W - 4 * s] : [W - (5 - i) * s, s]));
}
function placeCSS(k: number) {
  folds.forEach((f, i) => {
    const x = i < k ? `calc(${i} * var(--s))` : i === k ? `calc(${k} * var(--s))` : `calc(100% - ${5 - i} * var(--s))`;
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
  const from = active, to = +(next.dataset.k || 0);
  if (push) history.pushState({}, '', url.href);

  const swap = () => {
    leaf.innerHTML = next.innerHTML;
    leaf.dataset.k = String(to); leaf.dataset.page = next.dataset.page || '';
    root.dataset.page = next.dataset.page || '';
    root.style.setProperty('--a', String(to));
    document.title = doc.title;
    const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content');
    if (desc) document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
    active = to;
    window.scrollTo(0, 0);
    if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView();
    pageInit();
  };

  const W = window.innerWidth;
  const s = foldWidthPx();
  const A = layoutFor(from, W, s), B = layoutFor(to, W, s);
  const phone = isPhone();

  if (still || from === to) {
    placeCSS(to); swap(); leaf.focus({ preventScroll: true }); busy = false; return;
  }

  transitioning = true;
  leaf.classList.add('is-moving');
  const dur = phone ? 900 : 1150;
  const start = performance.now();
  let swapped = false;
  const leafBox = () => ({ x: phone ? 0 : leaf.offsetLeft, w: phone ? W : leaf.offsetWidth });
  let box = leafBox();
  const cxFrom = A[from][0] + A[from][1] / 2, cxTo = B[to][0] + B[to][1] / 2;

  await new Promise<void>((done) => {
    const step = (now: number) => {
      const t = clamp((now - start) / dur);
      const e = easeInOut(t);
      // folds slide continuously from one arrangement to the other
      folds.forEach((f, i) => {
        f.style.setProperty('--x', `${lerp(A[i][0], B[i][0], e)}px`);
        f.style.setProperty('--w', `${lerp(A[i][1], B[i][1], e)}px`);
      });
      // a wave of strain crosses the sheet from the old open region to the new one
      wave = [lerp(cxFrom, cxTo, e), 3.2 * Math.sin(Math.PI * t), phone ? 120 : 220];
      if (t < 0.5) {
        // the open region is squashed, without reflow, into its strip
        const q = easeInOut(t / 0.5);
        const tx = phone ? lerp(0, B[from][0], q) : lerp(A[from][0], B[from][0], q);
        const tw = phone ? lerp(W, B[from][1], q) : lerp(A[from][1], B[from][1], q);
        leaf.style.transform = `translateX(${tx - box.x}px) scaleX(${tw / box.w})`;
        leaf.style.opacity = String(1 - 0.35 * q);
      } else {
        if (!swapped) { swapped = true; placeCSS(to); folds.forEach((f, i) => { f.style.setProperty('--x', `${lerp(A[i][0], B[i][0], e)}px`); f.style.setProperty('--w', `${lerp(A[i][1], B[i][1], e)}px`); }); swap(); box = leafBox(); }
        // the new region is stretched open out of its strip
        const q = easeInOut((t - 0.5) / 0.5);
        const tx = phone ? lerp(A[to][0], 0, q) : lerp(A[to][0], B[to][0], q);
        const tw = phone ? lerp(A[to][1], W, q) : lerp(A[to][1], B[to][1], q);
        leaf.style.transform = `translateX(${tx - box.x}px) scaleX(${tw / box.w})`;
        leaf.style.opacity = String(0.65 + 0.35 * q);
      }
      if (t < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });

  leaf.style.transform = ''; leaf.style.opacity = '';
  leaf.classList.remove('is-moving');
  placeCSS(to);
  wave = [0, 0, 180];
  transitioning = false;
  maskKey = ''; buildMask();
  leaf.focus({ preventScroll: true });
  busy = false;
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
  R?.resize();
  clearTimeout(rz); rz = window.setTimeout(() => { maskKey = ''; buildMask(); }, 120);
});
pageInit();
document.fonts?.ready.then(() => { maskKey = ''; buildMask(); });
requestAnimationFrame(frame);
