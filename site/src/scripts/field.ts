// The home instrument. A field of small gauges (one needle each) on a graphite face.
//
// State 1: equilibrium. Push the needles with the pointer and they swing and return:
//          a disturbance the system absorbs (feedback, coupled to neighbours).
// State 2: an agent enters along the flow (the signal-coloured lamp).
// State 3: its set point changes the equilibrium itself. A damped step travels outward;
//          needles swing past their new position and settle into a new arrangement
//          organised around the agent. Needles tint while they are moving.
// State 4: the face pulls back: this organisation is one of many linked panels.
//          The change spreads panel to panel, and across their shared edges.
//
// Everything is a pure function of scroll progress (scrubbable both ways), plus the
// transient pointer disturbance. Frames render only on demand.

import { baseAngle, flowParams, swirl, step, stepRate, rng, HOLD, type FlowParams } from '../lib/fieldmath';
import { motionOn } from './controls';

const story = document.querySelector<HTMLElement>('[data-story]');
const face = document.querySelector<HTMLElement>('[data-face]');
const canvas = document.querySelector<HTMLCanvasElement>('[data-field]');
const scaleEl = document.querySelector<HTMLElement>('[data-scale]');
const captionEl = document.querySelector<HTMLElement>('[data-caption]');

if (story && face && canvas) init(story, face, canvas);

