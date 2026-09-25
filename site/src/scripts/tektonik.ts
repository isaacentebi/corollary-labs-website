// Tektonik — the home story. A flat composition of planes in tension (A); an agent enters and the
// picture fractures (B); the same pieces reassemble into a spatial construction (C); the camera pulls back
// and the reorganisation travels from composition to composition across the field (D).
// Orthographic canvas renderer, painter's algorithm, renders on demand only.
import {
  type V3, type Q, v, add, sub, scale, len, norm, lerp, lerp3, clamp, smooth, easeOut3, easeInOut3, easeOutExpo, easeIn2,
  qMul, qX, qY, qZ, qConj, qRot, qSlerp, qAxis, qLook, qId, rng,
} from './math3';
import { buildFragments, place, type Frag, type Pose, type Col, IMPACT, AGENT_START, AGENT_H, AGENT_C } from './compose';

const PAL: Record<Col, V3> = {
  chalk: [236, 233, 224],
  haze: [168, 178, 204],
  pewter: [104, 113, 142],
  slate: [44, 54, 96],
  graphite: [4, 6, 15],
  cad: [247, 201, 16],
};
const GROUND: V3 = [12, 17, 40];
const LIGHT = norm(v(0.34, 0.76, 0.55));
const L0 = LIGHT[2];

interface Node {
  primary: boolean; pos: V3; k: number; frags: Frag[]; agentC: Pose; agentFrom: V3;
  d: number; tArr: number; s: number; sx: number; sy: number; seen: boolean; ring: number;
}
interface Edge { a: number; b: number; ring: boolean }

// camera keys: p, pitch, yaw, ln(zoom), target along the fan (world units), target y, 1/distance (0 = axonometric)
// (the last zoom is replaced at runtime to fit the viewport)
const FINAL_PITCH = 0.4, FINAL_YAW = -1.02;
const FINAL_ROLL = 0.2; // the whole field tilts, as in Hadid's 'The World (89 Degrees)'
const KEYS: number[][] = [
  [0.0, 0.0, 0.0, 0, 0, 0, 0, 0],
  [0.26, 0.03, -0.06, Math.log(1.02), 0, 0, 0, 0],
  [0.5, 0.3, -0.38, Math.log(0.94), 0, 0.02, 0, 0],
  [0.74, 0.5, -0.72, Math.log(1.0), 0, 0.06, 0, 0],
  [1.0, FINAL_PITCH, FINAL_YAW, Math.log(0.22), 4.6, 0.1, 1 / 13, FINAL_ROLL],
];

const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

/** Primary composition progress through A→B→C, from scroll. */
const primaryS = (p: number) => (p < 0.26 ? 0 : p < 0.44 ? 0.5 * smooth((p - 0.26) / 0.18) : p < 0.52 ? 0.5 : p < 0.7 ? 0.5 + 0.5 * smooth((p - 0.52) / 0.18) : 1);

function poseAt(f: Frag, s: number): Pose {
  if (s <= 0) return f.A;
  const a = clamp(s * 2), b = clamp(s * 2 - 1);
  const ub = clamp(b * 1.4 - f.o2 * 0.4);
  if (ub > 0) {
    const t = easeInOut3(ub);
    return { p: lerp3(f.B.p, f.C.p, t), q: qSlerp(f.B.q, f.C.q, t), s: lerp3(f.B.s, f.C.s, t) };
  }
  const ua = clamp(a * 1.45 - f.o * 0.45);
  const t = easeOut3(ua);
  return { p: lerp3(f.A.p, f.B.p, t), q: qSlerp(f.A.q, f.B.q, t), s: lerp3(f.A.s, f.B.s, t) };
}

