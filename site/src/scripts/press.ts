// The press. One sheet, many prints. Each print is an organisation: flat metal parts bolted
// together, printed in two inks (yellow, cyan). Agents are parts in a third ink (pink). All
// ink multiplies, so nothing covers anything: where an agent lands on the organisation,
// colours appear that neither had (vermilion, indigo, near-black). The organisation answers by
// turning its parts about their bolts; no part is taken away.
//
// Scroll: 1 one print → 2 an agent is bolted in, the print rearranges → 3 the view opens onto
// a sheet of prints still in two inks, and the change passes from print to print.
// Pointer: you hold a part. Near a hole it snaps and shows the bolt; click to print it there
// (drag before letting go to turn it). On the sheet, a print starts the change again from
// that print. Renders on demand only: scroll, pointer, resize, or while an animation runs.

import { INK, RIM, compose, geo, rng, bounds, type Part, type Shape, type Ink } from '../lib/parts';

const P = 112; // print pitch on the sheet (a print is ~100 wide)
const GX = 4, GY = 3; // the sheet extends GX/GY prints either side of the first
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const rad = (d: number) => (d * Math.PI) / 180;
const rot = (x: number, y: number, deg: number): [number, number] => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return [x * c - y * s, x * s + y * c];
};
const ARRIVE = 1000; // ms for one print to take the change

interface Nudge { amt: number; t0: number }
interface LivePart extends Part { path: Path2D; nudges: Nudge[]; enter: 'slide' | 'press'; t0?: number }
interface Tile {
  gx: number; gy: number; x: number; y: number; rot: number; hero: boolean;
  parts: LivePart[]; extra: LivePart[]; T: number; arr: number; jolt: number; inSheet: boolean;
  sc: number; cx: number; cy: number; ghost: number;
}
interface Stamp { path: Path2D; x: number; y: number; th: number; t0: number }

const S = (kind: Shape['kind'], seed: number, o: Partial<Shape> = {}): Shape => ({ kind, seed, ...o });

// ——— the first print, set by hand ———
function heroParts(): Part[] {
  const at = (shape: Shape, ink: Ink, px: number, py: number, th: number, px1: number, py1: number, th1: number, pin = 0, lag = 0): Part => {
    const g = geo(shape);
    const [bx, by] = g.pins[Math.min(pin, g.pins.length - 1)] ?? [0, 0];
    return { shape, ink, px, py, ox: -bx, oy: -by, th, px1, py1, th1, lag };
  };
  const plate = S('plate', 41, { w: 34, h: 25 });
  const disc = S('disc', 12, { r: 23 });
  const spine = S('strip', 7, { L: 96, w: 5.6 });
  return [
    at(disc, 'y', 36, 38, 0, 42, 32, 18, 0, 0.1),
    at(spine, 'c', 7, 63, -12, 7, 68, -27, 0, 0.2),
    at(plate, 'y', 72, 73, 0, 69, 75, 13, 0, 0.55),
    at(S('ring', 5, { r: 13, t: 2.6 }), 'c', 74, 24, 0, 68, 19, 0, 0, 0.4),
    at(S('sector', 3, { r: 19, span: Math.PI / 2 }), 'c', 24, 94, -125, 20, 94, -150, 0, 0.7),
    at(S('rod', 9, { L: 44, w: 1.5 }), 'y', 88, 46, 90, 89, 42, 116, 0, 0.85),
    at(S('strip', 22, { L: 24, w: 3.8 }), 'c', 14, 13, 0, 16, 16, -14, 0, 0.6),
    at(S('disc', 31, { r: 3.4 }), 'y', 57, 12, 0, 61, 12, 0, 0, 0.3),
    // agents
    { ...at(S('strip', 55, { L: 60, w: 5.2 }), 'm', 50, 50, 34, 50, 50, 34, 1), agent: true },
    { ...at(S('disc', 14, { r: 10 }), 'm', 64, 63, 0, 64, 63, 0), agent: true },
  ];
}

