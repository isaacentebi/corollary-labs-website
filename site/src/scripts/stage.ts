// The megastructure, live. Renders on demand only. Two uses on the home page:
//  'hero'   the structure as it stands; the visitor turns it (drag) and plugs units in (click).
//  'story'  the Approach figure, four beats on one clock s (0..3), stepped by the legend or played once in view:
//           s 0→1  an agent enters (one unit plugs in)
//           s 1→2  it reorganises (more units, a core rises, new infrastructure, units re-seat)
//           s 2→3  pull back and flatten to a plan of the city; the change travels along the network
import { type Cam, type Item, C, proj, depthSort } from './axon';
import { Struct, clamp, ease, BEAM_H, CAP_L, CAP_H } from './mega';
import { buildHero, buildCity, SPINE_Y, FRONT, type Cluster } from './city';

const PI = Math.PI;
const win = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const LATCH = 750; // ms a unit keeps its outline lit after it latches
const PULSE = 1250;
const NEW_MS = 3500; // how long a visitor's unit stays lamp-coloured before it becomes normal
const FADE_MS = 1200;
const MAX_LIT = 5; // at most this many of the visitor's units lit at once
const MAX_USER_BEAMS = 3;
const FRONT_V = 70; // world units per second for a front the visitor starts in the city
const FRONT_MAX = 170;

// hero timeline at the end of beat 02 (the first unit has latched)
const T_ENTER = 0.2;
// seconds per beat when played
const SEG_S = [2.2, 5.6, 6.2];

