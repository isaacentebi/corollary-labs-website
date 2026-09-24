// Figure 0 — the title plate: one large string diagram across the viewport.
// Generation: wires enter at the left; at each of a series of columns, runs of adjacent wires either pass through
// or enter a box that emits one to three wires. Every wire runs left to right (a progressive diagram).
// Motion: every point is moved by a vertical map y ↦ φ(x, y), continuous in x and strictly increasing in y for each
// x, so the order of wires and boxes along every vertical line is preserved: (x, y) ↦ (x, φ(x, y)) is a
// homeomorphism of the plane, the deformation is a planar isotopy, and no wire is ever cut, joined or crossed.
// φ is a composite of increasing maps: (1) obstacles — the logo, caption and name push the wires out of their way
// (a linear compression of the wires away from the text, tapered to the identity on either side), (2) a slow drift,
// (3) the pointer lens.

interface Box { x: number; y0: number; y1: number; ins: number[]; outs: number[]; open: boolean }
interface Seg { x0: number; y0: number; x1: number; y1: number }

export interface Obstacle { el: HTMLElement; dir: 'down' | 'up' }
export function initField(canvas: HTMLCanvasElement, opts: { reduced: boolean; obstacles: Obstacle[] }) {
  const ctx = canvas.getContext('2d')!;
  let W = 0, H = 0, dpr = 1;
  let boxes: Box[] = [], segs: Seg[] = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  function build() {
    seed = 7;
    boxes = []; segs = [];
    const mobile = W < 700;
    const n0 = mobile ? 24 : Math.round(Math.min(40, Math.max(24, H / 24)));
    const top = H * 0.05, bot = H * 0.95;
    let ys = Array.from({ length: n0 }, (_, i) => top + ((i + 0.5) / n0) * (bot - top) + (rnd() - 0.5) * 6);
    const colW = mobile ? 58 : Math.max(96, W / 13);
    const bw = mobile ? 9 : 14;
    let x = -colW * 0.4;
    let xs = ys.map(() => x);
    while (x < W + colW) {
      x += colW * (0.85 + rnd() * 0.4);
      const nys: number[] = [], nxs: number[] = [];
      let i = 0;
      const n = ys.length;
      while (i < n) {
        const kk = Math.min(n - i, 1 + Math.floor(rnd() * 3));
        if (rnd() < 0.3 && n > 3) {
          const k = kk;
          // the box owns the band between the midpoints to its neighbours, so no wire can cross it
          const lo = i > 0 ? (ys[i - 1] + ys[i]) / 2 : ys[i] - 14;
          const hi = i + k < n ? (ys[i + k - 1] + ys[i + k]) / 2 : ys[i + k - 1] + 14;
          const band = hi - lo;
          let m = Math.max(1, Math.min(3, k + (n > n0 * 1.12 ? -1 : n < n0 * 0.88 ? 1 : Math.round((rnd() - 0.5) * 2.2))));
          if (band / m < 12) m = Math.max(1, Math.floor(band / 12));
          // ports are packed into a compact box in the middle of the band; wires fan in and out within the band
          const pitch = Math.min(10, (band - 6) / Math.max(k, m));
          const cy = (lo + hi) / 2;
          const inY = Array.from({ length: k }, (_, j) => cy + (j - (k - 1) / 2) * pitch);
          const outP = Array.from({ length: m }, (_, j) => cy + (j - (m - 1) / 2) * pitch);
          const outY = Array.from({ length: m }, (_, j) => lo + ((band) * (j + 0.5)) / m);
          const y0 = Math.min(inY[0], outP[0]) - pitch * 0.7, y1 = Math.max(inY[k - 1], outP[m - 1]) + pitch * 0.7;
          boxes.push({ x, y0, y1, ins: inY, outs: outP, open: rnd() < 0.2 });
          const fan = colW * 0.3;
          for (let j = 0; j < k; j++) {
            const xa = x - bw / 2 - fan;
            if (xa > xs[i + j] + 1) segs.push({ x0: xs[i + j], y0: ys[i + j], x1: xa, y1: ys[i + j] });
            segs.push({ x0: Math.max(xa, xs[i + j]), y0: ys[i + j], x1: x - bw / 2, y1: inY[j] });
          }
          for (let j = 0; j < m; j++) {
            segs.push({ x0: x + bw / 2, y0: outP[j], x1: x + bw / 2 + fan, y1: outY[j] });
            nys.push(outY[j]); nxs.push(x + bw / 2 + fan);
          }
          i += k;
        } else { nys.push(ys[i]); nxs.push(xs[i]); i++; }
      }
      ys = nys; xs = nxs;
    }
    ys.forEach((y, j) => segs.push({ x0: xs[j], y0: y, x1: W + 40, y1: y }));
  }

  // vertical isotopy φ(x, y): ambient drift + pointer lens. ∂φ/∂y > 0 everywhere (see comments).
  let t = 0;
  const ptr = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, a: 0, ta: 0 };
  // obstacle rectangles in canvas coordinates, measured on resize
  let obs: { l: number; r: number; t: number; b: number; dir: 'down' | 'up'; m: number }[] = [];
  function measure() {
    const cr = canvas.getBoundingClientRect();
    const pad = W < 700 ? 12 : 20;
    obs = opts.obstacles.filter((o) => o.el.offsetParent !== null).map((o) => {
      const r = o.el.getBoundingClientRect();
      return { l: r.left - cr.left - pad, r: r.right - cr.left + pad, t: r.top - cr.top - pad, b: r.bottom - cr.top + pad, dir: o.dir, m: W < 700 ? 50 : 140 };
    }).sort((a, b) => (a.dir === b.dir ? 0 : a.dir === 'up' ? -1 : 1)); // bottom obstacles first, then top ones
  }
  const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  function phi(x: number, y: number) {
    // (1) obstacles. For a text block at the top ('down'), T maps [0, B] linearly onto [b, B]; for one at the bottom
    // ('up'), T maps [A, H] linearly onto [A, t]. Both are increasing, and so is y + w·(T(y) − y) for 0 ≤ w ≤ 1.
    for (const o of obs) {
      // an obstacle that touches the left or right edge of the plate keeps full strength out to that edge
      const openL = o.l < o.m, openR = o.r > W - o.m;
      const w = x < o.l ? (openL ? 1 : smooth(1 - (o.l - x) / o.m)) : x > o.r ? (openR ? 1 : smooth(1 - (x - o.r) / o.m)) : 1;
      if (w <= 0) continue;
      let T = y;
      if (o.dir === 'down') { const B = o.b + Math.max(140, o.b * 1.4); if (y < B) T = o.b + (y * (B - o.b)) / B; }
      else { const A = Math.max(0, o.t - Math.max(H * 0.28, (H - o.t) * 0.9)); if (y > A) T = A + ((y - A) * (o.t - A)) / (H - A); }
      y = y + w * (T - y);
    }
    // (2) drift: ∂/∂y = 1 + A·(π/H)·(…) ≥ 1 − Aπ/H > 0 for A < H/π
    const A = opts.reduced ? 0 : Math.min(14, H * 0.016);
    let d = A * Math.sin(x * 0.0042 + t * 0.35) * Math.sin((Math.PI * y) / H);
    // (3) lens: y + a·(y − cy)·g, g = exp(−(u² + v²)); ∂/∂y = 1 + a·g·(1 − 2u²) ≥ 1 − 0.45a > 0 for a < 2.2 (a ≤ 1.1 here)
    if (ptr.a > 0.001) {
      const sx = 190, sy = 150;
      const u = (y - ptr.y) / sy, v = (x - ptr.x) / sx;
      const g = Math.exp(-(u * u + v * v));
      d += ptr.a * 1.1 * (y - ptr.y) * g;
    }
    return y + d;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--ink').trim() || '#14120f';
    const blue = css.getPropertyValue('--blue').trim() || '#2438d6';
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for (const s of segs) {
      const y0 = phi(s.x0, s.y0), y1 = phi(s.x1, s.y1);
      const dx = s.x1 - s.x0;
      // sample the S-curve with the map applied along it (so the isotopy acts on the whole wire, not just its ends)
      const N = Math.max(6, Math.ceil(Math.abs(dx) / 6));
      ctx.moveTo(s.x0, y0);
      for (let k = 1; k <= N; k++) {
        const u = k / N, e = u * u * (3 - 2 * u);
        const x = s.x0 + dx * u, yy = s.y0 + (s.y1 - s.y0) * e;
        ctx.lineTo(x, phi(x, yy));
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // boxes are carried by the same map (their top and bottom edges), so every port stays on its wire
    for (const b of boxes) {
      const top = phi(b.x, b.y0), h = phi(b.x, b.y1) - top, ny = top + h / 2;
      const bw = W < 700 ? 9 : 14;
      const near = ptr.a > 0.01 ? Math.exp(-(((b.x - ptr.x) / 190) ** 2 + ((ny - ptr.y) / 150) ** 2)) * ptr.a : 0;
      if (b.open) {
        ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
        ctx.fillRect(b.x - bw / 2, ny - h / 2, bw, h);
        ctx.strokeStyle = near > 0.35 ? blue : ink; ctx.lineWidth = 1.2;
        ctx.strokeRect(b.x - bw / 2 + 0.6, ny - h / 2 + 0.6, bw - 1.2, h - 1.2);
      } else {
        ctx.fillStyle = near > 0.35 ? blue : ink;
        ctx.fillRect(b.x - bw / 2, ny - h / 2, bw, h);
      }
    }
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    measure(); build(); draw();
  }

  let raf = 0, visible = true, last = performance.now();
  function loop(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    t += dt;
    ptr.x += (ptr.tx - ptr.x) * 0.12; ptr.y += (ptr.ty - ptr.y) * 0.12; ptr.a += (ptr.ta - ptr.a) * 0.06;
    draw();
    raf = visible ? requestAnimationFrame(loop) : 0;
  }
  const start = () => { if (!raf && !opts.reduced) { last = performance.now(); raf = requestAnimationFrame(loop); } };

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ptr.tx = e.clientX - r.left; ptr.ty = e.clientY - r.top;
    if (ptr.a < 0.01) { ptr.x = ptr.tx; ptr.y = ptr.ty; }
    ptr.ta = 1;
    if (opts.reduced) { ptr.x = ptr.tx; ptr.y = ptr.ty; ptr.a = 1; draw(); }
  };
  const onLeave = () => { ptr.ta = 0; if (opts.reduced) { ptr.a = 0; draw(); } };
  const host = canvas.parentElement!;
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerdown', onMove);
  host.addEventListener('pointerleave', onLeave);
  host.addEventListener('pointercancel', onLeave);
  host.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') onLeave(); });
  document.fonts.ready.then(() => { measure(); draw(); });
  new ResizeObserver(() => resize()).observe(canvas);
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); }).observe(canvas);
  resize();
  start();
}
