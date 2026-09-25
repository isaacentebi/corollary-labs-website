// Shared weave logic. The same rules drive the WebGL cloth (scripts/cloth.ts mirrors them in GLSL)
// and every static SVG drawdown on the site (titles, swatches, figures, the mark).
//
// Structures (8-end, drawn as a drawdown: true = warp over weft):
//   ground  : warp-faced 8-end satin, counter 3 (the cloth before any new thread)
//   figure  : weft-faced 8-end satin (the woven name; the damask pair of the ground)
//   rewoven : 5/3 twill, point-drawn across and mirrored on the new thread, straight down:
//             a herringbone whose spine is the new thread

export const mod = (a: number, n: number) => ((a % n) + n) % n;

export const groundUp = (i: number, j: number) => mod(j - 3 * i, 8) !== 0;
export const figureUp = (i: number, j: number) => mod(j - 3 * i, 8) === 0;

/** Point draw index 0..7..1 (period 14) for a distance of x threads from the axis (axis itself = 0). */
export const point = (x: number) => { const s = mod(x, 14); return s < 8 ? s : 14 - s; };

/** Rewoven structure relative to the new thread. dx = columns away from it (0 = the thread itself),
 *  dy = rows from its centre row (signed). */
export const rewovenUp = (dx: number, dy: number) => mod(point(Math.abs(dx)) - dy, 8) < 5;

// ---------------------------------------------------------------------------------------------
// Pixel font: square-constructed capitals, 5 × 7. Each "#" becomes a block of woven figure.
const G: Record<string, string> = {
  A: '##### #...# #...# ##### #...# #...# #...#',
  B: '####. #...# #...# ##### #...# #...# #####',
  C: '##### #.... #.... #.... #.... #.... #####',
  D: '####. #...# #...# #...# #...# #...# ####.',
  E: '##### #.... #.... ####. #.... #.... #####',
  F: '##### #.... #.... ####. #.... #.... #....',
  G: '##### #.... #.... #.### #...# #...# #####',
  H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '##### ..#.. ..#.. ..#.. ..#.. ..#.. #####',
  J: '....# ....# ....# ....# ....# #...# #####',
  K: '#...# #..#. #.#.. ###.. #..#. #...# #...#',
  L: '#.... #.... #.... #.... #.... #.... #####',
  M: '##### #.#.# #.#.# #.#.# #...# #...# #...#',
  N: '####. #...# #...# #...# #...# #...# #...#',
  O: '##### #...# #...# #...# #...# #...# #####',
  P: '##### #...# #...# ##### #.... #.... #....',
  Q: '##### #...# #...# #...# #.#.# #..#. ###.#',
  R: '##### #...# #...# ##### #..#. #...# #...#',
  S: '##### #.... #.... ##### ....# ....# #####',
  T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# #####',
  V: '#...# #...# #...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# #.#.# #####',
  X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# #...# ##### ..#.. ..#.. ..#..',
  Z: '##### ....# ...#. ..#.. .#... #.... #####',
  ' ': '..... ..... ..... ..... ..... ..... .....',
};

export const GLYPH_W = 5, GLYPH_H = 7, GLYPH_GAP = 1;

/** Bitmap of one line of text: returns { w, h, on(x,y) } in font pixels. */
export function bitmap(text: string) {
  const chars = text.toUpperCase().split('');
  const w = chars.length * (GLYPH_W + GLYPH_GAP) - GLYPH_GAP;
  const rows = chars.map((c) => (G[c] ?? G[' ']).split(' '));
  const on = (x: number, y: number) => {
    if (x < 0 || y < 0 || y >= GLYPH_H || x >= w) return false;
    const ci = Math.floor(x / (GLYPH_W + GLYPH_GAP)), cx = x % (GLYPH_W + GLYPH_GAP);
    if (cx >= GLYPH_W) return false;
    return rows[ci][y][cx] === '#';
  };
  return { w, h: GLYPH_H, on };
}

/** Deterministic hash → [0,1). */
export function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}
