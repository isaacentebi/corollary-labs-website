// The home instrument: one scroll, four states.
//  1  equilibrium: push the needles and they return (a ghost lamp shows where the agent will enter)
//  2  an agent enters along the flow; on arrival a pulse, and nearby needles lean towards it
//  3  its set point moves the equilibrium: a damped front travels out, needles overshoot and settle
//  4  one continuous pull-back: this organisation is one screen of a wall; the change travels
//     screen to screen across the gutters; two screens keep their old state
import { rng, type Response } from '../lib/fieldmath';
import { Scene, COL, type Agent } from './field/scene';
import { mountFace, motionOn, ease3, clamp01, type Frame } from './field/host';
import { sound } from './sound';

const story = document.querySelector<HTMLElement>('[data-story]');
const faceEl = document.querySelector<HTMLElement>('[data-face="home"]');
const scaleEls = [...document.querySelectorAll<HTMLElement>('[data-scale]')];
const captionEls = [...document.querySelectorAll<HTMLElement>('[data-caption]')];

const T = { enterA: 0.07, arrive: 0.2, settle: 0.285, zoomA: 0.6, zoomB: 0.8, spread: 0.7 };
export const STOPS = [0, 0.25, 0.56, 1];
const stateOf = (q: number) => (q < 0.12 ? 0 : q < 0.4 ? 1 : q < 0.78 ? 2 : 3);

if (story && faceEl) init(story, faceEl);

