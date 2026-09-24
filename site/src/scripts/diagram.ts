// A small string-diagram renderer. A figure is a list of states; each state places boxes, wires, boundaries and
// labels. Wires are resolved to numbers (endpoints on box ports), then states are interpolated numerically, so a
// transition between two states that keep the same wiring is a continuous deformation of the drawing.
// Elements missing from a state are faded out (boxes, labels) or undrawn (wires).

export type Port = { b: string; side: 'in' | 'out'; dy?: number } | { x: number; y: number };
export interface BoxS { x: number; y: number; w: number; h: number; solid?: number; label?: string; blue?: number; o?: number; dot?: boolean; firm?: number }
export interface WireS { from: Port; to: Port; blue?: number; dash?: number; o?: number; bend?: number; loop?: number; label?: string; note?: string; na?: 'start' | 'end'; lt?: number; ldx?: number; ldy?: number }
export interface BndS { x: number; y: number; w: number; h: number; blue?: number; o?: number; tag?: string }
export interface LabS { x: number; y: number; text: string; o?: number; blue?: number; cls?: string; anchor?: 'start' | 'middle' | 'end' }
export interface State { boxes?: Record<string, BoxS>; wires?: Record<string, WireS>; bounds?: Record<string, BndS>; labels?: Record<string, LabS> }

interface End { b?: string; side?: 'in' | 'out'; dy: number; x: number; y: number }
interface WireG { e1: End; e2: End; x1: number; y1: number; x2: number; y2: number; blue: number; dash: number; o: number; draw: number; bend: number; loop: number; label?: string; note?: string; na?: 'start' | 'end'; lt: number; ldx: number; ldy: number }
interface BoxG { x: number; y: number; w: number; h: number; solid: number; blue: number; o: number; label?: string; dot: number; firm: number }
interface BndG { x: number; y: number; w: number; h: number; blue: number; o: number; tag?: string }
interface LabG { x: number; y: number; o: number; blue: number; text: string; cls?: string; anchor: string }
interface Geo { boxes: Record<string, BoxG>; wires: Record<string, WireG>; bounds: Record<string, BndG>; labels: Record<string, LabG> }

export interface Palette { ink: string; paper: string; blue: string }

