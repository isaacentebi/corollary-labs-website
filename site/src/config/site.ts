// Single source of truth for the brand name and site-level copy.
// Change the name here and it propagates to the wordmark, titles, meta, footer and essays.
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
    { label: 'Thesis', href: '/#thesis' },
    { label: 'About', href: '/#about' },
    { label: 'Essays', href: '/essays/' },
  ],
  cta: { label: 'Contact', href: '#contact' },
} as const;
