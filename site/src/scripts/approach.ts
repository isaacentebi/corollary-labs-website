/*
  The Approach figure: the programme (after Gerstner) as four beats of one rule set.
    01  The organisation     a page as found: a modular grid (12 columns), a title, a text stream
    02  An agent enters      a new column enters: the grid re-divides to 13, every element keeps its
                             column count, so everything re-proportions
    03  It reorganises       the text clears, the column's pieces cross the grid and are set into the
                             text stream, and the text is set again around them
    04  The change spreads   the camera pulls back: the page is one sheet among many; each sheet runs
                             the same programme when the change reaches it, nearest first
  Canvas draws only rectangles (greeked text, the signal). The beat value b (0..3) is animated in time
  when the legend is used or the figure first comes into view. Rendering is on demand.
*/

type Rect = { x: number; y: number; w: number; h: number };
type Tok = { id: number; w: number; kind: 0 | 1; pEnd: boolean };
type Pos = { x: number; y: number; w: number; v: number; c?: number } | null;
type Grid = { cols: number; colW: number; x: (i: number) => number; span: (n: number) => number };
type Bar = { x: number; y: number; w: number; h: number };

interface Page {
  W: number; H: number; lh: number; sp: number; barH: number;
  stream: Tok[];
  L: [Pos[], Pos[], Pos[]];
  nvis: number;
  col: [Rect, Rect];
  K: number;
  edges: [number[], number[]];
  agentX: number;
  titleBars: [Bar[], Bar[], Bar[]];
  specBoxes: [Rect[], Rect[], Rect[]];
}

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sm = (t: number) => t * t * (3 - 2 * t);

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function makeGrid(W: number, cols: number, mx: number, g: number): Grid {
  const colW = (W - 2 * mx - (cols - 1) * g) / cols;
  return { cols, colW, x: (i) => mx + i * (colW + g), span: (n) => n * colW + (n - 1) * g };
}
const edgesOf = (G: Grid) => { const e: number[] = []; for (let i = 0; i < G.cols; i++) e.push(G.x(i), G.x(i) + G.colW); return e; };
/** 12 → 13 (or 6 → 7): old column i maps to i (< A) or i + 1; the new column's edges open from the gutter. */
function edgePairs(G0: Grid, G1: Grid, A: number) {
  const e0 = edgesOf(G0), e1 = edgesOf(G1);
  const from: number[] = [], to: number[] = [];
  for (let i = 0; i < G0.cols; i++) {
    const j = i < A ? i : i + 1;
    from.push(e0[2 * i], e0[2 * i + 1]); to.push(e1[2 * j], e1[2 * j + 1]);
  }
  const gap = (G0.x(A - 1) + G0.colW + G0.x(A)) / 2;
  from.push(gap, gap); to.push(e1[2 * A], e1[2 * A + 1]);
  return [from, to] as [number[], number[]];
}

/* ---------------- text stream (greeked) and flow ---------------- */
const CHARS = [1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 8, 8, 9, 10, 11, 12];
function makeStream(n: number, fs: number, seed: number): Tok[] {
  const r = rng(seed);
  const out: Tok[] = [];
  let para = 30 + Math.floor(r() * 50);
  for (let i = 0; i < n; i++) {
    const end = --para <= 0;
    if (end) para = 34 + Math.floor(r() * 56);
    const c = CHARS[Math.floor(r() * CHARS.length)];
    out.push({ id: i, w: c * fs * 0.52, kind: 0, pEnd: end });
  }
  return out;
}

