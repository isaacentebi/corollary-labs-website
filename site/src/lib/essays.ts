import { getCollection } from 'astro:content';

/** Essays, newest first. Each essay is a thread: its position across the cloth follows its date. */
export async function essayThreads() {
  const all = (await getCollection('essays', ({ data }) => !data.draft)).sort((a, b) => +a.data.date - +b.data.date);
  const t0 = +all[0].data.date, t1 = +all[all.length - 1].data.date;
  const span = Math.max(1, t1 - t0);
  return all
    .map((e, i) => ({ e, n: i + 1, af: 0.14 + 0.72 * ((+e.data.date - t0) / span), vc: 5 + ((i * 7) % 9) }))
    .reverse();
}
export const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).replaceAll('/', '.');
export const pad = (n: number) => String(n).padStart(2, '0');
