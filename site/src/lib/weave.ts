// Shared weave rules. The WebGL cloth (scripts/cloth.ts) mirrors these in GLSL; every 2D cloth on the
// site (titles, essay threads, figures, the mark) calls them directly. true = warp over weft.
//
//   ground  : 8-end warp satin (counter 3). Smooth: its binding points sink between the floats.
//   figure  : 1/3 twill. The woven lettering reads as hatched light on a smooth dark ground.
//   rewoven : a two-block profile draft around a new thread (Albers, Black-White-Gray). Columns and
//             rows fall into blocks A/B with widths from a proportional series (not mirrored: an
//             asymmetric grid). A×A, A×B, B×A weave 2/2 twill (grey); B×B weaves 1/3 twill (white).
//             The satin ground stays black. Only the twill direction mirrors on the new thread.
//   front   : a rectangle growing from the new thread (the change runs along warp and weft only,
//             faster along the weft).

export const mod = (a: number, n: number) => ((a % n) + n) % n;

export const groundUp = (i: number, j: number) => mod(j - 3 * i, 8) !== 0;
export const figureUp = (i: number, j: number) => mod(j - i, 4) === 0;

// Block widths in threads (multiples of 4: whole twill repeats) and their block type (bit k = block k is B).
export const BX = [12, 28, 8, 44, 20, 16, 64, 8];
export const BY = [8, 20, 12, 36, 8, 24, 48];
export const TX = 170, TY = 82;
export const OFFX = 52, OFFY = 36; // the left / upper side reads the series from elsewhere: no mirror
const cum = (w: number[]) => w.reduce<number[]>((a, x) => (a.push((a.at(-1) ?? 0) + x), a), []);
const CX = cum(BX), CY = cum(BY);
const typeOf = (d: number, C: number[], T: number) => { const m = mod(d, C.at(-1)!); return (T >> C.findIndex((c) => m < c)) & 1; };
/** dx signed columns from the new thread (0 = the thread), dy signed rows from its centre row. */
export const blockX = (dx: number) => (dx === 0 ? 0 : typeOf(Math.abs(dx) - 1 + (dx < 0 ? OFFX : 0), CX, TX));
export const blockY = (dy: number) => typeOf(Math.abs(dy) + (dy < 0 ? OFFY : 0), CY, TY);

export function rewovenUp(dx: number, dy: number) {
  const white = dx !== 0 && blockX(dx) === 1 && blockY(dy) === 1;
  const r = mod(mod(Math.abs(dx), 4) - mod(dy, 4), 4);
  return white ? r === 0 : r < 2;
}
/** true where a rewoven cell is the white block (its warp binding points sink). */
export const rewovenWhite = (dx: number, dy: number) => dx !== 0 && blockX(dx) === 1 && blockY(dy) === 1;

export const frontDist = (dx: number, dy: number) => Math.max(Math.abs(dx), Math.abs(dy) * 1.6);

export function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

export const PALETTE = {
  warp: ['#18181a', '#202023', '#161618', '#27272b', '#1c1c1f'],
  warpW: [34, 8, 21, 5, 13],
  weft: '#ebe9e3',
  gap: '#0c0c0e',
  saffron: '#f2a93b',
};

/** Warp colour for a column index: graphite values in Albers-like proportional bands. */
export function warpColour(j: number) {
  const total = PALETTE.warpW.reduce((a, b) => a + b, 0);
  let m = mod(j, total);
  for (let k = 0; k < PALETTE.warpW.length; k++) { if (m < PALETTE.warpW[k]) return PALETTE.warp[k]; m -= PALETTE.warpW[k]; }
  return PALETTE.warp[0];
}
