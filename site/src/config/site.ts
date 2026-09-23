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
  description:
    'Corollary Labs works on how new technology actually spreads — through firms, institutions and ordinary days.',
  nav: [
    { label: 'Thesis', href: '/#thesis' },
    { label: 'About', href: '/#about' },
    { label: 'Essays', href: '/essays/' },
  ],
  cta: { label: 'Contact', href: '#contact' },
} as const;

export const summary = {
  body:
    'Corollary Labs works on the second half of every technology: not the moment it is invented, but the long, uneven process by which it becomes ordinary.',
  links: [
    { label: 'The thesis', href: '/#thesis', arrow: '↓' },
    { label: 'Essays', href: '/essays/', arrow: '→' },
  ],
};

export const beats = [
  {
    title: 'The lag',
    body:
      'Invention happens in one place, once. Adoption happens everywhere, slowly, one habit at a time. The distance between the two is where most of the future is decided.',
  },
  {
    title: 'The long middle',
    body:
      'For years a new technology looks like a curiosity, and then, abruptly, like infrastructure. The curve is flat until it is not. Most of the real work happens while it is still flat.',
  },
  {
    title: 'The dissolve',
    body:
      'Old structures rarely fall. They thin out. A form stops being filled in, a role stops being hired for, a meeting stops being needed, and something new grows into the space they leave.',
  },
  {
    title: 'Why now',
    body:
      'General-purpose AI is at the bottom of its curve. The capability exists; the spreading has barely begun. That is the part we care about, and it is still almost entirely ahead of us.',
  },
];

export const about = {
  statement:
    'We think the important question about a new technology is not what it can do, but how it gets into the world: which work it reaches first, what it replaces, what refuses to change, and how long all of that takes.',
  body:
    'We study adoption where it actually happens — inside organisations, at desks, in the gaps between tools — and we build for the places where the old way is already thinning. We publish what we learn. We keep the rest of the shape open on purpose.',
  beliefs: [
    'Value comes from replacement, not from novelty.',
    'Adoption happens task by task, inside organisations.',
    'The old way rarely ends on a date.',
    'Most of the change is still ahead.',
  ],
};
