// The sheet renderer. Two gratings over the whole viewport:
//   the reference grating never moves; the second follows a displacement field D(x, y).
// Where D = 0 they coincide and the sheet is plain. Where the sheet is deformed they slip, and what the eye sees
// from reading distance is the moiré: smooth bands whose contour lines are the contour lines of D.
// We draw exactly that low-passed moiré as a tone (lilac ↔ rose), with only a faint, wide ruling on top,
// so the idea stays legible without a high-contrast stripe field (pattern glare).

export interface Frame {
  bounds: number[];      // 6 x-positions (css px): the seams between the five regions
  comps: number[];       // 5 values, 0 = open, 1 = folded
  strip: number;         // folds only apply above this y (phones: the top strip); desktop: huge
  dim: number;           // strength of the folds (1 at the top of a page, lower while reading)
  band: number[] | null; // x, y, w, h of the band (css px)
  agents: number[][];    // [x, y, amp (pitches), sigma px] in band px
  front: number[];       // radius px, amplitude (pitches), half-width px
  cursor: number[];      // x, y, strength
  wave: number[];        // x, amplitude (pitches), width
  ripples: number[][];   // [x, y, age s, amp]
  pitch: number;
  intro: number;         // 0..1: the gratings settle into register on first load
}

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 u_res; uniform float u_dpr; uniform float u_p;
uniform float u_b[6]; uniform float u_comp[5]; uniform float u_strip; uniform float u_dim;
uniform vec4 u_band; uniform float u_hasBand; uniform sampler2D u_mask; uniform float u_hasMask;
uniform vec4 u_ag[6]; uniform float u_nag;
uniform vec3 u_front;
uniform vec3 u_cur; uniform vec3 u_wave; uniform vec4 u_rip[4]; uniform float u_intro;
uniform vec3 u_ground; uniform vec3 u_ink; uniform vec3 u_acc;

