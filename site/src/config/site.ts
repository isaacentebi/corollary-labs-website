// The five regions of the sheet, in their fixed left-to-right order.
// Navigation never removes a region: the active one is stretched open, the others are folded to strips.
const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const url = (p = '') => BASE + p.replace(/^\//, '');

export const site = {
  name: 'Corollary Labs',
  email: '[Email]',
  description: '[Meta description]',
};

export type RegionKey = 'home' | 'essays' | 'about' | 'team' | 'contact';
export const regions: { key: RegionKey; label: string; href: string }[] = [
  { key: 'home', label: 'Corollary Labs', href: url('') },
  { key: 'essays', label: 'Essays', href: url('essays/') },
  { key: 'about', label: 'About', href: url('about/') },
  { key: 'team', label: 'Team', href: url('team/') },
  { key: 'contact', label: 'Contact', href: url('contact/') },
];
export const indexOf = (k: RegionKey) => regions.findIndex((r) => r.key === k);
