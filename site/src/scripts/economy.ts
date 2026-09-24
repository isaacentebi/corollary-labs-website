// Figure 4 — an economy drawn as one diagram of firms. Scroll moves time t ∈ [0, 1] forward.
// One firm changes type at t ≈ 0.08; each wire joined to a changed firm is dashed (undefined) for a short interval
// and then rejoined — to the same firm at a new port, to another firm in the same column, or not at all.
// A firm at the other end of a rejoined wire may change in turn. Deterministic (seeded), so every visit is the same.
import { wirePath } from './diagram';

const NS = 'http://www.w3.org/2000/svg';
interface Firm { id: number; col: number; row: number; x: number; y: number; h: number; h2: number; tau: number; el?: SVGRectElement }
interface Edge { a: number; b: number; ya: number; yb: number; kind: 'keep' | 'move' | 'drop'; b2: number; yb2: number; ya2: number; el?: SVGPathElement; t0: number; isNew?: boolean; fa?: number; fb?: number; fb2?: number }

export function makeEconomy(svg: SVGSVGElement, opts: { cols: number; rows: number; W: number; H: number }) {
  const { cols, rows, W, H } = opts;
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const padX = 70, padY = 40;
  const cw = (W - 2 * padX) / (cols - 1), rh = (H - 2 * padY) / (rows - 1);
  const firms: Firm[] = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    if (rnd() < 0.12 && c > 0 && c < cols - 1) continue;
    const h = 22 + rnd() * 30;
    firms.push({ id: firms.length, col: c, row: r, x: padX + c * cw + (rnd() - 0.5) * cw * 0.3, y: padY + r * rh + (rnd() - 0.5) * rh * 0.35, h, h2: h, tau: Infinity });
  }
  const byCol = (c: number) => firms.filter((f) => f.col === c);
  const edges: Edge[] = [];
  const port = (f: Firm, k: number, n: number) => f.y - f.h / 2 + ((k + 1) / (n + 1)) * f.h;
  for (let c = 0; c < cols - 1; c++) {
    const A = byCol(c), B = byCol(c + 1);
    const pairs: [Firm, Firm][] = [];
    for (const a of A) {
      const near = [...B].sort((p, q) => Math.abs(p.y - a.y) - Math.abs(q.y - a.y));
      const n = 1 + (rnd() < 0.55 ? 1 : 0);
      for (let k = 0; k < n; k++) pairs.push([a, near[Math.min(near.length - 1, k + (rnd() < 0.3 ? 1 : 0))]]);
    }
    for (const b of B) if (!pairs.some((p) => p[1] === b)) pairs.push([[...A].sort((p, q) => Math.abs(p.y - b.y) - Math.abs(q.y - b.y))[0], b]);
    // de-duplicate and assign ordered ports so wires between two columns never cross at their ends
    const uniq = pairs.filter((p, i) => pairs.findIndex((q) => q[0] === p[0] && q[1] === p[1]) === i);
    for (const [a, b] of uniq) edges.push({ a: a.id, b: b.id, ya: 0, yb: 0, kind: 'keep', b2: b.id, yb2: 0, ya2: 0, t0: Infinity });
  }
  const layoutPorts = () => {
    for (const f of firms) {
      const outs = edges.filter((e) => e.a === f.id).sort((p, q) => firms[p.b].y - firms[q.b].y);
      // ports are stored as fractions of the box height, so wires stay attached when a box changes height
      outs.forEach((e, k) => { e.ya = port(f, k, outs.length); e.fa = (k + 1) / (outs.length + 1) - 0.5; });
      const ins = edges.filter((e) => e.b === f.id).sort((p, q) => firms[p.a].y - firms[q.a].y);
      ins.forEach((e, k) => { e.yb = port(f, k, ins.length); e.fb = (k + 1) / (ins.length + 1) - 0.5; });
    }
  };
  layoutPorts();

  // spread of the change: breadth-first over the undirected graph from one firm near the middle
  const start = firms.reduce((best, f) => (Math.hypot(f.col - 2, f.row - (rows - 1) / 2) < Math.hypot(best.col - 2, best.row - (rows - 1) / 2) ? f : best), firms[0]);
  const dist = new Map<number, number>([[start.id, 0]]);
  const q = [start.id];
  while (q.length) {
    const u = q.shift()!;
    for (const e of edges) {
      const v = e.a === u ? e.b : e.b === u ? e.a : -1;
      if (v >= 0 && !dist.has(v)) { dist.set(v, dist.get(u)! + 1); q.push(v); }
    }
  }
  for (const f of firms) {
    const d = dist.get(f.id) ?? 99;
    if (d === 0) f.tau = 0.08;
    else if (d <= 6 && rnd() < 0.9 - d * 0.1) f.tau = 0.07 + d * 0.085 + rnd() * 0.07;
    if (f.tau < 1) f.h2 = Math.max(18, f.h + (rnd() - 0.4) * 26);
  }
  for (const e of edges) {
    const t = Math.min(firms[e.a].tau, firms[e.b].tau);
    if (t < 1) {
      e.t0 = t;
      const r = rnd();
      e.kind = r < 0.5 ? 'keep' : r < 0.82 ? 'move' : 'drop';
      if (e.kind === 'move') {
        const others = byCol(firms[e.b].col).filter((f) => f.id !== e.b);
        const alt = others.sort((p, q2) => Math.abs(p.y - firms[e.b].y) - Math.abs(q2.y - firms[e.b].y))[Math.floor(rnd() * 2)];
        if (alt) { e.b2 = alt.id; e.fb2 = (rnd() - 0.5) * 0.6; } else e.kind = 'keep';
      }
      if (e.kind === 'keep') { e.b2 = e.b; e.fb2 = e.fb; }
    }
  }
  // a firm that loses or gains an input wire changes type too, when that wire is rejoined
  for (const e of edges) if (e.t0 < 1 && e.kind !== 'keep') {
    const at = e.t0 + 0.07;
    firms[e.b].tau = Math.min(firms[e.b].tau, at);
    if (e.kind === 'move') firms[e.b2].tau = Math.min(firms[e.b2].tau, at);
  }
  for (const f of firms) if (f.tau < 1 && f.h2 === f.h) f.h2 = Math.max(18, f.h + (rnd() - 0.4) * 26);
  // new wires: changed firms take up new connections
  for (const f of firms) if (f.tau < 1 && f.col < cols - 1 && rnd() < 0.55) {
    // a new wire goes only to a firm that has changed type (so every composite is defined at the end)
    const B = byCol(f.col + 1).filter((b) => b.tau < 1); if (!B.length) continue;
    const b = B[Math.floor(rnd() * B.length)];
    const fb = (rnd() - 0.5) * 0.5;
    edges.push({ a: f.id, b: b.id, ya: 0, yb: 0, kind: 'keep', b2: b.id, yb2: 0, ya2: 0, t0: Math.max(f.tau, b.tau) + 0.08, isNew: true, fa: (rnd() - 0.5) * 0.5, fb, fb2: fb });
  }

  // edge wires at the left and right of the economy
  const rim: { y: number; x1: number; x2: number }[] = [];
  for (const f of byCol(0)) rim.push({ x1: 0, x2: f.x - 7, y: f.y });
  for (const f of byCol(cols - 1)) rim.push({ x1: f.x + 7, x2: W, y: f.y });

  const gW = document.createElementNS(NS, 'g'), gB = document.createElementNS(NS, 'g');
  gW.setAttribute('class', 'eco-wires'); gB.setAttribute('class', 'eco-boxes');
  svg.append(gW, gB);
  for (const r of rim) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', `M${r.x1} ${r.y} L${r.x2} ${r.y}`); p.setAttribute('class', 'eco-w'); gW.append(p); }
  for (const e of edges) { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', 'eco-w'); p.setAttribute('pathLength', '1000'); gW.append(p); e.el = p; }
  for (const f of firms) { const r = document.createElementNS(NS, 'rect'); r.setAttribute('class', 'eco-b'); r.setAttribute('width', '14'); gB.append(r); f.el = r; }

  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const ease = (v: number) => v * v * (3 - 2 * v);
  const UNDEF = 0.07, MOVE = 0.09;

  return {
    changedCount: (t: number) => firms.filter((f) => f.tau <= t).length,
    total: firms.length,
    render(t: number) {
      const hAt = (f: Firm) => f.h + (f.h2 - f.h) * ease(clamp((t - f.tau) / 0.06));
      for (const f of firms) {
        const h = hAt(f);
        f.el!.setAttribute('x', `${f.x - 7}`); f.el!.setAttribute('y', `${f.y - h / 2}`); f.el!.setAttribute('height', `${h}`);
        f.el!.classList.toggle('-on', t >= f.tau);
      }
      for (const e of edges) {
        const A = firms[e.a];
        const u = t - e.t0;
        const B = firms[e.b], B2 = firms[e.b2];
        let yb = B.y + (e.fb ?? 0) * hAt(B), bx = B.x - 7, o = 1, cls = '', draw = 1;
        if (e.isNew) {
          draw = clamp(u / 0.1); cls = '-new';
          if (u < 0) o = 0;
        } else if (u >= 0) {
          if (u < UNDEF) cls = '-undef';
          else {
            const m = ease(clamp((u - UNDEF) / MOVE));
            cls = '-re';
            if (e.kind === 'move') { const y2 = B2.y + (e.fb2 ?? 0) * hAt(B2); yb = yb + (y2 - yb) * m; bx = B.x - 7 + (B2.x - B.x) * m; }
            if (e.kind === 'drop') { o = 1 - m; cls = '-undef'; }
          }
        }
        const ya = A.y + (e.fa ?? 0) * hAt(A);
        e.el!.setAttribute('d', wirePath({ x1: A.x + 7, y1: ya, x2: bx, y2: yb, bend: 0.5, loop: 0 }));
        e.el!.setAttribute('class', `eco-w ${cls}`);
        e.el!.style.opacity = `${o}`;
        if (draw < 1) e.el!.setAttribute('stroke-dasharray', `${draw * 1000} 1000`);
        else if (cls !== '-undef') e.el!.removeAttribute('stroke-dasharray');
        else e.el!.setAttribute('stroke-dasharray', '4 4');
      }
    },
  };
}
