// Build-time SVG "slides" for the essays: each essay gets a small specimen, seeded by its slug, drawn in the
// same vocabulary as the home page (hairline double walls, a ring for coordination, people, ochre seeds for agents).
// Three kinds, cycling: a firm with an agent inside it, a tissue part-way through a change, a mesh.
import { Delaunay } from 'd3-delaunay';
import { rng, hash, blob } from './blob';

const f = (n: number) => n.toFixed(1);
// the site's glyphs: a person (head over an open shoulder arc) and an agent (a reticle: ring, centre point, ticks)
const person = (x: number, y: number, s = 1) => `<circle class="s-person" cx="${f(x)}" cy="${f(y)}" r="${f(4 * s)}"/>`;
const seed = (x: number, y: number, r = 4) =>
  `<g class="s-agent"><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/><circle class="-c" cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.36)}"/><path d="M${f(x + r * 1.2)} ${f(y)}h${f(r * 0.45)}M${f(x - r * 1.2)} ${f(y)}h${f(-r * 0.45)}M${f(x)} ${f(y + r * 1.2)}v${f(r * 0.45)}M${f(x)} ${f(y - r * 1.2)}v${f(-r * 0.45)}"/></g>`;

export function slideSVG(slug: string, kind: number): string {
  const sd = hash(slug); const R = rng(sd);
  let body = '';
  if (kind === 0) {
    // one firm: double wall, coordination ring, plans to three steps, an agent at the middle step, inputs and outputs
    // the refined firm: a smooth boundary, one axis, a ring issuing plans, people as ink dots, an agent at the middle step
    body += `<path class="s-wash" d="${blob(sd, 100, 100, 66, 0.015)}"/>`;
    body += `<path class="s-wall" d="${blob(sd, 100, 100, 66, 0.015)}"/><path class="s-wall2" d="${blob(sd, 100, 100, 63, 0.015)}"/>`;
    body += `<circle class="s-ring" cx="100" cy="70" r="12"/><circle class="s-ring2" cx="100" cy="70" r="9.8"/>`;
    body += `<path class="s-strand" d="M100 82 Q97 97 68 106 M100 82 Q103 97 132 106"/><path class="s-strand -gone" d="M100 82 L100 104"/>`;
    body += person(68, 110) + person(132, 110) + seed(100, 110, 4.6);
    for (let i = 0; i < 4; i++) body += `<circle class="s-in" cx="${f(12 + i * 7)}" cy="110" r="2"/>`;
    for (let i = 0; i < 3; i++) body += `<circle class="s-out" cx="${f(174 + i * 9)}" cy="110" r="3"/>`;
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
      if (on) {
        // each reorganised firm grows its own small mesh (a tree over a few points), with one agent
        const n = 5 + Math.floor(R() * 3), ph = R() * 6.28;
        const P: [number, number][] = Array.from({ length: n }, (_, k) => [mx + Math.cos(ph + (k / n) * 6.28) * 7.5, my + Math.sin(ph + (k / n) * 6.28) * 6.4]);
        let d2 = ''; P.forEach((p, k) => { const q = P[(k + 1) % n]; d2 += `M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`; if (k % 2 === 0) d2 += `M${f(mx)} ${f(my)}L${f(p[0])} ${f(p[1])}`; });
        body += `<path class="s-tube" style="stroke-width:1" d="${d2}"/>` + seed(P[0][0], P[0][1], 2.4);
      } else body += `<circle class="s-ring" cx="${f(mx)}" cy="${f(my - 4)}" r="2.6"/><path class="s-strand" d="M${f(mx - 1.5)} ${f(my - 1.8)}L${f(mx - 5.5)} ${f(my + 4)}M${f(mx)} ${f(my - 1.4)}L${f(mx)} ${f(my + 4)}M${f(mx + 1.5)} ${f(my - 1.8)}L${f(mx + 5.5)} ${f(my + 4)}"/>` + [-5.5, 0, 5.5].map((dx) => `<circle class="s-node" cx="${f(mx + dx)}" cy="${f(my + 5)}" r="1.3"/>`).join('');
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