// ink laid by a brayer: streaks along the part, pale patches where the ink ran thin, specks
function makePattern(ctx: CanvasRenderingContext2D, hex: string, seed: number): CanvasPattern {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.fillStyle = hex; g.fillRect(0, 0, N, N);
  const img = g.getImageData(0, 0, N, N);
  const r = rng(seed);
  const noise = (cw: number, ch: number) => {
    const gw = N / cw, gh = N / ch, grid = Array.from({ length: gw * gh }, () => r());
    const at = (i: number, j: number) => grid[((j + gh) % gh) * gw + ((i + gw) % gw)];
    return (x: number, y: number) => {
      const fx = x / cw, fy = y / ch, i = Math.floor(fx), j = Math.floor(fy);
      const u = fx - i, v = fy - j, s = u * u * (3 - 2 * u), t = v * v * (3 - 2 * v);
      return lerp(lerp(at(i, j), at(i + 1, j), s), lerp(at(i, j + 1), at(i + 1, j + 1), s), t);
    };
  };
  const streak = noise(64, 4), fine = noise(8, 2), thin = noise(32, 32);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let a = 0.8 + 0.14 * streak(x, y) + 0.06 * fine(x, y);
    const t = thin(x, y);
    if (t < 0.3) a -= (0.3 - t) * 1.1;
    const q = r();
    if (q < 0.03) a -= 0.2 + r() * 0.35;
    img.data[(y * N + x) * 4 + 3] = Math.round(clamp(a, 0.25, 1) * 255);
  }
  g.putImageData(img, 0, 0);
  return ctx.createPattern(c, 'repeat')!;
}

