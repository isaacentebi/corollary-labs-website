// Every internal link and asset goes through the base path (/light).
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const u = (path = '/') => `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