function flow(stream: Tok[], boxes: Rect[], lh: number, sp: number, top: number, include: (t: Tok) => boolean): { pos: Pos[]; nvis: number } {
  const pos: Pos[] = new Array(stream.length).fill(null);
  const first = (b: Rect) => top + Math.ceil((b.y + lh * 0.72 - top) / lh) * lh;
  let bi = 0, b: Rect | undefined = boxes[0], x = b ? b.x : 0, y = b ? first(b) : 0, has = false, lastX = x, lastY = y, nvis = 0;
  const nl = () => {
    if (!b) return;
    x = b.x; y += lh; has = false;
    if (y > b.y + b.h) { bi++; b = boxes[bi]; if (b) { x = b.x; y = first(b); } }
  };
  for (let i = 0; i < stream.length; i++) {
    const t = stream[i];
    if (!include(t)) continue;
    if (b && has && x + t.w > b.x + b.w) nl();
    if (!b) { pos[i] = { x: lastX, y: lastY, w: t.w, v: 0 }; continue; }
    pos[i] = { x, y, w: t.w, v: 1, c: bi }; nvis = i + 1;
    lastX = x; lastY = y; x += t.w + sp; has = true;
    if (t.pEnd) { nl(); if (b && y !== first(b)) nl(); }
  }
  return { pos, nvis };
}

/* ---------------- one sheet ---------------- */
interface Layout {
  W: number; H: number; top: number; lh: number; fs: number; nWords: number; seed: number; K: number;
  G0: Grid; G1: Grid; A: number;
  boxes: [Rect[], Rect[], Rect[]];
  col: Rect;
  tb: [Bar[], Bar[], Bar[]];
}
function buildPage(Lo: Layout): Page {
  const { lh, fs, K } = Lo;
  const sp = fs * 0.3;
  let stream = makeStream(Lo.nWords, fs, Lo.seed);
  // the K pieces of the column are placed evenly through the text that the re-set page can hold
  const probe = flow(stream, Lo.boxes[2], lh, sp, Lo.top, () => true);
  const r = rng(Lo.seed + 7);
  const slots: number[] = [];
  for (let k = 0; k < K; k++) slots.push(Math.floor(((k + 0.35 + r() * 0.3) / K) * probe.nvis * 0.92));
  const next: Tok[] = [];
  let k = 0, uid = 100000 + Lo.seed * 100;
  stream.forEach((t, i) => {
    while (k < K && slots[k] === i) { next.push({ id: uid++, w: (3 + Math.floor(r() * 6)) * fs * 0.52, kind: 1, pEnd: false }); k++; }
    next.push(t);
  });
  stream = next;
  const f0 = flow(stream, Lo.boxes[0], lh, sp, Lo.top, (t) => t.kind !== 1);
  const f1 = flow(stream, Lo.boxes[1], lh, sp, Lo.top, (t) => t.kind !== 1);
  const f2 = flow(stream, Lo.boxes[2], lh, sp, Lo.top, () => true);
  const [e0, e1] = edgePairs(Lo.G0, Lo.G1, Lo.A);
  const gap = (Lo.G0.x(Lo.A - 1) + Lo.G0.colW + Lo.G0.x(Lo.A)) / 2;
  return {
    W: Lo.W, H: Lo.H, lh, sp, barH: Math.max(1, Math.round(fs * 0.3)),
    stream, L: [f0.pos, f1.pos, f2.pos], nvis: Math.max(1, f2.nvis),
    col: [{ x: gap, y: Lo.col.y, w: 0, h: Lo.col.h }, Lo.col], K,
    edges: [e0, e1], agentX: gap, specBoxes: Lo.boxes, titleBars: Lo.tb,
  };
}

