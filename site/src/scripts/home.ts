// Home: the whole page above the essays is one story on one stage (see story.ts).
import { initStory } from './story';

export function initHome(introDone: Promise<void>, arrived = false) {
  initStory(introDone, arrived);
}
