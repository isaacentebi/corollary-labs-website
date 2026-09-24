// The sheet renderer. Two line gratings over the whole viewport:
//   the reference grating (ink) never moves;
//   the second grating (accent) is drawn under it and follows a displacement field D(x, y).
// Where D = 0 the accent lines sit exactly under the ink lines and vanish. Where the sheet is deformed they slip out
// and show as fringes; the fringes are the contour lines of D. Colour appears only where something has changed.

export interface Frame {
  bounds: number[];      // 6 x-positions (css px): the seams between the five regions
  comps: number[];       // 5 values, 0 = open, 1 = folded
  strip: number;         // folds only apply above this y (phones: the top strip); desktop: huge
  band: number[] | null; // x, y, w, h of the band (css px)
  bandOn: number;
  agents: number[][];    // [x, y, amp (pitches), sigma px] in band px
  front: number[];       // radius px, amplitude (pitches), half-width px
  breath: number;
  cursor: number[];      // x, y, strength
  wave: number[];        // x, amplitude (pitches), width
  ripples: number[][];   // [x, y, age s, amp]
  time: number;
  pitch: number;
}

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 u_res; uniform float u_dpr; uniform float u_time; uniform float u_p;
uniform float u_b[6]; uniform float u_comp[5]; uniform float u_strip;
uniform vec4 u_band; uniform float u_bandOn; uniform sampler2D u_mask; uniform float u_hasMask;
uniform vec4 u_ag[6]; uniform float u_nag;
uniform vec3 u_front; uniform float u_breath;
uniform vec3 u_cur; uniform vec3 u_wave; uniform vec4 u_rip[4];
uniform vec3 u_ground; uniform vec3 u_ink; uniform vec3 u_acc;

