export const site = {
  name: 'Corollary Labs',
  author: 'Corollary Labs',
  email: '[EMAIL]',
  year: 2026,
  description: 'Corollary Labs deploys AI agents inside organisations and rebuilds the operations around them.',
} as const;

/** The contact action: a live mailto only once a real address exists; until then, the Contact block. */
export const hasEmail = !/^\[.*\]$/.test(site.email);

/** Join a site-relative path onto the configured base (works under /score). */
export const u = (path = '') => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const p = path.replace(/^\//, '');
  return `${base}/${p}`;
};

export const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).replaceAll('/', '.');
