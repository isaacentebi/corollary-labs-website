// The ground: a raked field of soft relief lines, and the stones resting on it.
// Everything is one fragment shader evaluated analytically per pixel:
//   psi(p) = p.y + sum_i k_i R_i tanh(|p - c_i| / R_i)  (+ a capsule term, + the cursor)
// The ridges are the level sets of psi. Near a stone the cone term dominates and the level sets close
// into rings; far away they relax back into straight lines. Moving a stone moves the rings with it:
// the pattern deforms continuously and is never cut (an isotopy of the level sets).

export const MAX = 48;

export type StoneState = {
  x: number; y: number;     // world px
  r: number;                // radius (px)
  aspect: number;           // ellipse aspect
  rot: number;              // rotation (rad)
  k: number;                // ring strength
  rose: number;             // 0 = pale stone, 1 = the rose one
  lift: number;             // 0 = sunk (absent), 1 = resting on the ground
  seed: number;
};

export type Palette = {
  ground: [number, number, number];
  light: [number, number, number];
  shade: [number, number, number];
  stone: [number, number, number];
  rose: [number, number, number];
};

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const PALETTE: Palette = {
  ground: hex('#E7E1EC'),
  light: hex('#FBF6F4'),
  shade: hex('#A99DBB'),
  stone: hex('#F3EEF1'),
  rose: hex('#E98A9E'),
};

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
#define MAX ${MAX}
uniform vec2 uRes;      // css px
uniform float uScale;   // device px per css px
uniform vec2 uCam;      // world point at the viewport centre
uniform float uZoom;
uniform float uSpace;   // ridge spacing (world px)
uniform float uTime;
uniform int uN;
uniform vec4 uS[MAX];   // x, y, r, aspect
uniform vec4 uT[MAX];   // rot, k, rose, lift
uniform vec4 uCap;      // capsule segment a.xy, b.xy (world)
uniform vec3 uCapK;     // k, R, clear radius
uniform vec4 uMouse;    // x, y, strength, radius
uniform vec3 uGround; uniform vec3 uLight; uniform vec3 uShade; uniform vec3 uStone; uniform vec3 uRose;
uniform float uFade;    // 0..1 relief amount (page-level)
uniform float uFlow;    // slow phase drift of the lines (world px)
uniform vec2 uOffset;   // canvas offset inside the viewport (css px) for partial canvases

