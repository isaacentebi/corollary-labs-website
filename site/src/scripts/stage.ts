// Home stage: one sticky canvas, one scroll progress p. Renders on demand only.
//  p 0.00–0.06  the structure as it stands (open sockets shown; visitor plugs units in; drag turns the drawing)
//  p 0.06–0.50  agents plug in; a core rises; new infrastructure grows; units re-seat onto it
//  p 0.56–0.97  pull back and flatten to a plan of the city; the change travels along the network
import { type Cam, type Item, C, proj, depthSort } from './axon';
import { Struct, clamp, ease, BEAM_H, CAP_L, CAP_H } from './mega';
import { buildHero, buildCity, SPINE_Y, FRONT } from './city';

const PI = Math.PI;
const win = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const LATCH = 750; // ms a unit stays lit after it latches
const PULSE = 1250;

export function initStage(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  const { H, cores } = buildHero();
  const { clusters, branches, net } = buildCity();
  const states = [...root.querySelectorAll<HTMLElement>('[data-state]')];
  const firstMove = Math.min(...H.caps.flatMap((c) => c.moves.filter((m) => m.t0 >= 0).map((m) => m.t0)));

  let W = 0, Hh = 0, dpr = 1;
  let p = 0;
  let thUser = 0, thTarget = 0;
  let hover = -1;
  let raf = 0;
  const pulses: { sock: number; cap: number; t0: number }[] = [];

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
    return { t: ease(win(q, 0.06, 0.5)), c: win(q, 0.56, 0.97) };
  }

  const mobile = () => W < 720;

  function heroCam(t: number): Cam {
    const mob = mobile();
    const th = -0.62 + 0.32 * t + thUser;
    // fit what stands now (the frame widens as the structure grows)
    const k = ease(clamp(t * 1.15));
    const cam: Cam = { cx: 0, cy: 0, wx: 5, wy: 5, wz: 6, s: 1, th, ky: 0.6, kz: 1 };
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y, z] of H.fitPoints(t)) {
      const [sx, sy] = proj(cam, x, y, z);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    let s: number, area: { l: number; r: number; t: number; b: number };
    if (mob) {
      // portrait: fill the width, sit just above the name
      area = { l: 10, r: W - 10, t: 76, b: Hh - 200 };
      s = Math.min((area.r - area.l) / (x1 - x0), (area.b - area.t) / (y1 - y0));
    } else {
      area = { l: W * lerp(0.42, 0.34, k), r: W - 70, t: 100, b: Hh - 60 };
      s = Math.min((area.r - area.l) / (x1 - x0), (area.b - area.t) / (y1 - y0));
    }
    cam.s = s;
    cam.cx = (area.l + area.r) / 2 - ((x0 + x1) / 2) * s;
    cam.cy = mob ? area.b - y1 * s : (area.t + area.b) / 2 - ((y0 + y1) / 2) * s;
    return cam;
  }

  function camera(t: number, c: number): Cam {
    const h = heroCam(t);
    if (c <= 0) return h;
    const mob = mobile();
    const e = ease(clamp(c / 0.6));
    // the plan: spine across the screen (down the screen on phones), seen from straight above
    const thCity = mob ? -PI / 2 : 0;
    const sEnd = mob ? Hh / 230 : Math.min(W / 250, Hh / 150);
    const s = Math.exp(lerp(Math.log(h.s), Math.log(sEnd), e));
    const f = (1 / s - 1 / h.s) / (1 / sEnd - 1 / h.s);
    // rotation (including the visitor's) eases back to the canonical plan angle
    let dth = thCity - h.th;
    dth = Math.atan2(Math.sin(dth), Math.cos(dth));
    const cam: Cam = { ...h, s, th: h.th + dth * e, ky: lerp(0.6, 1, e), kz: lerp(1, 0.14, e) };
    const [hsx, hsy] = proj(h, 5, 5, 0);
    const endX = mob ? W * 0.42 : W * 0.56, endY = mob ? Hh * 0.5 : Hh * 0.47;
    cam.wx = 5;
    cam.wy = lerp(5, mob ? SPINE_Y + 8 : SPINE_Y + 4, f);
    cam.wz = 0;
    cam.cx = lerp(hsx, endX, f);
    cam.cy = lerp(hsy, endY, f);
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

  const sockScreen = (cam: Cam, i: number) => {
    const s = H.socks[i];
    return proj(cam, s.x + Math.cos(s.a) * CAP_L * 0.4, s.y + Math.sin(s.a) * CAP_L * 0.4, s.z + CAP_H / 2);
  };

  // nearest open socket to a point on screen; with no radius, any click on the drawing finds one
  function nearestSock(cam: Cam, t: number, now: number, x: number, y: number, radius = Infinity) {
    let best = -1, bd = radius * radius;
    for (const i of userFree(t, now)) {
      const [sx, sy] = sockScreen(cam, i);
      const d = (sx - x) ** 2 + (sy - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function grow(t: number, now: number) {
    // new infrastructure when open sockets run low: a cantilever from a standing core
    const cand: [number, number, number][] = [];
    for (const ci of [cores.A, cores.B, cores.C, cores.D]) {
      const h = H.coreH(ci, t);
      for (let z = 1.6; z < h - 1.6; z += 1.3) for (let k = 0; k < 4; k++) cand.push([ci, (k * PI) / 2, z]);
    }
    for (let n = cand.length - 1; n > 0; n--) {
      const j = Math.floor(Math.random() * (n + 1));
      [cand[n], cand[j]] = [cand[j], cand[n]];
    }
    for (const [ci, a, z] of cand) {
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
    pulses.push({ sock: i, cap: H.caps.length - 1, t0: now + dur });
    const { t } = phase();
    if (userFree(t, now + 5000).length < 6) grow(t, now + dur * 0.5);
    invalidate();
  }

  function pulsePath(sock: number, t: number): [number, number, number][] {
    const s = H.socks[sock];
    if (s.beam >= 0) {
      const b = H.beams[s.beam];
      const c = H.cores[b.core];
      const ux = Math.cos(b.a), uy = Math.sin(b.a);
      const sx = c.x + ux * (c.r * 0.75 + s.s), sy = c.y + uy * (c.r * 0.75 + s.s);
      const top = b.z + BEAM_H;
      const h = H.coreH(b.core, t);
      return [[sx, sy, top], [c.x + ux * c.r, c.y + uy * c.r, top], [c.x + ux * c.r, c.y + uy * c.r, h]];
    }
    const c = H.cores[s.core];
    const ex = c.x + Math.cos(s.a) * c.r, ey = c.y + Math.sin(s.a) * c.r;
    return [[ex, ey, s.z + CAP_H / 2], [ex, ey, H.coreH(s.core, t)]];
  }

  // which core a socket hangs from
  const sockCore = (i: number) => {
    const s = H.socks[i];
    return s.beam >= 0 ? H.beams[s.beam].core : s.core;
  };

  function drawGround(cam: Cam, c: number) {
    const seg = (x0: number, y0: number, x1: number, y1: number) => {
      const [p0x, p0y] = proj(cam, x0, y0, 0), [p1x, p1y] = proj(cam, x1, y1, 0);
      ctx.moveTo(p0x, p0y);
      ctx.lineTo(p1x, p1y);
    };
    const X0 = -270, X1 = 280;
    ctx.lineWidth = 1;
    // spine: the main line, drawn heavier, with an inner pair and a centre line
    ctx.strokeStyle = `rgba(${C.line},${0.26 + 0.3 * c})`;
    ctx.lineWidth = 1 + 0.4 * c;
    ctx.beginPath();
    seg(X0, SPINE_Y - 2.2, X1, SPINE_Y - 2.2);
    seg(X0, SPINE_Y + 2.2, X1, SPINE_Y + 2.2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${C.line},${0.1 + 0.14 * c})`;
    ctx.beginPath();
    seg(X0, SPINE_Y - 1.1, X1, SPINE_Y - 1.1);
    seg(X0, SPINE_Y + 1.1, X1, SPINE_Y + 1.1);
    ctx.stroke();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = `rgba(${C.line},${0.14 + 0.12 * c})`;
    ctx.beginPath();
    seg(X0, SPINE_Y, X1, SPINE_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    // branches: lighter double lines
    ctx.strokeStyle = `rgba(${C.line},${0.18 + 0.1 * c})`;
    ctx.beginPath();
    for (const b of branches) {
      if (!(b.x === 5 && b.y1 > SPINE_Y) && c <= 0) continue;
      seg(b.x - 0.7, b.y0, b.x - 0.7, b.y1);
      seg(b.x + 0.7, b.y0, b.x + 0.7, b.y1);
    }
    ctx.stroke();
  }

  // the change travelling along the network from our structure
  function drawFront(cam: Cam, c: number) {
    // our plot: where the change started (and where the visitor plugged units in)
    const k = clamp(c / 0.3);
    if (k > 0) {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = `rgba(${C.lampRGB},${0.7 * k})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const q = [[-8.5, -8], [18.5, -8], [18.5, 18.5], [-8.5, 18.5]].map(([x, y]) => proj(cam, x, y, 0));
      q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    const D = FRONT(c);
    if (D <= 0) return;
    const glowOn = !rm.matches;
    for (const pass of [0, 1]) {
      ctx.save();
      ctx.lineCap = 'round';
      if (pass === 1 && glowOn) {
        ctx.shadowColor = `rgba(${C.lampRGB},0.9)`;
        ctx.shadowBlur = 10;
      }
      ctx.beginPath();
      for (const n of net) {
        const len = Math.hypot(n.x1 - n.x0, n.y1 - n.y0);
        const a = pass === 0 ? 0 : Math.max(0, (D - 16 - n.d0) / len);
        const b = Math.min(1, (D - n.d0) / len);
        if (b <= a) continue;
        const P = proj(cam, lerp(n.x0, n.x1, a), lerp(n.y0, n.y1, a), 0);
        const Q = proj(cam, lerp(n.x0, n.x1, b), lerp(n.y0, n.y1, b), 0);
        ctx.moveTo(P[0], P[1]);
        ctx.lineTo(Q[0], Q[1]);
      }
      ctx.strokeStyle = pass === 0 ? `rgba(${C.lampRGB},0.42)` : `rgba(${C.lampRGB},1)`;
      ctx.lineWidth = pass === 0 ? 1.5 : 3;
      ctx.stroke();
      ctx.restore();
    }
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
    if (c > 0) drawFront(cam, c);

    // lit units: a unit that has just latched, and its siblings while the pulse passes them
    const glow = new Map<number, number>();
    for (let k = pulses.length - 1; k >= 0; k--) {
      const pu = pulses[k];
      const u = (now - pu.t0) / PULSE;
      if (u >= 1 || rm.matches) { pulses.splice(k, 1); continue; }
      if (u < 0) continue;
      glow.set(pu.cap, Math.max(glow.get(pu.cap) || 0, 1 - clamp((now - pu.t0) / LATCH)));
      const core = sockCore(pu.sock);
      const k2 = Math.sin(PI * clamp(u * 1.4 - 0.15));
      H.caps.forEach((cap, ci) => {
        if (ci === pu.cap) return;
        const last = cap.moves[cap.moves.length - 1];
        if (sockCore(last.to) === core) glow.set(ci, Math.max(glow.get(ci) || 0, 0.75 * k2));
      });
    }

    const items: Item[] = [];
    const lod = cam.s < 7;
    const ghosts = c === 0 ? userFree(t, now) : undefined;
    H.items(cam, t, now, items, { lod, glow: (ci) => glow.get(ci) || 0, ghosts, ghostA: 0.34 - 0.16 * clamp(t * 4), hover });
    if (c > 0) {
      const fade = clamp(c / 0.25);
      for (const cl of clusters) cl.S.items(cam, c, now, items, { lod, fade, cull: [W, Hh] });
    }
    // full ordering while the drawing is close; centroid order is enough at city scale
    const ordered = lod ? items.sort((a, b) => a.c - b.c) : depthSort(items, cam);
    for (const it of ordered) it.draw(ctx);

    // pulse: a travelling lamp segment along the beam and up the core
    for (const pu of pulses) {
      const u = (now - pu.t0) / PULSE;
      if (u < 0 || u >= 1 || rm.matches) continue;
      const pts = pulsePath(pu.sock, t).map(([x, y, z]) => proj(cam, x, y, z));
      const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
      const L = lens.reduce((a, b) => a + b, 0);
      const head = ease(clamp(u * 1.25)) * (L + 30);
      const fadeOut = 1 - Math.max(0, u - 0.6) / 0.4;
      const span = (from: number, to: number) => {
        ctx.beginPath();
        let acc = 0;
        pts.slice(1).forEach((q, i) => {
          const P = pts[i], l = lens[i];
          const a = clamp((from - acc) / l), b = clamp((Math.min(to, L) - acc) / l);
          if (b > a) {
            ctx.moveTo(P[0] + (q[0] - P[0]) * a, P[1] + (q[1] - P[1]) * a);
            ctx.lineTo(P[0] + (q[0] - P[0]) * b, P[1] + (q[1] - P[1]) * b);
          }
          acc += l;
        });
        ctx.stroke();
      };
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // the lit trail behind the head
      ctx.strokeStyle = `rgba(${C.lampRGB},${0.55 * fadeOut})`;
      ctx.lineWidth = 2;
      span(0, head);
      // the travelling segment, with bloom
      ctx.shadowColor = `rgba(${C.lampRGB},1)`;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = `rgba(255,226,150,${fadeOut})`;
      ctx.lineWidth = 4.5;
      span(Math.max(0, head - 90), head);
      ctx.restore();
      busy = true;
    }
    if (pulses.length) busy = true;
    for (const cap of H.caps) if (cap.user && now < cap.moves[0].t1) busy = true;
    for (const b of H.beams) if (b.real !== undefined && now < b.real + (b.realDur || 0)) busy = true;
    (window as any).__ms = performance.now() - tStart;
    if (busy) invalidate();
  }

  function invalidate() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function onScroll() {
    const r = root.getBoundingClientRect();
    const span = r.height - innerHeight;
    const np = clamp(-r.top / Math.max(1, span));
    if (np !== p) {
      p = np;
      const { t, c } = phase();
      // the caption follows the drawing: state 2 as soon as the first unit is lowered in
      const st = c > 0.04 ? 2 : t >= firstMove ? 1 : 0;
      states.forEach((el, i) => el.classList.toggle('is-on', i === st));
      root.style.setProperty('--p', p.toFixed(4));
      root.classList.toggle('is-city', c > 0.05);
      root.classList.toggle('is-open', c === 0);
      if (c > 0) hover = -1;
      invalidate();
    }
  }

  // pointer: drag turns the drawing; a click or tap anywhere on it plugs a unit into the nearest open socket
  let down: { x: number; y: number; th: number; moved: boolean } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, th: thTarget, moved: false };
  });
  addEventListener('pointerup', (e) => {
    if (!down) return;
    const wasDrag = down.moved;
    down = null;
    root.classList.remove('is-drag');
    if (wasDrag) return;
    if (e.target !== canvas) return;
    const r = canvas.getBoundingClientRect();
    const { t, c } = phase();
    if (c > 0) return;
    const i = nearestSock(camera(t, c), t, performance.now(), e.clientX - r.left, e.clientY - r.top);
    if (i >= 0) plugAt(i);
  });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
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
    const h = c > 0 ? -1 : nearestSock(camera(t, c), t, performance.now(), x, y);
    if (h !== hover) {
      hover = h;
      invalidate();
    }
  });
  canvas.addEventListener('pointerleave', () => {
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
  root.classList.add('is-open');
  (window as any).__stage = {
    get p() { return p; },
    plug: () => { const { t } = phase(); const f = userFree(t, performance.now()); if (f.length) plugAt(f[0]); },
    freeScreen: () => { const { t, c } = phase(); const cam = camera(t, c); return userFree(t, performance.now()).map((i) => sockScreen(cam, i)); },
    H, clusters,
  };
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
