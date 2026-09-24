// Home: one short scroll (three continuous states) drives the field.
// 0 · the name over a regular field of small closed loops
// 1 · the camera closes in; one tile becomes an agent; the tiles around it turn and its loop fills
// 2 · the camera pulls out; a wave of quarter-turns crosses the field, new agents appear where it passes,
//     colour percolates through whatever becomes connected; the plane twists and untwists.
import { LoopField } from './field';
import { rng, components } from '../lib/truchet';

/** Which tiles around the agent to turn so that the agent's loop becomes as large as possible (greedy, on a 9×9 patch). */
function reorganise(R = 3): Set<string> {
  const n = 2 * R + 3, o = R + 1;             // patch with one spare ring; the agent sits at (o, o)
  const base = (i: number, j: number) => (i + j) % 2; // lattice parity (patch origin has even parity with the field)
  const flipped = new Set<string>();
  const size = () => {
    const k = [] as number[];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) k.push(base(i, j) + (flipped.has(`${i - o},${j - o}`) ? 1 : 0));
    const { comp, size } = components(n, n, k);
    const t = o * n + o, a = comp[t * 2], b = comp[t * 2 + 1];
    return (size.get(a) || 0) + (a === b ? 0 : size.get(b) || 0) + (a === b ? 6 : 0);
  };
  let best = size();
  for (let pass = 0; pass < 4; pass++) {
    let improved = false;
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      if (!di && !dj) continue;
      const key = `${di},${dj}`;
      if (flipped.has(key)) flipped.delete(key); else flipped.add(key);
      const s = size();
      if (s > best) { best = s; improved = true; } else if (flipped.has(key)) flipped.delete(key); else flipped.add(key);
    }
    if (!improved) break;
  }
  return flipped;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function story(f: LoopField) {
  const el = document.querySelector<HTMLElement>('[data-story]');
  if (!el) return () => {};
  const beats = [...el.querySelectorAll<HTMLElement>('[data-beat]')];
  const meter = el.querySelector<HTMLElement>('[data-meter]');
  const N = LoopField.N, M = LoopField.M, C = 32;
  const centre = LoopField.idx(C, C);
  const cx = C + 0.5, cy = C + 0.5;
  const r = rng(77);
  const ring: [number, number][] = [], wave: [number, number][] = [], agents: [number, number][] = [];
  const dmax = Math.hypot(N / 2, M / 2);
  const chosen = reorganise(3);
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
    const t = j * N + i;
    if (t === centre) continue;
    let sx = i - C, sy = j - C;
    if (sx > N / 2) sx -= N; if (sx < -N / 2) sx += N;
    if (sy > M / 2) sy -= M; if (sy < -M / 2) sy += M;
    const cheb = Math.max(Math.abs(sx), Math.abs(sy)), d = Math.hypot(sx, sy);
    if (cheb <= 3) {
      // the tiles around the agent turn (in a spiral) so that its loop grows through them
      if (!chosen.has(`${sx},${sy}`)) continue;
      const a = (Math.atan2(sy, sx) + Math.PI) / (2 * Math.PI);
      ring.push([t, 0.24 + 0.12 * ((a + (cheb - 1)) / 3)]);
    } else {
      const pc = 0.43 + 0.36 * (d / dmax) + (r() - 0.5) * 0.03;
      // the loop the first agent reorganised (inside radius 4) is kept; the wave rewires everything beyond it
      if (r() < 0.55 && cheb > 4) wave.push([t, pc]);
      if (cheb > 4 && r() < 0.016) agents.push([t, pc + 0.015]);
    }
  }
  let ps = -1, last = performance.now();
  // each scheduled tile turns over a fixed time once scroll passes its threshold (and back if scroll returns)
  const prog = new Float32Array(N * M);
  const onFrame = (f: LoopField) => {
    const rect = el.getBoundingClientRect();
    const span = Math.max(1, rect.height - innerHeight);
    const p = clamp01(-rect.top / span);
    ps = ps < 0 || f.reduced ? p : lerp(ps, p, 0.14);
    const small = innerWidth < 700;
    const c0 = small ? 30 : 46;
    const c1 = Math.min(innerWidth, innerHeight) / (small ? 3.4 : 4.6);
    const c2 = f.minCell * 1.02;
    const zin = ease(clamp01((ps - 0.08) / 0.24)), zout = ease(clamp01((ps - 0.42) / 0.36));
    const lc = Math.log(c0) + (Math.log(c1) - Math.log(c0)) * zin;
    const cell = Math.exp(lc + (Math.log(c2) - lc) * zout);
    f.viewT.cell = cell; f.viewT.camX = cx; f.viewT.camY = cy; f.viewT.rot = -0.2 * zout;
    // lighter strokes and a calmer pulse while the camera is close
    const close = zin * (1 - zout);
    f.viewT.w = 0.17 - 0.05 * close; f.pulseT = 0.38 - 0.3 * close;
    // agents
    const want = ps > 0.19;
    if ((f.agentT[centre] > 0.5) !== want) f.setAgent(centre, want);
    for (const [t, pc] of agents) { const on = ps > pc; if ((f.agentT[t] > 0.5) !== on) f.setAgent(t, on); }
    // p-driven quarter-turns
    const nowMs = performance.now(), dt = Math.min(0.1, (nowMs - last) / 1000); last = nowMs;
    const stepT = f.reduced ? 1 : dt / 0.6;
    for (const list of [ring, wave]) for (const [t, pc] of list) {
      const target = ps > pc ? 1 : 0, cur = prog[t];
      if (cur !== target) prog[t] = target > cur ? Math.min(1, cur + stepT) : Math.max(0, cur - stepT);
      f.extra[t] = ease(prog[t]);
    }
    // the twist: an isotopy of the plane, out and back
    const sw = clamp01((ps - 0.6) / 0.4);
    f.swirl[0] = cx; f.swirl[1] = cy; f.swirl[2] = f.reduced ? 0 : 1.8 * Math.sin(Math.PI * sw); f.swirl[3] = small ? 10 : 14;
    // text beats
    const on = [ps < 0.09, ps > 0.24 && ps < 0.42, ps > 0.6 && ps < 0.97];
    beats.forEach((b) => b.classList.toggle('on', on[+(b.dataset.beat || 0)]));
    if (meter) meter.style.transform = `scaleX(${ps.toFixed(4)})`;
  };
  f.onFrame = onFrame;
  return () => { if (f.onFrame === onFrame) f.onFrame = null; f.swirl[2] = 0; f.viewT.rot = 0; };
}
