// Interaction sweep: perform hover/focus/click on representative interactive elements, capture
// before/after computed-style deltas + a visual-reference screenshot, write interaction-map.json.
import { chromium } from 'playwright';
import fs from 'node:fs';
const [, , url, name, slug, specPath] = process.argv;
const spec = JSON.parse(fs.readFileSync(specPath));
const WS = `../clone-workspace/${name}`;
fs.mkdirSync(`${WS}/01-recon/screenshots/interaction-states`, { recursive: true });
const browser = await chromium.launch();
const out = { route: slug, interactions: [], unreached: [] };
const frag = [];
for (const it of spec) {
  const [w, h] = it.viewport || [1440, 900];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 700 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => { });
  await page.waitForTimeout(3500);
  try {
    const loc = page.locator(it.trigger).first();
    await loc.scrollIntoViewIfNeeded({ timeout: 8000 });
    await page.waitForTimeout(600);
    const read = () => loc.evaluate((el, watch) => {
      const pick = (e) => { const cs = getComputedStyle(e); const o = {}; for (const p of ['color', 'backgroundColor', 'opacity', 'transform', 'textDecorationLine', 'textDecorationThickness', 'textUnderlineOffset', 'width', 'outlineStyle', 'outlineColor', 'outlineWidth', 'outlineOffset', 'borderTopColor', 'transitionDuration', 'transitionTimingFunction', 'cursor', 'boxShadow']) o[p] = cs[p]; return o; };
      const r = { self: pick(el) };
      for (const s of watch || []) { const t = el.querySelector(s) || document.querySelector(s); if (t) r[s] = { ...pick(t), text: t.innerText?.slice(0, 80), display: getComputedStyle(t).display }; }
      return r;
    }, it.watch);
    const before = await read();
    if (it.kind === 'hover') await loc.hover(); else if (it.kind === 'focus') { await page.keyboard.press('Tab'); await loc.focus(); } else await loc.click();
    await page.waitForTimeout(it.wait || 700);
    const after = await read();
    const shot = `01-recon/screenshots/interaction-states/${slug}--${it.slug}.jpg`;
    await page.screenshot({ path: `${WS}/${shot}`, type: 'jpeg', quality: 60 });
    const delta = {};
    for (const k of Object.keys(after)) for (const p of Object.keys(after[k] || {})) if (JSON.stringify(before[k]?.[p]) !== JSON.stringify(after[k][p])) (delta[k] ||= {})[p] = [before[k]?.[p], after[k][p]];
    frag.push({ slug: it.slug, trigger: it.trigger, kind: it.kind, delta, after });
    out.interactions.push({ action_slug: it.slug, trigger: it.trigger, kind: it.kind, reveals: it.reveals, screenshot: shot, captured: Object.keys(delta).length > 0 || !!it.visualOnly });
    console.log(it.slug, JSON.stringify(delta).slice(0, 400));
  } catch (e) { out.unreached.push({ trigger: it.trigger, reason: e.message.slice(0, 200) }); console.log('UNREACHED', it.slug, e.message.slice(0, 120)); }
  await ctx.close();
}
const mapPath = `${WS}/01-recon/interaction-map.json`;
const all = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath)) : [];
fs.writeFileSync(mapPath, JSON.stringify([...all.filter(r => r.route !== slug), out], null, 2));
fs.mkdirSync(`${WS}/02-extraction/fragments`, { recursive: true });
fs.writeFileSync(`${WS}/02-extraction/fragments/${slug}.interactions.json`, JSON.stringify(frag, null, 1));
await browser.close();
