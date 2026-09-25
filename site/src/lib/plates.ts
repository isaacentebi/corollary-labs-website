// Each essay keeps one still frame from the rooms, chosen from its id, so it has the same image everywhere.
const STILLS = ['plate-ignite', 'plate-cut', 'plate-diffuse', 'plate-dawn', 'plate-combine'] as const;
export function plateFor(id: string) {
  let h = 2166136261;
  for (const c of id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return STILLS[Math.abs(h) % STILLS.length];
}
// Dates and reading times stay placeholders until the essays are real.
export const DATE_PH = '[date]';
export const MIN_PH = '[n] min';
