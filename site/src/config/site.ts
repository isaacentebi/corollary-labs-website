// Single source of truth for the brand name and site-level strings.
export const site = {
  name: 'Corollary Labs',
  author: 'Corollary Labs',
  email: '[EMAIL]',
  year: 2026,
  description: 'Corollary Labs deploys AI agents inside organisations and rebuilds the operations around them.',
} as const;

/** A mailto only once a real address exists; the [EMAIL] placeholder stays plain text. */
export const mailto = site.email.includes('@') ? `mailto:${site.email}` : null;

/** Prefix an internal path with the deploy base (works under /supre and at root). */
export const url = (path = '') => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const p = path.replace(/^\//, '');
  return `${base}/${p}`;
};

export const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).replaceAll('/', '.');
