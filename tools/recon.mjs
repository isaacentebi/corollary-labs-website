// Recon: open a route at each viewport, hydrate, scroll through, capture full-page visual reference,
// framework fingerprint, breakpoints, same-origin links, and a text outline.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [, , url, name, slug = 'home'] = process.argv;
const WS = path.resolve('../clone-workspace', name);
const VIEWPORTS = { desktop: [1920, 1080], tablet: [768, 1024], mobile: [375, 667] };
fs.mkdirSync(`${WS}/01-recon/screenshots`, { recursive: true });

const browser = await chromium.launch();
const recon = fs.existsSync(`${WS}/01-recon/recon.json`) ? JSON.parse(fs.readFileSync(`${WS}/01-recon/recon.json`)) : { themes: [], breakpoints: [], framework: {} };

for (const [vp, [w, h]] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(e => console.log('goto', e.message));
  await page.waitForTimeout(4000);
  // scroll through to trigger lazy/scroll states
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += Math.round(h * 0.6)) { await page.mouse.wheel(0, Math.round(h * 0.6)); await page.waitForTimeout(250); }
  await page.waitForTimeout(1500);
  await page.mouse.wheel(0, -1e6); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${WS}/01-recon/screenshots/${slug}--${vp}.png`, fullPage: true }).catch(e => console.log('shot', e.message));
  await page.screenshot({ path: `${WS}/01-recon/screenshots/${slug}--${vp}--fold.png` });
  if (vp === 'desktop') {
    const info = await page.evaluate(() => {
      const fw = {
        next: !!window.__NEXT_DATA__ || !!self.__next_f, nuxt: !!window.__NUXT__, astro: !!document.querySelector('[data-astro-cid],astro-island'),
        vue: !!document.querySelector('[data-v-app]') || [...document.querySelectorAll('*')].some(e => [...e.attributes].some(a => a.name.startsWith('data-v-'))),
        react: !!document.querySelector('[data-reactroot]'), gsap: !!window.gsap, ScrollTrigger: !!window.ScrollTrigger, lenis: !!window.lenis || !!document.querySelector('.lenis, html.lenis'),
        locomotiveScroll: !!document.querySelector('[data-scroll-container],[data-scroll]'), barba: !!window.barba || !!document.querySelector('[data-barba]'), swup: !!window.swup,
        three: !!window.THREE, generator: document.querySelector('meta[name=generator]')?.content || null,
        htmlClass: document.documentElement.className, bodyClass: document.body.className,
        scripts: [...document.scripts].map(s => s.src).filter(Boolean),
        styles: [...document.styleSheets].map(s => s.href).filter(Boolean),
      };
      const bps = new Set();
      for (const s of document.styleSheets) { try { for (const r of s.cssRules) if (r.media) bps.add(r.media.mediaText); } catch { } }
      const links = [...new Set([...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => h.startsWith(location.origin)).map(h => new URL(h).pathname))];
      const outline = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,a,button,figure,blockquote,aside,section,header,footer,nav,main,article')].slice(0, 600).map(e => ({ tag: e.tagName, cls: String(e.className).slice(0, 80), text: e.innerText?.trim().slice(0, 120) }));
      return { fw, bps: [...bps], links, outline, title: document.title, height: document.documentElement.scrollHeight };
    });
    recon.framework[slug] = info.fw;
    recon.breakpoints = [...new Set([...recon.breakpoints, ...info.bps])];
    fs.writeFileSync(`${WS}/01-recon/${slug}.routes.json`, JSON.stringify(info.links, null, 1));
    fs.writeFileSync(`${WS}/01-recon/${slug}.outline.json`, JSON.stringify(info.outline, null, 1));
    console.log(vp, info.title, 'height', info.height, 'links', info.links.length);
    console.log(JSON.stringify(info.fw, null, 1).slice(0, 2500));
  }
  const dark = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
  recon.themes = [...new Set([...recon.themes, 'light'])];
  await ctx.close();
}
fs.writeFileSync(`${WS}/01-recon/recon.json`, JSON.stringify(recon, null, 2));
await browser.close();
