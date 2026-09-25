export const site = {
  name: 'Corollary Labs',
  email: '[EMAIL]',
  year: 2026,
  description: 'Corollary Labs deploys AI agents inside organisations and rebuilds the operations around them.',
} as const;

/** A real address once it exists; until then the email is plain text, never a live mailto. */
export const hasEmail = site.email.includes('@');

// The main nav, carried by the rotary selector. Home is the selector's zero position (unlabelled).
// On the home page every item is an anchor; elsewhere Capabilities and Approach go to the home
// anchors, Company goes to About (with Team) and Contact to the contact page.
export const nav = [
  { key: 'capabilities', label: 'Capabilities', anchor: 'capabilities', path: '#capabilities' },
  { key: 'approach', label: 'Approach', anchor: 'approach', path: '#approach' },
  { key: 'company', label: 'Company', anchor: 'company', path: 'about/' },
  { key: 'contact', label: 'Contact', anchor: 'contact', path: 'contact/' },
] as const;
export type NavKey = (typeof nav)[number]['key'];

// Footer: the full index, Research included.
export const footerNav = [
  { label: 'Capabilities', path: '#capabilities' },
  { label: 'Approach', path: '#approach' },
  { label: 'Research', path: 'essays/' },
  { label: 'About', path: 'about/' },
  { label: 'Team', path: 'team/' },
  { label: 'Contact', path: 'contact/' },
] as const;

// Detents around the dial: the zero (home) and one per nav item.
export const ZERO = -104;
export const ANGLES = [-52, 0, 52, 104];
/** Which nav item a page belongs to (the knob points there). */
export const sectionOf = (page: string): NavKey | null =>
  page === 'about' || page === 'team' ? 'company' : page === 'contact' ? 'contact' : null;
export const angleOf = (page: string) => {
  const k = sectionOf(page);
  const i = nav.findIndex((n) => n.key === k);
  return i >= 0 ? ANGLES[i] : ZERO;
};
