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

export const ANGLES = [-104, -52, 0, 52, 104];
export const angleOf = (k: string) => {
  const key = k === 'essay' ? 'essays' : k;
  const i = pages.findIndex((p) => p.key === key);
  return i >= 0 ? ANGLES[i] : 0;
};
