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
  description: 'Corollary Labs deploys AI agents inside organisations and rebuilds the operations around them.',
  // main nav: the company. Research (the essays) is secondary: footer and the home Research section only.
  nav: [
    { label: 'Capabilities', href: url('/#capabilities') },
    { label: 'Approach', href: url('/#approach') },
    { label: 'Company', href: url('/about/') },
    { label: 'Contact', href: url('/#contact') },
  ],
  footer: [
    { label: 'Capabilities', href: url('/#capabilities') },
    { label: 'Approach', href: url('/#approach') },
    { label: 'Research', href: url('/essays/') },
    { label: 'About', href: url('/about/') },
    { label: 'Team', href: url('/team/') },
    { label: 'Contact', href: url('/#contact') },
  ],
} as const;

// the email stays plain text until a real address exists (never a live mailto:[EMAIL])
export const emailLive = !site.email.startsWith('[');
export const contactHref = emailLive ? `mailto:${site.email}` : url('/#contact');
