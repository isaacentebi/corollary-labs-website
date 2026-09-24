// Single source of truth for the brand name and site-level copy.
// Change the name here and it propagates to the wordmark, titles, meta, footer and essays.
// Every internal link and asset goes through url(): the site is served under a base path (/plotsoft).
export const url = (p = '/') => (import.meta.env.BASE_URL.replace(/\/$/, '') + (p.startsWith('/') ? p : '/' + p));

export const site = {
  name: 'Corollary Labs',
  word: 'Corollary',
  tag: 'Labs',
  author: 'Corollary Labs',
  email: '[EMAIL]',
  year: 2026,
  url: 'https://corollarylabs.example',
  description: '[Meta description]',
  nav: [
    { label: 'Essays', href: url('/essays/') },
    { label: 'About', href: url('/about/') },
    { label: 'Team', href: url('/team/') },
  ],
  cta: { label: 'Contact', href: '#contact' },
} as const;
