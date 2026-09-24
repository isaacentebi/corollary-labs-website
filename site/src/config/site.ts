// Single source of truth for the brand name and site-level copy (Proof direction).
export const site = {
  name: 'Corollary Labs',
  email: '[EMAIL]',
  year: 2026,
  description: 'Corollary Labs',
} as const;

/** Base-aware URL for internal links and assets: u('essays/') gives '/proof/essays/'. */
export const u = (p = '') => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${p.replace(/^\//, '')}`;
};

// Symbols not in the Latin subsets of Libertinus come from a Google Fonts subset of STIX Two Math (a few kB).
export const MATH_FONT =
  'https://fonts.googleapis.com/css2?family=STIX+Two+Math&display=swap&text=%E2%86%92%E2%8A%97%E2%88%98%E2%88%8E%E2%8A%A2%E2%89%83%E2%80%B2%E2%9F%B6%E2%86%A6%E2%88%88%C3%97%E2%8A%82%E2%88%82%E2%96%A1%E2%87%92%E2%89%A0%E2%88%85%E2%89%85%E2%86%91%E2%86%93%C2%B7';
