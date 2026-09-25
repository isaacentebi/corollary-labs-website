export const site = {
  name: 'Corollary Labs',
  author: 'Corollary Labs',
  email: '[Email]',
  year: 2026,
  description: '[Meta description]',
} as const;

/** Join a site-relative path onto the configured base (works under /score). */
export const u = (path = '') => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const p = path.replace(/^\//, '');
  return `${base}/${p}`;
};

export const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).replaceAll('/', '.');