const NS = 'http://www.w3.org/2000/svg';
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function hex(c: string) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a: string, b: string, t: number) {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`;
}

function resolvePort(p: Port, boxes: Record<string, BoxS>): [number, number] {
  if ('x' in p) return [p.x, p.y];
  const b = boxes[p.b];
  if (!b) return [0, 0];
  return [p.side === 'in' ? b.x - b.w / 2 : b.x + b.w / 2, b.y + (p.dy ?? 0)];
}

function toGeo(s: State): Geo {
  const g: Geo = { boxes: {}, wires: {}, bounds: {}, labels: {} };
  const bx = s.boxes ?? {};
  for (const [k, b] of Object.entries(bx)) g.boxes[k] = { x: b.x, y: b.y, w: b.w, h: b.h, solid: b.solid ?? 1, blue: b.blue ?? 0, o: b.o ?? 1, label: b.label, dot: b.dot ? 1 : 0, firm: b.firm ?? 0 };
  for (const [k, w] of Object.entries(s.wires ?? {})) {
    const [x1, y1] = resolvePort(w.from, bx), [x2, y2] = resolvePort(w.to, bx);
    const end = (p: Port, x: number, y: number): End => ('b' in p ? { b: p.b, side: p.side, dy: p.dy ?? 0, x, y } : { dy: 0, x, y });
    g.wires[k] = { e1: end(w.from, x1, y1), e2: end(w.to, x2, y2), x1, y1, x2, y2, blue: w.blue ?? 0, dash: w.dash ?? 0, o: w.o ?? 1, draw: 1, bend: w.bend ?? 0.5, loop: w.loop ?? 0, label: w.label, note: w.note, na: w.na, lt: w.lt ?? 0.5, ldx: w.ldx ?? 0, ldy: w.ldy ?? -10 };
  }
  for (const [k, b] of Object.entries(s.bounds ?? {})) g.bounds[k] = { x: b.x, y: b.y, w: b.w, h: b.h, blue: b.blue ?? 0, o: b.o ?? 1, tag: b.tag };
  for (const [k, l] of Object.entries(s.labels ?? {})) g.labels[k] = { x: l.x, y: l.y, o: l.o ?? 1, blue: l.blue ?? 0, text: l.text, cls: l.cls, anchor: l.anchor ?? 'middle' };
  return g;
}

function lerpGeo(A: Geo, B: Geo, t: number): Geo {
  const out: Geo = { boxes: {}, wires: {}, bounds: {}, labels: {} };
  const keys = <T,>(a: Record<string, T>, b: Record<string, T>) => [...new Set([...Object.keys(a), ...Object.keys(b)])];
  for (const k of keys(A.boxes, B.boxes)) {
    const a = A.boxes[k] ?? { ...B.boxes[k], o: 0 }, b = B.boxes[k] ?? { ...A.boxes[k], o: 0 };
    out.boxes[k] = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t), solid: lerp(a.solid, b.solid, t), blue: lerp(a.blue, b.blue, t), o: lerp(a.o, b.o, t), label: t < 0.5 ? a.label : b.label, dot: lerp(a.dot, b.dot, t), firm: lerp(a.firm, b.firm, t) };
  }
  for (const k of keys(A.wires, B.wires)) {
    const inA = k in A.wires, inB = k in B.wires;
    const a = A.wires[k] ?? { ...B.wires[k], draw: 0 }, b = B.wires[k] ?? { ...A.wires[k], o: 0, dash: 1 };
    const le = (p: End, q: End): End => (p.b && p.b === q.b && p.side === q.side
      ? { b: p.b, side: p.side, dy: lerp(p.dy, q.dy, t), x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) }
      : { dy: 0, x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) });
    const w: WireG = {
      e1: le(a.e1, b.e1), e2: le(a.e2, b.e2),
      x1: lerp(a.x1, b.x1, t), y1: lerp(a.y1, b.y1, t), x2: lerp(a.x2, b.x2, t), y2: lerp(a.y2, b.y2, t),
      blue: lerp(a.blue, b.blue, t), dash: lerp(a.dash, b.dash, t), o: lerp(a.o, b.o, t), draw: lerp(a.draw, b.draw, t),
      bend: lerp(a.bend, b.bend, t), loop: lerp(a.loop, b.loop, t), label: (t < 0.5 ? a : b).label, note: (t < 0.5 ? a : b).note, na: (t < 0.5 ? a : b).na, lt: lerp(a.lt, b.lt, t), ldx: lerp(a.ldx, b.ldx, t), ldy: lerp(a.ldy, b.ldy, t),
    };
    // wires that leave: dash first, then fade; wires that arrive: draw in along their length
    if (inA && !inB) { w.dash = Math.min(1, t * 3); w.o = t < 0.4 ? 1 : Math.max(0, 1 - (t - 0.4) / 0.6); }
    if (!inA && inB) { w.draw = Math.max(0, Math.min(1, (t - 0.25) / 0.75)); w.o = 1; w.dash = 0; }
    out.wires[k] = w;
  }
  for (const k of keys(A.bounds, B.bounds)) {
    const a = A.bounds[k] ?? { ...B.bounds[k], o: 0 }, b = B.bounds[k] ?? { ...A.bounds[k], o: 0 };
    out.bounds[k] = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t), blue: lerp(a.blue, b.blue, t), o: lerp(a.o, b.o, t), tag: a.tag ?? b.tag };
  }
  for (const k of keys(A.labels, B.labels)) {
    const a = A.labels[k] ?? { ...B.labels[k], o: 0 }, b = B.labels[k] ?? { ...A.labels[k], o: 0 };
    out.labels[k] = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), o: lerp(a.o, b.o, t), blue: lerp(a.blue, b.blue, t), text: t < 0.5 ? a.text : b.text, cls: a.cls ?? b.cls, anchor: a.anchor };
  }
  return out;
}

/** Path of a progressive wire: horizontal, an S-bend centred at `bend`, horizontal. Loops return right-to-left above. */
export function wirePath(w: { x1: number; y1: number; x2: number; y2: number; bend: number; loop: number }) {
  const { x1, y1, x2, y2 } = w;
  const f = (n: number) => n.toFixed(1);
  if (Math.abs(w.loop) > 0.5 || x2 < x1 - 1) {
    // feedback (trace): leave to the right, turn to the loop height (above if loop > 0, below if < 0),
    // run back left, and turn into the input from the left
    const top = w.loop < 0 ? Math.max(y1, y2) + Math.max(30, -w.loop) : Math.min(y1, y2) - Math.max(40, w.loop > 1 ? w.loop : 60);
    const r = 34;
    return `M${f(x1)} ${f(y1)} C${f(x1 + r)} ${f(y1)} ${f(x1 + r)} ${f(top)} ${f(x1)} ${f(top)} L${f(x2)} ${f(top)} C${f(x2 - r)} ${f(top)} ${f(x2 - r)} ${f(y2)} ${f(x2)} ${f(y2)}`;
  }
  const dx = x2 - x1, dy = Math.abs(y2 - y1);
  if (dy < 0.5) return `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)}`;
  const xm = x1 + w.bend * dx;
  const s = Math.max(4, Math.min(dx * Math.min(w.bend, 1 - w.bend) * 0.98, Math.max(26, dy * 0.75)));
  return `M${f(x1)} ${f(y1)} L${f(xm - s)} ${f(y1)} C${f(xm)} ${f(y1)} ${f(xm)} ${f(y2)} ${f(xm + s)} ${f(y2)} L${f(x2)} ${f(y2)}`;
}

export class Diagram {
  svg: SVGSVGElement;
  states: Geo[];
  pal: Palette;
  els = new Map<string, SVGElement>();
  layers: Record<string, SVGGElement> = {};
  constructor(svg: SVGSVGElement, states: State[], pal: Palette) {
    this.svg = svg; this.pal = pal;
    this.states = states.map(toGeo);
    for (const n of ['bounds', 'boxes', 'wires', 'labels']) {
      const g = document.createElementNS(NS, 'g'); g.setAttribute('class', `dg-${n}`); svg.appendChild(g); this.layers[n] = g;
    }
  }
  private el(key: string, layer: string, make: () => SVGElement) {
    let e = this.els.get(key);
    if (!e) { e = make(); this.layers[layer].appendChild(e); this.els.set(key, e); }
    return e;
  }
  /** s is a continuous state index: 1.4 = 40% of the way from state 1 to state 2. */
  render(s: number, wobble?: (key: string, x: number, y: number) => [number, number]) {
    const n = this.states.length;
    s = Math.max(0, Math.min(n - 1, s));
    const i = Math.min(n - 2, Math.floor(s));
    let g = n === 1 ? this.states[0] : lerpGeo(this.states[i], this.states[i + 1], s - i);
    if (wobble) g = applyWobble(g, wobble);
    this.draw(attach(g));
  }
  private draw(g: Geo) {
    const { ink, paper, blue } = this.pal;
    for (const [k, b] of Object.entries(g.bounds)) {
      const grp = this.el('B' + k, 'bounds', () => {
        const e = document.createElementNS(NS, 'g');
        e.innerHTML = `<rect class="dg-bnd" rx="10"/><text class="dg-tag"></text>`;
        return e;
      });
      const r = grp.querySelector('rect')!, t = grp.querySelector('text')!;
      r.setAttribute('x', `${b.x}`); r.setAttribute('y', `${b.y}`); r.setAttribute('width', `${Math.max(0, b.w)}`); r.setAttribute('height', `${Math.max(0, b.h)}`);
      r.setAttribute('stroke', mix(ink, blue, b.blue));
      grp.setAttribute('opacity', `${b.o}`);
      if (b.tag) { t.textContent = b.tag; t.setAttribute('x', `${b.x + 14}`); t.setAttribute('y', `${b.y + 28}`); t.setAttribute('fill', mix(ink, blue, b.blue)); }
    }
    for (const [k, w] of Object.entries(g.wires)) {
      const grp = this.el('W' + k, 'wires', () => {
        const e = document.createElementNS(NS, 'g');
        e.innerHTML = `<path class="dg-wire" pathLength="1000"/><text class="dg-wl"></text><text class="dg-note"></text>`;
        return e;
      });
      const p = grp.querySelector('path')!, t = grp.querySelector('text')!, nt = grp.querySelector<SVGTextElement>('.dg-note')!;
      const d = wirePath(w);
      p.setAttribute('d', d);
      p.setAttribute('stroke', mix(ink, blue, w.blue));
      p.style.strokeLinecap = w.draw < 0.999 || w.dash > 0.02 ? 'butt' : '';
      if (w.draw < 0.999) { p.setAttribute('stroke-dasharray', `${w.draw * 1000} 1000`); }
      else if (w.dash > 0.02) { p.setAttribute('stroke-dasharray', `${lerp(1000, 14, Math.min(1, w.dash))} ${lerp(0, 12, Math.min(1, w.dash))}`); }
      else p.removeAttribute('stroke-dasharray');
      grp.setAttribute('opacity', `${w.draw < 0.004 ? 0 : w.o}`);
      if (w.label) {
        const [lx, ly] = pointOn(w, w.lt);
        t.textContent = w.label; t.setAttribute('x', `${lx + w.ldx}`); t.setAttribute('y', `${ly + w.ldy}`);
        t.setAttribute('fill', mix(ink, blue, w.blue));
        t.setAttribute('opacity', `${Math.min(1, w.draw * 1.5)}`);
      } else t.textContent = '';
      if (w.note) {
        // a word under a wire: at the wire's outer end when anchored ('start' = left end, 'end' = right end), else at lt
        const [lx, ly] = w.na === 'start' ? [w.x1 + 2, w.y1] : w.na === 'end' ? [w.x2 - 2, w.y2] : pointOn(w, w.lt);
        nt.textContent = w.note; nt.setAttribute('x', `${w.na ? lx : lx + w.ldx}`); nt.setAttribute('y', `${ly + 22}`);
        nt.style.textAnchor = w.na ?? 'middle';
        nt.setAttribute('fill', mix(ink, blue, w.blue));
        nt.setAttribute('opacity', `${Math.min(1, w.draw * 1.5)}`);
      } else nt.textContent = '';
    }
    for (const [k, b] of Object.entries(g.boxes)) {
      const grp = this.el('X' + k, 'boxes', () => {
        const e = document.createElementNS(NS, 'g');
        e.innerHTML = `<rect class="dg-box"/><circle class="dg-dot" r="6"/><text class="dg-bl"></text>`;
        return e;
      });
      const r = grp.querySelector('rect')!, c = grp.querySelector('circle')!, t = grp.querySelector('text')!;
      const edge = mix(ink, blue, b.blue);
      r.setAttribute('x', `${b.x - b.w / 2}`); r.setAttribute('y', `${b.y - b.h / 2}`); r.setAttribute('width', `${b.w}`); r.setAttribute('height', `${b.h}`);
      r.setAttribute('stroke', edge);
      r.style.strokeWidth = `${1.6 + 2.4 * b.firm}`;
      r.setAttribute('fill', mix(paper, blueFill(ink, blue, b.blue), b.solid));
      r.setAttribute('opacity', `${1 - b.dot}`);
      c.setAttribute('cx', `${b.x}`); c.setAttribute('cy', `${b.y}`); c.setAttribute('fill', edge); c.setAttribute('opacity', `${b.dot}`);
      grp.setAttribute('opacity', `${b.o}`);
      if (b.label) {
        t.innerHTML = b.label; t.setAttribute('x', `${b.x}`); t.setAttribute('y', `${b.y + 7}`);
        t.setAttribute('fill', b.solid > 0.5 ? paper : edge);
      } else t.textContent = '';
    }
    for (const [k, l] of Object.entries(g.labels)) {
      const t = this.el('L' + k, 'labels', () => document.createElementNS(NS, 'text')) as SVGTextElement;
      if (t.dataset.text !== l.text) { t.innerHTML = l.text; t.dataset.text = l.text; }
      t.setAttribute('x', `${l.x}`); t.setAttribute('y', `${l.y}`); t.setAttribute('opacity', `${l.o}`);
      t.setAttribute('fill', mix(ink, blue, l.blue)); t.setAttribute('text-anchor', l.anchor);
      t.setAttribute('class', `dg-lab ${l.cls ?? ''}`);
    }
  }
}

function blueFill(ink: string, blue: string, b: number) {
  const A = hex(ink), B = hex(blue);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], b)).toString(16).padStart(2, '0')).join('');
}

function pointOn(w: WireG, t: number): [number, number] {
  if (w.loop < -0.5) return [lerp(w.x1, w.x2, t), Math.max(w.y1, w.y2) + Math.max(30, -w.loop)];
  if (w.loop > 0.5) return [lerp(w.x1, w.x2, t), Math.min(w.y1, w.y2) - Math.max(40, w.loop > 1 ? w.loop : 60)];
  const x = lerp(w.x1, w.x2, t);
  const xm = w.x1 + w.bend * (w.x2 - w.x1);
  const y = x < xm - 30 ? w.y1 : x > xm + 30 ? w.y2 : lerp(w.y1, w.y2, (x - xm + 30) / 60);
  return [x, y];
}

function applyWobble(g: Geo, f: (key: string, x: number, y: number) => [number, number]): Geo {
  const boxes: Record<string, BoxG> = {};
  for (const [k, b] of Object.entries(g.boxes)) { const [dx, dy] = f(k, b.x, b.y); boxes[k] = { ...b, x: b.x + dx, y: b.y + dy }; }
  return { ...g, boxes };
}

/** Re-attach wire ends to the (interpolated, possibly wobbled) boxes they belong to. */
function attach(g: Geo): Geo {
  const at = (e: End): [number, number] => {
    const b = e.b ? g.boxes[e.b] : undefined;
    if (!b) return [e.x, e.y];
    return [e.side === 'in' ? b.x - b.w / 2 : b.x + b.w / 2, b.y + e.dy];
  };
  for (const w of Object.values(g.wires)) { [w.x1, w.y1] = at(w.e1); [w.x2, w.y2] = at(w.e2); }
  return g;
}
