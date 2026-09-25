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
type Tok = { id: number; s?: string; w: number; w0?: number; kind: 0 | 1 | 2; pEnd: boolean; born: number; ox: number; oy: number; at: number; dur: number };
type Pos = { x: number; y: number; w: number; v: number; c?: number } | null;
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
let BASE = 0.9, CAP = 0.7, ASC = 0.74;
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
  const l = c.measureText('l');
  ASC = Math.max(CAP, l.actualBoundingBoxAscent / 100);
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
// the text columns carry running prose (the essays' placeholder Latin until real excerpts exist)
const PROSE = ('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ' +
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. ' +
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. ' +
  'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. ' +
  'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. ' +
  'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. ' +
  'Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. ' +
  'Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur. ' +
  'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident. ' +
  'Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. ' +
  'Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. ' +
  'Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae.').split(' ');
function makeStream(n: number, fs: number, seed: number, measure?: (s: string) => number): Tok[] {
  const r = rng(seed);
  const out: Tok[] = [];
  let para = 30 + Math.floor(r() * 50);
  let wi = Math.floor(r() * 40);
  for (let i = 0; i < n; i++) {
    if (measure) {
      const s = PROSE[wi++ % PROSE.length];
      // paragraphs end on a full stop, after 40–90 words
      const end = --para <= 0 && s.endsWith('.');
      if (end) para = 40 + Math.floor(r() * 50);
      out.push({ id: i, s, w: measure(s), kind: 0, pEnd: end, born: 0, ox: 0, oy: 0, at: 0, dur: 0 });
    } else {
      const end = --para <= 0;
      if (end) para = 34 + Math.floor(r() * 56);
      const c = CHARS[Math.floor(r() * CHARS.length)];
      out.push({ id: i, w: c * fs * 0.52, kind: 0, pEnd: end, born: 0, ox: 0, oy: 0, at: 0, dur: 0 });
    }
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

/* ---------------- page builder ---------------- */
interface Layout {
  W: number; H: number; top: number; lh: number; fs: number; nWords: number; seed: number; K: number;
  measure?: (s: string) => number;
  G0: Grid; G1: Grid; A: number;
  boxes: [Rect[], Rect[], Rect[]];
  col: Rect; // agent column in S1
}
function buildPage(Lo: Layout, keep?: Tok[]): Page {
  const { lh, fs, K } = Lo;
  const sp = Lo.measure ? fs * 0.34 : fs * 0.3;
  let stream = keep ? keep.filter((t) => t.kind !== 1) : makeStream(Lo.nWords, fs, Lo.seed, Lo.measure);
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
function originLayout(W: number, H: number, leadH: (w: number) => number, measure: (s: string) => number, fs: number, lh: number) {
  const mobile = W < 820;
  const mx = mobile ? 16 : clamp(W * 0.0278, 24, 56);
  const g = mobile ? 12 : 20;
  const top = mobile ? 16 : Math.max(mx, 32);
  const snap = (y: number) => top + Math.ceil((y - top) / lh) * lh;
  const bottom = H - (mobile ? 20 : mx);
  const G0 = makeGrid(W, mobile ? 6 : 12, mx, g), G1 = makeGrid(W, mobile ? 7 : 13, mx, g);
  const A = mobile ? 3 : 4;
  const map = (i: number) => (i < A ? i : i + 1);
  const T: [TLine[], TLine[], TLine[]] = [[], [], []];
  let Tmid: TLine[] | null = null;
  const lead: [Rect, Rect, Rect] = [] as any, nav: any = [[], [], []];
  const boxes: [Rect[], Rect[], Rect[]] = [[], [], []];
  const navItems = 4, navLh = 19;
  let col: Rect;

  if (!mobile) {
    // S0: name on one line across 9 columns; statement in 4; two text columns of 4; links in the last column
    // tall windows (portrait tablets): the name takes two lines across ten columns
    const portrait = H > W * 1.05;
    const wt0 = 760;
    const m0 = G0.span(portrait ? 10 : 9);
    const size0 = portrait ? Math.min((m0 / lineW(0, 9, 100, wt0)) * 100, H * 0.16) : Math.min((m0 / lineW(0, 14, 100, wt0)) * 100, H * 0.2);
    const base0 = top + ASC * size0, baseL = base0 + size0 * 0.92;
    T[0] = portrait
      ? [{ a: 0, b: 9, x: G0.x(0), base: base0, size: size0, wd: 100, wt: wt0 }, { a: 10, b: 14, x: G0.x(0), base: baseL, size: size0, wd: 100, wt: wt0 }]
      : [{ a: 0, b: 14, x: G0.x(0), base: base0, size: size0, wd: 100, wt: wt0 }];
    const bodyTop = portrait ? snap(baseL + size0 * 0.12 + lh * 3) : snap(Math.max(base0 + size0 * 0.26 + lh * 3, H * 0.34));
    lead[0] = { x: G0.x(0), y: bodyTop - 6, w: G0.span(4), h: 0 };
    boxes[0] = [{ x: G0.x(4), y: bodyTop, w: G0.span(4), h: bottom - bodyTop }, { x: G0.x(8), y: bodyTop, w: G0.span(4), h: bottom - bodyTop }];
    const nc = W < 1000 || portrait ? 10 : 11; // the links' column: one from the edge, two when columns are narrow
    nav[0] = Array.from({ length: navItems }, (_, k) => ({ x: G0.x(nc), y: top - 3 + k * navLh }));
    // S1: same column counts on the 13-column grid; the name keeps its size and yields width
    const m1 = G1.span(portrait ? 10 : 9);
    const wd1 = portrait ? solveWd(0, 9, size0, wt0, m1) : solveWd(0, 14, size0, wt0, m1);
    T[1] = T[0].map((L) => ({ ...L, x: G1.x(0), wd: wd1 }));
    lead[1] = { x: G1.x(0), y: bodyTop - 6, w: G1.span(4), h: 0 };
    boxes[1] = [{ x: G1.x(map(4)), y: bodyTop, w: G1.span(4), h: bottom - bodyTop }, { x: G1.x(map(8)), y: bodyTop, w: G1.span(4), h: bottom - bodyTop }];
    nav[1] = nav[0].map((n: any) => ({ x: G1.x(nc + 1), y: n.y }));
    col = { x: G1.x(A), y: bodyTop - 6, w: G1.colW, h: bottom - bodyTop + 6 };
    // between S1 and S2 "Labs" first drops, rigid, to its own line under "Corollary"
    if (!portrait) Tmid = [
      { a: 0, b: 9, x: G1.x(0), base: base0, size: size0, wd: wd1, wt: wt0 },
      { a: 10, b: 14, x: G1.x(0), base: base0 + size0 * 0.3 + CAP * size0, size: size0, wd: wd1, wt: wt0 },
    ];
    // S2: re-organised. The name re-breaks into a justified block over 7 columns;
    // the statement moves up beside it; the text re-flows into three columns.
    const wt2 = 820, m2 = G1.span(portrait ? 10 : 7);
    const size2a = Math.min((m2 / lineW(0, 9, 100, wt2)) * 100, H * (portrait ? 0.14 : 0.2));
    const base2a = top + ASC * size2a;
    const size2b = Math.min(size2a * 1.55, H * (portrait ? 0.2 : 0.3));
    const wd2b = solveWd(10, 14, size2b, wt2, m2);
    const base2b = base2a + size2a * 0.24 + CAP * size2b + size2a * 0.08;
    T[2] = [
      { a: 0, b: 9, x: G1.x(0), base: base2a, size: size2a, wd: 100, wt: wt2 },
      { a: 10, b: 14, x: G1.x(0), base: base2b, size: size2b, wd: wd2b, wt: wt2 },
    ];
    lead[2] = { x: G1.x(8), y: top - 6, w: G1.span(nc - 7), h: 0 };
    const top2 = snap(Math.max(base2b + lh * 2, portrait ? 0 : H * 0.34));
    if (portrait) {
      lead[2] = { x: G1.x(0), y: top2 - 6, w: G1.span(6), h: 0 };
      const tb = snap(top2 + leadH(G1.span(6)) + lh * 2);
      boxes[2] = [0, 4, 8].map((c) => ({ x: G1.x(c), y: tb, w: G1.span(c === 8 ? 5 : 4), h: bottom - tb })) as Rect[];
    } else boxes[2] = [
      { x: G1.x(0), y: top2, w: G1.span(4), h: bottom - top2 },
      { x: G1.x(4), y: top2, w: G1.span(4), h: bottom - top2 },
      { x: G1.x(8), y: snap(top + Math.max(leadH(G1.span(nc - 7)), navLh * 4) + lh * 2), w: G1.span(4), h: 0 },
    ];
    if (!portrait) boxes[2][2].h = bottom - boxes[2][2].y;
    nav[2] = nav[1];
  } else {
    // phones: one row of links at the top that never moves; the name in two lines below it
    const navRow = Array.from({ length: navItems }, (_, k) => ({ x: mx + (k * (W - 2 * mx)) / navItems, y: top - 3 }));
    nav[0] = navRow; nav[1] = navRow; nav[2] = navRow;
    const t0 = top + 19 + 22;
    const wt0 = 760;
    const m0 = G0.span(6), size0 = (m0 / lineW(0, 9, 100, wt0)) * 100;
    const b1 = t0 + ASC * size0, b2 = b1 + size0 * 0.92;
    T[0] = [
      { a: 0, b: 9, x: G0.x(0), base: b1, size: size0, wd: 100, wt: wt0 },
      { a: 10, b: 14, x: G0.x(0), base: b2, size: size0, wd: 100, wt: wt0 },
    ];
    const leadY = snap(b2 + lh * 2);
    lead[0] = { x: G0.x(0), y: leadY - 4, w: G0.span(6), h: 0 };
    const bodyTop = snap(leadY + leadH(G0.span(6)) + lh * 2);
    boxes[0] = [{ x: G0.x(0), y: bodyTop, w: G0.span(3), h: bottom - bodyTop }, { x: G0.x(3), y: bodyTop, w: G0.span(3), h: bottom - bodyTop }];
    const m1 = G1.span(6);
    const wd1 = solveWd(0, 9, size0, wt0, m1);
    T[1] = T[0].map((L) => ({ ...L, x: G1.x(0), wd: wd1 }));
    lead[1] = { x: G1.x(0), y: leadY - 4, w: G1.span(6), h: 0 };
    const bodyTop1 = snap(leadY + leadH(G1.span(6)) + lh * 2);
    boxes[1] = [{ x: G1.x(0), y: bodyTop1, w: G1.span(3), h: bottom - bodyTop1 }, { x: G1.x(4), y: bodyTop1, w: G1.span(3), h: bottom - bodyTop1 }];
    col = { x: G1.x(A), y: bodyTop1 - 4, w: G1.colW, h: bottom - bodyTop1 + 4 };
    // S2: justified block over 7 columns ("Labs" widens to the measure), text still in two columns
    const wt2 = 820, m2 = G1.span(7);
    const s2a = (m2 / lineW(0, 9, 100, wt2)) * 100;
    const s2b = Math.min((m2 / lineW(10, 14, 116, wt2)) * 100, H * 0.16);
    const c1 = t0 + ASC * s2a, c2 = c1 + s2a * 0.24 + CAP * s2b + s2a * 0.06;
    T[2] = [
      { a: 0, b: 9, x: G1.x(0), base: c1, size: s2a, wd: 100, wt: wt2 },
      { a: 10, b: 14, x: G1.x(0), base: c2, size: s2b, wd: solveWd(10, 14, s2b, wt2, m2), wt: wt2 },
    ];
    const leadY2 = snap(c2 + lh * 2);
    lead[2] = { x: G1.x(0), y: leadY2 - 4, w: G1.span(6), h: 0 };
    const body2 = snap(leadY2 + leadH(G1.span(6)) + lh * 2);
    boxes[2] = [{ x: G1.x(0), y: body2, w: G1.span(4), h: bottom - body2 }, { x: G1.x(4), y: body2, w: G1.span(3), h: bottom - body2 }];
  }
  const Lo: Layout = { W, H, top, lh, fs, nWords: mobile ? 900 : 1500, seed: 11, K: mobile ? 9 : 14, G0, G1, A, boxes, col: col!, measure };
  return { Lo, T, Tmid, lead, nav };
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
const easeBack = (t: number) => { const c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const lerpLines = (A: TLine[], B: TLine[], t: number): TLine[] =>
  A.map((a, k) => { const b = B[k]; return { a: a.a, b: a.b, x: lerp(a.x, b.x, t), base: lerp(a.base, b.base, t), size: lerp(a.size, b.size, t), wd: lerp(a.wd, b.wd, t), wt: lerp(a.wt, b.wt, t) }; });

/*
  Sequencing of one re-setting (S0→S1 at load, S1→S2 on scroll), so nothing ever doubles up:
    OUT   words that will move leave, in a wave (by column at load, in reading order on scroll)
    FLY   (S1→S2 only) the column's pieces condense and travel across the cleared grid
    IN    words are set in their new places, in a second wave, around the pieces that have landed
*/
const OUT1 = [0, 0.3, 0.2] as const, IN1 = [0.5, 0.3, 0.2] as const;   // start, spread, duration (S0→S1)
const OUT2 = [0, 0.24, 0.12] as const, IN2 = [0.58, 0.28, 0.12] as const; // (S1→S2)
const FLY = [0.3, 0.14, 0.2] as const;

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
    signal: css.getPropertyValue('--signal').trim() || '#d4213d',
  };
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  titleEl.textContent = '';
  const letterEls = [...TITLE].map((ch) => {
    const s = document.createElement('span');
    s.className = 'st-ch'; s.textContent = ch === ' ' ? ' ' : ch; s.setAttribute('aria-hidden', 'true');
    titleEl.appendChild(s); return s;
  });

  let W = 0, H = 0, dpr = 1, FS = 9, LH = 13;
  let page!: Page;
  let minis = new Map<string, Page>();
  let T: [TLine[], TLine[], TLine[]];
  let Tmid: TLine[] | null = null;
  let leadR: [Rect, Rect, Rect];
  let navR: any;
  let p = 0;
  let raf = 0;
  const t0 = performance.now();
  let intro = REDUCED ? -1 : t0;
  // the column's entry plays once, by itself, after the page has been set
  let entryAt = REDUCED ? -1 : t0 + 1500;
  const ENTRY_MS = 2300;
  let hover: { x: number; y: number; idx: number } | null = null;
  let inserted = 0;
  const shown = new Map<number, { x: number; y: number }>();
  const font = () => `440 ${FS}px Archivo, sans-serif`;
  const wcache = new Map<string, number>();
  const measure = (s: string) => {
    let w = wcache.get(s);
    if (w === undefined) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.font = font(); w = ctx.measureText(s).width; ctx.restore(); wcache.set(s, w); }
    return w;
  };
  const leadHeight = (w: number) => { leadEl.style.width = w + 'px'; return leadEl.offsetHeight; };
  const layout = () => originLayout(W, H, leadHeight, measure, FS, LH);

  function build(keepStream = false) {
    const r = stage.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    const mobile = W < 820;
    const nFS = mobile ? 8 : 9, nLH = mobile ? 12 : 13;
    if (nFS !== FS) { wcache.clear(); keepStream = false; }
    FS = nFS; LH = nLH;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const o = layout();
    T = o.T; Tmid = o.Tmid; leadR = o.lead; navR = o.nav;
    page = buildPage(o.Lo, keepStream && page ? page.stream : undefined);
    minis = new Map();
    req();
  }
  function relayout() {
    const o = layout();
    page = buildPage(o.Lo, page.stream);
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

  /* ---------- timeline: S0→S1 is time (plays at load), S1→S2 and the field are scroll ---------- */
  function phases(now = performance.now()) {
    let u1 = entryAt < 0 ? 1 : clamp((now - entryAt) / ENTRY_MS);
    let u2 = clamp((p - 0.03) / 0.5), q = clamp((p - 0.56) / 0.44);
    if (p > 0.02) u1 = 1; // scrolling past the hero completes the entry
    if (REDUCED) {
      const s = p < 0.3 ? 1 : p < 0.7 ? 2 : 3;
      u1 = 1; u2 = s >= 2 ? 1 : 0; q = s >= 3 ? 1 : 0;
    }
    return { u1, u2, q };
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
  /* reading-order distance for scroll, column distance for the entry */
  function delayOf(pg: Page, i: number, u2: number) {
    if (u2 > 0) return clamp(i / pg.nvis);
    const P0 = pg.L[0][i];
    const bx = P0 && P0.c !== undefined ? pg.specBoxes[0][P0.c] : null;
    return bx ? clamp(Math.abs(bx.x + bx.w / 2 - pg.agentX) / pg.W * 1.6) : 0;
  }

  /* ---------- drawing ---------- */
  const tmp = { x: 0, y: 0, w: 0, a: 1 };
  function drawPage(pg: Page, u1: number, u2: number, now: number, origin: boolean, gridA: number): boolean {
    let busy = false;
    const { barH } = pg;
    const fs = origin ? FS : pg.lh * 0.68;
    const chip = (x: number, baseline: number, w: number) => ctx.fillRect(x - 1, baseline - fs * 0.9, w + 2, fs * 1.14);
    if (gridA > 0.01) {
      // the grid re-divides: every line moves to its place on 13 columns; the new pair opens from a gutter
      const [e0, e1] = pg.edges;
      const t = u2 > 0 ? 1 : REDUCED ? u1 : ease(clamp(u1 / 0.45));
      ctx.fillStyle = C.ink;
      for (let i = 0; i < e0.length; i++) {
        const isNew = i >= e0.length - 2;
        ctx.globalAlpha = (isNew ? 0.07 + 0.25 * Math.sin(Math.PI * clamp(u1 / 0.5)) * (u2 > 0 ? 0 : 1) : 0.06) * gridA;
        ctx.fillRect(Math.round(lerp(e0[i], e1[i], t)), 0, 1, pg.H);
      }
      ctx.globalAlpha = 1;
    }
    if (pg.titleBars) {
      ctx.fillStyle = C.ink;
      ctx.globalAlpha = 0.3;
      const [a0, a1, a2] = pg.titleBars;
      const k = u2 > 0 ? 1 : 0, t = k ? u2 : u1;
      const A = k ? a1 : a0, B = k ? a2 : a1;
      const n = Math.max(A.length, B.length);
      for (let i = 0; i < n; i++) {
        const a = A[Math.min(i, A.length - 1)], b = B[Math.min(i, B.length - 1)], e = ease(t);
        ctx.fillRect(lerp(a.x, b.x, e), lerp(a.y, b.y, e), lerp(a.w, b.w, e), lerp(a.h, b.h, e) * 0.62);
      }
      ctx.globalAlpha = 1;
    }
    const N = pg.stream.length;
    const introOn = origin && intro > 0;
    if (origin) { ctx.font = font(); ctx.textBaseline = 'alphabetic'; }
    ctx.fillStyle = C.ink;
    let ki = 0;
    const col = pg.col[1];
    for (let i = 0; i < N; i++) {
      const tk = pg.stream[i];
      if (tk.kind === 1) {
        // slice k of the new column is absorbed into the text as inline element k
        const A = pg.L[2][i];
        const k = ki++;
        const sh = col.h / pg.K, y1 = col.y + k * sh;
        let x: number, y: number, w: number, h: number;
        const ft = REDUCED ? (u2 > 0 ? 1 : 0) : clamp((u2 - FLY[0] - (k / pg.K) * FLY[1]) / FLY[2]);
        if (u2 <= 0 || ft <= 0 || !A || !A.v) {
          // entry: the column opens with the grid and pours down, slice by slice
          const tg = REDUCED ? u1 : ease(clamp(u1 / 0.45));
          const front = REDUCED ? pg.K : clamp((u1 - 0.12) / 0.45) * pg.K; const tf = clamp(front - k);
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
        if (w > 0.2 && h > 0.2) { ctx.fillStyle = C.signal; ctx.fillRect(x, y, w, h); ctx.fillStyle = C.ink; }
        continue;
      }
      if (!wordAt(pg, i, u1, u2, delayOf(pg, i, u2), tmp)) continue;
      let a = tmp.a, w = tmp.w, x = tmp.x, y = tmp.y;
      if (tk.at) {
        const e = (now - tk.at) / tk.dur;
        if (e < 1) {
          busy = true;
          if (tk.oy) {
            // a word pushed onto the next line is re-set there: out, a pause, then in
            if (e < 0.3) { x += tk.ox; y += tk.oy; a *= e <= 0 ? 1 : 1 - e / 0.3; }
            else if (e < 0.55) a = 0;
            else { const f = (e - 0.55) / 0.45; a *= f; x -= 6 * (1 - easeOut(f)); }
          } else if (e > 0) { const f = 1 - easeBack(clamp(e)); x += tk.ox * f; }
          else x += tk.ox;
        } else tk.at = 0;
      }
      if (introOn) {
        const e = (now - intro - 300 - i * 0.8) / 240;
        if (e < 1) { busy = true; if (e <= 0) continue; a *= clamp(e); }
      }
      if (origin) shown.set(tk.id, { x, y });
      if (a < 0.01) continue;
      if (tk.kind === 2) {
        // a piece taken from the column: it flies there first, then the text makes room
        let cx = x, cy = y - fs * 0.9, cw = w + 2, chh = fs * 1.14;
        if (tk.born) {
          const e = (now - tk.born) / 520;
          if (e < 0) { busy = true; continue; }
          if (e < 1) {
            busy = true;
            const f = sm(clamp(e)), sy = clamp(y - fs, col.y, col.y + col.h - 20);
            cx = lerp(col.x, x - 1, f); cy = lerp(sy, y - fs * 0.9, f); cw = lerp(col.w, w + 2, sm(clamp(e / 0.4))); chh = lerp(20, fs * 1.14, sm(clamp(e / 0.4)));
          } else tk.born = 0;
        }
        ctx.fillStyle = C.signal; ctx.globalAlpha = 1;
        ctx.fillRect(cx - 1, cy, cw, chh);
        ctx.fillStyle = C.ink;
        continue;
      }
      if (tk.s && origin) { ctx.globalAlpha = a * 0.62; ctx.fillText(tk.s, x, y); }
      else { ctx.globalAlpha = a * 0.5; ctx.fillRect(x, y - barH, w, barH); }
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;
    return busy;
  }

  /* the name: always set as whole lines, so letters keep their spacing and never cross */
  function titleLines(u1: number, u2: number): TLine[] {
    if (REDUCED) return u2 > 0 ? T[2] : T[1];
    if (u2 <= 0) return lerpLines(T[0], T[1], ease(clamp(u1 / 0.6)));
    if (!Tmid) return lerpLines(T[1], T[2], ease(u2));
    const ta = clamp(u2 / 0.42), tb = clamp((u2 - 0.42) / 0.58);
    if (tb > 0) return lerpLines(Tmid, T[2], ease(tb));
    // "Labs" leaves the line whole: first down to its own line, then left to the margin
    const L1 = T[1][0];
    const fromX = L1.x + ((adv(10, L1.wd, L1.wt) - adv(0, L1.wd, L1.wt)) * L1.size) / 100;
    const m = Tmid[1];
    return [Tmid[0], { ...m, x: lerp(fromX, m.x, sm(clamp((ta - 0.45) / 0.55))), base: lerp(L1.base, m.base, sm(clamp(ta / 0.55))) }];
  }

  function placeDom(u1: number, u2: number, now: number, cam: { s: number; tx: number; ty: number }) {
    layer.style.transform = cam.s === 1 ? '' : `translate3d(${cam.tx}px,${cam.ty}px,0) scale(${cam.s})`;
    let busy = false;
    let lines = titleLines(u1, u2);
    let op = 1;
    if (intro > 0) {
      const e = clamp((now - intro) / 1100);
      if (e < 1) busy = true;
      const f = easeOut(e);
      lines = lines.map((L) => ({ ...L, wd: lerp(62, L.wd, f), wt: lerp(300, L.wt, f) }));
      op = clamp(e * 4);
    }
    const Ls = lettersOf(lines);
    for (let i = 0; i < letterEls.length; i++) {
      const L = Ls[i], el = letterEls[i], s = L.s / 100;
      el.style.transform = `translate3d(${L.x.toFixed(2)}px,${(L.y - BASE * L.s).toFixed(2)}px,0) scale(${s.toFixed(4)})`;
      el.style.fontVariationSettings = `'wdth' ${L.wd.toFixed(2)}, 'wght' ${L.wt.toFixed(1)}`;
      el.style.opacity = String(L.v ? op : 0);
    }
    const fade = intro > 0 ? clamp((now - intro - 500) / 700) : 1;
    if (fade < 1) busy = true;
    // the statement slides with the grid at entry; on scroll it leaves first and is re-set last
    const setAt = (el: HTMLElement, R: any, o: number) => {
      if (R.w) el.style.width = R.w.toFixed(1) + 'px';
      el.style.transform = `translate3d(${R.x.toFixed(2)}px,${R.y.toFixed(2)}px,0)`;
      el.style.opacity = String(o * fade);
    };
    if (u2 <= 0) {
      const t = REDUCED ? 1 : ease(clamp(u1 / 0.6));
      const A = leadR[0], B = leadR[1];
      setAt(leadEl, { x: lerp(A.x, B.x, t), y: lerp(A.y, B.y, t), w: lerp(A.w, B.w, t) }, 1);
    } else {
      const same = Math.abs(leadR[1].x - leadR[2].x) + Math.abs(leadR[1].y - leadR[2].y) < 2;
      if (same) setAt(leadEl, { ...leadR[2], w: lerp(leadR[1].w, leadR[2].w, u2) }, 1);
      else if (u2 < 0.4) setAt(leadEl, leadR[1], 1 - sm(clamp(u2 / 0.16)));
      else setAt(leadEl, leadR[2], sm(clamp((u2 - 0.62) / 0.18)));
    }
    const nt = u2 > 0 ? 1 + ease(u2) : REDUCED ? 1 : ease(clamp(u1 / 0.6));
    const nk = nt <= 1 ? 0 : 1, ntt = nt <= 1 ? nt : nt - 1;
    navEls.forEach((el, k) => {
      const a = navR[nk][k], b = navR[nk + 1][k];
      setAt(el, { x: lerp(a.x, b.x, ntt), y: lerp(a.y, b.y, ntt) }, 1);
    });
    return busy;
  }

  function draw(now: number) {
    const { u1, u2, q } = phases(now);
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
    let busy = entryAt > 0 && u1 < 1 && p <= 0.02;
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
        if (i === 0 && j === 0) { busy = drawPage(page, u1, u2, now, true, 1 - z) || busy; ctx.restore(); continue; }
        const d = Math.hypot(ox, oy) / maxD;
        const lp = REDUCED ? r : clamp((r - d * 0.62) / 0.38);
        drawPage(miniAt(i, j), clamp(lp * 2), clamp(lp * 2 - 1), now, false, 0);
        ctx.restore();
      }
      // the field dissolves into the page below it
      const fa = REDUCED ? q : clamp((q - 0.72) / 0.28);
      if (fa > 0) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const g = ctx.createLinearGradient(0, H * 0.38, 0, H);
        g.addColorStop(0, 'rgba(236,236,232,0)');
        g.addColorStop(1, 'rgba(236,236,232,1)');
        ctx.globalAlpha = fa;
        ctx.fillStyle = g;
        ctx.fillRect(0, H * 0.38, W, H * 0.62 + 1);
        ctx.globalAlpha = 1;
      }
    } else {
      busy = drawPage(page, u1, u2, now, true, 1) || busy;
    }
    if (hover && z === 0 && u2 === 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = C.signal;
      ctx.fillRect(hover.x - 1, hover.y - LH * 0.95, 2, LH * 1.2);
    }
    busy = placeDom(u1, u2, now, cam) || busy;
    if (intro > 0 && now - intro > 2600) intro = 0;
    if (entryAt > 0 && u1 >= 1) { entryAt = -1; onEntered(); }
    return busy || intro > 0;
  }

  function frame(now: number) { raf = 0; if (draw(now)) req(); }
  function req() { if (!raf) raf = requestAnimationFrame(frame); }

  function onScroll() {
    const r = story.getBoundingClientRect();
    const span = r.height - H;
    const np = span > 0 ? clamp(-r.top / span) : 0;
    if (np !== p) { p = np; if (p > 0.02) hover = null; req(); }
  }

  /* ---------- a visitor takes a piece of the column and sets it into the text ---------- */
  function ready() { const { u1, u2 } = phases(); return u1 >= 1 && u2 === 0 && p <= 0.03; }
  function locate(mx: number, my: number) {
    if (!ready()) return null;
    const L1 = page.L[1];
    let bestDy = 1e9;
    for (let i = 0; i < page.stream.length; i++) {
      const P1 = L1[i];
      if (!P1 || !P1.v || mx < P1.x - 30 || mx > P1.x + P1.w + 30) continue;
      bestDy = Math.min(bestDy, Math.abs(P1.y - FS * 0.35 - my));
    }
    if (bestDy > LH * 1.2) return null;
    let best = -1, bx = 0, by = 0, bd = 1e9;
    for (let i = 0; i < page.stream.length; i++) {
      const P1 = L1[i];
      if (!P1 || !P1.v || Math.abs(Math.abs(P1.y - FS * 0.35 - my) - bestDy) > 0.5) continue;
      const dl = Math.abs(P1.x - mx), dr = Math.abs(P1.x + P1.w - mx);
      if (dl < bd) { bd = dl; best = i; bx = P1.x - page.sp / 2; by = P1.y; }
      if (dr < bd) { bd = dr; best = i + 1; bx = P1.x + P1.w + page.sp / 2; by = P1.y; }
    }
    if (best < 0 || bd > 30) return null;
    return { x: bx, y: by, idx: best };
  }
  function insertAt(idx: number) {
    const now = performance.now();
    const st = page.stream;
    // beside an existing piece: that piece grows (to a limit) instead of a new one stacking up
    const near = st[idx - 1]?.kind === 2 ? st[idx - 1] : st[idx]?.kind === 2 ? st[idx] : null;
    let tok: Tok;
    if (near) {
      if (near.w > FS * 6) return;
      near.w += FS * 1.6; tok = near;
    } else {
      if (inserted >= 12) return;
      inserted++;
      tok = { id: 500000 + inserted, w: (3 + Math.floor(Math.random() * 3)) * FS * 0.55, kind: 2, pEnd: false, born: REDUCED ? 0 : now + 380, ox: 0, oy: 0, at: 0, dur: 0 };
      st.splice(idx, 0, tok);
    }
    const old = new Map(shown);
    relayout();
    if (!REDUCED) {
      const newIdx = page.stream.indexOf(tok);
      const lag = 0; // the text makes room first; the piece arrives into the gap
      page.stream.forEach((t, i) => {
        const was = old.get(t.id);
        const P1 = page.L[1][i];
        if (!was || t === tok || !P1 || !P1.v) return;
        const dx = was.x - P1.x, dy = was.y - P1.y;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        t.ox = dx; t.oy = Math.abs(dy) < 0.5 ? 0 : dy; t.dur = t.oy ? 700 : 560;
        t.at = now + lag + Math.min(1100, Math.max(0, i - newIdx) * 5);
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
    if (h) { insertAt(h.idx); hover = null; req(); }
  });

  // after the entry, one piece is taken from the column and set into the text by itself
  function onEntered() {
    setTimeout(() => {
      if (!ready() || inserted > 0) return;
      const b = page.specBoxes[1][page.specBoxes[1].length - 1];
      const L1 = page.L[1];
      const idx = page.stream.findIndex((t, i) => { const P = L1[i]; return t.kind === 0 && !!P && P.v === 1 && P.c === page.specBoxes[1].length - 1 && P.y > b.y + LH * 6 && P.x > b.x + b.w * 0.35; });
      if (idx < 0) return;
      const P = L1[idx]!;
      hover = { x: P.x - page.sp / 2, y: P.y, idx };
      req();
      setTimeout(() => { hover = null; if (!ready()) { req(); return; } insertAt(idx); }, 600);
    }, 700);
  }

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
