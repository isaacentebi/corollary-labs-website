// The tissue: a Voronoi of cells, every cell a firm. The change (eosin) spreads from one cell outward at
// uneven rates; some reorganised cells divide and some neighbours shrink. Used by the home story and footer.
import { Delaunay } from 'd3-delaunay';
import { TAU, clamp, ss, lerp, spring, rng, rgba, mixc, roundPoly, type Palette } from './draw';

export interface TCell {
  bx: number; by: number; ph: number; tau: number; resist: boolean;
  nuc: [number, number][];        // chromatin stipple (unit disc)
  links: [number, number][];      // short links between neighbouring stipple points (the mesh once stained)
  div?: { ang: number; t0: number; child: number }; // divides at stain level t0
  shrink?: { to: number; t0: number };
  isChild?: boolean;
  x: number; y: number; alive: number;
}
export interface Tissue { cells: TCell[]; bounds: [number, number, number, number]; spacing: number }

/** A jittered hex tissue over [-w/2,w/2]×[-h/2,h/2]. Cell 0 sits at `origin` and starts the change.
 *  Adoption times grow with distance (`reach` ≈ distance adopted at level 0.8), unevenly, with resistant pockets. */
export function makeTissue(seed: number, w: number, h: number, spacing: number, opts: { divide?: number; shrink?: number; origin?: [number, number]; reach?: number } = {}): Tissue {
  const R = rng(seed);
  const cells: TCell[] = [];
  const dy = spacing * 0.866;
  const [ox, oy] = opts.origin || [0, 0];
  const mk = (x: number, y: number): TCell => {
    const nuc: [number, number][] = [];
    for (let k = 0; k < 16; k++) { const a = R() * TAU, d = Math.sqrt(R()); nuc.push([Math.cos(a) * d, Math.sin(a) * d]); }
    const links: [number, number][] = [];
    nuc.forEach((p, k) => {
      let best = -1, bd = 9;
      nuc.forEach((q, j) => { if (j === k) return; const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (d < bd) { bd = d; best = j; } });
      if (!links.some(([a, b]) => a === best && b === k)) links.push([k, best]);
    });
    return { bx: x, by: y, x, y, ph: R() * TAU, tau: 0, resist: false, nuc, links, alive: 1 };
  };
  cells.push(mk(ox, oy));
  for (let j = -Math.ceil(h / 2 / dy) - 1; j <= Math.ceil(h / 2 / dy) + 1; j++) {
    for (let i = -Math.ceil(w / 2 / spacing) - 1; i <= Math.ceil(w / 2 / spacing) + 1; i++) {
      const x = i * spacing + (j & 1 ? spacing / 2 : 0) + (R() - 0.5) * spacing * 0.5;
      const y = j * dy + (R() - 0.5) * spacing * 0.45;
      if (Math.hypot(x - ox, y - oy) < spacing * 0.8) continue;
      cells.push(mk(x, y));
    }
  }
  const reach = opts.reach ?? Math.hypot(w / 2, h / 2) * 0.6;
  const pockets = Array.from({ length: 6 }, () => [(R() - 0.5) * w * 0.8, (R() - 0.5) * h * 0.8, spacing * (1.1 + R() * 1.4)]);
  cells.forEach((c, i) => {
    const d = Math.hypot(c.bx - ox, c.by - oy) / reach;
    c.resist = i !== 0 && d > 0.25 && pockets.some(([px, py, pr]) => Math.hypot(c.bx - px, c.by - py) < pr);
    c.tau = i === 0 ? -1 : Math.pow(d, 0.9) * 0.8 + (R() - 0.5) * 0.3 + (c.resist ? 0.6 : 0);
  });
  // divisions and shrinkage: creative destruction, a second-order effect of the spread
  const n0 = cells.length;
  const divP = opts.divide ?? 0.1, shrP = opts.shrink ?? 0.07;
  for (let i = 1; i < n0; i++) {
    const c = cells[i];
    if (!c.resist && R() < divP) {
      const child = mk(c.bx, c.by); child.isChild = true; child.tau = c.tau; child.alive = 0;
      cells.push(child);
      c.div = { ang: R() * TAU, t0: c.tau + 0.1 + R() * 0.08, child: cells.length - 1 };
    }
  }
  // a shrinking firm is absorbed by the daughter of a dividing neighbour: the division points at it,
  // its seed converges on the daughter's, so the daughter's region takes its place continuously
  const used = new Set<number>();
  for (let i = 1; i < n0; i++) {
    const c = cells[i];
    if (c.div || c.resist || R() > shrP * 3) continue;
    let best = -1, bd = spacing * 1.35;
    for (let k = 1; k < n0; k++) { const o = cells[k]; if (!o.div || k === i || used.has(k)) continue; const d = Math.hypot(o.bx - c.bx, o.by - c.by); if (d < bd) { bd = d; best = k; } }
    if (best < 0) continue;
    used.add(best);
    const o = cells[best];
    o.div!.ang = Math.atan2(c.by - o.by, c.bx - o.bx);
    c.shrink = { to: o.div!.child, t0: o.div!.t0 + 0.02 };
    c.tau = Math.max(c.tau, o.div!.t0 + 0.3); // it does not reorganise before it is absorbed
  }
  return { cells, bounds: [-w / 2 - spacing, -h / 2 - spacing, w / 2 + spacing, h / 2 + spacing], spacing };
}

