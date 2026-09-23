import { chromium } from 'playwright';
const [, , url, out, w = '1440', h = '900', list = '0,0.08,0.11,0.14,0.2,0.33,0.45,0.58,0.64,0.67,0.72,0.8,0.86,0.9,0.96'] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h } });
await ctx.addInitScript(() => { try { sessionStorage.setItem('corollary.intro', '1'); } catch {} });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
const { top, H } = await p.evaluate(() => { const s = document.querySelector('[data-story]'); return { top: s.offsetTop, H: s.offsetHeight - innerHeight }; });
for (const q of list.split(',').map(Number)) {
  await p.evaluate((y) => window.scrollTo(0, y), Math.round(top + H * q)); await p.waitForTimeout(1300);
  await p.screenshot({ path: `${out}s${String(Math.round(q * 100)).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 55 });
}
console.log('errors', errs); await b.close();
