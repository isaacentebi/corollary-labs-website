/*
  The programme (after Gerstner): the home page is one rule set, not one layout.
  A page = a modular grid + a text stream + a title. Three states of the same page:
    S0  the composition as found (12 columns)
    S1  a new column enters: the grid re-divides to 13, every element keeps its column count,
        so everything re-proportions (the title yields width, text columns narrow and re-flow)
    S2  the composition re-organises around it: the title re-breaks into a justified block,
        the column dissolves into the text stream as inline elements, the text re-flows downstream
    S3  the camera pulls back: the page is one sheet in a field of sheets; each one runs the
        same programme when the change reaches it (nearest first).
  Canvas draws only rectangles (greeked text, the signal). The title, statement and links are DOM.
  Rendering is on demand: scroll, pointer and short transitions request frames; nothing idles.
*/

type Rect = { x: number; y: number; w: number; h: number };
type Tok = { id: number; w: number; kind: 0 | 1 | 2; pEnd: boolean; born: number; ox: number; oy: number; at: number; dur: number };
type Pos = { x: number; y: number; w: number; v: number } | null;
type Grid = { cols: number; colW: number; x: (i: number) => number; span: (n: number) => number };
type Letter = { x: number; y: number; s: number; wd: number; wt: number; v: number };
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
  titleBars?: [Bar[], Bar[], Bar[]];
  // origin page only
  letters?: [Letter[], Letter[], Letter[]];
  lead?: [Rect, Rect, Rect];
  nav?: [{ x: number; y: number }[], { x: number; y: number }[], { x: number; y: number }[]];
  specBoxes: [Rect[], Rect[], Rect[]];
}

const TITLE = 'Corollary Labs';
const SPACE_AT = 9;
const WDS = [62, 75, 87.5, 100, 112.5, 125];
const WTS = [300, 500, 700, 900];

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const seg = (u: number, start: number, len: number) => ease(clamp((u - start) / len));
/** grid-bound motion: travel along the row first, then drop to the new line */
const sm = (t: number) => t * t * (3 - 2 * t);
const pathX = (t: number) => sm(clamp(t / 0.62));
const pathY = (t: number) => sm(clamp((t - 0.38) / 0.62));

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

/* ---------------- title metrics (measured once from the real font) ---------------- */
let P: number[][][] = []; // P[wdi][wti][k] = advance of TITLE.slice(0,k) at 100px
let BASE = 0.9, CAP = 0.7;
function measureTitle() {
  const box = document.createElement('div');
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;font-family:Archivo;font-size:100px;line-height:1;white-space:pre;';
  const spans: HTMLSpanElement[] = [];
  for (const wd of WDS) for (const wt of WTS) for (let k = 1; k <= TITLE.length; k++) {
    const s = document.createElement('span');
    s.textContent = TITLE.slice(0, k);
    s.style.cssText = `position:absolute;left:0;top:0;font-variation-settings:'wdth' ${wd},'wght' ${wt};`;
    box.appendChild(s); spans.push(s);
  }
  const b = document.createElement('div');
  b.style.cssText = 'position:absolute;left:0;top:0;';
  b.innerHTML = 'H<i style="display:inline-block;width:0;height:0"></i>';
  box.appendChild(b);
  document.body.appendChild(box);
  let n = 0;
  P = WDS.map(() => WTS.map(() => { const row = [0]; for (let k = 1; k <= TITLE.length; k++) row.push(spans[n++].getBoundingClientRect().width); return row; }));
  BASE = (b.querySelector('i') as HTMLElement).offsetTop / 100;
  box.remove();
  const c = document.createElement('canvas').getContext('2d')!;
  c.font = '700 100px Archivo';
  const m = c.measureText('H');
  if (m.actualBoundingBoxAscent > 40) CAP = m.actualBoundingBoxAscent / 100;
}
function axisIdx(arr: number[], v: number) {
  let i = 0; while (i < arr.length - 2 && v > arr[i + 1]) i++;
  return [i, clamp((v - arr[i]) / (arr[i + 1] - arr[i]))] as const;
}
function adv(k: number, wd: number, wt: number) {
  const [i, a] = axisIdx(WDS, wd), [j, b] = axisIdx(WTS, wt);
  const p00 = P[i][j][k], p10 = P[i + 1][j][k], p01 = P[i][j + 1][k], p11 = P[i + 1][j + 1][k];
  return lerp(lerp(p00, p10, a), lerp(p01, p11, a), b);
}
const lineW = (a: number, b: number, wd: number, wt: number) => adv(b, wd, wt) - adv(a, wd, wt);
function solveWd(a: number, b: number, size: number, wt: number, measure: number) {
  let lo = 62, hi = 125;
  for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if ((lineW(a, b, m, wt) * size) / 100 > measure) hi = m; else lo = m; }
  return (lo + hi) / 2;
}
type TLine = { a: number; b: number; x: number; base: number; size: number; wd: number; wt: number };
function lettersOf(lines: TLine[]): Letter[] {
  const out: Letter[] = [];
  for (let i = 0; i < TITLE.length; i++) out.push({ x: 0, y: 0, s: 0, wd: 100, wt: 700, v: 0 });
  for (const L of lines) for (let i = L.a; i < L.b; i++) {
    out[i] = { x: L.x + ((adv(i, L.wd, L.wt) - adv(L.a, L.wd, L.wt)) * L.size) / 100, y: L.base, s: L.size, wd: L.wd, wt: L.wt, v: i === SPACE_AT ? 0 : 1 };
  }
  // a letter absent from every line (never happens) stays hidden; the space rides with its neighbour
  for (let i = 0; i < out.length; i++) if (!out[i].s) out[i] = { ...out[i - 1], v: 0 };
  return out;
}

