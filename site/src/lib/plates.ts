// Each essay keeps one plate (a still study rendered to WebP by scripts/make-plates.mjs), chosen from
// its id, so it has the same image everywhere.
import { u } from './url';
const STUDIES = ['line', 'meniscus', 'voile', 'bands', 'cut'] as const;
export function plateFor(id: string) {
  let h = 2166136261;
  for (const c of id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return STUDIES[Math.abs(h) % STUDIES.length];
}
export const plateSrc = (name: string, portrait = false) => u(`/plates/${name}-${portrait ? '800x1000' : '1200x800'}.webp`);
// Dates and reading times stay placeholders until the essays are real.
export const DATE_PH = '[date]';
export const MIN_PH = '[n] min';
