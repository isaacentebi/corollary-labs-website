// The home score. On load the playhead plays the entry once; after that, scroll moves it.
// A  the ensemble (the past, left of the entry)
// B  a new voice enters from nothing
// C  the ensemble makes room, regroups, and each voice restates the figure in its own grammar
// D  the view pulls back: the figure reaches the near systems; the far ones only just see it enter
// then the whole score collapses into the site ruler at the top of the page, which stays with you.
// Visitors can draw a voice (UPIC). Space bends a little around it; voices never cross.
// Renders only when something changes.
import { mainSystem, otherSystem, geometry, userPrims, groupSpans, baseY, agentY, clamp, mix, smooth, hash, MOTIF_POINTS, strokeY, type State, type UserStroke, type System, type Prim } from './model';
import { drawPrims, lerpRect, bracket, INK, PENCIL, GREY, HL, FONT, type Rect } from './render';
import { Sound } from './sound';

const seg = (a: number, b: number, x: number) => clamp((x - a) / (b - a));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

interface Stroke extends UserStroke { v: number; raw: [number, number][] }
interface Other { sys: System; cell: Rect; d: number }

const P0 = { T: 0.43, r: 0.12 };   // the state the intro lands on (scroll position 0)
const BAR = 30;                     // height of the site ruler (px)

