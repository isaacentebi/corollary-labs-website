// Mounts a face: canvas, renderer, resize, render-on-demand loop, pointer disturbance.
// A director decides what the scene shows at any moment.
import { Batch, makeRenderer } from '../gl/renderer';
import { COL, Scene, type Cam, type Lean, type Wake } from './scene';

const PERF: number[][] | null = new URLSearchParams(location.search).has('perf') ? ((window as unknown as { __perf: number[][] }).__perf = []) : null;
export const motionOn = () => document.documentElement.getAttribute('data-motion') !== 'off';

export interface Frame { q: number; cam: Cam; wakes?: Wake[]; lean?: Lean | null; busy?: boolean; needleAlpha?: number; ringFade?: number; power?: number; band?: number }
export interface Director {
  build(W: number, H: number, small: boolean): Scene;
  frame(now: number): Frame;
  extras?(b: Batch, f: Frame, W: number, H: number): void;
  canPush?(f: Frame): boolean;
  pushPanels?: number[];
  onPointer?(ev: PointerEvent, wx: number, wy: number, kind: 'move' | 'leave' | 'down' | 'click'): void;
}

export interface Face {
  scene: Scene; W: number; H: number; small: boolean;
  request(): void; kickSim(): void; last: Frame | null;
  el: HTMLElement;
}

export function mountFace(el: HTMLElement, make: (face: Face) => Director): Face {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  el.prepend(canvas);
  const r = makeRenderer(canvas);
  el.dataset.renderer = r.kind;
  const batch = new Batch();
  let queued = false, simming = false, inView = true;
  const face: Face = {
    scene: new Scene(), W: 1, H: 1, small: false, last: null, el,
    request: () => { if (!queued && inView) { queued = true; requestAnimationFrame(tick); } },
    kickSim: () => { if (motionOn()) { simming = true; face.request(); } },
  };
  const dir = make(face);

  function layout() {
    const rc = el.getBoundingClientRect();
    face.W = Math.max(1, rc.width); face.H = Math.max(1, rc.height);
    face.small = face.W < 600;
    r.resize(face.W, face.H, Math.min(window.devicePixelRatio || 1, 2));
    face.scene = dir.build(face.W, face.H, face.small);
  }
  function tick(now: number) {
    queued = false;
    if (simming) simming = face.scene.simStep();
    const f = dir.frame(now);
    face.last = f;
    const t0 = performance.now();
    face.scene.compute(f.q, { wakes: f.wakes, lean: f.lean, power: f.power, band: f.band });
    const t1 = performance.now();
    batch.reset();
    face.scene.emit(batch, f.cam, f.q, face.W, face.H, { needleAlpha: f.needleAlpha, ringFade: f.ringFade });
    dir.extras?.(batch, f, face.W, face.H);
    const t2 = performance.now();
    r.draw(batch, COL.gap, COL.mark);
    if (PERF) PERF.push([t1 - t0, t2 - t1, performance.now() - t2, batch.n]);
    if (simming || f.busy) face.request();
  }

  let last: { x: number; y: number; t: number } | null = null;
  const world = (ev: PointerEvent) => {
    const rc = el.getBoundingClientRect(), cam = face.last?.cam ?? { z: 1, ox: 0, oy: 0 };
    const x = ev.clientX - rc.left, y = ev.clientY - rc.top;
    return { x, y, wx: (x - cam.ox) / cam.z, wy: (y - cam.oy) / cam.z };
  };
  el.addEventListener('pointermove', (ev) => {
    const p = world(ev), t = performance.now();
    dir.onPointer?.(ev, p.wx, p.wy, 'move');
    if (!last || !motionOn() || !face.last || !(dir.canPush?.(face.last) ?? true)) { last = { x: p.x, y: p.y, t }; return; }
    const dt = Math.max(8, t - last.t), vx = (p.x - last.x) / dt, vy = (p.y - last.y) / dt;
    last = { x: p.x, y: p.y, t };
    const s = face.scene.panels[0]?.s ?? 40;
    if (face.scene.push(p.wx, p.wy, vx, vy, s * 2.2, dir.pushPanels)) face.kickSim();
  });
  el.addEventListener('pointerleave', (ev) => { last = null; const p = world(ev); dir.onPointer?.(ev, p.wx, p.wy, 'leave'); });
  el.addEventListener('pointerdown', (ev) => { const p = world(ev); dir.onPointer?.(ev, p.wx, p.wy, 'down'); });
  el.addEventListener('click', (ev) => { const p = world(ev as PointerEvent); dir.onPointer?.(ev as PointerEvent, p.wx, p.wy, 'click'); });

  let rt = 0;
  new ResizeObserver(() => { clearTimeout(rt); rt = window.setTimeout(() => { layout(); face.request(); }, 60); }).observe(el);
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) face.request(); }).observe(el);
  window.addEventListener('motionchange', () => { face.scene.dist.fill(0); face.scene.distV.fill(0); simming = false; face.request(); });
  layout();
  queued = true; tick(performance.now());
  return face;
}

/** Time helper for load animations: returns 0..1 over `dur` ms after `start`. */
export const since = (now: number, start: number, dur: number) => Math.min(1, Math.max(0, (now - start) / dur));
export const ease3 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