float th(float x){ float e = exp(-2.0*abs(x)); float t = (1.0-e)/(1.0+e); return x < 0.0 ? -t : t; }
float hash(vec2 p){ p = fract(p*vec2(443.897, 441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }

void main(){
  vec2 frag = gl_FragCoord.xy / uScale;
  frag.y = uRes.y - frag.y;
  vec2 p = (frag - uRes*0.5) / uZoom + uCam;
  float px = 1.0 / uZoom;                 // one css pixel in world units

  vec3 L = normalize(vec3(-0.55, -0.7, 0.62));

  float psi = p.y;
  vec2 g = vec2(0.0, 1.0);
  float shadow = 0.0, ao = 0.0, rose = 0.0, clear = 0.0;

  // stone hit (topmost)
  float hitF = 2.0; vec2 hitQ = vec2(0.0); vec4 hitT = vec4(0.0); float hitR = 1.0; float hitSeed = 0.0;

  for (int i = 0; i < MAX; i++) {
    if (i >= uN) break;
    vec4 s = uS[i]; vec4 t = uT[i];
    float lift = t.w;
    if (lift < 0.002) continue;
    vec2 d = p - s.xy;
    float dist = length(d);
    float r = s.z * (0.35 + 0.65*lift);
    float R = r * 2.4 + 18.0;
    float k = t.y * lift;
    if (dist > R * 4.2) { psi += k * R; continue; }   // far away: the ring term is flat, skip the rest
    float tt = th(dist / R);
    psi += k * R * tt;
    g += k * (1.0 - tt*tt) * d / max(dist, 1e-3);

    // pebble shape: rotated ellipse with a slow organic wobble
    float c = cos(t.x), sn = sin(t.x);
    vec2 q = vec2(c*d.x + sn*d.y, -sn*d.x + c*d.y);
    q /= vec2(r * s.w, r / s.w);
    float ang = atan(q.y, q.x);
    float wob = 1.0 + 0.035*sin(3.0*ang + float(i)*1.7) + 0.02*sin(5.0*ang - float(i)*2.3);
    float f = length(q) / wob;

    // cast shadow (down-right, soft) and contact occlusion
    vec2 ds = d - vec2(0.42, 0.55) * r * 0.42 * lift;
    vec2 qs = vec2(c*ds.x + sn*ds.y, -sn*ds.x + c*ds.y) / vec2(r*s.w, r/s.w);
    float fs = length(qs);
    shadow = max(shadow, smoothstep(1.55, 0.72, fs) * 0.55 * lift);
    ao = max(ao, exp(-max(f - 1.0, 0.0) * 5.0) * 0.5 * lift);

    // rose light pooling on the ground
    rose += t.z * lift * exp(-max(dist - r, 0.0) / (r * 1.9 + 30.0));

    if (f < 1.0 + 2.0*px/r && f < hitF) { hitF = f; hitQ = q; hitT = t; hitR = r; hitSeed = float(i); }
  }

  // the name's clearing: the lines part around it like a stream around an island (a dipole on a capsule),
  // symmetric above and below, flat inside
  if (uCapK.x > 0.001) {
    vec2 pa = p - uCap.xy, ba = uCap.zw - uCap.xy;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-3), 0.0, 1.0);
    vec2 dv = pa - ba*h; float dc2 = max(dot(dv, dv), 1e-3);
    float a = uCapK.z * uCapK.x;
    float cy = 0.5 * (uCap.y + uCap.w);
    float yy = p.y - cy;
    if (dc2 > a*a) {
      float D = a*a / dc2;
      vec2 dD = -2.0 * a*a * dv / (dc2*dc2);
      psi -= yy * D;
      g -= vec2(yy * dD.x, D + yy * dD.y);
    } else {
      psi -= yy; g -= vec2(0.0, 1.0);
    }
    clear = smoothstep(uCapK.z * 1.02, uCapK.z * 0.8, sqrt(dc2)) * smoothstep(0.0, 0.6, uCapK.x);
  }

  // the cursor parts the lines a little
  if (uMouse.z > 0.001) {
    vec2 dm = p - uMouse.xy; float dd = length(dm);
    float R = uMouse.w;
    float tt = th(dd / R);
    psi += uMouse.z * R * tt;
    g += uMouse.z * (1.0 - tt*tt) * dm / max(dd, 1e-3);
  }

  // ridges
  float T = (psi - uFlow) / uSpace;
  float cyc = length(g) / uSpace * px;          // cycles per css pixel
  float amp = smoothstep(0.42, 0.16, cyc) * (1.0 - clear) * uFade;
  float sn2 = sin(6.2831853 * T);
  // raked profile: rounded crests, narrower valleys
  vec2 gh = (3.14159 * sn2 / uSpace) * g * amp;
  float depth = uSpace * 0.16;
  vec3 n = normalize(vec3(-gh * depth, 1.0));
  float dif = dot(n, L) - L.z;
  float valley = pow(0.5 - 0.5*cos(6.2831853*T), 6.0) * amp;  // a hint of darker groove floor

  vec3 col = uGround;
  col = dif > 0.0 ? mix(col, uLight, clamp(dif*2.2, 0.0, 1.0)) : mix(col, uShade, clamp(-dif*1.9, 0.0, 1.0));
  col = mix(col, uShade, valley * 0.10);

  // soft light across the whole plane (a low sun from the upper left)
  vec2 sv = frag / uRes + uOffset;
  float sun = 1.0 - length((sv - vec2(0.12, -0.1)) * vec2(0.8, 1.0));
  col = mix(col, uLight, clamp(sun, 0.0, 1.0) * 0.16);
  col = mix(col, uShade, clamp(-sun + 0.35, 0.0, 1.0) * 0.12);

  // rose light and shadows
  float rz = clamp(rose, 0.0, 1.0);
  col = mix(col, mix(uRose, uLight, 0.45), rz * 0.42);
  vec3 shadowCol = mix(uShade * 0.92, uRose * 0.8, rz * 0.5);
  col = mix(col, shadowCol, shadow * 0.55);
  col = mix(col, shadowCol * 0.95, ao * 0.35);

  // pebble
  if (hitF < 1.5) {
    float edge = clamp((1.0 - hitF) * hitR / (1.2*px), 0.0, 1.0);
    float f2 = clamp(hitF, 0.0, 0.999);
    vec2 qd = hitQ / max(length(hitQ), 1e-4);
    float c = cos(hitT.x), sn = sin(hitT.x);
    vec2 wdir = vec2(c*qd.x - sn*qd.y, sn*qd.x + c*qd.y);
    float nz = pow(1.0 - f2*f2, 0.5) * 1.35;
    vec3 sn3 = normalize(vec3(wdir * pow(f2, 1.6), nz));
    float lam = clamp(dot(sn3, L), 0.0, 1.0);
    float wrap = clamp(dot(sn3, L) * 0.5 + 0.5, 0.0, 1.0);
    vec3 base = mix(uStone, uRose, hitT.z);
    vec3 dark = mix(uShade * 1.02, uRose * 0.72 + vec3(0.02, 0.0, 0.05), hitT.z);
    vec3 sc = mix(dark, base, smoothstep(0.05, 0.85, wrap));
    sc = mix(sc, uLight, pow(lam, 6.0) * (0.35 + 0.25*hitT.z));
    // translucency on the rose one: light gathers at the rim facing away
    sc += uRose * hitT.z * 0.22 * pow(1.0 - sn3.z, 2.0) * (1.0 - lam);
    // ground bounce on the lower rim
    sc = mix(sc, uGround, 0.18 * smoothstep(0.55, 1.0, f2) * clamp(dot(wdir, vec2(0.4, 0.9)), 0.0, 1.0));
    col = mix(col, sc, edge * smoothstep(0.0, 0.08, hitT.w));
  }

  col += (hash(frag + fract(uTime)*37.0) - 0.5) * 0.022;
  gl_FragColor = vec4(col, 1.0);
}
`;

export type Frame = {
  cam: [number, number];
  zoom: number;
  space: number;
  stones: StoneState[];
  cap?: { ax: number; ay: number; bx: number; by: number; k: number; R: number; clear: number } | null;
  mouse?: { x: number; y: number; s: number; R: number } | null;
  fade?: number;
  flow?: number;
  time: number;
};

export class Ground {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null> = {};
  S = new Float32Array(MAX * 4);
  T = new Float32Array(MAX * 4);
  w = 0; h = 0; scale = 1;
  maxScale = 1.5;
  ok = true;

  constructor(canvas: HTMLCanvasElement, opts: { maxScale?: number } = {}) {
    this.canvas = canvas;
    this.maxScale = opts.maxScale ?? 1.5;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) { this.ok = false; throw new Error('no webgl'); }
    this.gl = gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    this.prog = p;
    gl.useProgram(p);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(p, 'aPos');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uRes', 'uScale', 'uCam', 'uZoom', 'uSpace', 'uTime', 'uN', 'uS', 'uT', 'uCap', 'uCapK', 'uMouse', 'uGround', 'uLight', 'uShade', 'uStone', 'uRose', 'uFade', 'uOffset', 'uFlow'])
      this.loc[n] = gl.getUniformLocation(p, n);
    const P = PALETTE;
    gl.uniform3fv(this.loc.uGround, P.ground); gl.uniform3fv(this.loc.uLight, P.light); gl.uniform3fv(this.loc.uShade, P.shade);
    gl.uniform3fv(this.loc.uStone, P.stone); gl.uniform3fv(this.loc.uRose, P.rose);
  }

  resize(w: number, h: number, scale = Math.min(window.devicePixelRatio || 1, this.maxScale)) {
    this.w = w; this.h = h; this.scale = scale;
    const W = Math.max(1, Math.round(w * scale)), H = Math.max(1, Math.round(h * scale));
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
    this.scale = W / w;
    this.gl.viewport(0, 0, W, H);
  }

  draw(f: Frame) {
    const gl = this.gl, L = this.loc;
    const n = Math.min(f.stones.length, MAX);
    for (let i = 0; i < n; i++) {
      const s = f.stones[i];
      this.S.set([s.x, s.y, s.r, s.aspect], i * 4);
      this.T.set([s.rot, s.k, s.rose, s.lift], i * 4);
    }
    gl.uniform2f(L.uRes, this.w, this.h);
    gl.uniform1f(L.uScale, this.scale);
    gl.uniform2f(L.uCam, f.cam[0], f.cam[1]);
    gl.uniform1f(L.uZoom, f.zoom);
    gl.uniform1f(L.uSpace, f.space);
    gl.uniform1f(L.uTime, f.time);
    gl.uniform1i(L.uN, n);
    gl.uniform4fv(L.uS, this.S);
    gl.uniform4fv(L.uT, this.T);
    const c = f.cap;
    gl.uniform4f(L.uCap, c?.ax ?? 0, c?.ay ?? 0, c?.bx ?? 0, c?.by ?? 0);
    gl.uniform3f(L.uCapK, c?.k ?? 0, c?.R ?? 1, c?.clear ?? 0);
    const m = f.mouse;
    gl.uniform4f(L.uMouse, m?.x ?? 0, m?.y ?? 0, m?.s ?? 0, m?.R ?? 40);
    gl.uniform1f(L.uFade, f.fade ?? 1);
    gl.uniform1f(L.uFlow, f.flow ?? 0);
    gl.uniform2f(L.uOffset, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
