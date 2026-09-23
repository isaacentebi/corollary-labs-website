// QA read: open OUR running site headless, let the motion layer settle (reveals complete), and read the
// computed style of every asserted selector off the live CSSOM. Writes clone-styles.json.
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , base, assertionsPath, out] = process.argv;
const A = JSON.parse(fs.readFileSync(assertionsPath));
const ROUTES = { home: '/', essay: '/essays/invention-is-not-arrival/', index: '/essays/' };
const VPS = { desktop: [1920, 1080], tablet: [768, 1024], mobile: [375, 667] };
const groups = {};
for (const a of A) { const [pv, ...rest] = a.selector.split(' '); const sel = rest.join(' '); (groups[pv] ||= {})[sel] ||= new Set(); groups[pv][sel].add(a.prop); }

const browser = await chromium.launch();
const result = {};
for (const [pv, sels] of Object.entries(groups)) {
  const [page, vp] = pv.split('@');
  const [w, h] = VPS[vp];
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('corollary.intro', '1'); } catch {} });
  const p = await ctx.newPage();
  await p.goto(base + ROUTES[page], { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.documentElement.classList.contains('motion-ready'), null, { timeout: 15000 }).catch(() => {});
  // scroll through so every reveal fires, then return to top
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += h * 0.7) { await p.mouse.wheel(0, h * 0.7); await p.waitForTimeout(120); }
  await p.waitForTimeout(1500);
  const read = await p.evaluate((sels) => {
    const o = {};
    for (const [sel, props] of Object.entries(sels)) {
      const el = document.querySelector(sel);
      if (!el) { o[sel] = null; continue; }
      const cs = getComputedStyle(el); o[sel] = {};
      for (const pr of props) o[sel][pr] = cs[pr];
    }
    return o;
  }, Object.fromEntries(Object.entries(sels).map(([k, v]) => [k, [...v]])));
  for (const [sel, v] of Object.entries(read)) result[`${pv} ${sel}`] = v || {};
  await ctx.close();
}
fs.writeFileSync(out, JSON.stringify(result, null, 1));
await browser.close();
console.log('read', Object.keys(result).length, 'selectors');
