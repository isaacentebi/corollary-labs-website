// Diffusion as colour: adjacent soft vertical fields across the whole frame (Evertz's bands, Pastine's
// soft edges). Each turns to its own hue when adoption reaches it. It is reached from its neighbours
// with uneven (log-normal) delays, sometimes across a gap; some fields turn late, and some only partly.
import { BAND_COUNT } from './shader';
import { hex } from './params';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// hues from Evertz's paintings (sampled from "Grays + the Expanded Spectrum" and "Be Thou The Rainbow"),
// kept deep enough to carry white text
// Evertz sets saturated hues between greys; the greys are what make the colours read as light
export const BAND_HUES = ['#8e2c25', '#4a4a52', '#9a5418', '#27593d', '#6b6b73', '#24428a', '#4e3279', '#3a3a41', '#17585d', '#7a2a50', '#5c5c64'].map(hex);

export interface BandLayout { bands: Float32Array; hues: Float32Array }

export function layoutBands(aspect: number, seedX = 0): BandLayout {
  const r = rng(5);
  const N = BAND_COUNT;
  const half = aspect / 2 + 0.02;
  // varied widths, contiguous across the frame
  const w = Array.from({ length: N }, () => 0.6 + r() * 0.9);
  const sum = w.reduce((a, b) => a + b, 0);
  const xs: number[] = [-half];
  for (let i = 0; i < N; i++) xs.push(xs[i] + (w[i] / sum) * 2 * half);
  // arrival: shortest paths along the row (and occasionally across one field), uneven delays
  let seed = 0;
  for (let i = 0; i < N; i++) if (xs[i] <= seedX && seedX < xs[i + 1]) seed = i;
  const edges: [number, number][][] = Array.from({ length: N }, () => []);
  for (let i = 0; i < N; i++) {
    for (const j of [i + 1, i + 2]) {
      if (j >= N) continue;
      if (j === i + 2 && r() > 0.3) continue;
      const d = (j - i) * Math.exp((r() - 0.5) * 2.2);
      edges[i].push([j, d]); edges[j].push([i, d]);
    }
  }
  const dist = new Array(N).fill(Infinity), done = new Array(N).fill(false);
  dist[seed] = 0;
  for (let it = 0; it < N; it++) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) break;
    done[u] = true;
    for (const [v, d] of edges[u]) if (dist[u] + d < dist[v]) dist[v] = dist[u] + d;
  }
  const max = Math.max(...dist);
  const bands = new Float32Array(N * 4);
  const hues = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const partial = r() < 0.22 ? 0.45 + r() * 0.25 : 1;       // some turn only partly
    const late = r() < 0.12 ? 0.15 : 0;                        // some turn late
    bands.set([xs[i], xs[i + 1], (dist[i] / max) * 0.72 + late, partial], i * 4);
    hues.set(BAND_HUES[i % BAND_HUES.length], i * 3);
  }
  return { bands, hues };
}
