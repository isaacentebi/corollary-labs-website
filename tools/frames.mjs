// Viewport screenshots at successive scroll positions (visual reference of scroll states).
import { chromium } from 'playwright';
import fs from 'node:fs';
const [, , url, outPrefix, w = '1440', h = '900', step = '1', waitMs = '900'] = process.argv;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +h } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => { });
await page.waitForTimeout(4500);
let i = 0, last = -1;
while (i < 40) {
  await page.screenshot({ path: `${outPrefix}${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 60 });
  const y = await page.evaluate(() => window.scrollY);
  if (y === last && i > 0) break;
  last = y;
  // wheel in small chunks so smooth-scroll libs follow
  for (let k = 0; k < 6; k++) { await page.mouse.wheel(0, (+h * +step) / 6); await page.waitForTimeout(60); }
  await page.waitForTimeout(+waitMs);
  i++;
}
console.log('frames', i);
await browser.close();
