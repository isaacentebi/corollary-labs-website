// Brand name and site-level placeholders. Every internal URL goes through u() so the build works under a base path.
export const site = {
  name: 'Corollary Labs',
  author: 'Corollary Labs',
  email: '[EMAIL]',
  year: 2026,
  description: 'Corollary Labs deploys AI agents inside organisations and rebuilds the operations around them.',
} as const;

const raw = import.meta.env.BASE_URL;
const base = raw.endsWith('/') ? raw : raw + '/';
export const u = (path = '') => base + path.replace(/^\//, '');

// the email is a placeholder until a real address exists: no live mailto until then
export const hasEmail = site.email.includes('@');
export const contactHref = hasEmail ? `mailto:${site.email}` : u('#contact');

export const nav = [
  { label: 'Capabilities', href: '#capabilities', key: 'capabilities' },
  { label: 'Approach', href: '#approach', key: 'approach' },
  { label: 'Company', href: 'about/', key: 'about' },
  { label: 'Contact', href: '#contact', key: 'contact' },
] as const;

export const footNav = [
  { label: 'Capabilities', href: '#capabilities' },
  { label: 'Approach', href: '#approach' },
  { label: 'Research', href: 'essays/' },
  { label: 'About', href: 'about/' },
  { label: 'Team', href: 'team/' },
  { label: 'Contact', href: '#contact' },
] as const;
