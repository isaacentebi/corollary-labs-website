import { chromium } from 'playwright';
const [, , url, out, w = '1440', h = '900'] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h } });
await ctx.addInitScript(() => { try { sessionStorage.setItem('corollary.intro', '1'); } catch {} });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(3500);
const H = await p.evaluate(() => document.querySelector('[data-scene]').offsetHeight - innerHeight);
for (const q of [0, 0.2, 0.4, 0.62, 0.7, 0.8, 0.95, 1.15]) {
  await p.evaluate((y) => window.scrollTo(0, y), Math.round(H * q)); await p.waitForTimeout(1600);
  if (q === 0.95) { await p.mouse.click(+w * 0.4, +h * 0.5); await p.waitForTimeout(450); }
  await p.screenshot({ path: `${out}q${String(Math.round(q * 100)).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 60 });
}
console.log('errors', errs); await b.close();
