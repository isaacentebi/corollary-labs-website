// A scene of gauge panels. Pure function of a progress value q (scrubbable), plus a
// transient disturbance that the needles absorb (spring + coupling to neighbours).
import { baseAngle, flowParams, swirl, holdAt, step, stepRate, impulse, DEFAULT_RESPONSE, type FlowParams, type Response } from '../../lib/fieldmath';
import { Batch } from '../gl/renderer';

export const COL = {
  face: [28, 29, 31] as const,
  gap: [20, 21, 22] as const,
  mark: [220, 218, 212] as const,
  signal: [242, 191, 27] as const,
};
const mixTo = (t: number) => COL.mark.map((v, i) => v + (COL.signal[i] - v) * t);
const TINTS = Array.from({ length: 9 }, (_, i) => mixTo(i / 8));

export interface Panel { x: number; y: number; w: number; h: number; cols: number; rows: number; s: number; flow: FlowParams; n0: number; n1: number; fade: number; agents: number[] }
export interface Agent {
  panel: number; u: number; v: number; x: number; y: number; needle: number;
  T: number; c: number; w: number; z: number; resp: Response;
  ring: boolean; reach: number; lamp: boolean; lampAt: number;
  /** speed of the front it sends to linked organisations (defaults to c) */
  rc: number;
  /** only sends a front; does not reshape its own panel */
  emitOnly: boolean;
}
export interface Cam { z: number; ox: number; oy: number }
export interface Wake { x: number; y: number; k: number }
export interface Lean { x: number; y: number; k: number; r: number }

export class Scene {
  panels: Panel[] = [];
  agents: Agent[] = [];
  L = 1;
  nx = new Float32Array(0); ny = this.nx; bx = this.nx; by = this.nx; theta = this.nx; act = this.nx;
  dist = this.nx; distV = this.nx;
  npanel = new Uint16Array(0);
  nbr = new Int32Array(0);
  hidden = new Set<number>();

  addPanel(x: number, y: number, w: number, h: number, s: number, seed: number, tilt = 0) {
    const cols = Math.max(3, Math.round(w / s)), rows = Math.max(2, Math.round(h / s));
    this.panels.push({ x, y, w, h, cols, rows, s: Math.min(w / cols, h / rows), flow: flowParams(seed, tilt), n0: 0, n1: 0, fade: 1, agents: [] });
    return this.panels.length - 1;
  }

  build(L?: number) {
    this.L = L ?? Math.min(this.panels[0].w, this.panels[0].h);
    const total = this.panels.reduce((t, p) => t + p.cols * p.rows, 0);
    const F = () => new Float32Array(total);
    this.nx = F(); this.ny = F(); this.bx = F(); this.by = F(); this.theta = F(); this.act = F(); this.dist = F(); this.distV = F();
    this.npanel = new Uint16Array(total); this.nbr = new Int32Array(total * 4);
    let k = 0;
    this.panels.forEach((p, pi) => {
      p.n0 = k;
      for (let j = 0; j < p.rows; j++) for (let i = 0; i < p.cols; i++) {
        const u = (i + 0.5) / p.cols, v = (j + 0.5) / p.rows, a = baseAngle(p.flow, u, v);
        this.nx[k] = p.x + u * p.w; this.ny[k] = p.y + v * p.h; this.bx[k] = Math.cos(a); this.by[k] = Math.sin(a); this.npanel[k] = pi;
        const b = k * 4;
        this.nbr[b] = i > 0 ? k - 1 : -1; this.nbr[b + 1] = i < p.cols - 1 ? k + 1 : -1;
        this.nbr[b + 2] = j > 0 ? k - p.cols : -1; this.nbr[b + 3] = j < p.rows - 1 ? k + p.cols : -1;
        k++;
      }
      p.n1 = k;
    });
  }

  /** Needle index nearest to normalised (u, v) in a panel. */
  cell(pi: number, u: number, v: number) {
    const p = this.panels[pi];
    const i = Math.min(p.cols - 1, Math.max(0, Math.floor(u * p.cols))), j = Math.min(p.rows - 1, Math.max(0, Math.floor(v * p.rows)));
    return { i, j, n: p.n0 + j * p.cols + i, u: (i + 0.5) / p.cols, v: (j + 0.5) / p.rows };
  }

