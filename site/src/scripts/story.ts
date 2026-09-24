// Home story: one sticky stage, one scroll progress T in [0, TMAX], seven states of one table.
import { Table, type Params } from './table';
import { N, SLOTS, SUPPLIED } from './economy';

const TMAX = 7.2;
const START = [0.35, 1.0, 2.0, 3.0, 4.0, 5.3, 6.3];          // T at which each state's caption takes over
const HOLD = [0.85, 1.85, 2.85, 3.85, 5.2, 6.2, 7.1];          // a resting T inside each state (rail jumps, reduced motion)

const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const ease = (x: number) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const pad = (n: number) => String(n).padStart(2, '0');

export function initStory() {
  const root = document.querySelector<HTMLElement>('[data-story]');
  const stage = root?.querySelector<HTMLElement>('[data-stage]');
  const canvas = root?.querySelector<HTMLCanvasElement>('[data-gl]');
  if (!root || !stage || !canvas) return;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let table: Table;
  try { table = new Table(canvas); } catch { stage.classList.add('no-gl'); return; }
  const e = table.e;

  const $ = <T extends Element = HTMLElement>(s: string) => stage.querySelector(s) as unknown as T;
  const $$ = <T extends Element = HTMLElement>(s: string) => Array.from(stage.querySelectorAll(s)) as unknown as T[];
  const caps = $$('[data-cap]'), railBtns = $$<HTMLButtonElement>('[data-goto]');
  const hero = $('[data-hero]'), tip = $('[data-tip]'), cue = $('[data-cue]'), coda = $('[data-coda]');
  const labels = $('[data-labels]'), rule = $('[data-rule]');
  const axTop = $$('[data-ax-top]'), axLeft = $$('[data-ax-left]'), rowLab = $$('[data-row]');
  const trange = $<HTMLInputElement>('[data-trange]'), tout = $('[data-tout]');
  const numsHost = $('[data-nums]');
  const chip = $('[data-chip]');

  // numbers for the focus column: 32 firm rows + 3 supplied + output
  const nums: HTMLSpanElement[] = [];
  for (let k = 0; k < N + 4; k++) { const s = document.createElement('span'); numsHost.appendChild(s); nums.push(s); }
  const slotAtPos0: number[] = [];
  for (let s = 0; s < SLOTS; s++) if (e.alive0[s]) slotAtPos0[e.pos0[s]] = s;
  const K = e.K;
  nums.forEach((sp, k) => {
    const v = k < N ? e.A0[slotAtPos0[k] * SLOTS + K] : k < N + 3 ? e.L[(k - N) * SLOTS + K] : e.out0[K];
    sp.textContent = v > 0 ? v.toFixed(3) : '0';
    const lu = k < N ? (v <= 0.0001 ? 0.085 : 0.16 + 0.8 * Math.sqrt(v)) : k < N + 3 ? 0.16 + 0.8 * Math.sqrt(v * 0.8) : 0.2 + 0.78 * v;
    if (lu > 0.42) sp.classList.add('-dark');
    if (k < N && v <= 0) sp.classList.add('-zero');
  });

  let W = 0, H = 0, mobile = false;
  const layout = () => {
    W = stage.clientWidth; H = stage.clientHeight;
    mobile = W < 900;
    const head = 52;
    const box = mobile
      ? { x: 16 + 66, y: head + 30, w: W - 32 - 66, h: Math.min(H * 0.47, 520) }
      : { x: W * 0.4, y: head + 44, w: W * 0.6 - Math.max(16, Math.min(32, W * 0.022)), h: H - head - 44 - 68 };
    const L = Table.fit(W, H, box, mobile ? 0.15 : 0.5);
    table.resize(W, H, L);
    stage.style.setProperty('--u', `${L.u}px`);
    stage.style.setProperty('--ox', `${L.ox}px`);
    stage.style.setProperty('--oy', `${L.oy}px`);
    stage.style.setProperty('--tw', `${L.u * N}px`);
    stage.style.setProperty('--tb', `${L.oy + L.u * Table.rows.total}px`);
    dirty = true;
  };

  // ── scroll → T ──
  let T = 0;
  const readScroll = () => {
    const r = root.getBoundingClientRect();
    const span = r.height - innerHeight;
    const p = span > 0 ? clamp(-r.top / span) : 0;
    let t = p * TMAX;
    if (RM) { // no tweening: each state is shown in its resting form
      let i = -1; for (let k = 0; k < START.length; k++) if (t >= START[k]) i = k;
      t = i < 0 ? 0 : HOLD[i];
    }
    if (t !== T) { T = t; dirty = true; }
  };
  const stateOf = (t: number) => { let i = -1; for (let k = 0; k < START.length; k++) if (t >= START[k]) i = k; return i; };

  // ── coda: t loops unless the reader takes the slider ──
  let tc = 1, tUser: number | null = null, codaClock = 0, lastNow = performance.now();
  trange.addEventListener('input', () => { tUser = parseFloat(trange.value); dirty = true; });

  // ── pulse from a clicked column ──
  let pulseSlot = -1, pulseT = 0;
  const flash = table.flash;

  // ── hover / tap ──
  const pointer = (ev: PointerEvent, click = false) => {
    const rect = stage.getBoundingClientRect();
    const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
    const active = T < START[1] - 0.05;
    const cell = active ? table.cellAt(px, py) : null;
    const prev = table.hover;
    table.hover = cell;
    if ((prev?.r ?? -1) !== (cell?.r ?? -1) || (prev?.c ?? -1) !== (cell?.c ?? -1)) dirty = true;
    if (!cell) { tip.classList.remove('-on'); stage.style.cursor = ''; return; }
    stage.style.cursor = 'crosshair';
    const cs = slotAtPos0[cell.c];
    let txt: string;
    if (cell.r < N) {
      const rs = slotAtPos0[cell.r];
      const v = e.A0[rs * SLOTS + cs];
      txt = cell.r === cell.c
        ? `<b>${pad(cell.c + 1)} → ${pad(cell.c + 1)}</b> itself <i>${v.toFixed(3)}</i>`
        : `<b>${pad(cell.r + 1)} → ${pad(cell.c + 1)}</b> <i>${v > 0 ? v.toFixed(3) : '0'}</i>`;
    } else {
      const k = cell.r - N;
      txt = `<b>${SUPPLIED[k]} → ${pad(cell.c + 1)}</b> <i>${e.L[k * SLOTS + cs].toFixed(3)}</i>`;
    }
    tip.innerHTML = txt;
    const tw = tip.offsetWidth;
    const x = px + 16 + tw > W - 8 ? px - 16 - tw : px + 16;
    tip.style.transform = `translate(${x}px, ${py + 14}px)`;
    tip.classList.add('-on');
    if (click) { pulseSlot = cs; pulseT = 0; dirty = true; }
  };
  stage.addEventListener('pointermove', (ev) => { if (ev.pointerType === 'mouse') pointer(ev); });
  stage.addEventListener('pointerleave', () => { table.hover = null; tip.classList.remove('-on'); dirty = true; });
  stage.addEventListener('click', (ev) => {
    if ((ev.target as HTMLElement).closest('button, input, a')) return;
    pointer(ev as PointerEvent, true);
  });

  // ── rail ──
  railBtns.forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.goto!;
    const r = root.getBoundingClientRect();
    const top = scrollY + r.top + (HOLD[i] / TMAX) * (r.height - innerHeight);
    scrollTo({ top, behavior: RM ? 'auto' : 'smooth' });
  }));

  // ── frame ──
  let dirty = true, visible = true, lastState = -2;
  const params: Params = { focus: 0, eK: 0, pK: 0, reorg: 0, front: -2, lift: 0, spin: 0 };

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now;
    if (visible) {
      const inCoda = T >= 6.6;
      if (inCoda) {
        if (!RM && tUser === null) { codaClock += dt; dirty = true; }
        const target = tUser ?? (RM ? 1 : 0.5 + 0.5 * Math.cos(codaClock * 0.42));
        tc = target;
      } else if (tc !== 1) { tc += (1 - tc) * 0.12; if (Math.abs(1 - tc) < 0.002) tc = 1; codaClock = 0; tUser = null; dirty = true; }
      if (pulseSlot >= 0) {
        pulseT += dt;
        table.pulse(pulseSlot, RM ? 0 : pulseT, flash);
        if (pulseT > 2.6) { pulseSlot = -1; flash.fill(0); }
        dirty = true;
      }
      if (dirty) { dirty = false; draw(); }
    }
    requestAnimationFrame(frame);
  };

  const draw = () => {
    const t = T;
    const Fm = e.Fmax;
    params.focus = ease((t - 1.0) / 0.5) - ease((t - 4.0) / 0.3);
    params.eK = ease((t - 2.05) / 0.6);
    params.pK = ease((t - 3.05) / 0.6);
    params.reorg = clamp((t - 4.3) / 0.8);
    params.front = -1.5 + clamp((t - 5.35) / 0.85) * (Fm + 1.5);
    params.lift = clamp((t - 6.3) / 0.6);
    params.spin = RM ? 0 : 0.14 * Math.sin(codaClock * 0.23);
    if (t >= 6.3) {
      params.reorg = tc;
      params.front = tc * (Fm + 1.2) - 1.2;
      params.eK = 0; params.pK = 0;
    }
    table.render(params);

    // DOM: labels, numbers, captions
    const { u, ox, oy } = table.L;
    const flat = clamp(1 - params.lift * 3);
    const axA = (1 - params.focus) * (1 - clamp(params.reorg * 4)) * flat;
    axTop.forEach((el) => { const c = +el.dataset.axTop!; el.style.transform = `translate(${ox + (c + 0.5) * u}px, ${oy - 8}px) translate(-50%, -100%)`; el.style.opacity = String(axA); });
    axLeft.forEach((el) => { const r = +el.dataset.axLeft!; el.style.transform = `translate(${ox - 10}px, ${oy + (r + 0.5) * u}px) translate(-100%, -50%)`; el.style.opacity = String(axA); });
    rowLab.forEach((el) => {
      const k = +el.dataset.row!;
      const y = k < 3 ? Table.rows.sup + k : Table.rows.out;
      el.style.transform = `translate(${ox - 10}px, ${oy + (y + 0.5) * u}px) translate(-100%, -50%)`;
      el.style.opacity = String(flat * (k < 2 && params.focus > 0.5 ? 1 : 1));
    });
    rule.style.transform = `translate(${ox}px, ${oy + (N + 0.35) * u}px)`;
    rule.style.opacity = String(flat);
    labels.classList.toggle('-lifted', params.lift > 0.02);

    const nA = params.focus * (1 - params.reorg) * flat;
    numsHost.style.opacity = String(nA);
    if (nA > 0.001) {
      const xr = ox + (table.colX[K] + table.colW[K]) * u - Math.max(4, u * 0.35);
      nums.forEach((sp, k) => {
        let y: number, o = 1;
        if (k < N) y = k;
        else if (k < N + 3) {
          const kk = k - N; const ins = kk === 0 ? table.insE[K] : kk === 1 ? table.insP[K] : 0;
          y = Table.rows.sup + kk + (e.pos0[K] - Table.rows.sup - kk) * ease(ins);
          o = ins >= 0.999 ? 0 : 1;
        } else y = Table.rows.out;
        sp.style.transform = `translate(${xr}px, ${oy + (y + 0.5) * u}px) translate(-100%, -50%)`;
        if (k === e.pos0[K]) {
          const dv = e.A0[K * SLOTS + K] + 0.5 * (e.L[K] * ease(table.insE[K]) + e.L[SLOTS + K] * ease(table.insP[K]));
          const tx = dv.toFixed(3); if (sp.textContent !== tx) sp.textContent = tx;
          sp.classList.toggle('-dark', table.insE[K] > 0.97 || dv > 0.1);
        }
        sp.style.opacity = String(o);
      });
    }

    // the firm's own cell: named while the column is enlarged, then what it now contains
    const cA = nA * clamp((t - 1.2) / 0.3);
    chip.style.opacity = String(cA);
    if (cA > 0.001) {
      const eIn = table.insE[K] > 0.98, pIn = table.insP[K] > 0.98;
      const txt = eIn && pIn ? 'Diagonal + execution + plans' : eIn ? 'Diagonal + execution' : 'Diagonal';
      if (chip.textContent !== txt) chip.textContent = txt;
      chip.classList.toggle('-in', eIn);
      chip.style.transform = `translate(${ox + table.colX[K] * u - 8}px, ${oy + (e.pos0[K] + 0.5) * u}px) translate(-100%, -50%)`;
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
    coda.classList.toggle('-on', t >= 6.6);
    if (t >= 6.6) { trange.value = String(tc); tout.textContent = tc.toFixed(2); }
  };

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) dirty = true; }).observe(root);
  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', () => { layout(); readScroll(); });
  layout(); readScroll();
  stage.classList.add('-ready');
  requestAnimationFrame(frame);
}
