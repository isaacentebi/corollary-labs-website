// The cloth. One fragment shader computes every crossing of warp (vertical, graphite) and weft
// (horizontal, chalk). A new thread is inserted between two warps; its neighbours part around a
// travelling opening (closed-form displacement, so the deformation is continuous and nothing is
// cut); behind it the cloth re-forms as a block damask mirrored on the new thread. The change
// travels along the threads: a Manhattan front, faster along the weft. The name is a protected
// block of the original cloth: it is never rewoven.
//
// Rendering is on demand: scroll, pointer, resize, or a running animation request a frame.

import { BX, BY, TX, TY, OFFX, OFFY, PALETTE, warpColour } from '../lib/weave';
import { textMask } from './loom2d';

const MAXA = 16, MAXU = 8;
const cumStr = (w: number[]) => { let a = 0; return w.slice(0, -1).map((x) => `k += step(${(a += x).toFixed(1)}, m);`).join(' '); };
const PX = BX.reduce((a, b) => a + b, 0), PY = BY.reduce((a, b) => a + b, 0);

const FS = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform vec2 uCam;
uniform float uPitch;
uniform float uDpr;
uniform sampler2D uWarp, uMask;
uniform float uWarpN;
uniform vec4 uMaskRect;
uniform vec4 uProtect;
uniform vec4 uA[${MAXA}];   // a (column boundary), vc (centre row), tip (present for v < tip), R (front)
uniform vec2 uG[${MAXA}];   // settled gap, travelling bulge
uniform float uN;
uniform vec3 uAccent, uGap, uWeft, uInk, uPaper, uRule, uMute;
uniform vec3 uHover;        // u, alpha, spent (1 = limit reached)
uniform float uBands, uWoven, uSS, uNarrow;
uniform vec4 uBandGeo;      // top0, rh, right0, label row (device px)
uniform float uBandBottom;

float md(float x, float n) { return x - n * floor((x + 0.5) / n); }
float h1(float n) { return fract(sin(n * 12.9898 + 4.1) * 43758.5453); }
float kX(float d) { float m = md(d, ${PX.toFixed(1)}); float k = 0.0; ${cumStr(BX)} return k; }
float kY(float d) { float m = md(d, ${PY.toFixed(1)}); float k = 0.0; ${cumStr(BY)} return k; }
float bit(float mask, float k) { return md(floor(mask / pow(2.0, k)), 2.0); }
float blockX(float dx) { return abs(dx) < 0.5 ? 0.0 : bit(${TX.toFixed(1)}, kX(abs(dx) - 1.0 + (dx < 0.0 ? ${OFFX.toFixed(1)} : 0.0))); }
float blockY(float dy) { return bit(${TY.toFixed(1)}, kY(abs(dy) + (dy < 0.0 ? ${OFFY.toFixed(1)} : 0.0))); }
bool whiteBlock(float dx, float dy) { return abs(dx) > 0.5 && blockX(dx) > 0.5 && blockY(dy) > 0.5; }
// dx signed columns from the new thread (0 = the thread), dy signed rows
bool rew(float dx, float dy) {
  float r = md(md(abs(dx), 4.0) - md(dy, 4.0), 4.0);
  return whiteBlock(dx, dy) ? r == 0.0 : r < 2.0;
}
bool gUp(float i, float j) { return md(j - 3.0 * i, 8.0) != 0.0; }
bool fUp(float i, float j) { return md(j - i, 4.0) == 0.0; }

float figure(float i, float j) {
  vec2 q = (vec2(j, i) - uMaskRect.xy + 0.5) / uMaskRect.zw;
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return 0.0;
  return texture2D(uMask, q).r;
}
bool protectedCell(float i, float j) { return j >= uProtect.x && j < uProtect.z && i >= uProtect.y && i < uProtect.w; }

// front: margin of the nearest new thread that has reached (i, j)
void front(float i, float j, out float t, out float fdx, out float fdy, out float fside) {
  float best = 0.0; fdx = 0.0; fdy = 0.0; fside = 1.0;
  for (int k = 0; k < ${MAXA}; k++) {
    if (float(k) >= uN) break;
    vec4 A = uA[k];
    if (uG[k].x < 0.01) continue;
    float o = j + 0.5 - A.x;
    float dx = sign(o) * (abs(o) + 0.5);
    float dy = i - A.y;
    float mg = i + 2.0 < A.z ? A.w - max(abs(dx), abs(dy) * 1.6) : -1.0;
    if (mg > 0.0) { best = mg; fdx = dx; fdy = dy; fside = sign(o); break; } // first to arrive keeps the cell
  }
  t = clamp(best / 1.5, 0.0, 1.0);
}

