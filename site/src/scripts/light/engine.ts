// WebGL field. Draws only when its parameters, size or pointer change; eases toward a target and stops
// once it has arrived.
import { vert, frag, NODE_COUNT } from './shader';
import { KEYS, SIZES, LENGTH, pack, DEFAULTS, type State } from './params';

export class LightField {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | null;
  prog: WebGLProgram | null = null;
  loc: (WebGLUniformLocation | null)[] = [];
  uRes: WebGLUniformLocation | null = null;
  uPointer: WebGLUniformLocation | null = null;
  uSeed: WebGLUniformLocation | null = null;
  uNodes: WebGLUniformLocation | null = null;
  cur = new Float32Array(LENGTH);
  tgt = new Float32Array(LENGTH);
  pointer = [0, 0];
  pointerTgt = [0, 0];
  nodes = new Float32Array(NODE_COUNT * 4);
  tau = 0.28; // seconds, easing time constant
  scale: number;
  raf = 0;
  last = 0;
  w = 0; h = 0;
  onFrame?: () => void;
  ok = false;

  constructor(canvas: HTMLCanvasElement, opts: { scale?: number } = {}) {
    this.canvas = canvas;
    this.scale = opts.scale ?? Math.min(window.devicePixelRatio || 1, 1.5);
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    this.gl = gl;
    if (!gl) return;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vert));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return; }
    gl.useProgram(prog);
    this.prog = prog;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    this.loc = KEYS.map((k) => gl.getUniformLocation(prog, k));
    this.uRes = gl.getUniformLocation(prog, 'uRes');
    this.uPointer = gl.getUniformLocation(prog, 'uPointer');
    this.uSeed = gl.getUniformLocation(prog, 'uSeed');
    this.uNodes = gl.getUniformLocation(prog, 'uNodes[0]');
    pack(DEFAULTS, this.cur);
    pack(DEFAULTS, this.tgt);
    this.ok = true;
    gl.uniform1f(this.uSeed, Math.random() * 100);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(2, Math.round(r.width * this.scale));
    const h = Math.max(2, Math.round(r.height * this.scale));
    if (w === this.w && h === this.h) return false;
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;
    this.gl?.viewport(0, 0, w, h);
    this.draw();
    return true;
  }

  // draw one still at an exact size (for plates): no easing, no loop
  still(w: number, h: number, params: Float32Array) {
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;
    this.gl?.viewport(0, 0, w, h);
    this.cur.set(params); this.tgt.set(params);
    this.draw();
  }

  get aspect() { return this.w / Math.max(1, this.h); }

  setNodes(n: Float32Array) { this.nodes = n; this.request(); }
  setTarget(s: State | Float32Array) { if (s instanceof Float32Array) this.tgt.set(s); else pack(s, this.tgt); this.request(); }
  snap() { this.cur.set(this.tgt); this.pointer = [...this.pointerTgt]; this.draw(); }
  setPointer(x: number, y: number) { this.pointerTgt = [x, y]; this.request(); }

  request() {
    if (this.raf || !this.ok) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  // a scripted fade from one state to the target (the light coming on), then normal easing resumes
  tweenFrom: Float32Array | null = null;
  tweenT0 = 0;
  tweenDur = 1;
  tween(from: Float32Array, seconds: number) {
    this.tweenFrom = new Float32Array(from);
    this.cur.set(from);
    this.tweenT0 = performance.now();
    this.tweenDur = seconds * 1000;
    this.draw();
    this.request();
  }

  tick = (now: number) => {
    this.raf = 0;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const k = this.tau <= 0 ? 1 : 1 - Math.exp(-dt / this.tau);
    let moving = false;
    if (this.tweenFrom) {
      const t = Math.min(1, (now - this.tweenT0) / this.tweenDur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      for (let i = 0; i < LENGTH; i++) this.cur[i] = this.tweenFrom[i] + (this.tgt[i] - this.tweenFrom[i]) * e;
      if (t >= 1) this.tweenFrom = null;
      this.draw();
      this.onFrame?.();
      this.raf = requestAnimationFrame(this.tick);
      return;
    }
    for (let i = 0; i < LENGTH; i++) {
      const d = this.tgt[i] - this.cur[i];
      if (Math.abs(d) > 1e-4) { this.cur[i] += d * k; moving = true; } else this.cur[i] = this.tgt[i];
    }
    for (let i = 0; i < 2; i++) {
      const d = this.pointerTgt[i] - this.pointer[i];
      if (Math.abs(d) > 1e-4) { this.pointer[i] += d * (1 - Math.exp(-dt / 0.6)); moving = true; } else this.pointer[i] = this.pointerTgt[i];
    }
    this.draw();
    this.onFrame?.();
    if (moving) { this.raf = requestAnimationFrame(this.tick); }
  };

  draw() {
    const gl = this.gl;
    if (!gl || !this.ok || !this.w) return;
    let o = 0;
    for (let i = 0; i < KEYS.length; i++) {
      const l = this.loc[i], n = SIZES[i];
      if (l) {
        if (n === 1) gl.uniform1f(l, this.cur[o]);
        else if (n === 2) gl.uniform2f(l, this.cur[o], this.cur[o + 1]);
        else if (n === 3) gl.uniform3f(l, this.cur[o], this.cur[o + 1], this.cur[o + 2]);
        else gl.uniform4f(l, this.cur[o], this.cur[o + 1], this.cur[o + 2], this.cur[o + 3]);
      }
      o += n;
    }
    gl.uniform2f(this.uRes, this.w, this.h);
    gl.uniform2f(this.uPointer, this.pointer[0], this.pointer[1]);
    gl.uniform4fv(this.uNodes, this.nodes);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy() { cancelAnimationFrame(this.raf); this.gl?.getExtension('WEBGL_lose_context')?.loseContext(); }
}
