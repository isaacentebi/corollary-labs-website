// Build-time SVG "slides" for the essays: each essay gets a small specimen, seeded by its slug, drawn in the
// same vocabulary as the home page (hairline double walls, a ring for coordination, people, ochre seeds for agents).
// Three kinds, cycling: a firm with an agent inside it, a tissue part-way through a change, a mesh.
import { Delaunay } from 'd3-delaunay';
import { rng, hash, blob } from './blob';

const f = (n: number) => n.toFixed(1);
const person = (x: number, y: number, s = 1) =>
  `<g class="s-person" transform="translate(${f(x)} ${f(y)}) scale(${s})"><path d="M-7 7 A7 6 0 0 1 7 7 Z"/><circle cx="0" cy="-2.5" r="3.4"/></g>`;
const seed = (x: number, y: number, r = 4) => `<circle class="s-halo" cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.7)}"/><circle class="s-seed" cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`;

export function slideSVG(slug: string, kind: number): string {
  const sd = hash(slug); const R = rng(sd);
  let body = '';
  if (kind === 0) {
    // one firm: double wall, coordination ring, plans to three steps, an agent at the middle step, inputs and outputs
    body += `<path class="s-wash" d="${blob(sd, 100, 100, 68, 0.06)}"/>`;
    body += `<path class="s-wall" d="${blob(sd, 100, 100, 68, 0.06)}"/><path class="s-wall2" d="${blob(sd, 100, 100, 64.5, 0.06)}"/>`;
    body += `<circle class="s-ring" cx="98" cy="70" r="13"/><circle class="s-ring2" cx="98" cy="70" r="10.5"/>`;
    body += `<path class="s-strand" d="M98 83 Q84 96 68 104 M98 83 Q116 96 132 104"/><path class="s-strand -gone" d="M98 83 L100 102"/>`;
    body += person(68, 112) + person(132, 112) + seed(100, 112, 4.5);
    for (let i = 0; i < 8; i++) body += `<circle class="s-in" cx="${f(8 + R() * 22)}" cy="${f(100 + (R() - 0.5) * 18)}" r="2.2"/>`;
    for (let i = 0; i < 4; i++) body += `<circle class="s-out" cx="${f(176 + R() * 16)}" cy="${f(104 + (R() - 0.5) * 18)}" r="3.4"/>`;
  } else if (kind === 1) {
    // a tissue, part reorganised: rings in the old firms, meshes and seeds in the new
    const pts: [number, number][] = [];
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) pts.push([i * 29 + (j % 2) * 14.5 + (R() - 0.5) * 12 - 6, j * 26 + (R() - 0.5) * 10 - 4]);
    const vor = Delaunay.from(pts).voronoi([-20, -20, 220, 220]);
    const cx = 70 + R() * 30, cy = 80 + R() * 30;
    pts.forEach((_, i) => {
      const poly = vor.cellPolygon(i); if (!poly) return; poly.pop();
      let mx = 0, my = 0; poly.forEach(([x, y]) => { mx += x; my += y; }); mx /= poly.length; my /= poly.length;
      const d = (k: number) => { const q = poly.map(([x, y]) => [mx + (x - mx) * k, my + (y - my) * k]); const n = q.length; const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const m0 = mid(q[n - 1], q[0]); let s = `M${f(m0[0])} ${f(m0[1])}`; for (let a = 0; a < n; a++) { const m = mid(q[a], q[(a + 1) % n]); s += ` Q${f(q[a][0])} ${f(q[a][1])} ${f(m[0])} ${f(m[1])}`; } return s + 'Z'; };
      const on = Math.hypot(mx - cx, my - cy) + R() * 26 < 64;
      body += `<path class="${on ? 's-cell s-on' : 's-cell'}" d="${d(0.88)}"/><path class="s-wall2" d="${d(0.8)}"/>`;
      if (on) body += `<path class="s-tube" style="stroke-width:1" d="M${f(mx - 5)} ${f(my - 3)} L${f(mx + 4)} ${f(my - 5)} L${f(mx + 5)} ${f(my + 4)} L${f(mx - 4)} ${f(my + 5)} Z"/>` + `<circle class="s-seed" cx="${f(mx + 4)}" cy="${f(my - 5)}" r="2.2"/><circle class="s-seed" cx="${f(mx - 4)}" cy="${f(my + 5)}" r="2.2"/>`;
      else body += `<circle class="s-ring" cx="${f(mx)}" cy="${f(my - 3)}" r="3.4"/>` + [-4.5, 0, 4.5].map((dx) => `<circle class="s-node" cx="${f(mx + dx)}" cy="${f(my + 4)}" r="1.1"/>`).join('');
    });
  } else {
    // a mesh: coordination spread across many steps. A spanning tree plus a few loops, tubes thinning outward,
    // junction rings, and agents as seeds at some nodes.
    const nodes: [number, number][] = [];
    while (nodes.length < 34) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 80; const p: [number, number] = [100 + Math.cos(a) * d, 100 + Math.sin(a) * d];
      if (nodes.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 17)) nodes.push(p);
    }
    const del = Delaunay.from(nodes); const edges: [number, number, number][] = [];
    for (let e = 0; e < del.halfedges.length; e++) { const j = del.halfedges[e]; if (j < e) continue; const a = del.triangles[e], b = del.triangles[e % 3 === 2 ? e - 2 : e + 1]; edges.push([a, b, Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1])]); }
    edges.sort((x, y) => x[2] - y[2]);
    const par = nodes.map((_, i) => i); const find = (i: number): number => (par[i] === i ? i : (par[i] = find(par[i])));
    const keep: [number, number][] = [];
    for (const [a, b] of edges) { if (find(a) !== find(b)) { par[find(a)] = find(b); keep.push([a, b]); } else if (R() < 0.18) keep.push([a, b]); }
    for (const [a, b] of keep) {
      const p = nodes[a], q = nodes[b]; const mid = [(p[0] + q[0]) / 2 + (R() - 0.5) * 10, (p[1] + q[1]) / 2 + (R() - 0.5) * 10];
      const w = 3.2 - (Math.hypot(mid[0] - 100, mid[1] - 100) / 80) * 2.4;
      body += `<path class="s-tube" style="stroke-width:${f(Math.max(0.7, w))}" d="M${f(p[0])} ${f(p[1])} Q${f(mid[0])} ${f(mid[1])} ${f(q[0])} ${f(q[1])}"/>`;
    }
    nodes.forEach(([x, y], i) => { body += i % 5 === 0 ? seed(x, y, 3.4) : `<circle class="s-junction" cx="${f(x)}" cy="${f(y)}" r="2.6"/>`; });
  }
  return `<defs><clipPath id="clip-${slug}"><circle cx="100" cy="100" r="96"/></clipPath></defs><circle class="s-ground" cx="100" cy="100" r="96"/><g clip-path="url(#clip-${slug})"><g class="s-spin">${body}</g></g><circle class="s-edge" cx="100" cy="100" r="96"/>`;
}