/* ---------------- text stream and flow ---------------- */
const CHARS = [1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 8, 8, 9, 10, 11, 12];
function makeStream(n: number, fs: number, seed: number): Tok[] {
  const r = rng(seed);
  const out: Tok[] = [];
  let para = 30 + Math.floor(r() * 50);
  for (let i = 0; i < n; i++) {
    const c = CHARS[Math.floor(r() * CHARS.length)];
    const end = --para <= 0;
    if (end) para = 34 + Math.floor(r() * 56);
    out.push({ id: i, w: c * fs * 0.52, kind: 0, pEnd: end, born: 0, ox: 0, oy: 0, at: 0, dur: 0 });
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
    pos[i] = { x, y, w: t.w, v: 1 }; nvis = i + 1;
    lastX = x; lastY = y; x += t.w + sp; has = true;
    if (t.pEnd) { nl(); if (b && y !== first(b)) nl(); }
  }
  return { pos, nvis };
}

/* ---------------- page builder ---------------- */
interface Layout {
  W: number; H: number; top: number; lh: number; fs: number; nWords: number; seed: number; K: number;
  G0: Grid; G1: Grid; A: number;
  boxes: [Rect[], Rect[], Rect[]];
  col: Rect; // agent column in S1
}
function buildPage(Lo: Layout, keep?: Tok[]): Page {
  const { lh, fs, K } = Lo;
  const sp = fs * 0.3;
  let stream = keep ? keep.filter((t) => t.kind !== 1) : makeStream(Lo.nWords, fs, Lo.seed);
  // place the K inline elements evenly through the text that S2 can hold
  const probe = flow(stream, Lo.boxes[2], lh, sp, Lo.top, () => true);
  const r = rng(Lo.seed + 7);
  const slots: number[] = [];
  for (let k = 0; k < K; k++) slots.push(Math.floor(((k + 0.35 + r() * 0.3) / K) * probe.nvis * 0.92));
  const next: Tok[] = [];
  let k = 0, uid = 100000 + Lo.seed * 100;
  stream.forEach((t, i) => {
    while (k < K && slots[k] === i) { next.push({ id: uid++, w: (3 + Math.floor(r() * 6)) * fs * 0.52, kind: 1, pEnd: false, born: 0, ox: 0, oy: 0, at: 0, dur: 0 }); k++; }
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
    edges: [e0, e1], agentX: gap, specBoxes: Lo.boxes,
  };
}

/* ---------------- the origin page (the home composition) ---------------- */
function originLayout(W: number, H: number, leadH: (w: number) => number) {
  const mobile = W < 820;
  const mx = mobile ? 16 : clamp(W * 0.0278, 24, 56);
  const g = mobile ? 12 : 20;
  const top = mobile ? 16 : mx;
  const lh = mobile ? 14 : 16;
  const fs = mobile ? 10 : 11;
  const snap = (y: number) => top + Math.ceil((y - top) / lh) * lh;
  const bottom = H - (mobile ? 20 : mx);
  const G0 = makeGrid(W, mobile ? 6 : 12, mx, g), G1 = makeGrid(W, mobile ? 7 : 13, mx, g);
  const A = mobile ? 3 : 4;
  const map = (i: number) => (i < A ? i : i + 1);
  const T: [TLine[], TLine[], TLine[]] = [[], [], []];
  const lead: [Rect, Rect, Rect] = [] as any, nav: any = [[], [], []];
  const boxes: [Rect[], Rect[], Rect[]] = [[], [], []];
  const navItems = 4, navLh = mobile ? 17 : 19;
  let col: Rect;

  if (!mobile) {
    // S0: name on one line across 9 columns; statement in 4; two text columns of 4; links in the last column
    const wt0 = 760;
    const m0 = G0.span(9), size0 = Math.min((m0 / lineW(0, 14, 100, wt0)) * 100, H * 0.2);
    const base0 = top + CAP * size0;
    T[0] = [{ a: 0, b: 14, x: G0.x(0), base: base0, size: size0, wd: 100, wt: wt0 }];
    const bodyTop = snap(Math.max(base0 + size0 * 0.26 + lh * 3, H * 0.34));
    lead[0] = { x: G0.x(0), y: bodyTop - 4, w: G0.span(4), h: 0 };
    boxes[0] = [{ x: G0.x(4), y: bodyTop, w: G0.span(4), h: bottom - bodyTop }, { x: G0.x(8), y: bodyTop, w: G0.span(4), h: bottom - bodyTop }];
    nav[0] = Array.from({ length: navItems }, (_, k) => ({ x: G0.x(11), y: top - 3 + k * navLh }));
    // S1: same column counts on the 13-column grid; the name keeps its size and yields width
    const m1 = G1.span(9);
    T[1] = [{ a: 0, b: 14, x: G1.x(0), base: base0, size: size0, wd: solveWd(0, 14, size0, wt0, m1), wt: wt0 }];
    lead[1] = { x: G1.x(0), y: bodyTop - 4, w: G1.span(4), h: 0 };
    boxes[1] = [{ x: G1.x(map(4)), y: bodyTop, w: G1.span(4), h: bottom - bodyTop }, { x: G1.x(map(8)), y: bodyTop, w: G1.span(4), h: bottom - bodyTop }];
    nav[1] = nav[0].map((n: any) => ({ x: G1.x(12), y: n.y }));
    col = { x: G1.x(A), y: bodyTop - 4, w: G1.colW, h: bottom - bodyTop + 4 };
    // S2: re-organised. The name re-breaks into a justified block over 7 columns;
    // the statement moves up beside it; the text re-flows into three columns.
    const wt2 = 820, m2 = G1.span(7);
    const size2a = Math.min((m2 / lineW(0, 9, 100, wt2)) * 100, H * 0.2);
    const base2a = top + CAP * size2a;
    const size2b = Math.min(size2a * 1.55, H * 0.3);
    const wd2b = solveWd(10, 14, size2b, wt2, m2);
    const base2b = base2a + size2a * 0.2 + CAP * size2b + size2a * 0.12;
    T[2] = [
      { a: 0, b: 9, x: G1.x(0), base: base2a, size: size2a, wd: 100, wt: wt2 },
      { a: 10, b: 14, x: G1.x(0), base: base2b, size: size2b, wd: wd2b, wt: wt2 },
    ];
    lead[2] = { x: G1.x(8), y: top - 4, w: G1.span(4), h: 0 };
    const top2 = snap(Math.max(base2b + lh * 2, H * 0.34));
    const pad = lh * 0;
    boxes[2] = [
      { x: G1.x(0), y: top2 + pad, w: G1.span(4), h: bottom - top2 - pad },
      { x: G1.x(4), y: top2 + pad, w: G1.span(4), h: bottom - top2 - pad },
      { x: G1.x(8), y: snap(top + leadH(G1.span(4)) + lh * 2), w: G1.span(4), h: 0 },
    ];
    boxes[2][2].h = bottom - boxes[2][2].y;
    nav[2] = nav[1];
  } else {
    // phones: the name in two lines across all 6 columns; links beside "Labs"; text in 2 columns
    const wt0 = 760;
    const m0 = G0.span(6), size0 = (m0 / lineW(0, 9, 100, wt0)) * 100;
    const b1 = top + CAP * size0 + 4, b2 = b1 + size0 * 0.9;
    T[0] = [
      { a: 0, b: 9, x: G0.x(0), base: b1, size: size0, wd: 100, wt: wt0 },
      { a: 10, b: 14, x: G0.x(0), base: b2, size: size0, wd: 100, wt: wt0 },
    ];
    nav[0] = Array.from({ length: navItems }, (_, k) => ({ x: G0.x(4), y: b2 - CAP * size0 - 4 + k * navLh }));
    const leadY = snap(b2 + lh * 2);
    lead[0] = { x: G0.x(0), y: leadY - 3, w: G0.span(6), h: 0 };
    const bodyTop = snap(leadY + leadH(G0.span(6)) + lh * 2);
    boxes[0] = [{ x: G0.x(0), y: bodyTop, w: G0.span(3), h: bottom - bodyTop }, { x: G0.x(3), y: bodyTop, w: G0.span(3), h: bottom - bodyTop }];
    const m1 = G1.span(6);
    T[1] = T[0].map((L) => ({ ...L, x: G1.x(0), wd: solveWd(0, 9, size0, wt0, m1) }));
    nav[1] = nav[0].map((n: any) => ({ x: G1.x(5), y: n.y }));
    lead[1] = { x: G1.x(0), y: leadY - 3, w: G1.span(6), h: 0 };
    const bodyTop1 = snap(leadY + leadH(G1.span(6)) + lh * 2);
    boxes[1] = [{ x: G1.x(0), y: bodyTop1, w: G1.span(3), h: bottom - bodyTop1 }, { x: G1.x(4), y: bodyTop1, w: G1.span(3), h: bottom - bodyTop1 }];
    col = { x: G1.x(A), y: bodyTop1 - 3, w: G1.colW, h: bottom - bodyTop1 + 3 };
    // S2: justified block over 7 columns ("Labs" widens to the measure), text in 5 + 2 columns
    const wt2 = 820, m2 = G1.span(7);
    const s2a = (m2 / lineW(0, 9, 100, wt2)) * 100;
    const s2b = Math.min((m2 / lineW(10, 14, 116, wt2)) * 100, H * 0.16);
    const c1 = top + CAP * s2a + 4, c2 = c1 + s2a * 0.14 + CAP * s2b + s2a * 0.12;
    T[2] = [
      { a: 0, b: 9, x: G1.x(0), base: c1, size: s2a, wd: 100, wt: wt2 },
      { a: 10, b: 14, x: G1.x(0), base: c2, size: s2b, wd: solveWd(10, 14, s2b, wt2, m2), wt: wt2 },
    ];
    const navY = snap(c2 + lh * 1.5);
    nav[2] = [0, 2, 4, 6].map((c, k) => ({ x: G1.x(c) - (k === 3 ? G1.colW * 0.9 : 0), y: navY - 12 }));
    const leadY2 = snap(navY + lh * 1.5);
    lead[2] = { x: G1.x(0), y: leadY2 - 3, w: G1.span(5), h: 0 };
    const body2 = snap(leadY2 + leadH(G1.span(5)) + lh * 2);
    boxes[2] = [{ x: G1.x(0), y: body2, w: G1.span(5), h: bottom - body2 }, { x: G1.x(5), y: snap(leadY2), w: G1.span(2), h: bottom - snap(leadY2) }];
  }
  const Lo: Layout = { W, H, top, lh, fs, nWords: mobile ? 560 : 1150, seed: 11, K: mobile ? 9 : 14, G0, G1, A, boxes, col: col! };
  return { Lo, T, lead, nav };
}

/* ---------------- sheets in the field (S3) ---------------- */
function miniLayout(W: number, H: number, seed: number): Layout & { tb: [Bar[], Bar[], Bar[]] } {
  const r = rng(seed * 977 + 13);
  const mobile = W < 820;
  const mx = mobile ? 16 : clamp(W * 0.0278, 24, 56), g = mobile ? 12 : 20, top = mx;
  const lh = mobile ? 20 : 22, fs = mobile ? 14 : 15;
  const bottom = H - mx;
  const n0 = mobile ? 6 : 12;
  const G0 = makeGrid(W, n0, mx, g), G1 = makeGrid(W, n0 + 1, mx, g);
  const A = 1 + Math.floor(r() * (n0 - 2));
  const map = (i: number) => (i < A ? i : i + 1);
  // title as heavy bars (the way grid-system plates greek a headline)
  const words = 1 + Math.floor(r() * 3);
  const wl = Array.from({ length: words }, () => 3 + Math.floor(r() * 8));
  const tCols = mobile ? n0 : 5 + Math.floor(r() * 5);
  const capH = mobile ? H * 0.045 : H * (0.07 + r() * 0.05);
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
  const lines0 = words > 1 && r() > 0.5 ? 2 : 1;
  const fill0 = lines0 === 1 ? 1 : 0.7 + r() * 0.3;
  const tb0 = titleBars(G0, tCols, lines0, fill0, 1);
  // S1 keeps the title's column count on the finer grid
  const tb1 = titleBars(G1, tCols, lines0, fill0, 1);
  const lines2 = lines0 === 1 && words > 1 ? 2 : 1;
  const tb2 = titleBars(G1, Math.min(n0 + 1, tCols + 1 + Math.floor(r() * 2)), lines2, 1, lines2 === 2 ? 1.1 : 1.25);
  const tBottom = (tb: Bar[]) => Math.max(...tb.map((b) => b.y + b.h));
  const snap = (y: number) => top + Math.ceil((y - top) / lh) * lh;
  const bt0 = snap(tBottom(tb0) + lh * 3), bt2 = snap(tBottom(tb2) + lh * 3);
  // body: 2 or 3 columns in S0, re-divided in S2
  const nb = mobile ? 2 : 2 + Math.floor(r() * 2);
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
    W, H, top, lh, fs, nWords: mobile ? 260 : 380, seed, K: 5 + Math.floor(r() * 5), G0, G1, A,
    boxes: [b0, b1, b2], col: { x: G1.x(A), y: bt0, w: G1.colW, h: bottom - bt0 }, tb: [tb0, tb1, tb2],
  };
}

