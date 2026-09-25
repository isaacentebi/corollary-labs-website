// Deterministic plate for each essay (kind of still + palette), so an essay keeps its image everywhere.
const KINDS = ['horizon', 'volume', 'fold', 'crossing'] as const;
const PALETTES: Record<string, string> = { horizon: 'dusk', volume: 'blossom', fold: 'sunset', crossing: 'cross' };
export function plateFor(id: string) {
  let h = 2166136261;
  for (const c of id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const kind = KINDS[Math.abs(h) % KINDS.length];
  return { kind, palette: PALETTES[kind] };
}
export const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