function init(story: HTMLElement, el: HTMLElement) {
  const captions: string[] = JSON.parse(captionEls[0]?.dataset.captions || '[]');
  let p = 0;
  let main!: Agent, emitter!: Agent;
  let entry = { u: 0.56, v: 0.44 };
  let zEnd = 0.3, N = 3;
  // ghost lamp (the entry point, before the agent enters)
  const ghost = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, a: 0, ta: 0, hover: false, focus: false, last: 0 };
  let sweep: { t0: number; pts: { x: number; y: number }[] } | null = null;
  let pulseAt = -1, swept = false;

  const face = mountFace(el, (face) => ({
    build(W, H, small) {
      const sc = new Scene();
      N = 3;
      const gap = Math.round(Math.min(W, H) * (small ? 0.075 : 0.06));
      const s = small ? 38 : W > 1250 ? 48 : 44;
      const c = (N - 1) / 2;
      const R = rng(9);
      for (let row = 0; row < N; row++) for (let col = 0; col < N; col++) {
        const home = row === c && col === c;
        sc.addPanel((col - c) * (W + gap) - W / 2, (row - c) * (H + gap) - H / 2, W, H, s, row * N + col + 5, home ? -0.05 : (R() - 0.5) * 0.7);
      }
      const home = c * N + c;
      sc.build(Math.min(W, H));
      const wallW = N * W + (N - 1) * gap, wallH = N * H + (N - 1) * gap, m = small ? 10 : 16;
      zEnd = Math.min((W - 2 * m) / wallW, (H - 2 * m) / wallH);

      main = sc.addAgent(home, entry.u, entry.v, { T: T.settle, c: 4.6, w: 170, z: 0.3, ring: true, reach: 1.15, lamp: false, lampAt: T.arrive });
      emitter = sc.addAgent(home, entry.u, entry.v, { T: T.spread, rc: 13, w: 240, z: 0.3, ring: true, reach: 2.3, lamp: false, emitOnly: true });
      // each organisation answers in its own way
      const holdouts = new Set([2, 7]); // top-right, bottom-middle
      for (let i = 0; i < N * N; i++) {
        if (i === home || holdouts.has(i)) continue;
        const resp: Response = { hand: R() < 0.5 ? -1 : 1, spiral: 0.15 + R() * 0.75, gain: 1.7 + R() * 1.2, core: 0.1 + R() * 0.07 };
        sc.addAgent(i, 0.28 + R() * 0.44, 0.28 + R() * 0.44, { T: Infinity, c: 22, rc: 13, w: 270, z: 0.3, ring: true, reach: 2.2, resp });
      }
      schedule(sc);
      ghost.x = ghost.tx = main.x; ghost.y = ghost.ty = main.y;
      if (motionOn() && p < T.enterA && !swept) { swept = true; startSweep(sc, W, H); }
      return sc;
    },
    frame(now) {
      const q = motionOn() ? p : STOPS[stateOf(p)];
      const sc = face.scene;
      const t = ease3(clamp01((q - T.zoomA) / (T.zoomB - T.zoomA)));
      const z = Math.exp(Math.log(zEnd) * t);
      // neighbouring screens power on as they come into view
      sc.panels.forEach((pl, i) => {
        if (i === main.panel) { pl.fade = 1; return; }
        const d = Math.hypot(pl.x + pl.w / 2, pl.y + pl.h / 2) / Math.max(pl.w, pl.h);
        pl.fade = ease3(clamp01((q - T.zoomA - 0.015 * d) / 0.13));
      });
      let busy = false;
      // ambient sweep on load: the ghost glides in and pushes the field
      if (sweep) {
        const k = clamp01((now - sweep.t0) / 2100);
        if (k <= 0) busy = true;
        else {
          const e = ease3(k), pts = sweep.pts;
          const seg = Math.min(pts.length - 2, Math.floor(e * (pts.length - 1)));
          const f = e * (pts.length - 1) - seg;
          const x = pts[seg].x + (pts[seg + 1].x - pts[seg].x) * f, y = pts[seg].y + (pts[seg + 1].y - pts[seg].y) * f;
          const vx = (x - ghost.tx) / 16, vy = (y - ghost.ty) / 16;
          if (k < 0.97 && motionOn() && q < T.enterA) { if (sc.push(x, y, vx * 0.9, vy * 0.9, sc.panels[0].s * 2.4)) face.kickSim(); }
          ghost.tx = ghost.x = x; ghost.ty = ghost.y = y; ghost.ta = 0.9 * Math.min(1, k * 4);
          if (k >= 1) { sweep = null; ghost.tx = main.x; ghost.ty = main.y; }
          busy = true;
        }
      }
      // ghost spring
      if (!sweep) {
        if (!ghost.hover && !ghost.focus) { ghost.tx = main.x; ghost.ty = main.y; ghost.ta = 0.55; }
        const dt = Math.min(0.05, (now - (ghost.last || now)) / 1000) || 0.016;
        const k = 170, c = 26;
        ghost.vx += (-k * (ghost.x - ghost.tx) - c * ghost.vx) * dt; ghost.vy += (-k * (ghost.y - ghost.ty) - c * ghost.vy) * dt;
        ghost.x += ghost.vx * dt; ghost.y += ghost.vy * dt;
        if (!motionOn()) { ghost.x = ghost.tx; ghost.y = ghost.ty; ghost.vx = ghost.vy = 0; }
        if (Math.abs(ghost.x - ghost.tx) + Math.abs(ghost.y - ghost.ty) + Math.abs(ghost.vx) + Math.abs(ghost.vy) > 0.4) busy = true;
      }
      ghost.a += (ghost.ta - ghost.a) * (motionOn() ? 0.2 : 1);
      if (Math.abs(ghost.ta - ghost.a) > 0.01) busy = true;
      ghost.last = now;

      // the entering lamp, its wake, arrival pulse and the lean towards it
      const pl = sc.panels[main.panel];
      const ep = clamp01((q - T.enterA) / (T.arrive - T.enterA));
      const sx = pl.x - pl.s * 0.8;
      const lx = sx + (main.x - sx) * ease3(ep), ly = main.y;
      const wakes = ep > 0 && ep < 1 ? [{ x: lx, y: ly, k: Math.sin(Math.PI * ep) * 0.9 }] : [];
      const leanK = 0.32 * ease3(clamp01((q - T.arrive) / 0.03)) * (1 - ease3(clamp01((q - T.settle) / 0.05)));
      const lean = leanK > 0.001 ? { x: main.x, y: main.y, k: leanK, r: pl.s * 2.8 } : null;
      sc.hidden = ep >= 1 ? new Set([main.needle]) : new Set();
      if (ep >= 1 && pulseAt < 0 && motionOn()) { pulseAt = now; sound.ping(); }
      if (ep < 1) pulseAt = -1;
      return { q, cam: { z, ox: face.W / 2, oy: face.H / 2 }, wakes, lean, busy, lx, ly, ep, ringFade: 1 - ease3(clamp01((q - 0.93) / 0.07)) } as Frame & { lx: number; ly: number; ep: number };
    },
    extras(b, f0) {
      const f = f0 as Frame & { lx: number; ly: number; ep: number };
      const { z, ox, oy } = f.cam, q = f.q, sc = face.scene;
      const X = (x: number) => ox + x * z, Y = (y: number) => oy + y * z;
      const s = sc.panels[main.panel].s * z, lampR = Math.max(2.8, 0.3 * s);
      // ghost + crosshair
      const gA = ghost.a * (1 - clamp01(f.ep * 1.4));
      if (gA > 0.01 && q < T.arrive) {
        if ((ghost.hover || ghost.focus) && q < 0.02) {
          const pl = sc.panels[main.panel];
          b.push(3, X(ghost.x), Y(pl.y + pl.h / 2), 0.5, (pl.h * z) / 2, 0, COL.mark, 0.1, 0);
          b.push(3, X(pl.x + pl.w / 2), Y(ghost.y), (pl.w * z) / 2, 0.5, 0, COL.mark, 0.1, 0);
        }
        b.push(2, X(ghost.x), Y(ghost.y), lampR + 4, 1.5, 0, COL.signal, gA);
        b.push(1, X(ghost.x), Y(ghost.y), 1.6, 0, 0, COL.signal, gA * 0.9);
      }
      // the agent
      if (f.ep > 0) {
        b.push(1, X(f.lx), Y(f.ly), lampR, 0, 0, COL.signal, 1);
        // arrival: two pulses
        for (const off of [0, 0.022]) {
          const t = clamp01((q - T.arrive - off) / 0.07);
          if (t > 0 && t < 1) b.push(2, X(main.x), Y(main.y), lampR + (s * 3.4 - lampR) * (1 - Math.pow(1 - t, 3)), 1.6, 0, COL.signal, 0.85 * (1 - t) * (off ? 0.6 : 1));
        }
      }
    },
    canPush: (f) => f.q < T.zoomA - 0.02,
    onPointer(ev, wx, wy, kind) {
      const q = motionOn() ? p : STOPS[stateOf(p)];
      const pl = face.scene.panels[main.panel];
      const inPanel = wx > pl.x && wx < pl.x + pl.w && wy > pl.y && wy < pl.y + pl.h;
      if (kind === 'leave' || !inPanel || q >= T.enterA) { ghost.hover = false; el.classList.remove('is-aiming'); face.request(); return; }
      const c = clampEntry((wx - pl.x) / pl.w, (wy - pl.y) / pl.h);
      const cell = face.scene.cell(main.panel, c.u, c.v);
      if (kind === 'move' && ev.pointerType !== 'touch') {
        ghost.hover = true; ghost.ta = 0.95; el.classList.add('is-aiming');
        ghost.tx = pl.x + cell.u * pl.w; ghost.ty = pl.y + cell.v * pl.h;
        face.request();
      }
      if (kind === 'click') setEntry(cell.u, cell.v, true);
    },
  }));

  function clampEntry(u: number, v: number) { return { u: Math.min(0.86, Math.max(0.14, u)), v: Math.min(0.84, Math.max(0.16, v)) }; }
  function setEntry(u: number, v: number, kick: boolean) {
    entry = clampEntry(u, v);
    face.scene.moveAgent(main, entry.u, entry.v);
    face.scene.moveAgent(emitter, entry.u, entry.v);
    schedule(face.scene);
    if (kick) { face.scene.kick(main.x, main.y, 5, face.scene.panels[0].s * 1.4); face.kickSim(); sound.tick(); }
    face.request();
  }
  // who adopts when: fronts relay from organisation to organisation; holdouts pass nothing on
  function schedule(sc: Scene) {
    const wall = sc.agents.filter((a) => a !== main && a !== emitter);
    wall.forEach((a) => (a.T = Infinity));
    const sources: Agent[] = [emitter];
    for (let it = 0; it < 10; it++) {
      let changed = false;
      for (const a of wall) {
        for (const s of sources) {
          const d = Math.hypot(a.x - s.x, a.y - s.y) / sc.L;
          if (d > s.reach) continue;
          const t = s.T + d / s.rc + 0.006;
          if (t < a.T) { a.T = t; changed = true; }
        }
      }
      for (const a of wall) if (a.T < Infinity && !sources.includes(a)) sources.push(a);
      if (!changed) break;
    }
    wall.forEach((a) => (a.lampAt = a.T - 0.008));
  }
  function startSweep(sc: Scene, W: number, H: number) {
    const pl = sc.panels[main.panel];
    const pts = [
      { x: pl.x - pl.s * 2, y: pl.y + H * 0.78 },
      { x: pl.x + W * 0.2, y: pl.y + H * 0.66 },
      { x: pl.x + W * 0.4, y: pl.y + H * 0.36 },
      { x: main.x - W * 0.08, y: main.y - H * 0.02 },
      { x: main.x, y: main.y },
    ];
    sweep = { t0: performance.now() + 650, pts };
    ghost.x = ghost.tx = pts[0].x; ghost.y = ghost.ty = pts[0].y; ghost.a = 0;
  }

  // keyboard: arrows move the entry point
  el.addEventListener('focus', () => { ghost.focus = true; ghost.ta = 0.95; face.request(); });
  el.addEventListener('blur', () => { ghost.focus = false; face.request(); });
  el.addEventListener('keydown', (ev) => {
    const q = motionOn() ? p : STOPS[stateOf(p)];
    if (q >= T.enterA) return;
    const pl = face.scene.panels[main.panel];
    const di = ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0, dj = ev.key === 'ArrowUp' ? -1 : ev.key === 'ArrowDown' ? 1 : 0;
    if (!di && !dj) return;
    ev.preventDefault();
    setEntry(main.u + di / pl.cols, main.v + dj / pl.rows, true);
    ghost.tx = main.x; ghost.ty = main.y;
  });

  /* ---------- the story scale: drag with inertia, detents, keys ---------- */
  const total = () => story.offsetHeight - window.innerHeight;
  const topOf = () => story.getBoundingClientRect().top + window.scrollY;
  const scrollToP = (q: number) => window.scrollTo({ top: topOf() + q * total(), behavior: 'auto' });
  let glide = 0;
  function glideTo(target: number) {
    cancelAnimationFrame(glide);
    if (!motionOn()) { scrollToP(target); return; }
    let x = p, v = 0, last = performance.now();
    const stepF = (now: number) => {
      const dt = Math.min(0.04, (now - last) / 1000); last = now;
      v += (-90 * (x - target) - 17 * v) * dt; x += v * dt;
      scrollToP(Math.min(1, Math.max(0, x)));
      if (Math.abs(x - target) > 0.0008 || Math.abs(v) > 0.002) glide = requestAnimationFrame(stepF);
      else scrollToP(target);
    };
    glide = requestAnimationFrame(stepF);
  }
  function coast(v0: number) {
    // release with velocity: coast with friction, then settle into the nearest detent
    cancelAnimationFrame(glide);
    if (!motionOn() || Math.abs(v0) < 0.0004) { glideTo(nearestStop(p)); return; }
    let x = p, v = v0, last = performance.now();
    const stepF = (now: number) => {
      const dt = now - last; last = now;
      x += v * dt; v *= Math.pow(0.994, dt);
      if (x <= 0 || x >= 1) { x = Math.min(1, Math.max(0, x)); v = 0; }
      scrollToP(x);
      if (Math.abs(v) > 0.00025) glide = requestAnimationFrame(stepF);
      else glideTo(nearestStop(x));
    };
    glide = requestAnimationFrame(stepF);
  }
  const nearestStop = (x: number) => STOPS.reduce((b, s) => (Math.abs(s - x) < Math.abs(b - x) ? s : b), 0);

  for (const sEl of scaleEls) {
    const track = sEl.querySelector<HTMLElement>('.scale__track')!;
    const fromPointer = (ev: PointerEvent) => {
      const r = track.getBoundingClientRect();
      return clamp01(r.height > r.width ? (ev.clientY - r.top) / r.height : (ev.clientX - r.left) / r.width);
    };
    let drag = false, hist: { x: number; t: number }[] = [];
    sEl.addEventListener('pointerdown', (ev) => {
      const stop = (ev.target as HTMLElement).closest<HTMLElement>('[data-stop]');
      cancelAnimationFrame(glide);
      if (stop) { glideTo(Number(stop.dataset.stop)); sound.tick(); return; }
      drag = true; hist = []; sEl.setPointerCapture(ev.pointerId); sEl.classList.add('is-dragging');
      const x = fromPointer(ev); hist.push({ x, t: performance.now() }); scrollToP(x);
    });
    sEl.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const x = fromPointer(ev); hist.push({ x, t: performance.now() }); if (hist.length > 6) hist.shift();
      scrollToP(x);
    });
    const end = () => {
      if (!drag) return;
      drag = false; sEl.classList.remove('is-dragging');
      const a = hist[0], b = hist[hist.length - 1];
      const v = a && b && b.t - a.t > 0 && performance.now() - b.t < 80 ? (b.x - a.x) / (b.t - a.t) : 0;
      coast(v);
    };
    sEl.addEventListener('pointerup', end); sEl.addEventListener('pointercancel', end);
    sEl.addEventListener('keydown', (ev) => {
      const st = stateOf(p);
      let to = -1;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight' || ev.key === 'PageDown') to = Math.min(3, st + 1);
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft' || ev.key === 'PageUp') to = Math.max(0, st - 1);
      if (ev.key === 'Home') to = 0;
      if (ev.key === 'End') to = 3;
      if (to >= 0) { ev.preventDefault(); glideTo(STOPS[to]); }
    });
  }
  window.addEventListener('wheel', () => cancelAnimationFrame(glide), { passive: true });
  window.addEventListener('touchstart', () => cancelAnimationFrame(glide), { passive: true });

  /* ---------- deck ---------- */
  let lastState = -1;
  function syncDeck() {
    const st = stateOf(p);
    for (const sEl of scaleEls) {
      sEl.style.setProperty('--p', p.toFixed(4));
      sEl.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    }
    if (st !== lastState) {
      if (lastState >= 0) sound.detent();
      lastState = st;
      for (const sEl of scaleEls) {
        sEl.querySelectorAll('[data-stop]').forEach((li, i) => li.classList.toggle('is-on', i === st));
        sEl.setAttribute('aria-valuetext', `State ${st + 1} of 4`);
      }
      captionEls.forEach((c) => { c.textContent = captions[st] ?? ''; });
    }
  }
  const onScroll = () => {
    const r = story.getBoundingClientRect();
    p = total() > 0 ? clamp01(-r.top / total()) : 0;
    syncDeck(); face.request();
    (window as unknown as { __cyber: object }).__cyber = { p, state: stateOf(p), renderer: el.dataset.renderer };
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('motionchange', onScroll);
  onScroll();
  face.request();
}
