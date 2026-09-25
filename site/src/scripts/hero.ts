/*
  The hero: the headline is the typographic object.
  S0  the headline is set on 12 columns (6 on phones), in balanced lines, width axis 100.
  S1  once, after load, a new column enters: the grid re-divides to 13 (7), every element keeps its
      column count, so the headline keeps its lines and gives up width on the width axis, the subline
      re-flows word by word, and the carmine column opens from a gutter and pours down beside the text.
  After that a visitor can take a piece of the column and set it between two words of the headline;
  that line is set again (narrower) around it. Clicking a piece gives it back.
  Everything is DOM; the only frames drawn are during the entry and short transitions.
*/

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const WT = 740;
const fvs = (wd: number) => `'wdth' ${wd.toFixed(2)}, 'wght' ${WT}`;

export function mountHero(root: HTMLElement) {
  const head = root.querySelector<HTMLElement>('[data-headline]')!;
  const colEl = root.querySelector<HTMLElement>('[data-col]')!;
  const slices = [...colEl.querySelectorAll<HTMLElement>('b')];
  const caret = root.querySelector<HTMLElement>('[data-caret]')!;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const text = head.textContent!.trim().replace(/\s+/g, ' ');
  const words = text.split(' ');

  let mobile = innerWidth < 820;
  let lines: HTMLElement[] = [];
  let wd1 = 100; // the width axis after the column has entered
  let entered = false;
  let taken = 0;

  const colsOf = () => (mobile ? 6 : 12);
  const A = () => (mobile ? 6 : 10); // the new track: right of the headline
  function tracks(e: number) {
    const n = colsOf(), a = A(), out: string[] = [];
    for (let i = 0; i <= n; i++) out.push(i === a ? `minmax(0, ${e.toFixed(4)}fr)` : 'minmax(0, 1fr)');
    return out.join(' ');
  }
  const setTracks = (e: number) => root.style.setProperty('--tracks', tracks(e));

  /* measuring: one hidden probe in the headline's own style */
  const probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre;';
  head.appendChild(probe);
  const widthAt = (s: string, wd: number) => { probe.style.fontVariationSettings = fvs(wd); probe.textContent = s; return probe.getBoundingClientRect().width; };

  /** balanced lines: the fewest lines greedy gives at the measure, then the narrowest measure that keeps that count */
  function breakLines(M: number, greedyOnly = false): string[][] {
    const wW = words.map((w) => widthAt(w, 100));
    const sp = widthAt('a a', 100) - widthAt('aa', 100);
    const greedy = (m: number) => {
      const out: string[][] = [[]]; let x = 0;
      words.forEach((w, i) => {
        const cur = out[out.length - 1];
        const add = (cur.length ? sp : 0) + wW[i];
        if (cur.length && x + add > m) { out.push([w]); x = wW[i]; } else { cur.push(w); x += add; }
      });
      return out;
    };
    if (greedyOnly) return greedy(M);
    const n = greedy(M).length;
    let lo = M * 0.6, hi = M;
    for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (greedy(m).length > n) lo = m; else hi = m; }
    return greedy(hi);
  }

  /** the headline's size: the largest at which some line count fills the measure and the block still fits the screen */
  function fit(M: number) {
    head.style.fontSize = '';
    const s0 = parseFloat(getComputedStyle(head).fontSize);
    const maxH = innerHeight * (mobile ? 0.4 : 0.5);
    const cap = mobile ? 60 : 150, floor = mobile ? 34 : 48;
    let best = 0, least = Infinity;
    for (let n = mobile ? 4 : 3; n <= (mobile ? 8 : 6); n++) {
      // the narrowest measure (at s0) that holds the headline in n lines
      let lo = 10, hi = M * 3;
      for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (breakLines(m, true).length > n) lo = m; else hi = m; }
      const size = Math.min(cap, (s0 * M * 0.985) / hi);
      least = Math.min(least, size);
      if (n * size * 0.98 <= maxH) best = Math.max(best, size);
    }
    if (!best) best = least;
    head.style.fontSize = Math.max(floor, best).toFixed(2) + 'px';
  }

  function measureOf(e: number) {
    // the headline's box width at a given entry state
    const G = parseFloat(getComputedStyle(root).getPropertyValue('--g')) || 20;
    const W = root.clientWidth, mx = parseFloat(getComputedStyle(root).paddingLeft) || 0;
    const n = colsOf();
    const trackW = (W - 2 * mx + G) / (n + e);
    return trackW * n - G - (mobile ? 0 : trackW * (n - 10));
  }

  function set() {
    mobile = innerWidth < 820;
    probe.remove();
    head.textContent = '';
    head.appendChild(probe);
    setTracks(entered ? 1 : 0);
    const M0 = measureOf(0), M1 = measureOf(1);
    fit(M0);
    const ls = breakLines(M0);
    const frag = document.createDocumentFragment();
    lines = ls.map((ws, i) => {
      const L = document.createElement('span');
      L.className = 'hl-line';
      ws.forEach((w, k) => {
        const s = document.createElement('span'); s.className = 'hl-w'; s.textContent = w;
        L.appendChild(s);
        if (k < ws.length - 1) L.appendChild(document.createTextNode(' '));
      });
      if (i < ls.length - 1) L.appendChild(document.createTextNode(' '));
      frag.appendChild(L);
      return L;
    });
    head.insertBefore(frag, probe);
    // S1: the widest line keeps its share of the (narrower) measure
    const widest = Math.max(...ls.map((ws) => widthAt(ws.join(' '), 100)));
    const goal = widest * (M1 / M0);
    let lo = 62, hi = 100;
    for (let k = 0; k < 16; k++) { const m = (lo + hi) / 2; if (Math.max(...ls.map((ws) => widthAt(ws.join(' '), m))) > goal) hi = m; else lo = m; }
    wd1 = lo;
    lines.forEach((L) => (L.style.fontVariationSettings = fvs(entered ? wd1 : 100)));
    taken = 0;
    slices.forEach((s) => s.classList.remove('is-out'));
    head.classList.add('is-set');
  }

  /* ---------- the entry: plays once ---------- */
  function entry() {
    if (REDUCED) { finish(); return; }
    const T = 1700, t0 = performance.now();
    root.classList.add('is-entering');
    const step = (now: number) => {
      const t = clamp((now - t0) / T);
      const e = ease(clamp(t / 0.62));
      setTracks(e);
      const wd = lerp(100, wd1, e);
      lines.forEach((L) => (L.style.fontVariationSettings = fvs(wd)));
      colEl.style.setProperty('--pour', String(ease(clamp((t - 0.3) / 0.62))));
      root.style.setProperty('--newA', String(Math.sin(Math.PI * clamp(t / 0.8))));
      if (t < 1) requestAnimationFrame(step); else finish();
    };
    requestAnimationFrame(step);
  }
  function finish() {
    entered = true;
    setTracks(1);
    lines.forEach((L) => (L.style.fontVariationSettings = fvs(wd1)));
    colEl.style.setProperty('--pour', '1');
    root.style.setProperty('--newA', '0');
    root.classList.remove('is-entering');
    root.classList.add('is-entered');
  }

  /* ---------- a piece of the column, set between two words ---------- */
  type Gap = { line: HTMLElement; after: HTMLElement; x: number; top: number; h: number } | null;
  function gapAt(cx: number, cy: number): Gap {
    if (!entered || taken >= slices.length) return null;
    const hr = root.getBoundingClientRect();
    for (const L of lines) {
      const r = L.getBoundingClientRect();
      if (cy < r.top || cy > r.bottom) continue;
      const ws = [...L.querySelectorAll<HTMLElement>('.hl-w')];
      let best: Gap = null, bd = 1e9;
      for (let k = 0; k < ws.length - 1; k++) {
        const a = ws[k].getBoundingClientRect(), b = ws[k + 1].getBoundingClientRect();
        if (ws[k].nextElementSibling?.classList.contains('hl-m')) continue;
        const x = (a.right + b.left) / 2, d = Math.abs(cx - x);
        if (d < bd) { bd = d; best = { line: L, after: ws[k], x: x - hr.left, top: r.top - hr.top, h: r.height }; }
      }
      return best && bd < 60 ? best : null;
    }
    return null;
  }
  /** re-solve one line's width axis so it holds its measure around the pieces it carries */
  function reset(L: HTMLElement) {
    const n = L.querySelectorAll('.hl-m:not(.is-leaving)').length;
    const str = [...L.querySelectorAll('.hl-w')].map((w) => w.textContent).join(' ');
    const size = parseFloat(getComputedStyle(head).fontSize);
    const piece = n * size * (0.42 + 0.17); // module + its spacing
    const goal = widthAt(str, wd1);
    let lo = 62, hi = wd1;
    for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (widthAt(str, m) + piece > goal) hi = m; else lo = m; }
    L.style.fontVariationSettings = fvs(n ? lo : wd1);
  }
  function take(g: NonNullable<Gap>) {
    const slice = slices[slices.length - 1 - taken];
    taken++;
    const m = document.createElement('i');
    m.className = 'hl-m'; m.setAttribute('aria-hidden', 'true');
    g.after.after(m);
    reset(g.line);
    if (!REDUCED) {
      // the piece travels from the column into the gap it opened
      const sr = slice.getBoundingClientRect();
      requestAnimationFrame(() => {
        const mr = m.getBoundingClientRect();
        const fly = document.createElement('i');
        fly.className = 'hl-fly'; fly.setAttribute('aria-hidden', 'true');
        document.body.appendChild(fly);
        const target = { x: mr.left + scrollX, y: mr.top + scrollY };
        const size = parseFloat(getComputedStyle(head).fontSize);
        const tw = size * 0.42, th = mr.height;
        fly.animate([
          { transform: `translate(${sr.left + scrollX}px, ${sr.top + scrollY}px)`, width: sr.width + 'px', height: sr.height + 'px' },
          { transform: `translate(${sr.left + scrollX + (sr.width - tw) / 2}px, ${sr.top + scrollY}px)`, width: tw + 'px', height: th + 'px', offset: 0.3 },
          { transform: `translate(${target.x}px, ${target.y}px)`, width: tw + 'px', height: th + 'px' },
        ], { duration: 720, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }).finished.then(() => { fly.remove(); m.classList.add('is-in'); });
      });
    } else m.classList.add('is-in');
    slice.classList.add('is-out');
  }
  function give(m: HTMLElement) {
    const L = m.closest<HTMLElement>('.hl-line')!;
    taken = Math.max(0, taken - 1);
    slices[slices.length - 1 - taken].classList.remove('is-out');
    m.classList.add('is-leaving'); m.classList.remove('is-in');
    reset(L);
    setTimeout(() => m.remove(), REDUCED ? 0 : 500);
  }

  let hover: Gap = null;
  head.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const onPiece = (e.target as HTMLElement).classList.contains('hl-m');
    hover = onPiece ? null : gapAt(e.clientX, e.clientY);
    head.style.cursor = hover || onPiece ? 'pointer' : '';
    if (hover) {
      caret.style.transform = `translate(${(hover.x - 1).toFixed(1)}px, ${(hover.top + hover.h * 0.14).toFixed(1)}px)`;
      caret.style.height = (hover.h * 0.72).toFixed(1) + 'px';
      caret.classList.add('is-on');
    } else caret.classList.remove('is-on');
  });
  head.addEventListener('pointerleave', () => { hover = null; caret.classList.remove('is-on'); });
  head.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.classList.contains('hl-m')) { give(t); return; }
    const g = gapAt(e.clientX, e.clientY);
    if (g) { take(g); caret.classList.remove('is-on'); }
  });

  let lastW = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === lastW) return;
    lastW = innerWidth;
    root.querySelectorAll('.hl-m').forEach((m) => m.remove());
    set();
  });

  set();
  root.classList.add('is-live');
  setTimeout(entry, REDUCED ? 0 : 650);
}
