// Single source of truth for the brand name and site-level strings.
export const site = {
  name: 'Corollary Labs',
  author: 'Corollary Labs',
  email: '[Email]',
  year: 2026,
  description: '[Meta description]',
} as const;

const B = import.meta.env.BASE_URL.replace(/\/?$/, '/');
/** Base-aware internal link: url('essays/') -> '/swiss/essays/' */
export const url = (p = '') => B + p.replace(/^\//, '');

export const nav = [
  { label: 'Essays', href: url('essays/') },
  { label: 'About', href: url('about/') },
  { label: 'Team', href: url('team/') },
  { label: 'Contact', href: url('contact/') },
];