export function mountTektonik(stage: HTMLElement, track: HTMLElement) {
  const canvas = stage.querySelector<HTMLCanvasElement>('canvas[data-tektonik]')!;
  const ctx = canvas.getContext('2d')!;
  const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

  // ---------- scene ----------
  const base = buildFragments(7);
  const wob = base.map((_, i) => { const r = rng(100 + i); return norm(v(r() - 0.5, r() - 0.5, r() - 0.5)); });
  const qFinal = qMul(qZ(FINAL_ROLL), qMul(qX(innerWidth < innerHeight ? 0.66 : FINAL_PITCH), qY(FINAL_YAW)));
  const qFace = qConj(qFinal);

  const nodes: Node[] = [{
    primary: true, pos: v(), k: 1, frags: base, agentC: AGENT_C, agentFrom: v(1, 0, 0), d: 0, tArr: -Infinity, s: 0, sx: 0, sy: 0, seen: true, ring: 0,
  }];
  const edges: Edge[] = [];
  // the field fans out from the first composition, away from the viewer (Hadid's fan, not a network)
  const fwdV = qRot(qY(-FINAL_YAW), v(0, 0, -1));
  const fwdA = Math.atan2(fwdV[2], fwdV[0]);
  const R = rng(31);
  const addNode = (pos: V3, kk: number, ring: number) => {
    const qF = qMul(qFace, qZ((R() - 0.5) * 1.1));
    // weightless: each new order floats at its own tilt
    const qC = qMul(qAxis(v(R() - 0.5, 0, R() - 0.5), (R() - 0.5) * 0.9), qY(R() * Math.PI * 2));
    const keep = base.map((f) => f.parent !== 10 && (f.minor ? R() > 0.35 : R() > 0.1));
    const frags: Frag[] = base.filter((_, i) => keep[i]).map((f) => ({
      ...f, h: scale(f.h, kk), A: place(f.A, pos, qF, kk), B: place(f.B, pos, qF, kk), C: place(f.C, pos, qC, kk),
    }));
    nodes.push({ primary: false, pos, k: kk, frags, agentC: place(AGENT_C, pos, qC, kk), agentFrom: norm(pos), d: len(pos), tArr: Infinity, s: 0, sx: 0, sy: 0, seen: false, ring });
    return nodes.length - 1;
  };
  const ARMS = 6, RINGS = 5, SPREAD = 1.05;
  for (let a = 0; a < ARMS; a++) {
    let prev = 0;
    for (let k = 1; k <= RINGS; k++) {
      const rad = 1.7 + k * 2.05 + (R() - 0.5) * 0.7;
      const ang = fwdA + ((a + 0.5) / ARMS - 0.5) * 2 * SPREAD + (k - 2) * 0.06 * (a < ARMS / 2 ? -1 : 1) + (R() - 0.5) * 0.12;
      const lift = (R() - 0.5) * 1.3 + (a % 2 ? 0.35 : -0.35) * k * 0.4;
      const id = addNode(v(Math.cos(ang) * rad, lift, Math.sin(ang) * rad), 0.7 + (R() - 0.5) * 0.24, k);
      edges.push({ a: prev, b: id, ring: false });
      if (a > 0 && k > 1 && R() > 0.55) edges.push({ a: id - RINGS, b: id, ring: true });
      prev = id;
    }
  }
  // two large compositions close to the viewer, cut by the frame
  const side = v(-fwdV[2], 0, fwdV[0]);
  for (const sg of [-1, 1]) {
    const id = addNode(add(scale(fwdV, 0.8), add(scale(side, sg * 5.2), v(0, 2.1 + sg * 0.5, 0))), 0.9, 1);
    edges.push({ a: 0, b: id, ring: false });
  }
  const adj: number[][] = nodes.map(() => []);
  edges.forEach((e) => { adj[e.a].push(e.b); adj[e.b].push(e.a); });

  // ---------- state ----------
  let W = 0, H = 0, dpr = 1, S = 1, zD = 0.22;
  let pT = 0, p = 0;
  let px = 0, py = 0, pxT = 0, pyT = 0, hov = 0, hovT = 0, mx = -1e4, my = -1e4;
  let introT0 = -1;
  const pulses: { o: V3; t0: number }[] = [];
  let running = false, visible = true, lastState = -1;
  const SPEED = 4.2; // world units per second for travelling changes

  const measure = () => {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const portrait = W < H;
    S = portrait ? Math.min(W * 0.54, H * 0.3) : Math.min(W * 0.4, H * 0.46);
    zD = clamp((W * 0.5) / ((portrait ? 3.6 : 7.4) * S), 0.12, 0.5);
    KEYS[KEYS.length - 1][1] = portrait ? 0.66 : FINAL_PITCH;
  };

  const readScroll = () => {
    const r = track.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    const raw = span > 0 ? clamp(-r.top / span) : 0;
    if (rm) pT = raw < 0.22 ? 0 : raw < 0.5 ? 0.46 : raw < 0.8 ? 0.72 : 1;
    else pT = raw;
  };

  const camera = (pp: number) => {
    let i = 0;
    while (i < KEYS.length - 2 && pp > KEYS[i + 1][0]) i++;
    const k0 = KEYS[Math.max(0, i - 1)], k1 = KEYS[i], k2 = KEYS[i + 1], k3 = KEYS[Math.min(KEYS.length - 1, i + 2)];
    const t = clamp((pp - k1[0]) / (k2[0] - k1[0]));
    const zk = (k: number[]) => (k === KEYS[KEYS.length - 1] ? Math.log(zD) : k[3]);
    const te = smooth(t) * 0.55 + t * 0.45;
    const lin = (j: number) => lerp(k1[j], k2[j], smooth(t));
    return {
      pitch: cr(k0[1], k1[1], k2[1], k3[1], te),
      yaw: cr(k0[2], k1[2], k2[2], k3[2], te),
      zoom: Math.exp(lerp(zk(k1), zk(k2), smooth(t))),
      tf: lin(4),
      ty: lin(5),
      invD: lin(6),
      roll: lin(7),
    };
  };

  // ---------- drawing ----------
  type Item = { z: number; pts: number[]; faces: { idx: number[]; fill: string }[]; alpha: number };
  const FACES: [number, number, number[]][] = [
    // axis (0=x,1=y,2=z), sign, corner indices (bit0=x, bit1=y, bit2=z)
    [0, 1, [1, 3, 7, 5]], [0, -1, [0, 4, 6, 2]],
    [1, 1, [2, 6, 7, 3]], [1, -1, [0, 1, 5, 4]],
    [2, 1, [4, 5, 7, 6]], [2, -1, [0, 2, 3, 1]],
  ];

  const shadeFill = (col: V3, n: V3, fog: number) => {
    const f = clamp(1 + 0.62 * (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2] - L0), 0.42, 1.32);
    const lift = Math.max(0, f - 1) * 70;
    const r = lerp(col[0] * f + lift, GROUND[0], fog), g = lerp(col[1] * f + lift, GROUND[1], fog), b = lerp(col[2] * f + lift, GROUND[2], fog);
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  };

  let qV = qId(), tgt = v(), Z = 1, cx = 0, cy = 0, invD = 0;
  const persp = (z: number) => (invD > 0 ? 1 / Math.max(0.12, 1 - z * invD) : 1);
  const proj = (w: V3): [number, number, number] => {
    const c = qRot(qV, sub(w, tgt));
    const f = persp(c[2]);
    return [cx + c[0] * Z * f, cy - c[1] * Z * f, c[2]];
  };

  const boxItem = (pose: Pose, h: V3, col: Col, alpha: number): Item | null => {
    const hx = h[0] * pose.s[0], hy = h[1] * pose.s[1], hz = h[2] * pose.s[2];
    if (hx < 1e-4 || alpha < 0.01) return null;
    const qT = qMul(qV, pose.q);
    const c = qRot(qV, sub(pose.p, tgt));
    if (invD > 0 && c[2] * invD > 0.8) return null; // too close to the eye
    const ax = qRot(qT, [hx, 0, 0]), ay = qRot(qT, [0, hy, 0]), az = qRot(qT, [0, 0, hz]);
    const pts: number[] = [];
    for (let i = 0; i < 8; i++) {
      const sx = i & 1 ? 1 : -1, sy = i & 2 ? 1 : -1, sz = i & 4 ? 1 : -1;
      const x = c[0] + sx * ax[0] + sy * ay[0] + sz * az[0];
      const y = c[1] + sx * ax[1] + sy * ay[1] + sz * az[1];
      const z = c[2] + sx * ax[2] + sy * ay[2] + sz * az[2];
      const f = persp(z);
      pts.push(cx + x * Z * f, cy - y * Z * f);
    }
    const nW = [qRot(pose.q, [1, 0, 0]), qRot(pose.q, [0, 1, 0]), qRot(pose.q, [0, 0, 1])];
    const fog = clamp((-c[2] - 0.8) / 11) * 0.66;
    const faces: Item['faces'] = [];
    const rgb = PAL[col];
    for (const [ai, sg, idx] of FACES) {
      // visible when the projected outline winds toward the viewer (works for axonometric and perspective)
      let area = 0;
      for (let j = 0; j < 4; j++) {
        const a = idx[j] * 2, b = idx[(j + 1) % 4] * 2;
        area += pts[a] * pts[b + 1] - pts[b] * pts[a + 1];
      }
      if (area > -0.6) continue;
      faces.push({ idx, fill: shadeFill(rgb, scale(nW[ai], sg), fog) });
    }
    return { z: c[2], pts, faces, alpha };
  };

  const drawItem = (it: Item) => {
    ctx.globalAlpha = it.alpha;
    for (const f of it.faces) {
      ctx.beginPath();
      const P = it.pts;
      ctx.moveTo(P[f.idx[0] * 2], P[f.idx[0] * 2 + 1]);
      for (let j = 1; j < 4; j++) ctx.lineTo(P[f.idx[j] * 2], P[f.idx[j] * 2 + 1]);
      ctx.closePath();
      ctx.fillStyle = f.fill;
      ctx.fill();
      ctx.strokeStyle = f.fill;
      ctx.stroke();
    }
  };

  const jolt = (node: Node, now: number) => {
    let J = 0;
    for (const pu of pulses) {
      const x = ((now - pu.t0) / 1000 - len(sub(node.pos, pu.o)) / SPEED) / 1.1;
      if (x > 0 && x < 1) J += Math.sin(Math.PI * x) * Math.exp(-2.2 * x) * 1.5;
    }
    return J;
  };

  const render = (now: number) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.7;

    const cam = camera(p);
    const tiltY = rm ? 0 : px * 0.2 * (1 - smooth((p - 0.7) / 0.2) * 0.6);
    const tiltX = rm ? 0 : -py * 0.14 * (1 - smooth((p - 0.7) / 0.2) * 0.6);
    qV = qMul(qZ(cam.roll), qMul(qX(cam.pitch + tiltX), qY(cam.yaw + tiltY)));
    Z = S * cam.zoom;
    tgt = add(scale(fwdV, cam.tf), v(0, cam.ty, 0));
    invD = cam.invD;
    const mobileShift = W < 700 ? H * 0.02 : 0;
    cx = W * (W < 700 ? 0.5 : 0.55); cy = H * (W < 700 ? 0.46 : 0.47) - mobileShift;

    const sP = primaryS(p);
    const fieldA = smooth((p - 0.73) / 0.12);
    const waveR = Math.max(0, (p - 0.8) / 0.2) * 8.4;

    // node states
    nodes.forEach((n) => {
      if (n.primary) { n.s = sP; return; }
      const sScroll = clamp((waveR - n.d + 0.5) / 1.3);
      const sClick = rm ? (now >= n.tArr ? 1 : 0) : clamp((now - n.tArr) / 1300);
      n.s = Math.max(sScroll, sClick);
      const c = proj(n.pos); n.sx = c[0]; n.sy = c[1];
    });
    { const c = proj(nodes[0].pos); nodes[0].sx = c[0]; nodes[0].sy = c[1]; }

    // links between compositions (drawn first: behind everything)
    if (fieldA > 0.01) {
      // only the path of the change is drawn: a cadmium line runs ahead of each arrival, then settles
      ctx.strokeStyle = 'rgb(247,201,16)';
      for (const e of edges) {
        const A = nodes[e.a], B = nodes[e.b];
        const [src, dst, sa, sb] = A.s >= B.s ? [A, B, A.s, B.s] : [B, A, B.s, A.s];
        const f = sa >= 0.3 ? clamp(sb / 0.3) : 0;
        if (f < 0.001) continue;
        const a = proj(src.pos), b = proj(dst.pos);
        const settle = smooth((sb - 0.3) / 0.7);
        ctx.globalAlpha = fieldA * lerp(0.95, e.ring ? 0.16 : 0.3, settle);
        ctx.lineWidth = lerp(1.4, 0.8, settle);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(lerp(a[0], b[0], f), lerp(a[1], b[1], f)); ctx.stroke();
      }
      ctx.lineWidth = 0.7;
    }

    const items: Item[] = [];

    // primary composition
    const introOn = introT0 >= 0 && !rm;
    const introT = introOn ? clamp((now - introT0) / 1900) : 1;
    const pw = v((mx - cx) / Z, -(my - cy) / Z, 0);
    const hovK = hov * (1 - smooth(p / 0.12));
    const primary = nodes[0];
    const J0 = jolt(primary, now);
    primary.frags.forEach((f, i) => {
      let pose = poseAt(f, sP);
      if (introT < 1) {
        const u = easeOutExpo(clamp((introT - f.o2 * 0.42) / 0.58));
        const sgn = f.parent % 2 ? 1 : -1;
        const d = v(Math.cos(0.49) * sgn, Math.sin(0.49) * sgn, 0);
        pose = { ...pose, p: add(pose.p, scale(d, (1 - u) * 3.4)) };
      }
      if (hovK > 0.001) {
        const dx = pose.p[0] - pw[0], dy = pose.p[1] - pw[1];
        const g = Math.exp(-(dx * dx + dy * dy) / 0.09) * hovK;
        if (g > 0.002) {
          const dl = Math.hypot(dx, dy) || 1;
          pose = { ...pose, p: add(pose.p, v((dx / dl) * 0.06 * g, (dy / dl) * 0.06 * g, 0.22 * g)), q: qMul(qAxis(v(-dy, dx, 0), 0.5 * g), pose.q) };
        }
      }
      if (J0 > 0.001) {
        pose = { ...pose, p: add(pose.p, add(scale(sub(pose.p, primary.pos), 0.28 * J0), v(0, 0, 0.3 * J0 * (f.o2 - 0.5)))), q: qMul(qAxis(wob[i], 0.55 * J0), pose.q) };
      }
      const it = boxItem(pose, f.h, f.col, 1);
      if (it) items.push(it);
    });

    // primary agent
    {
      const dir = norm(sub(IMPACT, AGENT_START));
      const qTravel = qLook(dir, v(0, 0, 1));
      let pose: Pose;
      const ta = clamp((p - 0.04) / 0.22);
      if (p < 0.26) {
        pose = { p: lerp3(AGENT_START, IMPACT, easeIn2(ta)), q: qTravel, s: v(1 + ta * 0.6, 1, 1) };
      } else {
        const Bp: Pose = { p: add(add(IMPACT, scale(dir, 0.32)), v(0, 0, 0.3)), q: qMul(qZ(0.7), qTravel), s: v(1.4, 1.1, 1.1) };
        const a = clamp(sP * 2), b = clamp(sP * 2 - 1);
        if (b > 0) { const t = easeInOut3(b); pose = { p: lerp3(Bp.p, AGENT_C.p, t), q: qSlerp(Bp.q, AGENT_C.q, t), s: lerp3(Bp.s, AGENT_C.s, t) }; }
        else { const t = easeOut3(a); pose = { p: lerp3(IMPACT, Bp.p, t), q: qSlerp(qTravel, Bp.q, t), s: lerp3(v(1.6, 1, 1), Bp.s, t) }; }
      }
      if (introT < 1) pose = { ...pose, s: v(pose.s[0] * easeOutExpo(clamp((introT - 0.55) / 0.45)), pose.s[1], pose.s[2]) };
      if (J0 > 0.001) pose = { ...pose, p: add(pose.p, v(0, 0, 0.25 * J0)) };
      const it = boxItem(pose, AGENT_H, 'cad', 1);
      if (it) { it.z += 0.02; items.push(it); }

      // its path, drawn behind the planes
      const trailA = introT >= 1 ? (p < 0.03 ? 0 : 1) * (1 - smooth((p - 0.5) / 0.2)) : 0;
      if (trailA > 0.01) {
        const a = proj(AGENT_START), b = proj(p < 0.26 ? pose.p : IMPACT);
        ctx.globalAlpha = trailA * 0.85;
        ctx.strokeStyle = 'rgb(247,201,16)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.lineWidth = 0.7;
      }
    }

    // the field
    if (fieldA > 0.01) {
      for (let ni = 1; ni < nodes.length; ni++) {
        const n = nodes[ni];
        const J = jolt(n, now);
        n.frags.forEach((f, i) => {
          let pose = poseAt(f, n.s);
          if (J > 0.001) pose = { ...pose, p: add(pose.p, scale(sub(pose.p, n.pos), 0.3 * J)), q: qMul(qAxis(wob[i % wob.length], 0.5 * J), pose.q) };
          const it = boxItem(pose, f.h, f.col, fieldA);
          if (it) items.push(it);
        });
        const t = clamp((n.s - 0.18) / 0.6);
        if (t > 0) {
          const from = sub(n.agentC.p, scale(n.agentFrom, 1.5 * n.k));
          const e = easeOut3(t);
          const pose: Pose = { p: lerp3(from, n.agentC.p, e), q: n.agentC.q, s: v(lerp(0.4, n.agentC.s[0], e), n.agentC.s[1], n.agentC.s[2]) };
          const it = boxItem(pose, scale(AGENT_H, n.k), 'cad', fieldA);
          if (it) { it.z += 0.02; items.push(it); }
        }
      }
    }

    items.sort((a, b) => a.z - b.z);
    for (const it of items) drawItem(it);
    ctx.globalAlpha = 1;

    // DOM state
    const st = p < 0.2 ? 0 : p < 0.5 ? 1 : p < 0.78 ? 2 : 3;
    if (st !== lastState) { stage.dataset.state = String(st); lastState = st; }
    stage.style.setProperty('--p', p.toFixed(4));
  };

  // ---------- loop ----------
  const frame = (now: number) => {
    let busy = false;
    if (rm) p = pT;
    else { p += (pT - p) * 0.14; if (Math.abs(pT - p) > 0.0004) busy = true; else p = pT; }
    const k = 0.12;
    px += (pxT - px) * k; py += (pyT - py) * k; hov += (hovT - hov) * 0.1;
    if (Math.abs(pxT - px) + Math.abs(pyT - py) + Math.abs(hovT - hov) > 0.002) busy = true;
    if (introT0 >= 0 && now - introT0 < 1950) busy = true;
    for (let i = pulses.length - 1; i >= 0; i--) {
      if ((now - pulses[i].t0) / 1000 > 12 / SPEED + 1.2) pulses.splice(i, 1);
    }
    if (pulses.length) busy = true;
    if (!rm && nodes.some((n) => now >= n.tArr - 5 && now - n.tArr < 1350 || (n.tArr > now && isFinite(n.tArr)))) busy = true;
    if (visible) render(now);
    if (busy && visible) requestAnimationFrame(frame);
    else running = false;
  };
  const request = () => { if (!running) { running = true; requestAnimationFrame(frame); } };

  // ---------- input ----------
  const onScroll = () => { readScroll(); if (visible) request(); };
  window.addEventListener('scroll', onScroll, { passive: true });
  new ResizeObserver(() => { measure(); readScroll(); request(); }).observe(canvas);
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) request(); }).observe(stage);

  if (fine && !rm) {
    stage.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top;
      pxT = clamp((mx / W) * 2 - 1, -1, 1); pyT = clamp((my / H) * 2 - 1, -1, 1);
      hovT = 1;
      request();
    });
    stage.addEventListener('pointerleave', () => { pxT = 0; pyT = 0; hovT = 0; request(); });
  }

  canvas.addEventListener('click', (e) => {
    if (rm) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const now = performance.now();
    if (p < 0.72) { pulses.push({ o: v(), t0: now }); request(); return; }
    // nearest composition on screen
    let best = -1, bd = Infinity;
    nodes.forEach((n, i) => { const d = Math.hypot(n.sx - x, n.sy - y); if (d < bd) { bd = d; best = i; } });
    if (best < 0 || bd > Math.max(70, W * 0.08)) return;
    const n = nodes[best];
    if (n.s < 0.98 && !n.primary) {
      // an agent enters here; the change travels outward along the links, weakening with each step
      n.agentFrom = norm(v(0.3, -1, 0.2));
      const arr = new Map<number, number>([[best, now]]);
      const strength = new Map<number, number>([[best, 1]]);
      const queue = [best];
      while (queue.length) {
        const cur = queue.shift()!;
        const st = strength.get(cur)!;
        for (const nb of adj[cur]) {
          const ns = st * 0.62;
          if (ns < 0.3 || arr.has(nb)) continue;
          const dt = (len(sub(nodes[nb].pos, nodes[cur].pos)) / SPEED) * 1000 + 350;
          arr.set(nb, arr.get(cur)! + dt); strength.set(nb, ns); queue.push(nb);
          nodes[nb].agentFrom = norm(sub(nodes[nb].pos, nodes[cur].pos));
        }
      }
      arr.forEach((t, i) => { if (nodes[i].s < 0.98) nodes[i].tArr = Math.min(nodes[i].tArr, t); });
    } else {
      pulses.push({ o: n.pos, t0: now });
    }
    request();
  });

  // ---------- boot ----------
  measure();
  readScroll();
  p = pT;
  if (!rm && pT < 0.02) introT0 = performance.now();
  stage.classList.add('is-live');
  request();
}