export function initPress(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const header = document.querySelector<HTMLElement>('.top');
  const textEl = root.querySelector<HTMLElement>('[data-mask]');
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const touchOnly = matchMedia('(hover: none)').matches;
  const live = (p: Part): LivePart => ({ ...p, path: new Path2D(geo(p.shape).d), nudges: [], enter: 'press' });

  // ——— the sheet ———
  const tiles: Tile[] = [];
  const R = rng(1972);
  for (let gy = -GY; gy <= GY; gy++) for (let gx = -GX; gx <= GX; gx++) {
    const hero = gx === 0 && gy === 0;
    const parts = (hero ? heroParts() : compose(4200 + (gy + GY) * 31 + gx + GX)).map(live);
    if (hero) parts.forEach((p) => { if (p.agent && p.shape.kind === 'strip') p.enter = 'slide'; });
    // each print is centred in its cell and set to fill it
    const [bx0, by0, bx1, by1] = bounds(parts);
    const ext = Math.max(bx1 - bx0, by1 - by0);
    tiles.push({
      gx, gy, hero, parts, extra: [], T: Infinity, arr: 0, jolt: 0, inSheet: false, ghost: 0,
      sc: hero ? 1 : clamp(90 / ext, 0.85, 1.45), cx: hero ? 50 : (bx0 + bx1) / 2, cy: hero ? 50 : (by0 + by1) / 2,
      x: gx * P + (hero ? 0 : (R() - 0.5) * 6), y: gy * P + (hero ? 0 : (R() - 0.5) * 6), rot: hero ? 0 : (R() - 0.5) * 3,
    });
  }
  const tileAt = (gx: number, gy: number) => tiles.find((t) => t.gx === gx && t.gy === gy);
  // uneven travel times between neighbouring prints: the front is irregular, not a circle
  const W8 = rng(77), edge = new Map<string, number>();
  const weight = (a: Tile, b: Tile) => {
    const k = [a, b].map((t) => `${t.gx},${t.gy}`).sort().join('|');
    if (!edge.has(k)) { const u = W8(); edge.set(k, (0.55 + 2.2 * u * u * u) * (a.gx !== b.gx && a.gy !== b.gy ? 1.4 : 1)); }
    return edge.get(k)!;
  };
  function travel(from: Tile, pool: Tile[]) {
    const T = new Map<Tile, number>(pool.map((t) => [t, Infinity]));
    T.set(from, 0);
    const done = new Set<Tile>();
    while (done.size < pool.length) {
      let best: Tile | null = null;
      for (const t of pool) if (!done.has(t) && (!best || T.get(t)! < T.get(best)!)) best = t;
      if (!best || T.get(best) === Infinity) break;
      done.add(best);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const n = tileAt(best.gx + dx, best.gy + dy);
        if (n && (dx || dy) && T.has(n) && !done.has(n)) T.set(n, Math.min(T.get(n)!, T.get(best)! + weight(best, n)));
      }
    }
    return T;
  }

  // ——— state ———
  let W = 0, H = 0, dpr = 1, z0 = 1, z1 = 1, wide = true;
  let f0 = [0, 0], f1 = [0, 0], c1 = [50, 50];
  let p = 0, sheetStart = 0;
  let cam = { z: 1, tx: 0, ty: 0 };
  let pat: Record<Ink, CanvasPattern>;
  let mask = { x: 0, y: 0, w: 0, h: 0 }, headH = 0;
  const stamps: Stamp[] = [];
  const hand: Shape[] = [
    S('disc', 101, { r: 7 }), S('strip', 102, { L: 30, w: 4.8 }), S('ring', 103, { r: 6.5, t: 2 }),
    S('sector', 104, { r: 13, span: Math.PI / 2 }), S('plate', 105, { w: 15, h: 12 }), S('angle', 106, { a: 24, b: 15, w: 4.4 }),
  ];
  let handI = 0, handTh = 24;
  let handPath = new Path2D(geo(hand[0]).d);
  const ptr = { x: 0, y: 0, sx: 0, sy: 0, on: false, idle: false, last: 0, snap: null as null | { hx: number; hy: number; ox: number; oy: number } };
  let press: { t0: number; x: number; y: number } | null = null;
  let raf = 0, idleTimer = 0;

  function measure() {
    const r = stage.getBoundingClientRect();
    headH = header ? header.offsetHeight : 64;
    if (textEl) {
      const t = textEl.getBoundingClientRect(), pad = wide ? 24 : 12;
      mask = { x: t.left - r.left - pad, y: t.top - r.top - pad, w: t.width + pad * 2, h: t.height + pad * 2 };
      if (!wide) { mask.x = 0; mask.w = W; mask.h = H - mask.y; }
    }
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    W = r.width; H = r.height; wide = W >= 820;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    measure();
    // one print, large, in the space the words leave
    if (wide) {
      z0 = Math.min(W * 0.44, H * 0.72) / 100;
      f0 = [W * 0.61, H * 0.52];
    } else {
      const top = headH + 8, bottom = mask.y - 6;
      z0 = Math.min(W * 0.84, (bottom - top) * 0.78) / 100;
      f0 = [W * 0.5, (top + bottom) / 2 - 6];
    }
    // the sheet: 5 × 3 prints beside the words (2 × 3 above them on a phone)
    const [c0, cN, r0, rN] = wide ? [-2, 2, -1, 1] : [0, 1, -1, 1];
    const rx0 = wide ? mask.x + mask.w + 8 : 10, rx1 = W - (wide ? 36 : 10);
    const ry0 = headH + (wide ? 16 : 4), ry1 = wide ? H - 28 : mask.y - 2;
    const cols = cN - c0 + 1, rows = rN - r0 + 1;
    z1 = Math.min((rx1 - rx0) / (cols * P), (ry1 - ry0) / (rows * P));
    f1 = [(rx0 + rx1) / 2, (ry0 + ry1) / 2];
    c1 = [((c0 + cN) / 2) * P + 50, ((r0 + rN) / 2) * P + 50];
    for (const t of tiles) {
      t.inSheet = t.gx >= c0 && t.gx <= cN && t.gy >= r0 && t.gy <= rN;
      const sx0 = f0[0] + (t.x - 50) * z0, sy0 = f0[1] + (t.y - 50) * z0, sx1 = sx0 + 100 * z0, sy1 = sy0 + 100 * z0;
      const under = sx1 > mask.x && sx0 < mask.x + mask.w && sy1 > mask.y && sy0 < mask.y + mask.h;
      t.ghost = wide && !under ? 0.13 : 0;
    }
    const T = travel(tileAt(0, 0)!, tiles.filter((t) => t.inSheet));
    const maxT = Math.max(...[...T.values()].filter(isFinite));
    for (const t of tiles) t.T = t.inSheet ? (T.get(t)! / maxT) * 1500 : Infinity;
    const k = 1 / (z0 * dpr * 0.9);
    const m = new DOMMatrix([k, 0, 0, k, 0, 0]);
    pat = { y: makePattern(ctx, INK.y, 11), c: makePattern(ctx, INK.c, 23), m: makePattern(ctx, INK.m, 37) };
    Object.values(pat).forEach((q) => q.setTransform(m));
    request();
  }

  function progress() {
    const r = root.getBoundingClientRect();
    let q = clamp(-r.top / Math.max(1, r.height - innerHeight));
    if (reduce.matches) q = q < 0.3 ? 0 : q < 0.66 ? 0.5 : 1;
    return q;
  }

  function request() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now: number) { raf = 0; if (draw(now)) request(); }

  const heroA = () => ease(seg(p, 0.05, 0.42));
  const zoomOf = () => ease(seg(p, 0.52, 0.9));

  /** A part's current pose inside its print: position, angle, scale, opacity. */
  function pose(part: LivePart, a: number, hero: boolean, now: number) {
    let x = part.px, y = part.py, th = part.th, sc = 1, al = 1, busy = false;
    if (part.t0 !== undefined) {
      // added on the sheet by a click: presses in when the change reaches this print
      const k = reduce.matches ? 1 : clamp((now - part.t0) / 320);
      if (k <= 0) return null;
      if (k < 1) busy = true;
      const e = easeOut(k); sc = 1 + 0.35 * (1 - e); al = e;
    } else if (part.agent) {
      if (part.enter === 'slide') {
        const k = ease(seg(a, 0, 0.42));
        if (k <= 0) return null;
        x += 150 * (1 - k); y -= 16 * (1 - k);
      } else {
        const k = seg(a, hero ? 0.34 : 0, hero ? 0.56 : 0.3);
        if (k <= 0) return null;
        const e = easeOut(k); sc = 1 + 0.35 * (1 - e); al = e;
      }
    } else {
      const s0 = hero ? 0.22 + (part.lag ?? 0) * 0.3 : 0.12 + (part.lag ?? 0) * 0.3;
      const k = ease(seg(a, s0, s0 + (hero ? 0.48 : 0.55)));
      x = lerp(part.px, part.px1, k); y = lerp(part.py, part.py1, k); th = lerp(part.th, part.th1, k);
    }
    for (const n of part.nudges) {
      const k = reduce.matches ? 1 : clamp((now - n.t0) / 900);
      if (k < 1) busy = true;
      th += n.amt * easeBack(k);
    }
    return { x, y, th, sc, al, busy };
  }
  const easeBack = (t: number) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  function tileA(t: Tile, now: number) {
    if (t.hero) return heroA();
    if (!t.arr) return 0;
    return reduce.matches ? 1 : clamp((now - t.arr) / ARRIVE);
  }

  // misregistration after an impression: each ink plate settles back into register
  const JOLT: Record<Ink, [number, number]> = { y: [1, 0.35], c: [-0.45, 1], m: [0.7, -0.8] };
  function jolt(t: Tile, ink: Ink, now: number): [number, number] {
    if (!t.jolt || reduce.matches) return [0, 0];
    const k = (now - t.jolt) / 1000;
    if (k < 0 || k > 0.7) return [0, 0];
    const amp = (3.2 / cam.z + 0.25) * Math.exp(-6 * k) * Math.cos(k * 26);
    return [JOLT[ink][0] * amp, JOLT[ink][1] * amp];
  }

  function draw(now: number): boolean {
    let busy = false;
    const hA = heroA(), zoom = zoomOf();
    const z = z0 * Math.pow(z1 / z0, zoom);
    const fwx = lerp(50, c1[0], zoom), fwy = lerp(50, c1[1], zoom);
    cam = { z, tx: lerp(f0[0], f1[0], zoom) - fwx * z, ty: lerp(f0[1], f1[1], zoom) - fwy * z };
    stage.dataset.state = p < 0.28 ? '0' : p < 0.62 ? '1' : '2';

    // the sheet's front: plays once the view has opened, from the first print
    if (zoom > 0.9 && !sheetStart) {
      sheetStart = now + 120;
      for (const t of tiles) if (!t.hero && t.inSheet && !t.arr) { t.arr = sheetStart + t.T; t.jolt = t.arr; }
    }
    if (zoom < 0.35 && sheetStart) {
      sheetStart = 0;
      for (const t of tiles) if (!t.hero) { t.arr = 0; t.extra = []; t.jolt = 0; }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * cam.tx, dpr * cam.ty);
    ctx.globalCompositeOperation = 'multiply';
    ctx.lineJoin = 'round';

    for (const t of tiles) {
      if (!t.hero && !t.inSheet) continue;
      const al = t.hero ? 1 : lerp(t.ghost, 1, zoom);
      if (al <= 0.005) continue;
      const sx = t.x * z + cam.tx, sy = t.y * z + cam.ty;
      if (sx > W || sy > H || sx + 110 * z < 0 || sy + 110 * z < 0) continue;
      const a = tileA(t, now);
      if (!t.hero && t.arr && now < t.arr + ARRIVE + 100) busy = true;
      if (t.jolt && now < t.jolt + 800) busy = true;
      ctx.save();
      ctx.translate(t.x + 50, t.y + 50); ctx.rotate(rad(t.rot)); ctx.scale(t.sc, t.sc); ctx.translate(-t.cx, -t.cy);
      ctx.globalAlpha = al;
      for (const part of [...t.parts, ...t.extra]) {
        const q = pose(part, a, t.hero, now);
        if (!q) { if (part.t0 !== undefined && now < part.t0) busy = true; continue; }
        if (q.busy) busy = true;
        const [jx, jy] = jolt(t, part.ink, now);
        ctx.save();
        ctx.globalAlpha = al * q.al;
        ctx.translate(q.x + jx, q.y + jy); ctx.rotate(rad(q.th)); ctx.translate(part.ox, part.oy);
        if (q.sc !== 1) ctx.scale(q.sc, q.sc);
        ink(part.path, part.ink);
        ctx.restore();
      }
      ctx.restore();
    }

    marks(hA, zoom, now);

    // printed by the reader
    for (const s of stamps) {
      const k = reduce.matches ? 1 : clamp((now - s.t0) / 260);
      if (k < 1) busy = true;
      const e = easeOut(k);
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.75 * e;
      ctx.translate(s.x, s.y); ctx.rotate(rad(s.th));
      const sc = 1 + 0.08 * (1 - e);
      ctx.scale(sc, sc);
      ink(s.path, 'm', 0.5);
      ctx.restore();
    }

    // the part in your hand
    if (ptr.on && !ptr.idle && !overWords(ptr.x, ptr.y)) {
      const k = reduce.matches ? 1 : 0.34;
      ptr.sx += (ptr.x - ptr.sx) * k; ptr.sy += (ptr.y - ptr.sy) * k;
      if (Math.abs(ptr.x - ptr.sx) + Math.abs(ptr.y - ptr.sy) > 0.4) busy = true;
      const wx = (ptr.sx - cam.tx) / z, wy = (ptr.sy - cam.ty) / z;
      ptr.snap = findSnap(wx, wy, now);
      let ox = wx, oy = wy;
      if (ptr.snap) { ox = ptr.snap.ox; oy = ptr.snap.oy; }
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.translate(ox, oy); ctx.rotate(rad(handTh));
      ink(handPath, 'm', 0.4);
      ctx.restore();
      if (ptr.snap) {
        // the bolt: where the held part would be fixed
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const bx = ptr.snap.hx * z + cam.tx, by = ptr.snap.hy * z + cam.ty;
        ctx.strokeStyle = INK.key; ctx.lineWidth = 1.25;
        ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx - 8, by); ctx.lineTo(bx + 8, by); ctx.moveTo(bx, by - 8); ctx.lineTo(bx, by + 8); ctx.stroke();
        ctx.restore();
      }
    } else ptr.snap = null;

    // a paper margin keeps the words clear once the sheet opens
    const mk = wide ? clamp(zoom * 1.6) : 1;
    if (mk > 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = mk;
      ctx.fillRect(mask.x, mask.y, mask.w, mask.h);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
    return busy;
  }

  /** Fill a part with its ink, then run a heavier rim where the ink gathers at the edge. */
  function ink(path: Path2D, k: Ink, rim = 0.32) {
    ctx.fillStyle = pat[k];
    ctx.fill(path, 'evenodd');
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * rim;
    ctx.strokeStyle = RIM[k];
    ctx.lineWidth = Math.max(0.2, 0.8 / cam.z);
    ctx.stroke(path);
    ctx.globalAlpha = a;
  }

  // registration targets and crop marks: around the first print, then around every print on
  // the sheet. A print gets its pink target when the agents' ink has been added to it.
  function marks(hA: number, zoom: number, now: number) {
    const z = cam.z;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 1;
    const target = (x: number, y: number, r: number, inks: [Ink, number][]) => {
      const off: Record<Ink, [number, number]> = { y: [0, 0], c: [0.9, -0.6], m: [-0.7, 0.8] };
      for (const [k, al] of inks) {
        if (al <= 0.01) continue;
        ctx.globalAlpha = al; ctx.strokeStyle = INK[k];
        const [dx, dy] = off[k];
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.moveTo(x + dx - r * 1.7, y + dy); ctx.lineTo(x + dx + r * 1.7, y + dy);
        ctx.moveTo(x + dx, y + dy - r * 1.7); ctx.lineTo(x + dx, y + dy + r * 1.7);
        ctx.stroke();
      }
    };
    const crops = (x0: number, y0: number, x1: number, y1: number, g: number, l: number, al: number) => {
      ctx.globalAlpha = al; ctx.strokeStyle = INK.key;
      ctx.beginPath();
      for (const [x, y, sx, sy] of [[x0, y0, -1, -1], [x1, y0, 1, -1], [x0, y1, -1, 1], [x1, y1, 1, 1]]) {
        ctx.moveTo(x + sx * g, y); ctx.lineTo(x + sx * (g + l), y);
        ctx.moveTo(x, y + sy * g); ctx.lineTo(x, y + sy * (g + l));
      }
      ctx.stroke();
    };
    const toS = (wx: number, wy: number): [number, number] => [wx * z + cam.tx, wy * z + cam.ty];
    // the first print
    const hm = 1 - zoom;
    if (hm > 0.01) {
      const [x0, y0] = toS(0, 0), [x1, y1] = toS(100, 100);
      for (const [wx, wy] of [[-9, -9], [109, -9], [-9, 109], [109, 109]]) {
        const [x, y] = toS(wx, wy);
        target(x, y, 2.4 * z, [['y', hm], ['c', hm], ['m', hm * hA]]);
      }
      crops(x0, y0, x1, y1, 3 * z, 4 * z, hm * 0.5);
      // colour bar: each ink alone, then every overprint; pink ones print once an agent has
      const bar: Ink[][] = [['y'], ['c'], ['y', 'c'], ['m'], ['y', 'm'], ['c', 'm'], ['y', 'c', 'm']];
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * cam.tx, dpr * cam.ty);
      ctx.globalCompositeOperation = 'multiply';
      bar.forEach((inks, i) => {
        const al = inks.includes('m') ? Math.max(hA, stamps.length ? 1 : 0) : 1;
        if (al <= 0.01) return;
        for (const k of inks) { ctx.globalAlpha = hm * al; ctx.fillStyle = pat[k]; ctx.fillRect(12 + i * 6.4, 105, 5.4, 3.4); }
      });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
    // the sheet: crop marks at its corners; beside each print, its registration target —
    // yellow and cyan from the start, pink once the change has reached it
    if (zoom > 0.02) {
      let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
      for (const t of tiles) {
        if (!t.inSheet) continue;
        X0 = Math.min(X0, t.x); Y0 = Math.min(Y0, t.y); X1 = Math.max(X1, t.x + 100); Y1 = Math.max(Y1, t.y + 100);
        const [tx, ty] = toS(t.x + 100, t.y);
        const a = tileA(t, now);
        target(tx - 2, ty + 6, 3, [['y', zoom * 0.85], ['c', zoom * 0.85], ['m', zoom * clamp(a * 4)]]);
      }
      const [x0, y0] = toS(X0 - 4, Y0 - 4), [x1, y1] = toS(X1 + 4, Y1 + 4);
      crops(x0, y0, x1, y1, 6, 12, zoom * 0.45);
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'multiply';
  }

  // ——— holding and printing ———
  /** A point in a print's own space → the sheet. */
  function toWorld(t: Tile, x: number, y: number): [number, number] {
    const [rx, ry] = rot((x - t.cx) * t.sc, (y - t.cy) * t.sc, t.rot);
    return [rx + t.x + 50, ry + t.y + 50];
  }

  const overWords = (x: number, y: number) =>
    y < headH + 4 || (x > mask.x && x < mask.x + mask.w && y > mask.y && y < mask.y + mask.h);

  /** The nearest hole within reach of the held part, and where the part sits bolted there. */
  function findSnap(wx: number, wy: number, now: number) {
    const reach = 18 / cam.z;
    const zoom = zoomOf();
    let best: { d: number; hx: number; hy: number } | null = null;
    for (const t of tiles) {
      if (!t.hero && (!t.inSheet || zoom < 0.6)) continue;
      if (Math.abs(t.x + 50 - wx) > 80 || Math.abs(t.y + 50 - wy) > 80) continue;
      const a = tileA(t, now);
      for (const part of [...t.parts, ...t.extra]) {
        const q = pose(part, a, t.hero, now);
        if (!q || q.al < 0.9) continue;
        for (const [hx, hy] of geo(part.shape).holes) {
          // hole → print → sheet
          let [x, y] = rot(hx + part.ox, hy + part.oy, q.th);
          x += q.x; y += q.y;
          [x, y] = toWorld(t, x, y);
          const d = Math.hypot(x - wx, y - wy);
          if (d < reach && (!best || d < best.d)) best = { d, hx: x, hy: y };
        }
      }
    }
    if (!best) return null;
    const [pxl, pyl] = geo(hand[handI]).pins[0];
    const [dx, dy] = rot(pxl, pyl, handTh);
    return { hx: best.hx, hy: best.hy, ox: best.hx - dx, oy: best.hy - dy };
  }

  function printAt(sx: number, sy: number) {
    const now = performance.now();
    const wx = (sx - cam.tx) / cam.z, wy = (sy - cam.ty) / cam.z;
    const snap = findSnap(wx, wy, now);
    const x = snap ? snap.ox : wx, y = snap ? snap.oy : wy;
    stamps.push({ path: handPath, x, y, th: handTh, t0: now });
    if (stamps.length > 60) stamps.shift();
    const reachW = geo(hand[handI]).radius * 2.6;
    const r = rng(Math.floor(now * 7));
    let hit: Tile | null = null;
    for (const t of tiles) {
      if (Math.abs(t.x + 50 - x) > 60 + reachW || Math.abs(t.y + 50 - y) > 60 + reachW) continue;
      if (Math.abs(t.x + 50 - x) < 56 && Math.abs(t.y + 50 - y) < 56) hit = t;
      for (const part of t.parts) {
        if (part.agent) continue;
        const [qx, qy] = toWorld(t, part.px1, part.py1);
        const d = Math.hypot(qx - x, qy - y);
        if (d < reachW) part.nudges.push({ amt: (r() < 0.5 ? -1 : 1) * (6 + 14 * (1 - d / reachW)), t0: now + d * 5 });
        if (part.nudges.length > 5) part.nudges.splice(0, part.nudges.length - 5);
      }
    }
    // the impression: the plates jolt out of register and settle
    if (hit) hit.jolt = now;
    // on the open sheet the change starts again from the print you pressed, and travels
    if (hit && zoomOf() > 0.85 && hit.inSheet) wave(hit, hand[handI], now);
    handI = (handI + 1) % hand.length;
    handPath = new Path2D(geo(hand[handI]).d);
    handTh = Math.round((r() * 180 - 90) / 15) * 15;
    request();
  }

  /** From one print outwards: each print takes one more agent part and turns in response. */
  function wave(from: Tile, shape: Shape, now: number) {
    const sheet = tiles.filter((t) => t.inSheet);
    const T = travel(from, sheet);
    const maxT = Math.max(1e-6, ...[...T.values()].filter(isFinite));
    const r = rng(Math.floor(now));
    for (const t of sheet) {
      const at = now + (reduce.matches ? 0 : (T.get(t)! / maxT) * 1500);
      t.jolt = at;
      if (!t.hero && !t.arr) { t.arr = at; continue; }
      if (t.extra.length < 3) {
        // bolt one more pink part through a free hole of the print's spine
        const spine = t.parts[0];
        const pins = geo(spine.shape).pins;
        const [hx, hy] = pins[Math.floor(r() * pins.length)];
        let [x, y] = rot(hx + spine.ox, hy + spine.oy, spine.th1);
        x += spine.px1; y += spine.py1;
        const g = geo(shape);
        const [bx, by] = g.pins[Math.floor(r() * g.pins.length)];
        t.extra.push({ shape, ink: 'm', px: x, py: y, px1: x, py1: y, ox: -bx, oy: -by, th: r() * 360, th1: 0, agent: true, path: new Path2D(g.d), nudges: [], enter: 'press', t0: at });
      }
      for (const part of t.parts) if (!part.agent && r() < 0.6) part.nudges.push({ amt: (r() < 0.5 ? -1 : 1) * (5 + r() * 10), t0: at + 120 });
    }
  }

  // ——— input ———
  let down: { x: number; y: number; t: number; th: number } | null = null;
  const local = (e: PointerEvent): [number, number] => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = local(e);
    down = { x, y, t: performance.now(), th: handTh };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const [x, y] = local(e);
    const moved = Math.hypot(x - down.x, y - down.y);
    const d = down;
    down = null;
    if (e.pointerType === 'mouse') {
      if (overWords(d.x, d.y)) return;
      printAt(d.x, d.y);
      ptr.x = x; ptr.y = y;
    } else if (moved < 10 && performance.now() - d.t < 450) printAt(x, y);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || touchOnly) return;
    const [x, y] = local(e);
    if (down) {
      // drag to turn the part about the point where you pressed
      const dx = x - down.x, dy = y - down.y;
      if (Math.hypot(dx, dy) > 8) handTh = down.th + (Math.atan2(dy, dx) * 180) / Math.PI;
      ptr.x = down.x; ptr.y = down.y;
    } else { ptr.x = x; ptr.y = y; }
    if (!ptr.on) { ptr.sx = ptr.x; ptr.sy = ptr.y; ptr.on = true; }
    ptr.idle = false; ptr.last = performance.now();
    clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => { ptr.idle = true; request(); }, 2400);
    request();
  });
  canvas.addEventListener('pointerleave', () => { ptr.on = false; down = null; request(); });
  canvas.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const q = rng(stamps.length + 5);
    const zoom = zoomOf();
    const wx = lerp(50, c1[0], zoom) + (q() - 0.5) * 50, wy = lerp(50, c1[1], zoom) + (q() - 0.5) * 50;
    printAt(wx * cam.z + cam.tx, wy * cam.z + cam.ty);
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