export function initStage(root: HTMLElement, mode: 'hero' | 'story' = 'hero') {
  const story = mode === 'story';
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  const { H, cores } = buildHero();
  const { clusters, branches, net } = buildCity();
  const beats = [...root.querySelectorAll<HTMLButtonElement>('[data-beat]')];

  let W = 0, Hh = 0, dpr = 1, textH = 0;
  const textEl = root.querySelector<HTMLElement>('.hero__text');
  let s = 0, target = 0; // story clock and where it is heading
  let lastT = 0;
  let playing = false, played = false, visible = true;
  let holdTimer = 0;
  let thUser = 0, thTarget = 0;
  let hover = -1;
  let pointer: { x: number; y: number } | null = null;
  let raf = 0;
  const sources: { x: number; y: number; t0: number }[] = [];
  // branch extents by x, for fronts the visitor starts
  const branchSpan = new Map<number, [number, number]>();
  for (const b of branches) {
    const cur = branchSpan.get(b.x) ?? [SPINE_Y, SPINE_Y];
    branchSpan.set(b.x, [Math.min(cur[0], b.y1), Math.max(cur[1], b.y1)]);
  }
  const pulses: { sock: number; cap: number; t0: number }[] = [];

  function size() {
    const r = canvas.getBoundingClientRect();
    W = r.width;
    Hh = r.height;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(Hh * dpr);
    if (textEl) textH = r.bottom - textEl.getBoundingClientRect().top;
    invalidate();
  }

  function phase() {
    if (!story) return { t: 0, c: 0 };
    if (s <= 1) return { t: T_ENTER * s, c: 0 };
    if (s <= 2) return { t: lerp(T_ENTER, 1, s - 1), c: 0 };
    return { t: 1, c: s - 2 };
  }

  const mobile = () => W < 720;

  function heroCam(t: number): Cam {
    const mob = mobile();
    const th = -0.62 + 0.32 * t + thUser;
    // fit what stands now (the frame widens as the structure grows)
    const k = ease(clamp(t * 1.15));
    const cam: Cam = { cx: 0, cy: 0, wx: 5, wy: 5, wz: 6, s: 1, th, ky: mob ? 0.74 : 0.6, kz: mob ? 1.12 : 1 };
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y, z] of H.fitPoints(t)) {
      const [sx, sy] = proj(cam, x, y, z);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    let area: { l: number; r: number; t: number; b: number };
    if (story) {
      // the figure's own plate
      const m = mob ? 14 : 34;
      area = { l: m, r: W - m, t: m + (mob ? 10 : 0), b: Hh - m - (mob ? 26 : 10) };
    } else if (mob) {
      // portrait: fill the width, sit above the text
      area = { l: 10, r: W - 10, t: 72, b: Hh - textH - 18 };
    } else {
      area = { l: W * lerp(0.5, 0.44, k), r: W - 64, t: 104, b: Hh - 56 };
    }
    const sc = Math.max(0.05, Math.min((area.r - area.l) / (x1 - x0), (area.b - area.t) / (y1 - y0)));
    cam.s = sc;
    cam.cx = (area.l + area.r) / 2 - ((x0 + x1) / 2) * sc;
    cam.cy = (area.t + area.b) / 2 - ((y0 + y1) / 2) * sc;
    return cam;
  }

  function camera(t: number, c: number): Cam {
    const h = heroCam(t);
    if (c <= 0) return h;
    const mob = mobile();
    const e = ease(clamp(c / 0.6));
    // the plan: spine across the screen (down the screen on phones), seen from straight above
    const thCity = mob ? -PI / 2 + 0.14 : -0.14;
    const sEnd = mob ? Hh / 230 : Math.min(W / 230, Hh / 140);
    const s = Math.exp(lerp(Math.log(h.s), Math.log(sEnd), e));
    const f = (1 / s - 1 / h.s) / (1 / sEnd - 1 / h.s);
    // rotation (including the visitor's) eases back to the canonical plan angle
    let dth = thCity - h.th;
    dth = Math.atan2(Math.sin(dth), Math.cos(dth));
    const cam: Cam = { ...h, s, th: h.th + dth * e, ky: lerp(h.ky, 0.84, e), kz: lerp(h.kz, 0.5, e) };
    const [hsx, hsy] = proj(h, 5, 5, 0);
    const endX = W * 0.5, endY = Hh * 0.46;
    cam.wx = 5;
    cam.wy = lerp(5, mob ? SPINE_Y + 8 : SPINE_Y + 4, f);
    cam.wz = 0;
    cam.cx = lerp(hsx, endX, f);
    cam.cy = lerp(hsy, endY, f);
    return cam;
  }

  function userFree(t: number, now: number) {
    const out: number[] = [];
    H.socks.forEach((_, i) => { if (H.openFor(i, t, now)) out.push(i); });
    return out;
  }

  // open sockets a unit could be seen in from the current camera
  function visibleFree(cam: Cam, t: number, now: number) {
    return userFree(t, now).filter((i) => H.sockVisible(cam, i, t, now));
  }

  const sockScreen = (cam: Cam, i: number) => {
    const s = H.socks[i];
    return proj(cam, s.x + Math.cos(s.a) * CAP_L * 0.4, s.y + Math.sin(s.a) * CAP_L * 0.4, s.z + CAP_H / 2);
  };

  // nearest open socket to a point on screen; with no radius, any click on the drawing finds one
  function nearestSock(cam: Cam, t: number, now: number, x: number, y: number, radius = Infinity) {
    let best = -1, bd = radius * radius;
    for (const i of visibleFree(cam, t, now)) {
      const [sx, sy] = sockScreen(cam, i);
      const d = (sx - x) ** 2 + (sy - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function grow(t: number, now: number) {
    // new infrastructure when open sockets run low: a cantilever from a standing core (a few at most)
    if (H.beams.filter((b) => b.real !== undefined).length >= MAX_USER_BEAMS) return false;
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
    const ci = H.plugReal(i, now, dur);
    pulses.push({ sock: i, cap: ci, t0: now + dur });
    const { t } = phase();
    if (userFree(t, now + 5000).length < 6) grow(t, now + dur * 0.5);
    invalidate();
  }

  // lamp for what is new: a visitor's unit fades back to graphite after a few seconds,
  // sooner when newer ones push it past the limit
  function litMap(S: Struct, now: number) {
    const m = new Map<number, number>();
    const users: { ci: number; t1: number }[] = [];
    S.caps.forEach((c, ci) => { if (c.user) users.push({ ci, t1: c.moves[0].t1 }); });
    users.sort((a, b) => b.t1 - a.t1);
    users.forEach((u, rank) => {
      let lit = 1 - clamp((now - u.t1 - NEW_MS) / FADE_MS);
      if (rank >= MAX_LIT) lit = Math.min(lit, 1 - clamp((now - users[rank - MAX_LIT].t1) / 600));
      if (now < u.t1) lit = 1;
      m.set(u.ci, lit);
    });
    return m;
  }
  const fading = (S: Struct, now: number) => S.caps.some((c) => c.user && now < c.moves[0].t1 + NEW_MS + FADE_MS + 700);

  // city: network distance from a point on a branch (bx, by) to a point on the network
  function netDist(bx: number, by: number, x: number, y: number) {
    if (Math.abs(x - bx) < 0.5) return Math.abs(y - by);
    return Math.abs(by - SPINE_Y) + Math.abs(x - bx) + Math.abs(y - SPINE_Y);
  }

  // a click in the city: a unit into the nearest structure, and a front from there along the network
  function cityClick(cam: Cam, c: number, x: number, y: number) {
    const now = performance.now();
    const all: { S: Struct; x: number; y: number; t: number; cl?: Cluster }[] = [{ S: H, x: 5, y: 5, t: phase().t }, ...clusters.map((cl) => ({ S: cl.S, x: cl.x, y: cl.y, t: c, cl }))];
    let best = all[0], bd = Infinity;
    for (const o of all) {
      const [sx, sy] = proj(cam, o.x, o.y, 4);
      const d = (sx - x) ** 2 + (sy - y) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    const S = best.S;
    let pick = -1, pd = Infinity;
    S.socks.forEach((so, i) => {
      if (!S.openFor(i, best.t, now) || !S.sockVisible(cam, i, best.t, now)) return;
      const [sx, sy] = proj(cam, so.x, so.y, so.z);
      const d = (sx - x) ** 2 + (sy - y) ** 2;
      if (d < pd) { pd = d; pick = i; }
    });
    const dur = rm.matches ? 0 : 900;
    if (pick >= 0) S.plugReal(pick, now, dur);
    // the change travels outward from here; structures it reaches take a unit or two
    const src = { x: best.x, y: best.y, t0: now + dur };
    sources.push(src);
    const rnd = (k: number) => (Math.sin(k * 12.9898 + now * 0.001) * 43758.5453) % 1;
    clusters.forEach((cl, k) => {
      if (cl.S === S) return;
      const d = netDist(src.x, src.y, cl.x, cl.y);
      if (d > FRONT_MAX - 10) return;
      const at = src.t0 + (d / FRONT_V) * 1000;
      const open: number[] = [];
      cl.S.socks.forEach((_, i) => { if (cl.S.openFor(i, c, now)) open.push(i); });
      for (let n = 0; n < Math.min(2, open.length); n++) {
        const i = open[Math.floor(Math.abs(rnd(k * 7 + n)) * open.length)];
        if (cl.S.userBusy.has(i)) continue;
        cl.S.plugReal(i, at + n * 160, rm.matches ? 0 : 700);
      }
    });
    invalidate();
  }

  function drawSources(cam: Cam, now: number) {
    let live = false;
    for (let k = sources.length - 1; k >= 0; k--) {
      const src = sources[k];
      const D = ((now - src.t0) / 1000) * FRONT_V;
      if (D > FRONT_MAX + 40) { sources.splice(k, 1); continue; }
      live = true;
      if (D <= 0) continue;
      const fade = 1 - clamp((D - FRONT_MAX) / 40);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.beginPath();
      const segs: [number, number, number, number][] = [];
      // own branch, both ways
      const sp = branchSpan.get(src.x) ?? [SPINE_Y, SPINE_Y];
      segs.push([src.x, Math.max(sp[0], src.y - D), src.x, Math.min(sp[1], src.y + D)]);
      // spine
      const r = D - Math.abs(src.y - SPINE_Y);
      if (r > 0) {
        segs.push([src.x - r, SPINE_Y, src.x + r, SPINE_Y]);
        for (const [bx, span] of branchSpan) {
          if (Math.abs(bx - src.x) < 0.5) continue;
          const rr = r - Math.abs(bx - src.x);
          if (rr > 0) segs.push([bx, Math.max(span[0], SPINE_Y - rr), bx, Math.min(span[1], SPINE_Y + rr)]);
        }
      }
      for (const [x0, y0, x1, y1] of segs) {
        const P = proj(cam, x0, y0, 0), Q = proj(cam, x1, y1, 0);
        ctx.moveTo(P[0], P[1]);
        ctx.lineTo(Q[0], Q[1]);
      }
      ctx.strokeStyle = `rgba(${C.lampRGB},${0.85 * fade * (1 - 0.6 * clamp(D / FRONT_MAX))})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    return live;
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
    const passes: [number, number, number][] = [
      [1e9, 0.16, 1.2], // settled trail: faint
      [34, 0.5, 1.6], // recent
      [12, 1, 2.6], // head
    ];
    for (const [back, alpha, w] of passes) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const n of net) {
        const len = Math.hypot(n.x1 - n.x0, n.y1 - n.y0);
        const a = Math.max(0, (D - back - n.d0) / len);
        const b = Math.min(1, (D - n.d0) / len);
        if (b <= a) continue;
        const P = proj(cam, lerp(n.x0, n.x1, a), lerp(n.y0, n.y1, a), 0);
        const Q = proj(cam, lerp(n.x0, n.x1, b), lerp(n.y0, n.y1, b), 0);
        ctx.moveTo(P[0], P[1]);
        ctx.lineTo(Q[0], Q[1]);
      }
      ctx.strokeStyle = `rgba(${C.lampRGB},${alpha})`;
      ctx.lineWidth = w;
      ctx.stroke();
      ctx.restore();
    }
  }

  function frame() {
    raf = 0;
    if (W < 40 || Hh < 40) return;
    const now = performance.now();
    const tStart = now;
    let busy = false;
    if (story) {
      const dt = Math.min(0.05, (now - (lastT || now)) / 1000);
      lastT = now;
      if (s !== target) {
        if (rm.matches) s = target;
        else {
          // constant pace within a beat; faster when stepping back
          const seg = Math.min(2, Math.floor(target > s ? s : s - 1e-6));
          const v = (target > s ? 1 : 3) / SEG_S[Math.max(0, seg)];
          s = target > s ? Math.min(target, s + v * dt) : Math.max(target, s - v * dt);
        }
        syncBeats();
        if (s === target) arrived();
        else busy = true;
      }
    }
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
    if (sources.length && drawSources(cam, now)) busy = true;

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
    let ghosts: { i: number; a: number }[] | undefined;
    if (c === 0) {
      const vis = visibleFree(cam, t, now).map((i) => ({ i, p: sockScreen(cam, i) }));
      const base = 0.34 - 0.14 * clamp(t * 4);
      // three or four spread across the drawing at rest
      const rest: typeof vis = [];
      while (rest.length < 4 && rest.length < vis.length) {
        let bestV = vis[0], bd = -1;
        for (const v of vis) {
          if (rest.includes(v)) continue;
          const d = rest.length ? Math.min(...rest.map((r) => Math.hypot(r.p[0] - v.p[0], r.p[1] - v.p[1]))) : v.i;
          if (d > bd) { bd = d; bestV = v; }
        }
        rest.push(bestV);
      }
      ghosts = vis.map((v) => {
        const near = pointer ? 1 - clamp((Math.hypot(v.p[0] - pointer.x, v.p[1] - pointer.y) - 60) / 140) : 0;
        return { i: v.i, a: Math.max(rest.includes(v) ? base : 0, near * 0.42) };
      }).filter((g) => g.a > 0.02 || g.i === hover);
    }
    const litH = litMap(H, now);
    const hLit = 1 - clamp((c - 0.22) / 0.14); // our own units settle once the change has moved on
    H.items(cam, t, now, items, { lod, glow: (ci) => glow.get(ci) || 0, lit: (ci) => litH.get(ci) ?? hLit, ghosts, hover });
    if (c > 0) {
      const fade = clamp(c / 0.25);
      for (const cl of clusters) {
        const lm = cl.S.userBusy.size ? litMap(cl.S, now) : null;
        const S = cl.S;
        const lit = (ci: number) => {
          const u = lm?.get(ci);
          if (u !== undefined) return u;
          const m = S.caps[ci].moves[0];
          return 1 - clamp((c - m.t1 - 0.12) / 0.1);
        };
        cl.S.items(cam, c, now, items, { lod, fade, cull: [W, Hh], lit });
        if (lm && (fading(cl.S, now) || cl.S.caps.some((cp) => cp.user && now < cp.moves[0].t1))) busy = true;
      }
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
    if (fading(H, now)) busy = true;
    for (const b of H.beams) if (b.real !== undefined && now < b.real + (b.realDur || 0)) busy = true;
    (window as any).__ms = performance.now() - tStart;
    if (busy && visible) invalidate();
    else lastT = 0;
  }

  function invalidate() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // ——— story: legend, clock, play once in view ———
  function syncBeats() {
    const { c } = phase();
    const cur = s <= 0 ? 0 : Math.min(3, Math.ceil(s - 1e-6));
    beats.forEach((b, i) => {
      const fill = i === 0 ? 1 : clamp(s - (i - 1));
      b.style.setProperty('--f', fill.toFixed(3));
      b.setAttribute('aria-pressed', i === cur ? 'true' : 'false');
      b.classList.toggle('is-on', i === cur);
    });
    root.classList.toggle('is-city', c > 0.05);
    root.classList.toggle('is-open', c === 0 || c > 0.3);
    if (c > 0) hover = -1;
  }
  function go(k: number) {
    target = clamp(k, 0, 3);
    lastT = 0;
    invalidate();
  }
  function arrived() {
    if (!playing) return;
    if (target >= 3) { playing = false; return; }
    clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => { if (playing) go(target + 1); }, target === 0 ? 700 : 1500);
  }
  function stopPlay() {
    playing = false;
    clearTimeout(holdTimer);
  }

  // pointer: drag turns the drawing; a click or tap anywhere on it plugs a unit into the nearest open socket
  let down: { x: number; y: number; th: number; moved: boolean } | null = null;
  let touched = false;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, th: thTarget, moved: false };
    touched = true;
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
    if (c > 0.3) { cityClick(camera(t, c), c, e.clientX - r.left, e.clientY - r.top); return; }
    if (c > 0) return;
    const i = nearestSock(camera(t, c), t, performance.now(), e.clientX - r.left, e.clientY - r.top);
    if (i >= 0) plugAt(i);
  });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    pointer = e.pointerType === 'mouse' ? { x, y } : null;
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
    hover = c > 0 ? -1 : nearestSock(camera(t, c), t, performance.now(), x, y);
    if (c === 0) invalidate();
  });
  canvas.addEventListener('pointerleave', () => {
    pointer = null;
    hover = -1;
    invalidate();
  });
  addEventListener('keydown', (e) => {
    if (document.activeElement !== canvas) return;
    touched = true;
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

  new ResizeObserver(size).observe(canvas);
  rm.addEventListener?.('change', invalidate);
  size();
  root.classList.add('is-open');

  // only draw while on screen
  new IntersectionObserver((es) => {
    const e = es[es.length - 1];
    visible = e.isIntersecting;
    if (visible) invalidate();
    // the story plays through once, the first time the figure is mostly in view
    if (story && !played && e.intersectionRatio >= 0.55 && !rm.matches) {
      played = true;
      playing = true;
      holdTimer = window.setTimeout(() => go(1), 600);
    }
  }, { threshold: [0, 0.55] }).observe(canvas);

  if (story && W > 40) {
    // beat 02 must read at once: move the first agent to a socket the camera sees whole, near the middle
    const cap = H.caps.find((cp) => cp.agent && !cp.user && cp.moves[0].t0 > 0 && cp.moves[0].t0 < 0.1);
    if (cap) {
      const cam = camera(T_ENTER, 0);
      const m = cap.moves[0];
      const whole = (j: number) => {
        const so = H.socks[j];
        const ux = Math.cos(so.a), uy = Math.sin(so.a);
        const pts: [number, number, number][] = [
          [so.x, so.y, so.z + CAP_H + 0.02],
          [so.x + ux * CAP_L * 0.8, so.y + uy * CAP_L * 0.8, so.z + CAP_H + 0.02],
          [so.x + ux * (CAP_L + 0.02), so.y + uy * (CAP_L + 0.02), so.z + CAP_H * 0.4],
        ];
        return [0, T_ENTER, 0.5].every((t) => pts.every((P) => !H.occluded(cam, P, t, 0)));
      };
      let best = -1, bd = Infinity;
      H.socks.forEach((_, j) => {
        if (j !== m.to && (H.sockReady(j) > 0 || !H.isFree(j, 0, 99))) return;
        if (!whole(j)) return;
        const [sx, sy] = proj(cam, H.socks[j].x, H.socks[j].y, H.socks[j].z);
        const d = (sx - W * 0.5) ** 2 + (sy - Hh * 0.5) ** 2;
        if (d < bd) { bd = d; best = j; }
      });
      if (best >= 0 && best !== m.to) {
        const iv = H.busy.get(m.to);
        if (iv) H.busy.set(m.to, iv.filter((v) => !(v[0] === m.t0 && v[1] === 99)));
        H.reserve(best, m.t0, 99);
        m.from = m.to = best;
      }
    }
  }
  if (story) {
    beats.forEach((b, i) => b.addEventListener('click', () => { stopPlay(); played = true; go(i); }));
    syncBeats();
  } else if (!rm.matches) {
    // the hero shows what it does: a few units plug in by themselves until the visitor takes over
    let n = 0;
    const auto = () => {
      if (touched || n >= 3) return;
      if (visible && document.visibilityState === 'visible') {
        const cam = camera(0, 0);
        const f = visibleFree(cam, 0, performance.now());
        if (f.length) plugAt(f[Math.floor(Math.random() * f.length)]);
        n++;
      }
      window.setTimeout(auto, 2600);
    };
    window.setTimeout(auto, 1100);
  }

  (window as any)['__' + mode] = {
    get s() { return s; },
    go,
    plug: () => { const { t } = phase(); const f = userFree(t, performance.now()); if (f.length) plugAt(f[0]); },
    freeScreen: () => { const { t, c } = phase(); const cam = camera(t, c); return visibleFree(cam, t, performance.now()).map((i) => sockScreen(cam, i)); },
    project: (x: number, y: number, z: number) => { const { t, c } = phase(); return proj(camera(t, c), x, y, z); },
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
  if (r.width < pad * 2 + 20 || r.height < pad * 2 + 20) return;
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
