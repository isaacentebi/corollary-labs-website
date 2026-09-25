// Single source of truth for the brand name and site-level strings.
export const site = {
  name: 'Corollary Labs',
  author: 'Corollary Labs',
  email: '[EMAIL]',
  year: 2026,
  description: 'Corollary Labs deploys AI agents inside organisations and rebuilds the operations around them.',
} as const;

const B = import.meta.env.BASE_URL.replace(/\/?$/, '/');
/** Base-aware internal link: url('essays/') -> '/swiss/essays/' */
export const url = (p = '') => B + p.replace(/^\//, '');

/** mailto only once a real address exists; until then the contact block */
export const contactHref = /^[^\s@[\]]+@[^\s@]+\.[^\s@]+$/.test(site.email) ? `mailto:${site.email}` : url('#contact');

export const nav = [
  { label: 'Capabilities', href: url('#capabilities') },
  { label: 'Approach', href: url('#approach') },
  { label: 'Company', href: url('about/') },
  { label: 'Contact', href: url('#contact') },
];

export const footerNav = [
  { label: 'Capabilities', href: url('#capabilities') },
  { label: 'Approach', href: url('#approach') },
  { label: 'Research', href: url('essays/') },
  { label: 'About', href: url('about/') },
  { label: 'Team', href: url('team/') },
  { label: 'Contact', href: url('contact/') },
];
