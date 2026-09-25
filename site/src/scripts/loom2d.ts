// 2D cloths: woven titles, essay threads, figures. Same rules as the WebGL cloth (lib/weave.ts).
// Each cloth draws once (and again on resize, or while a front is animating). No idle work.

import { groundUp, figureUp, rewovenUp, rewovenWhite, frontDist, warpColour, PALETTE } from '../lib/weave';

export type Thread = { a: number; vc: number; R: number; hot?: boolean };
type Mask = { data: Uint8Array; w: number; h: number; x: number; y: number };
export type LoomSpec = {
  cols: number; rows: number;
  threads?: Thread[];
  mask?: Mask | null;
  protect?: [number, number, number, number] | null; // cells kept as they were
  cellPx?: number; // device px per thread
};

const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
};

/** Draw a loom into a 2D context at device-pixel cell size s. Returns the drawn width/height in device px. */
export function paintLoom(ctx: CanvasRenderingContext2D, spec: LoomSpec, s: number) {
  const threads = [...(spec.threads ?? [])].sort((a, b) => a.a - b.a);
  // column list: cloth columns with new threads inserted at their boundaries (nothing removed)
  const colsOut: { j: number; t: number }[] = [];
  let ti = 0;
  for (let b = 0; b <= spec.cols; b++) {
    while (ti < threads.length && threads[ti].a === b) colsOut.push({ j: -1, t: ti++ });
    if (b < spec.cols) colsOut.push({ j: b, t: -1 });
  }
  const W = colsOut.length * s, H = spec.rows * s;
  ctx.fillStyle = PALETTE.gap; ctx.fillRect(0, 0, W, H);
  const weftTop = PALETTE.weft, weftUnder = shade(PALETTE.weft, 0.62), weftSunk = shade(PALETTE.weft, 0.42), weftEdge = shade(PALETTE.weft, 0.86);
  const m = spec.mask, P = spec.protect;
  const inset = s >= 10 ? Math.max(1, Math.round(s * 0.1)) : 0;
  for (let i = 0; i < spec.rows; i++) {
    const y = i * s;
    for (let c = 0; c < colsOut.length; c++) {
      const x = c * s; const col = colsOut[c];
      let up: boolean, wc: string, sunk = false, sunkWarp = false;
      if (col.t >= 0) {
        const th = threads[col.t];
        up = rewovenUp(0, i - th.vc); wc = PALETTE.saffron;
      } else {
        const j = col.j;
        const fig = m && j >= m.x && j < m.x + m.w && i >= m.y && i < m.y + m.h && m.data[(i - m.y) * m.w + (j - m.x)];
        wc = warpColour(j);
        if (fig) up = figureUp(i, j);
        else {
          up = groundUp(i, j);
          const prot = P && j >= P[0] && j < P[2] && i >= P[1] && i < P[3];
          let best = 0, bdx = 0, bdy = 0;
          if (!prot) {
            for (const th of threads) {
              const o = j + 0.5 - th.a, dx = Math.sign(o) * (Math.abs(o) + 0.5), dy = i - th.vc;
              const mg = th.R - frontDist(dx, dy);
              if (mg > 0) { best = mg; bdx = dx; bdy = dy; break; } // the first thread to arrive keeps the cell
            }
            if (best > 0) up = rewovenUp(bdx, bdy);
          }
          sunk = !up && (best <= 0 || !!prot);
          if (best > 0 && up && rewovenWhite(bdx, bdy)) sunkWarp = true;
        }
      }
      if (sunk) { // a satin binding point sinks between the floats
        ctx.fillStyle = wc; ctx.fillRect(x, y, s, s);
        if (s >= 3) { ctx.fillStyle = weftSunk; const d = Math.max(1, Math.round(s * 0.34)); ctx.fillRect(x + (s - d) / 2, y + (s - d) / 2, d, d); }
        continue;
      }
      if (sunkWarp) { // in the white blocks the warp binding points sink instead
        ctx.fillStyle = weftTop; ctx.fillRect(x, y, s, s);
        if (s >= 3) { ctx.fillStyle = shade(wc, 1.6); const d = Math.max(1, Math.round(s * 0.34)); ctx.fillRect(x + (s - d) / 2, y + (s - d) / 2, d, d); }
        continue;
      }
      if (!inset) { ctx.fillStyle = up ? wc : weftTop; ctx.fillRect(x, y, s, s); continue; }
      // wefts are beaten tight (no gap between picks); only the warps show a hairline of shadow
      if (up) {
        ctx.fillStyle = weftUnder; ctx.fillRect(x, y, s, s);
        ctx.fillStyle = wc; ctx.fillRect(x + inset, y, s - 2 * inset, s);
      } else {
        ctx.fillStyle = shade(wc, 0.8); ctx.fillRect(x + inset, y, s - 2 * inset, s);
        ctx.fillStyle = weftTop; ctx.fillRect(x, y, s, s);
        ctx.fillStyle = weftEdge; ctx.fillRect(x, y + s - 1, s, 1);
      }
    }
  }
  return { W, H, cols: colsOut.length };
}