float lines(float s, float w) {
  float fw = fwidth(s);
  float d = abs(fract(s / u_p + 0.5) - 0.5) * u_p;
  float aa = max(fw * 0.6, 0.55 / u_dpr);
  float c = 1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, d);
  return mix(c, w / u_p, smoothstep(u_p * 0.25, u_p * 0.6, fw));
}
// the moiré seen from reading distance: 0 where the gratings coincide, 1 where they are half a pitch apart
float fringe(float D) {
  float ph = D / u_p;
  float t = 0.5 - 0.5 * cos(6.2831853 * ph);
  t = smoothstep(0.12, 0.88, t);
  return mix(t, 0.5, smoothstep(0.22, 0.55, fwidth(ph)));
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, u_res.y * u_dpr - gl_FragCoord.y) / u_dpr;
  float x = frag.x; float y = frag.y;

  // folded regions: each strip is sheared at its own angle and phase, in proportion to how far it is folded
  float c = 0.0; float ang = 0.0; float phs = 0.0;
  for (int i = 0; i < 5; i++) {
    float a0 = smoothstep(u_b[i] - 6.0, u_b[i] + 6.0, x);
    float a1 = 1.0 - smoothstep(u_b[i + 1] - 6.0, u_b[i + 1] + 6.0, x);
    float wgt = a0 * a1;
    float fi = float(i);
    c += u_comp[i] * wgt;
    ang += (0.018 + 0.011 * fi) * (mod(fi, 2.0) * 2.0 - 1.0) * wgt;
    phs += fi * 1.9 * wgt;
  }
  c *= 1.0 - smoothstep(u_strip - 2.0, u_strip + 2.0, y);
  float Df = c * ((y - u_res.y * 0.5) * ang + u_p * 0.8 * sin(y * 0.008 + phs));

  // the band
  vec2 bl = frag - u_band.xy;
  float inBand = step(0.0, bl.x) * step(0.0, bl.y) * step(bl.x, u_band.z) * step(bl.y, u_band.w) * u_hasBand;
  float Db = 0.0; float dmin = 1e5; float dots = 0.0; float halo = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= u_nag) break;
    vec4 a = u_ag[i];
    float r = length(bl - a.xy);
    Db += a.z * u_p * exp(-r * r / (a.w * a.w));
    dmin = min(dmin, r);
    float on = step(0.01, a.z);
    dots = max(dots, (1.0 - smoothstep(3.6, 4.8, r)) * on);
    halo = max(halo, (1.0 - smoothstep(6.5, 7.7, r)) * on);
  }
  float fr = (1.0 - smoothstep(-u_front.z, u_front.z, dmin - u_front.x)) * step(0.01, u_front.y);
  Db += u_front.y * u_p * fr;

  // pointer, click rings, the wave that runs along the moving seam, the settle-in on load
  float Dx = 0.0;
  vec2 dc = frag - u_cur.xy;
  Dx += u_cur.z * u_p * 1.25 * exp(-dot(dc, dc) / 7000.0);
  for (int i = 0; i < 4; i++) {
    vec4 rp = u_rip[i];
    if (rp.w > 0.0) {
      float r = length(frag - rp.xy);
      float q = (r - rp.z * 300.0) / 50.0;
      Dx += rp.w * u_p * 1.2 * exp(-q * q) * exp(-rp.z * 1.3);
    }
  }
  float wq = (x - u_wave.x) / u_wave.z;
  Dx += u_wave.y * u_p * exp(-wq * wq);
  Dx += u_intro * u_p * 2.5 * (x / u_res.x + 0.4 * y / u_res.y);

  float D = Df + Db * inBand + Dx;
  float t = fringe(D);

  // the title is written into the sheet. Rings and the pointer do not reach inside the letters: a letter is rose on
  // the undisturbed sheet and lilac once the front has shifted it, so it always reads, and it inverts with the sheet.
  float m = u_hasMask > 0.5 ? texture2D(u_mask, bl / u_band.zw).r * inBand : 0.0;
  float edge = u_hasMask > 0.5 ? smoothstep(0.12, 0.45, fwidth(m)) : 0.0;
  t = mix(t, 1.0 - smoothstep(0.35, 0.65, fr), m);

  // folds are quieter than the band, and quieter still while reading
  float strength = mix(1.0, 0.72 * u_dim, c * (1.0 - inBand));
  vec3 col = mix(u_ground, u_acc, t * 0.9 * strength);
  // a faint ruling: the fixed grating, and the moving one in a deeper rose
  float l1 = lines(x, 1.3);
  float l2 = lines(x - D, 1.3);
  col = mix(col, u_ink, l1 * 0.2 * strength * (1.0 - m * 0.6));
  col = mix(col, u_acc * 0.72, l2 * 0.22 * strength * (1.0 - m * 0.6));
  col = mix(col, u_ink, edge * 0.28);
  col = mix(col, u_ground, halo * inBand);
  col = mix(col, u_ink, dots * inBand);
  gl_FragColor = vec4(col, 1.0);
}`;

const hex = (h: string) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

export function createRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
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
  for (const n of ['u_res', 'u_dpr', 'u_p', 'u_b', 'u_comp', 'u_strip', 'u_dim', 'u_band', 'u_hasBand', 'u_mask', 'u_hasMask', 'u_ag', 'u_nag', 'u_front', 'u_cur', 'u_wave', 'u_rip', 'u_intro', 'u_ground', 'u_ink', 'u_acc'])
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
    g.uniform2f(U.u_res, W, H); g.uniform1f(U.u_dpr, dpr); g.uniform1f(U.u_p, f.pitch);
    g.uniform1fv(U.u_b, f.bounds); g.uniform1fv(U.u_comp, f.comps); g.uniform1f(U.u_strip, f.strip); g.uniform1f(U.u_dim, f.dim);
    const b = f.band || [0, 0, 1, 1];
    g.uniform4f(U.u_band, b[0], b[1], Math.max(1, b[2]), Math.max(1, b[3]));
    g.uniform1f(U.u_hasBand, f.band ? 1 : 0);
    g.uniform1f(U.u_hasMask, hasMask);
    const ag = new Float32Array(24); f.agents.slice(0, 6).forEach((a, i) => ag.set([a[0], a[1], a[2], Math.max(1, a[3])], i * 4));
    g.uniform4fv(U.u_ag, ag); g.uniform1f(U.u_nag, Math.min(6, f.agents.length));
    g.uniform3fv(U.u_front, f.front);
    g.uniform3fv(U.u_cur, f.cursor); g.uniform3fv(U.u_wave, f.wave);
    const rp = new Float32Array(16); f.ripples.slice(0, 4).forEach((r, i) => rp.set(r, i * 4));
    g.uniform4fv(U.u_rip, rp);
    g.uniform1f(U.u_intro, f.intro);
    g.drawArrays(g.TRIANGLES, 0, 3);
  }

  resize();
  return { resize, draw, setMask };
}
