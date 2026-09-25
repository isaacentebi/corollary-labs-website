// Renders the still plates (research images) and the social image once, so pages need no second WebGL
// context. Every study is frontal: light on the picture plane, after one work (see ROUND4.md).
// Run: node scripts/make-plates.mjs   (writes public/plates/*.webp and public/og.png)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const PUB = path.join(path.dirname(new URL(import.meta.url).pathname), '../public');
fs.mkdirSync(path.join(PUB, 'plates'), { recursive: true });

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255) ** 2.2); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const add = (a, b, k) => a.map((v, i) => v + b[i] * k);
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const P = {
  abyss: hex('#0b1522'), abyssLow: hex('#130f29'), blue: hex('#2a6fe0'), violet: hex('#4a33b8'), core: hex('#c4e6ff'),
  emberBlack: hex('#1c0805'), ember: hex('#d9542a'), emberFill: hex('#ff8a4c'), emberCore: hex('#ffc08a'),
  violetDeep: hex('#150a26'), lilac: hex('#8f6fe6'), rose: hex('#d9588f'), cyan: hex('#3f8fe0'),
  smoke: hex('#0d1a14'), smokeGlow: hex('#3f6e52'), amber: hex('#f0a84e'), amberCore: hex('#ffdca0'),
  neutral: hex('#1e1e23'),
  bands: ['#a2342b', '#b86a1f', '#2f6d4a', '#2b4f9e', '#5b3a8e', '#1d6a70', '#8a2f5c'].map(hex),
};

// (u, v) in 0..1 with v down; a = aspect
const studies = {
  // Ando, "Meditation Blue Black": a band of light across a blue-black field, both sides glowing
  line: (u, v) => {
    const d = 0.62 - v;
    let c = mix(P.abyssLow, P.abyss, 1 - v);
    c = add(c, d > 0 ? P.blue : P.violet, Math.exp(-Math.abs(d) / 0.09) * 0.55);
    return add(c, P.core, Math.exp(-((d / 0.004) ** 2)) * 0.9);
  },
  // Pashgian: a disc that fills with light below its meniscus
  meniscus: (u, v, a) => {
    const x = (u - 0.5) * a, y = 0.5 - v, r = Math.hypot(x, y) / 0.3;
    let c = add(P.emberBlack, P.ember, Math.exp(-(x * x + y * y) / 0.12) * 0.15);
    const lineD = y - 0.0;
    c = add(c, P.emberCore, Math.exp(-((lineD / 0.004) ** 2)) * 0.8);
    if (r < 1) {
      const ym = 0.12 + 0.03 * (x / 0.3) ** 2;
      let s = add(P.emberBlack, P.ember, 0.2);
      if (y < ym) s = add(s, P.emberFill, 0.6 + 0.4 * Math.exp(-(ym - y) / 0.1));
      s = add(s, P.emberCore, Math.exp(-(((y - ym) / 0.004) ** 2)) * 0.8);
      c = mix(c, s, 1 - ss(0.985, 1.015, r));
    }
    return c;
  },
  // Niesche's voile: soft fields screened together
  voile: (u, v, a) => {
    const x = (u - 0.5) * a, y = 0.5 - v;
    let c = P.violetDeep;
    for (const [cx, cy, rx, ry, col] of [[-0.14, 0.04, 0.26, 0.36, P.lilac], [0.08, -0.04, 0.24, 0.34, P.rose], [0.2, 0.06, 0.24, 0.32, P.cyan]]) {
      const d = Math.pow(Math.abs((x - cx) / rx) ** 2.4 + Math.abs((y - cy) / ry) ** 2.4, 1 / 2.4) - 1;
      const al = 1 - ss(-0.7, 0.35, d);
      c = c.map((q, i) => 1 - (1 - q) * (1 - col[i] * al * 0.62));
    }
    return c;
  },
  // Evertz / Pastine: soft vertical bands, each turned to its own hue, outward from the line
  bands: (u, v) => {
    const n = P.bands.length, f = u * n, i = Math.min(n - 1, Math.floor(f)), fr = f - i;
    const turn = [1, 0.8, 1, 0.5, 1, 0.9, 0.3][i];
    const cover = ss(-0.02, 0.14, turn * 1.2 - Math.abs(0.55 - v) * 1.1);
    let c = mix(P.neutral, P.bands[i], cover);
    const j = Math.min(n - 1, i + 1);
    const c2 = mix(P.neutral, P.bands[j], ss(-0.02, 0.14, [1, 0.8, 1, 0.5, 1, 0.9, 0.3][j] * 1.2 - Math.abs(0.55 - v) * 1.1));
    c = mix(c, c2, ss(0.78, 1.0, fr) * 0.5);
    return add(c, P.core, Math.exp(-(((v - 0.55) / 0.004) ** 2)) * 0.5);
  },
  // Pashgian's smoky green; the amber line cut, light pooling at the ends
  cut: (u, v, a) => {
    const x = (u - 0.5) * a, y = 0.5 - v;
    let c = add(P.smoke, P.smokeGlow, Math.exp(-(y * y) / 0.05) * 0.25);
    const yl = 0.06 * Math.sin(x * 3 + 0.6);
    const d = y - yl;
    const gap = ss(0.06, 0.066, Math.abs(x - 0.05));
    c = add(c, P.amber, Math.exp(-Math.abs(d) / 0.06) * 0.35 * (0.3 + 0.7 * gap));
    c = add(c, P.amberCore, Math.exp(-((d / 0.005) ** 2)) * gap);
    for (const ex of [-0.01, 0.11]) c = add(c, P.amberCore, Math.exp(-((x - ex) ** 2 + d * d) / 0.0006) * 1.2);
    return c;
  },
};

function render(name, w, h, file, fmt = 'webp') {
  const fn = studies[name];
  const buf = Buffer.alloc(w * h * 3);
  const a = w / h;
  let i = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn((x + 0.5) / w, (y + 0.5) / h, a);
    const n = (rnd() + rnd() - 1) * 1.6;
    for (let k = 0; k < 3; k++) buf[i++] = Math.max(0, Math.min(255, Math.round(Math.pow(Math.min(c[k], 0.9), 1 / 2.2) * 255 + n)));
  }
  const img = sharp(buf, { raw: { width: w, height: h, channels: 3 } });
  return (fmt === 'png' ? img.png() : img.webp({ quality: 90 })).toFile(file);
}

await Promise.all([
  ...Object.keys(studies).map((n) => render(n, 1200, 800, path.join(PUB, 'plates', `${n}-1200x800.webp`))),
  render('line', 1200, 630, path.join(PUB, 'og.png'), 'png'),
]);
console.log('plates written');
