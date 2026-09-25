// Brand name and site-level copy. Copy is temporary (IA-BRIEF); anything unknown stays a [bracketed] placeholder.
export const site = {
  name: 'Corollary Labs',
  author: 'Corollary Labs',
  email: '[EMAIL]',
  year: 2026,
  description: 'Corollary Labs deploys AI agents inside organisations and rebuilds the operations around them.',
} as const;

// Every internal link and asset goes through this, so the build works under a base path (/soft).
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const u = (p = '/') => `${BASE}/${p.replace(/^\//, '')}`;

// the email stays plain text until a real address exists; "Contact us" then goes to the contact block instead
export const hasEmail = !site.email.startsWith('[');
export const contactHref = hasEmail ? `mailto:${site.email}` : u('/#contact');

// main nav: the company. Research is reachable from the footer and the home page only.
export const nav = [
  { label: 'Capabilities', href: '/#capabilities', key: 'capabilities' },
  { label: 'Approach', href: '/#approach', key: 'approach' },
  { label: 'Company', href: 'about/', key: 'about' },
  { label: 'Contact', href: '/#contact', key: 'contact' },
] as const;

export const footerNav = [
  { label: 'Capabilities', href: '/#capabilities' },
  { label: 'Approach', href: '/#approach' },
  { label: 'Research', href: 'essays/' },
  { label: 'About', href: 'about/' },
  { label: 'Team', href: 'team/' },
  { label: 'Contact', href: 'contact/' },
] as const;
