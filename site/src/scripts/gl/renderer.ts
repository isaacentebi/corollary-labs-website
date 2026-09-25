// One renderer for every face on the site. Instances are given in screen space (CSS px);
// the shader draws each one as a signed-distance shape, so gauges stay crisp at any zoom.
// Kinds: 0 gauge (ring + needle + hub), 1 disc, 2 ring, 3 rounded rect.
// WebGL2 when available, Canvas 2D otherwise (same instance list).

export const STRIDE = 12; // x y s1 s2 | angle kind p1 p2 | r g b a

export class Batch {
  data = new Float32Array(STRIDE * 2048);
  n = 0;
  reset() { this.n = 0; }
  push(kind: number, x: number, y: number, s1: number, s2: number, angle: number, c: readonly number[], a: number, p1 = 0, p2 = 0) {
    if ((this.n + 1) * STRIDE > this.data.length) {
      const d = new Float32Array(this.data.length * 2); d.set(this.data); this.data = d;
    }
    const o = this.n * STRIDE, d = this.data;
    d[o] = x; d[o + 1] = y; d[o + 2] = s1; d[o + 3] = s2;
    d[o + 4] = angle; d[o + 5] = kind; d[o + 6] = p1; d[o + 7] = p2;
    d[o + 8] = c[0] / 255; d[o + 9] = c[1] / 255; d[o + 10] = c[2] / 255; d[o + 11] = a;
    this.n++;
  }
}

export interface Renderer {
  kind: 'gl' | '2d';
  resize(w: number, h: number, dpr: number): void;
  draw(b: Batch, clear: readonly number[], ring: readonly number[]): void;
}

const VS = `#version 300 es
layout(location=0) in vec2 corner;
layout(location=1) in vec4 a0;
layout(location=2) in vec4 a1;
layout(location=3) in vec4 col;
uniform vec2 res;
out vec2 vP; flat out vec4 vA0; flat out vec4 vA1; flat out vec4 vCol;
void main() {
  float k = a1.y; vec2 h;
  if (k < 0.5) h = vec2(a0.z * 0.5 + 1.5);
  else if (k < 1.5) h = vec2(a0.z + 1.5);
  else if (k < 2.5) h = vec2(a0.z + a0.w + 1.5);
  else h = a0.zw + 1.5;
  vec2 p = a0.xy + corner * h;
  vP = corner * h; vA0 = a0; vA1 = a1; vCol = col;
  vec2 ndc = p / res * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vP; flat in vec4 vA0; flat in vec4 vA1; flat in vec4 vCol;
uniform float dpr; uniform vec3 ringCol;
out vec4 o;
float cov(float sd) { return clamp(0.5 - sd * dpr, 0.0, 1.0); }
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  float k = vA1.y;
  if (k < 0.5) {
    float s = vA0.z;
    float R = s * 0.37;
    float ring = cov(abs(length(vP) - R) - 0.5) * vA1.z;
    vec2 d = vec2(cos(vA1.x), sin(vA1.x));
    float head = max(s * 0.34, 3.2), tail = s * 0.1;
    float w = clamp(s * 0.052, 1.15, 3.0);
    float n = cov(seg(vP, -d * tail, d * head) - w * 0.5) * vCol.a;
    float hub = s > 70.0 ? cov(length(vP) - max(3.0, s * 0.045)) * vCol.a : 0.0;
    n = max(n, hub);
    vec3 c = ringCol * ring * (1.0 - n) + vCol.rgb * n;
    o = vec4(c, ring * (1.0 - n) + n);
  } else if (k < 1.5) {
    float c = cov(length(vP) - vA0.z) * vCol.a;
    o = vec4(vCol.rgb * c, c);
  } else if (k < 2.5) {
    float c = cov(abs(length(vP) - vA0.z) - vA0.w * 0.5) * vCol.a;
    o = vec4(vCol.rgb * c, c);
  } else {
    float r = vA1.z;
    vec2 q = abs(vP) - vA0.zw + r;
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    float c = cov(sd) * vCol.a;
    o = vec4(vCol.rgb * c, c);
  }
}`;

