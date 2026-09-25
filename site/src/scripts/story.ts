// Home: one field under the whole page.
// Hero · the name and the statement over a random field of loops; one agent's loop is lit and keeps growing; tiles keep turning.
// Approach · a short pinned stage (about 1.3 screens of scroll) tells four beats on the same field:
//   01 the organisation (the field as it is) · 02 an agent enters (the camera closes in on a tile, it becomes an agent)
//   03 it reorganises (the tiles around it turn so its loop grows and fills)
//   04 the change spreads (the camera pulls out; a wave of quarter-turns crosses the field, new agents appear, colour
//      percolates through whatever becomes connected; the plane twists and untwists).
// Outside the stage the field moves exactly with the page, so content panels sit on whole tiles.
import { LoopField } from './field';
import { rng, components } from '../lib/truchet';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (d: number, n: number) => ((((d + n / 2) % n) + n) % n) - n / 2;
export const HOME_SEED = 11;

/** Home camera: the field scrolls with the page, holds still while the approach stage is pinned, then scrolls on at the new scale. */
function geometry(f: LoopField) {
  const el = document.querySelector<HTMLElement>('[data-story]');
  const small = innerWidth < 700;
  const c0 = small ? 30 : 44, cy = 32.5;
  const c2 = () => f.minCell * 1.02;
  const top = () => (el ? el.getBoundingClientRect().top + scrollY : 1e9);
  const span = () => (el ? Math.max(1, el.offsetHeight - innerHeight) : 1);
  // the hero's camera row: chosen so that the stage centre lands on the story's centre tile when it pins
  const heroY = () => cy - top() / c0;
  // grid rows scrolled so far: with the page before the stage, held while pinned, with the page (at the new scale) after
  const gridOff = () => {
    const a = top(), s = span(), y = scrollY;
    return y < a ? y / c0 : y < a + s ? a / c0 : a / c0 + (y - a - s) / c2();
  };
  return { el, small, c0, c2, top, span, heroY, gridOff };
}

/** Called before the home mode is applied, so the page's arrival wave starts from the hero's view. */
export function homeCamera(f: LoopField): [number, number] {
  const g = geometry(f);
  // the panel padding follows the tile size: fix it before anything is measured
  document.documentElement.style.setProperty('--cell', `${g.c2().toFixed(2)}px`);
  f.scrollPx = () => g.gridOff() * f.view.cell;
  return [32.5, g.heroY()];
}

