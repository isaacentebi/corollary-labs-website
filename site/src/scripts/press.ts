// The press. One sheet, many prints. Each print is an organisation: a few flat parts in two
// inks (yellow, cyan). Agents are parts in a third ink (pink). Everything is drawn with
// multiply, so nothing covers anything: where an agent lands on the organisation, colours
// appear that neither had (vermilion, indigo, near-black). The organisation answers by
// turning its parts about their pivots; no part is taken away.
// Scroll: 0 one print → 1 an agent enters, the print rearranges → 2 the sheet; the change
// travels from print to print. Pointer: you hold a part; click to print it.
// Renders on demand only: scroll, pointer, resize, or while a short animation runs.

import { INK, compose, shapePath, shapeRadius, rng, type Part, type Shape, type Ink } from '../lib/parts';

const P = 122; // print pitch on the sheet (print is 100 wide)
const COLS = 13, ROWS = 11;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

interface Nudge { amt: number; t0: number }
interface LivePart extends Part { path: Path2D; nudges: Nudge[]; enter?: 'slide' | 'press' }
interface Tile {
  gx: number; gy: number; x: number; y: number; rot: number;
  parts: LivePart[]; T: number; manual: number; hero: boolean; fit: number;
}
interface Stamp { shape: Shape; path: Path2D; x: number; y: number; th: number; t0: number }

// ——— the first print, set by hand ———
function heroParts(): Part[] {
  const P0 = (o: Partial<Part> & Pick<Part, 'shape' | 'ink' | 'px' | 'py'>): Part => ({
    ox: 0, oy: 0, th: 0, px1: o.px, py1: o.py, th1: o.th ?? 0, lag: 0, ...o,
  });
  return [
    P0({ shape: { kind: 'disc', r: 21 }, ink: 'y', px: 35, py: 37, px1: 42, py1: 31, lag: 0.1 }),
    P0({ shape: { kind: 'strip', n: 11 }, ink: 'c', px: 10, py: 62, ox: 40, th: -13, px1: 9, py1: 67, th1: -29, lag: 0.25 }),
    P0({ shape: { kind: 'plate', n: 4 }, ink: 'y', px: 73, py: 71, th: 0, px1: 70, py1: 74, th1: 14, lag: 0.55 }),
    P0({ shape: { kind: 'ring', r: 14, t: 4.6 }, ink: 'c', px: 72, py: 25, px1: 67, py1: 19, lag: 0.4 }),
    P0({ shape: { kind: 'half', r: 13 }, ink: 'c', px: 27, py: 88, th: 0, px1: 23, py1: 90, th1: -24, lag: 0.7 }),
    P0({ shape: { kind: 'strip', n: 4 }, ink: 'y', px: 91, py: 38, ox: 12, th: 90, px1: 92, py1: 34, th1: 118, lag: 0.85 }),
    P0({ shape: { kind: 'bar', w: 30, h: 5 }, ink: 'y', px: 16, py: 14, th: 0, px1: 18, py1: 16, th1: -12, lag: 0.6 }),
    // agents
    P0({ shape: { kind: 'strip', n: 7 }, ink: 'm', px: 50, py: 50, th: 34, agent: true }),
    P0({ shape: { kind: 'disc', r: 10 }, ink: 'm', px: 63, py: 62, agent: true }),
  ];
}

function makePattern(ctx: CanvasRenderingContext2D, hex: string, seed: number): CanvasPattern {
  const N = 192, cell = 12, G = N / cell;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.fillStyle = hex; g.fillRect(0, 0, N, N);
  const img = g.getImageData(0, 0, N, N);
  const r = rng(seed);
  const grid = Array.from({ length: G * G }, () => r());
  const at = (i: number, j: number) => grid[((j + G) % G) * G + ((i + G) % G)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const fx = x / cell, fy = y / cell, i = Math.floor(fx), j = Math.floor(fy);
    const u = fx - i, v = fy - j;
    const s = u * u * (3 - 2 * u), t = v * v * (3 - 2 * v);
    const n = lerp(lerp(at(i, j), at(i + 1, j), s), lerp(at(i, j + 1), at(i + 1, j + 1), s), t);
    let a = 0.8 + 0.2 * n; // uneven pressure
    const q = r();
    if (q < 0.035) a -= 0.25 + r() * 0.3; // specks where the ink didn't take
    else a += (q - 0.5) * 0.06;
    img.data[(y * N + x) * 4 + 3] = Math.round(clamp(a) * 255);
  }
  g.putImageData(img, 0, 0);
  return ctx.createPattern(c, 'repeat')!;
}

