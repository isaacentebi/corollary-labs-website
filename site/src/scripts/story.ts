// Home story: one sticky stage, one scroll progress T in [0, TMAX], seven states of one table.
// Each state's caption switches at the midpoint of its transition.
import { Table, ease, type Params } from './table';
import { N, SUPPLIED } from './economy';

const TMAX = 7.0;
const START = [0.3, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
const HOLD = [0.65, 1.6, 2.7, 3.6, 4.9, 5.82, 6.95];   // a resting T inside each state (rail jumps, reduced motion)

const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pad = (n: number) => String(n).padStart(2, '0');

export function initStory() {
  const root = document.querySelector<HTMLElement>('[data-story]');
  const stage = root?.querySelector<HTMLElement>('[data-stage]');
  const canvas = root?.querySelector<HTMLCanvasElement>('[data-gl]');
  if (!root || !stage || !canvas) return;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let table: Table;
  try { table = new Table(canvas); } catch { stage.classList.add('no-gl'); return; }
  const e = table.e, K = e.K;

  const $ = <T extends Element = HTMLElement>(s: string) => stage.querySelector(s) as unknown as T;
  const $$ = <T extends Element = HTMLElement>(s: string) => Array.from(stage.querySelectorAll(s)) as unknown as T[];
  const caps = $$('[data-cap]'), capsHost = $('[data-caps]'), railBtns = $$<HTMLButtonElement>('[data-goto]');
  const hero = $('[data-hero]'), tip = $('[data-tip]'), cue = $('[data-cue]'), coda = $('[data-coda]');
  const title = $('[data-title]'), buyer = $('[data-buyer]'), supplier = $('[data-supplier]'), rule = $('[data-rule]');
  const colIds = $$('[data-cl]'), rowIds = $$('[data-rl]'), rowLab = $$('[data-row]');
  const trange = $<HTMLInputElement>('[data-trange]'), tout = $('[data-tout]');
  const numsHost = $('[data-nums]'), chip = $('[data-chip]'), agent = $('[data-agent]'), rounds = $('[data-rounds]');

  // on phones, number only a few firms: ones that stay well apart both before and after the reorganisation
  const pick: number[] = [];
  for (const s of [0, 31, 15, 7, 23, 3, 27, 11, 19]) {
    if (pick.length >= 5) break;
    if (pick.every((q) => Math.abs(q - s) >= 5 && Math.abs(e.pos1[q] - e.pos1[s]) >= 5)) pick.push(s);
  }
  for (let s = 0; s < N; s++) {
    const m = pick.includes(s);
    colIds[s].classList.toggle('-m', m); rowIds[s].classList.toggle('-m', m);
  }

  // rounds indicator
  rounds.innerHTML = '<span>Round</span>' + Array.from({ length: e.R }, (_, r) => `<b data-r="${r + 1}">${r + 1}</b>`).join('');
  const roundEls = Array.from(rounds.querySelectorAll<HTMLElement>('[data-r]'));

  // numbers for the focus column: 32 firm rows + 3 supplied + output
  const nums: HTMLSpanElement[] = [];
  for (let k = 0; k < N + 4; k++) { const s = document.createElement('span'); numsHost.appendChild(s); nums.push(s); }

  let W = 0, H = 0, mobile = false, head = 52, capTop = 0, u = 10, G = 40;
  const layout = () => {
    W = stage.clientWidth; H = stage.clientHeight;
    mobile = W < 900;
    head = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head')) || 52;
    // captions share one top edge: the container is as tall as the tallest caption
    let ch = 0;
    caps.forEach((c) => (ch = Math.max(ch, c.offsetHeight)));
    capsHost.style.height = `${ch}px`;
    capTop = capsHost.getBoundingClientRect().top - stage.getBoundingClientRect().top;
    if (mobile) {
      G = 40;
      u = Math.floor(((W - 32 - G) / N) * 4) / 4;
    } else {
      const bw = W * 0.6 - Math.max(16, Math.min(32, W * 0.022)), bh = H - head - 80 - 56;
      u = Math.floor(Math.min(bw / N, bh / (N + 7.4)) * 4) / 4;
    }
    table.resize(W, H);
    dirty = true;
  };

  // per-frame geometry (on phones the enlarged column also grows taller)
  const geom = (focus: number) => {
    const L = table.L;
    L.W = W; L.H = H; L.u = u;
    if (mobile) {
      const oy0 = head + 58, oyF = head + 18;
      const uyF = Math.min(15, (capTop - 16 - oyF - 7.4 * u) / N);
      L.uy = lerp(u, Math.max(u, uyF), focus);
      L.ox = 16 + G;
      L.oy = Math.round(lerp(oy0, oyF, focus));
      L.fit = { x: 16, y: head + 30, w: W - 32, h: capTop - 64 - (head + 30), bottom: true };
    } else {
      L.uy = u;
      L.ox = Math.round(W - Math.max(16, Math.min(32, W * 0.022)) - N * u);
      L.oy = head + 80;
      L.fit = { x: W * 0.36, y: head + 40, w: W * 0.64 - 40, h: H - head - 40 - 90 };
    }
  };

  // ── scroll → T ──
  let T = 0;
  const readScroll = () => {
    const r = root.getBoundingClientRect();
    const span = r.height - innerHeight;
    const p = span > 0 ? clamp(-r.top / span) : 0;
    let t = p * TMAX;
    if (RM) { const i = stateOf(t); t = i < 0 ? 0 : HOLD[i]; }
    if (t !== T) { T = t; tUser = null; dirty = true; }
  };
  const stateOf = (t: number) => { let i = -1; for (let k = 0; k < START.length; k++) if (t >= START[k]) i = k; return i; };

  // ── coda: t follows scroll; the slider can take it over until the next scroll ──
  let tUser: number | null = null;
  trange.addEventListener('input', () => { tUser = parseFloat(trange.value); dirty = true; });

  // ── click trace ──
  let pulseSlot = -1, pulseT = 0, lastNow = performance.now();

  // ── hover / tap ──
  const pointer = (ev: PointerEvent | MouseEvent, click = false) => {
    const rect = stage.getBoundingClientRect();
    const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
    const cell = T < START[1] - 0.2 ? table.cellAt(px, py) : null;
    const prev = table.hover;
    table.hover = cell;
    if ((prev?.r ?? -1) !== (cell?.r ?? -1) || (prev?.c ?? -1) !== (cell?.c ?? -1)) dirty = true;
    if (!cell) { tip.classList.remove('-on'); stage.style.cursor = ''; return; }
    stage.style.cursor = 'crosshair';
    let txt: string;
    if (cell.r < N) {
      const v = cell.r === cell.c ? table.diag[cell.c] : e.A0[cell.r * N + cell.c];
      txt = `From ${pad(cell.r + 1)} to ${pad(cell.c + 1)}${cell.r === cell.c ? ' (itself)' : ''} · <b>${v.toFixed(3)}</b>`;
    } else {
      const k = cell.r - N;
      txt = `${SUPPLIED[k]} to ${pad(cell.c + 1)} · <b>${e.L[k * N + cell.c].toFixed(3)}</b>`;
    }
    tip.innerHTML = txt;
    const tw = tip.offsetWidth;
    const x = clamp(px + 16 + tw > W - 8 ? px - 16 - tw : px + 16, 8, W - 8 - tw);
    tip.style.transform = `translate(${x}px, ${py + 16}px)`;
    tip.classList.add('-on');
    if (click) { pulseSlot = cell.c; pulseT = 0; dirty = true; }
  };
  stage.addEventListener('pointermove', (ev) => { if (ev.pointerType === 'mouse') pointer(ev); });
  stage.addEventListener('pointerleave', () => { table.hover = null; tip.classList.remove('-on'); dirty = true; });
  stage.addEventListener('click', (ev) => { if (!(ev.target as HTMLElement).closest('button, input, a')) pointer(ev, true); });

  // ── rail ──
  railBtns.forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.goto!;
    const r = root.getBoundingClientRect();
    scrollTo({ top: scrollY + r.top + (HOLD[i] / TMAX) * (r.height - innerHeight), behavior: RM ? 'auto' : 'smooth' });
  }));

  // ── frame ──
  let dirty = true, visible = true, lastState = -2;
  const P: Params = { focus: 0, eK: 0, pK: 0, vals: 0, rows: 0, cols: 0, front: -99, lift: 0, t: 1 };

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now;
    if (visible) {
      if (pulseSlot >= 0) {
        pulseT += dt;
        table.pulse(pulseSlot, RM ? 1.6 : pulseT);
        if (pulseT > 3) { pulseSlot = -1; table.flash.fill(0); }
        dirty = true;
      }
      if (dirty) { dirty = false; draw(); }
    }
    requestAnimationFrame(frame);
  };

  const draw = () => {
    const t = T;
    P.focus = ease((t - 0.75) / 0.5) - ease((t - 3.65) / 0.3);
    const agentIn = clamp((t - 1.72) / 0.3);
    P.eK = clamp((t - 2.0) / 0.55);
    P.pK = clamp((t - 2.8) / 0.55);
    P.vals = clamp((t - 3.85) / 0.2);
    P.rows = clamp((t - 4.05) / 0.4);
    P.cols = clamp((t - 4.45) / 0.4);
    P.front = t < 4.95 ? -99 : -0.6 + clamp((t - 4.95) / 0.85) * (e.R + 1.2);
    P.lift = clamp((t - 5.88) / 0.35);
    let tH = 1;
    if (P.lift > 0) {
      tH = t < 6.23 ? 1 - ease(P.lift) : clamp((t - 6.28) / 0.6);
      if (tUser !== null) tH = tUser;
      P.t = tH;
      P.front = tH < 0.01 ? -99 : -0.6 + tH * (e.R + 1.2);
      P.eK = 0; P.pK = 0;
    }
    geom(P.focus);
    table.render(P);

    const { ox, oy, uy } = table.L;
    if (P.focus === 0) { stage.dataset.ox = String(ox); stage.dataset.oy = String(oy); stage.dataset.u = String(u); }
    const tw = N * u, flat = clamp(1 - P.lift * 3);
    const axA = (1 - P.focus) * flat;
    const set = (el: HTMLElement, x: number, y: number, tr: string, o: number) => {
      el.style.transform = `translate(${x}px, ${y}px) ${tr}`; el.style.opacity = String(o);
    };
    // title, axes, numbers attached to every row and column (they travel with their firm)
    const roundsA = P.front > -50 ? clamp((t - 4.95) / 0.12) * flat : 0;
    set(title, mobile ? 16 : ox, oy - 40, 'translateY(-50%)', axA);
    set(buyer, ox + tw, oy - 40, 'translate(-100%, -50%)', axA * clamp((4.95 - t) / 0.04));
    set(supplier, ox - (mobile ? 30 : 34), oy + (N * uy) / 2, 'translate(-50%, -50%) rotate(-90deg)', axA);
    set(rounds, ox + tw, oy - 40, 'translate(-100%, -50%)', roundsA);
    for (let s = 0; s < N; s++) {
      set(colIds[s], ox + (table.colX[s] + table.colW[s] / 2) * u, oy - 10, 'translate(-50%, -100%)', axA);
      set(rowIds[s], ox - 6, oy + table.rowTop(table.rowPos[s]) + uy / 2, 'translate(-100%, -50%)', axA);
    }
    rowLab.forEach((el) => {
      const k = +el.dataset.row!;
      const y = k < 3 ? table.supTop(k) : table.outTop();
      set(el, ox - 6, oy + y + 0.75 * u, 'translate(-100%, -50%)', flat);
    });
    set(rule, ox, oy + N * uy + 0.35 * u, '', flat);
    rule.style.width = `${tw}px`;
    roundEls.forEach((el) => el.classList.toggle('-on', P.front >= +el.dataset.r! - 0.45));

    // the enlarged column's coefficients (they add up to 1.000; the diagonal is the literal sum of what moved in)
    const nA = P.focus * flat;
    numsHost.style.opacity = String(nA);
    if (nA > 0.001) {
      const xr = ox + (table.colX[K] + table.colW[K]) * u - 5;
      nums.forEach((sp, k) => {
        let y: number, v: number, o = 1, dark = false;
        if (k < N) {
          y = table.rowTop(k) + uy / 2;
          v = k === K ? table.diag[K] : e.A0[k * N + K];
          dark = k === K ? table.eIn[K] > 0 || v > 0.09 : v > 0.09;
          if (v <= 0 && mobile) o = 0;
        } else if (k < N + 3) {
          const kk = k - N;
          v = e.L[kk * N + K];
          const fly = kk === 0 ? P.eK : kk === 1 ? P.pK : 0;
          y = lerp(table.supTop(kk) + 0.75 * u, table.rowTop(K) + uy / 2, ease(fly));
          o = fly >= 0.98 ? 0 : 1;
          dark = true;
        } else { y = table.outTop() + 0.75 * u; v = 1; dark = true; }
        const txt = v.toFixed(3);
        if (sp.textContent !== txt) sp.textContent = txt;
        sp.classList.toggle('-dark', dark);
        sp.classList.toggle('-zero', v <= 0);
        sp.style.transform = `translate(${xr}px, ${oy + y}px) translate(-100%, -50%)`;
        sp.style.opacity = String(o);
      });
    }

    // the agent: an outlined cell that enters from outside the table and settles on the firm's diagonal
    const cellX = ox + table.colX[K] * u, cellY = oy + table.rowTop(K);
    const agA = agentIn > 0 ? nA : 0;
    agent.style.width = `${table.colW[K] * u}px`;
    agent.style.height = `${uy}px`;
    set(agent, lerp(mobile ? -table.colW[K] * u - 4 : ox - table.colW[K] * u - 40, cellX, ease(agentIn)), cellY, '', agA);

    // the diagonal's label
    const cA = nA * clamp((t - 1.2) / 0.3);
    chip.style.opacity = String(cA);
    if (cA > 0.001) {
      const eIn = table.eIn[K] > 0, pIn = table.pIn[K] > 0;
      const txt = mobile
        ? (eIn && pIn ? 'Diag. + exec.<br>+ plans' : eIn ? 'Diag. + exec.' : 'Diag.')
        : (eIn && pIn ? 'Diagonal + execution + plans' : eIn ? 'Diagonal + execution' : 'Diagonal');
      if (chip.innerHTML !== txt) chip.innerHTML = txt;
      chip.classList.toggle('-in', eIn);
      const cw = chip.offsetWidth;
      const x = Math.min(cellX + table.colW[K] * u + 8, W - 16 - cw);
      chip.style.transform = `translate(${x}px, ${cellY + uy / 2}px) translateY(-50%)`;
    }

    const si = stateOf(t);
    if (si !== lastState) {
      lastState = si;
      caps.forEach((c, i) => c.classList.toggle('-on', i === si));
      railBtns.forEach((b, i) => b.classList.toggle('-on', i === si));
      hero.classList.toggle('-off', si >= 0);
      cue.classList.toggle('-off', si >= 0);
      if (si > 0) { table.hover = null; tip.classList.remove('-on'); }
    }
    coda.classList.toggle('-on', t >= 6.0);
    if (t >= 6.0) {
      coda.style.setProperty('--codaY', `${capTop - 44}px`);
      if (document.activeElement !== trange) trange.value = String(tH);
      tout.textContent = `t = ${tH.toFixed(2)}`;
    }
  };

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) dirty = true; }).observe(root);
  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', () => { layout(); readScroll(); });
  layout(); readScroll();
  document.fonts?.ready.then(() => { layout(); dirty = true; });
  stage.classList.add('-ready');
  requestAnimationFrame(frame);
}
