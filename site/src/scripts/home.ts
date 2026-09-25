// Home: the hero's living backdrop (the diffusion field) and the Approach figure (see story.ts).
import { onDispose, reduced } from './core';
import { DiffusionField } from './field';
import { initStory } from './story';

export function initHome(_introDone: Promise<void>) {
  const c = document.querySelector<HTMLCanvasElement>('[data-field="hero"]');
  if (c) {
    const phone = innerWidth < 700;
    // seeds sit away from the text; adoption spreads slowly on its own, the cursor accelerates it, a click plants a seed
    const A = new DiffusionField(c, {
      mode: 'auto', autoSpeed: 0.011, autoMax: 0.42, staticT: 0.3, spacing: phone ? 20 : 26, seed: 11, global: true, sleepAfter: 6,
      seeds: phone ? [[0.8, 0.12], [0.2, 0.3], [0.9, 0.95]] : [[0.62, 0.2], [0.9, 0.62], [0.74, 0.9], [0.34, 0.12]],
    });
    A.t = A.target = 0.1;
    if (reduced()) { A.t = A.target = 0.3; A.draw(); }
    onDispose(() => A.destroy());
  }
  initStory();
}
