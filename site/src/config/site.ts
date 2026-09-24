export const site = {
  name: 'Corollary Labs',
  author: 'Corollary Labs',
  email: '[Email]',
  year: 2026,
  description: '[Meta description]',
} as const;

/** Internal link that respects the base path ('/free/' when built for the combined site). */
export const href = (p = '') => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;

export const nav = [
  { label: 'Essays', path: 'essays/' },
  { label: 'About', path: 'about/' },
  { label: 'Team', path: 'team/' },
  { label: 'Contact', path: 'contact/' },
] as const;