function makeGL(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: true, preserveDrawingBuffer: false });
  if (!gl) return null;
  const sh = (t: number, src: string) => {
    const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  };
  let prog: WebGLProgram;
  try {
    prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  } catch { return null; }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const inst = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, inst);
  const B = STRIDE * 4;
  for (let i = 0; i < 3; i++) {
    gl.enableVertexAttribArray(1 + i);
    gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, B, i * 16);
    gl.vertexAttribDivisor(1 + i, 1);
  }
  const uRes = gl.getUniformLocation(prog, 'res'), uDpr = gl.getUniformLocation(prog, 'dpr'), uRing = gl.getUniformLocation(prog, 'ringCol');
  let W = 1, H = 1, D = 1;
  return {
    kind: 'gl',
    resize(w, h, dpr) { W = w; H = h; D = dpr; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); },
    draw(b, clear, ring) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(clear[0] / 255, clear[1] / 255, clear[2] / 255, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog); gl.bindVertexArray(vao);
      gl.uniform2f(uRes, W, H); gl.uniform1f(uDpr, D); gl.uniform3f(uRing, ring[0] / 255, ring[1] / 255, ring[2] / 255);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, inst);
      gl.bufferData(gl.ARRAY_BUFFER, b.data.subarray(0, b.n * STRIDE), gl.DYNAMIC_DRAW);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, b.n);
    },
  };
}

function make2D(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d', { alpha: false })!;
  let D = 1, W = 1, H = 1;
  const rgba = (d: Float32Array, o: number, a = d[o + 11]) => `rgba(${Math.round(d[o + 8] * 255)},${Math.round(d[o + 9] * 255)},${Math.round(d[o + 10] * 255)},${a})`;
  return {
    kind: '2d',
    resize(w, h, dpr) { W = w; H = h; D = dpr; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); },
    draw(b, clear, ring) {
      ctx.setTransform(D, 0, 0, D, 0, 0);
      ctx.fillStyle = `rgb(${clear[0]},${clear[1]},${clear[2]})`; ctx.fillRect(0, 0, W, H);
      const d = b.data;
      ctx.lineCap = 'round';
      for (let i = 0; i < b.n; i++) {
        const o = i * STRIDE, x = d[o], y = d[o + 1], s1 = d[o + 2], s2 = d[o + 3], k = d[o + 5];
        if (k === 0) {
          if (d[o + 6] > 0.004) {
            ctx.strokeStyle = `rgba(${ring[0]},${ring[1]},${ring[2]},${d[o + 6]})`; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(x, y, s1 * 0.37, 0, Math.PI * 2); ctx.stroke();
          }
          const c = Math.cos(d[o + 4]), s = Math.sin(d[o + 4]), head = Math.max(s1 * 0.34, 3.2), tail = s1 * 0.1;
          ctx.strokeStyle = rgba(d, o); ctx.lineWidth = Math.min(3, Math.max(1.15, s1 * 0.052));
          ctx.beginPath(); ctx.moveTo(x - c * tail, y - s * tail); ctx.lineTo(x + c * head, y + s * head); ctx.stroke();
        } else if (k === 1) {
          ctx.fillStyle = rgba(d, o); ctx.beginPath(); ctx.arc(x, y, s1, 0, Math.PI * 2); ctx.fill();
        } else if (k === 2) {
          ctx.strokeStyle = rgba(d, o); ctx.lineWidth = s2; ctx.beginPath(); ctx.arc(x, y, s1, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.fillStyle = rgba(d, o); ctx.beginPath(); ctx.roundRect(x - s1, y - s2, s1 * 2, s2 * 2, d[o + 6]); ctx.fill();
        }
      }
    },
  };
}

export function makeRenderer(canvas: HTMLCanvasElement): Renderer {
  const force2d = new URLSearchParams(location.search).has('2d');
  return (!force2d && makeGL(canvas)) || make2D(canvas);
}
