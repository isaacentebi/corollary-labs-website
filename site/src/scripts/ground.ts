// The ground: a raked field of soft relief lines, the stones resting on it, and the closed contours around groups.
// One fragment shader (WebGL2), evaluated analytically per pixel.
//
//   psi(p) = p.y + sum_i k_i R_i tanh(|p - c_i| / R_i)       the raked lines are level sets of psi
//
// Clearings (a heading, or a group of stones) are built into the same function rather than masked on top:
//   psi' = psi0 + (psi - psi0) * (1 - k (1 - F(s)))
// where s is a distance to the clearing, F rises smoothly from 0 at the edge to 1 at a moat width W, and psi0 is
// the value of psi at the clearing. The edge is therefore itself a level set: lines part around it and rejoin,
// they never stop in stubs, and fading k to 0 lets them flow back in without a seam.
//
// A group's clearing is the level set E(p) = C of E(p) = sum_i w_i |p - c_i| (an n-ellipse around its stones).
// Inside it the ground carries nested closed rings (level sets of E) and the boundary is drawn as one closed line.
// When a stone joins (its weight w rises) or stones move, the boundary deforms continuously; it is never cut.

export const MAXS = 40;
export const MAXG = 16;

export type StoneState = {
  x: number; y: number;     // world px
  r: number;                // radius (px)
  aspect: number;           // ellipse aspect
  rot: number;              // rotation (rad)
  k: number;                // ring strength on the raked lines
  rose: number;             // 0 = stone, 1 = the rose one
  lift: number;             // 0 = sunk (absent), 1 = resting on the ground
  seed: number;
  gloss: number;            // 0 matte … 1 lacquered
  squar: number;            // 0 round pebble … 1 flatter, squarer slab
  tone: number;             // 0 pale … 1 dark basalt
  gw: number;               // weight in its group's contour (0 = not yet part of it)
};

export type GroupState = { members: StoneState[]; tint: number; show: number; moat?: number; pad?: number; soft?: number };

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const mix3 = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// day: a cool mineral lilac; dusk: the same ground after the light has gone
export const DAY = { ground: hex('#DCD9E2'), light: hex('#F6F5F8'), shade: hex('#8A849D'), ink: hex('#2A2533') };
export const DUSK = { ground: hex('#2A2733'), light: hex('#6A6480'), shade: hex('#121017'), ink: hex('#DCD6E6') };
export const STONE = hex('#EEECF0');
export const BASALT = hex('#3D3846');
export const ROSE = hex('#B8385F');

const VERT = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;
precision highp int;
#define MAXS ${MAXS}
#define MAXG ${MAXG}
uniform vec2 uRes; uniform float uScale; uniform vec2 uCam; uniform float uZoom; uniform float uSpace;
uniform float uTime; uniform float uFlow; uniform float uTilt; uniform float uDusk;
uniform int uN; uniform vec4 uS[MAXS]; uniform vec4 uT[MAXS]; uniform vec4 uU[MAXS];
uniform int uNG; uniform vec4 uGA[MAXG]; uniform vec4 uGB[MAXG]; uniform vec4 uGC[MAXG];
uniform vec4 uCap;   // centre x, y, half-size x, y
uniform vec4 uCapK;  // k, corner radius, moat width, psi0
uniform vec4 uMouse; // x, y, strength, radius
uniform vec3 uGround; uniform vec3 uLight; uniform vec3 uShade; uniform vec3 uInk;
uniform vec3 uStone; uniform vec3 uBasalt; uniform vec3 uRose;
out vec4 outColor;

