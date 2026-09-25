// The cloth. One fragment shader computes every crossing of warp (vertical) and weft (horizontal).
// Nothing is ever removed: a new thread is inserted between two warps, its neighbours part to make
// room (closed-form displacement, so the deformation is continuous), and the interlacing re-forms
// around it. The change travels outward along the threads (a Manhattan front, ragged per thread).
//
// Rendering is on demand only: a frame is drawn when scroll, pointer, resize or a running
// animation asks for one. No idle loop.

import { bitmap } from '../lib/weave';

const MAXA = 12;
const FS = /* glsl */ `
precision highp float;
uniform vec2 uRes;      // device px
uniform vec2 uCam;      // cloth coords (threads) at screen centre
uniform float uPitch;   // device px per thread
uniform float uDpr;
uniform sampler2D uWarp, uWeft, uMask;
uniform vec4 uMaskRect; // x0, y0, w, h (threads)
uniform vec4 uA[${MAXA}];  // a (column boundary), vc (centre row), tip (thread present for v < tip), R (front radius)
uniform float uG[${MAXA}]; // gap (0..1: how far the new thread has pushed its neighbours apart)
uniform float uN;
uniform vec3 uAccent, uGap, uGround, uInk;
uniform vec2 uHover;    // u boundary, alpha
uniform float uBands;   // draft notation opacity
uniform float uWoven;   // weft present for rows v < uWoven (the intro weaves the cloth pick by pick)
uniform float uSS;

float md(float x, float n) { return x - n * floor((x + 0.5) / n); }
float pidx(float x) { float s = md(x, 14.0); return s < 7.5 ? s : 14.0 - s; }
bool rew(float dx, float dy) { return md(pidx(dx) - dy, 8.0) < 4.5; }
bool gUp(float i, float j) { return md(j - 3.0 * i, 8.0) > 0.5; }
float h1(float n) { return fract(sin(n * 12.9898 + 4.1) * 43758.5453); }

float figure(float i, float j) {
  vec2 q = (vec2(j, i) - uMaskRect.xy + 0.5) / uMaskRect.zw;
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return 0.0;
  return texture2D(uMask, q).r;
}

// Front: which new thread has reached cell (i, j), and how far through the flip it is.
// out: t (0..1), dx (columns from the axis, axis = 0), dy (rows from its centre row)
void front(float i, float j, out float t, out float fdx, out float fdy, out float fside) {
  t = 0.0; fdx = 0.0; fdy = 0.0; fside = 1.0;
  for (int k = 0; k < ${MAXA}; k++) {
    if (float(k) >= uN) break;
    vec4 A = uA[k];
    if (uG[k] < 0.01) continue;
    float dx = abs(j + 0.5 - A.x) + 0.5;           // 1 for the columns beside the axis
    float dy = i - A.y;
    float d = dx * (1.0 + 0.7 * h1(i + 17.0 * float(k))) + abs(dy) * 1.7 * (1.0 + 0.7 * h1(j * 1.7 + 31.0 * float(k)));
    float tk = clamp((A.w - d) / 2.5, 0.0, 1.0) * step(i + 2.0, A.z);
    if (tk > t) { t = tk; fdx = dx; fdy = dy; fside = sign(j + 0.5 - A.x); }
  }
}

vec3 warpCol(float j) { return texture2D(uWarp, vec2((md(j, 512.0) + 0.5) / 512.0, 0.5)).rgb * (0.95 + 0.1 * h1(j)); }
vec3 weftCol(float i) { return texture2D(uWeft, vec2((md(i, 512.0) + 0.5) / 512.0, 0.5)).rgb * (0.965 + 0.07 * h1(i + 91.0)); }

// Map a screen point to cloth coords (u, v); also report whether it falls on an inserted thread.
vec3 toCloth(vec2 sp, out float agentK, out float afx, out vec4 aA) {
  float wx = uCam.x + (sp.x - uRes.x * 0.5) / uPitch;
  float v = uCam.y + (sp.y - uRes.y * 0.5) / uPitch;
  float shift = 0.0; agentK = -1.0; afx = 0.0; aA = vec4(0.0);
  for (int k = 0; k < ${MAXA}; k++) {
    if (float(k) >= uN) break;
    vec4 A = uA[k];
    float g = uG[k] * (1.0 - smoothstep(A.z - 4.0, A.z, v));
    float dxw = wx - A.x;
    float s = abs(dxw) - g * 0.5;
    if (s < 0.0) { agentK = float(k); afx = (dxw + g * 0.5) / max(g, 1e-3); aA = A; }
    else shift += sign(dxw) * g * 0.5 * exp(-s / 5.0);
  }
  return vec3(wx - shift, v, wx);
}

vec3 shade(vec2 sp) {
  float agentK; float afx; vec4 aA;
  vec3 c = toCloth(sp, agentK, afx, aA);
  float u = c.x, v = c.y;
  float i = floor(v), fy = v - i;
  float j = floor(u), fx = u - j;
  bool isAgent = agentK >= 0.0;
  if (isAgent) fx = afx;

  bool top; float tFlip = 0.0; bool oldUp; bool newUp; float side = 1.0;
  vec3 wc;
  if (isAgent) {
    top = rew(0.0, i - aA.y);
    oldUp = top; newUp = top;
    wc = uAccent;
  } else {
    float fig = figure(i, j);
    if (fig > 0.5) { oldUp = !gUp(i, j); newUp = oldUp; }
    else {
      oldUp = gUp(i, j);
      float fdx, fdy; front(i, j, tFlip, fdx, fdy, side);
      newUp = tFlip > 0.0 ? rew(fdx, fdy) : oldUp;
    }
    wc = warpCol(j);
  }
  // A crossing that changes flips as the weft slides over (or off) the warp from both edges.
  float q = side > 0.0 ? fx : 1.0 - fx;
  top = (oldUp == newUp) ? oldUp : (q < tFlip ? newUp : oldUp);

  vec3 fc = weftCol(i);
  float aa = 0.75 / uPitch;
  float inWarp = 1.0 - smoothstep(0.40 - aa, 0.40 + aa, abs(fx - 0.5));
  float inWeft = 1.0 - smoothstep(0.40 - aa, 0.40 + aa, abs(fy - 0.5));
  float z = smoothstep(10.0, 30.0, uPitch);
  // floats read as slightly rounded threads when close; flat colour blocks when far
  float rw = 1.0 - z * 0.16 * pow(clamp(abs(fx - 0.5) / 0.4, 0.0, 1.0), 3.0);
  float rf = 1.0 - z * 0.16 * pow(clamp(abs(fy - 0.5) / 0.4, 0.0, 1.0), 3.0);
  vec3 col;
  if (v >= uWoven) {
    // not yet woven: bare warp only
    col = mix(uGap, wc * 0.7 * rw, inWarp);
  } else if (top) {
    col = mix(mix(uGap, fc * 0.72, inWeft), wc * rw, inWarp);
  } else {
    col = mix(mix(uGap, wc * 0.72, inWarp), fc * rf, inWeft);
  }
  // the weaving line during the intro
  col = mix(col, uInk, (1.0 - smoothstep(0.0, 1.2 / uPitch * uDpr, abs(v - uWoven))) * 0.35 * step(uWoven, 1e4));
  if (uHover.y > 0.0 && !isAgent) {
    float d = abs(u - uHover.x) * uPitch;
    col = mix(col, uAccent, (1.0 - smoothstep(0.6 * uDpr, 1.5 * uDpr, d)) * uHover.y);
  }
  return col;
}

// Draft notation: threading (top), treadling (right), tie-up (corner), aligned to the live cloth.
vec3 bands(vec2 sp, vec3 col) {
  if (uBands < 0.01) return col;
  bool narrow = uRes.x / uDpr < 600.0;
  float rh = clamp(uPitch * 0.26, (narrow ? 4.0 : 5.0) * uDpr, 8.0 * uDpr);
  float top0 = (narrow ? 14.0 : 18.0) * uDpr;
  float bh = 8.0 * rh;
  float right0 = narrow ? uRes.x + 100.0 * uDpr : uRes.x - 18.0 * uDpr - bh;
  float pad = 6.0 * uDpr;
  bool inTop = sp.y > top0 - pad && sp.y < top0 + bh + pad && sp.x < right0 - pad && (!narrow || (sp.x > 12.0 * uDpr && sp.x < uRes.x - 12.0 * uDpr));
  bool inRight = sp.x > right0 - pad && sp.x < right0 + bh + pad && sp.y > top0 - pad && sp.y < uRes.y - 96.0 * uDpr;
  if (!inTop && !inRight) return col;
  // state of the draft is read at the centre of the view
  float agentK; float afx; vec4 aA;
  vec3 cc = toCloth(uRes * 0.5, agentK, afx, aA);
  float ci = floor(cc.y), cj = floor(cc.x);
  vec3 bg = mix(col, uGround, 0.93 * uBands);
  vec3 onC = mix(bg, uInk, uBands);
  vec3 offC = mix(bg, uInk, 0.07 * uBands);
  if (inRight && sp.y > top0 + bh + pad) {
    // treadling: one mark per row
    vec3 c = toCloth(sp, agentK, afx, aA);
    float i = floor(c.y), fy = c.y - i;
    float col8 = floor((sp.x - right0) / rh); float fxx = fract((sp.x - right0) / rh);
    if (col8 < 0.0 || col8 > 7.0) return bg;
    float t, fdx, fdy, fs; front(i, cj, t, fdx, fdy, fs);
    float tr = t > 0.5 ? md(fdy, 8.0) : md(3.0 * i, 8.0);
    float by = rh / uPitch * 0.32; float box = step(0.18, fxx) * step(fxx, 0.82) * step(0.5 - by, fy) * step(fy, 0.5 + by);
    return col8 == tr ? mix(bg, onC, box) : mix(bg, offC, box * step(0.4, fxx) * step(fxx, 0.6) * step(0.4, fy) * step(fy, 0.6));
  }
  if (inRight) {
    // tie-up (corner): treadle columns × shaft rows
    float cx = floor((sp.x - right0) / rh), cy = floor((sp.y - top0) / rh);
    if (cx < 0.0 || cx > 7.0 || cy < 0.0 || cy > 7.0) return bg;
    vec2 f = fract((sp - vec2(right0, top0)) / rh);
    float box = step(0.18, f.x) * step(f.x, 0.82) * step(0.18, f.y) * step(f.y, 0.82);
    float t, fdx, fdy, fs; front(ci, cj, t, fdx, fdy, fs);
    float s = 7.0 - cy, tr = cx;
    bool up = t > 0.5 ? md(s - tr, 8.0) < 4.5 : md(s - tr, 8.0) > 0.5;
    return up ? mix(bg, onC, box) : mix(bg, offC, box * 0.6);
  }
  // threading: one mark per warp, row = shaft
  vec3 c = toCloth(sp, agentK, afx, aA);
  float j = floor(c.x), fx = agentK >= 0.0 ? afx : c.x - j;
  float r = floor((sp.y - top0) / rh); float fyy = fract((sp.y - top0) / rh);
  if (r < 0.0 || r > 7.0) return bg;
  float sh;
  if (agentK >= 0.0) sh = 0.0;
  else { float t, fdx, fdy, fs; front(ci, j, t, fdx, fdy, fs); sh = t > 0.5 ? pidx(fdx) : md(j, 8.0); }
  float bx = min(0.32, rh / uPitch * 0.32); float box = step(0.5 - bx, fx) * step(fx, 0.5 + bx) * step(0.18, fyy) * step(fyy, 0.82);
  if (7.0 - r == sh) return mix(bg, agentK >= 0.0 ? mix(bg, uAccent, uBands) : onC, box);
  return mix(bg, offC, box * step(0.4, fx) * step(fx, 0.6) * step(0.4, fyy) * step(fyy, 0.6));
}

void main() {
  vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 c;
  if (uSS > 0.5) c = 0.25 * (shade(sp + vec2(-0.25, -0.25)) + shade(sp + vec2(0.25, -0.25)) + shade(sp + vec2(-0.25, 0.25)) + shade(sp + vec2(0.25, 0.25)));
  else c = shade(sp);
  gl_FragColor = vec4(bands(sp, c), 1.0);
}
`;

