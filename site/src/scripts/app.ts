// The sheet: routing between regions as a continuous deformation, and the state fed to the renderer.
// The renderer draws only when something changes (scroll, pointer, a transition, a click ring) and stops once settled.
import { createRenderer, type Frame } from './gl';

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
let maskKey = '';
const maskCanvas = document.createElement('canvas');

function stretchKeyword(pct: number) {
  const k: [number, string][] = [[50, 'ultra-condensed'], [62.5, 'extra-condensed'], [75, 'condensed'], [87.5, 'semi-condensed'], [100, 'normal'], [112.5, 'semi-expanded'], [125, 'expanded'], [150, 'extra-expanded'], [200, 'ultra-expanded']];
  return k.reduce((best, c) => (Math.abs(c[0] - pct) < Math.abs(best[0] - pct) ? c : best))[1];
}

function buildMask() {
  band = leaf.querySelector<HTMLElement>('[data-band]');
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
let homeP = 0;
let meter: HTMLElement | null = null;
let hero: HTMLElement | null = null;

const titleRO = new ResizeObserver(() => buildMask());
function pageInit() {
  titleRO.disconnect();
  hero = leaf.querySelector('[data-hero]');
  meter = leaf.querySelector('[data-meter]');
  maskKey = '';
  buildMask();
  const t = leaf.querySelector('[data-latent]'); if (t) titleRO.observe(t);
}

function homeProgress() {
  if (!hero || still) return 0;
  const r = hero.getBoundingClientRect();
  const stage = hero.firstElementChild as HTMLElement;
  const run = r.height - stage.offsetHeight;
  return run > 0 ? clamp(-r.top / run) : 0;
}

const HOME_AGENTS = [
  { y: 0.12, tx: 0.16, t0: 0.0 },
  { y: 0.5, tx: 0.3, t0: 0.07 },
  { y: 0.1, tx: 0.62, t0: 0.14 },
  { y: 0.42, tx: 0.8, t0: 0.21 },
  { y: 0.66, tx: 0.52, t0: 0.28 },
];

// Home, four continuous states: rest (plain, the name in rose) → points enter and ring the sheet → fronts spread and
// merge → settled: the whole sheet has shifted to rose, faint rings remain at the five points, and the name is lilac.
function bandState(w: number, h: number) {
  const state = band?.dataset.state || 'rest';
  const phone = isPhone();
  const m = Math.min(w, h);
  let agents: number[][] = [];
  let front = [0, 0, 100];
  if (state === 'home') {
    if (still) {
      agents = [[w * 0.8, h * (phone ? 0.78 : 0.66), 1.6, m * 0.09 + 18]];
      front = [m * 0.1, 1.5, 30];
    } else {
      const p = homeP;
      agents = HOME_AGENTS.map((a) => {
        const k = clamp((p - a.t0) / 0.26);
        const x = lerp(-40, a.tx * w, easeOut(k));
        const amp = k <= 0 ? 0 : lerp(2.2, 0.28, smooth(0.62, 1, p)) * smooth(0, 0.3, k);
        return [x, a.y * h, amp, m * 0.07 + 24];
      });
      const R0 = Math.hypot(w, h) * 0.95;
      front = [smooth(0.3, 0.95, p) * R0, 3.5 * smooth(0.22, 0.36, p), phone ? 70 : 130];
    }
  } else if (state === 'front') {
    agents = [[w * 0.72, -w * 0.9, 0, 1]];
    front = [w * 0.9 + h * 0.18, 3.5, phone ? 40 : 70];
  } else if (state === 'plate') {
    agents = [[-w * 0.15, h * 1.2, 0, 1]];
    front = [w * 0.5, 3.5, 110];
  } else if (state === 'agent') {
    agents = [[w * (phone ? 0.86 : 0.93), h * 0.2, 2.4, m * (phone ? 0.1 : 0.12) + 20]];
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

// ---------------------------------------------------------------- render on demand
let wave = [0, 0, 180];
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
  if (hero) {
    homeP = homeProgress();
    meter?.parentElement!.style.setProperty('--p', homeP.toFixed(3));
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
    if (i === hovered && i !== active && !transitioning) target = 0;
    comps[i] = transitioning ? target : lerp(comps[i], target, 0.16);
  });

  cursor.x = lerp(cursor.x, cursor.tx, 0.22); cursor.y = lerp(cursor.y, cursor.ty, 0.22);
  const recent = now - cursor.last < 1400 ? 1 : 0.5;
  cursor.s = lerp(cursor.s, still ? 0 : cursor.ts * recent, 0.08);

  let bandRect: number[] | null = null;
  let st = { agents: [] as number[][], front: [0, 0, 100] };
  let dimTarget = 0.28;
  if (band && band.isConnected) {
    const b = band.getBoundingClientRect();
    if (b.bottom > 0 && b.top < H) {
      bandRect = [b.left, b.top, b.width, b.height];
      st = bandState(band.offsetWidth, band.offsetHeight);
      if (b.bottom > H * 0.35) dimTarget = 1;
    }
  }
  if (transitioning) dimTarget = 1;
  dim = lerp(dim, dimTarget, 0.12);

  for (let i = ripples.length - 1; i >= 0; i--) if (now - ripples[i].t > 3200) ripples.splice(i, 1);
  const rip = ripples.map((r) => [r.x, r.y, (now - r.t) / 1000, 1]);
  const intro = still ? 0 : Math.pow(1 - smooth(0.1, 1.3, (now - bootAt) / 1000), 2);

  const f: Frame = {
    bounds, comps: comps.slice(), strip: phone ? stripH : 1e5, dim,
    band: bandRect, agents: st.agents, front: st.front,
    cursor: [cursor.x, cursor.y, cursor.s], wave, ripples: rip,
    pitch: phone ? 8 : 9, intro,
  };
  // draw only if something visible changed; stop the loop once it has been quiet for a few frames
  const sig = JSON.stringify([bounds.map(Math.round), comps.map((c) => c.toFixed(3)), bandRect?.map(Math.round), st.agents.map((a) => a.map((v) => v.toFixed(1))), st.front.map((v) => v.toFixed(1)), Math.round(cursor.x), Math.round(cursor.y), cursor.s.toFixed(3), dim.toFixed(3), wave.map((v) => v.toFixed(1)), intro.toFixed(3), W, H]);
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
  if (!still && from !== to) {
    ghost = leaf.cloneNode(true) as HTMLElement;
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
      ghost!.style.clipPath = inset(before, gx, gw);
      leaf.style.clipPath = inset(box, nx, nw);
      ghost!.style.setProperty('--fade', String(1 - clamp(ms / 120)));
      leaf.style.setProperty('--fade', String(clamp((ms - (dur - 150)) / 150)));
      // the strain wave rides the seam that moves furthest
      const dl = Math.abs(no1[0] - no0[0]), dr = Math.abs(no1[0] + no1[1] - (no0[0] + no0[1]));
      const seam = dl > dr ? nx : nx + nw;
      wave = [seam, 2.2 * Math.sin(Math.PI * t), phone ? 60 : 110];
      if (t < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });

  ghost.remove();
  leaf.style.clipPath = ''; leaf.style.removeProperty('--fade');
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
