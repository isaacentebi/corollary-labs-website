// One field for the whole visit. The canvas persists across page swaps; each page re-scales,
// re-colours and reorganises the same surface (every tile turns to the page's pattern).
import { LoopField, type Mode } from './field';
import { story } from './story';

const small = () => innerWidth < 700;
const MODES: Record<string, () => Mode> = {
  home: () => ({ pattern: 'lattice', seed: 1, cell: small() ? 30 : 46, theme: 'violet', ambient: 1.2, width: 0.17, cam: [32.5, 32.5], pulse: 0.38 }),
  essays: () => ({ pattern: 'random', seed: 4, cell: small() ? 26 : 34, theme: 'deep', agents: 14, ambient: 0.8, width: 0.16 }),
  essay: () => ({ pattern: 'random', seed: 8, cell: small() ? 26 : 32, theme: 'paper', agents: 8, ambient: 0.3, interactive: false, width: 0.14, pulse: 0 }),
  about: () => ({ pattern: 'random', seed: 5, cell: small() ? 64 : 108, theme: 'violet', agents: 7, ambient: 0.5, width: 0.15 }),
  team: () => ({ pattern: 'random', seed: 12, cell: small() ? 40 : 58, theme: 'violet', agents: 7, ambient: 0.8, width: 0.17 }),
  contact: () => ({ pattern: 'diagonal', seed: 2, cell: small() ? 52 : 80, theme: 'deep', agents: 2, ambient: 0.4, width: 0.2 }),
  notfound: () => ({ pattern: 'random', seed: 404, cell: small() ? 30 : 44, theme: 'deep', agents: 0, ambient: 1 }),
};

let field: LoopField | null | undefined;
let cleanup: (() => void) | null = null;

function onLoad() {
  const root = document.documentElement;
  const canvas = document.getElementById('field') as HTMLCanvasElement | null;
  if (!canvas) return;
  const first = field === undefined;
  if (first) {
    field = LoopField.create(canvas);
    (window as any).__field = field;
    if (!field) root.classList.add('no-gl');
  }
  cleanup?.(); cleanup = null;
  if (!field) return;
  const page = root.dataset.page || 'home';
  const mode = (MODES[page] || MODES.home)();
  if (first) {
    // arrive: all tiles aligned, then the page's pattern turns in from the centre
    field.apply({ ...mode, pattern: 'diagonal', agents: 0 }, { instant: true });
    requestAnimationFrame(() => field!.apply(mode));
  } else field.apply(mode);
  if (page === 'home') cleanup = story(field);
  root.classList.add('field-on');
}

document.addEventListener('astro:page-load', onLoad);
