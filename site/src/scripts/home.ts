// Home: the hero field, the capabilities list (each node lights as the front passes it) and the Approach stage (story.ts).
import { initHero, initApproach } from './story';
import { ScrollTrigger, onDispose, reduced } from './core';

export function initHome(introDone: Promise<void>, _arrived = false) {
  initHero(introDone);
  initApproach();
  document.querySelectorAll<HTMLElement>('[data-cap]').forEach((row) => {
    if (reduced()) { row.classList.add('is-on'); return; }
    const st = ScrollTrigger.create({ trigger: row, start: 'top 78%', onEnter: () => row.classList.add('is-on'), onLeaveBack: () => row.classList.remove('is-on') });
    onDispose(() => st.kill());
  });
}