float cov(float s, float w) {
  float fw = fwidth(s);
  float d = abs(fract(s / u_p + 0.5) - 0.5) * u_p;
  float aa = max(fw * 0.6, 0.5 / u_dpr);
  float c = 1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, d);
  return mix(c, w / u_p, smoothstep(u_p * 0.28, u_p * 0.65, fw));
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, u_res.y * u_dpr - gl_FragCoord.y) / u_dpr;
  float x = frag.x; float y = frag.y;
  float D = 0.0;

  // folded regions: the second grating is sheared and rippled in proportion to how far the region is folded
  float c = 0.0;
  for (int i = 0; i < 5; i++) {
    float a0 = smoothstep(u_b[i] - 9.0, u_b[i] + 9.0, x);
    float a1 = 1.0 - smoothstep(u_b[i + 1] - 9.0, u_b[i + 1] + 9.0, x);
    c += u_comp[i] * a0 * a1;
  }
  c *= 1.0 - smoothstep(u_strip - 3.0, u_strip + 3.0, y);
  float yc = y - u_res.y * 0.5;
  D += c * (yc * 0.09 + u_p * 0.7 * sin(y * 0.009 + u_time * 0.42 + x * 0.012));

  // the band
  vec2 bl = frag - u_band.xy;
  float inBand = step(0.0, bl.x) * step(0.0, bl.y) * step(bl.x, u_band.z) * step(bl.y, u_band.w) * u_bandOn;
  float Db = 0.0; float dmin = 1e5; float dots = 0.0; float halo = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= u_nag) break;
    vec4 a = u_ag[i];
    float r = length(bl - a.xy);
    Db += a.z * u_p * exp(-r * r / (a.w * a.w));
    dmin = min(dmin, r);
    dots = max(dots, (1.0 - smoothstep(4.2, 5.4, r)) * step(0.01, a.z));
    halo = max(halo, (1.0 - smoothstep(7.0, 8.2, r)) * step(0.01, a.z));
  }
  Db += u_front.y * u_p * (1.0 - smoothstep(-u_front.z, u_front.z, dmin - u_front.x));
  Db += u_breath * u_p * sin(bl.x * 0.0042 + u_time * 0.23) * sin(bl.y * 0.0061 - u_time * 0.17);
  float m = u_hasMask > 0.5 ? texture2D(u_mask, bl / u_band.zw).r * inBand : 0.0;
  Db += m * 0.5 * u_p;
  D += Db * inBand;

  // the pointer, clicks, and the wave that crosses the sheet when a region opens
  vec2 dc = frag - u_cur.xy;
  D += u_cur.z * u_p * 2.4 * exp(-dot(dc, dc) / 15000.0);
  for (int i = 0; i < 4; i++) {
    vec4 rp = u_rip[i];
    if (rp.w > 0.0) {
      float r = length(frag - rp.xy);
      float q = (r - rp.z * 320.0) / 48.0;
      D += rp.w * u_p * 1.7 * exp(-q * q) * exp(-rp.z * 1.1);
    }
  }
  float wq = (x - u_wave.x) / u_wave.z;
  D += u_wave.y * u_p * exp(-wq * wq);

  float c1 = cov(x, u_p * 0.31);
  float c2 = cov(x - D, u_p * 0.27);
  vec3 col = u_ground;
  col = mix(col, u_acc, c2);
  col = mix(col, u_ink, c1 * (0.94 - 0.24 * m));
  col = mix(col, u_ground, halo * inBand);
  col = mix(col, u_ink, dots * inBand);
  gl_FragColor = vec4(col, 1.0);
}`;

const hex = (h: string) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

export function createRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl || !gl.getExtension('OES_standard_derivatives')) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); return null; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U: Record<string, WebGLUniformLocation | null> = {};
  for (const n of ['u_res', 'u_dpr', 'u_time', 'u_p', 'u_b', 'u_comp', 'u_strip', 'u_band', 'u_bandOn', 'u_mask', 'u_hasMask', 'u_ag', 'u_nag', 'u_front', 'u_breath', 'u_cur', 'u_wave', 'u_rip', 'u_ground', 'u_ink', 'u_acc'])
    U[n] = gl.getUniformLocation(prog, n);

  const cs = getComputedStyle(document.documentElement);
  const col = (v: string, d: string) => hex((cs.getPropertyValue(v).trim() || d));
  gl.uniform3fv(U.u_ground, col('--ground', '#e9e7ef'));
  gl.uniform3fv(U.u_ink, col('--ink', '#17141f'));
  gl.uniform3fv(U.u_acc, col('--accent', '#f2305f'));

  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(U.u_mask, 0);
  let hasMask = 0;

  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl!.viewport(0, 0, canvas.width, canvas.height);
  }

  function setMask(src: HTMLCanvasElement | null) {
    if (!src) { hasMask = 0; return; }
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.pixelStorei(gl!.UNPACK_ALIGNMENT, 1);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.LUMINANCE, gl!.LUMINANCE, gl!.UNSIGNED_BYTE, src);
    hasMask = 1;
  }

  function draw(f: Frame) {
    const g = gl!;
    g.uniform2f(U.u_res, W, H); g.uniform1f(U.u_dpr, dpr); g.uniform1f(U.u_time, f.time); g.uniform1f(U.u_p, f.pitch);
    g.uniform1fv(U.u_b, f.bounds); g.uniform1fv(U.u_comp, f.comps); g.uniform1f(U.u_strip, f.strip);
    const b = f.band || [0, 0, 1, 1];
    g.uniform4f(U.u_band, b[0], b[1], Math.max(1, b[2]), Math.max(1, b[3]));
    g.uniform1f(U.u_bandOn, f.band ? f.bandOn : 0);
    g.uniform1f(U.u_hasMask, hasMask);
    const ag = new Float32Array(24); f.agents.slice(0, 6).forEach((a, i) => ag.set([a[0], a[1], a[2], Math.max(1, a[3])], i * 4));
    g.uniform4fv(U.u_ag, ag); g.uniform1f(U.u_nag, Math.min(6, f.agents.length));
    g.uniform3fv(U.u_front, f.front); g.uniform1f(U.u_breath, f.breath);
    g.uniform3fv(U.u_cur, f.cursor); g.uniform3fv(U.u_wave, f.wave);
    const rp = new Float32Array(16); f.ripples.slice(0, 4).forEach((r, i) => rp.set(r, i * 4));
    g.uniform4fv(U.u_rip, rp);
    g.drawArrays(g.TRIANGLES, 0, 3);
  }

  resize();
  return { resize, draw, setMask, get size() { return { W, H, dpr }; } };
}