vec3 warpCol(float j) { return texture2D(uWarp, vec2((md(j, uWarpN) + 0.5) / uWarpN, 0.5)).rgb * (0.94 + 0.12 * h1(j)); }
vec3 weftCol(float i) { return uWeft * (0.975 + 0.05 * h1(i + 91.0)); }

// screen → cloth. Reports the inserted thread under the point, and the local slope of the warps.
vec3 toCloth(vec2 sp, out float agentK, out float afx, out vec4 aA, out float slope) {
  float wx = uCam.x + (sp.x - uRes.x * 0.5) / uPitch;
  float v = uCam.y + (sp.y - uRes.y * 0.5) / uPitch;
  float shift = 0.0; agentK = -1.0; afx = 0.0; aA = vec4(0.0); slope = 0.0;
  for (int k = 0; k < ${MAXA}; k++) {
    if (float(k) >= uN) break;
    vec4 A = uA[k]; vec2 G = uG[k];
    float tt = clamp((v - (A.z - 6.0)) / 6.0, 0.0, 1.0);
    float z = (v - A.z) / 5.0; float bump = exp(-z * z);
    float g = G.x * (1.0 - tt * tt * (3.0 - 2.0 * tt)) + G.y * bump;
    float dg = -G.x * 6.0 * tt * (1.0 - tt) / 6.0 + G.y * bump * (-2.0 * z / 5.0);
    float dxw = wx - A.x;
    float s = abs(dxw) - g * 0.5;
    if (s < 0.0) { agentK = float(k); afx = (dxw + g * 0.5) / max(g, 1e-3); aA = A; }
    else {
      float e = exp(-s / 8.0);
      shift += sign(dxw) * g * 0.5 * e;
      slope += sign(dxw) * dg * 0.5 * e;
    }
  }
  return vec3(wx - shift, v, wx);
}

vec3 shade(vec2 sp) {
  float agentK; float afx; vec4 aA; float slope;
  vec3 c = toCloth(sp, agentK, afx, aA, slope);
  float u = c.x, v = c.y;
  float i = floor(v), fy = v - i;
  float j = floor(u), fx = u - j;
  bool isAgent = agentK >= 0.0;
  if (isAgent) fx = afx;

  bool oldUp, newUp; float tFlip = 0.0, side = 1.0; bool ground = false; bool white = false;
  vec3 wc;
  if (isAgent) {
    oldUp = rew(0.0, i - aA.y); newUp = oldUp; wc = uAccent;
  } else {
    wc = warpCol(j);
    if (figure(i, j) > 0.5) { oldUp = fUp(i, j); newUp = oldUp; }
    else {
      oldUp = gUp(i, j); newUp = oldUp; ground = true;
      if (!protectedCell(i, j)) {
        float fdx, fdy; front(i, j, tFlip, fdx, fdy, side);
        if (tFlip > 0.0) { newUp = rew(fdx, fdy); white = whiteBlock(fdx, fdy); }
      }
    }
  }
  float q = side > 0.0 ? fx : 1.0 - fx;
  bool top = (oldUp == newUp) ? oldUp : (q < tFlip ? newUp : oldUp);

  vec3 fc = weftCol(i);
  float aa = 0.8 / uPitch;
  float pw = abs(fx - 0.5), pf = abs(fy - 0.5);
  float inWarp, inWeft;
  // relief: rounded threads, and warps catch light where they bend
  float z = smoothstep(7.0, 26.0, uPitch / uDpr);
  // at a distance the threads are beaten tight (flat blocks of value); close up they separate
  float hw = mix(0.5, 0.42, z), hf = 0.5;
  inWarp = 1.0 - smoothstep(hw - aa, hw + aa, pw);
  inWeft = 1.0 - smoothstep(hf - aa, hf + aa, pf);
  float rw = 1.0 - (0.06 + 0.18 * z) * pow(clamp(pw / hw, 0.0, 1.0), 2.0);
  float rf = 1.0 - (0.03 + 0.10 * z) * pow(clamp(pf / hf, 0.0, 1.0), 2.0);
  vec3 lit = vec3(0.55) * clamp(slope * 2.2, 0.0, 0.8) * (1.0 - pw / hw);
  vec3 wTop = wc * rw + lit - vec3(0.06) * clamp(-slope * 2.2, 0.0, 1.0);
  vec3 col;
  // satin binding points sink between the floats: the ground reads smooth
  bool sunk = ground && !top && tFlip <= 0.0;
  bool sunkW = white && top && tFlip >= 1.0;
  if (sunkW && v < uWoven && z < 0.5) {
    float dotw = mix(0.16, 0.26, z);
    float d = 1.0 - smoothstep(dotw - aa, dotw + aa, max(pw, pf));
    return mix(fc * rf, wc * 1.6 + vec3(0.08), d);
  }
  if (sunk && v < uWoven && z < 0.5) {
    float dotw = mix(0.16, 0.26, z);
    float d = 1.0 - smoothstep(dotw - aa, dotw + aa, max(pw, pf));
    return mix(wc * rw, fc * mix(0.34, 0.6, z), d);
  }
  if (v >= uWoven) {
    // not yet woven: bare warp over the loom's light
    float bare = 1.0 - smoothstep(0.3 - aa, 0.3 + aa, pw);
    col = mix(uPaper, wc * 1.1, bare);
  } else if (top) {
    col = mix(fc * 0.5, wTop, inWarp);
  } else {
    col = fc * rf * (1.0 - 0.12 * z * smoothstep(0.5 - 1.2 * aa, 0.5, pf));
  }
  col = mix(col, uAccent, (1.0 - smoothstep(0.0, 1.5 * uDpr / uPitch, abs(v - uWoven))) * step(uWoven, 1e4));
  if (uHover.y > 0.0 && !isAgent) {
    float d = abs(u - uHover.x) * uPitch;
    col = mix(col, uHover.z > 0.5 ? uMute : uAccent, (1.0 - smoothstep(0.7 * uDpr, 1.6 * uDpr, d)) * uHover.y);
  }
  return col;
}

