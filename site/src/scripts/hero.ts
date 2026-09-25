// Hero: the first table, flat and live. Hover reads any cell; a click traces the clicked firm's suppliers,
// round by round. Until the reader touches it, the table traces a few firms by itself, then rests.
// Frames are drawn only while something changes (no idle loop).
import { Table } from './table';
import { N } from './economy';

const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const pad = (n: number) => String(n).padStart(2, '0');

export function initHero() {
  const root = document.querySelector<HTMLElement>('[data-hero]');
  const stage = root?.querySelector<HTMLElement>('[data-hstage]');
  const canvas = stage?.querySelector<HTMLCanvasElement>('[data-gl]');
  const copy = root?.querySelector<HTMLElement>('[data-hcopy]');
  if (!root || !stage || !canvas || !copy) return;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let table: Table;
  try { table = new Table(canvas); } catch { root.classList.add('no-gl'); return; }
  const e = table.e;

  const $ = (s: string) => stage.querySelector(s) as HTMLElement;
  const $$ = (s: string) => Array.from(stage.querySelectorAll<HTMLElement>(s));
  const tip = $('[data-tip]'), title = $('[data-title]'), buyer = $('[data-buyer]'), supplier = $('[data-supplier]');
  const colIds = $$('[data-cl]'), rowIds = $$('[data-rl]');

  // on phones, number only every eighth firm
  for (let s = 0; s < N; s++) { const m = s % 8 === 0; colIds[s].classList.toggle('-m', m); rowIds[s].classList.toggle('-m', m); }

  const P = { focus: 0, eK: 0, pK: 0, vals: 0, rows: 0, cols: 0, front: -99, agent: 0, fold: 1, lift: 0, t: 1 };
  let W = 0, H = 0, u = 10, mobile = false;
  const layout = () => {
    W = stage.clientWidth; H = stage.clientHeight;
    mobile = innerWidth < 900;
    const head = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head')) || 52;
    const L = table.L;
    if (mobile) {
      // the table sits between the header and the copy
      const G = 40, top = head + 44;
      const room = copy.getBoundingClientRect().top - root.getBoundingClientRect().top - 24 - top;
      u = Math.max(5, Math.floor(Math.min((W - 32 - G) / N, room / N) * 4) / 4);
      L.ox = Math.round(16 + G + (W - 32 - G - N * u) / 2);
      L.oy = Math.round(top + Math.max(0, (room - N * u) / 2));
    } else {
      const right = Math.max(16, Math.min(32, W * 0.022));
      const bw = W * 0.5 - right, bh = H - head - 64 - 96;
      u = Math.floor(Math.min(bw / N, bh / N) * 4) / 4;
      L.ox = Math.round(W - right - N * u);
      L.oy = Math.round(head + 64 + (bh - N * u) / 2);
    }
    L.W = W; L.H = H; L.u = u; L.uy = u;
    table.resize(W, H);
    placeLabels();
    kick();
  };

  const set = (el: HTMLElement, x: number, y: number, tr: string) => { el.style.transform = `translate(${x}px, ${y}px) ${tr}`; };
  const placeLabels = () => {
    const { ox, oy } = table.L, tw = N * u;
    set(title, mobile ? 16 : ox, oy - (mobile ? 30 : 40), 'translateY(-50%)');
    set(buyer, ox + tw, oy - (mobile ? 30 : 40), 'translate(-100%, -50%)');
    set(supplier, mobile ? 24 : ox - 34, oy + (N * u) / 2, 'translate(-50%, -50%)');
    for (let s = 0; s < N; s++) {
      set(colIds[s], ox + (s + 0.5) * u, oy - (mobile ? 6 : 10), 'translate(-50%, -100%)');
      set(rowIds[s], ox - 6, oy + (s + 0.5) * u, 'translate(-100%, -50%)');
    }
  };

  // ── trace: suppliers first, then theirs ──
  let slot = -1, pt = 0, last = 0, raf = 0, auto = !RM, autoN = 0, autoTimer = 0, visible = true;
  const autoFirms = [e.K, 5, 26];
  const trace = (j: number) => { slot = j; pt = 0; kick(); };
  const scheduleAuto = (ms: number) => {
    clearTimeout(autoTimer);
    if (!auto || autoN >= autoFirms.length) return;
    autoTimer = window.setTimeout(() => { if (auto && visible) { trace(autoFirms[autoN++]); scheduleAuto(5200); } else scheduleAuto(1500); }, ms);
  };
  const stopAuto = () => { auto = false; clearTimeout(autoTimer); };

  const frame = (now: number) => {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
    let more = false;
    if (slot >= 0) {
      pt += dt;
      table.pulse(slot, RM ? 1.6 : pt);
      if (pt > 3 || (RM && pt > 1.5)) { slot = -1; table.flash.fill(0); } else more = true;
    }
    table.render(P);
    if (more) kick(); else last = 0;
  };
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }

  // ── hover / tap ──
  const pointer = (ev: PointerEvent | MouseEvent, click = false) => {
    const rect = stage.getBoundingClientRect();
    const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
    const cell = table.cellAt(px, py);
    const prev = table.hover;
    const hit = cell && cell.r < N ? cell : null;
    table.hover = hit;
    if ((prev?.r ?? -1) !== (hit?.r ?? -1) || (prev?.c ?? -1) !== (hit?.c ?? -1)) kick();
    if (!hit) { tip.classList.remove('-on'); stage.style.cursor = ''; return; }
    stopAuto();
    stage.style.cursor = 'crosshair';
    const v = e.A0[hit.r * N + hit.c];
    tip.innerHTML = `From ${pad(hit.r + 1)} to ${pad(hit.c + 1)}${hit.r === hit.c ? ' (itself)' : ''} · <b>${v.toFixed(3)}</b>`;
    const tw = tip.offsetWidth;
    const x = clamp(px + 16 + tw > W - 8 ? px - 16 - tw : px + 16, 8, W - 8 - tw);
    tip.style.transform = `translate(${x}px, ${py + 16}px)`;
    tip.classList.add('-on');
    if (click) trace(hit.c);
  };
  stage.addEventListener('pointermove', (ev) => { if (ev.pointerType === 'mouse') pointer(ev); });
  stage.addEventListener('pointerleave', () => { table.hover = null; tip.classList.remove('-on'); kick(); });
  stage.addEventListener('click', (ev) => pointer(ev, true));

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) kick(); }).observe(root);
  addEventListener('resize', layout);
  layout();
  document.fonts?.ready.then(layout);
  root.classList.add('-ready');
  scheduleAuto(900);
}
