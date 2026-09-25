// Renders the still plates (research and team images) to WebP once, at build-preparation time, so pages
// need no second WebGL context. Each plate is its own study after one work (see REFERENCES.md).
// Run: node scripts/make-plates.mjs   (writes public/plates/*.webp)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '../public/plates');
fs.mkdirSync(OUT, { recursive: true });

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255) ** 2.2); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const mul = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const P = {
  night: hex('#0b0b0d'), charcoal: hex('#151619'), emberDeep: hex('#3d140a'), ember: hex('#b3441d'), hot: hex('#e3692e'),
  amber: hex('#eca257'), gold: hex('#f3d9ac'), goldPale: hex('#f7e8cc'), silverHi: hex('#e4e7e9'), silver: hex('#d4d9dc'),
  silverLow: hex('#c6ccd1'), steel: hex('#98a2ab'), steelDark: hex('#343a41'), blueGrey: hex('#7f8fa0'),
  green: hex('#86a08a'), smokeGreen: hex('#4d5f52'), planeSteel: hex('#93a6bb'), planeEmber: hex('#d2683a'), planeAmber: hex('#e9b56a'),
};

// studies: (u, v) in 0..1, v down; w/h aspect
const studies = {
  // Brindle, "Distant Light" / strata: pale field, one thin ember band, the brightest seam beneath it
  strata: (u, v) => {
    const h = 0.6;
    let c = mix(P.silverHi, P.silver, v);
    c = mix(c, P.gold, Math.pow(ss(0, h, v), 5) * 0.8 * (v < h ? 1 : 0));
    c = mix(c, P.ember, Math.exp(-(((v - h) / 0.012) ** 2)));
    c = add(c, P.goldPale, Math.exp(-(((v - h - 0.02) / 0.004) ** 2)) * 0.6);
    if (v > h + 0.02) c = mix(c, mix(P.silver, P.steel, (v - h) * 1.5), 0.6);
    return c;
  },
  // Pashgian: a lens on a dark horizon, the field inverted inside it, a precise rim
  lens: (u, v, a) => {
    const field = (uu, vv) => {
      const h = 0.58;
      if (vv < h) return add(mix(P.night, P.emberDeep, ss(0.1, h, vv)), P.hot, Math.exp(-(h - vv) / 0.06) * 0.5);
      return add(mix(P.charcoal, P.night, ss(h, 1, vv)), P.hot, Math.exp(-(vv - h) / 0.02) * 0.15);
    };
    const x = (u - 0.5) * a, y = v - 0.55, r = Math.hypot(x, y) / 0.26;
    if (r < 1) {
      const k = 0.75 * (1 - 0.25 * r * r);
      let c = mul(field(0.5 - x * k / a, 0.55 - y * k), P.silverHi);
      c = mix(c, P.steelDark, 0.12);
      return add(c, P.goldPale, Math.exp(-(((r - 1) / 0.012) ** 2)) * 0.8);
    }
    return add(field(u, v), P.goldPale, Math.exp(-(((r - 1) / 0.012) ** 2)) * 0.8);
  },
  // Ando: two anodised panels meeting at a hard edge, a hairline of light at the seam
  panel: (u, v) => {
    const edge = 0.46 + (u - 0.5) * 0.04;
    let c = v < edge ? mix(P.silver, P.blueGrey, ss(0, edge, v) * 0.5) : mix(P.steel, P.steelDark, ss(edge, 1, v));
    c = add(c, P.goldPale, Math.exp(-(((v - edge) / 0.0035) ** 2)) * 0.7);
    return c;
  },
  // Koop: a saturated monochrome field with a horizon, the light low in it
  field: (u, v) => {
    const h = 0.7;
    let c = mix(P.emberDeep, P.ember, ss(0, h, v));
    c = add(c, P.hot, Math.exp(-(h - v) / 0.08) * (v < h ? 0.7 : 0));
    if (v >= h) c = mix(P.emberDeep, P.night, ss(h, 1, v));
    return add(c, P.gold, Math.exp(-(((v - h) / 0.003) ** 2)) * 0.8);
  },
  // Bell / Evertz: coated planes over a light field; overlaps multiply into colours none has
  planes: (u, v) => {
    let c = mix(P.silverHi, P.goldPale, v);
    const planes = [[0.18, 0.2, P.planeEmber], [0.34, 0.18, P.green], [0.5, 0.2, P.planeSteel], [0.62, 0.16, P.planeAmber]];
    for (const [x, w, col] of planes) if (Math.abs(u - x) < w / 2 && v > 0.12 && v < 0.88) c = mul(c, col.map((q) => Math.min(1, q * 1.15)));
    return c;
  },
  // Brindle, "Light-Glyph": a vertical bar of light in a dark room (team)
  bar: (u, v, a) => {
    const x = (u - 0.5) * a;
    let c = mix(P.charcoal, P.night, v);
    const inBar = Math.abs(x) < 0.05 && v > 0.14 && v < 0.86;
    c = add(c, P.hot, Math.exp(-Math.max(Math.abs(x) - 0.05, 0) / 0.05) * 0.18);
    if (inBar) c = mix(P.amber, P.gold, 1 - Math.abs(x) / 0.05);
    return c;
  },
  // Pashgian's smoky green, a column of light suspended in it (team)
  column: (u, v, a) => {
    const x = (u - 0.5) * a, y = v - 0.5;
    let c = mix(P.smokeGreen, P.night, ss(0, 1, v) * 0.7);
    const d = Math.pow(Math.abs(x / 0.14) ** 2.4 + Math.abs(y / 0.36) ** 2.4, 1 / 2.4);
    if (d < 1) c = mix(mix(P.gold, P.green, ss(0, 0.9, d)), c, ss(0.85, 1.0, d) * 0.6);
    return add(c, P.goldPale, Math.exp(-(((d - 1) / 0.01) ** 2)) * 0.35);
  },
};

function render(name, w, h) {
  const fn = studies[name];
  const buf = Buffer.alloc(w * h * 3);
  const a = w / h;
  let i = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = fn((x + 0.5) / w, (y + 0.5) / h, a);
      const n = (rnd() + rnd() - 1) * 1.6;
      for (let k = 0; k < 3; k++) buf[i++] = Math.max(0, Math.min(255, Math.round(Math.pow(Math.min(c[k], 1), 1 / 2.2) * 255 + n)));
    }
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).webp({ quality: 88 }).toFile(path.join(OUT, `${name}-${w}x${h}.webp`));
}

await Promise.all([
  ...['strata', 'lens', 'panel', 'field', 'planes'].map((n) => render(n, 1200, 800)),
  ...['bar', 'panel', 'column', 'field'].map((n) => render(n, 800, 1000)),
]);
console.log('plates written to', OUT);
