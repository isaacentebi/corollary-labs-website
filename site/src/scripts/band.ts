// Grounds for the inner pages. Each [data-band] carries a JSON config:
//   stones:  [{ x, y, r, a?, rot?, rose?, tone?, gloss?, sq? }]  x, y as fractions of the band (-0.5..0.5), r of min(w, h)
//   mstones: positions for narrow screens (same order)
//   group:   true → all stones share one closed contour
//   clear:   selector whose box becomes a clearing in the lines (the heading rests in it)
//   hover:   selector; hovering the i-th match acts on stone i ('warm': it turns rose; 'part': it turns rose and its
//            neighbours make room)
//   drag:    stones can be picked up and moved with a mouse; the lines and the contour follow on a spring
//   far:     { n, seed } a view from far away: many small groups, the lines as texture
//   dusk, zoom, tilt, space
//   breathe: the clearing's outline breathes slowly; place: a click on the open ground sets a small rose stone down
//   capMoat: moat width as a multiple of the clearing's half-height; capPad / mcapPad: [x, y] padding around it
import { Ground, insideCap, type Cap, type GroupState } from './ground';
import { stone, step, rng, type Stone } from './stones';

type SCfg = { x: number; y: number; r: number; a?: number; rot?: number; rose?: number; tone?: number; gloss?: number; sq?: number };
type Cfg = {
  stones?: SCfg[]; mstones?: { x: number; y: number; r: number }[];
  group?: boolean; clear?: string; hover?: string; hoverMode?: 'warm' | 'part'; drag?: boolean;
  far?: { n: number; seed: number }; dusk?: number; zoom?: number; tilt?: number; space?: number; moat?: number; pad?: number;
  anchor?: string; labels?: string; bounded?: boolean; kScale?: number;
  breathe?: boolean; place?: boolean; capMoat?: number; capPad?: [number, number]; mcapPad?: [number, number];
};

export function initBands(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-band]').forEach((el) => {
    try { band(el); } catch (e) { el.classList.add('no-gl'); console.warn(e); }
  });
}

const ease = (t: number) => t * t * (3 - 2 * t);

