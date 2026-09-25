// Small still plates (research index, essays, team). Painted once per size into a 2D canvas, pixel by
// pixel, with dithering so the gradients do not band. Each kind follows one reference:
//   volume   — Niesche: squircle core, pale crossing ring, coloured edge
//   horizon  — Brindle: flat pale field that surges to a thin saturated line
//   fold     — Menchelli: a gradient restarting at a lit diagonal crease
//   crossing — Pastine: two complementaries meeting through a neutral lighter than both
type RGB = [number, number, number];
const hex = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255) ** 2.2) as RGB; };
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const P: Record<string, RGB[]> = {
  dusk: ['#8f8fd8', '#3246c8', '#2f5bff', '#0c1233', '#fbf1ea'].map(hex),
  blossom: ['#ff8a47', '#f6a08c', '#c3a6ec', '#fbf1ea', '#eeebe6'].map(hex),
  emerald: ['#0d3b2c', '#1fc9a0', '#e9f3ee', '#c7a3d6', '#eeebe6'].map(hex),
  sunset: ['#280506', '#a75332', '#ffc46b', '#ffe6c7', '#eeebe6'].map(hex),
  cross: ['#e1711c', '#d8d6cf', '#6fbae5', '#eeebe6', '#ffffff'].map(hex),
  silver: ['#e9ecf0', '#c9d2e4', '#1c3fd6', '#ffffff', '#eeebe6'].map(hex),
};

function shade(kind: string, pal: RGB[], u: number, v: number, ar: number): RGB {
  switch (kind) {
    case 'volume': {
      const x = (u - 0.5) * 2, y = (v - 0.5) * 2 * ar;
      const n = 3.2, rx = 0.78, ry = 0.78 * ar;
      const r = Math.pow(Math.pow(Math.abs(x) / rx, n) + Math.pow(Math.abs(y) / ry, n), 1 / n);
      let c = mix(pal[0], pal[1], ss(0.0, 0.62, r));
      c = mix(c, pal[2], ss(0.55, 1.0, r));
      const ring = Math.exp(-(((r - 0.66) / 0.14) ** 2));
      c = mix(c, pal[3], ring * 0.75);
      const edge = ss(0.98, 1.02, r);
      return mix(c, pal[4], edge);
    }
    case 'horizon': {
      const h = 0.58;
      const above = v < h;
      const k = above ? Math.pow(ss(0, h, v), 6) : Math.pow(1 - ss(h, 1, v), 5);
      let c = mix(pal[0], pal[1], k * 0.85);
      c = mix(c, pal[2], Math.exp(-(((v - h) / 0.006) ** 2)));
      c = mix(c, pal[3], Math.exp(-(((v - h - 0.012) / 0.005) ** 2)) * 0.9);
      return c;
    }
    case 'fold': {
      const d = v * 1.0 + u * 0.32;
      const bands = 2.2;
      const t = (d * bands) % 1;
      let c = mix(pal[0], pal[1], ss(0, 0.75, t));
      c = mix(c, pal[2], ss(0.7, 0.98, t));
      const crease = Math.exp(-(((1 - t) / 0.012) ** 2));
      return mix(c, pal[3], crease * 0.9);
    }
    default: {
      const t = u * 0.85 + v * 0.15;
      let c = mix(pal[0], pal[1], ss(0.05, 0.5, t));
      c = mix(c, pal[2], ss(0.5, 0.95, t));
      const neutral = Math.exp(-(((t - 0.5) / 0.09) ** 2));
      return mix(c, pal[4], neutral * 0.5);
    }
  }
}

function paint(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.75;
  const w = Math.max(8, Math.round(rect.width * scale)), h = Math.max(8, Math.round(rect.height * scale));
  if (canvas.width === w && canvas.height === h && canvas.dataset.painted) return;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(w, h);
  const kind = canvas.dataset.plate || 'volume';
  const pal = P[canvas.dataset.palette || 'blossom'] || P.blossom;
  const ar = h / w;
  let i = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = shade(kind, pal, (x + 0.5) / w, (y + 0.5) / h, ar);
      const n = (Math.random() + Math.random() - 1) * 1.4;
      img.data[i++] = Math.pow(c[0], 1 / 2.2) * 255 + n;
      img.data[i++] = Math.pow(c[1], 1 / 2.2) * 255 + n;
      img.data[i++] = Math.pow(c[2], 1 / 2.2) * 255 + n * 1.3;
      img.data[i++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  canvas.dataset.painted = '1';
}

export function paintPlates() {
  const plates = [...document.querySelectorAll<HTMLCanvasElement>('canvas[data-plate]')];
  if (!plates.length) return;
  const run = () => plates.forEach(paint);
  run();
  let t = 0;
  window.addEventListener('resize', () => { clearTimeout(t); t = window.setTimeout(run, 150); });
}