float th(float x){ float e = exp(-2.0*abs(x)); float t = (1.0-e)/(1.0+e); return x < 0.0 ? -t : t; }
float gR(int i){
  float lift = uT[i].w; float a = uS[i].w; float sq = uU[i].y;
  return uS[i].z * (0.35 + 0.65*lift) * mix(1.0, max(a, 1.0/a), 0.6) * (1.0 + 0.12*sq);
}
float hash(vec2 p){ p = fract(p*vec2(443.897, 441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }

void main(){
  vec2 frag = gl_FragCoord.xy / uScale;
  frag.y = uRes.y - frag.y;
  // a camera over a plane that can tilt away at the top (three-quarter view)
  vec2 sc = frag - uRes*0.5;
  float D = uRes.y * 1.6, cT = cos(uTilt), sT = sin(uTilt);
  float v = sc.y * D / (D*cT + sc.y*sT);
  float persp = (D - v*sT) / D;
  vec2 p = vec2(sc.x*persp, v) / uZoom + uCam;
  float px = persp / uZoom * (1.0 + 0.5*(1.0/cT - 1.0));

  vec3 L = normalize(vec3(-0.55, -0.7, 0.62));

  float psi = p.y;
  vec2 g = vec2(0.0, 1.0);
  float shadow = 0.0, ao = 0.0, rose = 0.0;
  float hitF = 2.0; vec2 hitQ = vec2(0.0); vec4 hitT = vec4(0.0); vec4 hitU = vec4(0.0); float hitR = 1.0; float hitN = 2.0;

  for (int i = 0; i < MAXS; i++) {
    if (i >= uN) break;
    vec4 s = uS[i]; vec4 t = uT[i]; vec4 u = uU[i];
    float lift = t.w;
    if (lift < 0.002) continue;
    vec2 d = p - s.xy;
    float dist = length(d);
    float r = s.z * (0.35 + 0.65*lift);
    float R = r * 2.4 + 18.0;
    float k = t.y * lift;
    if (dist > R * 4.2) { psi += k * R; continue; }
    float tt = th(dist / R);
    psi += k * R * tt;
    g += k * (1.0 - tt*tt) * d / max(dist, 1e-3);

    // stone shape: a rotated superellipse (round pebble … flatter slab) with a slow organic wobble
    float c = cos(t.x), sn = sin(t.x);
    vec2 q = vec2(c*d.x + sn*d.y, -sn*d.x + c*d.y) / vec2(r * s.w, r / s.w);
    float n = 2.0 + 2.4*u.y;
    vec2 aq = abs(q) + 1e-5;
    float f0 = pow(pow(aq.x, n) + pow(aq.y, n), 1.0/n);
    float ang = atan(q.y, q.x);
    float wob = 1.0 + (0.035 + 0.03*u.y)*sin(3.0*ang + float(i)*1.7) + 0.02*sin(5.0*ang - float(i)*2.3);
    float f = f0 / wob;

    vec2 ds = d - vec2(0.42, 0.55) * r * (0.42 - 0.18*u.y) * lift;
    vec2 qs = vec2(c*ds.x + sn*ds.y, -sn*ds.x + c*ds.y) / vec2(r*s.w, r/s.w);
    shadow = max(shadow, smoothstep(1.55, 0.72, length(qs)) * 0.55 * lift);
    ao = max(ao, exp(-max(f - 1.0, 0.0) * 5.0) * 0.5 * lift);
    rose += t.z * lift * exp(-max(dist - r, 0.0) / (min(r, 36.0) * 1.6 + 26.0)) * (0.6 + 0.4 * u.x);

    if (f < 1.0 + 2.0*px/r && f < hitF) { hitF = f; hitQ = q; hitT = t; hitU = u; hitR = r; hitN = n; }
  }

  // a heading's clearing: a rounded box, part of the same function
  if (uCapK.x > 0.001) {
    vec2 d = p - uCap.xy; vec2 b = max(uCap.zw - uCapK.y, vec2(0.0)); vec2 q = abs(d) - b;
    vec2 mq = max(q, 0.0); float lq = length(mq);
    float s = lq + min(max(q.x, q.y), 0.0) - uCapK.y;
    vec2 gs = lq > 1e-4 ? sign(d) * mq / lq : (q.x > q.y ? vec2(sign(d.x), 0.0) : vec2(0.0, sign(d.y)));
    float W = uCapK.z; float x = clamp(s / W, 0.0, 1.0);
    float F = x*x*(3.0 - 2.0*x); float dF = (s > 0.0 && s < W) ? 6.0*x*(1.0 - x)/W : 0.0;
    float M = 1.0 - uCapK.x*(1.0 - F);
    float dpsi = psi - uCapK.w;
    g = g*M + dpsi*uCapK.x*dF*gs; psi = uCapK.w + dpsi*M;
  }

  // groups: a moat in the raked lines, closed rings inside, one closed line on the boundary
  float inM = 0.0, Tin = 0.0, lineA = 0.0, lineTint = 0.0, fillT = 0.0; vec2 gin = vec2(0.0);
  for (int gi = 0; gi < MAXG; gi++) {
    if (gi >= uNG) break;
    vec4 A = uGA[gi]; vec4 B = uGB[gi]; vec4 C = uGC[gi];
    if (B.w < 0.002 || length(p - B.xy) > B.z) continue;
    int st = int(A.x + 0.5), cnt = int(A.y + 0.5);
    float ks = C.z;
    // E = soft minimum over members of two terms: the distance to the stone's edge, and the distance to a tapered
    // bridge from the group's centre to the stone. The bridges make the region star-shaped around the centre, so
    // the contour E = pad stretches into a neck when a stone is pulled away and never splits into two.
    float mn = 1e9;
    for (int j = 0; j < 8; j++) {
      if (j >= cnt) break;
      int i = st + j;
      float w = uT[i].w * uU[i].w;
      if (w < 0.001) continue;
      vec2 pa = p - B.xy, ba = uS[i].xy - B.xy;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-3), 0.0, 1.0);
      vec2 qq = pa - ba*h; float bridge = sqrt(dot(qq, qq) + 196.0) - 14.0 - mix(C.w, gR(i)*0.2, h);
      mn = min(mn, min(length(p - uS[i].xy) - gR(i), bridge));
    }
    if (mn > 1e8) continue;
    float S = 0.0; vec2 gE = vec2(0.0);
    for (int j = 0; j < 8; j++) {
      if (j >= cnt) break;
      int i = st + j;
      float w = uT[i].w * uU[i].w;
      if (w < 0.001) continue;
      vec2 d = p - uS[i].xy; float l = max(length(d), 1e-3);
      float e = w*w*w * exp(-(l - gR(i) - mn) / ks);
      S += e; gE += e * d / l;
      vec2 pa = p - B.xy, ba = uS[i].xy - B.xy;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-3), 0.0, 1.0);
      vec2 q = pa - ba*h; float lq = sqrt(dot(q, q) + 196.0) - 14.0; vec2 gq = q / (lq + 14.0);
      float eb = w * exp(-(lq - mix(C.w, gR(i)*0.2, h) - mn) / ks);
      S += eb; gE += eb * gq;
    }
    float s = mn - ks * log(S) - A.z;
    vec2 gs = gE / S;
    float show = B.w;
    float W = C.y; float x = clamp(s / W, 0.0, 1.0);
    float F = x*x*(3.0 - 2.0*x); float dF = (s > 0.0 && s < W) ? 6.0*x*(1.0 - x)/W : 0.0;
    float M = 1.0 - show*(1.0 - F);
    float dpsi = psi - A.w;
    g = g*M + dpsi*show*dF*gs; psi = A.w + dpsi*M;

    float gl = max(length(gs), 0.08);
    float m = show * clamp(0.5 - s/(gl*px*1.2), 0.0, 1.0);
    if (m > inM) { inM = m; Tin = (-s + uFlow*0.35) / uSpace; gin = -gs / uSpace; fillT = C.x; }
    float dpx = s / (gl*px);
    float la = show * exp(-dpx*dpx / 1.9);
    if (la > lineA) { lineA = la; lineTint = C.x; }
  }

  // the cursor: a soft, rounded dip that lags behind the pointer
  if (uMouse.z > 0.001) {
    vec2 dm = p - uMouse.xy; float R = uMouse.w;
    float e = exp(-dot(dm, dm) / (R*R));
    float A = uMouse.z * 0.55 * R;
    psi -= A*e; g += A*e*2.0*dm/(R*R);
  }

  // relief
  float T = (psi - uFlow) / uSpace;
  float amp = smoothstep(0.42, 0.16, length(g)/uSpace*px);
  vec2 gh = (3.14159 * sin(6.2831853*T) / uSpace) * g * amp;
  float ampIn = smoothstep(0.42, 0.16, length(gin)*px);
  vec2 ghIn = 3.14159 * sin(6.2831853*Tin) * gin * ampIn * 0.85;
  gh = mix(gh, ghIn, inM);
  float depth = uSpace * 0.16;
  vec3 nrm = normalize(vec3(-gh * depth, 1.0));
  float dif = dot(nrm, L) - L.z;
  float valley = mix(pow(0.5 - 0.5*cos(6.2831853*T), 6.0) * amp, pow(0.5 - 0.5*cos(6.2831853*Tin), 6.0) * ampIn, inM);

  vec3 col = uGround;
  col = dif > 0.0 ? mix(col, uLight, clamp(dif*2.2, 0.0, 1.0)) : mix(col, uShade, clamp(-dif*1.9, 0.0, 1.0));
  col = mix(col, uShade, valley * 0.10);

  vec2 sv = frag / uRes;
  float sun = 1.0 - length((sv - vec2(0.12, -0.1)) * vec2(0.8, 1.0));
  col = mix(col, uLight, clamp(sun, 0.0, 1.0) * 0.14);
  col = mix(col, uShade, clamp(-sun + 0.35, 0.0, 1.0) * 0.14);

  // group interior tint and boundary line
  col = mix(col, uRose, inM * fillT * (0.05 + 0.05*uDusk));
  vec3 lc = mix(uInk, uRose * (1.0 + 0.5*uDusk), lineTint);
  col = mix(col, lc, lineA * (0.62 - 0.12*uDusk));

  float rz = clamp(rose, 0.0, 1.0);
  col = mix(col, mix(uRose, uLight, 0.35 - 0.3*uDusk), rz * (0.3 + 0.25*uDusk));
  vec3 shadowCol = mix(uShade * 0.9, uRose * 0.6, rz * 0.4);
  col = mix(col, shadowCol, shadow * 0.55);
  col = mix(col, shadowCol * 0.95, ao * 0.35);

  // stone
  if (hitF < 1.5) {
    float edge = clamp((1.0 - hitF) * hitR / (1.2*px), 0.0, 1.0);
    float f2 = clamp(hitF, 0.0, 0.999);
    vec2 aq = abs(hitQ) + 1e-5;
    vec2 gq = sign(hitQ) * pow(aq, vec2(hitN - 1.0));
    vec2 qd = gq / max(length(gq), 1e-5);
    float c = cos(hitT.x), sn = sin(hitT.x);
    vec2 wdir = vec2(c*qd.x - sn*qd.y, sn*qd.x + c*qd.y);
    float flat_ = hitU.y;
    float prof = mix(pow(f2, 1.6), pow(f2, 5.0), flat_);
    float nz = pow(1.0 - f2*f2, 0.5) * mix(1.35, 2.6, flat_) + 0.05;
    vec3 sn3 = normalize(vec3(wdir * prof, nz));
    float lam = clamp(dot(sn3, L), 0.0, 1.0);
    float wrap = clamp(dot(sn3, L) * 0.5 + 0.5, 0.0, 1.0);
    vec3 base = mix(mix(uStone, uBasalt, hitU.z), uRose, hitT.z);
    vec3 dark = mix(mix(uShade * 1.02, uBasalt * 0.45, hitU.z), uRose * 0.55 + vec3(0.02, 0.0, 0.04), hitT.z);
    vec3 sc = mix(dark, base, smoothstep(0.05, 0.85, wrap));
    sc = mix(sc, uLight, pow(lam, 6.0) * (0.3 + 0.2*hitT.z) * (1.0 - 0.5*hitU.z));
    // lacquer: a sharp highlight and a reflection of the ground along the rim
    vec3 R3 = reflect(-L, sn3);
    float spec = pow(clamp(R3.z, 0.0, 1.0), 60.0);
    sc += vec3(1.0) * spec * hitU.x * 0.75;
    sc = mix(sc, uGround * 1.05, hitU.x * 0.22 * smoothstep(0.6, 1.0, f2));
    sc += uRose * hitT.z * 0.2 * pow(1.0 - sn3.z, 2.0) * (1.0 - lam);
    sc = mix(sc, uGround, 0.16 * smoothstep(0.55, 1.0, f2) * clamp(dot(wdir, vec2(0.4, 0.9)), 0.0, 1.0));
    col = mix(col, sc, edge * smoothstep(0.0, 0.08, hitT.w));
  }

  col += (hash(frag + fract(uTime)*37.0) - 0.5) * 0.02;
  outColor = vec4(col, 1.0);
}
`;

// ── the same field on the CPU, for the values the shader needs as constants ───────────────────
function stonePsi(stones: StoneState[], x: number, y: number) {
  let psi = y;
  for (const s of stones) {
    if (s.lift < 0.002) continue;
    const r = s.r * (0.35 + 0.65 * s.lift), R = r * 2.4 + 18, k = s.k * s.lift;
    const d = Math.hypot(x - s.x, y - s.y);
    psi += d > R * 4.2 ? k * R : k * R * Math.tanh(d / R);
  }
  return psi;
}
export type Cap = { cx: number; cy: number; hx: number; hy: number; rad: number; moat: number; k: number };
function sdBox(c: Cap, x: number, y: number) {
  const bx = Math.max(c.hx - c.rad, 0), by = Math.max(c.hy - c.rad, 0);
  const qx = Math.abs(x - c.cx) - bx, qy = Math.abs(y - c.cy) - by;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - c.rad;
}
const smooth01 = (x: number) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
export const effR = (s: StoneState) => s.r * (0.35 + 0.65 * s.lift) * Math.max(s.aspect, 1 / s.aspect) * (1.06 + 0.2 * s.squar);

// the group contour on the CPU: E(p) = soft minimum of (distance to each stone's edge), weighted; contour at E = pad
export const gR = (s: StoneState) => s.r * (0.35 + 0.65 * s.lift) * (1 + (Math.max(s.aspect, 1 / s.aspect) - 1) * 0.6) * (1 + 0.12 * s.squar);
export function groupField(members: StoneState[], ks: number) {
  const w = members.map((s) => s.lift * s.gw);
  const n = w.reduce((a, b) => a + b, 0);
  let cx = 0, cy = 0;
  members.forEach((s, i) => { cx += s.x * w[i]; cy += s.y * w[i]; });
  if (n > 0) { cx /= n; cy /= n; }
  const rc = n > 0 ? (members.reduce((a, s, i) => a + gR(s) * w[i], 0) / n) * 0.3 : 0;
  const terms = (x: number, y: number) => {
    const out: [number, number][] = [];
    members.forEach((s, i) => {
      if (w[i] < 0.001) return;
      out.push([Math.hypot(x - s.x, y - s.y) - gR(s), w[i] ** 3]);
      const bx = s.x - cx, by = s.y - cy, px = x - cx, py = y - cy;
      const h = Math.min(1, Math.max(0, (px * bx + py * by) / Math.max(bx * bx + by * by, 1e-3)));
      out.push([Math.sqrt((px - bx * h) ** 2 + (py - by * h) ** 2 + 196) - 14 - (rc + (gR(s) * 0.2 - rc) * h), w[i]]);
    });
    return out;
  };
  const E = (x: number, y: number) => {
    const t = terms(x, y);
    if (!t.length) return Infinity;
    const mn = Math.min(...t.map((a) => a[0]));
    return mn - ks * Math.log(t.reduce((a, [v, ww]) => a + ww * Math.exp(-(v - mn) / ks), 0));
  };
  return { E, n, cx, cy, rc };
}

export type Frame = {
  cam: [number, number];
  zoom: number;
  space: number;
  stones: StoneState[];
  groups?: GroupState[];
  cap?: Cap | null;
  mouse?: { x: number; y: number; s: number; R: number } | null;
  flow?: number;
  tilt?: number;
  dusk?: number;
  time: number;
};

export class Ground {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null> = {};
  S = new Float32Array(MAXS * 4); T = new Float32Array(MAXS * 4); U = new Float32Array(MAXS * 4);
  GA = new Float32Array(MAXG * 4); GB = new Float32Array(MAXG * 4); GC = new Float32Array(MAXG * 4);
  w = 0; h = 0; scale = 1;
  maxScale = 1.5;

  constructor(canvas: HTMLCanvasElement, opts: { maxScale?: number } = {}) {
    this.canvas = canvas;
    this.maxScale = opts.maxScale ?? 1.5;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no webgl2');
    this.gl = gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    this.prog = p;
    gl.useProgram(p);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uRes', 'uScale', 'uCam', 'uZoom', 'uSpace', 'uTime', 'uFlow', 'uTilt', 'uDusk', 'uN', 'uS', 'uT', 'uU', 'uNG', 'uGA', 'uGB', 'uGC',
      'uCap', 'uCapK', 'uMouse', 'uGround', 'uLight', 'uShade', 'uInk', 'uStone', 'uBasalt', 'uRose'])
      this.loc[n] = gl.getUniformLocation(p, n);
    gl.uniform3fv(this.loc.uStone, STONE); gl.uniform3fv(this.loc.uBasalt, BASALT); gl.uniform3fv(this.loc.uRose, ROSE);
  }

  resize(w: number, h: number, scale = Math.min(window.devicePixelRatio || 1, this.maxScale)) {
    this.w = w; this.h = h;
    const W = Math.max(1, Math.round(w * scale)), H = Math.max(1, Math.round(h * scale));
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
    this.scale = W / w;
    this.gl.viewport(0, 0, W, H);
  }

  // screen (css px, relative to the canvas' top-left) → world, mirroring the shader's camera
  toWorld(sx: number, sy: number, f: Pick<Frame, 'cam' | 'zoom' | 'tilt'>) {
    const x = sx - this.w / 2, y = sy - this.h / 2, tilt = f.tilt ?? 0;
    const D = this.h * 1.6, v = (y * D) / (D * Math.cos(tilt) + y * Math.sin(tilt));
    const persp = (D - v * Math.sin(tilt)) / D;
    return [(x * persp) / f.zoom + f.cam[0], v / f.zoom + f.cam[1]] as [number, number];
  }

  draw(f: Frame) {
    const gl = this.gl, L = this.loc;
    // pack: each group's members contiguous, then the rest
    const order: StoneState[] = [];
    const groups = (f.groups ?? []).slice(0, MAXG);
    const gmeta: { start: number; count: number; g: GroupState }[] = [];
    const seen = new Set<StoneState>();
    for (const g of groups) {
      const mem = g.members.filter((s) => !seen.has(s)).slice(0, 8);
      if (order.length + mem.length > MAXS) break;
      gmeta.push({ start: order.length, count: mem.length, g });
      mem.forEach((s) => { seen.add(s); order.push(s); });
    }
    for (const s of f.stones) if (!seen.has(s) && order.length < MAXS && (s.lift > 0.002)) { seen.add(s); order.push(s); }
    const n = order.length;
    for (let i = 0; i < n; i++) {
      const s = order[i];
      this.S.set([s.x, s.y, s.r, s.aspect], i * 4);
      this.T.set([s.rot, s.k, s.rose, s.lift], i * 4);
      this.U.set([s.gloss, s.squar, s.tone, s.gw], i * 4);
    }
    // constants: the value of the field at each clearing
    const c = f.cap && f.cap.k > 0.001 ? f.cap : null;
    const psiCap = c ? stonePsi(order, c.cx, c.cy) : 0;
    const psiAt = (x: number, y: number) => {
      let v = stonePsi(order, x, y);
      if (c) { const M = 1 - c.k * (1 - smooth01(sdBox(c, x, y) / c.moat)); v = psiCap + (v - psiCap) * M; }
      return v;
    };
    gmeta.forEach((m, gi) => {
      const g = m.g, pad = g.pad ?? 40, moat = g.moat ?? 120, ks = g.soft ?? 26;
      const mem = order.slice(m.start, m.start + m.count);
      const lv = groupField(mem, ks);
      let bR = 0;
      mem.forEach((s) => { if (s.lift * s.gw > 0.001) bR = Math.max(bR, Math.hypot(s.x - lv.cx, s.y - lv.cy) + effR(s)); });
      bR += pad + moat + ks * 2 + 30;
      const show = lv.n < 0.01 ? 0 : g.show;
      this.GA.set([m.start, m.count, pad, psiAt(lv.cx, lv.cy)], gi * 4);
      this.GB.set([lv.cx, lv.cy, bR, show], gi * 4);
      this.GC.set([g.tint, moat, ks, lv.rc], gi * 4);
    });

    const dusk = f.dusk ?? 0;
    gl.uniform3fv(L.uGround, mix3(DAY.ground, DUSK.ground, dusk));
    gl.uniform3fv(L.uLight, mix3(DAY.light, DUSK.light, dusk));
    gl.uniform3fv(L.uShade, mix3(DAY.shade, DUSK.shade, dusk));
    gl.uniform3fv(L.uInk, mix3(DAY.ink, DUSK.ink, dusk));
    gl.uniform1f(L.uDusk, dusk);
    gl.uniform2f(L.uRes, this.w, this.h);
    gl.uniform1f(L.uScale, this.scale);
    gl.uniform2f(L.uCam, f.cam[0], f.cam[1]);
    gl.uniform1f(L.uZoom, f.zoom);
    gl.uniform1f(L.uSpace, f.space);
    gl.uniform1f(L.uTime, f.time);
    gl.uniform1f(L.uFlow, f.flow ?? 0);
    gl.uniform1f(L.uTilt, f.tilt ?? 0);
    gl.uniform1i(L.uN, n);
    gl.uniform4fv(L.uS, this.S); gl.uniform4fv(L.uT, this.T); gl.uniform4fv(L.uU, this.U);
    gl.uniform1i(L.uNG, gmeta.length);
    gl.uniform4fv(L.uGA, this.GA); gl.uniform4fv(L.uGB, this.GB); gl.uniform4fv(L.uGC, this.GC);
    gl.uniform4f(L.uCap, c?.cx ?? 0, c?.cy ?? 0, c?.hx ?? 0, c?.hy ?? 0);
    gl.uniform4f(L.uCapK, c?.k ?? 0, c?.rad ?? 1, c?.moat ?? 1, psiCap);
    const m = f.mouse;
    gl.uniform4f(L.uMouse, m?.x ?? 0, m?.y ?? 0, m?.s ?? 0, m?.R ?? 60);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

// a stone inside a group? (for keeping clicks out of clearings)
export function insideGroup(g: GroupState, x: number, y: number) {
  const lv = groupField(g.members, g.soft ?? 26);
  return lv.n > 0.01 && lv.E(x, y) < (g.pad ?? 40) + (g.moat ?? 120) * 0.3;
}
export function insideCap(c: Cap | null | undefined, x: number, y: number) {
  return !!c && c.k > 0.2 && sdBox(c, x, y) < c.moat * 0.4;
}