export function story(f: LoopField, k: Int8Array) {
  const { el, small, c0, c2, top, span, heroY, gridOff } = geometry(f);
  if (!el) return () => {};
  const steps = [...el.querySelectorAll<HTMLElement>('[data-step]')];
  const meter = el.querySelector<HTMLElement>('[data-meter]');
  const N = LoopField.N, M = LoopField.M, C = 32;
  const centre = LoopField.idx(C, C);
  const cx = C + 0.5, cy = C + 0.5;
  f.scrollPx = () => gridOff() * f.view.cell;
  f.view.camX = f.viewT.camX = cx;
  f.view.camY = f.viewT.camY = heroY();
  f.view.cell = f.viewT.cell = c0;

  // the hero agent: a tile in open field (right of the text on wide screens, above it on phones), with a loop of good size
  const { comp, size } = components(N, M, Array.from(k));
  const y0 = heroY();
  let hero = -1, best = 0;
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
    const x = innerWidth / 2 + wrap(i + 0.5 - cx, N) * c0, y = innerHeight / 2 + wrap(j + 0.5 - y0, M) * c0;
    const ok = small
      ? x > innerWidth * 0.2 && x < innerWidth * 0.8 && y > innerHeight * 0.14 && y < innerHeight * 0.3
      : x > innerWidth * 0.6 && x < innerWidth * 0.86 && y > innerHeight * 0.2 && y < innerHeight * 0.5;
    if (!ok) continue;
    const t = j * N + i, s = (size.get(comp[t * 2]) || 0) + (size.get(comp[t * 2 + 1]) || 0);
    if (s <= 70 && s > best) { best = s; hero = t; }
  }

  // the story agent's reorganisation, planned on the page's pattern
  const chosen = f.plan(centre, 3, (t) => k[t]);
  const ring: [number, number][] = [], wave: [number, number][] = [], agents: [number, number][] = [];
  const planned = new Set(chosen.map(([t]) => t));
  chosen.forEach(([t, dx, dy]) => {
    const a = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI), d = Math.max(Math.abs(dx), Math.abs(dy));
    ring.push([t, 0.3 + 0.13 * ((a + d - 1) / 3)]);
  });
  const r = rng(77), dmax = Math.hypot(N / 2, M / 2);
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
    const t = j * N + i;
    const sx = wrap(i - C, N), sy = wrap(j - C, M);
    const cheb = Math.max(Math.abs(sx), Math.abs(sy)), d = Math.hypot(sx, sy);
    if (cheb <= 4) { f.protect[t] = 1; continue; }
    if (planned.has(t) || t === hero) continue;
    const pc = 0.5 + 0.32 * (d / dmax) + (r() - 0.5) * 0.03;
    if (r() < 0.28) wave.push([t, pc + ((i + j) % 2) * 0.012]);
    if (cheb > 6 && r() < 0.002) agents.push([t, pc + 0.015]);
  }
  const timers: number[] = [];
  if (hero >= 0) {
    f.protect[hero] = 1;
    // it enters, then its loop keeps growing outward in two more steps (about 3.5 s in all)
    if (f.reduced) f.enter(hero, 4);
    else { timers.push(window.setTimeout(() => f.enter(hero, 2), 600), window.setTimeout(() => f.enter(hero, 3), 1900), window.setTimeout(() => f.enter(hero, 4), 3100)); }
  }

  let ps = -1, last = performance.now(), heroAgent = true;
  // each scheduled tile turns over a fixed time once scroll passes its threshold (and back if scroll returns)
  const prog = new Float32Array(N * M);
  const onFrame = (f: LoopField) => {
    const a = top(), s = span();
    const p = clamp01((scrollY - a) / s);
    ps = ps < 0 || f.reduced ? p : lerp(ps, p, 0.14);
    if (Math.abs(ps - p) > 0.0005) f.keepAwake = true;
    const c1 = Math.min(innerWidth, innerHeight) / (small ? 3.4 : 4.6);
    const zin = ease(clamp01((ps - 0.05) / 0.2)), zout = ease(clamp01((ps - 0.46) / 0.34));
    const lc = Math.log(c0) + (Math.log(c1) - Math.log(c0)) * zin;
    f.viewT.cell = Math.exp(lc + (Math.log(c2()) - lc) * zout);
    f.view.camX = f.viewT.camX = cx;
    f.view.camY = f.viewT.camY = heroY();
    f.view.rot = f.viewT.rot = -0.2 * zout * (1 - ease(clamp01((ps - 0.8) / 0.12)));
    const close = zin * (1 - zout);
    f.viewT.w = 0.17 - 0.05 * close;
    f.pulseT = 0.3 * (1 - close);
    // live while the hero or the stage is on screen; idle (no redraw) elsewhere
    const heroOn = scrollY < innerHeight * 0.9, stageOn = scrollY > a - innerHeight && scrollY < a + s + innerHeight * 0.5;
    f.alwaysLive = heroOn || (stageOn && ps < 0.985);
    // the hero's agent only while the hero is near: the approach begins from an unlit organisation
    const hw = scrollY < a - innerHeight;
    if (hero >= 0 && hw !== heroAgent) { heroAgent = hw; f.setAgent(hero, hw); }
    // agents
    const want = ps > 0.17;
    if ((f.agentT[centre] > 0.5) !== want) f.setAgent(centre, want);
    for (const [t, pc] of agents) { const on = ps > pc; if ((f.agentT[t] > 0.5) !== on) f.setAgent(t, on); }
    // p-driven quarter-turns (each takes a fixed time once its threshold is passed)
    const nowMs = performance.now(), dt = Math.min(0.1, (nowMs - last) / 1000); last = nowMs;
    const stepT = f.reduced ? 1 : dt / 0.3;
    for (const list of [ring, wave]) for (const [t, pc] of list) {
      const target = ps > pc ? 1 : 0, cur = prog[t];
      if (cur !== target) { prog[t] = target > cur ? Math.min(1, cur + stepT) : Math.max(0, cur - stepT); f.keepAwake = true; }
      f.extra[t] = ease(prog[t]);
    }
    // the twist: an isotopy of the plane, out and back
    const sw = clamp01((ps - 0.6) / 0.36);
    f.swirl[0] = cx; f.swirl[1] = cy; f.swirl[2] = f.reduced ? 0 : 1.8 * Math.sin(Math.PI * sw); f.swirl[3] = small ? 10 : 14;
    // legend: the current beat
    const beat = ps < 0.16 ? 0 : ps < 0.3 ? 1 : ps < 0.47 ? 2 : 3;
    steps.forEach((b, i) => b.classList.toggle('on', i === beat));
    if (meter) meter.style.transform = `scaleX(${ps.toFixed(4)})`;
  };
  f.onFrame = onFrame;
  f.wake();
  return () => {
    timers.forEach(clearTimeout);
    if (f.onFrame === onFrame) f.onFrame = null;
    f.swirl[2] = 0; f.viewT.rot = 0; f.alwaysLive = false; f.scrollPx = () => scrollY;
  };
}
