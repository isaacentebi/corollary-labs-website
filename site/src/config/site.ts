// Brand name and site-level placeholders. Every internal URL goes through u() so the build works under a base path.
export const site = {
  name: 'Corollary Labs',
  author: 'Corollary Labs',
  email: '[Email]',
  year: 2026,
  description: '[Meta description]',
} as const;

const raw = import.meta.env.BASE_URL;
const base = raw.endsWith('/') ? raw : raw + '/';
export const u = (path = '') => base + path.replace(/^\//, '');

export const nav = [
  { label: 'Essays', href: 'essays/', key: 'essays' },
  { label: 'About', href: 'about/', key: 'about' },
  { label: 'Team', href: 'team/', key: 'team' },
  { label: 'Contact', href: 'contact/', key: 'contact' },
] as const;
