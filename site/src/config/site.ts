// Single source of truth for the brand name and site-level copy.
// Change the name here and it propagates to the wordmark, titles, meta, footer and essays.
const email = '[EMAIL]';
// while the address is a placeholder, "Contact us" goes to the contact block instead of a dead mailto
const contactHref = email.startsWith('[') ? '/#contact' : `mailto:${email}`;
export const site = {
  name: 'Corollary Labs',
  word: 'Corollary',
  tag: 'Labs',
  author: 'Corollary Labs',
  email,
  emailIsPlaceholder: email.startsWith('['),
  contactHref,
  year: 2026,
  url: 'https://corollarylabs.example',
  description: 'Corollary Labs deploys AI agents inside organisations and rebuilds the operations around them.',
  nav: [
    { label: 'Capabilities', href: '/#capabilities' },
    { label: 'Approach', href: '/#approach' },
    { label: 'Company', href: '/about/' },
    { label: 'Contact', href: '/#contact' },
  ],
  footerNav: [
    { label: 'Capabilities', href: '/#capabilities' },
    { label: 'Approach', href: '/#approach' },
    { label: 'Research', href: '/essays/' },
    { label: 'About', href: '/about/' },
    { label: 'Team', href: '/team/' },
    { label: 'Contact', href: '/#contact' },
  ],
} as const;
