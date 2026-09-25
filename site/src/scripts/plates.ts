// Plates (research thumbnails, essay figures, team images) are still frames from the rooms, drawn once
// per size by the same shader as the page's light, on one shared offscreen canvas, then copied.
import { LightField } from './light/engine';
import { states, nightHorizon, type Env } from './light/states';
import { layoutField } from './light/diffusion';
import { pack } from './light/params';

let renderer: LightField | null = null;

function paint(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(rect.width * scale), h = Math.round(rect.height * scale);
  if (canvas.width === w && canvas.height === h && canvas.dataset.painted) return;
  const name = canvas.dataset.plate || 'plate-column';
  const fn = states[name] ?? states['plate-column'];
  const a = w / h;
  const env: Env = { a, m: false, ox: 0, nodeSeed: [0, 0, 0.02], plate: true };
  if (!renderer) {
    renderer = new LightField(document.createElement('canvas'), { scale: 1 });
    if (!renderer.ok) return;
  }
  const fl = layoutField(a, nightHorizon({ m: false, ox: 0 }), 0);
  renderer.nodes = fl.nodes;
  renderer.still(w, h, pack(fn(0, env)));
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')?.drawImage(renderer.canvas, 0, 0);
  canvas.dataset.painted = '1';
}

export function paintPlates() {
  const plates = [...document.querySelectorAll<HTMLCanvasElement>('canvas[data-plate]')];
  if (!plates.length) return;
  const run = () => plates.forEach(paint);
  run();
  let t = 0;
  window.addEventListener('resize', () => { clearTimeout(t); t = window.setTimeout(run, 200); });
}
