// Visual review: viewport screenshots of our pages while scrolling (intro skipped unless --intro).
import { chromium } from 'playwright';
import fs from 'node:fs';
const [, , url, outPrefix, w = '1440', h = '900', stepFrac = '0.9', max = '30', intro = ''] = process.argv;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +h } });
if (!intro) await ctx.addInitScript(() => { try { sessionStorage.setItem('corollary.intro', '1'); } catch {} });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(intro ? 600 : 2500);
let i = 0, last = -1;
while (i < +max) {
  await page.screenshot({ path: `${outPrefix}${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 70 });
  const y = await page.evaluate(() => scrollY);
  if (y === last && i > 0) break;
  last = y;
  for (let k = 0; k < 6; k++) { await page.mouse.wheel(0, (+h * +stepFrac) / 6); await page.waitForTimeout(40); }
  await page.waitForTimeout(1300);
  i++;
}
console.log('frames', i, 'errors', JSON.stringify(errors.slice(0, 10)));
await browser.close();