/* ---------------- the stage ---------------- */
export function mountProgramme(root: HTMLElement) {
  const story = root;
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const layer = root.querySelector<HTMLElement>('[data-layer]')!;
  const titleEl = root.querySelector<HTMLElement>('[data-title]')!;
  const leadEl = root.querySelector<HTMLElement>('[data-lead]')!;
  const navEls = [...root.querySelectorAll<HTMLElement>('[data-navitem]')];
  const ctx = canvas.getContext('2d')!;
  const css = getComputedStyle(document.documentElement);
  const C = {
    sheet: css.getPropertyValue('--sheet').trim() || '#ecece8',
    ground: css.getPropertyValue('--ground').trim() || '#d9d9d4',
    ink: css.getPropertyValue('--ink').trim() || '#0e0e0d',
    signal: css.getPropertyValue('--signal').trim() || '#ffc800',
  };
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // letters
  titleEl.textContent = '';
  const letterEls = [...TITLE].map((ch) => {
    const s = document.createElement('span');
    s.className = 'st-ch'; s.textContent = ch === ' ' ? ' ' : ch; s.setAttribute('aria-hidden', 'true');
    titleEl.appendChild(s); return s;
  });

  let W = 0, H = 0, dpr = 1;
  let page!: Page;
  let minis = new Map<string, Page>();
  let T: [TLine[], TLine[], TLine[]];
  let leadR: [Rect, Rect, Rect];
  let navR: any;
  let p = 0;
  let raf = 0;
  let intro = REDUCED ? -1 : performance.now();
  let hover: { x: number; y: number; idx: number } | null = null;
  let inserted = 0;
  const shown = new Map<number, { x: number; y: number }>();

  const leadHeight = (w: number) => { leadEl.style.width = w + 'px'; return leadEl.offsetHeight; };

  function build(keepStream = false) {
    const r = stage.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const o = originLayout(W, H, leadHeight);
    T = o.T; leadR = o.lead; navR = o.nav;
    const prev = keepStream && page ? page.stream : undefined;
    page = buildPage(o.Lo, prev);
    page.letters = [lettersOf(T[0]), lettersOf(T[1]), lettersOf(T[2])];
    minis = new Map();
    req();
  }

  function miniAt(i: number, j: number) {
    const key = i + ',' + j;
    let m = minis.get(key);
    if (!m) {
      const Lo = miniLayout(W, H, 1 + ((i * 73856093) ^ (j * 19349663)) % 99991 + 100000);
      m = buildPage(Lo);
      m.titleBars = Lo.tb;
      minis.set(key, m);
    }
    return m;
  }

  /* ---------- timeline ---------- */
  function phases() {
    let u1 = clamp((p - 0.04) / 0.28), u2 = clamp((p - 0.36) / 0.28), q = clamp((p - 0.66) / 0.34);
    if (REDUCED) {
      const s = p < 0.18 ? 0 : p < 0.46 ? 1 : p < 0.74 ? 2 : 3;
      u1 = s >= 1 ? 1 : 0; u2 = s >= 2 ? 1 : 0; q = s >= 3 ? 1 : 0;
    }
    return { u1, u2, q };
  }

  /* local progress of one element: spatial delay for S0→S1, reading-order delay for S1→S2 */
  const SPREAD = 0.5;
  function stageT(u1: number, u2: number, d1: number, d2: number) {
    if (REDUCED) return u2 > 0 ? 1 + u2 : u1;
    if (u2 > 0) return 1 + seg(u2, d2 * SPREAD, 1 - SPREAD);
    return seg(u1, d1 * SPREAD, 1 - SPREAD);
  }

  function posAt(pg: Page, i: number, st: number, out: { x: number; y: number; w: number; a: number }) {
    const k = st <= 1 ? 0 : 1, t = st <= 1 ? st : st - 1;
    const A = pg.L[k][i], B = pg.L[k + 1][i];
    if (!A && !B) return false;
    if (A && B) {
      if (A.v && B.v) { out.x = lerp(A.x, B.x, pathX(t)); out.y = lerp(A.y, B.y, pathY(t)); out.w = lerp(A.w, B.w, t); out.a = 1; }
      else if (A.v) { out.x = A.x; out.y = A.y; out.w = A.w; out.a = 1 - t; }
      else if (B.v) { out.x = B.x; out.y = B.y; out.w = B.w; out.a = t; }
      else return false;
      return true;
    }
    return false;
  }

  /* ---------- drawing ---------- */
  const tmp = { x: 0, y: 0, w: 0, a: 1 };
  function drawPage(pg: Page, u1: number, u2: number, now: number, origin: boolean, gridA: number): boolean {
    let busy = false;
    const { lh, barH } = pg;
    // grid hairlines
    if (gridA > 0.01) {
      ctx.fillStyle = C.ink;
      ctx.globalAlpha = 0.075 * gridA;
      const [e0, e1] = pg.edges;
      for (let i = 0; i < e0.length; i++) {
        const d = Math.abs(e0[i] - pg.agentX) / pg.W;
        const t = u2 > 0 ? 1 : REDUCED ? u1 : seg(u1, d * SPREAD, 1 - SPREAD);
        ctx.fillRect(Math.round(lerp(e0[i], e1[i], t)), 0, 1, pg.H);
      }
      ctx.globalAlpha = 1;
    }
    // title bars (sheets in the field)
    if (pg.titleBars) {
      ctx.fillStyle = C.ink;
      const [a0, a1, a2] = pg.titleBars;
      const st = stageT(u1, u2, 0, 0);
      const A = st <= 1 ? a0 : a1, B = st <= 1 ? a1 : a2, t = st <= 1 ? st : st - 1;
      const n = Math.max(A.length, B.length);
      for (let i = 0; i < n; i++) {
        const a = A[Math.min(i, A.length - 1)], b = B[Math.min(i, B.length - 1)];
        ctx.fillRect(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.w, b.w, t), lerp(a.h, b.h, t));
      }
    }
    // text
    const N = pg.stream.length;
    const introOn = origin && intro > 0;
    ctx.fillStyle = C.ink;
    const agentsIn: { x: number; y: number; w: number; t: number }[] = [];
    let ki = 0;
    for (let i = 0; i < N; i++) {
      const tk = pg.stream[i];
      if (tk.kind === 1) {
        // the new column's slice k becomes inline element k
        const A = pg.L[2][i];
        const k = ki++;
        const x1 = pg.col[1].x, w1 = pg.col[1].w, sh = pg.col[1].h / pg.K, y1 = pg.col[1].y + k * sh;
        const x0 = pg.col[0].x;
        let x: number, y: number, w: number, h: number, inl = 0;
        if (u2 <= 0 || !A || !A.v) {
          // the column opens with the grid, and fills from the top, slice by slice
          const tg = REDUCED ? u1 : seg(u1, 0, 1 - SPREAD);
          const front = REDUCED ? pg.K : clamp((u1 - 0.18) / 0.62) * pg.K; const tf = clamp(front - k);
          x = lerp(x0, x1, tg); w = lerp(0, w1, tg); y = y1; h = (sh + 0.5) * tf;
          if (u2 > 0 && A && !A.v) { const f = 1 - u2; w *= f; }
        } else {
          const d2 = i / pg.nvis;
          const t = REDUCED ? 1 : seg(u2, clamp(d2) * SPREAD, 1 - SPREAD);
          const hy = A.y - lh * 0.74, hh = lh * 0.92;
          x = lerp(x1, A.x - 2, t); y = lerp(y1, hy, t); w = lerp(w1, A.w + 4, t); h = lerp(sh + 0.5, hh, t); inl = t;
          if (inl > 0) agentsIn.push({ x: A.x, y: A.y, w: A.w, t: inl });
        }
        if (w > 0.2) { ctx.fillStyle = C.signal; ctx.fillRect(x, y, w, h); ctx.fillStyle = C.ink; }
        continue;
      }
      const P0 = pg.L[0][i];
      const d1 = P0 ? Math.abs(P0.x + P0.w / 2 - pg.agentX) / pg.W : 0;
      const d2 = clamp(i / pg.nvis);
      const st = stageT(u1, u2, d1, d2);
      if (!posAt(pg, i, st, tmp)) continue;
      let a = tmp.a, w = tmp.w, x = tmp.x, y = tmp.y;
      if (tk.at) {
        const e = (now - tk.at) / tk.dur;
        if (e < 1) { const f = 1 - easeOut(clamp(e)); x += tk.ox * f; y += tk.oy * f; busy = true; }
        else tk.at = 0;
      }
      if (tk.born) {
        const e = (now - tk.born) / 420;
        if (e < 1) { w *= easeOut(clamp(e)); busy = true; } else tk.born = 0;
      }
      if (introOn) {
        const e = (now - intro - 250 - i * 1.1) / 260;
        if (e < 1) { busy = true; if (e <= 0) continue; a *= clamp(e); w *= easeOut(clamp(e)); }
      }
      if (origin) shown.set(tk.id, { x, y });
      if (a < 0.01 || w < 0.2) continue;
      if (tk.kind === 2) {
        ctx.fillStyle = C.signal; ctx.globalAlpha = a;
        ctx.fillRect(x - 2, y - lh * 0.74, w + 4, lh * 0.92);
        ctx.fillStyle = C.ink;
      }
      ctx.globalAlpha = a * (tk.kind === 2 ? 1 : 0.62);
      ctx.fillRect(x, y - barH, w, barH);
      ctx.globalAlpha = 1;
    }
    // ink inside the inline elements, once they have arrived
    for (const g of agentsIn) {
      ctx.globalAlpha = clamp((g.t - 0.6) / 0.4);
      ctx.fillRect(g.x, g.y - barH, g.w, barH);
    }
    ctx.globalAlpha = 1;
    return busy;
  }

  function placeDom(u1: number, u2: number, now: number, cam: { s: number; tx: number; ty: number }) {
    layer.style.transform = cam.s === 1 ? '' : `translate3d(${cam.tx}px,${cam.ty}px,0) scale(${cam.s})`;
    let busy = false;
    const Ls = page.letters!;
    for (let i = 0; i < letterEls.length; i++) {
      const L0 = Ls[0][i];
      const d1 = Math.abs(L0.x - page.agentX) / W;
      const d2 = ((TITLE.length - 1 - i) / TITLE.length) * 0.5; // "Labs" drops first
      const st = stageT(u1, u2, d1, d2);
      const k = st <= 1 ? 0 : 1, t = st <= 1 ? st : st - 1;
      const A = Ls[k][i], B = Ls[k + 1][i];
      let wd = lerp(A.wd, B.wd, t), wt = lerp(A.wt, B.wt, t);
      const s = lerp(A.s, B.s, t) / 100, x = lerp(A.x, B.x, t), y = lerp(A.y, B.y, t);
      let op = 1;
      if (intro > 0) {
        const e = clamp((now - intro - i * 45) / 900);
        if (e < 1) busy = true;
        const f = easeOut(e);
        wd = lerp(125, wd, f); wt = lerp(250, wt, f); op = clamp(e * 3);
      }
      const el = letterEls[i];
      el.style.transform = `translate3d(${x.toFixed(2)}px,${(y - BASE * s * 100).toFixed(2)}px,0) scale(${s.toFixed(4)})`;
      el.style.fontVariationSettings = `'wdth' ${wd.toFixed(2)}, 'wght' ${wt.toFixed(1)}`;
      el.style.opacity = String(op);
    }
    // statement and links: interpolate their boxes; the browser re-flows the statement's lines
    // S0→S1 they slide with the grid; S1→S2 they are re-set in their new place (out, then in),
    // so they never cross the title as it re-breaks
    const place = (el: HTMLElement, A: Rect | { x: number; y: number }, B: Rect | { x: number; y: number }, t: number, reset: boolean, fade: number) => {
      let x: number, y: number, o = 1, w = 'w' in A ? A.w : 0;
      if (reset && (Math.abs(A.x - B.x) + Math.abs(A.y - B.y) > 2)) {
        const side = t < 0.5 ? A : B;
        x = side.x; y = side.y; if ('w' in side) w = side.w;
        o = t < 0.5 ? 1 - clamp(t / 0.35) : clamp((t - 0.65) / 0.35);
      } else {
        x = lerp(A.x, B.x, t); y = lerp(A.y, B.y, t); if ('w' in A && 'w' in B) w = lerp(A.w, B.w, t);
      }
      if (w) el.style.width = w.toFixed(1) + 'px';
      el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;
      el.style.opacity = String(o * fade);
    };
    const fade = intro > 0 ? clamp((now - intro - 500) / 700) : 1;
    if (fade < 1) busy = true;
    const lt = stageT(u1, u2, Math.abs(leadR[0].x + leadR[0].w / 2 - page.agentX) / W, 0.3);
    const lk = lt <= 1 ? 0 : 1;
    place(leadEl, leadR[lk], leadR[lk + 1], lt <= 1 ? lt : lt - 1, lk === 1, fade);
    navEls.forEach((el, k) => {
      const nt = stageT(u1, u2, Math.abs(navR[0][k].x - page.agentX) / W, 0.1 + k * 0.05);
      const nk = nt <= 1 ? 0 : 1;
      place(el, navR[nk][k], navR[nk + 1][k], nt <= 1 ? nt : nt - 1, nk === 1, fade);
    });
    return busy;
  }

  function draw(now: number) {
    const { u1, u2, q } = phases();
    const mobile = W < 820;
    const G = W * 0.06;
    const sf = mobile ? W / (2.35 * (W + G)) : W / (4.1 * (W + G));
    const z = REDUCED ? q : ease(clamp(q / 0.5));
    const s = lerp(1, sf, z);
    const cx = W / 2, cy = H / 2;
    const cam = { s, tx: cx - cx * s, ty: cy - cy * s };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = z > 0 ? C.ground : C.sheet;
    ctx.fillRect(0, 0, W, H);
    let busy = false;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * cam.tx, dpr * cam.ty);
    if (z > 0) {
      // the field of sheets, each running the same programme when the change reaches it
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
        if (i === 0 && j === 0) { busy = drawPage(page, u1, u2, now, true, 1 - z) || busy; ctx.restore(); continue; }
        const d = Math.hypot(ox, oy) / maxD;
        const lp = REDUCED ? r : clamp((r - d * 0.62) / 0.38);
        const m = miniAt(i, j);
        drawPage(m, clamp(lp * 2), clamp(lp * 2 - 1), now, false, 0);
        ctx.restore();
      }
    } else {
      busy = drawPage(page, u1, u2, now, true, 1) || busy;
    }
    // the insertion caret (hero only)
    if (hover && z === 0 && u1 === 0) {
      ctx.fillStyle = C.ink;
      ctx.fillRect(hover.x - 1, hover.y - page.lh * 0.8, 2, page.lh);
      ctx.fillStyle = C.signal;
      ctx.fillRect(hover.x - 4, hover.y - page.lh * 0.8 - 5, 7, 5);
    }
    busy = placeDom(u1, u2, now, cam) || busy;
    if (intro > 0 && now - intro > 2400) intro = 0;
    return busy || intro > 0;
  }

  function frame(now: number) { raf = 0; if (draw(now)) req(); }
  function req() { if (!raf) raf = requestAnimationFrame(frame); }

  /* ---------- scroll ---------- */
  function onScroll() {
    const r = story.getBoundingClientRect();
    const span = r.height - H;
    const np = span > 0 ? clamp(-r.top / span) : 0;
    if (np !== p) { p = np; if (p > 0.02) hover = null; req(); }
  }

  /* ---------- a visitor inserts an element: the text downstream re-flows ---------- */
  function locate(mx: number, my: number) {
    const { u1 } = phases();
    if (u1 > 0 || p > 0.03) return null;
    const lh = page.lh;
    let best = -1, bx = 0, by = 0, bd = 1e9;
    const L0 = page.L[0];
    for (let i = 0; i < page.stream.length; i++) {
      const P0 = L0[i];
      if (!P0 || !P0.v) continue;
      if (Math.abs(P0.y - lh * 0.3 - my) > lh * 0.55) continue;
      const dl = Math.abs(P0.x - mx), dr = Math.abs(P0.x + P0.w - mx);
      if (dl < bd) { bd = dl; best = i; bx = P0.x - page.sp / 2; by = P0.y; }
      if (dr < bd) { bd = dr; best = i + 1; bx = P0.x + P0.w + page.sp / 2; by = P0.y; }
    }
    if (best < 0 || bd > 40) return null;
    return { x: bx, y: by, idx: best };
  }
  function insertAt(idx: number) {
    if (inserted >= 24) return;
    inserted++;
    const now = performance.now();
    const old = new Map(shown);
    const fs = W < 820 ? 10 : 11;
    const tok: Tok = { id: 500000 + inserted, w: (3 + Math.floor(Math.random() * 5)) * fs * 0.52, kind: 2, pEnd: false, born: REDUCED ? 0 : now, ox: 0, oy: 0, at: 0, dur: 0 };
    page.stream.splice(idx, 0, tok);
    const leadKeep = page.letters;
    const o = originLayout(W, H, leadHeight);
    page = buildPage(o.Lo, page.stream);
    page.letters = leadKeep;
    if (!REDUCED) {
      const { u1, u2 } = phases();
      const newIdx = page.stream.indexOf(tok);
      page.stream.forEach((t, i) => {
        const was = old.get(t.id);
        if (!was || t === tok) return;
        const st = stageT(u1, u2, 0, 0);
        if (!posAt(page, i, st, tmp)) return;
        const dx = was.x - tmp.x, dy = was.y - tmp.y;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        t.ox = dx; t.oy = dy; t.dur = 620;
        // the re-flow travels downstream from the insertion point
        t.at = now + Math.min(420, Math.max(0, i - newIdx) * 1.6);
      });
    }
    req();
  }

  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = stage.getBoundingClientRect();
    const h = locate(e.clientX - r.left, e.clientY - r.top);
    const changed = (h?.idx ?? -1) !== (hover?.idx ?? -1) || (h && hover && (h.x !== hover.x || h.y !== hover.y));
    hover = h;
    stage.style.cursor = h ? 'text' : '';
    if (changed) req();
  });
  stage.addEventListener('pointerleave', () => { if (hover) { hover = null; req(); } });
  stage.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) return;
    const r = stage.getBoundingClientRect();
    const h = locate(e.clientX - r.left, e.clientY - r.top);
    if (h) { insertAt(h.idx); hover = null; }
  });

  let lastW = 0, lastH = 0;
  const ro = new ResizeObserver(() => {
    const r = stage.getBoundingClientRect();
    if (Math.round(r.width) === lastW && Math.abs(r.height - lastH) < 120) return;
    lastW = Math.round(r.width); lastH = r.height;
    build(true); onScroll();
  });
  window.addEventListener('scroll', onScroll, { passive: true });

  measureTitle();
  lastW = Math.round(stage.getBoundingClientRect().width); lastH = stage.getBoundingClientRect().height;
  build();
  ro.observe(stage);
  onScroll();
  root.classList.add('is-live');
}
