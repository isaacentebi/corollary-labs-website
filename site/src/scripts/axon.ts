// Axonometric drawing kernel: a parallel (plan-oblique) projection, depth-ordered solids,
// hidden-line fills. Everything is drawn as line work on the night ground, like a drafted axonometric.

export type Cam = {
  cx: number; cy: number; // screen centre (css px)
  wx: number; wy: number; wz: number; // world point at the screen centre
  s: number; // css px per world unit
  th: number; // plan rotation
  ky: number; // plan foreshortening (1 = true plan-oblique)
  kz: number; // vertical scale
};

export const C = {
  night: '#121418',
  line: '232,228,218', // chalk (rgb triplet, alpha applied per use)
  face: ['#16191e', '#1b1e24', '#21252c'], // side a, side b, top
  lamp: ['#e0ae3c', '#c7952b', '#f2cd6a'],
  lampEdge: '#5e430f',
  lampRGB: '242,197,90',
};

// oriented solid used for ordering: a box (a, hu, hv) or a vertical cylinder (r)
export type OB = { x: number; y: number; a: number; hu: number; hv: number; z0: number; z1: number; r?: number };
const hexRGB = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export function mixHex(a: string, b: string, t: number) {
  if (t >= 1) return b;
  if (t <= 0) return a;
  const A = hexRGB(a), B = hexRGB(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}

export type Item = { c: number; ob?: OB; draw: (ctx: CanvasRenderingContext2D) => void };

export function proj(cam: Cam, x: number, y: number, z: number): [number, number] {
  const dx = x - cam.wx, dy = y - cam.wy;
  const co = Math.cos(cam.th), si = Math.sin(cam.th);
  const X = dx * co - dy * si;
  const Y = dx * si + dy * co;
  return [cam.cx + cam.s * X, cam.cy + cam.s * (cam.ky * Y - cam.kz * (z - cam.wz))];
}

export function close(cam: Cam, x: number, y: number, z: number) {
  const dx = x - cam.wx, dy = y - cam.wy;
  const Y = dx * Math.sin(cam.th) + dy * Math.cos(cam.th);
  return cam.kz * Y + cam.ky * z;
}

// world-space direction toward the viewer
export function viewDir(cam: Cam): [number, number, number] {
  return [cam.kz * Math.sin(cam.th), cam.kz * Math.cos(cam.th), cam.ky];
}

type BoxStyle = {
  lamp?: boolean;
  mix?: number; // for lamp units: 1 = lamp, 0 = back to graphite (the new becomes normal)
  alpha?: number; // line alpha
  window?: boolean; // round window on +u end face
  rails?: boolean; // service lines along u on the top face
  ghost?: boolean;
  ghostA?: number; // faint ghost (chalk dashes at this alpha) instead of the lamp preview
  glow?: number; // lamp outline with bloom, 0..1
  open?: [boolean, boolean]; // ends (−u, +u) that continue into the next segment: no edge drawn there
};

// An oriented box: centre (x,y), horizontal axis angle a, half extents hu (along a) and hv, from z0 to z1.
export function boxItem(cam: Cam, x: number, y: number, z0: number, z1: number, a: number, hu: number, hv: number, st: BoxStyle): Item {
  return { c: close(cam, x, y, (z0 + z1) / 2), ob: { x, y, a, hu, hv, z0, z1 }, draw: (ctx) => drawBox(ctx, cam, x, y, z0, z1, a, hu, hv, st) };
}

export function drawBox(ctx: CanvasRenderingContext2D, cam: Cam, x: number, y: number, z0: number, z1: number, a: number, hu: number, hv: number, st: BoxStyle) {
  const ux = Math.cos(a), uy = Math.sin(a);
  const vx = -uy, vy = ux;
  const V = viewDir(cam);
  type Cn = [number, number, number]; // su, sv, z
  const P = (c: Cn) => proj(cam, x + ux * hu * c[0] + vx * hv * c[1], y + uy * hu * c[0] + vy * hv * c[1], c[2]);
  const la = st.alpha ?? 0.9;
  const lm = st.lamp ? st.mix ?? 1 : 0;
  const faces: { cs: Cn[]; tone: number }[] = [];
  const dU = ux * V[0] + uy * V[1];
  const dV = vx * V[0] + vy * V[1];
  if (dU > 0) faces.push({ tone: 0, cs: [[1, -1, z0], [1, 1, z0], [1, 1, z1], [1, -1, z1]] });
  if (dU < 0) faces.push({ tone: 0, cs: [[-1, -1, z0], [-1, 1, z0], [-1, 1, z1], [-1, -1, z1]] });
  if (dV > 0) faces.push({ tone: 1, cs: [[-1, 1, z0], [1, 1, z0], [1, 1, z1], [-1, 1, z1]] });
  if (dV < 0) faces.push({ tone: 1, cs: [[-1, -1, z0], [1, -1, z0], [1, -1, z1], [-1, -1, z1]] });
  faces.push({ tone: 2, cs: [[-1, -1, z1], [1, -1, z1], [1, 1, z1], [-1, 1, z1]] });
  const open = st.open;
  const isOpenEdge = (p: Cn, q: Cn) => !!open && p[0] === q[0] && ((p[0] === -1 && open[0]) || (p[0] === 1 && open[1]));

  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;
  for (const f of faces) {
    // skip end faces that continue into the next segment
    if (open && f.cs.every((c) => c[0] === f.cs[0][0]) && ((f.cs[0][0] === -1 && open[0]) || (f.cs[0][0] === 1 && open[1]))) continue;
    const pts = f.cs.map(P);
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    if (!st.ghost) {
      ctx.fillStyle = st.lamp ? mixHex(C.face[f.tone], C.lamp[f.tone], lm) : C.face[f.tone];
      ctx.fill();
    } else if (!st.ghostA) {
      ctx.fillStyle = `rgba(${C.lampRGB},0.14)`;
      ctx.fill();
    }
    if (st.ghost) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = st.ghostA ? `rgba(${C.line},${st.ghostA})` : `rgba(${C.lampRGB},0.95)`;
    } else ctx.strokeStyle = st.lamp && lm > 0.5 ? C.lampEdge : `rgba(${C.line},${st.lamp ? la * (1 - 2 * lm) : la})`;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const p = f.cs[i], q = f.cs[(i + 1) % 4];
      if (isOpenEdge(p, q)) continue;
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[(i + 1) % 4][0], pts[(i + 1) % 4][1]);
    }
    ctx.stroke();
    if (st.ghost) ctx.setLineDash([]);
  }

  if (st.glow && st.glow > 0.01) {
    ctx.save();
    ctx.strokeStyle = `rgba(${C.lampRGB},${Math.min(1, st.glow)})`;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = `rgba(${C.lampRGB},${0.9 * st.glow})`;
    ctx.shadowBlur = 14 * st.glow;
    for (const f of faces) {
      const pts = f.cs.map(P);
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  // round window on the outer end (+u) face: an affine image of a circle
  if (st.window && dU > 0 && cam.s > 5) {
    const zc = (z0 + z1) / 2;
    const o = P([1, 0, zc]);
    const e1 = P([1, 1, zc]);
    const e2 = P([1, 0, z1]);
    const r = 0.6;
    ctx.save();
    ctx.transform(e1[0] - o[0], e1[1] - o[1], e2[0] - o[0], e2[1] - o[1], o[0], o[1]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.restore();
    if (st.ghost) {
      ctx.strokeStyle = st.ghostA ? `rgba(${C.line},${st.ghostA})` : `rgba(${C.lampRGB},0.9)`;
      ctx.stroke();
    } else if (st.lamp && lm > 0.5) {
      ctx.fillStyle = C.night;
      ctx.fill();
    } else {
      ctx.strokeStyle = `rgba(${C.line},${la * 0.8})`;
      ctx.stroke();
    }
  }

  // service lines on the top face (infrastructure)
  if (st.rails && cam.s > 6) {
    ctx.strokeStyle = `rgba(${C.line},${la * 0.38})`;
    ctx.beginPath();
    for (const sv of [-0.42, 0.42]) {
      const p0 = P([-1, sv, z1]), p1 = P([1, sv, z1]);
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
    }
    ctx.stroke();
  }
}

// A vertical cylinder piece (core segment). top: draw the top disc. base: the lowest segment.
export function cylItem(cam: Cam, x: number, y: number, z0: number, z1: number, r: number, top: boolean, alpha = 0.9, base = true): Item {
  return { c: close(cam, x, y, (z0 + z1) / 2), ob: { x, y, a: 0, hu: r * 0.92, hv: r * 0.92, z0, z1, r: r * 0.92 }, draw: (ctx) => drawCyl(ctx, cam, x, y, z0, z1, r, top, alpha, base) };
}

export function drawCyl(ctx: CanvasRenderingContext2D, cam: Cam, x: number, y: number, z0: number, z1: number, r: number, top: boolean, alpha: number, base = true) {
  const [bx, by] = proj(cam, x, y, z0);
  const [tx, ty] = proj(cam, x, y, z1);
  const rx = r * cam.s, ry = r * cam.s * cam.ky;
  ctx.fillStyle = C.face[0];
  ctx.beginPath();
  ctx.moveTo(tx - rx, ty);
  ctx.lineTo(bx - rx, by);
  ctx.ellipse(bx, by, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(tx + rx, ty);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgba(${C.line},${alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tx - rx, ty);
  ctx.lineTo(bx - rx, by);
  ctx.moveTo(tx + rx, ty);
  ctx.lineTo(bx + rx, by);
  if (base) {
    ctx.moveTo(bx + rx, by);
    ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI);
  }
  ctx.stroke();
  if (!base && rx > 3) {
    // floor line: a faint ring where the shaft passes a level
    ctx.strokeStyle = `rgba(${C.line},${alpha * 0.26})`;
    ctx.beginPath();
    ctx.ellipse(bx, by, rx, ry, 0, 0.12, Math.PI - 0.12);
    ctx.stroke();
  }
  // drafted shading: vertical lines, denser toward the right silhouette
  if (cam.s > 5 && rx > 4) {
    ctx.strokeStyle = `rgba(${C.line},${alpha * 0.3})`;
    ctx.beginPath();
    const n = Math.min(8, Math.floor(rx / 2.2));
    for (let i = 1; i <= n; i++) {
      const k = Math.sin(((i / (n + 1)) * Math.PI) / 2);
      const X = rx * (0.2 + 0.8 * k);
      const d = ry * Math.sqrt(Math.max(0, 1 - (X / rx) ** 2));
      ctx.moveTo(tx + X, ty + d);
      ctx.lineTo(bx + X, by + d);
    }
    ctx.stroke();
  }
  if (top) {
    ctx.fillStyle = C.face[2];
    ctx.beginPath();
    ctx.ellipse(tx, ty, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${C.line},${alpha})`;
    ctx.stroke();
    if (rx > 6) {
      ctx.strokeStyle = `rgba(${C.line},${alpha * 0.45})`;
      ctx.beginPath();
      ctx.ellipse(tx, ty, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// ——— ordering ———
// Separating-axis test between two solids: returns 1 if A is in front of B, -1 if behind, 0 if unknown.
function order(A: OB, B: OB, V: [number, number, number]) {
  const eps = 1e-3;
  if (A.z0 >= B.z1 - eps) return 1; // above is in front (viewer looks down)
  if (B.z0 >= A.z1 - eps) return -1;
  const axes: [number, number][] = [];
  if (!A.r) axes.push([Math.cos(A.a), Math.sin(A.a)], [-Math.sin(A.a), Math.cos(A.a)]);
  if (!B.r) axes.push([Math.cos(B.a), Math.sin(B.a)], [-Math.sin(B.a), Math.cos(B.a)]);
  if (A.r && B.r) {
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
    axes.push([dx / d, dy / d]);
  } else if (A.r || B.r) {
    // cylinder vs box: the axis from the cylinder axis to the nearest point of the box
    const Cy = A.r ? A : B, Bx = A.r ? B : A;
    const ux = Math.cos(Bx.a), uy = Math.sin(Bx.a);
    const dx = Cy.x - Bx.x, dy = Cy.y - Bx.y;
    const lu = Math.max(-Bx.hu, Math.min(Bx.hu, dx * ux + dy * uy));
    const lv = Math.max(-Bx.hv, Math.min(Bx.hv, -dx * uy + dy * ux));
    const px = Bx.x + ux * lu - uy * lv, py = Bx.y + uy * lu + ux * lv;
    const nx = px - Cy.x, ny = py - Cy.y, d = Math.hypot(nx, ny);
    if (d > 1e-4) axes.push([nx / d, ny / d]);
  }
  const ext = (O: OB, nx: number, ny: number) => {
    const c = O.x * nx + O.y * ny;
    const e = O.r ? O.r : O.hu * Math.abs(Math.cos(O.a) * nx + Math.sin(O.a) * ny) + O.hv * Math.abs(-Math.sin(O.a) * nx + Math.cos(O.a) * ny);
    return [c - e, c + e];
  };
  for (const [nx, ny] of axes) {
    const [a0, a1] = ext(A, nx, ny), [b0, b1] = ext(B, nx, ny);
    const vn = V[0] * nx + V[1] * ny;
    if (Math.abs(vn) < 1e-6) continue;
    if (a0 >= b1 - eps) return vn > 0 ? 1 : -1; // A lies on the +n side
    if (b0 >= a1 - eps) return vn > 0 ? -1 : 1;
  }
  return 0;
}

// Draw order: topological sort over pairs that overlap on screen, falling back to closeness.
export function depthSort(items: Item[], cam: Cam): Item[] {
  const n = items.length;
  const V = viewDir(cam);
  const bb = new Float32Array(n * 4);
  const loose: Item[] = [];
  for (let i = 0; i < n; i++) {
    const o = items[i].ob;
    if (!o) { bb[i * 4] = NaN; loose.push(items[i]); continue; }
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const R = o.r ?? Math.hypot(o.hu, o.hv);
    for (const z of [o.z0, o.z1]) {
      const [sx, sy] = proj(cam, o.x, o.y, z);
      const rx = R * cam.s * 1.1, ry = R * cam.s * cam.ky * 1.1;
      x0 = Math.min(x0, sx - rx); x1 = Math.max(x1, sx + rx); y0 = Math.min(y0, sy - ry); y1 = Math.max(y1, sy + ry);
    }
    bb[i * 4] = x0; bb[i * 4 + 1] = x1; bb[i * 4 + 2] = y0; bb[i * 4 + 3] = y1;
  }
  // bucket by screen cell
  const cell = 64;
  const grid = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(bb[i * 4])) continue;
    const cx0 = Math.floor(bb[i * 4] / cell), cx1 = Math.floor(bb[i * 4 + 1] / cell);
    const cy0 = Math.floor(bb[i * 4 + 2] / cell), cy1 = Math.floor(bb[i * 4 + 3] / cell);
    for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
      const k = (cx + 1000) * 4000 + (cy + 1000);
      let l = grid.get(k);
      if (!l) grid.set(k, (l = []));
      l.push(i);
    }
  }
  const behind: number[][] = Array.from({ length: n }, () => []);
  const seen = new Set<number>();
  for (const l of grid.values()) {
    for (let p = 0; p < l.length; p++) for (let q = p + 1; q < l.length; q++) {
      const i = l[p], j = l[q];
      const key = i < j ? i * n + j : j * n + i;
      if (seen.has(key)) continue;
      seen.add(key);
      if (bb[i * 4] > bb[j * 4 + 1] || bb[j * 4] > bb[i * 4 + 1] || bb[i * 4 + 2] > bb[j * 4 + 3] || bb[j * 4 + 2] > bb[i * 4 + 3]) continue;
      let o = order(items[i].ob!, items[j].ob!, V);
      if (o === 0) o = items[i].c >= items[j].c ? 1 : -1;
      if (o > 0) behind[i].push(j);
      else behind[j].push(i);
    }
  }
  const idx = [];
  for (let i = 0; i < n; i++) if (!Number.isNaN(bb[i * 4])) idx.push(i);
  idx.sort((a, b) => items[a].c - items[b].c);
  const state = new Uint8Array(n);
  const out: Item[] = [];
  const visit = (i: number) => {
    if (state[i]) return;
    state[i] = 1;
    const bs = behind[i];
    if (bs.length > 1) bs.sort((a, b) => items[a].c - items[b].c);
    for (const j of bs) visit(j);
    out.push(items[i]);
  };
  for (const i of idx) visit(i);
  loose.sort((a, b) => a.c - b.c);
  return out.concat(loose);
}