/** A sheet on the programme's grid. `fixed` pins the origin sheet's composition. */
function sheetLayout(W: number, H: number, seed: number, o: { lh: number; fs: number; fixed?: boolean }): Layout {
  const r = rng(seed * 977 + 13);
  const mobile = W < 520;
  const mx = mobile ? Math.max(10, W * 0.04) : clamp(W * 0.03, 14, 40), g = mobile ? 8 : clamp(W * 0.012, 8, 16), top = mx;
  const { lh, fs } = o;
  const bottom = H - mx;
  const n0 = mobile ? 6 : 12;
  const G0 = makeGrid(W, n0, mx, g), G1 = makeGrid(W, n0 + 1, mx, g);
  const A = o.fixed ? (mobile ? 3 : 4) : 1 + Math.floor(r() * (n0 - 2));
  const map = (i: number) => (i < A ? i : i + 1);
  // the title as heavy bars (the way grid-system plates greek a headline)
  const words = o.fixed ? 2 : 1 + Math.floor(r() * 3);
  const wl = o.fixed ? [9, 4] : Array.from({ length: words }, () => 3 + Math.floor(r() * 8));
  const tCols = mobile ? n0 : o.fixed ? 8 : 5 + Math.floor(r() * 5);
  const capH = o.fixed ? Math.min(H * 0.11, W * 0.06) : mobile ? H * 0.045 : H * (0.07 + r() * 0.05);
  const titleBars = (G: Grid, cols: number, lines: number, fill: number, hScale: number): Bar[] => {
    const m = G.span(cols) * fill;
    const per = Math.ceil(words / lines);
    const out: Bar[] = [];
    for (let L = 0; L < lines; L++) {
      const ws = wl.slice(L * per, L * per + per);
      if (!ws.length) continue;
      const tot = ws.reduce((a, b) => a + b, 0) + (ws.length - 1) * 0.8;
      let x = G.x(0);
      const h = capH * hScale, y = top + L * h * 1.28;
      for (const c of ws) { const w = (c / tot) * m; out.push({ x, y, w, h }); x += w + (0.8 / tot) * m; }
    }
    return out;
  };
  const lines0 = o.fixed ? 1 : words > 1 && r() > 0.5 ? 2 : 1;
  const fill0 = lines0 === 1 ? 1 : 0.7 + r() * 0.3;
  const tb0 = titleBars(G0, tCols, lines0, fill0, 1);
  // 02 keeps the title's column count on the finer grid
  const tb1 = titleBars(G1, tCols, lines0, fill0, 1);
  const lines2 = lines0 === 1 && words > 1 ? 2 : 1;
  const tb2 = titleBars(G1, Math.min(n0 + 1, tCols + (o.fixed ? 0 : 1 + Math.floor(r() * 2))), lines2, 1, lines2 === 2 ? 1.1 : 1.25);
  const tBottom = (tb: Bar[]) => Math.max(...tb.map((b) => b.y + b.h));
  const snap = (y: number) => top + Math.ceil((y - top) / lh) * lh;
  const bt0 = snap(tBottom(tb0) + lh * 3), bt2 = snap(tBottom(tb2) + lh * 3);
  // body: 2 or 3 columns in 01, re-divided in 03
  const nb = mobile ? 2 : o.fixed ? 3 : 2 + Math.floor(r() * 2);
  const w0 = Math.floor(n0 / nb);
  const start0 = n0 - nb * w0;
  const b0: Rect[] = [], b1: Rect[] = [];
  for (let k = 0; k < nb; k++) {
    const c = start0 + k * w0;
    b0.push({ x: G0.x(c), y: bt0, w: G0.span(w0), h: bottom - bt0 });
    const c1 = map(c), c1e = map(c + w0 - 1);
    b1.push({ x: G1.x(c1), y: bt0, w: G1.x(c1e) + G1.colW - G1.x(c1) - (c < A && c + w0 - 1 >= A ? G1.colW + g : 0), h: bottom - bt0 });
  }
  const nb2 = mobile ? 2 : nb === 2 ? 3 : 4;
  const w2 = Math.floor((n0 + 1) / nb2);
  const b2: Rect[] = [];
  for (let k = 0; k < nb2; k++) { const c = (n0 + 1 - nb2 * w2) + k * w2; b2.push({ x: G1.x(c), y: bt2, w: G1.span(w2), h: bottom - bt2 }); }
  return {
    W, H, top, lh, fs, nWords: Math.round(((W * H) / (lh * fs * 6)) * 0.9), seed, K: o.fixed ? (mobile ? 8 : 12) : 5 + Math.floor(r() * 5), G0, G1, A,
    boxes: [b0, b1, b2], col: { x: G1.x(A), y: bt0, w: G1.colW, h: bottom - bt0 }, tb: [tb0, tb1, tb2],
  };
}

