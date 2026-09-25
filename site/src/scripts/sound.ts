// A quiet generative tone that follows the score. Off by default; created only
// after the visitor turns it on (a user gesture), and fully torn down when off.

const SCALE = [0, 2, 4, 7, 9];

function freq(y: number, r: number) {
  // before the entry the ensemble sits in one mode; afterwards it glides into another
  const root = r < 0.5 ? 110 : 146.83;
  const idx = Math.round((1 - Math.min(1, Math.max(0, y))) * 13);
  const semi = SCALE[idx % 5] + 12 * Math.floor(idx / 5);
  return root * Math.pow(2, semi / 12);
}

export interface Frame { ys: number[]; agentY: number | null; hits: { voice: number; y: number }[]; r: number; moved: boolean; drawY: number | null }

export class Sound {
  ctx: AudioContext | null = null;
  master!: GainNode;
  voices: { o: OscillatorNode; g: GainNode }[] = [];
  agent!: { o: OscillatorNode; g: GainNode };
  pen!: { o: OscillatorNode; g: GainNode };
  on = false;

  enable(n: number) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    this.ctx = ctx;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.3;
    const comp = ctx.createDynamicsCompressor();
    this.master = ctx.createGain(); this.master.gain.value = 0;
    lp.connect(comp); comp.connect(this.master); this.master.connect(ctx.destination);
    const mk = (type: OscillatorType) => { const o = ctx.createOscillator(); o.type = type; const g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(lp); o.start(); return { o, g }; };
    this.voices = Array.from({ length: n }, (_, i) => mk(i % 2 ? 'sine' : 'triangle'));
    this.agent = mk('sine');
    this.pen = mk('sine');
    this.master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.3);
    this.on = true;
    return true;
  }

  disable() {
    const ctx = this.ctx; if (!ctx) return;
    this.on = false;
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    setTimeout(() => ctx.close(), 400);
    this.ctx = null;
  }

  frame(f: Frame) {
    const ctx = this.ctx; if (!ctx || !this.on) return;
    const now = ctx.currentTime;
    f.ys.forEach((y, i) => {
      const v = this.voices[i]; if (!v) return;
      v.o.frequency.setTargetAtTime(freq(y, f.r), now, 0.12);
      if (f.moved) { v.g.gain.cancelScheduledValues(now); v.g.gain.setTargetAtTime(0.012, now, 0.08); v.g.gain.setTargetAtTime(0.0, now + 0.5, 0.7); }
    });
    if (f.agentY != null) {
      this.agent.o.frequency.setTargetAtTime(freq(f.agentY, f.r) * 2, now, 0.05);
      if (f.moved) { this.agent.g.gain.cancelScheduledValues(now); this.agent.g.gain.setTargetAtTime(0.03, now, 0.05); this.agent.g.gain.setTargetAtTime(0, now + 0.6, 0.8); }
    }
    for (const h of f.hits.slice(0, 5)) this.pluck(freq(h.y, f.r) * (h.voice % 2 ? 2 : 1));
    if (f.drawY != null) {
      // drawn line becomes a continuous glide
      this.pen.o.frequency.setTargetAtTime(110 * Math.pow(2, (1 - f.drawY) * 3.2), now, 0.03);
      this.pen.g.gain.setTargetAtTime(0.045, now, 0.04);
    } else this.pen.g.gain.setTargetAtTime(0, now, 0.15);
  }

  pluck(hz: number) {
    const ctx = this.ctx!; const now = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.05, now + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    o.connect(g); g.connect(this.master); o.start(now); o.stop(now + 1);
  }
}
