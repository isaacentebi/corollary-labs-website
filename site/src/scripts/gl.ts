// Minimal WebGL2 instanced renderer for the table: one unit box, per-instance position, size and colour, one draw call.
// World units are CSS px; an orthographic camera maps the z = 0 plane 1:1 to the viewport.

const VERT = `#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
layout(location=2) in vec3 aPos;
layout(location=3) in vec3 aSize;
layout(location=4) in vec3 aCol;
uniform mat4 uMVP;
out vec3 vCol;
void main() {
  vec3 p = aPos + position * aSize;
  float shade = 1.0;
  if (normal.z < 0.5) shade = abs(normal.x) > 0.5 ? 0.36 : 0.56;
  vCol = aCol * shade;
  gl_Position = uMVP * vec4(p, 1.0);
}`;
const FRAG = `#version 300 es
precision mediump float;
in vec3 vCol;
out vec4 o;
void main() { o = vec4(vCol, 1.0); }`;

type M4 = Float32Array;
const mul = (a: M4, b: M4): M4 => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
};
const trans = (x: number, y: number, z: number): M4 => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const rotX = (a: number): M4 => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
const rotZ = (a: number): M4 => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); };
const scale = (k: number): M4 => new Float32Array([k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, 0, 0, 0, 1]);

function box() {
  // 6 faces × 4 vertices; x, y in ±0.5, z in 0..1. Each face: normal, u axis, v axis.
  const F: [number[], number[], number[]][] = [
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  ];
  const v: number[] = [], idx: number[] = [];
  F.forEach(([nrm, U, V], f) => {
    const c = [nrm[0] * 0.5, nrm[1] * 0.5, 0.5 + nrm[2] * 0.5];
    for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      v.push(c[0] + U[0] * a + V[0] * b, c[1] + U[1] * a + V[1] * b, c[2] + U[2] * a + V[2] * b, nrm[0], nrm[1], nrm[2]);
    }
    const o = f * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  return { v: new Float32Array(v), i: new Uint16Array(idx) };
}

export class GL {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  inst: WebGLBuffer;
  uMVP: WebGLUniformLocation;
  W = 1; H = 1;
  constructor(public canvas: HTMLCanvasElement, public max: number) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no webgl2');
    this.gl = gl;
    const sh = (t: number, src: string) => {
      const s = gl.createShader(t)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link');
    this.prog = p;
    this.uMVP = gl.getUniformLocation(p, 'uMVP')!;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const b = box();
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, b.v, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, b.i, gl.STATIC_DRAW);
    this.inst = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferData(gl.ARRAY_BUFFER, max * 36, gl.DYNAMIC_DRAW);
    for (let k = 0; k < 3; k++) {
      gl.enableVertexAttribArray(2 + k);
      gl.vertexAttribPointer(2 + k, 3, gl.FLOAT, false, 36, k * 12);
      gl.vertexAttribDivisor(2 + k, 1);
    }
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
  }

  resize(W: number, H: number, dpr: number) {
    this.W = W; this.H = H;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(data: Float32Array, count: number, pos: [number, number, number], rx: number, rz: number, k: number) {
    const gl = this.gl, Z = 8000;
    const P = new Float32Array([2 / this.W, 0, 0, 0, 0, 2 / this.H, 0, 0, 0, 0, -1 / Z, 0, 0, 0, 0, 1]);
    const MVP = mul(P, mul(trans(pos[0], pos[1], pos[2]), mul(rotX(rx), mul(rotZ(rz), scale(k)))));
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.uMVP, false, MVP);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * 9);
    gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, count);
  }
}
