// Samples the name as a point cloud, laid out for a full-viewport canvas. Shared by the intro and the
// hero field so the intro's assembled name lands exactly where the field's name lives.
import { site } from '../config/site';

export const loadWordFonts = () => Promise.all([document.fonts.load('360 100px "Fraunces Soft"'), Promise.resolve()]).catch(() => {});

export interface WordLayout { text?: string; wFrac?: number; hFrac?: number; baseFrac?: number }
export function sampleWord(w: number, h: number, L: WordLayout = {}) {
  const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h);
  const g = c.getContext('2d')!;
  const mobile = w < 700;
  // phones: stack the name so it can be large
  const lines = (L.text ?? (mobile ? site.name.replace(' ', '\n') : site.name)).split('\n');
  let S = 100;
  g.font = `360 ${S}px "Fraunces Soft"`;
  const ratio = Math.max(...lines.map((t) => g.measureText(t).width)) / S;
  const lh = 0.92;
  S = Math.min((w * (L.wFrac ?? (mobile ? 0.86 : 0.8))) / ratio, (h * (L.hFrac ?? (mobile ? 0.5 : 0.36))) / (1 + (lines.length - 1) * lh));
  g.font = `360 ${S}px "Fraunces Soft"`;
  const ww = Math.max(...lines.map((t) => g.measureText(t).width));
  const x0 = (w - ww) / 2;
  const base = h * (L.baseFrac ?? (mobile ? 0.5 : 0.58)) - ((lines.length - 1) * lh * S) / 2;
  g.fillStyle = '#000';
  lines.forEach((t, i) => g.fillText(t, x0, base + i * lh * S));
  const tw = 0;
  const step = Math.max(3, Math.round(S / 58)); // denser point cloud → clearer name
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const pts: number[] = [];
  for (let y = 0; y < c.height; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < c.width; x += step) {
    const xi = x | 0; if (data[(y * c.width + xi) * 4 + 3] > 140) pts.push(xi, y);
  }
  return { pts: Float32Array.from(pts), step, box: [x0, base - S * 0.8, ww + tw, S] as const };
}
