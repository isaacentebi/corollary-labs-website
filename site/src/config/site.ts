// Single source of truth for the brand name, links and site-level copy (Organic direction).
// Every internal URL goes through `u()` so the site works under its base path (/organic/).
export const site = {
  name: 'Corollary Labs',
  email: '[EMAIL]',
  year: 2026,
  description: '[Meta description]',
} as const;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
/** Join a site-relative path onto the base path: u('essays/') → '/organic/essays/'. */
export const u = (p = '') => `${BASE}/${p.replace(/^\//, '')}`;

export const nav = [
  { label: 'Home', href: u('') },
  { label: 'Essays', href: u('essays/') },
  { label: 'About', href: u('about/') },
  { label: 'Team', href: u('team/') },
  { label: 'Contact', href: u('contact/') },
];

// Home figures. Titles are plain nouns or a placeholder; legends are placeholders until the copy is written.
// `keys` are the short labels on the drawing: one letter per concept for the whole story, written out on the
// drawing the first time it appears and shown by its letter after that.
export const figs: { title: string; legend: string; keys: [string, string][]; side?: 'right' }[] = [
  {
    title: 'The firm',
    legend: '[Legend — 1–2 sentences]',
    keys: [['a', 'inputs'], ['b', 'people'], ['c', 'coordination'], ['d', 'plan'], ['e', 'output A']],
  },
  {
    title: '[Figure title]',
    legend: '[Legend — 1–2 sentences]',
    keys: [['a', 'inputs'], ['f', 'agent'], ['d', 'plan']],
  },
  {
    title: 'Plan-making',
    legend: '[Legend — 1–2 sentences]',
    keys: [['f', 'agent'], ['g', 'objective'], ['h', 'alternatives'], ['i', 'selected plan']],
  },
  {
    title: 'Reorganisation',
    legend: '[Legend — 1–2 sentences]',
    keys: [['c', 'coordination'], ['f', 'agents'], ['b', 'people'], ['j', 'feedback loop'], ['k', 'output B'], ['l', 'output C']],
    side: 'right',
  },
  {
    title: 'Diffusion',
    legend: '[Legend — 1–2 sentences]',
    keys: [],
    side: 'right',
  },
];
