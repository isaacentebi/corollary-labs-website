// Motion capture: per-frame recorder injected before any page script runs.
// Records, for every element whose opacity / transform / clip-path / innerText changes, a compact timeline
// (t ms, values). Phases: load (first LOAD_MS), then scroll through the page in steps.
// Also captures a burst of screenshots during load for the visual record of the intro sequence.
import { chromium } from 'playwright';
import fs from 'node:fs';
const [, , url, out, LOAD_MS = '6000', shots = '' , w='1440', h='900'] = process.argv;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +h } });
await ctx.addInitScript(() => {
  window.__mo = { t0: performance.now(), rec: new Map(), phase: 'load' };
  const key = (el) => { if (!el.__k) { el.__k = (el.tagName.toLowerCase() + '.' + String(el.className?.baseVal ?? el.className).split(' ').slice(0, 2).join('.')).slice(0, 60) + '#' + Math.random().toString(36).slice(2, 6); } return el.__k; };
  const sample = () => {
    const t = Math.round(performance.now() - window.__mo.t0);
    const els = document.querySelectorAll('body *');
    for (let i = 0; i < els.length && i < 6000; i++) {
      const el = els[i];
      if (/^(SCRIPT|STYLE|PATH|G|DEFS)$/i.test(el.tagName)) continue;
      const cs = getComputedStyle(el);
      const txt = el.children.length === 0 ? (el.textContent || '').slice(0, 40) : '';
      const v = cs.opacity + '|' + cs.transform + '|' + cs.clipPath + '|' + txt + '|' + cs.visibility;
      const k = key(el); let r = window.__mo.rec.get(k);
      if (!r) { r = { k, phase: window.__mo.phase, last: v, ch: [] }; window.__mo.rec.set(k, r); r.ch.push([t, v, window.__mo.phase]); continue; }
      if (r.last !== v) { r.last = v; if (r.ch.length < 400) r.ch.push([t, v, window.__mo.phase]); }
    }
    requestAnimationFrame(sample);
  };
  const start = () => requestAnimationFrame(sample);
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
});
const page = await ctx.newPage();
const p = page.goto(url, { waitUntil: 'load', timeout: 90000 }).catch(() => { });
if (shots) { fs.mkdirSync(shots, { recursive: true }); for (let i = 0; i < 40; i++) { await page.waitForTimeout(120); await page.screenshot({ path: `${shots}/load-${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 50 }).catch(() => { }); } }
await p; await page.waitForTimeout(+LOAD_MS);
await page.evaluate(() => window.__mo.phase = 'scroll');
const H = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < H; y += 300) { await page.mouse.wheel(0, 300); await page.waitForTimeout(160); }
await page.waitForTimeout(2000);
const data = await page.evaluate(() => [...window.__mo.rec.values()].filter(r => r.ch.length > 1).map(r => ({ k: r.k, n: r.ch.length, ch: r.ch.slice(0, 60) })));
fs.writeFileSync(out, JSON.stringify(data));
console.log('animated elements', data.length);
await browser.close();
