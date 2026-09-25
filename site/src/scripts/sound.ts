// Small mechanical sounds, synthesised (no files). Off by default; the Sound switch turns them on.
let ctx: AudioContext | null = null;
const on = () => document.documentElement.getAttribute('data-sound') === 'on';

function ac() {
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function click(freq: number, dur: number, gain: number, delay = 0) {
  if (!on()) return;
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 3.5;
  const g = a.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}
function tone(freq: number, dur: number, gain: number) {
  if (!on()) return;
  const a = ac(); if (!a) return;
  const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}

export const sound = {
  tick: () => click(3200, 0.018, 0.22),
  detent: () => { click(2400, 0.02, 0.28); click(1500, 0.03, 0.12, 0.012); },
  switchOn: () => { click(1800, 0.025, 0.35); click(900, 0.04, 0.18, 0.03); },
  switchOff: () => { click(1300, 0.025, 0.3); click(700, 0.04, 0.16, 0.028); },
  ping: () => tone(1320, 0.28, 0.05),
  unlock: () => ac(),
};