/*
  Sequencing of one re-setting (01→02 and 02→03), so nothing ever doubles up:
    OUT   words that will move leave, in a wave (by column distance on entry, in reading order after)
    FLY   (02→03 only) the column's pieces condense and travel across the cleared grid
    IN    words are set in their new places, in a second wave, around the pieces that have landed
*/
const OUT1 = [0, 0.3, 0.2] as const, IN1 = [0.5, 0.3, 0.2] as const;
const OUT2 = [0, 0.24, 0.12] as const, IN2 = [0.58, 0.28, 0.12] as const;
const FLY = [0.3, 0.14, 0.2] as const;
/** time for each beat to play (ms) */
const DUR = [2300, 2600, 3200];

export function mountApproach(root: HTMLElement) {
  const box = root.querySelector<HTMLElement>('[data-fig]')!;
  const canvas = box.querySelector<HTMLCanvasElement>('canvas')!;
  const steps = [...root.querySelectorAll<HTMLButtonElement>('[data-beat]')];
  const ctx = canvas.getContext('2d')!;
  const css = getComputedStyle(document.documentElement);
  const C = {
    sheet: css.getPropertyValue('--sheet').trim() || '#ecece8',
    ground: css.getPropertyValue('--ground').trim() || '#d9d9d4',
    ink: css.getPropertyValue('--ink').trim() || '#0e0e0d',
    signal: css.getPropertyValue('--signal').trim() || '#d0263a',
  };
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1;
  let page!: Page;
  let minis = new Map<string, Page>();
  let b = 0; // beat value, 0..3
  let target = 0;
  let from = 0, t0 = 0, dur = 0;
  let raf = 0;
  let auto: number[] = [];

  function build() {
    const r = box.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const small = W < 520;
    page = buildPage(sheetLayout(W, H, 11, { lh: small ? 9 : 11, fs: small ? 6 : 7, fixed: true }));
    minis = new Map();
    req();
  }
  function miniAt(i: number, j: number) {
    const key = i + ',' + j;
    let m = minis.get(key);
    if (!m) {
      const small = W < 520;
      m = buildPage(sheetLayout(W, H, 1 + ((i * 73856093) ^ (j * 19349663)) % 99991 + 100000, { lh: small ? 16 : 20, fs: small ? 11 : 14 }));
      minis.set(key, m);
    }
    return m;
  }

  /* where a word is, and how visible, while its page re-sets */
  function wordAt(pg: Page, i: number, u1: number, u2: number, d: number, out: { x: number; y: number; w: number; a: number }) {
    const k = u2 > 0 ? 1 : 0, u = k ? u2 : u1;
    const A = pg.L[k][i], B = pg.L[k + 1][i];
    if (!A || !B) return false;
    const moved = A.v && B.v && (Math.abs(A.x - B.x) > 0.3 || Math.abs(A.y - B.y) > 0.3);
    if (A.v && B.v && !moved) { out.x = A.x; out.y = A.y; out.w = A.w; out.a = 1; return true; }
    const O = k ? OUT2 : OUT1, I = k ? IN2 : IN1;
    const fo = REDUCED ? (u >= 1 ? 1 : 0) : sm(clamp((u - O[0] - d * O[1]) / O[2]));
    const fi = REDUCED ? (u >= 1 ? 1 : 0) : sm(clamp((u - I[0] - d * I[1]) / I[2]));
    const dx = A.v && B.v ? B.x - A.x : 0, dy = A.v && B.v ? B.y - A.y : 0;
    const len = Math.hypot(dx, dy) || 1, kk = Math.min(len, 4) / len;
    if (A.v && fo < 1) { out.x = A.x + dx * kk * fo; out.y = A.y + dy * kk * fo; out.w = A.w; out.a = 1 - fo; return true; }
    if (B.v && fi > 0) { out.x = B.x - dx * kk * (1 - fi); out.y = B.y - dy * kk * (1 - fi); out.w = B.w; out.a = fi; return true; }
    return false;
  }
  function delayOf(pg: Page, i: number, u2: number) {
    if (u2 > 0) return clamp(i / pg.nvis);
    const P0 = pg.L[0][i];
    const bx = P0 && P0.c !== undefined ? pg.specBoxes[0][P0.c] : null;
    return bx ? clamp(Math.abs(bx.x + bx.w / 2 - pg.agentX) / pg.W * 1.6) : 0;
  }

  const tmp = { x: 0, y: 0, w: 0, a: 1 };
  function drawPage(pg: Page, u1: number, u2: number, gridA: number) {
    const { barH } = pg;
    const fs = pg.lh * 0.68;
    if (gridA > 0.01) {
      // the grid re-divides: every line moves to its place on 13 columns; the new pair opens from a gutter
      const [e0, e1] = pg.edges;
      const t = u2 > 0 ? 1 : REDUCED ? u1 : ease(clamp(u1 / 0.45));
      ctx.fillStyle = C.ink;
      for (let i = 0; i < e0.length; i++) {
        const isNew = i >= e0.length - 2;
        ctx.globalAlpha = (isNew ? 0.07 + 0.25 * Math.sin(Math.PI * clamp(u1 / 0.5)) * (u2 > 0 ? 0 : 1) : 0.06) * gridA;
        if (isNew && u1 <= 0) continue;
        ctx.fillRect(Math.round(lerp(e0[i], e1[i], t)), 0, 1, pg.H);
      }
      ctx.globalAlpha = 1;
    }
    {
      ctx.fillStyle = C.ink;
      ctx.globalAlpha = 0.34;
      const [a0, a1, a2] = pg.titleBars;
      const k = u2 > 0 ? 1 : 0, t = k ? u2 : u1;
      const A = k ? a1 : a0, B = k ? a2 : a1;
      const n = Math.max(A.length, B.length);
      for (let i = 0; i < n; i++) {
        const a = A[Math.min(i, A.length - 1)], bb = B[Math.min(i, B.length - 1)], e = ease(t);
        ctx.fillRect(lerp(a.x, bb.x, e), lerp(a.y, bb.y, e), lerp(a.w, bb.w, e), lerp(a.h, bb.h, e) * 0.62);
      }
      ctx.globalAlpha = 1;
    }
    const N = pg.stream.length;
    ctx.fillStyle = C.ink;
    let ki = 0;
    const col = pg.col[1];
    for (let i = 0; i < N; i++) {
      const tk = pg.stream[i];
      if (tk.kind === 1) {
        // slice k of the new column is absorbed into the text as inline piece k
        const A = pg.L[2][i];
        const k = ki++;
        const sh = col.h / pg.K, y1 = col.y + k * sh;
        let x: number, y: number, w: number, h: number;
        const ft = REDUCED ? (u2 > 0 ? 1 : 0) : clamp((u2 - FLY[0] - (k / pg.K) * FLY[1]) / FLY[2]);
        if (u2 <= 0 || ft <= 0 || !A || !A.v) {
          // entry: the column opens with the grid and pours down, slice by slice
          const tg = REDUCED ? u1 : ease(clamp(u1 / 0.45));
          const front = REDUCED ? (u1 > 0 ? pg.K : 0) : clamp((u1 - 0.12) / 0.45) * pg.K; const tf = clamp(front - k);
          x = lerp(pg.col[0].x, col.x, tg); w = lerp(0, col.w, tg); y = y1; h = (sh + 0.5) * tf;
          if (u2 > 0 && (!A || !A.v)) w *= 1 - clamp(u2 / 0.4);
        } else {
          const hy = A.y - fs * 0.9, hh = fs * 1.14;
          const sq = sm(clamp(ft / 0.35)); // condenses to a word, then travels
          const tr = sm(clamp((ft - 0.3) / 0.7));
          w = lerp(col.w, A.w + 2, sq); h = lerp(sh + 0.5, hh, sq);
          x = lerp(col.x + (col.w - w) / 2, A.x - 1, tr);
          y = lerp(y1 + (sh - h) / 2, hy, tr);
        }
        if (w > 0.2 && h > 0.2) { ctx.globalAlpha = 1; ctx.fillStyle = C.signal; ctx.fillRect(x, y, w, h + 0.5); ctx.fillStyle = C.ink; }
        continue;
      }
      if (!wordAt(pg, i, u1, u2, delayOf(pg, i, u2), tmp)) continue;
      if (tmp.a < 0.01) continue;
      ctx.globalAlpha = tmp.a * 0.55;
      ctx.fillRect(tmp.x, tmp.y - barH, tmp.w, barH);
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    const u1 = clamp(b), u2 = clamp(b - 1), q = clamp(b - 2);
    const small = W < 520;
    const G = W * 0.06;
    const sf = small ? W / (2.6 * (W + G)) : W / (4.1 * (W + G));
    const z = REDUCED ? q : ease(clamp(q / 0.5));
    const s = lerp(1, sf, z);
    const cx = W / 2, cy = H / 2;
    const cam = { s, tx: cx - cx * s, ty: cy - cy * s };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = z > 0 ? C.ground : C.sheet;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * cam.tx, dpr * cam.ty);
    if (z > 0) {
      const r = REDUCED ? q : clamp((q - 0.12) / 0.88);
      const sx = W + G, sy = H + G;
      const nx = Math.ceil((cx / s) / sx) + 1, ny = Math.ceil((cy / s) / sy) + 1;
      const maxD = Math.hypot(nx * sx, ny * sy);
      for (let j = -ny; j <= ny; j++) for (let i = -nx; i <= nx; i++) {
        const ox = i * sx, oy = j * sy;
        if ((ox + W) * s + cam.tx < 0 || ox * s + cam.tx > W || (oy + H) * s + cam.ty < 0 || oy * s + cam.ty > H) continue;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.fillStyle = C.sheet;
        ctx.fillRect(0, 0, W, H);
        if (i === 0 && j === 0) drawPage(page, u1, u2, 1 - z);
        else {
          const d = Math.hypot(ox, oy) / maxD;
          const lp = REDUCED ? r : clamp((r - d * 0.62) / 0.38);
          drawPage(miniAt(i, j), clamp(lp * 2), clamp(lp * 2 - 1), 0);
        }
        ctx.restore();
      }
    } else drawPage(page, u1, u2, 1);
    // the legend follows the beat
    steps.forEach((el, k) => {
      el.style.setProperty('--fill', String(k === 0 ? 1 : clamp(b - (k - 1))));
      el.setAttribute('aria-pressed', String(k === target));
    });
  }

  function frame(now: number) {
    raf = 0;
    if (b !== target) {
      const e = clamp((now - t0) / dur);
      b = lerp(from, target, e);
      if (e >= 1) b = target;
    }
    draw();
    if (b !== target) req();
  }
  function req() { if (!raf) raf = requestAnimationFrame(frame); }

  /** play from the current beat to beat k (forward at speed, backwards faster) */
  function go(k: number) {
    target = k; from = b; t0 = performance.now();
    if (REDUCED) { b = k; req(); return; }
    let ms = 0;
    const lo = Math.min(from, k), hi = Math.max(from, k);
    for (let s = 0; s < 3; s++) ms += DUR[s] * clamp(Math.min(hi, s + 1) - Math.max(lo, s));
    dur = Math.max(1, k < from ? ms * 0.4 : ms);
    req();
  }
  function stopAuto() { auto.forEach(clearTimeout); auto = []; }
  function play() {
    stopAuto();
    if (REDUCED) { [1, 2, 3].forEach((k, n) => auto.push(window.setTimeout(() => go(k), 1800 * (n + 1)))); return; }
    let at = 700;
    for (let k = 1; k <= 3; k++) { const kk = k; auto.push(window.setTimeout(() => go(kk), at)); at += DUR[k - 1] + 1200; }
  }

  steps.forEach((el, k) => el.addEventListener('click', () => { stopAuto(); played = true; go(k); }));

  let played = false;
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting && !played) { played = true; play(); }
  }, { threshold: 0.55 });

  let lastW = 0;
  const ro = new ResizeObserver(() => {
    const w = Math.round(box.getBoundingClientRect().width);
    if (w === lastW) return;
    lastW = w; build();
  });
  lastW = Math.round(box.getBoundingClientRect().width);
  build();
  ro.observe(box);
  io.observe(box);
  root.classList.add('is-live');
}
