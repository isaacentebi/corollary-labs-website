// The home score. On load the playhead plays the entry once; after that, scroll moves it.
// A  the ensemble (the past, left of the entry)
// B  a new voice enters from nothing
// C  the ensemble makes room, regroups, and each voice restates the figure in its own grammar
// D  the view pulls back: the figure reaches other systems in order of distance;
//    then the time ruler slides down and becomes the rule that opens the page below.
// Visitors can draw a voice (UPIC). Space bends around it; voices never cross.
// Renders only when something changes.
import { mainSystem, otherSystem, geometry, userPrims, groupSpans, baseY, agentY, clamp, mix, smooth, hash, MOTIF_POINTS, strokeY, type State, type UserStroke, type System, type Prim } from './model';
import { drawPrims, lerpRect, bracket, INK, PENCIL, GREY, HL, PAPER, FONT, type Rect } from './render';
import { Sound } from './sound';

const seg = (a: number, b: number, x: number) => clamp((x - a) / (b - a));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

interface Stroke extends UserStroke { v: number; raw: [number, number][] }
interface Other { sys: System; cell: Rect; d: number }

const P0 = { T: 0.43, r: 0.12 };   // the state the intro lands on (scroll position 0)

export function mountScore(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const drawBtn = root.querySelector<HTMLButtonElement>('[data-draw]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-clear]');
  const soundBtn = root.querySelector<HTMLButtonElement>('[data-sound]');
  const statement = root.querySelector<HTMLElement>('[data-statement]');
  const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;

  const sys = mainSystem();
  const sound = new Sound();
  const MARKS = [0, sys.t0, 0.5, 0.72];

  let W = 0, H = 0, dpr = 1, narrow = false, gutter = 16;
  let F0: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let others: Other[] = [];
  let maxD = 1;
  let p = 0, pTarget = 0, raf = 0, lastT = -1, lastState = -1;
  let intro = rm || scrollY > 20 ? 1 : 0, introStart = 0;
  let rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let zNow = 0;
  const users: Stroke[] = [];
  let drawing: Stroke | null = null;
  let drawMode = !coarse;
  let lastPenIdx = -1;

  // ------------------------------------------------ scroll → state
  function mapping(p: number) {
    let T: number, r: number;
    if (p < 0.42) { const f = seg(0, 0.42, p); T = mix(P0.T, 0.64, f); r = mix(P0.r, 1, smooth(0, 1, f)); }
    else if (p < 0.58) { T = mix(0.64, 0.74, seg(0.42, 0.58, p)); r = 1; }
    else { T = mix(0.74, 1, seg(0.58, 1, p)); r = 1; }
    if (intro < 1) {
      const e = easeInOut(intro);
      T = mix(0.27, T, e); r = mix(0, r, smooth(0.55, 1, intro));
    }
    const z = smooth(0.58, 0.88, p);
    const h = smooth(0.88, 1, p);
    const state = T < sys.t0 ? 0 : T < 0.5 ? 1 : p < 0.58 ? 2 : 3;
    return { T, r, z, h, state, agentTo: T };
  }

  function baseRect(T: number): Rect {
    const L = narrow ? 34 : Math.max(84, gutter + 44), R = narrow ? 16 : gutter + 8;
    const top = H * (narrow ? 0.335 : 0.36), bottom = H * (narrow ? 0.875 : 0.845);
    const w = narrow ? Math.max(W * 2.5, 860) : W - L - R;
    const pan = narrow ? clamp(T * w - (W * 0.5 - L), 0, w - (W - L - R)) : 0;
    return { x: L - pan, y: top, w, h: bottom - top };
  }

  function finalRect(): Rect {
    const L = narrow ? 34 : Math.max(84, gutter + 44), R = narrow ? 16 : gutter + 8;
    const rg = narrow ? 26 : 34;
    const top = narrow ? Math.max(210, H * 0.3) : Math.max(150, H * 0.22);
    return { x: L, y: top, w: W - L - R, h: H - 1 - rg - top };
  }

  function layout() {
    W = stage.clientWidth; H = stage.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    narrow = W < 760;
    gutter = clamp(W * 0.04, 16, 56);
    const cols = narrow ? 1 : 3, m = narrow ? 24 : gutter + 20, gap = narrow ? 34 : 56;
    const cw = (W - 2 * m - (cols - 1) * gap) / cols, ch = cw * (narrow ? 0.62 : 0.5);
    const vgap = narrow ? 30 : 48;
    const mc = narrow ? 0 : 1;
    const cellX = (c: number) => m + c * (cw + gap);
    const cellY = (r: number) => H * 0.5 - ch / 2 + r * (ch + vgap);
    F0 = { x: cellX(mc), y: cellY(0), w: cw, h: ch };
    others = [];
    for (let r = -2; r <= 2; r++) for (let c = 0; c < cols; c++) {
      if (r === 0 && c === mc) continue;
      const cell = { x: cellX(c), y: cellY(r), w: cw, h: ch };
      if (cell.y > H + 40 || cell.y + ch < -40) continue;
      others.push({ sys: otherSystem(hash(`sys:${c}:${r}`) % 100000), cell, d: Math.hypot(c - mc, r * 1.3) });
    }
    maxD = Math.max(1, ...others.map((o) => o.d));
    request();
  }

  function readScroll() {
    const r = root.getBoundingClientRect();
    const span = root.offsetHeight - window.innerHeight;
    pTarget = span > 0 ? clamp(-r.top / span) : 0;
    if (pTarget > 0.002 && intro < 1) intro = 1;   // the reader takes over
    request();
  }

  function request() { if (!raf) raf = requestAnimationFrame(frame); }

  function frame(now: number) {
    raf = 0;
    let again = false;
    if (intro < 1) {
      if (!introStart) introStart = now;
      intro = clamp((now - introStart - 350) / 2600);
      if (intro < 1) again = true;
    }
    if (rm) p = pTarget;
    else { p += (pTarget - p) * 0.2; if (Math.abs(pTarget - p) > 0.0004) again = true; else p = pTarget; }
    for (const u of users) {
      if (rm) { u.g = 1; continue; }
      const dt = 1 / 60;
      u.v += ((1 - (u.g ?? 0)) * 150 - u.v * 13) * dt;
      u.g = (u.g ?? 0) + u.v * dt;
      if (Math.abs(1 - u.g) > 0.001 || Math.abs(u.v) > 0.001) again = true; else { u.g = 1; u.v = 0; }
    }
    if (intro > 0.12) statement?.classList.add('is-played');
    draw();
    if (again) request();
  }

  // ------------------------------------------------ drawing
  function draw() {
    const m = mapping(p);
    const { T, r, z, h } = m;
    zNow = z;
    const e = easeInOut(z);
    const st: State = { r, agentTo: m.agentTo, users };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // D, then the return: the view comes back in on the finished score, which settles
    // at the foot of the stage so its time ruler becomes the rule that opens the page below
    const hh = easeInOut(h);
    rect = lerpRect(lerpRect(baseRect(T), F0, e), finalRect(), hh);
    const s = clamp(rect.h / 440, 0.34, 1.12);

    // other organisations: revealed as the view pulls back; the figure reaches them in order of distance
    if (e > 0.002) {
      const kx = rect.w / F0.w, ky = rect.h / F0.h;
      const front = z * (maxD + 0.7) - 0.25;
      for (const o of others) {
        const R: Rect = { x: rect.x + (o.cell.x - F0.x) * kx, y: rect.y + (o.cell.y - F0.y) * ky, w: o.cell.w * kx, h: o.cell.h * ky };
        if (R.x > W || R.x + R.w < 0 || R.y > H || R.y + R.h < 0) continue;
        const reach = clamp((front - o.d) / 1.1);
        const so: State = { r: reach, agentTo: reach > 0 ? o.sys.t0 + (1 - o.sys.t0) * reach : 0 };
        const prims = geometry(o.sys, so, { detail: 0.55 });
        const ss = clamp(R.h / 440, 0.3, 1.05);
        ctx.save();
        ctx.globalAlpha = Math.min(1, e * 1.4) * (1 - 0.5 * clamp((o.d - 1) / (maxD - 1 || 1))) * (1 - smooth(0, 0.6, h));
        if (ctx.globalAlpha < 0.01) { ctx.restore(); continue; }
        drawPrims(ctx, prims, R, { ink: INK, band: '', hl: HL, hlA: 0.62 }, ss, 'hl');
        drawPrims(ctx, prims, R, { ink: GREY, band: 'rgba(17,18,19,.08)', hl: HL, hlA: 1 }, ss, 'ink');
        ctx.fillStyle = GREY; ctx.strokeStyle = GREY;
        const ys = o.sys.voices.map((v) => R.y + baseY(o.sys, v, so, 0) * R.h);
        ctx.fillRect(Math.round(R.x) - 7, Math.min(...ys) - 5, 1, Math.max(...ys) - Math.min(...ys) + 10);
        ctx.restore();
      }
    }

    // the score itself: past in ink, future in pencil
    const prims = geometry(sys, st, { skipUsers: true });
    const xT = rect.x + T * rect.w;
    const xm = narrow ? mix(30, 0, e) : 0;
    const clip = (left: boolean, fn: () => void) => {
      ctx.save(); ctx.beginPath();
      if (left) ctx.rect(xm, 0, Math.max(0, xT - xm), H); else ctx.rect(Math.max(xT, xm), 0, W, H);
      ctx.clip(); fn(); ctx.restore();
    };
    const future = e > 0 ? mixHex(PENCIL, INK, e) : PENCIL;
    clip(true, () => drawPrims(ctx, prims, rect, { ink: INK, band: 'rgba(17,18,19,.12)', hl: HL, hlA: 1 }, s, 'hl'));
    clip(false, () => drawPrims(ctx, prims, rect, { ink: INK, band: '', hl: HL, hlA: 0.35 + 0.65 * e }, s, 'hl'));
    clip(true, () => drawPrims(ctx, prims, rect, { ink: INK, band: 'rgba(17,18,19,.12)', hl: HL, hlA: 1 }, s, 'ink'));
    clip(false, () => drawPrims(ctx, prims, rect, { ink: future, band: 'rgba(17,18,19,.06)', hl: HL, hlA: 1 }, s, 'ink'));
    if (users.length) {
      ctx.save(); ctx.beginPath(); ctx.rect(xm, 0, W, H); ctx.clip();
      drawPrims(ctx, userPrims(st), rect, { ink: INK, band: '', hl: HL, hlA: 1 }, s, 'ink');
      ctx.restore();
    }
    chrome(T, st, m.state, e * (1 - hh), hh);

    if (m.state !== lastState) { stage.dataset.state = String(m.state); lastState = m.state; }
    if (sound.on && lastT >= 0 && T > lastT + 1e-5 && intro >= 1) voiceEvents(prims, st, lastT, T);
    lastT = T;
  }

  function chrome(T: number, st: State, state: number, e: number, h: number) {
    const R = rect;
    const X = (t: number) => R.x + t * R.w;
    const a = 1 - Math.min(1, e * 1.6);
    ctx.save();
    ctx.fillStyle = INK; ctx.strokeStyle = INK;

    // left: system barline and brackets that regroup around the new voice
    const edge = Math.max(R.x, narrow ? 34 : 0);
    const tl = clamp((edge - R.x) / R.w);
    const k = clamp(R.h / 440, 0.55, 1);
    const spans = groupSpans(sys, st, tl).map((g) => ({ a: R.y + g.a * R.h, b: R.y + g.b * R.h }));
    const top = Math.min(...spans.map((g) => g.a)), bot = Math.max(...spans.map((g) => g.b));
    const xb = Math.round(edge) - (narrow ? 7 : 10);
    ctx.fillRect(xb, top - 6 * k, 1.5, bot - top + 12 * k);
    for (const g of spans) bracket(ctx, xb - 4 * k, g.a, g.b, k);

    // rehearsal marks
    if (a > 0.01) {
      ctx.globalAlpha = a;
      const my = R.y - (narrow ? 34 : 46), bs = narrow ? 18 : 20;
      ctx.font = `620 ${narrow ? 11 : 12}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const edgeX = narrow ? 34 : 0;
      MARKS.forEach((t, i) => {
        let x = X(t);
        if (x < edgeX) {
          const next = i + 1 < MARKS.length ? X(MARKS[i + 1]) : Infinity;
          if (next < edgeX) return;                       // an earlier mark, already replaced
          x = Math.min(edgeX, next - bs - 6);
        }
        x = Math.round(x);
        if (x > W - 12 || x < -bs) return;
        ctx.lineWidth = 1;
        if (i === state) { ctx.fillRect(x, my - bs / 2, bs, bs); ctx.fillStyle = PAPER; }
        else ctx.strokeRect(x + 0.5, my - bs / 2 + 0.5, bs - 1, bs - 1);
        ctx.fillText('ABCD'[i], x + bs / 2, my + 0.5);
        ctx.fillStyle = INK;
      });
      ctx.globalAlpha = 1;
    }

    // the time ruler: under the system, then (handoff) the full-width rule at the foot of the stage
    const rg = narrow ? 26 : 34;
    const hh = h;
    const x0 = mix(Math.max(X(0), narrow ? 34 : 0), gutter, hh), x1 = mix(Math.min(X(1), W), W - gutter, hh);
    const ry = Math.round(Math.min(H - 1, R.y + R.h + rg * mix(1, 0.6, e))) + 0.5;
    const TX = X;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 100; i++) {
      const x = Math.round(TX(i / 100)) + 0.5;
      if (x < x0 - 1 || x > x1 + 1) continue;
      const len = i % 10 === 0 ? 9 : i % 5 === 0 ? 6 : 3;
      ctx.strokeStyle = i / 100 <= T + 1e-6 ? INK : PENCIL;
      ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(x, ry - len); ctx.stroke();
    }
    const xp = Math.round(TX(T)) + 0.5;
    ctx.strokeStyle = PENCIL; ctx.beginPath(); ctx.moveTo(x0, ry); ctx.lineTo(x1, ry); ctx.stroke();
    ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x0, ry); ctx.lineTo(Math.min(xp, x1), ry); ctx.stroke();

    // the playhead
    const pa = 1 - Math.min(1, e * 1.2);
    const phTop = mix(R.y - (narrow ? 34 : 46) + (narrow ? 18 : 20) / 2 + 8, ry - 14, e);
    ctx.strokeStyle = INK; ctx.fillStyle = INK;
    ctx.globalAlpha = Math.max(pa, 0.001);
    ctx.beginPath(); ctx.moveTo(xp, phTop); ctx.lineTo(xp, ry + 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(xp - 5, phTop - 7); ctx.lineTo(xp + 5, phTop - 7); ctx.lineTo(xp, phTop); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------ sound: events crossing the playhead
  const tOf = (q: Prim) => (q.k === 'path' ? q.pts[0][0] : 't' in q ? (q as { t: number }).t : -1);
  const yOf = (q: Prim) => (q.k === 'path' ? q.pts[0][1] : 'y' in q ? (q as { y: number }).y : 0.5);
  function voiceEvents(prims: Prim[], st: State, a: number, b: number) {
    const n = sys.voices.length;
    const pan = (vi: number) => (vi < 0 ? 0 : (vi / (n - 1)) * 1.2 - 0.6);
    for (const q of prims) {
      if (!('vi' in q) || q.vi === undefined) continue;
      const t = tOf(q); if (t <= a || t > b) continue;
      if (q.vi < 0) sound.play('agent', yOf(q), st.r, 1, 0);
      else sound.play(sys.voices[q.vi].g, yOf(q), st.r, q.k === 'dot' ? q.r / 3 : q.k === 'path' ? q.w / 4 : 0.8, pan(q.vi));
    }
    // continuous voices speak at their own marks: swells for the line, control points for the strings
    sys.voices.forEach((v, vi) => {
      if (v.g !== 'line' && v.g !== 'fan') return;
      for (const ev of v.events) if (ev.t > a && ev.t <= b && (v.g === 'fan' || ev.w > 1.8)) sound.play(v.g, baseY(sys, v, st, ev.t), st.r, 0.8, pan(vi));
      const wa = sys.t0 + v.lag;
      for (const mp of MOTIF_POINTS) { const t = wa + mp; if (t > a && t <= b && st.r > 0.2) sound.play(v.g, baseY(sys, v, st, t), st.r, 1, pan(vi)); }
    });
    if (a < sys.t0 && b >= sys.t0) sound.play('agent', agentY(sys, st, sys.t0), st.r, 1, 0);
  }

  // ------------------------------------------------ the visitor's voice
  const toScore = (ev: PointerEvent): [number, number] => {
    const b = canvas.getBoundingClientRect();
    return [clamp((ev.clientX - b.left - rect.x) / rect.w), clamp((ev.clientY - b.top - rect.y) / rect.h, -0.14, 1.1)];
  };
  function smoothStroke(s: Stroke) {
    const raw = s.raw; if (raw.length < 2) { s.pts = raw.slice(); return; }
    const a = raw[0][0], b = raw[raw.length - 1][0];
    const res: [number, number][] = [];
    for (let t = a; t < b; t += 0.003) res.push([t, strokeY(raw, t)]);
    res.push([b, raw[raw.length - 1][1]]);
    const k = 3;
    s.pts = res.map(([t], i) => { let sum = 0, n = 0; for (let j = Math.max(0, i - k); j <= Math.min(res.length - 1, i + k); j++) { sum += res[j][1]; n++; } return [t, sum / n]; });
    s.mean = s.pts.reduce((acc, q) => acc + q[1], 0) / s.pts.length;
  }
  const canDraw = (ev: PointerEvent) => zNow < 0.3 && (ev.pointerType === 'mouse' ? ev.button === 0 : ev.pointerType === 'pen' || drawMode);
  canvas.addEventListener('pointerdown', (ev) => {
    if (!canDraw(ev)) return;
    ev.preventDefault();
    const pt = toScore(ev);
    drawing = { raw: [pt], pts: [pt], g: rm ? 1 : 0, v: 0 };
    users.push(drawing);
    while (users.length > 2) users.shift();
    canvas.setPointerCapture(ev.pointerId);
    lastPenIdx = -1;
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!drawing) return;
    const pt = toScore(ev);
    const last = drawing.raw[drawing.raw.length - 1];
    if (pt[0] > last[0] + 0.0012) {
      drawing.raw.push(pt);
      smoothStroke(drawing);
      request();
      if (sound.on) { const idx = Math.round((1 - pt[1]) * 12); if (idx !== lastPenIdx) { lastPenIdx = idx; sound.play('pen', pt[1], mapping(p).r); } }
    }
  });
  const end = () => {
    if (!drawing) return;
    const raw = drawing.raw;
    if (raw.length < 3 || raw[raw.length - 1][0] - raw[0][0] < 0.012) users.splice(users.indexOf(drawing), 1);
    else clearBtn?.removeAttribute('hidden');
    drawing = null; request();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  clearBtn?.addEventListener('click', () => { users.length = 0; clearBtn.setAttribute('hidden', ''); request(); });

  // on touch screens, drawing is a mode: while it is on, the score holds the page still
  drawBtn?.addEventListener('click', () => {
    drawMode = !drawMode;
    drawBtn.setAttribute('aria-pressed', String(drawMode));
    stage.classList.toggle('is-drawing', drawMode);
  });

  soundBtn?.addEventListener('click', () => {
    const label = soundBtn.querySelector('[data-sound-label]')!;
    if (sound.on) { sound.disable(); soundBtn.setAttribute('aria-pressed', 'false'); label.textContent = 'Sound off'; }
    else if (sound.enable()) { soundBtn.setAttribute('aria-pressed', 'true'); label.textContent = 'Sound on'; sound.play('agent', agentY(sys, { r: 0, agentTo: 1 }, sys.t0 + 0.012), 0); }
  });

  window.addEventListener('scroll', readScroll, { passive: true });
  new ResizeObserver(() => { layout(); readScroll(); }).observe(stage);
  document.fonts?.ready.then(request);
  layout(); readScroll();
  p = pTarget;
  if (pTarget > 0.002) intro = 1;
  request();
}

function mixHex(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}