// ---------------------------------------------------------------------------------------------
// Text → figure mask, one pixel per thread. Newsreader, rasterised at thread resolution.
export async function textMask(lines: string[], cap: number, weight = 600, lead = 0.42): Promise<Mask> {
  try { await document.fonts.load(`${weight} 100px Newsreader`); } catch { /* fall back to the serif stack */ }
  const font = (px: number) => `${weight} ${px}px Newsreader, Georgia, serif`;
  const cv = document.createElement('canvas'); const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.font = font(100);
  const capH = c.measureText('H').actualBoundingBoxAscent || 70;
  const fs = (100 * cap) / capH;
  c.font = font(fs);
  const ms = lines.map((l) => c.measureText(l));
  const lineStep = Math.round(cap * (1.36 + lead));
  // rasterise generously, then crop to the pixels actually set (font metrics are not reliable enough)
  const W0 = Math.ceil(Math.max(...ms.map((x) => x.width)) + fs), H0 = Math.ceil(fs * 1.6 + lineStep * (lines.length - 1));
  cv.width = W0; cv.height = H0;
  c.font = font(fs); c.fillStyle = '#000'; c.textBaseline = 'alphabetic';
  const base0 = Math.round(fs * 1.05);
  lines.forEach((l, k) => c.fillText(l, Math.round(fs * 0.3), base0 + k * lineStep));
  const img = c.getImageData(0, 0, W0, H0).data;
  let x0 = W0, y0 = H0, x1 = 0, y1 = 0;
  for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) if (img[(y * W0 + x) * 4 + 3] > 118) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const w = Math.max(1, x1 - x0 + 1), h = Math.max(1, y1 - y0 + 1);
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = img[((y + y0) * W0 + (x + x0)) * 4 + 3] > 118 ? 1 : 0;
  return { data, w, h, x: 0, y: 0 };
}

