// Sound: off by default, built only after the visitor turns it on (a user gesture),
// torn down when turned off. Nothing sustains and nothing loops: every sound is a short
// event answering something the visitor did (reading forward, drawing).
// Pitches are quantised to a pentatonic set; after the entry the set changes by one note.

import type { Grammar } from './model';

const SET_A = [0, 3, 5, 7, 10];       // A minor pentatonic (A C D E G)
const SET_B = [-4, 0, 3, 5, 10];      // re-harmonised: E moves to F (F A C D G)
const ROOT = 110;                     // A2

export function pitch(y: number, r: number, octaveShift = 0) {
  const set = r < 0.5 ? SET_A : SET_B;
  const idx = Math.round((1 - Math.min(1, Math.max(0, y))) * 12);
  const semi = set[idx % 5] + 12 * Math.floor(idx / 5) + 12 * octaveShift;
  return ROOT * Math.pow(2, semi / 12);
}

export class Sound {
  ctx: AudioContext | null = null;
  out!: GainNode;
  bus!: GainNode;
  on = false;
  private stamps: number[] = [];

  enable() {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return false;
    const ctx: AudioContext = new AC();
    this.ctx = ctx;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 0.2;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3;
    this.out = ctx.createGain(); this.out.gain.value = 0;
    this.bus = ctx.createGain(); this.bus.gain.value = 1;
    // a small room: generated decaying noise, mixed low
    const len = Math.floor(ctx.sampleRate * 1.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    const verb = ctx.createConvolver(); verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    this.bus.connect(lp); lp.connect(comp); lp.connect(verb); verb.connect(wet); wet.connect(comp);
    comp.connect(this.out); this.out.connect(ctx.destination);
    this.out.gain.setTargetAtTime(0.7, ctx.currentTime, 0.15);
    this.on = true;
    return true;
  }

  disable() {
    const ctx = this.ctx; if (!ctx) return;
    this.on = false;
    this.out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    setTimeout(() => ctx.close(), 300);
    this.ctx = null;
  }

  /** Rate limit: at most 7 notes in any 400 ms, so fast scrolling thins out instead of piling up. */
  private allow() {
    const now = performance.now();
    this.stamps = this.stamps.filter((s) => now - s < 400);
    if (this.stamps.length >= 7) return false;
    this.stamps.push(now);
    return true;
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  private voice(pan: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; g.connect(p); p.connect(this.bus); } else g.connect(this.bus);
    return g;
  }
  private osc(type: OscillatorType, f: number, dest: AudioNode, t: number, stop: number, detune = 0) {
    const o = this.ctx!.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(t + stop); return o;
  }

  /** One event of a voice, voiced in that voice's grammar. */
  play(g: Grammar | 'agent' | 'pen', y: number, r: number, weight = 1, pan = 0) {
    const ctx = this.ctx; if (!ctx || !this.on || !this.allow()) return;
    const t = ctx.currentTime + 0.01;
    const v = Math.min(1, Math.max(0.25, weight));
    const out = this.voice(pan);
    switch (g) {
      case 'agent': {             // clear, slightly bright: sine plus its octave
        const f = pitch(y, r, 1);
        this.env(out, t, 0.11 * v, 0.012, 1.1);
        this.osc('sine', f, out, t, 1.2);
        const h = ctx.createGain(); h.gain.value = 0.18; h.connect(out); this.osc('sine', f * 2, h, t, 1.2);
        break;
      }
      case 'pen': {               // the drawn line: a quiet, round tone
        const f = pitch(y, r, 1);
        this.env(out, t, 0.08, 0.02, 0.55);
        this.osc('triangle', f, out, t, 0.6);
        break;
      }
      case 'fan': {               // strings: three detuned voices gliding into the note
        const f = pitch(y, r, 1);
        this.env(out, t, 0.05 * v, 0.08, 1.0);
        for (const d of [-7, 0, 6]) { const o = this.osc('sawtooth', f * 0.97, out, t, 1.15, d); o.frequency.exponentialRampToValueAtTime(f, t + 0.22); }
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
        out.disconnect(); out.connect(lp); lp.connect(this.bus);
        break;
      }
      case 'line': {              // a swell
        const f = pitch(y, r, 0);
        this.env(out, t, 0.07 * v, 0.18, 0.9);
        this.osc('triangle', f, out, t, 1.15);
        break;
      }
      case 'points': {            // a pluck
        const f = pitch(y, r, 1);
        this.env(out, t, 0.08 * v, 0.004, 0.42);
        this.osc('sine', f, out, t, 0.5);
        const h = ctx.createGain(); h.gain.value = 0.3; h.connect(out); this.osc('sine', f * 3.01, h, t, 0.2);
        break;
      }
      case 'boxes': {             // a soft dyad
        const f = pitch(y, r, 0);
        this.env(out, t, 0.045 * v, 0.01, 0.5);
        this.osc('sine', f, out, t, 0.6); this.osc('sine', f * 1.5, out, t, 0.6);
        break;
      }
      case 'bars': {              // a low, short thud
        const f = pitch(y, r, -1);
        this.env(out, t, 0.12 * v, 0.004, 0.32);
        const o = this.osc('sine', f * 1.2, out, t, 0.4); o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
        break;
      }
      case 'bands': {             // a band of filtered noise
        const f = pitch(y, r, 1);
        const len = Math.floor(ctx.sampleRate * 0.5);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource(); src.buffer = buf;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 14;
        src.connect(bp); bp.connect(out);
        this.env(out, t, 0.5 * v, 0.03, 0.4);
        src.start(t); src.stop(t + 0.5);
        break;
      }
    }
  }
}
