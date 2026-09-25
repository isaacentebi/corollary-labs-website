export const site = {
  name: 'Corollary Labs',
  email: '[Email]',
  year: 2026,
  description: '[Meta description]',
} as const;

/** Prefix an internal path with the base path (works under /martens or at root). */
export const url = (path = '') => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
};

export const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