const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexN = (h: string) => hex(h).map((x) => x / 255);
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Albers-like stripe rhythm: widths from a short proportional series, colours from graded dips.
function stripes(widths: number[], colours: string[]) {
  const data = new Uint8Array(512 * 4);
  let x = 0, wi = 0, ci = 0;
  while (x < 512) {
    const w = widths[wi++ % widths.length];
    const c = hex(colours[ci++ % colours.length]);
    for (let k = 0; k < w && x < 512; k++, x++) data.set([c[0], c[1], c[2], 255], x * 4);
  }
  return data;
}

type Agent = { a: number; vc: number; tip: number; R: number; g: number };
type UserAgent = Agent & { t0: number; tipFrom: number; tipTo: number; Rmax: number };

export function mountCloth(stage: HTMLElement, canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  if (!gl) { stage.classList.add('no-gl'); return; }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); stage.classList.add('no-gl'); return; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const u = {
    res: U('uRes'), cam: U('uCam'), pitch: U('uPitch'), dpr: U('uDpr'), maskRect: U('uMaskRect'),
    A: U('uA'), G: U('uG'), N: U('uN'), accent: U('uAccent'), gap: U('uGap'), ground: U('uGround'), ink: U('uInk'),
    hover: U('uHover'), bands: U('uBands'), woven: U('uWoven'), ss: U('uSS'),
  };

  const texs: (WebGLTexture | null)[] = [];
  const tex = (unit: number, name: string, w: number, h: number, fmt: number, data: Uint8Array) => {
    if (texs[unit]) gl.deleteTexture(texs[unit]);
    const t = gl.createTexture(); texs[unit] = t; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, fmt, gl.UNSIGNED_BYTE, data);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U(name), unit);
    return t;
  };
  tex(0, 'uWarp', 512, 1, gl.RGBA, stripes([21, 3, 8, 1, 13, 2, 5, 1, 34, 3, 8, 2], ['#1b2452', '#26347a', '#1b2452', '#121838', '#2c3b86', '#1f2a5e']));
  tex(1, 'uWeft', 512, 1, gl.RGBA, stripes([13, 2, 8, 1, 21, 3, 5, 1, 8, 2], ['#e7ddc7', '#cbbfa3', '#efe8d8', '#b9ae97', '#e7ddc7', '#d8ccb2']));
  gl.uniform3fv(u.accent, hexN('#f2a93b'));
  gl.uniform3fv(u.gap, hexN('#06081a'));
  gl.uniform3fv(u.ground, hexN('#0b0e20'));
  gl.uniform3fv(u.ink, hexN('#ebe4d3'));

  // ---------------------------------------------------------------------------------------------
  let W = 0, H = 0, dpr = 1, k = 3, pitch0 = 7, pitch1 = 34, pitch2 = 3, cy0 = 0;
  let F = { x: 0, y: 0 };
  let far: { a: number; vc: number; Rmax: number; d: number }[] = [];
  const name = [bitmap('COROLLARY'), bitmap('LABS')];

  const layout = () => {
    W = stage.clientWidth; H = stage.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    k = W >= 900 ? 4 : 2;
    const mw = name[0].w * k, mh = (7 + 3 + 7) * k;
    pitch0 = clamp(Math.min((W * 0.8) / mw, (H * 0.5) / mh), 2.6, 6);
    pitch1 = W >= 900 ? 34 : 24;
    pitch2 = pitch0 * (W >= 900 ? 0.44 : 0.62);
    // name mask (weft-faced figure) in cloth coords, centred on the origin
    const x0 = -Math.floor(mw / 2), y0 = -Math.floor(mh / 2);
    const m = new Uint8Array(mw * mh);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const line = y < 7 * k ? 0 : y >= 10 * k ? 1 : -1;
      if (line < 0) continue;
      const fy = Math.floor((y - (line ? 10 * k : 0)) / k), fx = Math.floor(x / k);
      m[y * mw + x] = name[line].on(fx, fy) ? 255 : 0;
    }
    tex(2, 'uMask', mw, mh, gl.LUMINANCE, m);
    gl.uniform4f(u.maskRect, x0, y0, mw, mh);
    cy0 = (H * 0.03) / pitch0;
    // focal point for the close-up: in the ground, below and right of the name
    F = { x: Math.round(mw * 0.14), y: Math.round(mh / 2 + Math.max(60, (H * 0.3) / pitch0)) };
    // other firms, far out in the cloth
    const sx = W / pitch2 / 2, sy = H / pitch2 / 2;
    const pts = [[-0.72, -0.62], [0.78, -0.55], [-0.86, 0.34], [0.55, 0.7], [-0.3, 0.8], [0.93, 0.12], [-0.5, -0.9]];
    far = pts.map(([px, py], n) => ({ a: Math.round(px * sx), vc: Math.round(py * sy), Rmax: 72 + ((n * 37) % 5) * 12, d: n * 0.018 }));
    request();
  };

  // ---------------------------------------------------------------------------------------------
  let p = 0;               // story progress
  const users: UserAgent[] = [];
  let hover = { u: 0, a: 0 };
  let wovenT0 = performance.now();
  let introDone = reduce;

  const camera = () => {
    const zin = ease(seg(p, 0.06, 0.34)), zout = ease(seg(p, 0.76, 1));
    let pitch = Math.exp(lerp(Math.log(pitch0), Math.log(pitch1), zin));
    pitch = Math.exp(lerp(Math.log(pitch), Math.log(pitch2), zout));
    const cx = lerp(lerp(0, F.x, zin), 0, zout);
    const cy = lerp(lerp(cy0, F.y, zin), 0, zout);
    return { cx, cy, pitch };
  };

  const storyAgents = (cam: { cx: number; cy: number; pitch: number }): Agent[] => {
    const list: Agent[] = [];
    const halfRows = H / pitch1 / 2, halfCols = W / pitch1 / 2;
    const zip = seg(p, 0.3, 0.5);
    const g0 = seg(p, 0.29, 0.33);
    const top = F.y - halfRows - 3, bottom = F.y + halfRows + 6;
    const tip = zip >= 1 ? 1e5 : lerp(top, bottom, out(zip));
    const Rcover = (halfCols + halfRows) * 1.7 + 4;
    const R = lerp(0, Rcover, ease(seg(p, 0.5, 0.76))) + 50 * seg(p, 0.76, 1);
    list.push({ a: F.x, vc: F.y, tip, R, g: g0 });
    for (const f of far) {
      const s = seg(p, 0.78 + f.d, 0.83 + f.d);
      list.push({ a: f.a, vc: f.vc, tip: 1e5, R: seg(p, 0.79 + f.d, 1) * f.Rmax, g: s });
    }
    void cam;
    return list;
  };

  // mirror of toCloth() for the pointer (cloth u at a screen x, given the current agents)
  const clothU = (x: number, y: number, cam: { cx: number; cy: number; pitch: number }, agents: Agent[]) => {
    const wx = cam.cx + (x - W / 2) / cam.pitch, v = cam.cy + (y - H / 2) / cam.pitch;
    let shift = 0, inside = false;
    for (const A of agents) {
      const g = A.g * (1 - smooth(A.tip - 4, A.tip, v));
      const d = wx - A.a, s = Math.abs(d) - g / 2;
      if (s < 0) inside = true; else shift += Math.sign(d) * (g / 2) * Math.exp(-s / 5);
    }
    return { u: wx - shift, v, inside };
  };
  const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  let raf = 0;
  function request() { if (!raf) raf = requestAnimationFrame(frame); }

  function frame(now: number) {
    raf = 0;
    const cam = camera();
    let animating = false;
    // intro: the cloth is woven pick by pick, top to bottom
    const viewTop = cam.cy - H / cam.pitch / 2, viewBot = cam.cy + H / cam.pitch / 2;
    let woven = 1e5 + 1;
    if (!introDone) {
      const t = clamp((now - wovenT0) / 1500, 0, 1);
      woven = lerp(viewTop - 1, viewBot + 1, out(t));
      if (t >= 1) { introDone = true; woven = 1e5 + 1; } else animating = true;
    }
    // user threads
    for (const a of users) {
      const t = (now - a.t0) / 1000;
      if (reduce) { a.g = 1; a.tip = 1e5; a.R = a.Rmax; continue; }
      a.g = out(clamp(t / 0.3, 0, 1));
      const z = clamp(t / 0.8, 0, 1);
      a.tip = z >= 1 ? 1e5 : lerp(a.tipFrom, a.tipTo, out(z));
      a.R = a.Rmax * out(clamp((t - 0.35) / 2.6, 0, 1));
      if (t < 3) animating = true;
    }
    const agents = [...storyAgents(cam), ...users].slice(0, MAXA);
    const A = new Float32Array(MAXA * 4), G = new Float32Array(MAXA);
    agents.forEach((a, n) => { A.set([a.a, a.vc, a.tip, a.R], n * 4); G[n] = a.g; });
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform2f(u.cam, cam.cx, cam.cy);
    gl.uniform1f(u.pitch, cam.pitch * dpr);
    gl.uniform1f(u.dpr, dpr);
    gl.uniform4fv(u.A, A); gl.uniform1fv(u.G, G); gl.uniform1f(u.N, agents.length);
    gl.uniform2f(u.hover, hover.u, fine ? hover.a * (1 - seg(p, 0.02, 0.06)) : 0);
    gl.uniform1f(u.bands, seg(p, 0.3, 0.38) * (1 - seg(p, 0.72, 0.78)) * (W >= 560 ? 1 : 0.9));
    gl.uniform1f(u.woven, woven);
    gl.uniform1f(u.ss, cam.pitch * dpr < 5 ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    lastAgents = agents; lastCam = cam;
    if (animating) request();
  }
  let lastAgents: Agent[] = [], lastCam = camera();

  // ---------------------------------------------------------------------------------------------
  const onScroll = () => {
    const r = stage.parentElement!.getBoundingClientRect();
    const run = r.height - innerHeight;
    let np = clamp(-r.top / Math.max(1, run), 0, 1);
    if (reduce) { const keys = [0, 0.52, 0.78, 1]; np = keys.reduce((b, k2) => (Math.abs(k2 - np) < Math.abs(b - np) ? k2 : b), 0); }
    if (np !== p) { p = np; stage.style.setProperty('--p', p.toFixed(4)); stage.dataset.state = String(p < 0.2 ? 0 : p < 0.5 ? 1 : p < 0.78 ? 2 : 3); request(); }
  };

  const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointermove', (e) => {
    if (!fine) return;
    const { x, y } = local(e);
    const c = clothU(x, y, lastCam, lastAgents);
    const nu = Math.round(c.u), na = c.inside ? 0 : 1;
    if (nu !== hover.u || na !== hover.a) { hover = { u: nu, a: na }; request(); }
  });
  canvas.addEventListener('pointerleave', () => { if (hover.a) { hover.a = 0; request(); } });
  canvas.addEventListener('click', (e) => {
    if (p > 0.06 || users.length >= 4) return;
    const { x, y } = local(e);
    const cam = lastCam;
    const c = clothU(x, y, cam, lastAgents);
    const a = Math.round(c.u);
    if (c.inside || lastAgents.some((g) => g.g > 0 && Math.abs(g.a - a) < 4)) return;
    const viewTop = cam.cy - H / cam.pitch / 2, viewBot = cam.cy + H / cam.pitch / 2;
    users.push({ a, vc: Math.floor(c.v), tip: viewTop - 4, R: 0, g: 0, t0: performance.now(), tipFrom: viewTop - 4, tipTo: viewBot + 8, Rmax: Math.round(Math.min(W, H) / cam.pitch * 0.34) + 8 });
    stage.classList.add('touched');
    request();
  });

  new ResizeObserver(() => { layout(); onScroll(); }).observe(stage);
  addEventListener('scroll', onScroll, { passive: true });
  layout(); onScroll();
  wovenT0 = performance.now();
  request();
}