function init(story: HTMLElement, face: HTMLElement, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const stops = [0, 0.3, 0.62, 1];
  const captions: { caption: string }[] = JSON.parse(captionEl?.dataset.captions || '[]');

  // timeline (progress units)
  const T = { enterA: 0.09, enterB: 0.29, settle: 0.305, zoomA: 0.63, zoomB: 0.84, spreadA: 0.69, spreadB: 0.97 };

  const C = {
    face: '#1c1d1f', gap: '#141516',
    needle: [220, 218, 212], signal: [242, 191, 27],
  };

  interface Panel { x: number; y: number; col: number; row: number; flow: FlowParams; agent: number; near: number[]; n0: number; n1: number }
  interface Agent { x: number; y: number; u: number; v: number; T: number; c: number; w: number; z: number; panel: number; needle: number }

  let W = 0, H = 0, dpr = 1, N = 5, gap = 0, s = 44, L = 1, cols = 0, rows = 0, zEnd = 0.2;
  let panels: Panel[] = [], agents: Agent[] = [];
  let nx = new Float32Array(0), ny = nx, bx = nx, by = nx, theta = nx, level = new Uint8Array(0), npanel = new Uint16Array(0);
  let main = 0;
  // pointer disturbance on the main panel
  let dist = new Float32Array(0), distV = new Float32Array(0), nbr: Int32Array = new Int32Array(0);
  let userAgent: { u: number; v: number } | null = null;
  let p = 0;

  function layout() {
    const r = face.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const small = W < 600;
    N = small ? 3 : 5;
    s = small ? 36 : W > 1300 ? 48 : 44;
    L = Math.min(W, H);
    gap = L * (small ? 0.09 : 0.07);
    cols = Math.max(5, Math.round(W / s)); rows = Math.max(5, Math.round(H / s));
    const wallW = N * W + (N - 1) * gap, wallH = N * H + (N - 1) * gap;
    zEnd = Math.min(W / wallW, H / wallH) * 0.94;

    const c = (N - 1) / 2;
    const R = rng(4242);
    panels = []; agents = [];
    for (let row = 0; row < N; row++) for (let col = 0; col < N; col++) {
      const idx = panels.length;
      const isMain = col === c && row === c;
      if (isMain) main = idx;
      const flow = flowParams(idx + 3, isMain ? -0.06 : (R() - 0.5) * 0.5);
      panels.push({ x: (col - c) * (W + gap) - W / 2, y: (row - c) * (H + gap) - H / 2, col, row, flow, agent: idx, near: [], n0: 0, n1: 0 });
      // agent position: snapped to a needle
      let u = 0.25 + R() * 0.5, v = 0.25 + R() * 0.5;
      if (isMain) { u = userAgent?.u ?? (small ? 0.5 : 0.56); v = userAgent?.v ?? (small ? 0.42 : 0.44); }
      u = (Math.min(cols - 1, Math.floor(u * cols)) + 0.5) / cols;
      v = (Math.min(rows - 1, Math.floor(v * rows)) + 0.5) / rows;
      agents.push({ u, v, x: 0, y: 0, T: Infinity, c: 16, w: 260, z: 0.3, panel: idx, needle: 0 });
    }
    // adoption order: by distance from the first organisation, with some irregularity; a few never adopt
    const order = panels.map((pl, i) => ({ i, d: i === main ? -1 : Math.hypot(pl.col - c, pl.row - c) + R() * 1.1 }))
      .sort((a, b) => a.d - b.d);
    const adopters = Math.round((N * N - 1) * 0.8);
    order.forEach((o, k) => {
      const a = agents[o.i];
      if (o.i === main) { a.T = T.settle; a.c = 5.2; a.w = 150; a.z = 0.27; return; }
      if (k > adopters) return;
      a.T = T.spreadA + ((k - 1) / Math.max(1, adopters - 1)) * (T.spreadB - T.spreadA - 0.05);
    });
    panels.forEach((pl, i) => {
      const a = agents[i];
      a.x = pl.x + a.u * W; a.y = pl.y + a.v * H;
      pl.near = panels.map((q, j) => ({ q, j })).filter(({ q }) => Math.abs(q.col - pl.col) <= 1 && Math.abs(q.row - pl.row) <= 1).map(({ j }) => j);
    });

    // needles
    const total = N * N * cols * rows;
    nx = new Float32Array(total); ny = new Float32Array(total); bx = new Float32Array(total); by = new Float32Array(total);
    theta = new Float32Array(total); level = new Uint8Array(total); npanel = new Uint16Array(total);
    let k = 0;
    panels.forEach((pl, pi) => {
      pl.n0 = k;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const u = (i + 0.5) / cols, v = (j + 0.5) / rows;
        const a = baseAngle(pl.flow, u, v);
        nx[k] = pl.x + u * W; ny[k] = pl.y + v * H; bx[k] = Math.cos(a); by[k] = Math.sin(a); npanel[k] = pi; k++;
      }
      pl.n1 = k;
      const a = agents[pi];
      a.needle = pl.n0 + Math.floor(a.v * rows) * cols + Math.floor(a.u * cols);
    });
    const m = cols * rows;
    dist = new Float32Array(m); distV = new Float32Array(m);
    nbr = new Int32Array(m * 4);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const q = j * cols + i;
      nbr[q * 4] = i > 0 ? q - 1 : -1; nbr[q * 4 + 1] = i < cols - 1 ? q + 1 : -1;
      nbr[q * 4 + 2] = j > 0 ? q - cols : -1; nbr[q * 4 + 3] = j < rows - 1 ? q + cols : -1;
    }
  }

  /* ---------- progress ---------- */
  const readProgress = () => {
    const r = story.getBoundingClientRect();
    const total = story.offsetHeight - window.innerHeight;
    return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
  };
  const stateOf = (q: number) => (q < 0.15 ? 0 : q < 0.46 ? 1 : q < 0.81 ? 2 : 3);
  // with motion off, the story moves in discrete steps
  const shown = (q: number) => (motionOn() ? q : stops[stateOf(q)]);

  const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

  /* ---------- compute ---------- */
  const sw = { x: 0, y: 0 };
  function compute(q: number) {
    // the entering lamp (main agent)
    const A = agents[main];
    const ep = clamp01((q - T.enterA) / (T.enterB - T.enterA));
    const pl = panels[main];
    const startX = pl.x - W * 0.04;
    const lx = startX + (A.x - startX) * ease(ep), ly = A.y;
    const moving = ep > 0 && ep < 1 ? Math.sin(Math.PI * ep) : 0;

    const m0 = pl.n0;
    for (let n = 0; n < theta.length; n++) {
      const P = panels[npanel[n]];
      let vx = 0, vy = 0, act = 0, keep = 1;
      for (const ai of P.near) {
        const a = agents[ai];
        if (q <= a.T) continue;
        const dx = (nx[n] - a.x) / L, dy = (ny[n] - a.y) / L;
        const d = Math.hypot(dx, dy);
        if (d > 1.35) continue;
        const tau = q - a.T - d / a.c;
        if (tau <= 0) continue;
        const settled = tau * a.z * a.w > 7;
        const R = settled ? 1 : step(tau, a.w, a.z);
        const mg = swirl(dx, dy, sw);
        vx += R * sw.x; vy += R * sw.y;
        keep *= 1 - R * HOLD * Math.exp(-((d / 0.32) ** 2));
        if (!settled) act += (Math.abs(stepRate(tau, a.w, a.z)) / a.w) * Math.min(1.4, mg) * 1.6;
      }
      if (keep < 0.05) keep = 0.05;
      let th = Math.atan2(vy + keep * by[n], vx + keep * bx[n]);
      if (moving > 0 && npanel[n] === main) {
        const dd = Math.hypot(nx[n] - lx, ny[n] - ly) / L;
        if (dd < 0.2) {
          const g = Math.exp(-((dd / 0.06) ** 2)) * moving;
          th += 1.1 * g * (ny[n] >= ly ? 1 : -1);
          act += g * 0.9;
        }
      }
      if (npanel[n] === main) th += dist[n - m0];
      theta[n] = th;
      level[n] = act < 0.06 ? 0 : Math.min(4, Math.ceil(act * 5));
    }
    // the needle under a lit lamp is not drawn
    agents.forEach((a, i) => {
      const lit = i === main ? ep >= 1 : q > a.T - 0.009;
      if (lit) level[a.needle] = 255;
    });
    return { lx, ly, ep };
  }

  /* ---------- draw ---------- */
  const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const mix = (t: number) => C.needle.map((v, i) => Math.round(v + (C.signal[i] - v) * t));
  const levelStyle = [rgba(C.needle, 0.8), rgba(mix(0.35), 0.88), rgba(mix(0.6), 0.94), rgba(mix(0.82), 1), rgba(C.signal, 1)];

  function draw() {
    const q = shown(p);
    const z = 1 + (zEnd - 1) * ease(clamp01((q - T.zoomA) / (T.zoomB - T.zoomA)));
    const { lx, ly, ep } = compute(q);
    face.classList.toggle('is-wide', z < 0.95);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.gap; ctx.fillRect(0, 0, W, H);
    const ox = W / 2, oy = H / 2;
    const X = (x: number) => ox + x * z, Y = (y: number) => oy + y * z;
    const vis = (pl: Panel) => X(pl.x + W) > -4 && X(pl.x) < W + 4 && Y(pl.y + H) > -4 && Y(pl.y) < H + 4;

    // panels
    ctx.fillStyle = C.face;
    const rad = Math.max(3, 14 * Math.min(1, z * 1.6));
    for (const pl of panels) {
      if (!vis(pl)) continue;
      ctx.beginPath(); ctx.roundRect(X(pl.x), Y(pl.y), W * z, H * z, rad); ctx.fill();
    }

    const ss = s * z;
    const ringA = clamp01((ss - 15) / 20) * 0.14;
    const head = 0.34 * ss, tail = 0.1 * ss, ringR = 0.37 * ss;
    const visible = panels.map(vis);

    if (ringA > 0.005) {
      ctx.strokeStyle = rgba(C.needle, ringA); ctx.lineWidth = 1;
      ctx.beginPath();
      for (let n = 0; n < theta.length; n++) {
        if (!visible[npanel[n]]) continue;
        const x = X(nx[n]), y = Y(ny[n]);
        ctx.moveTo(x + ringR, y); ctx.arc(x, y, ringR, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, Math.min(2.2, 0.05 * ss));
    for (let lv = 0; lv < 5; lv++) {
      ctx.strokeStyle = levelStyle[lv];
      ctx.beginPath();
      for (let n = 0; n < theta.length; n++) {
        if (level[n] !== lv || !visible[npanel[n]]) continue;
        const x = X(nx[n]), y = Y(ny[n]), c = Math.cos(theta[n]), sn = Math.sin(theta[n]);
        ctx.moveTo(x - c * tail, y - sn * tail); ctx.lineTo(x + c * head, y + sn * head);
      }
      ctx.stroke();
    }

    // lamps
    const lampR = Math.max(2.4, 0.3 * ss);
    ctx.fillStyle = rgba(C.signal, 1);
    agents.forEach((a, i) => {
      if (!visible[i]) return;
      if (i === main) {
        if (ep <= 0) return;
        ctx.beginPath(); ctx.arc(X(lx), Y(ly), lampR, 0, Math.PI * 2); ctx.fill();
        return;
      }
      const t = clamp01((q - (a.T - 0.018)) / 0.018);
      if (t <= 0) return;
      ctx.beginPath(); ctx.arc(X(a.x), Y(a.y), lampR * ease(t), 0, Math.PI * 2); ctx.fill();
    });
    // a chosen set point, before the agent enters
    if (userAgent && ep < 1) {
      const a = agents[main];
      ctx.strokeStyle = rgba(C.signal, 0.9 * (1 - ep)); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(a.x), Y(a.y), lampR + 3, 0, Math.PI * 2); ctx.stroke();
    }
  }

  /* ---------- deck: scale, lamps, caption ---------- */
  const stopEls = scaleEl ? [...scaleEl.querySelectorAll<HTMLElement>('[data-stop]')] : [];
  let lastState = -1;
  function syncDeck() {
    const st = stateOf(p);
    scaleEl?.style.setProperty('--p', String(p));
    if (st !== lastState) {
      lastState = st;
      stopEls.forEach((el, i) => { el.classList.toggle('is-on', i === st); el.querySelector('.lamp')?.classList.toggle('is-on', i === st); });
      if (captionEl && captions[st]) captionEl.textContent = captions[st].caption;
      scaleEl?.setAttribute('aria-valuetext', `State ${st + 1} of 4`);
    }
    scaleEl?.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  }

  /* ---------- scheduling: render on demand ---------- */
  let queued = false, simming = false, inView = true;
  const request = () => { if (!queued && inView) { queued = true; requestAnimationFrame(frame); } };
  function frame() {
    queued = false;
    if (simming) simStep();
    draw();
    if (simming) request();
  }

  // pointer disturbance: damped needles coupled to their neighbours; stops when quiet
  function simStep() {
    const k = 60, c = 3.4, kc = 26, dt = 1 / 60;
    let energy = 0;
    const m = dist.length;
    for (let sub = 0; sub < 2; sub++) {
      for (let i = 0; i < m; i++) {
        let sum = 0, cnt = 0;
        for (let e = 0; e < 4; e++) { const j = nbr[i * 4 + e]; if (j >= 0) { sum += dist[j]; cnt++; } }
        const acc = -k * dist[i] - c * distV[i] + kc * (sum / cnt - dist[i]);
        distV[i] += acc * dt * 0.5;
      }
      for (let i = 0; i < m; i++) { dist[i] += distV[i] * dt * 0.5; if (dist[i] > 1.5) dist[i] = 1.5; else if (dist[i] < -1.5) dist[i] = -1.5; }
    }
    for (let i = 0; i < m; i++) energy += dist[i] * dist[i] + 0.02 * distV[i] * distV[i];
    if (energy < 1e-4) { dist.fill(0); distV.fill(0); simming = false; }
  }
  const canDisturb = () => motionOn() && shown(p) < T.zoomA;

  let last: { x: number; y: number; t: number } | null = null;
  face.addEventListener('pointermove', (ev) => {
    const r = face.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top, t = performance.now();
    if (!last || !canDisturb()) { last = { x, y, t }; return; }
    const dtm = Math.max(8, t - last.t);
    const vx = (x - last.x) / dtm, vy = (y - last.y) / dtm;
    last = { x, y, t };
    const wx = x - W / 2, wy = y - H / 2; // z = 1 while disturbable
    const R2 = (s * 2.2) ** 2;
    const pl = panels[main];
    let hit = false;
    for (let n = pl.n0; n < pl.n1; n++) {
      const dx = nx[n] - wx, dy = ny[n] - wy, d2 = dx * dx + dy * dy;
      if (d2 > R2) continue;
      const f = Math.exp(-d2 / (R2 * 0.35));
      const torque = Math.cos(theta[n]) * vy - Math.sin(theta[n]) * vx;
      distV[n - pl.n0] += torque * f * 9;
      hit = true;
    }
    if (hit && !simming) { simming = true; request(); }
  });
  face.addEventListener('pointerleave', () => { last = null; });

  // choose where the agent will enter (before it has)
  face.addEventListener('click', (ev) => {
    if (shown(p) >= T.enterA) return;
    const r = face.getBoundingClientRect();
    const u = (ev.clientX - r.left) / W, v = (ev.clientY - r.top) / H;
    if (u < 0.08 || u > 0.92 || v < 0.08 || v > 0.92) return;
    userAgent = { u, v };
    const a = agents[main], pl = panels[main];
    a.u = (Math.floor(u * cols) + 0.5) / cols; a.v = (Math.floor(v * rows) + 0.5) / rows;
    a.x = pl.x + a.u * W; a.y = pl.y + a.v * H;
    a.needle = pl.n0 + Math.floor(a.v * rows) * cols + Math.floor(a.u * cols);
    if (motionOn()) {
      for (let n = pl.n0; n < pl.n1; n++) {
        const d = Math.hypot(nx[n] - a.x, ny[n] - a.y) / s;
        distV[n - pl.n0] += 7 * Math.exp(-(d * d) / 3) * ((n % 2) * 2 - 1);
      }
      simming = true;
    }
    request();
  });

  /* ---------- scale: drag, click a detent, keys ---------- */
  const scrollToP = (q: number, smooth: boolean) => {
    const top = story.getBoundingClientRect().top + window.scrollY;
    const total = story.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + q * total, behavior: smooth && motionOn() ? 'smooth' : 'auto' });
  };
  if (scaleEl) {
    const track = scaleEl.querySelector<HTMLElement>('.scale__track')!;
    const fromPointer = (ev: PointerEvent) => {
      const r = track.getBoundingClientRect();
      const vertical = r.height > r.width;
      return clamp01(vertical ? (ev.clientY - r.top) / r.height : (ev.clientX - r.left) / r.width);
    };
    let drag = false;
    scaleEl.addEventListener('pointerdown', (ev) => {
      const stop = (ev.target as HTMLElement).closest<HTMLElement>('[data-stop]');
      if (stop) { scrollToP(Number(stop.dataset.stop), true); return; }
      drag = true; scaleEl.setPointerCapture(ev.pointerId); scrollToP(fromPointer(ev), false);
    });
    scaleEl.addEventListener('pointermove', (ev) => { if (drag) scrollToP(fromPointer(ev), false); });
    const end = () => { drag = false; };
    scaleEl.addEventListener('pointerup', end); scaleEl.addEventListener('pointercancel', end);
    scaleEl.addEventListener('keydown', (ev) => {
      const st = stateOf(p);
      let to = -1;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight' || ev.key === 'PageDown') to = Math.min(3, st + 1);
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft' || ev.key === 'PageUp') to = Math.max(0, st - 1);
      if (ev.key === 'Home') to = 0;
      if (ev.key === 'End') to = 3;
      if (to >= 0) { ev.preventDefault(); scrollToP(stops[to], true); }
    });
    const orient = () => { const r = track.getBoundingClientRect(); scaleEl.setAttribute('aria-orientation', r.height > r.width ? 'vertical' : 'horizontal'); };
    orient(); window.addEventListener('resize', orient);
  }

  /* ---------- wiring ---------- */
  const onScroll = () => { p = readProgress(); syncDeck(); request(); };
  window.addEventListener('scroll', onScroll, { passive: true });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(() => { layout(); onScroll(); }, 120); });
  window.addEventListener('motionchange', () => { dist.fill(0); distV.fill(0); simming = false; request(); });
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) request(); }).observe(face);

  layout();
  onScroll();
  // switching on: the needles start off their positions and find the equilibrium
  if (motionOn() && p < T.enterA) {
    const R = rng(Date.now() % 100000);
    const ph = R() * 6.28;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      dist[j * cols + i] = 1.25 * Math.sin(i * 0.55 + j * 0.9 + ph) * Math.cos(i * 0.21 - j * 0.33 + ph * 0.5) + (R() - 0.5) * 0.5;
    }
    simming = true;
    request();
  }
  draw();
}