export function initPress(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const touchOnly = matchMedia('(hover: none)').matches;

  // ——— the sheet ———
  const tiles: Tile[] = [];
  const cx0 = Math.floor(COLS / 2), cy0 = Math.floor(ROWS / 2);
  const R = rng(1972);
  for (let gy = -cy0; gy <= cy0; gy++) for (let gx = -cx0; gx <= cx0; gx++) {
    const hero = gx === 0 && gy === 0;
    const parts = (hero ? heroParts() : compose(9000 + (gy + cy0) * COLS + gx + cx0)).map((p) => ({
      ...p, path: new Path2D(shapePath(p.shape)), nudges: [] as Nudge[], enter: hero && p.shape.kind === 'strip' && p.agent ? 'slide' as const : 'press' as const,
    }));
    tiles.push({
      gx, gy, hero, parts, T: Infinity, manual: 0, fit: 1,
      x: gx * P + (hero ? 0 : (R() - 0.5) * 10), y: gy * P + (hero ? 0 : (R() - 0.5) * 10),
      rot: hero ? 0 : (R() - 0.5) * 4,
    });
  }
  const tileAt = (gx: number, gy: number) => tiles.find((t) => t.gx === gx && t.gy === gy);
  // first-passage times from the first print: an irregular front, not a circle
  {
    const heroT = tileAt(0, 0)!;
    heroT.T = 0;
    const W = rng(77);
    const done = new Set<Tile>();
    const edge = new Map<string, number>();
    const w = (a: Tile, b: Tile) => {
      const k = a.gx < b.gx || (a.gx === b.gx && a.gy < b.gy) ? `${a.gx},${a.gy}|${b.gx},${b.gy}` : `${b.gx},${b.gy}|${a.gx},${a.gy}`;
      if (!edge.has(k)) { const u = W(); edge.set(k, (0.5 + 2.6 * u * u * u) * (a.gx !== b.gx && a.gy !== b.gy ? 1.35 : 1)); }
      return edge.get(k)!;
    };
    while (done.size < tiles.length) {
      let best: Tile | null = null;
      for (const t of tiles) if (!done.has(t) && (!best || t.T < best.T)) best = t;
      if (!best || best.T === Infinity) break;
      done.add(best);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const n = tileAt(best.gx + dx, best.gy + dy);
        if (n && !done.has(n)) n.T = Math.min(n.T, best.T + w(best, n));
      }
    }
  }

  // ——— state ———
  let W = 0, H = 0, dpr = 1, z0 = 1, z1 = 1, f0x = 0, f0y = 0, f1x = 0, f1y = 0, Tscale = 1;
  let p = 0; // scroll progress through the story
  let cam = { z: 1, tx: 0, ty: 0 };
  let pat: Record<Ink, CanvasPattern>;
  const stamps: Stamp[] = [];
  const hand: Shape[] = [
    { kind: 'disc', r: 8 }, { kind: 'strip', n: 5 }, { kind: 'ring', r: 10, t: 3.6 },
    { kind: 'half', r: 10 }, { kind: 'plate', n: 2 }, { kind: 'bar', w: 26, h: 5 },
  ];
  let handI = 0, handTh = 20;
  let handPath = new Path2D(shapePath(hand[0]));
  const ptr = { x: 0, y: 0, sx: 0, sy: 0, on: false };
  let raf = 0;

  let mask: { x: number; y: number; w: number; h: number } | null = null;
  const textEl = root.querySelector<HTMLElement>('[data-mask]');
  function measureMask(r: DOMRect) {
    if (!textEl) return;
    const t = textEl.getBoundingClientRect();
    const pad = W < 820 ? 16 : 22;
    mask = { x: t.left - r.left - pad, y: t.top - r.top - pad, w: t.width + pad * 2, h: t.height + pad * 2 };
    if (W < 820) { mask.x = 0; mask.w = W; mask.h = H - mask.y; }
  }
  function resize() {
    const r = stage.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const wide = W >= 820;
    if (wide) {
      z0 = Math.min(W * 0.44, H * 0.72) / 100;
      f0x = W * 0.61; f0y = H * 0.52;
    } else {
      z0 = Math.min(W * 0.76, H * 0.42) / 100;
      f0x = W * 0.5; f0y = H * 0.41;
    }
    measureMask(r);
    // the open sheet: five rows of whole prints (above the words, on a phone)
    const availH = wide || !mask ? H : mask.y;
    z1 = Math.min((availH - 20) / (5 * P), wide ? Infinity : (W - 8) / (3 * P));
    f1x = wide && mask ? (mask.x + mask.w + W) / 2 : W * 0.5; f1y = availH / 2;
    // whole prints only: on the open sheet, a print that the screen edge would cut, or that
    // would sit under the words, is left out, so the sheet keeps a clean margin
    const tx1 = f1x - 50 * z1, ty1 = f1y - 50 * z1;
    for (const t of tiles) {
      const sx0 = (t.x - 4) * z1 + tx1, sy0 = (t.y - 4) * z1 + ty1, sx1 = (t.x + 104) * z1 + tx1, sy1 = (t.y + 104) * z1 + ty1;
      if (mask && sx1 > mask.x && sx0 < mask.x + mask.w && sy1 > mask.y && sy0 < mask.y + mask.h) t.fit = -1;
      else t.fit = sx0 >= 6 && sy0 >= 6 && sx1 <= W - 6 && sy1 <= H - 6 ? 1 : 0;
    }
    // scale arrival times so the front has reached ~3/4 of what is visible when the scroll ends
    const vis = tiles.filter((t) => t.fit === 1 || t.hero).map((t) => t.T).sort((a, b) => a - b);
    Tscale = vis[Math.floor(vis.length * 0.78)] || 1;
    const k = 1 / (z0 * dpr);
    const m = new DOMMatrix([k, 0, 0, k, 0, 0]);
    pat = { y: makePattern(ctx, INK.y, 11), c: makePattern(ctx, INK.c, 23), m: makePattern(ctx, INK.m, 37) };
    Object.values(pat).forEach((q) => q.setTransform(m));
    request();
  }

  function progress() {
    const r = root.getBoundingClientRect();
    const span = r.height - innerHeight;
    let q = clamp(-r.top / Math.max(1, span));
    if (reduce.matches) q = q < 0.3 ? 0 : q < 0.66 ? 0.5 : 1;
    return q;
  }

  function request() { if (!raf) raf = requestAnimationFrame(frame); }

  function frame(now: number) {
    raf = 0;
    const busy = draw(now);
    if (busy) request();
  }

  // hero: 0.05–0.44 the agent enters and the print rearranges; 0.54–0.82 the view opens to the
  // sheet; 0.6–1 the change travels
  function draw(now: number): boolean {
    let busy = false;
    const heroA = ease(seg(p, 0.05, 0.44));
    const zoom = ease(seg(p, 0.52, 0.84));
    const front = seg(p, 0.6, 1) * 1.04;
    const z = z0 * Math.pow(z1 / z0, zoom);
    const fx = lerp(f0x, f1x, zoom), fy = lerp(f0y, f1y, zoom);
    cam = { z, tx: fx - 50 * z, ty: fy - 50 * z };
    stage.dataset.state = p < 0.25 ? '0' : p < 0.6 ? '1' : '2';

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * cam.tx, dpr * cam.ty);
    ctx.globalCompositeOperation = 'multiply';

    const vx0 = -cam.tx / z - 20, vy0 = -cam.ty / z - 20, vx1 = (W - cam.tx) / z + 20, vy1 = (H - cam.ty) / z + 20;
    for (const t of tiles) {
      if (t.x + 100 < vx0 || t.x > vx1 || t.y + 100 < vy0 || t.y > vy1) continue;
      let a: number;
      if (t.hero) a = heroA;
      else a = clamp((front - t.T / Tscale) / 0.22);
      if (t.manual) {
        const m = clamp((now - t.manual) / 1300);
        if (m < 1) busy = true;
        a = Math.max(a, m);
      }
      ctx.save();
      ctx.translate(t.x + 50, t.y + 50); ctx.rotate((t.rot * Math.PI) / 180); ctx.translate(-50, -50);
      const al = t.hero ? 1 : t.fit < 0 ? 0 : t.fit * zoom;
      if (al <= 0.005) { ctx.restore(); continue; }
      ctx.globalAlpha = al;
      for (const part of t.parts) busy = drawPart(part, a, t.hero, now) || busy;
      ctx.restore();
    }

    // registration and crop marks around the first print, one target per ink in use
    const markA = 1 - zoom;
    if (markA > 0.01) {
      ctx.lineWidth = 1 / z;
      const corners: [number, number][] = [[-9, -9], [109, -9], [-9, 109], [109, 109]];
      const inks: [Ink, number, number, number][] = [['y', 0, 0, 1], ['c', 0.32, -0.22, 1], ['m', -0.28, 0.3, heroA]];
      for (const [cxm, cym] of corners) {
        for (const [ink, dx, dy, al] of inks) {
          if (al <= 0.01) continue;
          ctx.globalAlpha = markA * al;
          ctx.strokeStyle = INK[ink];
          ctx.beginPath();
          ctx.arc(cxm + dx, cym + dy, 2.6, 0, Math.PI * 2);
          ctx.moveTo(cxm + dx - 4.4, cym + dy); ctx.lineTo(cxm + dx + 4.4, cym + dy);
          ctx.moveTo(cxm + dx, cym + dy - 4.4); ctx.lineTo(cxm + dx, cym + dy + 4.4);
          ctx.stroke();
        }
      }
      // colour bar: each ink alone, then every overprint. The ones with pink print only once
      // an agent is on the sheet
      const bar: Ink[][] = [['y'], ['c'], ['y', 'c'], ['m'], ['y', 'm'], ['c', 'm'], ['y', 'c', 'm']];
      bar.forEach((inks, i) => {
        const x = 14 + i * 6.2;
        const al = inks.includes('m') ? Math.max(heroA, stamps.length ? 1 : 0) : 1;
        if (al <= 0.01) return;
        for (const ink of inks) {
          ctx.globalAlpha = markA * al;
          ctx.fillStyle = pat[ink];
          ctx.fillRect(x, 104.5, 5.2, 3.6);
        }
      });
      ctx.globalAlpha = markA * 0.55;
      ctx.strokeStyle = INK.key;
      ctx.beginPath();
      for (const [x, y, sx, sy] of [[0, 0, -1, -1], [100, 0, 1, -1], [0, 100, -1, 1], [100, 100, 1, 1]]) {
        ctx.moveTo(x + sx * 3, y); ctx.lineTo(x + sx * 7, y);
        ctx.moveTo(x, y + sy * 3); ctx.lineTo(x, y + sy * 7);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // printed by the reader
    for (const s of stamps) {
      const k = reduce.matches ? 1 : clamp((now - s.t0) / 320);
      if (k < 1) busy = true;
      const e = easeOut(k);
      ctx.save();
      ctx.globalAlpha = e;
      ctx.translate(s.x, s.y); ctx.rotate((s.th * Math.PI) / 180); ctx.scale(1 + 0.22 * (1 - e), 1 + 0.22 * (1 - e));
      ctx.fillStyle = pat.m; ctx.fill(s.path, 'evenodd');
      ctx.restore();
    }

    // the part in your hand
    if (ptr.on) {
      const k = reduce.matches ? 1 : 0.32;
      ptr.sx += (ptr.x - ptr.sx) * k; ptr.sy += (ptr.y - ptr.sy) * k;
      if (Math.abs(ptr.x - ptr.sx) + Math.abs(ptr.y - ptr.sy) > 0.4) busy = true;
      const wx = (ptr.sx - cam.tx) / z, wy = (ptr.sy - cam.ty) / z;
      const s = handScale();
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.translate(wx, wy); ctx.rotate((handTh * Math.PI) / 180); ctx.scale(s, s);
      ctx.fillStyle = pat.m; ctx.fill(handPath, 'evenodd');
      ctx.restore();
    }
    // a paper mask keeps the words clear of ink once the sheet opens
    const mk = W < 820 ? 1 : clamp(zoom * 1.6);
    if (mk > 0 && mask) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = mk;
      ctx.fillRect(mask.x, mask.y, mask.w, mask.h);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
    return busy;
  }

  // parts in the hand keep a readable size when the view opens out
  const handScale = () => Math.max(1, 22 / (cam.z * shapeRadius(hand[handI])));

  function drawPart(part: LivePart, a: number, hero: boolean, now: number): boolean {
    let busy = false;
    let px = part.px, py = part.py, th = part.th, sc = 1, al = 1;
    if (part.agent) {
      if (part.enter === 'slide') {
        const k = ease(seg(a, 0, 0.42));
        if (k <= 0) return false;
        px = part.px + 140 * (1 - k); py = part.py - 14 * (1 - k);
      } else {
        const k = seg(a, hero ? 0.34 : 0.0, hero ? 0.56 : 0.35);
        if (k <= 0) return false;
        const e = easeOut(k);
        sc = 1 + 0.3 * (1 - e); al = e;
      }
    } else {
      const start = 0.22 + (part.lag ?? 0) * 0.3;
      const k = ease(seg(a, start, start + 0.48));
      px = lerp(part.px, part.px1, k); py = lerp(part.py, part.py1, k); th = lerp(part.th, part.th1, k);
    }
    for (const n of part.nudges) {
      const k = reduce.matches ? 1 : clamp((now - n.t0) / 900);
      if (k < 1) busy = true;
      th += n.amt * easeBack(k);
    }
    ctx.save();
    if (al < 1) ctx.globalAlpha *= al;
    ctx.translate(px, py); ctx.rotate((th * Math.PI) / 180); ctx.translate(part.ox, part.oy);
    if (sc !== 1) ctx.scale(sc, sc);
    ctx.fillStyle = pat[part.ink];
    ctx.fill(part.path, 'evenodd');
    ctx.restore();
    return busy;
  }
  const easeBack = (t: number) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  // ——— printing ———
  function stampAt(sx: number, sy: number) {
    const now = performance.now();
    const wx = (sx - cam.tx) / cam.z, wy = (sy - cam.ty) / cam.z;
    const shape = hand[handI], s = handScale();
    // stamps are kept at the scale they were printed; bake the scale into the path
    const path = new Path2D();
    path.addPath(new Path2D(shapePath(shape)), new DOMMatrix().scale(s, s));
    stamps.push({ shape, path, x: wx, y: wy, th: handTh, t0: now });
    if (stamps.length > 48) stamps.shift();
    const reach = shapeRadius(shape) * s * 2.6;
    const r = rng(Math.floor(now));
    // the parts nearby turn about their pivots
    for (const t of tiles) {
      if (Math.abs(t.x + 50 - wx) > 100 + reach || Math.abs(t.y + 50 - wy) > 100 + reach) continue;
      for (const part of t.parts) {
        if (part.agent) continue;
        const d = Math.hypot(t.x + part.px1 - wx, t.y + part.py1 - wy);
        if (d < reach) part.nudges.push({ amt: (r() < 0.5 ? -1 : 1) * (6 + 16 * (1 - d / reach)), t0: now + d * 6 });
        if (part.nudges.length > 6) part.nudges.splice(0, part.nudges.length - 6);
      }
    }
    // on the sheet, printing on an organisation starts the change there and it passes on
    if (cam.z < z0 * 0.5) {
      const gx = Math.round((wx - 50) / P), gy = Math.round((wy - 50) / P);
      const heroA = ease(seg(p, 0.05, 0.44));
      for (const t of tiles) {
        const ring = Math.max(Math.abs(t.gx - gx), Math.abs(t.gy - gy));
        if (ring > 2 || t.manual) continue;
        const scrollA = t.hero ? heroA : clamp((seg(p, 0.6, 1) * 1.04 - t.T / Tscale) / 0.22);
        if (scrollA >= 1) continue;
        if (ring === 2 && r() < 0.45) continue;
        t.manual = now + ring * 260 + r() * 180;
      }
    }
    handI = (handI + 1) % hand.length;
    handPath = new Path2D(shapePath(hand[handI]));
    handTh = Math.round((r() * 180 - 90) / 15) * 15;
    request();
  }

  // ——— input ———
  let down: { x: number; y: number; t: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    down = null;
    if (moved > 10 || !quick) return;
    const r = stage.getBoundingClientRect();
    stampAt(e.clientX - r.left, e.clientY - r.top);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || touchOnly) return;
    const r = stage.getBoundingClientRect();
    ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
    if (!ptr.on) { ptr.sx = ptr.x; ptr.sy = ptr.y; ptr.on = true; }
    request();
  });
  canvas.addEventListener('pointerleave', () => { ptr.on = false; request(); });
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const q = rng(stamps.length + 5);
      stampAt(lerp(cam.tx, cam.tx + 100 * cam.z, 0.2 + q() * 0.6), lerp(cam.ty, cam.ty + 100 * cam.z, 0.2 + q() * 0.6));
    }
  });

  const onScroll = () => {
    const q = progress();
    if (q !== p) { p = q; request(); }
  };
  addEventListener('scroll', onScroll, { passive: true });
  new ResizeObserver(() => resize()).observe(stage);
  reduce.addEventListener('change', () => { p = progress(); request(); });
  p = progress();
  resize();
  document.fonts?.ready.then(() => resize());
}
