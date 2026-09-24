// Build-time SVG "slides" for the essays: each essay gets a small specimen, seeded by its slug.
// Three kinds, cycling: a firm with an agent drawn inside it, a tissue part-way through a change, a mesh.
import { Delaunay } from 'd3-delaunay';
import { rng, hash, blob, stipple } from './blob';

const f = (n: number) => n.toFixed(1);

export function slideSVG(slug: string, kind: number): string {
  const seed = hash(slug); const R = rng(seed);
  let body = '';
  if (kind === 0) {
    // one firm: double wall, stippled coordination, steps, one agent inside, inputs outside
    body += `<path class="s-wash" d="${blob(seed, 100, 100, 70, 0.07)}"/>`;
    body += `<path class="s-wall" d="${blob(seed, 100, 100, 70, 0.07)}"/><path class="s-wall2" d="${blob(seed, 100, 100, 66, 0.07)}"/>`;
    body += `<g class="s-dot">${stipple(seed + 1, 96, 74, 15, 70, 0.8)}</g>`;
    body += `<path class="s-wall2" d="${blob(seed + 2, 96, 74, 18, 0.05)}"/>`;
    [[70, 112], [132, 110]].forEach(([x, y], i) => { body += `<path class="s-cell" d="${blob(seed + 5 + i, x, y, 10, 0.08)}"/><g class="s-dot">${stipple(seed + 9 + i, x, y, 4, 12, 0.7)}</g>`; });
    body += `<g class="s-agent" transform="translate(101 116) rotate(-8)"><ellipse rx="10" ry="5.2"/><path d="M-7 -2.5 L-5 2.5 L-3 -2.5 L-1 2.5 L1 -2.5 L3 2.5 L5 -2.5 L7 2.5"/></g>`;
    for (let i = 0; i < 9; i++) body += `<circle class="s-in" cx="${f(10 + R() * 22)}" cy="${f(92 + R() * 22)}" r="2.2"/>`;
    for (let i = 0; i < 4; i++) body += `<circle class="s-out" cx="${f(176 + R() * 14)}" cy="${f(88 + R() * 24)}" r="3.6"/>`;
  } else if (kind === 1) {
    // a tissue, part stained
    const pts: [number, number][] = [];
    for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) pts.push([i * 25 + (j % 2) * 12.5 + (R() - 0.5) * 12, j * 22 + (R() - 0.5) * 10]);
    const vor = Delaunay.from(pts).voronoi([-20, -20, 220, 220]);
    const cx = 60 + R() * 40, cy = 70 + R() * 40;
    pts.forEach((p, i) => {
      const poly = vor.cellPolygon(i); if (!poly) return; poly.pop();
      let mx = 0, my = 0; poly.forEach(([x, y]) => { mx += x; my += y; }); mx /= poly.length; my /= poly.length;
      const ins = (k: number) => poly.map(([x, y]) => [mx + (x - mx) * k, my + (y - my) * k]);
      const d = (k: number) => { const q = ins(k); const n = q.length; let s = ''; const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const m0 = mid(q[n - 1], q[0]); s += `M${f(m0[0])} ${f(m0[1])}`; for (let a = 0; a < n; a++) { const m = mid(q[a], q[(a + 1) % n]); s += ` Q${f(q[a][0])} ${f(q[a][1])} ${f(m[0])} ${f(m[1])}`; } return s + 'Z'; };
      const on = Math.hypot(mx - cx, my - cy) + R() * 30 < 70;
      body += `<path class="${on ? 's-cell s-on' : 's-cell'}" d="${d(0.88)}"/><path class="s-wall2" d="${d(0.8)}"/>`;
      body += `<g class="${on ? 's-dot s-on' : 's-dot'}">${stipple(seed + i, mx, my, on ? 5 : 3, on ? 8 : 6, 0.7)}</g>`;
    });
  } else {
    // a mesh: coordination spread across many steps
    const nodes: [number, number][] = [];
    for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 72; nodes.push([100 + Math.cos(a) * d, 100 + Math.sin(a) * d]); }
    nodes.forEach((p, i) => {
      const near = nodes.map((q, j) => [Math.hypot(q[0] - p[0], q[1] - p[1]), j]).sort((a, b) => a[0] - b[0]).slice(1, 3);
      near.forEach(([, j]) => { if (j < i) return; const q = nodes[j]; const mx = (p[0] + q[0]) / 2 + (R() - 0.5) * 16, my = (p[1] + q[1]) / 2 + (R() - 0.5) * 16; body += `<path class="s-tube" style="stroke-width:${f(0.8 + R() * 2.2)}" d="M${f(p[0])} ${f(p[1])} Q${f(mx)} ${f(my)} ${f(q[0])} ${f(q[1])}"/>`; });
    });
    nodes.forEach(([x, y], i) => { body += i % 4 === 0 ? `<g class="s-agent" transform="translate(${f(x)} ${f(y)}) rotate(${f(R() * 180)})"><ellipse rx="6.5" ry="3.4"/></g>` : `<circle class="s-node" cx="${f(x)}" cy="${f(y)}" r="${f(1.6 + R() * 1.6)}"/>`; });
  }
  return `<defs><clipPath id="clip-${slug}"><circle cx="100" cy="100" r="96"/></clipPath></defs><circle class="s-ground" cx="100" cy="100" r="96"/><g clip-path="url(#clip-${slug})"><g class="s-spin">${body}</g></g><circle class="s-ring" cx="100" cy="100" r="96"/><circle class="s-ring2" cx="100" cy="100" r="99.5"/>`;
}