// ---- draft notation: opaque paper, hairline grid, ink marks locked to the live threads ----
float box(vec2 p, vec2 hs, float px) { vec2 d = abs(p) - hs; return 1.0 - smoothstep(-px * 0.5, px * 0.5, max(d.x, d.y)); }

vec3 bands(vec2 sp, vec3 col) {
  if (uBands < 0.01) return col;
  float top0 = uBandGeo.x, rh = uBandGeo.y, right0 = uBandGeo.z, lab = uBandGeo.w;
  float px = uDpr;
  float bh = 8.0 * rh;
  bool narrow = uNarrow > 0.5;
  float topEnd = narrow ? uRes.x : right0 - 10.0 * px;
  float wipe = uBands;  // the draft is drawn in, never faded: opaque at every moment
  bool inTop = sp.y >= top0 && sp.y < top0 + bh + lab && sp.x < topEnd * wipe;
  bool inRight = !narrow && sp.x >= right0 && sp.x < right0 + bh && sp.y >= top0 && sp.y < top0 + (uBandBottom - top0) * wipe;
  if (!inTop && !inRight) return col;

  float agentK; float afx; vec4 aA; float slope;
  vec3 cc = toCloth(uRes * 0.5, agentK, afx, aA, slope);
  float ci = floor(cc.y), cj = floor(cc.x);
  vec3 ink = uInk, paper = uPaper, rule = uRule;
  vec3 o = paper;
  float t, fdx, fdy, fs;

  if (inTop) {
    float y = sp.y - top0;
    if (y >= bh) {
      // label row
      o = paper; if (y < bh + px) o = rule;
    } else {
      vec3 c = toCloth(sp, agentK, afx, aA, slope);
      float j = floor(c.x); float fx = agentK >= 0.0 ? afx : c.x - j;
      float colW = agentK >= 0.0 ? max(uG[0].x, 0.2) * uPitch : uPitch;
      float r = floor(y / rh); float fr = y / rh - r;
      float sh;
      if (agentK >= 0.0) sh = 0.0;
      else {
        front(ci, j, t, fdx, fdy, fs);
        sh = t > 0.5 ? blockX(fdx) * 4.0 + md(abs(fdx), 4.0) : md(j, 8.0);
      }
      float gx = min(fx, 1.0 - fx) * colW, gy = min(fr, 1.0 - fr) * rh;
      o = paper;
      if (gx < px * 0.75 || gy < px * 0.75) o = rule;
      if (7.0 - r == sh) {
        float m = box(vec2((fx - 0.5) * colW, (fr - 0.5) * rh), vec2(min(colW, rh) * 0.34), px);
        o = mix(o, agentK >= 0.0 ? uAccent : ink, m);
      }
    }
  } else {
    float x = sp.x - right0; float cx = floor(x / rh); float fxx = x / rh - cx;
    if (sp.y < top0 + bh) {
      // tie-up
      float y = sp.y - top0; float cy = floor(y / rh); float fyy = y / rh - cy;
      front(ci, cj, t, fdx, fdy, fs);
      float s = 7.0 - cy, tr = cx;
      bool up;
      if (t > 0.5) { bool wb = s > 3.5 && tr > 3.5; float rr = md(md(s, 4.0) - md(tr, 4.0), 4.0); up = wb ? rr == 0.0 : rr < 2.0; }
      else up = md(s - 3.0 * tr, 8.0) != 0.0;
      o = paper;
      if (min(fxx, 1.0 - fxx) * rh < px * 0.75 || min(fyy, 1.0 - fyy) * rh < px * 0.75) o = rule;
      if (up) o = mix(o, ink, box(vec2((fxx - 0.5) * rh, (fyy - 0.5) * rh), vec2(rh * 0.36), px));
    } else if (sp.y < top0 + bh + lab || sp.y > uBandBottom - lab) {
      o = paper; if (abs(sp.y - (top0 + bh)) < px) o = rule;
    } else {
      vec3 c = toCloth(sp, agentK, afx, aA, slope);
      float i = floor(c.y), fy = c.y - i;
      front(i, cj, t, fdx, fdy, fs);
      float tr = t > 0.5 ? blockY(fdy) * 4.0 + md(fdy, 4.0) : md(i, 8.0);
      o = paper;
      if (min(fxx, 1.0 - fxx) * rh < px * 0.75 || min(fy, 1.0 - fy) * uPitch < px * 0.75) o = rule;
      if (cx == tr) o = mix(o, ink, box(vec2((fxx - 0.5) * rh, (fy - 0.5) * uPitch), vec2(min(rh, uPitch) * 0.34), px));
    }
  }
  return o;
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
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

type Agent = { a: number; vc: number; tip: number; R: number; g: number; b: number };
type UserAgent = Agent & { t0: number; tipFrom: number; tipTo: number; Rmax: number };
type Cam = { cx: number; cy: number; pitch: number };

export function mountCloth(stage: HTMLElement, canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
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
    res: U('uRes'), cam: U('uCam'), pitch: U('uPitch'), dpr: U('uDpr'), maskRect: U('uMaskRect'), protect: U('uProtect'),
    A: U('uA'), G: U('uG'), N: U('uN'), hover: U('uHover'), bands: U('uBands'), woven: U('uWoven'), ss: U('uSS'),
    narrow: U('uNarrow'), geo: U('uBandGeo'), bottom: U('uBandBottom'), warpN: U('uWarpN'),
  };
  const texs: (WebGLTexture | null)[] = [];
  const tex = (unit: number, name: string, w: number, h: number, fmt: number, data: Uint8Array) => {
    if (texs[unit]) gl.deleteTexture(texs[unit]);
    const t = gl.createTexture(); texs[unit] = t;
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, fmt, gl.UNSIGNED_BYTE, data);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U(name), unit);
  };
  const WN = PALETTE.warpW.reduce((a, b) => a + b, 0);
  const wdata = new Uint8Array(WN * 4);
  for (let j = 0; j < WN; j++) { const c = hex(warpColour(j)); wdata.set([c[0], c[1], c[2], 255], j * 4); }
  tex(0, 'uWarp', WN, 1, gl.RGBA, wdata);
  gl.uniform1f(u.warpN, WN);
  tex(1, 'uMask', 1, 1, gl.LUMINANCE, new Uint8Array([0]));
  gl.uniform3fv(U('uAccent'), hexN(PALETTE.saffron));
  gl.uniform3fv(U('uGap'), hexN(PALETTE.gap));
  gl.uniform3fv(U('uWeft'), hexN(PALETTE.weft));
  gl.uniform3fv(U('uInk'), hexN('#18181a'));
  gl.uniform3fv(U('uPaper'), hexN('#ebe9e3'));
  gl.uniform3fv(U('uRule'), hexN('#c9c6bd'));
  gl.uniform3fv(U('uMute'), hexN('#8d8b85'));

  const header = document.querySelector<HTMLElement>('[data-header]');
  const labels = stage.querySelector<HTMLElement>('[data-draft]');
  const counter = stage.querySelector<HTMLElement>('[data-count]');

  // ---------------------------------------------------------------------------------------------
  let W = 0, H = 0, dpr = 1, pitch0 = 6, pitch1 = 34, pitch2 = 3, cy0 = 0, cap = 36;
  let F = { x: 0, y: 0 };
  let nameBox = { x0: 0, y0: 0, x1: 0, y1: 0 };
  let far: { a: number; vc: number; Rmax: number; d: number }[] = [];
  let geo = { top0: 70, rh: 9, right0: 0, lab: 16, bottom: 0 };
  let maskReady = false;

  const layout = async () => {
    W = stage.clientWidth; H = stage.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const wide = W >= 900;
    pitch0 = wide ? clamp(W / 230, 5.2, 7) : clamp(W / 118, 3, 4.4);
    pitch1 = wide ? 34 : 26;
    pitch2 = pitch0 * (wide ? 0.46 : 0.6);
    // the name, woven at thread resolution
    const targetW = (wide ? Math.min(W * 0.74, 1180) : W * 0.84) / pitch0;
    const wt = wide ? 560 : 620;
    cap = Math.round(targetW / 5.6);
    let m = await textMask(['Corollary', 'Labs'], cap, wt, 0.3);
    if (Math.abs(m.w - targetW) > 3) { cap = Math.round((cap * targetW) / m.w); m = await textMask(['Corollary', 'Labs'], cap, wt, 0.3); }
    const x0 = -Math.floor(m.w / 2), y0 = -Math.floor(m.h / 2);
    tex(1, 'uMask', m.w, m.h, gl.LUMINANCE, m.data.map((x) => x * 255));
    gl.uniform4f(u.maskRect, x0, y0, m.w, m.h);
    const pad = Math.round(cap * 0.35);
    nameBox = { x0: x0 - pad, y0: y0 - pad, x1: x0 + m.w + pad, y1: y0 + m.h + pad };
    gl.uniform4f(u.protect, nameBox.x0, nameBox.y0, nameBox.x1, nameBox.y1);
    maskReady = true;
    cy0 = (H * 0.02) / pitch0;
    F = { x: Math.round(m.w * 0.16), y: Math.round(y0 + m.h + Math.max(50, (H * 0.34) / pitch0)) };
    const sx = W / pitch2 / 2, sy = H / pitch2 / 2;
    const pts = wide
      ? [[-0.74, -0.6], [0.76, -0.58], [-0.84, 0.42], [0.6, 0.66], [-0.28, 0.82], [0.9, 0.08], [-0.52, -0.92]]
      : [[-0.6, -0.72], [0.62, -0.5], [-0.66, 0.46], [0.5, 0.74], [0.0, -0.9], [0.64, 0.12], [-0.2, 0.9]];
    far = pts.map(([px, py], n) => ({ a: Math.round(px * sx), vc: Math.round(py * sy), Rmax: (56 + ((n * 37) % 5) * 10) * (wide ? 1 : 0.5), d: n * 0.018 }));
    // draft geometry, below the header
    const hh = header ? header.getBoundingClientRect().height : 60;
    const rh = wide ? 10 : 7, lab = wide ? 18 : 16;
    geo = { top0: Math.round(hh + (wide ? 10 : 6)), rh, lab, right0: W - 24 - 8 * rh, bottom: H - 120 };
    if (labels) {
      labels.style.setProperty('--top0', `${geo.top0}px`); labels.style.setProperty('--bh', `${8 * rh}px`);
      labels.style.setProperty('--lab', `${lab}px`); labels.style.setProperty('--right0', `${geo.right0}px`);
      labels.style.setProperty('--bottom', `${geo.bottom}px`); labels.style.setProperty('--rh', `${rh}px`);
    }
    request();
  };

  // ---------------------------------------------------------------------------------------------
  let p = 0;
  const users: UserAgent[] = [];
  let hover = { u: 0, a: 0 };
  let wovenT0 = 0;
  let introDone = reduce;

  const camera = (): Cam => {
    const zin = ease(seg(p, 0.06, 0.34)), zout = ease(seg(p, 0.76, 1));
    let pitch = Math.exp(lerp(Math.log(pitch0), Math.log(pitch1), zin));
    pitch = Math.exp(lerp(Math.log(pitch), Math.log(pitch2), zout));
    return { cx: lerp(lerp(0, F.x, zin), 0, zout), cy: lerp(lerp(cy0, F.y, zin), 0, zout), pitch };
  };

  const storyAgents = (): Agent[] => {
    const list: Agent[] = [];
    const halfRows = H / pitch1 / 2, halfCols = W / pitch1 / 2;
    const zip = seg(p, 0.3, 0.5);
    const top = F.y - halfRows - 6, bottom = F.y + halfRows + 10;
    const tip = zip >= 1 ? 1e5 : lerp(top, bottom, ease(zip));
    const Rcover = halfCols + halfRows * 1.6 + 6;
    const R = lerp(0, Rcover, ease(seg(p, 0.5, 0.76))) + 40 * seg(p, 0.76, 1);
    const bulge = zip > 0 && zip < 1 ? 2.2 : 0;
    list.push({ a: F.x, vc: F.y, tip, R, g: seg(p, 0.29, 0.32), b: bulge * seg(p, 0.29, 0.32) });
    for (const f of far) {
      const s = seg(p, 0.78 + f.d, 0.83 + f.d);
      list.push({ a: f.a, vc: f.vc, tip: 1e5, R: seg(p, 0.79 + f.d, 1) * f.Rmax, g: s, b: 0 });
    }
    return list;
  };

  const clothAt = (x: number, y: number, cam: Cam, agents: Agent[]) => {
    const wx = cam.cx + (x - W / 2) / cam.pitch, v = cam.cy + (y - H / 2) / cam.pitch;
    let shift = 0, inside = false;
    for (const A of agents) {
      const z = (v - A.tip) / 5;
      const g = A.g * (1 - sstep(A.tip - 6, A.tip, v)) + A.b * Math.exp(-z * z);
      const d = wx - A.a, s = Math.abs(d) - g / 2;
      if (s < 0) inside = true; else shift += Math.sign(d) * (g / 2) * Math.exp(-s / 8);
    }
    return { u: wx - shift, v, inside };
  };

  let raf = 0;
  function request() { if (!raf) raf = requestAnimationFrame(frame); }
  let lastAgents: Agent[] = [], lastCam: Cam = { cx: 0, cy: 0, pitch: 6 };

  function frame(now: number) {
    raf = 0;
    if (!maskReady) return;
    const cam = camera();
    let animating = false;
    const viewTop = cam.cy - H / cam.pitch / 2, viewBot = cam.cy + H / cam.pitch / 2;
    let woven = 1e5 + 1;
    if (!introDone) {
      if (!wovenT0) wovenT0 = now + 220; // a beat of bare warp first
      const t = clamp((now - wovenT0) / 750, 0, 1);
      woven = lerp(viewTop - 1, viewBot + 1, 1 - Math.pow(1 - t, 2));
      if (t >= 1) { introDone = true; woven = 1e5 + 1; stage.classList.add('is-woven'); } else animating = true;
    }
    for (const a of users) {
      const t = (now - a.t0) / 1000;
      if (reduce) { a.g = 1; a.b = 0; a.tip = 1e5; a.R = a.Rmax; continue; }
      a.g = out(clamp(t / 0.25, 0, 1));
      const zt = clamp(t / 1.1, 0, 1);
      a.tip = zt >= 1 ? 1e5 : lerp(a.tipFrom, a.tipTo, ease(zt));
      a.b = zt >= 1 ? 0 : 2.4 * Math.sin(Math.PI * Math.min(1, zt * 1.15));
      a.R = a.Rmax * out(clamp((t - 0.5) / 2.4, 0, 1));
      if (t < 3) animating = true;
    }
    const agents = [...storyAgents(), ...users].slice(0, MAXA);
    const A = new Float32Array(MAXA * 4), G = new Float32Array(MAXA * 2);
    agents.forEach((a, n) => { A.set([a.a, a.vc, a.tip, a.R], n * 4); G.set([a.g, a.b], n * 2); });
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform2f(u.cam, cam.cx, cam.cy);
    gl.uniform1f(u.pitch, cam.pitch * dpr);
    gl.uniform1f(u.dpr, dpr);
    gl.uniform4fv(u.A, A); gl.uniform2fv(u.G, G); gl.uniform1f(u.N, agents.length);
    const bands = seg(p, 0.3, 0.37) * (1 - seg(p, 0.73, 0.78));
    gl.uniform3f(u.hover, hover.u, fine && introDone && bands < 0.5 ? hover.a : 0, users.length >= MAXU ? 1 : 0);
    gl.uniform1f(u.bands, bands);
    gl.uniform1f(u.narrow, W < 700 ? 1 : 0);
    gl.uniform4f(u.geo, geo.top0 * dpr, geo.rh * dpr, geo.right0 * dpr, geo.lab * dpr);
    gl.uniform1f(u.bottom, geo.bottom * dpr);
    gl.uniform1f(u.woven, woven);
    gl.uniform1f(u.ss, cam.pitch * dpr < 5 ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (labels) labels.classList.toggle('is-on', bands > 0.97);
    lastAgents = agents; lastCam = cam;
    if (animating) request();
  }

  // ---------------------------------------------------------------------------------------------
  const onScroll = () => {
    const r = stage.parentElement!.getBoundingClientRect();
    const run = r.height - innerHeight;
    let np = clamp(-r.top / Math.max(1, run), 0, 1);
    if (reduce) { const keys = [0, 0.5, 0.74, 1]; np = keys.reduce((b, k2) => (Math.abs(k2 - np) < Math.abs(b - np) ? k2 : b), 0); }
    if (header) header.dataset.tone = r.bottom < 70 ? 'light' : np > 0.08 ? 'dark' : 'clear';
    if (np !== p) {
      p = np;
      stage.dataset.state = String(p < 0.2 ? 0 : p < 0.5 ? 1 : p < 0.76 ? 2 : 3);
      request();
    }
  };

  const local = (e: PointerEvent | MouseEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const inDraft = (x: number, y: number) => {
    const b = seg(p, 0.3, 0.37) * (1 - seg(p, 0.73, 0.78));
    if (b < 0.5) return false;
    return (y >= geo.top0 && y < geo.top0 + 8 * geo.rh + geo.lab) || (W >= 700 && x >= geo.right0 && y < geo.bottom);
  };
  canvas.addEventListener('pointermove', (e) => {
    if (!fine) return;
    const { x, y } = local(e);
    const c = clothAt(x, y, lastCam, lastAgents);
    const nu = Math.round(c.u), na = c.inside || inDraft(x, y) ? 0 : 1;
    if (nu !== hover.u || na !== hover.a) { hover = { u: nu, a: na }; request(); }
  });
  canvas.addEventListener('pointerleave', () => { if (hover.a) { hover.a = 0; request(); } });
  const updateCount = (full = false) => {
    if (!counter) return;
    counter.textContent = `Threads ${users.length} / ${MAXU}`;
    counter.hidden = users.length === 0;
    counter.classList.toggle('is-full', full);
    if (full) { counter.classList.remove('flash'); void counter.offsetWidth; counter.classList.add('flash'); }
  };
  canvas.addEventListener('click', (e) => {
    const { x, y } = local(e);
    if (inDraft(x, y)) return;
    if (users.length >= MAXU) { updateCount(true); return; }
    const cam = lastCam;
    const c = clothAt(x, y, cam, lastAgents);
    const a = Math.round(c.u);
    if (c.inside || lastAgents.some((g) => g.g > 0 && Math.abs(g.a - a) < 3)) return;
    const viewTop = cam.cy - H / cam.pitch / 2, viewBot = cam.cy + H / cam.pitch / 2;
    const Rmax = clamp((Math.min(W, H) / cam.pitch) * 0.3, 14, 64);
    users.push({ a, vc: Math.floor(c.v), tip: viewTop - 8, R: 0, g: 0, b: 0, t0: performance.now(), tipFrom: viewTop - 8, tipTo: viewBot + 12, Rmax });
    updateCount(users.length >= MAXU);
    request();
  });

  let lw = 0, lh = 0;
  new ResizeObserver(() => {
    const w = stage.clientWidth, h = stage.clientHeight;
    // ignore small height changes from mobile browser chrome
    if (w === lw && Math.abs(h - lh) < 90 && lw) return;
    lw = w; lh = h; layout().then(onScroll);
  }).observe(stage);
  addEventListener('scroll', onScroll, { passive: true });
}