  addAgent(pi: number, u: number, v: number, o: Partial<Agent> = {}) {
    const c = this.cell(pi, u, v), p = this.panels[pi];
    const a: Agent = { panel: pi, u: c.u, v: c.v, x: p.x + c.u * p.w, y: p.y + c.v * p.h, needle: c.n, T: 0, c: 6, w: 200, z: 0.28, resp: DEFAULT_RESPONSE, ring: false, reach: 1.2, lamp: true, lampAt: NaN, rc: NaN, emitOnly: false, ...o };
    if (Number.isNaN(a.lampAt)) a.lampAt = a.T - 0.012;
    if (Number.isNaN(a.rc)) a.rc = a.c;
    this.agents.push(a);
    if (!a.emitOnly) p.agents.push(this.agents.length - 1);
    return a;
  }
  moveAgent(a: Agent, u: number, v: number) {
    const c = this.cell(a.panel, u, v), p = this.panels[a.panel];
    a.u = c.u; a.v = c.v; a.x = p.x + c.u * p.w; a.y = p.y + c.v * p.h; a.needle = c.n;
  }

  compute(q: number, opt: { wakes?: Wake[]; lean?: Lean | null } = {}) {
    const { nx, ny, bx, by, theta, act, dist, L } = this;
    const sw = { x: 0, y: 0 };
    const relays = this.agents.filter((a) => a.ring && q > a.T);
    for (let n = 0; n < theta.length; n++) {
      const P = this.panels[this.npanel[n]];
      let vx = 0, vy = 0, keep = 1, ac = 0, th = 0;
      for (const ai of P.agents) {
        const a = this.agents[ai];
        if (q <= a.T) continue;
        const dx = (nx[n] - a.x) / L, dy = (ny[n] - a.y) / L, d = Math.hypot(dx, dy);
        const tau = q - a.T - d / a.c;
        if (tau <= 0) continue;
        const settled = tau * a.z * a.w > 7;
        const R = settled ? 1 : step(tau, a.w, a.z);
        const m = swirl(dx, dy, sw, a.resp);
        vx += R * sw.x; vy += R * sw.y;
        keep *= 1 - Math.min(1, R) * holdAt(d, a.resp.core);
        if (!settled) ac += (Math.abs(stepRate(tau, a.w, a.z)) / a.w) * Math.min(1.4, m) * 1.7;
      }
      // fronts from linked organisations pass through: a disturbance, absorbed
      let wig = 0;
      for (const a of relays) {
        if (a.panel === this.npanel[n]) continue;
        const d = Math.hypot(nx[n] - a.x, ny[n] - a.y) / L;
        if (d > a.reach) continue;
        const tau = q - a.T - d / a.rc;
        if (tau <= 0 || tau * a.w * 0.2 > 6) continue;
        const f = impulse(tau, a.w * 0.9, 0.2) * 0.62 * (1 - d / a.reach);
        wig += f; ac += Math.abs(f) * 1.3;
      }
      if (keep < 0.04) keep = 0.04;
      th = Math.atan2(vy + keep * by[n], vx + keep * bx[n]) + wig + dist[n];
      if (opt.wakes) for (const w of opt.wakes) {
        const dd = Math.hypot(nx[n] - w.x, ny[n] - w.y) / L;
        if (dd > 0.25) continue;
        const g = Math.exp(-((dd / 0.065) ** 2)) * w.k;
        th += 1.05 * g * (ny[n] >= w.y ? 1 : -1); ac += g * 0.9;
      }
      if (opt.lean) {
        const l = opt.lean, dx = l.x - nx[n], dy = l.y - ny[n], dd = Math.hypot(dx, dy);
        if (dd > 1 && dd < l.r * 2.5) {
          let dl = Math.atan2(dy, dx) - th;
          dl = Math.atan2(Math.sin(dl), Math.cos(dl));
          const g = Math.exp(-((dd / l.r) ** 2)) * l.k;
          th += dl * g; ac += g * 0.5;
        }
      }
      theta[n] = th; act[n] = ac;
    }
  }

