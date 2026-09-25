// Brand name and site-level placeholders. Every sentence on the site is a bracketed placeholder until the copy is written.
export const site = {
  name: 'Corollary Labs',
  author: 'Corollary Labs',
  email: '[Email]',
  year: 2026,
  description: '[Meta description]',
} as const;

// Every internal link and asset goes through this, so the build works under a base path (/soft).
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const u = (p = '/') => `${BASE}/${p.replace(/^\//, '')}`;

export const nav = [
  { label: 'Essays', href: 'essays/' },
  { label: 'About', href: 'about/' },
  { label: 'Team', href: 'team/' },
  { label: 'Contact', href: 'contact/' },
] as const;
