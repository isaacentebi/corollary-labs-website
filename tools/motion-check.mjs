import { chromium } from 'playwright';
const [, , url, out, from, to, n = '12', w = '1440', h = '900'] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h } });
await ctx.addInitScript(() => { try { sessionStorage.setItem('corollary.intro', '1'); } catch {} });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
const { top, H } = await p.evaluate(() => { const s = document.querySelector('[data-story]'); return { top: s.offsetTop, H: s.offsetHeight - innerHeight }; });
await p.evaluate((y) => window.scrollTo(0, y), Math.round(top + H * +from)); await p.waitForTimeout(1200);
const step = (H * (+to - +from)) / +n;
for (let i = 0; i <= +n; i++) {
  await p.screenshot({ path: `${out}${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 50 });
  await p.mouse.wheel(0, step); await p.waitForTimeout(260);
}
console.log('errors', errs); await b.close();
