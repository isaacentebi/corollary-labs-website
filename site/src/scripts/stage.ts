// Home stage: one sticky canvas, one scroll progress p. Renders on demand only.
//  p 0.00–0.06  the structure as it stands (visitor can plug units in; drag turns the drawing)
//  p 0.06–0.50  agents plug in; a core rises; new infrastructure grows; units re-seat onto it
//  p 0.56–0.97  pull back to the city plan; the same change travels along the network
import { type Cam, type Item, C, proj, depthSort } from './axon';
import { Struct, ghostItem, clamp, ease, BEAM_H, CAP_L, CAP_H } from './mega';
import { buildHero, buildCity, SPINE_Y } from './city';

const PI = Math.PI;
const win = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function initStage(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const track = root;
  const ctx = canvas.getContext('2d')!;
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  const { H, cores } = buildHero();
  const { clusters, branches } = buildCity();
  const states = [...root.querySelectorAll<HTMLElement>('[data-state]')];

  let W = 0, Hh = 0, dpr = 1;
  let p = 0;
  let thUser = 0, thTarget = 0;
  let hover = -1;
  let pointer: { x: number; y: number } | null = null;
  let raf = 0;
  const pulses: { sock: number; t0: number }[] = [];
  const pendingPulse = new Map<number, number>(); // sock -> time plug completes


  function size() {
    const r = canvas.getBoundingClientRect();
    W = r.width;
    Hh = r.height;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(Hh * dpr);
    invalidate();
  }

  function phase() {
    let q = p;
    if (rm.matches) q = p < 0.3 ? 0 : p < 0.72 ? 0.52 : 1;
    return { t: ease(win(q, 0.06, 0.5)) * 1.0, c: win(q, 0.56, 0.97) };
  }

  function heroCam(t: number): Cam {
    const mobile = W < 720;
    const th = -0.62 + 0.32 * t + thUser;
    // fit what stands now, easing toward the grown structure (the frame widens as it grows)
    const b0 = H.boundsAt(0), b1 = H.boundsAt(1);
    const k = ease(clamp(t * 1.15));
    const bounds = { x0: lerp(b0.x0, b1.x0, k), x1: lerp(b0.x1, b1.x1, k), y0: lerp(b0.y0, b1.y0, k), y1: lerp(b0.y1, b1.y1, k), z1: lerp(b0.z1, b1.z1, k) };
    const cam: Cam = { cx: 0, cy: 0, wx: (bounds.x0 + bounds.x1) / 2, wy: (bounds.y0 + bounds.y1) / 2, wz: 6, s: 1, th, ky: 0.6, kz: 1 };
    // fit the grown structure into the drawing area
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const x of [bounds.x0, bounds.x1]) for (const y of [bounds.y0, bounds.y1]) for (const z of [0, bounds.z1 + 1]) {
      const [sx, sy] = proj(cam, x, y, z);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    const area = mobile ? { l: 12, r: W - 12, t: 90, b: Hh * 0.78 } : { l: W * lerp(0.4, 0.3, k), r: W - 60, t: 90, b: Hh - 50 };
    const s = Math.min((area.r - area.l) / (x1 - x0), (area.b - area.t) / (y1 - y0)) * (mobile ? 1.3 : 1.28);
    cam.s = s;
    cam.cx = (area.l + area.r) / 2 - ((x0 + x1) / 2) * s;
    cam.cy = (area.t + area.b) / 2 - ((y0 + y1) / 2) * s;
    // express as world centre mapping to screen centre
    return cam;
  }

  function camera(t: number, c: number): Cam {
    const h = heroCam(t);
    if (c <= 0) return h;
    const e = ease(clamp(c / 0.62));
    const mobile = W < 720;
    const sEnd = mobile ? W / 150 : Math.max(W, Hh * 1.3) / 380;
    const s = Math.exp(lerp(Math.log(h.s), Math.log(sEnd), e));
    // zoom about a moving anchor: our structure stays in frame while the city opens
    const f = (1 / s - 1 / h.s) / (1 / sEnd - 1 / h.s);
    const th = h.th + 0.18 * e;
    const ky = lerp(0.6, 0.86, e), kz = lerp(1, 0.46, e);
    // screen position of the hero centre, then of the city centre
    const cam: Cam = { ...h, s, th, ky, kz };
    const hx = W < 720 ? W / 2 : W * 0.66;
    const [hsx, hsy] = proj(h, 5, 5, 0);
    const ax = lerp(hsx, W < 720 ? W / 2 : W * 0.6, f), ay = lerp(hsy, Hh * (mobile ? 0.5 : 0.6), f);
    const wx = lerp(5, 5, f), wy = lerp(5, SPINE_Y + 34, f);
    cam.wx = wx; cam.wy = wy; cam.wz = 0;
    cam.cx = ax; cam.cy = ay;
    void hx;
    return cam;
  }

  function userFree(t: number, now: number) {
    const out: number[] = [];
    H.socks.forEach((s, i) => {
      if (H.scripted.has(i) || H.userBusy.has(i)) return;
      if (H.sockReady(i) > t) return;
      if (s.beam >= 0) {
        const b = H.beams[s.beam];
        if (H.beamGrow(b, t, now) < 1) return;
        if (H.coreH(b.core, t) < b.z + BEAM_H + 0.3) return;
      } else if (H.coreH(s.core, t) < s.z + CAP_H + 0.3) return;
      out.push(i);
    });
    return out;
  }

  function nearestSock(cam: Cam, t: number, now: number, x: number, y: number) {
    let best = -1, bd = 44 * 44;
    for (const i of userFree(t, now)) {
      const s = H.socks[i];
      const [sx, sy] = proj(cam, s.x + Math.cos(s.a) * CAP_L * 0.6, s.y + Math.sin(s.a) * CAP_L * 0.6, s.z + CAP_H / 2);
      const d = (sx - x) ** 2 + (sy - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function grow(t: number, now: number) {
    // new infrastructure when free sockets run low: a cantilever from a standing core
    const cand: [number, number, number][] = [];
    for (const ci of [cores.A, cores.B, cores.C, cores.D]) {
      const h = H.coreH(ci, t);
      for (let z = 1.6; z < h - 1.6; z += 1.3) for (let k = 0; k < 4; k++) cand.push([ci, (k * PI) / 2 + PI / 4 * (ci === cores.D ? 0 : 0), z]);
    }
    for (let n = 0; n < cand.length; n++) {
      const [ci, a, z] = cand[Math.floor(Math.random() * cand.length)];
      if (H.canBeam(ci, a, 4.2, z)) {
        const bi = H.beam(ci, a, 4.2, z);
        H.beams[bi].real = now;
        H.beams[bi].realDur = rm.matches ? 0 : 900;
        return true;
      }
    }
    return false;
  }

  function plugAt(i: number) {
    const now = performance.now();
    const dur = rm.matches ? 0 : 1150;
    H.userBusy.add(i);
    H.caps.push({ agent: true, user: true, moves: [{ kind: 'plug', from: i, to: i, t0: now, t1: now + dur, real: true }] });
    pendingPulse.set(i, now + dur);
    const { t } = phase();
    if (userFree(t, now + 5000).length < 5) grow(t, now + dur * 0.6);
    invalidate();
  }

  function pulsePath(sock: number, t: number): [number, number, number][] {
    const s = H.socks[sock];
    if (s.beam >= 0) {
      const b = H.beams[s.beam];
      const c = H.cores[b.core];
      const ux = Math.cos(b.a), uy = Math.sin(b.a);
      const sx = c.x + ux * (c.r * 0.6 + s.s), sy = c.y + uy * (c.r * 0.6 + s.s);
      const top = b.z + BEAM_H;
      const h = H.coreH(b.core, t);
      return [[sx, sy, top], [c.x + ux * c.r, c.y + uy * c.r, top], [c.x + ux * c.r, c.y + uy * c.r, h]];
    }
    const c = H.cores[s.core];
    const ex = c.x + Math.cos(s.a) * c.r, ey = c.y + Math.sin(s.a) * c.r;
    return [[ex, ey, s.z + CAP_H / 2], [ex, ey, H.coreH(s.core, t)]];
  }

  function drawGround(cam: Cam, c: number) {
    const a = 0.2 + 0.1 * c;
    ctx.strokeStyle = `rgba(${C.line},${a})`;
    ctx.lineWidth = 1;
    const seg = (x0: number, y0: number, x1: number, y1: number) => {
      const [p0x, p0y] = proj(cam, x0, y0, 0), [p1x, p1y] = proj(cam, x1, y1, 0);
      ctx.moveTo(p0x, p0y);
      ctx.lineTo(p1x, p1y);
    };
    ctx.beginPath();
    const X0 = -260, X1 = 260;
    seg(X0, SPINE_Y - 1.6, X1, SPINE_Y - 1.6);
    seg(X0, SPINE_Y + 1.6, X1, SPINE_Y + 1.6);
    for (const b of branches) {
      const reveal = b.x === 5 && b.y1 > SPINE_Y ? 1 : c > 0 ? 1 : 0;
      if (!reveal) continue;
      seg(b.x - 0.7, b.y0, b.x - 0.7, b.y1);
      seg(b.x + 0.7, b.y0, b.x + 0.7, b.y1);
    }
    ctx.stroke();
    // centre line of the spine
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = `rgba(${C.line},${a * 0.6})`;
    ctx.beginPath();
    seg(X0, SPINE_Y, X1, SPINE_Y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function frame() {
    raf = 0;
    const now = performance.now();
    const tStart = now;
    let busy = false;
    if (Math.abs(thTarget - thUser) > 1e-4) {
      thUser += (thTarget - thUser) * (rm.matches ? 1 : 0.18);
      busy = true;
    }
    const { t, c } = phase();
    const cam = camera(t, c);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.night;
    ctx.fillRect(0, 0, W, Hh);
    drawGround(cam, c);

    const items: Item[] = [];
    const lod = cam.s < 7;
    H.items(cam, t, now, items, { lod });
    if (c > 0) {
      const fade = clamp(c / 0.25);
      for (const cl of clusters) cl.S.items(cam, c, now, items, { lod, fade, cull: [W, Hh] });
    }
    // full ordering while the drawing is close; centroid order is enough at city scale
    const ordered = lod ? items.sort((a, b) => a.c - b.c) : depthSort(items, cam);
    for (const it of ordered) it.draw(ctx);

    // hover preview
    if (hover >= 0 && c === 0) ghostItem(cam, H.socks[hover]).draw(ctx);

    // pulses along the infrastructure after a unit plugs in
    for (const [sock, at] of pendingPulse) if (now >= at) { pulses.push({ sock, t0: at }); pendingPulse.delete(sock); }
    for (let k = pulses.length - 1; k >= 0; k--) {
      const pu = pulses[k];
      const u = (now - pu.t0) / 1100;
      if (u >= 1 || rm.matches) { pulses.splice(k, 1); continue; }
      const pts = pulsePath(pu.sock, t).map(([x, y, z]) => proj(cam, x, y, z));
      const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
      const L = lens.reduce((a, b) => a + b, 0);
      const head = ease(u) * L, tail = Math.max(0, head - 60);
      ctx.strokeStyle = `rgba(${C.lampRGB},${1 - u * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let acc = 0;
      pts.slice(1).forEach((q, i) => {
        const P = pts[i], l = lens[i];
        const a = clamp((tail - acc) / l), b = clamp((head - acc) / l);
        if (b > a) {
          ctx.moveTo(P[0] + (q[0] - P[0]) * a, P[1] + (q[1] - P[1]) * a);
          ctx.lineTo(P[0] + (q[0] - P[0]) * b, P[1] + (q[1] - P[1]) * b);
        }
        acc += l;
      });
      ctx.stroke();
      ctx.lineWidth = 1;
      busy = true;
    }
    if (pendingPulse.size) busy = true;
    // anything still moving in real time?
    for (const cap of H.caps) if (cap.user && now < cap.moves[0].t1) busy = true;
    for (const b of H.beams) if (b.real !== undefined && now < b.real + (b.realDur || 0)) busy = true;
    (window as any).__ms = performance.now() - tStart;
    if (busy) invalidate();
  }

  function invalidate() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function onScroll() {
    const r = track.getBoundingClientRect();
    const span = r.height - innerHeight;
    const np = clamp(-r.top / Math.max(1, span));
    if (np !== p) {
      p = np;
      const st = p < 0.3 ? 0 : p < 0.72 ? 1 : 2;
      states.forEach((el, i) => el.classList.toggle('is-on', i === st));
      root.style.setProperty('--p', p.toFixed(4));
      root.classList.toggle('is-city', p > 0.58);
      if (p > 0.05) hover = -1;
      invalidate();
    }
  }

  // pointer: drag turns the drawing, click/tap plugs a unit into the nearest free socket
  let down: { x: number; y: number; th: number; moved: boolean; id: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, th: thTarget, moved: false, id: e.pointerId };
  });
  addEventListener('pointerup', (e) => {
    if (!down) return;
    const wasDrag = down.moved;
    down = null;
    root.classList.remove('is-drag');
    if (wasDrag) return;
    const r = canvas.getBoundingClientRect();
    const { t, c } = phase();
    if (c > 0) return;
    const i = nearestSock(camera(t, c), t, performance.now(), e.clientX - r.left, e.clientY - r.top);
    if (i >= 0) { plugAt(i); hover = -1; }
  });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (down) {
      const dx = e.clientX - down.x;
      if (!down.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - down.y)) {
        down.moved = true;
        root.classList.add('is-drag');
      }
      if (down.moved) {
        thTarget = down.th + dx * 0.0045;
        invalidate();
        return;
      }
    }
    if (e.pointerType !== 'mouse') return;
    const { t, c } = phase();
    const h = c > 0 ? -1 : nearestSock(camera(t, c), t, performance.now(), pointer.x, pointer.y);
    if (h !== hover) {
      hover = h;
      canvas.style.cursor = h >= 0 ? 'pointer' : 'grab';
      invalidate();
    }
  });
  canvas.addEventListener('pointerleave', () => {
    pointer = null;
    if (hover !== -1) { hover = -1; invalidate(); }
  });
  addEventListener('keydown', (e) => {
    if (document.activeElement !== canvas) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      thTarget += e.key === 'ArrowLeft' ? -0.12 : 0.12;
      invalidate();
      e.preventDefault();
    }
    if (e.key === 'Enter' || e.key === ' ') {
      const { t } = phase();
      const f = userFree(t, performance.now());
      if (f.length) plugAt(f[Math.floor(Math.random() * f.length)]);
      e.preventDefault();
    }
  });

  addEventListener('scroll', onScroll, { passive: true });
  new ResizeObserver(size).observe(canvas);
  rm.addEventListener?.('change', invalidate);
  size();
  onScroll();
  states[0]?.classList.add('is-on');
  (window as any).__stage = { get p() { return p; }, plug: () => { const { t } = phase(); const f = userFree(t, performance.now()); if (f.length) plugAt(f[0]); }, freeScreen: () => {
    const { t, c } = phase(); const cam = camera(t, c); const f = userFree(t, performance.now());
    return f.map((i) => { const s = H.socks[i]; return proj(cam, s.x + Math.cos(s.a) * CAP_L * 0.6, s.y + Math.sin(s.a) * CAP_L * 0.6, s.z + CAP_H / 2); });
  }, H, clusters };
}

// Static drawing for figures and inner pages: a structure at rest, fitted to its canvas.
export function drawStatic(canvas: HTMLCanvasElement, S: Struct, opts: { th?: number; ky?: number; kz?: number; t?: number; pad?: number } = {}) {
  const ctx = canvas.getContext('2d')!;
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  const b = S.bounds();
  const cam: Cam = { cx: 0, cy: 0, wx: (b.x0 + b.x1) / 2, wy: (b.y0 + b.y1) / 2, wz: 0, s: 1, th: opts.th ?? -0.62, ky: opts.ky ?? 0.6, kz: opts.kz ?? 1 };
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const o of S.solids) for (const x of [o[0], o[1]]) for (const y of [o[2], o[3]]) for (const z of [o[4], o[5]]) {
    const [sx, sy] = proj(cam, x, y, z);
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  void b;
  const pad = opts.pad ?? 24;
  const s = Math.min((r.width - pad * 2) / (x1 - x0), (r.height - pad * 2) / (y1 - y0));
  cam.s = s;
  cam.cx = r.width / 2 - ((x0 + x1) / 2) * s;
  cam.cy = r.height / 2 - ((y0 + y1) / 2) * s;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = C.night;
  ctx.fillRect(0, 0, r.width, r.height);
  const items: Item[] = [];
  S.items(cam, opts.t ?? 1, performance.now(), items, {});
  for (const it of depthSort(items, cam)) it.draw(ctx);
}