/** Advance seed positions for stain level `st` and time t. */
export function stepTissue(T: Tissue, st: number, t: number, motion = 1) {
  const { cells, spacing } = T;
  for (const c of cells) { c.x = c.bx + Math.sin(t * 0.35 + c.ph) * spacing * 0.035 * motion; c.y = c.by + Math.cos(t * 0.29 + c.ph * 1.3) * spacing * 0.035 * motion; }
  for (const c of cells) {
    if (!c.div) continue;
    const k = spring(clamp((st - c.div.t0) / 0.2));
    const ch = cells[c.div.child];
    const dx = Math.cos(c.div.ang) * spacing * 0.32 * k, dy = Math.sin(c.div.ang) * spacing * 0.32 * k;
    ch.alive = k > 0.002 ? 1 : 0;
    ch.x = c.x + dx + 1e-3; ch.y = c.y + dy + 1e-3;
    c.x -= dx; c.y -= dy;
  }
  for (const c of cells) {
    if (!c.shrink) continue;
    const k = ss(c.shrink.t0, c.shrink.t0 + 0.28, st);
    const o = cells[c.shrink.to];
    c.x = lerp(c.x, o.x, k); c.y = lerp(c.y, o.y, k);
    c.alive = k < 0.97 ? 1 - ss(0.8, 0.97, k) * 0.6 : 0;
  }
}

export interface TissueStyle {
  P: Palette; px: number; st: number; t: number; alpha?: number;
  view?: [number, number, number, number]; // visible rect in tissue units (culling)
  hot?: number;                             // index of the cell under the pointer
  firstStained?: boolean;
}

/** Draw the tissue in the current transform (tissue units). */
export function drawTissue(ctx: CanvasRenderingContext2D, T: Tissue, S: TissueStyle) {
  const { cells, bounds } = T; const { P, px, st, t } = S; const A = S.alpha ?? 1;
  const live = cells.map((c, i) => [c, i] as const).filter(([c]) => c.alive > 0);
  const vor = Delaunay.from(live.map(([c]) => [c.x, c.y] as [number, number])).voronoi(bounds);
  const v = S.view; const sp = T.spacing;
  for (let k = 0; k < live.length; k++) {
    const [c, i] = live[k];
    if (v && (c.x < v[0] - sp || c.x > v[2] + sp || c.y < v[1] - sp || c.y > v[3] + sp)) continue;
    const poly = vor.cellPolygon(k) as [number, number][] | null;
    if (!poly || poly.length < 4) continue;
    poly.pop();
    let cx = 0, cy = 0; for (const p of poly) { cx += p[0]; cy += p[1]; } cx /= poly.length; cy /= poly.length;
    const stain = i === 0 && S.firstStained ? 1 : ss(c.tau, c.tau + 0.09, st);
    const hot = S.hot === i ? 1 : 0;
    const a = A * c.alive;
    if (a <= 0.01) continue;
    const inset = (f: number) => poly.map((p) => [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f] as [number, number]);
    ctx.beginPath(); roundPoly(ctx, inset(0.9));
    ctx.fillStyle = rgba(mixc(P.haem, P.eosin, stain), a * (0.05 + stain * 0.08 + hot * 0.1));
    ctx.fill();
    ctx.lineWidth = px * (1 + stain * 0.3 + hot * 0.6);
    ctx.strokeStyle = rgba(mixc(P.ink, P.eosin, Math.max(stain * 0.85, hot)), a * (0.6 + stain * 0.2));
    ctx.stroke();
    ctx.beginPath(); roundPoly(ctx, inset(0.83));
    ctx.lineWidth = px * 0.7; ctx.strokeStyle = rgba(mixc(P.ink3, P.eosin, stain * 0.6), a * 0.5); ctx.stroke();
    // coordination: a stippled nucleus that opens into a small mesh once the cell has reorganised
    const r = sp * 0.13 * (1 + stain * 0.9);
    const pos = (q: number): [number, number] => { const [ux, uy] = c.nuc[q]; return [cx + ux * r + Math.sin(t * 0.6 + q + c.ph) * r * 0.06, cy + uy * r + Math.cos(t * 0.5 + q * 1.7) * r * 0.06]; };
    if (stain > 0.02) {
      ctx.beginPath();
      for (const [p, q] of c.links) { const a1 = pos(p), b1 = pos(q); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(b1[0], b1[1]); }
      ctx.lineWidth = px * 0.8; ctx.strokeStyle = rgba(P.eosin, a * stain * 0.7); ctx.stroke();
    }
    ctx.fillStyle = rgba(mixc(P.ink, P.eosin, stain), a * 0.8);
    for (let q = 0; q < c.nuc.length; q++) { const [x, y] = pos(q); ctx.fillRect(x - px, y - px, px * 2, px * 2); }
    if (stain > 0.3) {
      // agents at work inside the reorganised firm
      for (let q = 0; q < 2; q++) {
        const [x, y] = pos(q * 7 + 1);
        ctx.beginPath(); ctx.ellipse(x, y, sp * 0.055, sp * 0.028, c.ph + q, 0, TAU);
        ctx.fillStyle = rgba(P.paper, a * 0.9); ctx.fill();
        ctx.lineWidth = px; ctx.strokeStyle = rgba(P.eosin, a * clamp((stain - 0.3) * 2)); ctx.stroke();
      }
    }
  }
}

/** Nearest live cell index to a tissue-space point. */
export function tissueHit(T: Tissue, x: number, y: number) {
  let best = -1, bd = Infinity;
  T.cells.forEach((c, i) => { if (c.alive <= 0) return; const d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < bd) { bd = d; best = i; } });
  return best;
}