export function mountScore(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const drawBtn = root.querySelector<HTMLButtonElement>('[data-draw]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-clear]');
  const soundBtn = root.querySelector<HTMLButtonElement>('[data-sound]');
  const statement = root.querySelector<HTMLElement>('[data-statement]');
  const swath = root.querySelector<HTMLElement>('[data-swath]');
  const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const html = document.documentElement;

  const sys = mainSystem();
  const sound = new Sound();
  const MARKS = [0, sys.t0, 0.5, 0.74];

  let W = 0, H = 0, dpr = 1, narrow = false, gutter = 16;
  let F0: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let others: Other[] = [];
  let p = 0, pTarget = 0, raf = 0, lastT = -1, lastState = -1, lastH = -1;
  let q = 0, off = 0;   // q: how far the stage has scrolled away (0..1 over half a viewport); off: that distance in px
  let intro = rm || scrollY > 20 ? 1 : 0, introStart = 0;
  let rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let zNow = 0;
  const users: Stroke[] = [];
  let drawing: Stroke | null = null;
  let drawMode = false;
  let lastPenIdx = -1;
  let auto: { stroke: Stroke; pts: [number, number][]; i: number } | null = null;

  // ------------------------------------------------ scroll → state
  function mapping(p: number) {
    let T: number, r: number;
    if (p < 0.45) { const f = seg(0, 0.45, p); T = mix(P0.T, 0.64, f); r = mix(P0.r, 1, smooth(0, 1, f)); }
    else if (p < 0.58) { T = mix(0.64, 0.74, seg(0.45, 0.58, p)); r = 1; }
    else { T = mix(0.74, 0.97, seg(0.58, 1, p)); r = 1; }
    T = mix(T, 1, q);
    if (intro < 1) {
      const e = easeInOut(intro);
      T = mix(0.27, T, e); r = mix(0, r, smooth(0.55, 1, intro));
    }
    const z = smooth(0.58, 0.95, p);
    const h = q;   // the collapse happens as the stage scrolls away, within half a viewport
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
  // where everything goes at the end: flattened into the site ruler at the top of the page
  const barRect = (): Rect => ({ x: 0, y: off + BAR / 2, w: W, h: 0.5 });
  // page progress at which the story ends (the site ruler's playhead picks up from here)
  const pageP = () => {
    const total = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    return clamp(scrollY / total);
  };

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
    request();
  }

  function readScroll() {
    const r = root.getBoundingClientRect();
    const span = root.offsetHeight - window.innerHeight;
    pTarget = span > 0 ? clamp(-r.top / span) : 0;
    if (pTarget > 0.002 && intro < 1) intro = 1;   // the reader takes over
    off = Math.max(0, window.innerHeight - r.bottom);
    q = clamp(off / (window.innerHeight * 0.5));
    // the site ruler takes over once the score has collapsed into it
    html.classList.toggle('bar-on', q > 0.985);
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
    if (auto) {
      const n = rm ? auto.pts.length : 4;
      for (let k = 0; k < n && auto.i < auto.pts.length; k++) auto.stroke.raw.push(auto.pts[auto.i++]);
      smoothStroke(auto.stroke);
      if (auto.i >= auto.pts.length) { auto = null; clearBtn?.removeAttribute('hidden'); } else again = true;
    }
    for (const u of users) {
      if (rm) { u.g = 1; continue; }
      const dt = 1 / 60;
      u.v += ((1 - (u.g ?? 0)) * 120 - u.v * 14) * dt;
      u.g = (u.g ?? 0) + u.v * dt;
      if (Math.abs(1 - u.g) > 0.001 || Math.abs(u.v) > 0.001) again = true; else { u.g = 1; u.v = 0; }
    }
    if (intro > 0.12) { statement?.classList.add('is-played'); swath?.classList.add('is-played'); }
    draw();
    if (again) request();
  }

  // ------------------------------------------------ drawing
  function draw() {
    const m = mapping(p);
    const { T, r, z, h } = m;
    zNow = z;
    const e = easeInOut(z);
    const hh = easeInOut(h);
    const st: State = { r, agentTo: m.agentTo, users };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (Math.abs(h - lastH) > 0.002) { stage.style.setProperty('--h', h.toFixed(3)); lastH = h; }

    rect = lerpRect(lerpRect(baseRect(T), F0, e), barRect(), hh);
    const s = clamp(rect.h / 440, 0.34, 1.12);

    // other organisations: the near ring takes up the whole figure, the far ring only sees the entry
    if (e > 0.002 && hh < 0.999) {
      const kx = rect.w / F0.w, ky = rect.h / F0.h;
      const front = z * 1.85 - 0.1;
      for (const o of others) {
        const R: Rect = { x: rect.x + (o.cell.x - F0.x) * kx, y: rect.y + (o.cell.y - F0.y) * ky, w: o.cell.w * kx, h: Math.max(0.5, o.cell.h * ky) };
        if (R.x > W || R.x + R.w < 0 || R.y > H || R.y + R.h < 0) continue;
        const reach = clamp((front - o.d) / 1.0);
        const wedge = reach <= 0 ? clamp((front - o.d + 0.9) / 0.4) : 1;
        const so: State = { r: reach, agentTo: reach > 0 ? o.sys.t0 + (1 - o.sys.t0) * reach : wedge > 0 ? o.sys.t0 + 0.0008 : 0 };
        const prims = geometry(o.sys, so, { detail: 0.55 });
        const ss = clamp(R.h / 440, 0.3, 1.05);
        ctx.save();
        ctx.globalAlpha = Math.min(1, e * 1.4) * (o.d > 1.7 ? 0.55 : o.d > 1.2 ? 0.8 : 1) * (1 - smooth(0, 0.25, h));
        if (ctx.globalAlpha < 0.01) { ctx.restore(); continue; }
        drawPrims(ctx, prims, R, { ink: INK, band: '', hl: HL, hlA: 0.7 * (reach > 0 ? 1 : wedge) }, ss, 'hl');
        drawPrims(ctx, prims, R, { ink: GREY, band: 'rgba(17,18,19,.08)', hl: HL, hlA: 1 }, ss, 'ink');
        ctx.fillStyle = GREY;
        const ys = o.sys.voices.map((v) => R.y + baseY(o.sys, v, so, 0) * R.h);
        ctx.fillRect(Math.round(R.x) - 7, Math.min(...ys) - 5, 1, Math.max(...ys) - Math.min(...ys) + 10);
        ctx.restore();
      }
    }

    // the score itself: past in ink, future in pencil; nothing leaves its system
    const prims = geometry(sys, st, { skipUsers: true });
    const xT = rect.x + T * rect.w;
    const xm = narrow ? mix(30, 0, Math.max(e, hh)) : 0;
    const bandTop = rect.y - rect.h * 0.1 - 6, bandBot = rect.y + rect.h * 1.1 + 6;
    const clip = (left: boolean | null, fn: () => void) => {
      ctx.save(); ctx.beginPath();
      if (left === null) ctx.rect(xm, bandTop, W, bandBot - bandTop);
      else if (left) ctx.rect(xm, bandTop, Math.max(0, xT - xm), bandBot - bandTop);
      else ctx.rect(Math.max(xT, xm), bandTop, W, bandBot - bandTop);
      ctx.clip(); fn(); ctx.restore();
    };
    const future = e > 0 ? mixHex(PENCIL, INK, e) : PENCIL;
    clip(true, () => drawPrims(ctx, prims, rect, { ink: INK, band: 'rgba(17,18,19,.12)', hl: HL, hlA: 1 }, s, 'hl'));
    clip(false, () => drawPrims(ctx, prims, rect, { ink: INK, band: '', hl: HL, hlA: 0.35 + 0.65 * e }, s, 'hl'));
    clip(true, () => drawPrims(ctx, prims, rect, { ink: INK, band: 'rgba(17,18,19,.12)', hl: HL, hlA: 1 }, s, 'ink'));
    clip(false, () => drawPrims(ctx, prims, rect, { ink: future, band: 'rgba(17,18,19,.06)', hl: HL, hlA: 0.4 + 0.6 * e }, s, 'ink'));
    if (users.length) clip(null, () => drawPrims(ctx, userPrims(st), rect, { ink: INK, band: '', hl: HL, hlA: 1 }, s, 'ink'));
    chrome(T, st, m.state, e, hh);

    if (m.state !== lastState) { stage.dataset.state = String(m.state); lastState = m.state; }
    if (sound.on && lastT >= 0 && T > lastT + 1e-5 && intro >= 1) voiceEvents(prims, st, lastT, T);
    lastT = T;
  }

  function chrome(T: number, st: State, state: number, e: number, hh: number) {
    const R = rect;
    const X = (t: number) => R.x + t * R.w;
    const a = (1 - Math.min(1, e * 1.6)) * (1 - hh);
    ctx.save();
    ctx.fillStyle = INK; ctx.strokeStyle = INK;

    // left: system barline and brackets that regroup around the new voice
    if (hh < 0.98) {
      ctx.globalAlpha = 1 - hh;
      const edge = Math.max(R.x, narrow ? 34 : 0);
      const tl = clamp((edge - R.x) / R.w);
      const k = clamp(R.h / 440, 0.55, 1);
      const spans = groupSpans(sys, st, tl).map((g) => ({ a: R.y + g.a * R.h, b: R.y + g.b * R.h }));
      const top = Math.min(...spans.map((g) => g.a)), bot = Math.max(...spans.map((g) => g.b));
      const xb = Math.round(edge) - (narrow ? 7 : 10);
      ctx.fillRect(xb, top - 6 * k, 1.5, bot - top + 12 * k);
      for (const g of spans) bracket(ctx, xb - 4 * k, g.a, g.b, k);
      ctx.globalAlpha = 1;
    }

    // rehearsal marks: the current one is filled with the highlighter
    if (a > 0.01) {
      ctx.globalAlpha = a;
      const bs = narrow ? 24 : 30, my = R.y - (narrow ? 38 : 52);
      ctx.font = `560 ${narrow ? 13 : 15}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const edgeX = narrow ? 34 : 0;
      MARKS.forEach((t, i) => {
        let x = X(t);
        if (x < edgeX) {
          const next = i + 1 < MARKS.length ? X(MARKS[i + 1]) : Infinity;
          if (next < edgeX) return;                       // an earlier mark, already replaced
          x = Math.min(edgeX, next - bs - 8);
        }
        x = Math.round(x);
        if (x > W - 12 || x < -bs) return;
        if (i === state) { ctx.fillStyle = HL; ctx.fillRect(x, my - bs / 2, bs, bs); ctx.fillStyle = INK; }
        else if (i < state) { ctx.fillStyle = 'rgba(255,225,74,.35)'; ctx.fillRect(x, my - bs / 2, bs, bs); ctx.fillStyle = INK; }
        ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.75, my - bs / 2 + 0.75, bs - 1.5, bs - 1.5);
        ctx.fillText('ABCD'[i], x + bs / 2, my + 0.5);
      });
      ctx.globalAlpha = 1;
    }

    // the time ruler: under the system, then (collapse) the site ruler at the top of the page
    const rg = narrow ? 28 : 36;
    const ry = Math.round(mix(Math.min(H - 1, R.y + R.h + rg * mix(1, 0.6, e)), off + BAR - 1, hh)) + 0.5;
    const TX = (t: number) => mix(X(t), t * W, hh);
    const x0 = mix(Math.max(X(0), narrow ? 34 : 0), 0, hh), x1 = mix(Math.min(X(1), W), W, hh);
    ctx.lineWidth = 1;
    for (let i = 0; i <= 100; i += 2) {
      const x = Math.round(TX(i / 100)) + 0.5;
      if (x < x0 - 1 || x > x1 + 1) continue;
      const len = i % 10 === 0 ? 9 : 3;
      ctx.strokeStyle = i / 100 <= T + 1e-6 ? INK : PENCIL;
      ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(x, ry - len); ctx.stroke();
    }
    // the playhead ends where the site ruler's playhead continues
    const xp = Math.round(mix(TX(T), 6 + pageP() * (W - 34), hh)) + 0.5;
    ctx.strokeStyle = PENCIL; ctx.beginPath(); ctx.moveTo(x0, ry); ctx.lineTo(x1, ry); ctx.stroke();
    ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x0, ry); ctx.lineTo(Math.min(xp, x1), ry); ctx.stroke();
    if (hh > 0.6) { ctx.globalAlpha = smooth(0.6, 1, hh); ctx.fillStyle = HL; ctx.globalCompositeOperation = 'multiply'; ctx.fillRect(0, ry - BAR + 1, xp, BAR - 1); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }

    const pa = 1 - Math.min(1, e * 1.2);
    const phTop = mix(mix(R.y - (narrow ? 38 : 52) + (narrow ? 12 : 15) + 8, ry - 14, e), ry - BAR + 8, hh);
    ctx.strokeStyle = INK; ctx.fillStyle = INK;
    ctx.globalAlpha = Math.max(pa, hh, 0.001);
    ctx.beginPath(); ctx.moveTo(xp, phTop); ctx.lineTo(xp, ry + 6); ctx.stroke();
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
    const y = (ev.clientY - b.top - rect.y) / rect.h;
    // soft limits: a line drawn past the edge of the system is gathered back inside it
    const soft = y < 0 ? -0.04 * Math.tanh(-y / 0.04) : y > 1 ? 1 + 0.04 * Math.tanh((y - 1) / 0.04) : y;
    return [clamp((ev.clientX - b.left - rect.x) / rect.w), soft];
  };
  function smoothStroke(s: Stroke) {
    const raw = s.raw; if (raw.length < 2) { s.pts = raw.slice(); return; }
    const a = raw[0][0], b = raw[raw.length - 1][0];
    const res: [number, number][] = [];
    for (let t = a; t < b; t += 0.003) res.push([t, strokeY(raw, t)]);
    res.push([b, raw[raw.length - 1][1]]);
    const k = 4;
    s.pts = res.map(([t], i) => { let sum = 0, n = 0; for (let j = Math.max(0, i - k); j <= Math.min(res.length - 1, i + k); j++) { sum += res[j][1]; n++; } return [t, sum / n]; });
    s.mean = s.pts.reduce((acc, q) => acc + q[1], 0) / s.pts.length;
  }
  const addStroke = (s: Stroke) => { users.push(s); while (users.length > 2) users.shift(); };
  const canDraw = (ev: PointerEvent) => zNow < 0.3 && (ev.pointerType === 'mouse' ? ev.button === 0 : ev.pointerType === 'pen' || drawMode);
  canvas.addEventListener('pointerdown', (ev) => {
    if (!canDraw(ev)) return;
    ev.preventDefault();
    const pt = toScore(ev);
    drawing = { raw: [pt], pts: [pt], g: rm ? 1 : 0, v: 0 };
    addStroke(drawing);
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
  clearBtn?.addEventListener('click', () => { users.length = 0; auto = null; clearBtn.setAttribute('hidden', ''); request(); });

  // Draw: on touch screens a mode that holds the page still; with a mouse or the keyboard
  // it writes one voice for you, entering just behind the playhead.
  drawBtn?.addEventListener('click', () => {
    if (coarse) {
      drawMode = !drawMode;
      drawBtn.setAttribute('aria-pressed', String(drawMode));
      stage.classList.toggle('is-drawing', drawMode);
      return;
    }
    const T = mapping(p).T;
    const ta = clamp(T - 0.03, 0.04, 0.66), len = 0.3, k = users.length;
    const y0 = k % 2 ? 0.25 : 0.68;
    const pts: [number, number][] = [];
    for (let t = ta; t <= ta + len; t += 0.004) {
      const u = (t - ta) / len;
      pts.push([t, y0 + 0.07 * Math.sin(u * Math.PI * 2.2) * Math.sin(u * Math.PI)]);
    }
    const stroke: Stroke = { raw: [pts[0]], pts: [pts[0]], g: rm ? 1 : 0, v: 0 };
    addStroke(stroke);
    auto = { stroke, pts, i: 1 };
    request();
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
