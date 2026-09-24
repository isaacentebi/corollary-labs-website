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

// Home figures: three continuous states of one drawing. Titles are plain nouns; legends are placeholders.
// The drawing carries no text: roles are read from shape, connection and motion.
export const figs: { title: string; legend: string; s: [number, number] }[] = [
  { title: 'The firm', legend: '[Legend — 1–2 sentences]', s: [0, 1] },
  { title: 'Reorganisation', legend: '[Legend — 1–2 sentences]', s: [1, 4] },
  { title: 'Diffusion', legend: '[Legend — 1–2 sentences]', s: [4, 5.2] },
];
