// The home score. Scroll moves the playhead; four states (A–D) follow from it.
// Pointer drags draw a new voice (UPIC-style) and the ensemble bends around it.
// Renders only when something changes: scroll, resize, a stroke, or a settling spring.
import { mainSystem, otherSystem, geometry, voiceY, agentY, snapT, clamp, mix, smooth, hash, type State, type UserStroke, type System } from './model';
import { drawPrims, lerpRect, INK, PENCIL, HL, PAPER, FONT, type Rect } from './render';
import { Sound } from './sound';

const seg = (a: number, b: number, x: number) => clamp((x - a) / (b - a));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

interface Stroke extends UserStroke { v: number }
interface Other { sys: System; cell: Rect; d: number }

export function mountScore(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const hint = root.querySelector<HTMLElement>('[data-hint]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-clear]');
  const soundBtn = document.querySelector<HTMLButtonElement>('[data-sound]');
  const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const sys = mainSystem();
  const sound = new Sound();
  const MARKS = [0, sys.t0, 0.54, 0.8];

  let W = 0, H = 0, dpr = 1, narrow = false;
  let F0: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let others: Other[] = [];
  let maxD = 1;
  let p = 0, pTarget = 0, raf = 0, lastT = -1, lastState = -1;
  let rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let zNow = 0;
  const users: Stroke[] = [];
  let drawing: Stroke | null = null;
  let decided = false, sx = 0, sy = 0, penY: number | null = null;

  function mapping(p: number) {
    const T = p < 0.14 ? mix(0.22, 0.34, seg(0, 0.14, p))
      : p < 0.38 ? mix(0.34, 0.54, seg(0.14, 0.38, p))
      : p < 0.7 ? mix(0.54, 0.8, seg(0.38, 0.7, p))
      : mix(0.8, 1, seg(0.7, 1, p));
    const r = p < 0.2 ? 0 : p < 0.38 ? 0.45 * smooth(0.2, 0.38, p) : 0.45 + 0.55 * smooth(0.38, 0.66, p);
    const z = smooth(0.7, 0.97, p);
    const state = p < 0.14 ? 0 : p < 0.38 ? 1 : p < 0.7 ? 2 : 3;
    return { T, r, z, state, agentTo: p < 0.14 ? 0 : T };
  }

  function baseRect(T: number): Rect {
    const L = narrow ? 34 : 96, R = narrow ? 16 : 64;
    const top = H * (narrow ? 0.32 : 0.34), bottom = H * (narrow ? 0.84 : 0.84);
    const w = narrow ? Math.max(W * 2.4, 820) : W - L - R;
    const pan = narrow ? clamp(T * w - (W * 0.46 - L), 0, w - (W - L - R)) : 0;
    return { x: L - pan, y: top, w, h: bottom - top };
  }

  function layout() {
    W = stage.clientWidth; H = stage.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    narrow = W < 760;
    const cols = narrow ? 2 : 4, m = narrow ? 16 : 48, gap = narrow ? 18 : 32;
    const cw = (W - 2 * m - (cols - 1) * gap) / cols, ch = cw * (narrow ? 0.9 : 0.52);
    const mc = narrow ? 0 : 1;
    const cellX = (c: number) => m + c * (cw + gap);
    const cellY = (r: number) => H / 2 - ch / 2 + r * (ch + gap);
    F0 = { x: cellX(mc), y: cellY(0), w: cw, h: ch };
    others = [];
    const rows = Math.ceil(H / (ch + gap) / 2) + 1;
    for (let r = -rows; r <= rows; r++) for (let c = 0; c < cols; c++) {
      if (r === 0 && c === mc) continue;
      const cell = { x: cellX(c), y: cellY(r), w: cw, h: ch };
      if (cell.y > H + 10 || cell.y + ch < -10) continue;
      others.push({ sys: otherSystem(hash(`${c}:${r}`) % 100000), cell, d: Math.hypot(c - mc, r * 1.15) });
    }
    maxD = Math.max(1, ...others.map((o) => o.d));
    request();
  }

  function readScroll() {
    const r = root.getBoundingClientRect();
    const span = root.offsetHeight - window.innerHeight;
    pTarget = span > 0 ? clamp(-r.top / span) : 0;
    request();
  }

  function request() { if (!raf) raf = requestAnimationFrame(frame); }

  function frame() {
    raf = 0;
    let again = false;
    if (rm) p = pTarget;
    else { p += (pTarget - p) * 0.2; if (Math.abs(pTarget - p) > 0.0004) again = true; else p = pTarget; }
    for (const u of users) {
      if (rm) { u.g = 1; continue; }
      const dt = 1 / 60;
      u.v += ((1 - (u.g ?? 0)) * 140 - u.v * 12) * dt;
      u.g = (u.g ?? 0) + u.v * dt;
      if (Math.abs(1 - u.g) > 0.001 || Math.abs(u.v) > 0.001) again = true; else { u.g = 1; u.v = 0; }
    }
    draw();
    if (again) request();
  }

  function draw() {
    const m = mapping(p);
    const { T, r, z } = m;
    zNow = z;
    const e = easeInOut(z);
    const st: State = { r, agentTo: m.agentTo, users };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    rect = lerpRect(baseRect(T), F0, e);
    const s = clamp(rect.h / 440, 0.32, 1.15);

    // other organisations, revealed as the view pulls back; the figure reaches them in order of distance
    if (e > 0.002) {
      const kx = rect.w / F0.w, ky = rect.h / F0.h;
      const front = z * (maxD * 0.6 + 0.5);
      ctx.save();
      ctx.globalAlpha = Math.min(1, e * 1.6);
      for (const o of others) {
        const R: Rect = { x: rect.x + (o.cell.x - F0.x) * kx, y: rect.y + (o.cell.y - F0.y) * ky, w: o.cell.w * kx, h: o.cell.h * ky };
        if (R.x > W || R.x + R.w < 0 || R.y > H || R.y + R.h < 0) continue;
        const h = clamp((front - o.d) / 1.3);
        const so: State = { r: h, agentTo: h > 0 ? o.sys.t0 + (1 - o.sys.t0) * h : 0 };
        const prims = geometry(o.sys, so, { detail: 0.5 });
        const ss = clamp(R.h / 440, 0.28, 1.1);
        drawPrims(ctx, prims, R, { ink: INK, band: 'rgba(17,18,19,.12)', hl: HL, hlA: 1, paper: PAPER }, ss, 'hl');
        drawPrims(ctx, prims, R, { ink: '#5f6266', band: 'rgba(17,18,19,.09)', hl: HL, hlA: 1, paper: PAPER }, ss, 'ink');
        bracket(o.sys, so, R, '#5f6266');
      }
      ctx.restore();
    }

    const prims = geometry(sys, st, { skipUsers: true });
    const xT = rect.x + T * rect.w;
    const xm = narrow && e < 1 ? mix(34, 0, e) : 0; // on phones the voice numbers keep a clean margin
    const clip = (left: boolean, fn: () => void) => {
      ctx.save(); ctx.beginPath();
      if (left) ctx.rect(xm, 0, Math.max(0, xT - xm), H); else ctx.rect(Math.max(xT, xm), 0, W - Math.max(xT, xm), H);
      ctx.clip(); fn(); ctx.restore();
    };
    const futureInk = e > 0 ? mixHex(PENCIL, INK, e) : PENCIL;
    clip(true, () => drawPrims(ctx, prims, rect, { ink: INK, band: 'rgba(17,18,19,.13)', hl: HL, hlA: 1, paper: PAPER }, s, 'hl'));
    clip(false, () => drawPrims(ctx, prims, rect, { ink: INK, band: 'rgba(17,18,19,.13)', hl: HL, hlA: 0.42 + 0.58 * e, paper: PAPER }, s, 'hl'));
    clip(true, () => drawPrims(ctx, prims, rect, { ink: INK, band: 'rgba(17,18,19,.13)', hl: HL, hlA: 1, paper: PAPER }, s, 'ink'));
    clip(false, () => drawPrims(ctx, prims, rect, { ink: futureInk, band: 'rgba(17,18,19,.07)', hl: HL, hlA: 1, paper: PAPER }, s, 'ink'));
    if (users.length) {
      const mine = geometry(sys, { r: 0, agentTo: 0, users }).filter((q) => q.k === 'hl' || (q.k === 'path' && q.role === 'user') || q.k === 'niente');
      ctx.save(); ctx.beginPath(); ctx.rect(xm, 0, W - xm, H); ctx.clip();
      drawPrims(ctx, mine, rect, { ink: INK, band: '', hl: HL, hlA: 1, paper: PAPER }, s, 'hl');
      drawPrims(ctx, mine, rect, { ink: INK, band: '', hl: HL, hlA: 1, paper: PAPER }, s, 'ink');
      ctx.restore();
    }
    bracket(sys, st, rect, INK);
    chrome(T, st, m.state, 1 - Math.min(1, e * 1.5));

    if (m.state !== lastState) { stage.dataset.state = String(m.state); lastState = m.state; }

    if (sound.on) {
      const hits: { voice: number; y: number }[] = [];
      if (lastT >= 0 && T > lastT) sys.voices.forEach((v, i) => {
        if (v.g === 'line' || v.g === 'fan') return;
        for (const ev of v.events) { const t = snapT(sys, st, ev.t); if (t > lastT && t <= T) hits.push({ voice: i, y: voiceY(sys, v, st, t) + ev.v * 0.03 }); }
      });
      sound.frame({ ys: sys.voices.map((v) => voiceY(sys, v, st, T)), agentY: m.agentTo > sys.t0 ? agentY(sys, st, T) : null, hits, r, moved: Math.abs(T - lastT) > 1e-5, drawY: penY });
    }
    lastT = T;
  }

  // the system bracket: one line joining every voice at the start of the system
  function bracket(sy: System, st: State, R: Rect, color: string) {
    const x = Math.max(R.x, narrow ? 34 : 0) - 9;
    if (x < 2 && R.x < 0) return;
    const t0 = clamp((x + 8 - R.x) / R.w);
    const ys = sy.voices.map((v) => R.y + voiceY(sy, v, st, t0) * R.h);
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, 2 * clamp(R.h / 440, 0.3, 1));
    ctx.beginPath(); ctx.moveTo(x, Math.min(...ys) - 6); ctx.lineTo(x, Math.max(...ys) + 6); ctx.stroke();
    ctx.restore();
  }

  function chrome(T: number, st: State, state: number, a: number) {
    if (a <= 0.01) return;
    const R = rect;
    const X = (t: number) => R.x + t * R.w;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = INK; ctx.strokeStyle = INK;
    // voice numbers
    ctx.font = `500 11px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const xl = Math.max(R.x, narrow ? 34 : 0) - (narrow ? 17 : 22);
    const tl = clamp((Math.max(R.x, narrow ? 34 : 0) - R.x) / R.w);
    sys.voices.forEach((v, i) => ctx.fillText(String(i + 1), xl, R.y + voiceY(sys, v, st, tl) * R.h));
    // rehearsal marks
    const my = R.y - (narrow ? 36 : 44), bs = narrow ? 18 : 20;
    ctx.font = `600 ${narrow ? 11 : 12}px ${FONT}`; ctx.textAlign = 'center';
    MARKS.forEach((t, i) => {
      const x = Math.max(X(t), narrow ? 34 : 0);
      if (x > W - 10) return;
      const active = i === state;
      ctx.lineWidth = 1;
      if (active) { ctx.fillRect(x, my - bs / 2, bs, bs); ctx.fillStyle = PAPER; }
      else ctx.strokeRect(x + 0.5, my - bs / 2 + 0.5, bs - 1, bs - 1);
      ctx.fillText('ABCD'[i], x + bs / 2, my + 0.5);
      ctx.fillStyle = INK;
    });
    // time ruler
    const ry = R.y + R.h + (narrow ? 26 : 34);
    const x0 = Math.max(X(0), 0), x1 = Math.min(X(1), W);
    ctx.lineWidth = 1;
    for (let i = 0; i <= 100; i++) {
      const x = X(i / 100); if (x < x0 - 1 || x > x1 + 1) continue;
      const len = i % 10 === 0 ? 9 : i % 5 === 0 ? 6 : 3;
      ctx.strokeStyle = x <= X(T) ? INK : PENCIL;
      ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, ry); ctx.lineTo(Math.round(x) + 0.5, ry - len); ctx.stroke();
    }
    ctx.strokeStyle = PENCIL; ctx.beginPath(); ctx.moveTo(x0, ry + 0.5); ctx.lineTo(x1, ry + 0.5); ctx.stroke();
    ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x0, ry + 0.5); ctx.lineTo(X(T), ry + 0.5); ctx.stroke();
    // playhead
    const xp = Math.round(X(T)) + 0.5;
    ctx.lineWidth = 1; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(xp, my + bs / 2 + 8); ctx.lineTo(xp, ry + 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(xp - 5, my + bs / 2 + 2); ctx.lineTo(xp + 5, my + bs / 2 + 2); ctx.lineTo(xp, my + bs / 2 + 9); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------ drawing a voice
  const toScore = (ev: PointerEvent): [number, number] => {
    const b = canvas.getBoundingClientRect();
    const x = ev.clientX - b.left, y = ev.clientY - b.top;
    return [clamp((x - rect.x) / rect.w), clamp((y - rect.y) / rect.h, -0.05, 1.05)];
  };
  canvas.addEventListener('pointerdown', (ev) => {
    if (zNow > 0.3 || ev.button > 0) return;
    const pt = toScore(ev);
    drawing = { pts: [pt], g: rm ? 1 : 0, v: 0 };
    users.push(drawing);
    while (users.length > 3) users.shift();
    decided = ev.pointerType !== 'touch';
    sx = ev.clientX; sy = ev.clientY;
    if (decided) canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!drawing) return;
    if (!decided) {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.hypot(dx, dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) { users.splice(users.indexOf(drawing), 1); drawing = null; return; }
      decided = true; canvas.setPointerCapture(ev.pointerId);
    }
    const pt = toScore(ev);
    const last = drawing.pts[drawing.pts.length - 1];
    if (pt[0] > last[0] + 0.0015) { drawing.pts.push(pt); penY = pt[1]; request(); }
  });
  const end = () => {
    if (!drawing) return;
    const pts = drawing.pts;
    if (pts.length < 3 || pts[pts.length - 1][0] - pts[0][0] < 0.015) users.splice(users.indexOf(drawing), 1);
    else { hint?.setAttribute('hidden', ''); clearBtn?.removeAttribute('hidden'); }
    drawing = null; penY = null; request();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  clearBtn?.addEventListener('click', () => { users.length = 0; clearBtn.setAttribute('hidden', ''); hint?.removeAttribute('hidden'); request(); });

  soundBtn?.addEventListener('click', () => {
    if (sound.on) { sound.disable(); soundBtn.setAttribute('aria-pressed', 'false'); soundBtn.querySelector('[data-sound-label]')!.textContent = 'Sound off'; }
    else if (sound.enable(sys.voices.length)) { soundBtn.setAttribute('aria-pressed', 'true'); soundBtn.querySelector('[data-sound-label]')!.textContent = 'Sound on'; lastT = -1; request(); }
  });

  window.addEventListener('scroll', readScroll, { passive: true });
  new ResizeObserver(() => { layout(); readScroll(); }).observe(stage);
  document.fonts?.ready.then(request);
  layout(); readScroll();
  p = pTarget;
  // expose for screenshots / debugging
  (window as any).__score = { get p() { return p; } };
}

function mixHex(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}
