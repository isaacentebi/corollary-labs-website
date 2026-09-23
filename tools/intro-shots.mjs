import { chromium } from 'playwright';
const [, , url, out, w = '1440', h = '900'] = process.argv;
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url);
for (const t of [300, 900, 1500, 2300, 3100, 4200]) { await p.waitForTimeout(t === 300 ? 300 : 600); await p.screenshot({ path: `${out}intro-${t}.jpg`, type: 'jpeg', quality: 65 }); }
await p.waitForTimeout(1500);
for (let i = 0; i <= 40; i++) { await p.mouse.move(+w * 0.15 + i * (+w * 0.7 / 40), +h * (0.5 + 0.08 * Math.sin(i / 4))); await p.waitForTimeout(25); }
await p.waitForTimeout(150);
await p.screenshot({ path: `${out}mouse.jpg`, type: 'jpeg', quality: 70 });
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}mouse-after.jpg`, type: 'jpeg', quality: 70 });
console.log('errors', errs);
await b.close();
