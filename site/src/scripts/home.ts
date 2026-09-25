// Home: one sticky field, one scroll progress p in [0, 1] over ~1.15 viewport heights.
// The sticky part ends at p ≈ 0.74; the rest plays while the field slides up as a band and About arrives.
//   0.02–0.14  the lines flow back into the name's clearing
//   0.08–0.24  four stones rise in a row; one closed contour forms around them (elongated)
//   0.26–0.44  a rose stone arrives along the lines; the contour opens to take it in; the row re-forms around it
//              and the contour relaxes towards a circle. No stone leaves.
//   0.46–0.66  pull back, tilt, dusk: many other groups on the same ground
//   0.58–0.92  rose stones travel from group to group along the lines, nearest first; each contour takes one in
import { Ground, insideCap, insideGroup, effR, type Cap, type GroupState } from './ground';
import { stone, step, rng, type Stone } from './stones';

type Cluster = {
  cx: number; cy: number; members: Stone[]; rose: Stone; angle: number; dist: number; jitter: number;
  group: GroupState; src: Cluster | null; on: boolean; t0: number; from: [number, number];
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const SCROLL = 1.15; // viewport heights of scroll the story takes

export function initHome(root: HTMLElement) {
  const section = root.querySelector<HTMLElement>('[data-field]');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]');
  if (!section || !canvas) return () => {};
  const stick = section.querySelector<HTMLElement>('.field__stick')!;
  const nameEl = section.querySelector<HTMLElement>('[data-center]')!;
  const phs = [...section.querySelectorAll<HTMLElement>('[data-ph]')];
  const cue = section.querySelector<HTMLElement>('[data-cue]');
  const idx = section.querySelector<HTMLElement>('[data-idx]');
  const reduced = document.documentElement.classList.contains('rm');

  let ground: Ground;
  try { ground = new Ground(canvas); } catch { section.classList.add('no-gl'); return () => {}; }
  section.classList.add('has-gl');

  let seen = false;
  try { seen = !!sessionStorage.getItem('soft.intro'); sessionStorage.setItem('soft.intro', '1'); } catch {}
  let intro = reduced || seen ? 1 : 0;

  let W = 0, H = 0, unit = 1, space = 13, mobile = false;
  let org: Cluster; let others: Cluster[] = [];
  let all: Stone[] = [];
  const user: Stone[] = [], fading: Stone[] = [];
  let zoomOut = 0.42, tiltMax = 0.5;

  function rowTargets(c: Cluster) {
    const dir = [Math.cos(c.angle), Math.sin(c.angle)], gap = 14 * unit;
    const total = c.members.reduce((a, s) => a + s.tr * Math.max(s.aspect, 1 / s.aspect) * 2, 0) + (c.members.length - 1) * gap;
    let x = -total / 2;
    c.members.forEach((s) => { const w = s.tr * Math.max(s.aspect, 1 / s.aspect); x += w; s.tx = c.cx + dir[0] * x; s.ty = c.cy + dir[1] * x; x += w + gap; });
  }
  function ringTargets(c: Cluster) {
    const gap = 12 * unit;
    const ws = c.members.map((s) => s.tr * Math.max(s.aspect, 1 / s.aspect));
    const arc = ws.reduce((a, w) => a + 2 * w + gap, 0);
    const Rr = Math.max(c.rose.tr + Math.max(...ws) + gap, arc / (Math.PI * 2));
    let cum = 0;
    c.members.forEach((s, i) => {
      const a = c.angle + Math.PI * 0.62 + ((cum + ws[i]) / arc) * Math.PI * 2;
      cum += 2 * ws[i] + gap;
      const rr = Math.max(Rr, c.rose.tr + ws[i] + gap);
      s.tx = c.cx + Math.cos(a) * rr; s.ty = c.cy + Math.sin(a) * rr;
    });
  }

  function mkCluster(R: () => number, cx: number, cy: number, spec: Partial<Stone>[], angle: number, roseR: number): Cluster {
    const members = spec.map((o) => stone({ x: cx, y: cy, r: 30, k: 1.5, lift: 0, tlift: 0, rot: R() * Math.PI, aspect: 1.1, ...o }));
    const rose = stone({ x: cx, y: cy, r: roseR, aspect: 1.07, rot: R(), k: 1.2, rose: 1, trose: 1, lift: 0, tlift: 0, gloss: 0.85, gw: 0, tgw: 0, solid: false });
    const group: GroupState = { members: [...members, rose], tint: 0, show: 0, moat: 120 * unit, pad: 44 * unit, soft: 30 * unit };
    const c: Cluster = { cx, cy, members, rose, angle, dist: 0, jitter: R(), group, src: null, on: false, t0: -1, from: [cx, cy] };
    rowTargets(c);
    members.forEach((s) => { s.x = s.tx; s.y = s.ty; });
    return c;
  }

  function finalView() {
    return { cam: [org.cx * 0.3, org.cy * 0.35] as [number, number], zoom: zoomOut, tilt: tiltMax };
  }

  function layout() {
    W = section!.clientWidth; H = window.innerHeight;
    mobile = W < 720;
    unit = clamp(Math.min(W * 1.35, H * 1.1) / 900, 0.56, 1.25);
    space = mobile ? 9.5 : 13;
    zoomOut = mobile ? 0.5 : 0.4;
    tiltMax = mobile ? 0.45 : 0.7;
    ground.resize(W, H, Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.25));

    const R = rng(11);
    const u = unit;
    const ox = mobile ? 0 : W * 0.16, oy = mobile ? H * 0.06 : H * 0.03;
    // the organisation: four stones of very different kinds
    org = mkCluster(R, ox, oy, [
      { r: 44 * u, aspect: 1.14, squar: 0.1 },
      { r: 66 * u, aspect: 1.3, squar: 0.62, rot: 0.3 },
      { r: 26 * u, aspect: 1.08, tone: 1, gloss: 0.85 },
      { r: 15 * u, aspect: 1.12, tone: 0.3, gloss: 0.3 },
    ], mobile ? -0.62 : -0.18, 17 * u);
    org.rose.x = org.rose.tx = -W / 2 - 60 * u; org.rose.y = org.rose.ty = oy;

    // other organisations, placed on a jittered grid of the final (pulled back, tilted) view
    others = [];
    const fv = finalView();
    const cols = mobile ? 3 : 4, rows = mobile ? 5 : 3;
    const oScreen = [W / 2 + (org.cx - fv.cam[0]) * zoomOut, H / 2 + (org.cy - fv.cam[1]) * zoomOut];
    const placed: [number, number, number][] = [[oScreen[0], oScreen[1], (mobile ? 0.3 : 0.2) * Math.min(W, H) + 40]];
    const sk = mobile ? 0.55 : 1;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const sx = ((i + 0.5) / cols) * W + (R() - 0.5) * (W / cols) * 0.5;
      const sy = H * 0.12 + ((j + 0.5) / rows) * H * 0.68 + (R() - 0.5) * (H / rows) * 0.3;
      const q = R(), n = q < 0.25 ? 1 : q < 0.65 ? 2 : 3;
      const rs = Array.from({ length: n }, () => (R() < 0.18 ? 70 + R() * 50 : 12 + R() * 38) * u * sk);
      const scr = 1 / Math.max(1e-3, ground.toWorld(sx + 1, sy, fv)[0] - ground.toWorld(sx, sy, fv)[0]); // screen px per world px here
      const rad = (rs.reduce((a, b) => a + b * 1.15, 0) + (mobile ? 30 : 60) * u) * scr;
      if (!placed.every(([x, y, r]) => Math.hypot(sx - x, sy - y) > r + rad + 8)) continue;
      placed.push([sx, sy, rad]);
      const [wx, wy] = ground.toWorld(sx, sy, fv);
      let si = 0;
      const spec: Partial<Stone>[] = Array.from({ length: n }, () => {
        return {
          r: rs[si++], aspect: 1.04 + R() * 0.3,
          squar: R() < 0.35 ? 0.4 + R() * 0.5 : R() * 0.2, tone: R() < 0.28 ? 0.85 + R() * 0.15 : R() * 0.2, gloss: R() < 0.3 ? 0.7 + R() * 0.3 : 0,
        };
      });
      others.push(mkCluster(R, wx, wy, spec, (R() - 0.5) * 2.4, (13 + R() * 8) * u));
    }
    others.forEach((c) => (c.dist = Math.hypot(c.cx - org.cx, c.cy - org.cy)));
    let budget = 40 - 5 - 5;
    others = others.sort((a, b) => a.dist - b.dist).filter((c) => { const need = c.members.length + 1; if (budget < need) return false; budget -= need; return true; });
    const maxD = Math.max(1, ...others.map((c) => c.dist));
    others.forEach((c, i) => {
      c.dist /= maxD;
      // the rose comes from the nearest group that already has one
      let best: Cluster = org, bd = Math.hypot(c.cx - org.cx, c.cy - org.cy);
      for (const o of others.slice(0, i)) { const d = Math.hypot(c.cx - o.cx, c.cy - o.cy); if (d < bd) { bd = d; best = o; } }
      c.src = best;
    });
    all = [...org.members, org.rose, ...others.flatMap((c) => [...c.members, c.rose])];
    measureName();
  }

  let cap: Cap = { cx: 0, cy: 0, hx: 10, hy: 10, rad: 10, moat: 80, k: 0 };
  function measureName() {
    const r = nameEl.getBoundingClientRect(), s = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2 - s.left - W / 2, cy = r.top + r.height / 2 - s.top - H / 2;
    const padX = mobile ? 14 : 40, padY = mobile ? 26 : 30;
    const hy = r.height / 2 + padY;
    cap = { cx, cy, hx: Math.min(r.width / 2 + padX, W / 2 - 6), hy, rad: Math.min(hy * 0.95, 110), moat: Math.max(hy * 2.6, mobile ? 200 : 280), k: 0 };
  }

  let p = 0;
  function readProgress() {
    const r = section!.getBoundingClientRect();
    p = clamp(-r.top / (H * SCROLL));
  }

  let t = 0;
  let lastIdx = '';
  function apply(p: number) {
    const nameOut = seg(p, 0.02, 0.12);
    const nameIn = ease(clamp((intro - 0.3) / 0.7));
    nameEl.style.opacity = String((1 - ease(nameOut)) * nameIn);
    nameEl.style.transform = `translate3d(0, ${(-ease(nameOut) * 14).toFixed(1)}px, 0)`;
    const bl = nameOut * 6 + (1 - nameIn) * 10;
    nameEl.style.filter = bl > 0.05 ? `blur(${bl.toFixed(2)}px)` : '';
    const show = (el: HTMLElement, a: number, b: number) => {
      const v = Math.min(seg(p, a, a + 0.05), 1 - seg(p, b - 0.05, b));
      el.style.opacity = String(ease(v));
      el.style.transform = `translate3d(0, ${((1 - ease(v)) * 8).toFixed(1)}px, 0)`;
    };
    show(phs[1], 0.3, 0.5); show(phs[2], 0.62, 1.3);
    if (cue) cue.style.opacity = String((1 - seg(p, 0.0, 0.04)) * nameIn);

    // the organisation rises
    org.members.forEach((s, i) => { s.tlift = p > 0.09 + i * 0.035 ? 1 : 0; });
    const lifted = org.members.reduce((a, s) => a + s.lift, 0) / org.members.length;
    org.group.show = ease(clamp(lifted * 1.2 - 0.1));
    // the rose arrives along the lines and joins
    const travel = seg(p, 0.26, 0.42);
    const e = ease(travel);
    const startX = -W / 2 - 50 * unit;
    org.rose.tlift = p > 0.24 ? 1 : 0;
    org.rose.hold = false;
    org.rose.tx = startX + (org.cx - startX) * e;
    org.rose.ty = org.cy + Math.sin(e * Math.PI) * -18 * unit * (1 - e);
    org.rose.tgw = ease(seg(travel, 0.55, 0.95));
    const joined = travel > 0.8;
    if (joined) ringTargets(org); else rowTargets(org);
    org.rose.solid = joined;
    org.group.tint = org.rose.gw;

    // the other groups rise as the view pulls back, and receive rose stones nearest first
    const wave = seg(p, 0.58, 0.9);
    for (const c of others) {
      c.members.forEach((s) => (s.tlift = p > 0.44 + c.dist * 0.1 ? 1 : 0));
      c.group.show = ease(clamp(c.members.reduce((a, s) => a + s.lift, 0) / c.members.length));
      const on = wave > 0.02 && wave >= c.dist * 0.92 + c.jitter * 0.06;
      if (on && !c.on) {
        c.on = true; c.t0 = reduced ? -1e9 : t;
        const s = c.src!;
        c.from = [s.cx + (c.cx > s.cx ? 1 : -1) * 30 * unit, s.cy];
        c.rose.x = c.from[0]; c.rose.y = c.from[1]; c.rose.lift = 0.02;
      } else if (!on && c.on) {
        c.on = false; c.rose.hold = false;
      }
      c.group.tint = c.rose.gw;
    }
    if (idx) {
      const st = p < 0.2 ? 1 : p < 0.45 ? 2 : p < 0.58 ? 3 : 4;
      const reached = others.filter((c) => c.on).length + (org.rose.gw > 0.5 ? 1 : 0);
      const s = `${String(st).padStart(2, '0')}/04 t ${p.toFixed(2)} n ${org.members.filter((m) => m.tlift > 0).length + (org.rose.gw > 0.5 ? 1 : 0)} ${reached}/${others.length + 1}`;
      if (s !== lastIdx) { idx.textContent = s; lastIdx = s; }
    }
  }

  // each travelling rose follows the lines: mostly across first, then down into its group
  function travel(now: number) {
    for (const c of others) {
      const r = c.rose;
      if (!c.on) { r.tlift = 0; r.tgw = 0; r.hold = false; rowTargets(c); continue; }
      const tau = clamp((now - c.t0) / 1.2);
      r.tlift = 1;
      if (tau < 1) {
        const ex = ease(tau), ey = ease(clamp((tau - 0.25) / 0.75));
        r.hold = true;
        r.x = c.from[0] + (c.cx - c.from[0]) * ex;
        r.y = c.from[1] + (c.cy - c.from[1]) * ey;
        r.tx = r.x; r.ty = r.y;
        r.tgw = ease(clamp((tau - 0.6) / 0.4));
        r.solid = false;
        rowTargets(c);
      } else {
        r.hold = false; r.tx = c.cx; r.ty = c.cy; r.tgw = 1; r.solid = true;
        ringTargets(c);
      }
    }
  }

  function view(p: number) {
    const z = ease(seg(p, 0.46, 0.68));
    const fv = finalView();
    return {
      cam: [fv.cam[0] * z, fv.cam[1] * z] as [number, number],
      zoom: 1 + (zoomOut - 1) * z,
      tilt: tiltMax * ease(seg(p, 0.5, 0.72)),
      dusk: 0.88 * ease(seg(p, 0.5, 0.7)),
    };
  }

  // cursor: a wide soft dip that lags behind the pointer
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, s: 0, ts: 0 };
  let lastMove = 0;
  const toWorld = (cx: number, cy: number) => {
    const r = canvas.getBoundingClientRect();
    return ground.toWorld(cx - r.left, cy - r.top, view(p));
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const [x, y] = toWorld(e.clientX, e.clientY);
    mouse.tx = x; mouse.ty = y;
    if (mouse.ts === 0) { mouse.x = x; mouse.y = y; }
    mouse.ts = 1; lastMove = performance.now(); kick();
  };
  const onLeave = () => { mouse.ts = 0; };
  const onClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a,button')) return;
    const [x, y] = toWorld(e.clientX, e.clientY);
    if (insideCap({ ...cap, k: capK() }, x, y)) return;
    if ([org, ...others].some((c) => c.group.show > 0.3 && insideGroup(c.group, x, y))) return;
    const s = stone({ x, y, r: (12 + Math.random() * 8) * unit, aspect: 1.1, rot: Math.random() * 3, k: 1.3, rose: 1, trose: 1, lift: 0, tlift: 1, gloss: 0.85 });
    user.push(s);
    if (user.length > 5) { const old = user.shift()!; old.tlift = 0; fading.push(old); }
    kick();
  };
  section.addEventListener('pointermove', onMove);
  section.addEventListener('pointerleave', onLeave);
  section.addEventListener('click', onClick);

  const capK = () => ease(clamp(intro / 0.85)) * (1 - ease(seg(p, 0.02, 0.14)));

  let raf = 0, last = performance.now(), visible = true;
  const t0 = performance.now();
  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    t = (now - t0) / 1000;
    intro = Math.min(1, intro + dt / 1.8);
    readProgress();
    apply(p);
    travel(reduced ? 1e9 : t);
    // click-placed stones leave once the story starts
    if (p > 0.1) while (user.length) { const s = user.shift()!; s.tlift = 0; fading.push(s); }
    if (now - lastMove > 2200) mouse.ts = 0;
    mouse.x += (mouse.tx - mouse.x) * 0.12; mouse.y += (mouse.ty - mouse.y) * 0.12;
    mouse.s += (mouse.ts - mouse.s) * (1 - Math.exp(-3 * dt));
    if (!reduced) for (const s of all) if (!s.hold) { s.tx += Math.sin(t * 0.35 + s.seed * 9) * 1.6 * unit; s.ty += Math.cos(t * 0.3 + s.seed * 7) * 1.6 * unit; }
    const live = [...all, ...user, ...fading];
    step(live, dt, { instant: reduced, gap: 8 * unit });
    for (let i = fading.length - 1; i >= 0; i--) if (fading[i].lift < 0.01) fading.splice(i, 1);
    const v = view(p);
    stick.toggleAttribute('data-dark', v.dusk > 0.45);
    ground.draw({
      ...v, space, time: reduced ? 0 : t, flow: reduced ? 0 : t * 2.4,
      stones: live, groups: [org.group, ...others.map((c) => c.group)],
      cap: { ...cap, k: capK() },
      mouse: reduced ? null : { x: mouse.x, y: mouse.y, s: mouse.s * 0.9, R: 64 * unit },
    });
    if (visible) kick();
  }
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { last = performance.now(); kick(); } });
  io.observe(section);
  const onResize = () => { layout(); kick(); };
  window.addEventListener('resize', onResize);

  layout();
  readProgress();
  apply(p);
  travel(1e9);
  step([...all], 0, { instant: true });
  if (document.fonts) document.fonts.ready.then(() => { measureName(); kick(); });
  kick();

  return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('resize', onResize); };
}
