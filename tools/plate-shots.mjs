import { chromium } from 'playwright';
const [, , url, out, w = '1440', h = '900'] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h } });
await ctx.addInitScript(() => { try { sessionStorage.setItem('corollary.intro', '1'); } catch {} });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
const { top, H } = await p.evaluate(() => { const s = document.querySelector('[data-plates]'); return { top: s.offsetTop, H: s.offsetHeight - innerHeight }; });
for (const q of [0.1, 0.24, 0.4, 0.55, 0.7, 0.9]) {
  await p.evaluate((y) => window.scrollTo(0, y), Math.round(top + H * q)); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}h${String(Math.round(q * 100)).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 60 });
}
console.log('errors', errs); await b.close();