  /* ---------- disturbance ---------- */
  simStep() {
    const { dist, distV, nbr } = this;
    const k = 58, c = 5.4, kc = 24, dt = 1 / 120;
    let e = 0;
    for (let sub = 0; sub < 2; sub++) {
      for (let i = 0; i < dist.length; i++) {
        if (dist[i] === 0 && distV[i] === 0) continue;
        let sum = 0, cnt = 0;
        for (let q = 0; q < 4; q++) { const j = nbr[i * 4 + q]; if (j >= 0) { sum += dist[j]; cnt++; } }
        distV[i] += (-k * dist[i] - c * distV[i] + kc * (sum / cnt - dist[i])) * dt;
      }
      for (let i = 0; i < dist.length; i++) {
        let d = dist[i] + distV[i] * dt;
        if (d > 1.6) d = 1.6; else if (d < -1.6) d = -1.6;
        dist[i] = d;
        // wake up the neighbours of anything moving
        if (d !== 0) for (let q = 0; q < 4; q++) { const j = nbr[i * 4 + q]; if (j >= 0 && dist[j] === 0 && distV[j] === 0) distV[j] = 1e-9; }
      }
    }
    let mx = 0;
    for (let i = 0; i < dist.length; i++) { const a = Math.abs(dist[i]) + 0.05 * Math.abs(distV[i]); if (a > mx) mx = a; }
    // quiet enough to see as still: stop drawing
    if (mx < 0.012) { dist.fill(0); distV.fill(0); return false; }
    return true;
  }
  push(x: number, y: number, vx: number, vy: number, radius: number, panels?: number[]) {
    const R2 = radius * radius; let hit = false;
    for (let n = 0; n < this.dist.length; n++) {
      if (panels && !panels.includes(this.npanel[n])) continue;
      const dx = this.nx[n] - x, dy = this.ny[n] - y, d2 = dx * dx + dy * dy;
      if (d2 > R2) continue;
      const f = Math.exp(-d2 / (R2 * 0.35));
      this.distV[n] += (Math.cos(this.theta[n]) * vy - Math.sin(this.theta[n]) * vx) * f * 9;
      hit = true;
    }
    return hit;
  }
  kick(x: number, y: number, amp: number, radius: number) {
    for (let n = 0; n < this.dist.length; n++) {
      const d = Math.hypot(this.nx[n] - x, this.ny[n] - y) / radius;
      if (d > 3) continue;
      this.distV[n] += amp * Math.exp(-d * d) * ((n % 2) * 2 - 1);
    }
  }

  /* ---------- draw ---------- */
  emit(b: Batch, cam: Cam, q: number, W: number, H: number, opt: { panelRadius?: number; needleAlpha?: number; ringFade?: number } = {}) {
    const { z, ox, oy } = cam;
    const X = (x: number) => ox + x * z, Y = (y: number) => oy + y * z;
    const vis = this.panels.map((p) => X(p.x + p.w) > -2 && X(p.x) < W + 2 && Y(p.y + p.h) > -2 && Y(p.y) < H + 2);
    const pr = opt.panelRadius ?? 12;
    this.panels.forEach((p, i) => {
      if (!vis[i]) return;
      b.push(3, X(p.x + p.w / 2), Y(p.y + p.h / 2), (p.w * z) / 2, (p.h * z) / 2, 0, COL.face, 1, Math.max(2, pr * Math.min(1, z * 1.8)));
    });
    const lit = new Set<number>(this.hidden);
    for (const a of this.agents) if (a.lamp && q >= a.lampAt) lit.add(a.needle);
    const na = opt.needleAlpha ?? 0.8;
    for (let pi = 0; pi < this.panels.length; pi++) {
      const p = this.panels[pi];
      if (!vis[pi] || p.fade <= 0.002) continue;
      const ss = p.s * z;
      const ringA = (0.07 + 0.1 * Math.min(1, Math.max(0, (ss - 12) / 16))) * p.fade;
      for (let n = p.n0; n < p.n1; n++) {
        if (lit.has(n)) continue;
        const x = X(this.nx[n]), y = Y(this.ny[n]);
        if (x < -ss || x > W + ss || y < -ss || y > H + ss) continue;
        const t = Math.min(8, Math.round(this.act[n] * 7));
        b.push(0, x, y, ss, 0, this.theta[n], TINTS[t], (na + (1 - na) * (t / 8)) * p.fade, ringA);
      }
    }
    // fronts
    for (const a of this.agents) {
      if (!a.ring || q <= a.T) continue;
      const r = (q - a.T) * a.rc * this.L, R = a.reach * this.L;
      if (r >= R) continue;
      const f = Math.min(1, r / (this.L * 0.08)) * Math.pow(1 - r / R, 1.3);
      b.push(2, X(a.x), Y(a.y), r * z, 1.6, 0, COL.signal, 0.62 * f * (opt.ringFade ?? 1));
    }
    // lamps
    for (const a of this.agents) {
      if (!a.lamp || q < a.lampAt) continue;
      const t = Math.min(1, (q - a.lampAt) / 0.012);
      const e = 1 - Math.pow(1 - t, 3);
      b.push(1, X(a.x), Y(a.y), Math.max(2.8, 0.3 * this.panels[a.panel].s * z) * e, 0, 0, COL.signal, 1);
    }
  }
}