function band(el: HTMLElement) {
  const cfg: Cfg = JSON.parse(el.dataset.band || '{}');
  const canvas = document.createElement('canvas');
  canvas.className = 'band__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  el.prepend(canvas);
  const ground = new Ground(canvas, { maxScale: 1.5 });
  el.classList.add('has-gl');
  if ((cfg.dusk ?? 0) > 0.45) el.setAttribute('data-dark', '');
  const reduced = document.documentElement.classList.contains('rm');

  let W = 0, H = 0, unit = 1;
  const base = cfg.stones ?? [];
  type BS = Stone & { hx: number; hy: number; hr: number };
  const stones: BS[] = base.map((s, i) => stone({
    x: 0, y: 0, r: 10, aspect: s.a ?? 1.12, rot: s.rot ?? i * 1.3, k: 1.6, rose: s.rose ?? 0, trose: s.rose ?? 0, lift: 0, tlift: 1,
    tone: s.tone ?? 0, gloss: s.gloss ?? 0, squar: s.sq ?? 0,
  }) as BS);
  const groups: GroupState[] = [];
  if (cfg.group && stones.length) groups.push({ members: stones, tint: stones.some((s) => s.trose > 0.5) ? 1 : 0, show: 1, moat: cfg.moat ?? 120, pad: cfg.pad ?? 34, soft: 24 });

  // far view: many small groups scattered over the band
  const far: Stone[] = [];
  const farGroups: { mem: (Stone & { fr: number; fo: number })[] }[] = [];
  if (cfg.far) {
    const R = rng(cfg.far.seed);
    for (let g = 0; g < cfg.far.n; g++) {
      const n = 1 + Math.floor(R() * 3), mem: (Stone & { fr: number; fo: number })[] = [];
      for (let j = 0; j < n; j++) {
        const s = stone({ x: 0, y: 0, r: 10, aspect: 1.05 + R() * 0.3, rot: R() * 3, k: 1.4, lift: 0, tlift: 1, tone: R() < 0.3 ? 0.9 : R() * 0.2, gloss: R() < 0.3 ? 0.8 : 0, squar: R() < 0.3 ? 0.6 : 0.1 }) as Stone & { fr: number; fo: number };
        s.fr = 0.25 + R() * (R() < 0.15 ? 1.2 : 0.55); s.fo = j; mem.push(s);
      }
      if (R() < 0.62) { const r = stone({ x: 0, y: 0, r: 8, aspect: 1.06, k: 1.2, rose: 1, trose: 1, lift: 0, tlift: 1, gloss: 0.85 }) as Stone & { fr: number; fo: number }; r.fr = 0.22; r.fo = -1; mem.push(r); }
      far.push(...mem);
      farGroups.push({ mem });
      groups.push({ members: mem, tint: mem.some((s) => s.rose > 0.5) ? 1 : 0, show: 1, moat: 70, pad: 16, soft: 12 });
    }
  }
  const all: Stone[] = [...stones, ...far];

  let cap: Cap | null = null;
  const anchors = cfg.anchor ? [...document.querySelectorAll<HTMLElement>(cfg.anchor)] : [];
  const labels = cfg.labels ? [...el.querySelectorAll<HTMLElement>(cfg.labels)] : [];
  let hovered = -1;
  const clearEl = cfg.clear ? el.querySelector<HTMLElement>(cfg.clear) : null;
  const zoom = cfg.zoom ?? 1, tilt = cfg.tilt ?? 0;
  const V = () => ({ cam: [0, 0] as [number, number], zoom, tilt });

  function layout() {
    const r = el.getBoundingClientRect();
    W = r.width; H = r.height;
    if (W < 2 || H < 2) return;
    unit = Math.min(W, H);
    ground.resize(W, H, Math.min(window.devicePixelRatio || 1, W < 720 ? 1.5 : 1.25));
    const narrow = W < 720 && cfg.mstones;
    base.forEach((c0, i) => {
      const s = stones[i];
      const c = narrow ? { ...c0, ...cfg.mstones![i] } : c0;
      s.hx = c.x * W; s.hy = c.y * H; s.hr = c.r * unit;
      if (anchors[i]) { const a = anchors[i].getBoundingClientRect(); s.hy = a.top + a.height / 2 - r.top - H / 2; s.hr = c.r * Math.min(W, 520); }
      s.tx = s.hx; s.ty = s.hy; s.tr = s.hr;
      if (s.lift === 0) { s.x = s.tx; s.y = s.ty; s.r = s.tr; }
    });
    if (cfg.far) {
      // spread the far groups over the visible (tilted) ground without overlaps, and away from the heading
      const R = rng(cfg.far.seed + 7);
      const placed: [number, number, number][] = [];
      const hb = clearEl?.getBoundingClientRect();
      const k = W < 720 ? 0.8 : 1;
      for (const g of farGroups) {
        const rad = (g.mem.reduce((a, s) => a + s.fr * 34 * k * 2, 0) + 40) * 0.6 + 26;
        let sx = 0, sy = 0, ok = false;
        for (let a = 0; a < 60 && !ok; a++) {
          sx = R() * W; sy = (0.14 + R() * 0.84) * H;
          ok = placed.every(([x, y, r]) => Math.hypot(sx - x, sy - y) > r + rad + 10);
          if (ok && hb) { const hx = hb.left - r.left, hy = hb.top - r.top; ok = !(sx > hx - rad - 30 && sx < hx + hb.width + rad + 30 && sy > hy - rad - 30 && sy < hy + hb.height + rad + 30); }
        }
        if (!ok) { g.mem.forEach((s) => { s.tlift = 0; s.lift = 0; }); continue; }
        placed.push([sx, sy, rad]);
        const [wx, wy] = ground.toWorld(sx, sy, V());
        g.mem.forEach((s) => {
          const rr = s.fr * 34 * k, ang = sx * 0.02 + s.fo * 2.1;
          const off = s.fo < 0 ? 0 : (rr + 18) * (s.fo === 0 ? 0.9 : 1.25);
          s.tx = s.x = wx + Math.cos(ang) * off; s.ty = s.y = wy + Math.sin(ang) * off; s.tr = s.r = rr;
        });
      }
    }
    if (clearEl) {
      const b = clearEl.getBoundingClientRect();
      const cx = b.left + b.width / 2 - r.left - W / 2, cy = b.top + b.height / 2 - r.top - H / 2;
      const [wx, wy] = ground.toWorld(b.left + b.width / 2 - r.left, b.top + b.height / 2 - r.top, V());
      const [padX, padY] = (W < 720 ? cfg.mcapPad ?? cfg.capPad : cfg.capPad) ?? [W < 720 ? 14 : 34, 20];
      const hx = Math.min(b.width / 2 + padX, W / 2 - 6) / zoom, hy = (b.height / 2 + padY) / zoom;
      const moat = cfg.capMoat ? Math.max(hy * cfg.capMoat, (W < 720 ? 150 : 200) / zoom) : Math.max(hy * 2.4, (W < 720 ? 170 : 230) / zoom);
      cap = { cx: tilt ? wx : cx / zoom, cy: tilt ? wy : cy / zoom, hx, hy, rad: Math.min(hy * 0.95, 100 / zoom), moat, k: 0 };
    }
  }

  // dragged stones stay inside the band and off the heading's clearing
  function keepIn(s: BS, x: number, y: number): [number, number] {
    const m = s.hr * Math.max(s.aspect, 1 / s.aspect) * 1.2;
    x = Math.min(W / 2 - m, Math.max(-W / 2 + m, x)); y = Math.min(H / 2 - m, Math.max(-H / 2 + m, y));
    if (cap) {
      const ex = cap.hx + m + 16, ey = cap.hy + m + 16, dx = x - cap.cx, dy = y - cap.cy;
      if (Math.abs(dx) < ex && Math.abs(dy) < ey) {
        const px = ex - Math.abs(dx), py = ey - Math.abs(dy);
        if (px < py) x = cap.cx + Math.sign(dx || 1) * ex; else y = cap.cy + Math.sign(dy || 1) * ey;
      }
    }
    return [x, y];
  }

  // cursor
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, s: 0, ts: 0 };
  let dragging: BS | null = null, dragOff = [0, 0];
  const local = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return ground.toWorld(e.clientX - r.left, e.clientY - r.top, V()); };
  const hit = (x: number, y: number) => {
    let best: BS | null = null, bd = Infinity;
    for (const s of stones) { const d = Math.hypot(x - s.x, y - s.y); if (d < s.r * Math.max(s.aspect, 1 / s.aspect) * 1.05 && d < bd) { bd = d; best = s; } }
    return best;
  };
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const [x, y] = local(e);
    mouse.tx = x; mouse.ty = y;
    if (mouse.ts === 0) { mouse.x = x; mouse.y = y; }
    mouse.ts = dragging ? 0 : 1;
    if (dragging) { const [cx, cy] = keepIn(dragging, x - dragOff[0], y - dragOff[1]); dragging.tx = cx; dragging.ty = cy; }
    if (cfg.drag) el.classList.toggle('is-grab', !!dragging || !!hit(x, y));
    kick();
  });
  el.addEventListener('pointerleave', () => { mouse.ts = 0; kick(); });
  if (cfg.drag) {
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      const [x, y] = local(e);
      const s = hit(x, y);
      if (!s) return;
      e.preventDefault();
      dragging = s; dragOff = [x - s.x, y - s.y];
      s.tr = s.hr * 1.08;
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
      kick();
    });
    const end = () => { if (!dragging) return; dragging.tr = dragging.hr; dragging = null; el.classList.remove('is-dragging'); kick(); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  // a click on the open ground sets a small rose stone down; the oldest of five sinks again
  const placed: Stone[] = [];
  if (cfg.place) {
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a,button')) return;
      const r = el.getBoundingClientRect();
      const [x, y] = ground.toWorld(e.clientX - r.left, e.clientY - r.top, V());
      if (insideCap(cap ? { ...cap, k: 1 } : null, x, y)) return;
      const k = Math.min(W, 1200) / 900;
      const s = stone({ x, y, r: (12 + Math.random() * 9) * Math.max(0.7, k), aspect: 1.1, rot: Math.random() * 3, k: 1.3, rose: 1, trose: 1, lift: 0, tlift: 1, gloss: 0.85 });
      placed.push(s); all.push(s);
      if (placed.length > 5) placed.shift()!.tlift = 0;
      kick();
    });
  }

  if (cfg.hover) {
    const hs = [...document.querySelectorAll<HTMLElement>(cfg.hover)];
    hs.forEach((h, i) => {
      const s = stones[i]; if (!s) return;
      const b = base[i];
      const on = () => {
        hovered = i;
        s.trose = (b.rose ?? 0) > 0.5 ? 1 : 0.3; s.tr = s.hr * 1.12;
        if (cfg.hoverMode === 'part') stones.forEach((o, j) => {
          if (j === i) return;
          if (anchors.length) { const d = o.hy - s.hy; o.ty = o.hy + Math.sign(d || 1) * Math.max(0, 1 - Math.abs(d) / 400) * 26; }
          else { const d = o.hx - s.hx; o.tx = o.hx + Math.sign(d || 1) * Math.max(0, 1 - Math.abs(d) / (W * 0.5)) * unit * 0.14; }
        });
        kick();
      };
      const off = () => {
        if (hovered === i) hovered = -1;
        s.trose = b.rose ?? 0; s.tr = s.hr;
        if (cfg.hoverMode === 'part') stones.forEach((o) => { if (o !== dragging) { o.tx = o.hx; o.ty = o.hy; } });
        kick();
      };
      h.addEventListener('pointerenter', on); h.addEventListener('pointerleave', off);
      h.addEventListener('focusin', on); h.addEventListener('focusout', off);
    });
  }

  let raf = 0, last = performance.now(), visible = false, open = reduced ? 1 : 0;
  const t0 = performance.now();
  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    mouse.x += (mouse.tx - mouse.x) * 0.12; mouse.y += (mouse.ty - mouse.y) * 0.12;
    mouse.s += (mouse.ts - mouse.s) * (1 - Math.exp(-3 * dt));
    step(all, dt, { instant: reduced, gap: 6 });
    for (let i = all.length - 1; i >= stones.length + far.length; i--) if (all[i].tlift === 0 && all[i].lift < 0.01) all.splice(i, 1);
    open = Math.min(1, open + dt / 1.6);
    if (groups.length && cfg.group) {
      const want = hovered >= 0 || dragging || base.some((b) => (b.rose ?? 0) > 0.5) ? 1 : 0;
      groups[0].tint += (want - groups[0].tint) * (1 - Math.exp(-4 * dt));
    }
    labels.forEach((lb, i) => {
      const s = stones[i]; if (!s) return;
      const on = hovered === i || dragging === s || (cfg.drag && hit(mouse.tx, mouse.ty) === s && mouse.ts > 0);
      lb.classList.toggle('on', !!on);
      lb.style.transform = `translate3d(${(W / 2 + s.x + s.r * Math.max(s.aspect, 1 / s.aspect) + 12).toFixed(1)}px, ${(H / 2 + s.y - 10).toFixed(1)}px, 0)`;
    });
    const t = (now - t0) / 1000;
    const br = cfg.breathe && !reduced ? Math.sin(t * 0.8) * 5 * Math.min(1.25, Math.max(0.56, W / 1000)) : 0;
    ground.draw({
      ...V(), space: cfg.space ?? (W < 720 ? 9.5 : 13), time: reduced ? 0 : t, flow: reduced ? 0 : t * 2, dusk: cfg.dusk ?? 0,
      kScale: cfg.kScale ?? 1, stones: all, groups, cap: cap ? { ...cap, hx: cap.hx + br, hy: cap.hy + br * 0.6, k: ease(open) } : null,
      mouse: reduced ? null : { x: mouse.x, y: mouse.y, s: mouse.s * 0.85, R: 60 / zoom },
    });
    const moving = all.some((s) => Math.abs(s.vx) + Math.abs(s.vy) > 0.02 || Math.abs(s.lift - s.tlift) > 0.002 || Math.abs(s.rose - s.trose) > 0.002 || Math.abs(s.r - s.tr) > 0.05)
      || Math.abs(mouse.s - mouse.ts) > 0.002 || Math.hypot(mouse.tx - mouse.x, mouse.ty - mouse.y) > 0.3 || open < 1 || !!dragging || (groups[0] && Math.abs(groups[0].tint - Math.round(groups[0].tint)) > 0.01);
    // the lines drift slowly while the band is in view (not under reduced motion)
    if (visible && (moving || !reduced)) kick();
  }
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { last = performance.now(); kick(); } }).observe(el);
  new ResizeObserver(() => { layout(); kick(); }).observe(el);
  layout();
  if (document.fonts) document.fonts.ready.then(() => { layout(); kick(); });
}
