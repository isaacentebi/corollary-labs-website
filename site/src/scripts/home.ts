// Home: one sticky field, one scroll progress p in [0, 1] over ~1.6 viewport heights.
//   0.00–0.20  the name rests in a clearing of the raked lines; the clearing closes.
//   0.12–0.32  three pale stones rise, in a row; the lines wrap them in one shared enclosure.
//   0.34–0.62  a small rose stone arrives along the lines; the row re-forms into a ring around it.
//   0.62–1.00  pull back: many other rows; rose stones appear in them, nearest first, and each re-forms.
import { Ground, type StoneState } from './ground';
import { stone, step, rng, type Stone } from './stones';

type Cluster = { cx: number; cy: number; members: Stone[]; rose: Stone; dist: number; angle: number; jitter: number };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

export function initHome(root: HTMLElement) {
  const section = root.querySelector<HTMLElement>('[data-field]');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]');
  if (!section || !canvas) return () => {};
  const nameEl = section.querySelector<HTMLElement>('[data-center]')!;
  const phs = [...section.querySelectorAll<HTMLElement>('[data-ph]')];
  const cue = section.querySelector<HTMLElement>('[data-cue]');
  const reduced = document.documentElement.classList.contains('rm');

  let ground: Ground;
  try { ground = new Ground(canvas); } catch { section.classList.add('no-gl'); return () => {}; }
  section.classList.add('has-gl');

  let W = 0, H = 0, unit = 1, space = 13, mobile = false;
  let org: Cluster; let others: Cluster[] = [];
  let all: Stone[] = [];
  const user: Stone[] = [];
  let zoomOut = 0.42;

  // a row of stones (the arrangement before), and a ring around the rose stone (after)
  function rowTargets(c: Cluster) {
    const n = c.members.length;
    const dir = [Math.cos(c.angle), Math.sin(c.angle)];
    let total = c.members.reduce((a, s) => a + s.tr * 2, 0) + (n - 1) * 14 * unit;
    let x = -total / 2;
    c.members.forEach((s) => { x += s.tr; s.tx = c.cx + dir[0] * x; s.ty = c.cy + dir[1] * x; x += s.tr + 14 * unit; });
  }
  function ringTargets(c: Cluster) {
    const n = c.members.length;
    c.members.forEach((s, i) => {
      const a = c.angle - Math.PI / 2 + (i / n) * Math.PI * 2 + 0.35;
      const rr = c.rose.tr + s.tr + 12 * unit;
      s.tx = c.cx + Math.cos(a) * rr; s.ty = c.cy + Math.sin(a) * rr;
    });
  }

  function layout() {
    W = section!.clientWidth; H = window.innerHeight;
    mobile = W < 720;
    unit = clamp(Math.min(W * 1.35, H * 1.1) / 900, 0.56, 1.25);
    space = mobile ? 9 : 13;
    zoomOut = mobile ? 0.5 : 0.42;
    ground.resize(W, H, Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.25));

    const R = rng(7);
    const mk = (cx: number, cy: number, n: number, angle: number, sizeK = 1): Cluster => {
      const members = Array.from({ length: n }, (_, i) => stone({
        x: cx, y: cy, r: (i === 1 ? 62 : 48 - i * 4 + R() * 10) * unit * sizeK,
        aspect: 1.08 + R() * 0.22, rot: R() * Math.PI, k: 1.75, lift: 0, tlift: 0,
      }));
      const rose = stone({ x: cx, y: cy, r: 22 * unit * sizeK, aspect: 1.08, rot: R(), k: 1.5, rose: 1, trose: 1, lift: 0, tlift: 0 });
      const c: Cluster = { cx, cy, members, rose, dist: 0, angle, jitter: R() };
      rowTargets(c);
      members.forEach((s) => { s.x = s.tx; s.y = s.ty; });
      return c;
    };

    const ox = mobile ? 0 : W * 0.17, oy = mobile ? H * 0.1 : H * 0.04;
    org = mk(ox, oy, 3, mobile ? -0.5 : -0.22, 1);
    org.rose.x = org.rose.tx = -W / 2 - 80 * unit; org.rose.y = org.rose.ty = oy;

    // other organisations: a jittered grid over the pulled-back view
    others = [];
    const vw = W / zoomOut, vh = H / zoomOut;
    const cols = mobile ? 3 : 4, rows = mobile ? 4 : 3;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const cx = (-0.5 + (i + 0.5) / cols) * vw * 0.92 + (R() - 0.5) * vw / cols * 0.45;
      const cy = (-0.5 + (j + 0.5) / rows) * vh * 0.9 + (R() - 0.5) * vh / rows * 0.4;
      if (Math.abs(cx) < W / 2 + 40 * unit && Math.abs(cy) < H / 2 + 40 * unit) continue;
      const q = R(), n = q < 0.2 ? 1 : q < 0.6 ? 2 : 3;
      others.push(mk(cx, cy, n, (R() - 0.5) * 2.2, 0.8 + R() * 0.4));
    }
    for (const c of others) { c.dist = Math.hypot(c.cx - ox, c.cy - oy); }
    const maxD = Math.max(...others.map((c) => c.dist));
    others.forEach((c) => (c.dist /= maxD));
    // budget: the shader takes 48 stones
    let budget = 48 - 4 - 6;
    others = others.sort((a, b) => a.dist - b.dist).filter((c) => { const need = c.members.length + 1; if (budget < need) return false; budget -= need; return true; });

    all = [...org.members, org.rose, ...others.flatMap((c) => [...c.members, c.rose])];
    user.length = 0;
    measureName();
  }

  let cap = { ax: 0, ay: 0, bx: 0, by: 0, R: 60, clear: 40 };
  function measureName() {
    const r = nameEl.getBoundingClientRect(), s = section!.querySelector('.field__stick')!.getBoundingClientRect();
    const cx = r.left + r.width / 2 - s.left - W / 2, cy = r.top + r.height / 2 - s.top - H / 2;
    const hw = r.width / 2, hh = r.height / 2;
    const rr = Math.min(hw, hh), isl = rr * 1.12 + 10;
    cap = hw >= hh ? { ax: cx - hw + rr * 0.6, ay: cy, bx: cx + hw - rr * 0.6, by: cy, R: 1, clear: isl }
      : { ax: cx, ay: cy - hh + rr * 0.6, bx: cx, by: cy + hh - rr * 0.6, R: 1, clear: isl };
  }

  // scroll progress
  let p = 0;
  function readProgress() {
    const r = section!.getBoundingClientRect();
    const total = section!.offsetHeight - H;
    p = clamp(-r.top / Math.max(1, total));
  }

  // state from progress → targets
  let intro = reduced ? 1 : 0;
  function apply(p: number) {
    const nameOut = seg(p, 0.03, 0.15);
    const nameIn = ease(clamp((intro - 0.25) / 0.75));
    nameEl.style.opacity = String((1 - ease(nameOut)) * nameIn);
    nameEl.style.transform = `translate3d(0, ${(-ease(nameOut) * 18).toFixed(1)}px, 0)`;
    const bl = nameOut * 6 + (1 - nameIn) * 10;
    nameEl.style.filter = bl > 0.05 ? `blur(${bl.toFixed(2)}px)` : '';
    const show = (el: HTMLElement, a: number, b: number) => {
      const v = Math.min(seg(p, a, a + 0.05), 1 - seg(p, b - 0.05, b));
      el.style.opacity = String(ease(v));
      el.style.transform = `translate3d(0, ${((1 - ease(v)) * 8).toFixed(1)}px, 0)`;
    };
    show(phs[1], 0.38, 0.64); show(phs[2], 0.8, 1.2);
    if (cue) cue.style.opacity = String(1 - seg(p, 0.0, 0.05));
    section!.style.setProperty('--edge', ease(seg(p, 0.9, 1)).toFixed(3));

    // organisation rises
    org.members.forEach((s, i) => { s.tlift = seg(p, 0.12 + i * 0.045, 0.2 + i * 0.045) > 0.5 ? 1 : 0; });
    // rose stone arrives along the lines
    const travel = seg(p, 0.34, 0.54);
    org.rose.tlift = p > 0.32 ? 1 : 0;
    const e = ease(travel);
    const startX = -W / 2 - 60 * unit;
    org.rose.tx = startX + (org.cx - startX) * e;
    org.rose.ty = org.cy + Math.sin(e * Math.PI) * -26 * unit;
    if (travel > 0.82) ringTargets(org); else rowTargets(org);
    org.rose.solid = travel > 0.82;

    // diffusion
    const wave = seg(p, 0.7, 0.98);
    for (const c of others) {
      c.members.forEach((s) => (s.tlift = p > 0.58 + c.dist * 0.08 ? 1 : 0));
      const on = wave > c.dist * 0.9 + c.jitter * 0.14 && wave > 0.02;
      c.rose.tlift = on ? 1 : 0;
      c.rose.tx = c.cx; c.rose.ty = c.cy; c.rose.solid = on;
      if (on) ringTargets(c); else rowTargets(c);
    }
  }

  function camera(p: number): { cam: [number, number]; zoom: number } {
    const z = ease(seg(p, 0.62, 0.9));
    const zoom = 1 + (zoomOut - 1) * z;
    return { cam: [org.cx * 0.35 * z, org.cy * 0.3 * z], zoom };
  }

  // cursor
  const mouse = { x: 0, y: 0, s: 0, ts: 0, R: 34 };
  let lastMove = 0;
  const toWorld = (cx: number, cy: number) => {
    const r = canvas.getBoundingClientRect();
    const { cam, zoom } = camera(p);
    return [(cx - r.left - W / 2) / zoom + cam[0], (cy - r.top - H / 2) / zoom + cam[1]];
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const [x, y] = toWorld(e.clientX, e.clientY);
    mouse.x = x; mouse.y = y; mouse.ts = 0.85; lastMove = performance.now();
  };
  const onLeave = () => { mouse.ts = 0; };
  const onClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a,button')) return;
    const [x, y] = toWorld(e.clientX, e.clientY);
    const s = stone({ x, y, r: (14 + Math.random() * 6) * unit, aspect: 1.1, rot: Math.random() * 3, k: 1.4, rose: 1, trose: 1, lift: 0, tlift: 1 });
    user.push(s);
    if (user.length > 6) { const old = user.shift()!; old.tlift = 0; fading.push(old); }
    kick();
  };
  const fading: Stone[] = [];
  section.addEventListener('pointermove', onMove);
  section.addEventListener('pointerleave', onLeave);
  section.addEventListener('click', onClick);

  // loop
  let raf = 0, last = performance.now(), visible = true, t0 = performance.now(), idle = 0;
  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    intro = Math.min(1, intro + dt / 2.2);
    readProgress();
    apply(p);
    if (now - lastMove > 1800) mouse.ts = 0;
    mouse.s += (mouse.ts - mouse.s) * (1 - Math.exp(-4 * dt));
    const t = (now - t0) / 1000;
    // breathing: stones drift a pixel or two around their targets
    if (!reduced) for (const s of all) { s.tx += Math.sin(t * 0.35 + s.seed * 9) * 2.2 * unit; s.ty += Math.cos(t * 0.3 + s.seed * 7) * 2.2 * unit; }
    const live = [...all, ...user, ...fading];
    step(live, dt, { instant: reduced, gap: 8 * unit });
    for (let i = fading.length - 1; i >= 0; i--) if (fading[i].lift < 0.01) fading.splice(i, 1);
    const { cam, zoom } = camera(p);
    const capK = (1 - ease(seg(p, 0.03, 0.2))) * ease(clamp(intro / 0.8));
    ground.draw({
      cam, zoom, space, time: reduced ? 0 : t, flow: reduced ? 0 : t * 2.6,
      stones: live.filter((s) => s.lift > 0.002 || s.tlift > 0),
      cap: capK > 0.001 ? { ...cap, k: capK } : null,
      mouse: reduced ? null : { x: mouse.x, y: mouse.y, s: mouse.s, R: mouse.R * unit },
    });
    // keep animating while anything is still moving
    const moving = live.some((s) => Math.abs(s.vx) + Math.abs(s.vy) > 0.02 || Math.abs(s.lift - s.tlift) > 0.002 || Math.abs(s.rose - s.trose) > 0.002) || Math.abs(mouse.s - mouse.ts) > 0.002;
    idle = moving ? 0 : idle + 1;
    if (visible && (!reduced || moving) && (idle < 90 || !reduced)) kick();
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); });
  io.observe(section);
  const onScroll = () => kick();
  const onResize = () => { layout(); kick(); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);

  layout();
  readProgress();
  apply(p);
  // settle instantly into the current state on load
  step([...all], 0, { instant: true });
  if (document.fonts) document.fonts.ready.then(() => { measureName(); kick(); });
  kick();
  section.classList.add('is-ready');

  return () => {
    cancelAnimationFrame(raf); io.disconnect();
    window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize);
  };
}
