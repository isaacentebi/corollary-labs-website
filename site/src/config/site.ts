// Single source of truth for names, links and the story placeholders of the Tableau (wild) direction.
const B = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const url = (p = '') => B + p.replace(/^\//, '');

export const site = {
  name: 'Corollary Labs',
  email: '[EMAIL]',
  year: 2026,
  description: '[Meta description]',
} as const;

export const nav = [
  { n: '01', label: 'Essays', href: url('essays/') },
  { n: '02', label: 'About', href: url('about/') },
  { n: '03', label: 'Team', href: url('team/') },
  { n: '04', label: 'Contact', href: url('contact/') },
];

// Home story captions: placeholders until the copy is written. State names are the index labels.
export const states: { title: string; lines: [string, string] }[] = [
  { title: 'The Table', lines: ['[State caption — line 1]', '[State caption — line 2]'] },
  { title: 'One Firm', lines: ['[State caption — line 1]', '[State caption — line 2]'] },
  { title: 'Execution', lines: ['[State caption — line 1]', '[State caption — line 2]'] },
  { title: 'Plans', lines: ['[State caption — line 1]', '[State caption — line 2]'] },
  { title: 'Reorganisation', lines: ['[State caption — line 1]', '[State caption — line 2]'] },
  { title: 'Diffusion', lines: ['[State caption — line 1]', '[State caption — line 2]'] },
  { title: 'Homotopy', lines: ['[State caption — line 1]', '[State caption — line 2]'] },
];
