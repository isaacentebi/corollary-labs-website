export const site = {
  name: 'Corollary Labs',
  email: '[EMAIL]',
  year: 2026,
  description: '[Meta description]',
} as const;

// The five detents of the selector, in order around the dial.
export const pages = [
  { key: 'home', label: 'Home', path: '' },
  { key: 'essays', label: 'Essays', path: 'essays/' },
  { key: 'about', label: 'About', path: 'about/' },
  { key: 'team', label: 'Team', path: 'team/' },
  { key: 'contact', label: 'Contact', path: 'contact/' },
] as const;
export type PageKey = (typeof pages)[number]['key'];
