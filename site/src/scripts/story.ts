// Home: one short scroll (three continuous states) drives the field.
// 0 · the name over a random field of loops; one agent's loop is already lit, tiles keep turning
// 1 · the camera closes in on a second tile; it becomes an agent; the tiles around it turn and its loop grows and fills
// 2 · the camera pulls out; a wave of quarter-turns crosses the field, a few new agents appear where it passes,
//     colour percolates through whatever becomes connected; the plane twists and untwists.
// After the story the camera follows the page, so the content panels sit on whole tiles.
import { LoopField } from './field';
import { rng, components } from '../lib/truchet';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const HOME_SEED = 11;

export function story(f: LoopField, k: Int8Array) {
  const el = document.querySelector<HTMLElement>('[data-story]');
  if (!el) return () => {};
  const beats = [...el.querySelectorAll<HTMLElement>('[data-beat]')];
  const meter = el.querySelector<HTMLElement>('[data-meter]');
  const N = LoopField.N, M = LoopField.M, C = 32;
  const centre = LoopField.idx(C, C);
  const cx = C + 0.5, cy = C + 0.5;
  const small = innerWidth < 700;
  const c0 = small ? 30 : 44;

  // the hero agent: a tile in the upper right whose loop is a good size
  const { comp, size } = components(N, M, Array.from(k));
  let hero = -1, best = 0;
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
    const x = innerWidth / 2 + (i + 0.5 - cx) * c0, y = innerHeight / 2 + (j + 0.5 - cy) * c0;
    if (x < innerWidth * (small ? 0.25 : 0.55) || x > innerWidth * 0.9 || y < innerHeight * 0.16 || y > innerHeight * (small ? 0.45 : 0.42)) continue;
    const t = j * N + i, s = (size.get(comp[t * 2]) || 0) + (size.get(comp[t * 2 + 1]) || 0);
    if (s <= 70 && s > best) { best = s; hero = t; }
  }
  // the second agent's reorganisation, planned on the page's pattern
  const chosen = f.plan(centre, 3, (t) => k[t]);
  const ring: [number, number][] = [], wave: [number, number][] = [], agents: [number, number][] = [];
  const planned = new Set(chosen.map(([t]) => t));
  chosen.forEach(([t, dx, dy]) => {
    const a = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI), d = Math.max(Math.abs(dx), Math.abs(dy));
    ring.push([t, 0.22 + 0.13 * ((a + d - 1) / 3)]);
  });
  const r = rng(77), dmax = Math.hypot(N / 2, M / 2);
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
    const t = j * N + i;
    let sx = i - C, sy = j - C;
    if (sx > N / 2) sx -= N; if (sx < -N / 2) sx += N;
    if (sy > M / 2) sy -= M; if (sy < -M / 2) sy += M;
    const cheb = Math.max(Math.abs(sx), Math.abs(sy)), d = Math.hypot(sx, sy);
    if (cheb <= 4) { f.protect[t] = 1; continue; }
    if (planned.has(t) || t === hero) continue;
    const pc = 0.43 + 0.36 * (d / dmax) + (r() - 0.5) * 0.03;
    if (r() < 0.34) wave.push([t, pc + ((i + j) % 2) * 0.012]);
    if (cheb > 6 && r() < 0.003) agents.push([t, pc + 0.015]);
  }
  if (hero >= 0) {
    f.protect[hero] = 1;
    setTimeout(() => f.enter(hero), f.reduced ? 0 : 900);
  }
  const span = () => Math.max(1, el.offsetHeight - innerHeight);
  f.scrollPx = () => Math.max(0, scrollY - span());
  const c2 = () => f.minCell * 1.02;
  document.documentElement.style.setProperty('--cell', `${c2().toFixed(2)}px`);

  let ps = -1, last = performance.now();
  // each scheduled tile turns over a fixed time once scroll passes its threshold (and back if scroll returns)
  const prog = new Float32Array(N * M);
  const onFrame = (f: LoopField) => {
    const p = clamp01(scrollY / span());
    ps = ps < 0 || f.reduced ? p : lerp(ps, p, 0.14);
    if (Math.abs(ps - p) > 0.0005) f.keepAwake = true;
    const c1 = Math.min(innerWidth, innerHeight) / (small ? 3.4 : 4.6);
    const zin = ease(clamp01((ps - 0.08) / 0.24)), zout = ease(clamp01((ps - 0.42) / 0.36));
    const lc = Math.log(c0) + (Math.log(c1) - Math.log(c0)) * zin;
    const cell = Math.exp(lc + (Math.log(c2()) - lc) * zout);
    f.viewT.cell = cell; f.viewT.camX = cx; f.viewT.camY = cy;
    f.viewT.rot = -0.2 * zout * (1 - ease(clamp01((ps - 0.84) / 0.16)));
    const close = zin * (1 - zout);
    f.viewT.w = 0.17 - 0.05 * close;
    f.pulseT = 0.3 * (1 - close);
    f.alwaysLive = ps < 0.985;
    // agents
    const want = ps > 0.19;
    if ((f.agentT[centre] > 0.5) !== want) f.setAgent(centre, want);
    for (const [t, pc] of agents) { const on = ps > pc; if ((f.agentT[t] > 0.5) !== on) f.setAgent(t, on); }
    // p-driven quarter-turns (each takes a fixed time once its threshold is passed)
    const nowMs = performance.now(), dt = Math.min(0.1, (nowMs - last) / 1000); last = nowMs;
    const stepT = f.reduced ? 1 : dt / 0.42;
    for (const list of [ring, wave]) for (const [t, pc] of list) {
      const target = ps > pc ? 1 : 0, cur = prog[t];
      if (cur !== target) { prog[t] = target > cur ? Math.min(1, cur + stepT) : Math.max(0, cur - stepT); f.keepAwake = true; }
      f.extra[t] = ease(prog[t]);
    }
    // the twist: an isotopy of the plane, out and back
    const sw = clamp01((ps - 0.6) / 0.36);
    f.swirl[0] = cx; f.swirl[1] = cy; f.swirl[2] = f.reduced ? 0 : 1.8 * Math.sin(Math.PI * sw); f.swirl[3] = small ? 10 : 14;
    // text beats
    const on = [ps < 0.09, ps > 0.24 && ps < 0.42, ps > 0.6 && ps < 0.95];
    beats.forEach((b) => b.classList.toggle('on', on[+(b.dataset.beat || 0)]));
    if (meter) { meter.style.transform = `scaleX(${ps.toFixed(4)})`; meter.style.opacity = ps > 0.97 ? '0' : '1'; }
  };
  f.onFrame = onFrame;
  f.wake();
  return () => {
    if (f.onFrame === onFrame) f.onFrame = null;
    f.swirl[2] = 0; f.viewT.rot = 0; f.alwaysLive = false; f.scrollPx = () => scrollY;
  };
}