// ---------------------------------------------------------------------------------------------
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A cloth that fills its canvas' CSS width at a fixed thread size. */
export class Loom {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  spec: LoomSpec & { cellCss?: number; fit?: 'width' | 'cols' };
  raf = 0;
  constructor(canvas: HTMLCanvasElement, spec: Loom['spec']) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d')!; this.spec = spec;
    new ResizeObserver(() => this.draw()).observe(canvas.parentElement!);
  }
  get dpr() { return Math.min(devicePixelRatio || 1, 2); }
  draw() {
    const cssW = this.canvas.parentElement!.clientWidth;
    if (!cssW) return;
    const dpr = this.dpr;
    const nThreads = this.spec.threads?.length ?? 0;
    let s: number;
    if (this.spec.fit === 'cols') s = Math.max(1, Math.floor((cssW * dpr) / (this.spec.cols + nThreads)));
    else { s = Math.max(1, Math.round((this.spec.cellCss ?? 4) * dpr)); this.spec.cols = Math.max(8, Math.floor((cssW * dpr) / s) - nThreads); }
    this.canvas.width = (this.spec.cols + nThreads) * s; this.canvas.height = this.spec.rows * s;
    this.canvas.style.width = `${this.canvas.width / dpr}px`; this.canvas.style.height = `${this.canvas.height / dpr}px`;
    paintLoom(this.ctx, this.spec, s);
  }
  /** Animate each thread's front radius to its target. */
  grow(targets: number[], ms = 1400) {
    if (reduce()) { this.spec.threads!.forEach((t, k) => (t.R = targets[k])); this.draw(); return; }
    const from = this.spec.threads!.map((t) => t.R); const t0 = performance.now();
    cancelAnimationFrame(this.raf);
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      this.spec.threads!.forEach((t, n) => (t.R = from[n] + (targets[n] - from[n]) * e));
      this.draw();
      if (k < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}

/** Woven titles: <canvas data-woven="About" data-cap="22">. */
export async function mountWoven(root: ParentNode = document) {
  for (const cv of root.querySelectorAll<HTMLCanvasElement>('canvas[data-woven]')) {
    const text = cv.dataset.woven!.split('|');
    const cap = Number(cv.dataset.cap || 22);
    const mask = await textMask(text, cap, 600);
    const padX = Math.round(cap * 0.55), padY = Math.round(cap * 0.5), padR = Math.round(cap * 1.5);
    mask.x = padX; mask.y = padY;
    const cols = mask.w + padX + padR, rows = mask.h + padY * 2;
    // the label's own new thread, in its right margin
    const a = cols - Math.round(padR * 0.45);
    const loom = new Loom(cv, { cols, rows, mask, fit: 'cols', protect: [mask.x - 2, mask.y - 2, mask.x + mask.w + 2, mask.y + mask.h + 2], threads: [{ a, vc: Math.round(rows / 2), R: 0 }] });
    loom.draw();
    cv.classList.add('is-ready');
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); loom.grow([cap * 0.62], 1600); } });
    io.observe(cv);
  }
}

/** Generic looms: <canvas data-loom='{"rows":10,"cellCss":4,"threads":[{"af":0.3,"vc":5,"R":14}]}'> */
export function mountLooms(root: ParentNode = document) {
  const out: Loom[] = [];
  for (const cv of root.querySelectorAll<HTMLCanvasElement>('canvas[data-loom]')) {
    const o = JSON.parse(cv.dataset.loom!);
    const spec = { cols: 64, rows: o.rows, cellCss: o.cellCss ?? 4, threads: [] as Thread[] };
    const loom = new Loom(cv, spec);
    const place = () => {
      const cssW = cv.parentElement!.clientWidth, dpr = loom.dpr, s = Math.max(1, Math.round(spec.cellCss * dpr));
      const cols = Math.max(8, Math.floor((cssW * dpr) / s) - o.threads.length);
      spec.threads = o.threads.map((t: { af: number; vc: number; R: number }, n: number) => ({ a: Math.round(t.af * cols), vc: t.vc, R: spec.threads[n]?.R ?? (o.grow ? 0 : t.R) }));
    };
    place(); loom.draw();
    new ResizeObserver(() => { place(); loom.draw(); }).observe(cv.parentElement!);
    if (o.grow) {
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); loom.grow(o.threads.map((t: { R: number }) => t.R), o.ms ?? 1800); } }, { threshold: 0.3 });
      io.observe(cv);
    }
    (cv as HTMLCanvasElement & { loom?: Loom; targets?: number[] }).loom = loom;
    (cv as HTMLCanvasElement & { targets?: number[] }).targets = o.threads.map((t: { R: number }) => t.R);
    out.push(loom);
  }
  return out;
}
