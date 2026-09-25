export const site = {
  name: 'Corollary Labs',
  author: 'Corollary Labs',
  email: '[EMAIL]',
  year: 2026,
  description: 'Corollary Labs deploys AI agents inside organisations and rebuilds the operations around them.',
} as const;

/** Internal link that respects the base path ('/free/' when built for the combined site). */
export const href = (p = '') => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;

/** The email is a placeholder until a real address exists: no live mailto: until then. */
export const hasEmail = !site.email.startsWith('[');
export const contactHref = () => (hasEmail ? `mailto:${site.email}` : href('#contact'));

/** Main nav: sections of the home page, and the company page. Research is never here. */
export const nav = [
  { label: 'Capabilities', path: '#capabilities' },
  { label: 'Approach', path: '#approach' },
  { label: 'Company', path: 'about/', current: ['about/', 'team/'] },
  { label: 'Contact', path: '#contact' },
] as const;

export const footerNav = [
  { label: 'Capabilities', path: '#capabilities' },
  { label: 'Approach', path: '#approach' },
  { label: 'Research', path: 'essays/' },
  { label: 'About', path: 'about/' },
  { label: 'Team', path: 'team/' },
  { label: 'Contact', path: 'contact/' },
] as const;
