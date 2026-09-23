// Extraction (contract §3 A–I) via headless Playwright. Computed styles read off the live CSSOM = ground truth.
// Per-route fragments + merged shared files. Fonts/images are catalogued (metadata only) — NOT downloaded (project rule).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [, , url, name, slug = 'home'] = process.argv;
const WS = path.resolve('../clone-workspace', name, '02-extraction');
fs.mkdirSync(`${WS}/fragments`, { recursive: true });
const VIEWPORTS = { desktop: [1920, 1080], tablet: [768, 1024], mobile: [375, 667] };

const PROPS = `color backgroundColor backgroundImage backgroundSize backgroundPosition backgroundClip opacity mixBlendMode
fontFamily fontSize fontWeight fontStyle fontStretch lineHeight letterSpacing wordSpacing textTransform textDecorationLine textDecorationColor textDecorationThickness textUnderlineOffset textShadow textAlign whiteSpace fontVariationSettings fontFeatureSettings
paddingTop paddingRight paddingBottom paddingLeft marginTop marginRight marginBottom marginLeft
borderTopWidth borderTopStyle borderTopColor borderRightWidth borderBottomWidth borderBottomStyle borderBottomColor borderLeftWidth borderTopLeftRadius borderTopRightRadius borderBottomLeftRadius borderBottomRightRadius
boxSizing width height maxWidth minHeight aspectRatio outlineWidth outlineStyle outlineColor outlineOffset boxShadow filter backdropFilter clipPath
display flexDirection flexWrap justifyContent alignItems gridTemplateColumns gridColumn rowGap columnGap overflowX overflowY position top left zIndex transform transformOrigin willChange
transitionProperty transitionDuration transitionTimingFunction transitionDelay animationName animationDuration animationTimingFunction animationDelay cursor`.split(/\s+/);

const browser = await chromium.launch();

async function computedPass(page) {
  return page.evaluate((PROPS) => {
    const initial = {}; const probe = document.createElement('div'); document.body.appendChild(probe);
    const pcs = getComputedStyle(probe); for (const p of PROPS) initial[p] = pcs[p]; probe.remove();
    const sel = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; const c = String(el.className?.baseVal ?? el.className).trim().split(/\s+/).filter(Boolean).slice(0, 3); if (c.length) s += '.' + c.join('.'); return s; };
    const map = new Map();
    for (const el of document.querySelectorAll('body *')) {
      if (/^(SCRIPT|STYLE|META|LINK|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) continue;
      const r = el.getBoundingClientRect(); if (r.width === 0 && r.height === 0) continue;
      const cs = getComputedStyle(el); const o = {};
      for (const p of PROPS) if (cs[p] !== initial[p] || ['fontFamily', 'fontSize', 'lineHeight', 'color', 'fontWeight', 'letterSpacing'].includes(p)) o[p] = cs[p];
      const sigKeys = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'backgroundColor', 'textTransform', 'paddingTop', 'paddingLeft', 'borderTopWidth', 'borderBottomWidth', 'display', 'position', 'transitionDuration', 'borderTopLeftRadius'];
      const sig = sigKeys.map(k => cs[k]).join('|') + '|' + el.tagName;
      const directText = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').slice(0, 80);
      if (!map.has(sig)) map.set(sig, { selector: sel(el), count: 0, sampleText: directText || el.innerText?.trim().slice(0, 60), rect: { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) }, styles: o });
      map.get(sig).count++;
    }
    return [...map.values()];
  }, PROPS);
}

for (const [vp, [w, h]] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => { });
  await page.waitForTimeout(4000);
  // scroll whole page so reveal-on-scroll elements reach final state
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += h / 2) { await page.mouse.wheel(0, h / 2); await page.waitForTimeout(120); }
  await page.waitForTimeout(2500);
  const computed = await computedPass(page);
  fs.writeFileSync(`${WS}/fragments/${slug}--${vp}.computed.json`, JSON.stringify(computed, null, 1));
  console.log(vp, 'archetypes', computed.length);

  if (vp !== 'desktop') { await ctx.close(); continue; }

  // B. pseudo
  const pseudo = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) for (const ps of ['::before', '::after', '::marker', '::selection', '::placeholder']) {
      const cs = getComputedStyle(el, ps);
      if ((ps === '::before' || ps === '::after') && cs.content === 'none') continue;
      if (ps === '::marker' && getComputedStyle(el).display !== 'list-item') continue;
      if ((ps === '::selection' || ps === '::placeholder') && el !== document.body && !/INPUT|TEXTAREA/.test(el.tagName)) continue;
      out.push({ el: el.tagName.toLowerCase() + '.' + String(el.className?.baseVal ?? el.className).split(' ').slice(0, 2).join('.'), ps, content: cs.content, color: cs.color, bg: cs.backgroundColor, bgImage: cs.backgroundImage, w: cs.width, h: cs.height, transform: cs.transform, transition: cs.transition, position: cs.position });
    }
    const seen = new Set(); return out.filter(o => { const k = JSON.stringify({ ...o, el: '' }); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 400);
  });
  fs.writeFileSync(`${WS}/fragments/${slug}.pseudo.json`, JSON.stringify(pseudo, null, 1));

  // D/E/C/H. CSSOM: vars, full rule dump (cross-origin refetched), authored state rules, media, keyframes
  const sheetsMeta = await page.evaluate(() => [...document.styleSheets].map(s => { try { return { href: s.href, ok: true, n: s.cssRules.length }; } catch { return { href: s.href, ok: false }; } }));
  const dump = await page.evaluate(() => {
    const rules = [];
    const walk = (list, ctx) => { for (const r of list) { if (r.cssRules && !(r instanceof CSSStyleRule)) walk(r.cssRules, (r.conditionText || r.media?.mediaText || r.name || r.constructor.name)); rules.push({ ctx, type: r.constructor.name, text: r.cssText.slice(0, 3000) }); } };
    for (const s of document.styleSheets) { try { walk(s.cssRules, s.href || 'inline'); } catch { } }
    return rules;
  });
  for (const m of sheetsMeta.filter(s => !s.ok && s.href)) {
    try { const txt = await (await page.request.get(m.href)).text(); dump.push({ ctx: m.href, type: 'REFETCHED_SHEET', text: txt }); } catch (e) { dump.push({ ctx: m.href, type: 'REFETCH_FAILED', text: e.message }); }
  }
  fs.writeFileSync(`${WS}/fragments/${slug}.all-styles.json`, JSON.stringify(dump));
  const vars = await page.evaluate(() => {
    const out = {}; const cs = getComputedStyle(document.documentElement);
    for (const s of document.styleSheets) { try { for (const r of s.cssRules) { const rr = r.cssRules && r.media ? [...r.cssRules] : [r]; for (const x of rr) if (x.selectorText && /(:root|html|\[data-theme|\.dark|\.light|body)/.test(x.selectorText)) for (const p of x.style) if (p.startsWith('--')) { (out[x.selectorText + (r.media ? ' @' + r.media.mediaText : '')] ||= {})[p] = x.style.getPropertyValue(p).trim(); } } } catch { } }
    const resolved = {}; for (const p of cs) if (p.startsWith('--')) resolved[p] = cs.getPropertyValue(p).trim();
    return { scopes: out, resolvedRoot: resolved };
  });
  fs.writeFileSync(`${WS}/fragments/${slug}.css-variables.json`, JSON.stringify(vars, null, 1));
  const states = dump.filter(r => /:(hover|focus|focus-visible|active)/.test(r.text) && r.type !== 'REFETCHED_SHEET').map(r => r.text);
  const layout = {
    media: [...new Set(dump.filter(r => r.type === 'CSSMediaRule' || r.type === 'CSSContainerRule').map(r => r.text.split('{')[0].trim()))],
    keyframes: dump.filter(r => r.type === 'CSSKeyframesRule').map(r => r.text),
    transitions: [...new Set(dump.map(r => (r.text.match(/transition[^;]*;/g) || []).join(' ')).filter(Boolean))].slice(0, 300),
    easings: [...new Set(dump.flatMap(r => r.text.match(/cubic-bezier\([^)]*\)/g) || []))],
  };
  fs.writeFileSync(`${WS}/fragments/${slug}.states.json`, JSON.stringify(states, null, 1));
  fs.writeFileSync(`${WS}/fragments/${slug}.layout.json`, JSON.stringify(layout, null, 1));

  // F. fonts (metadata only — never downloaded)
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].filter(f => f.status === 'loaded').map(f => ({ family: f.family, weight: f.weight, style: f.style, stretch: f.stretch, variationSettings: f.variationSettings }));
    const ff = []; for (const s of document.styleSheets) { try { for (const r of s.cssRules) if (r instanceof CSSFontFaceRule) ff.push(r.cssText.slice(0, 400)); } catch { } }
    return { loaded: faces, fontFace: ff };
  });
  fs.writeFileSync(`${WS}/fragments/${slug}.fonts.json`, JSON.stringify(fonts, null, 1));

  // G. assets manifest (URLs + dims only — NOT downloaded)
  const assets = await page.evaluate(() => ({
    img: [...document.images].map(i => ({ src: i.currentSrc, w: i.naturalWidth, h: i.naturalHeight, alt: i.alt, rendered: [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)] })),
    video: [...document.querySelectorAll('video')].map(v => ({ src: v.currentSrc, poster: v.poster, w: v.videoWidth, h: v.videoHeight, loop: v.loop, muted: v.muted, autoplay: v.autoplay })),
    svgCount: document.querySelectorAll('svg').length,
    svgSamples: [...document.querySelectorAll('svg')].slice(0, 30).map(s => s.outerHTML.slice(0, 1500)),
    canvas: [...document.querySelectorAll('canvas')].map(c => ({ w: c.width, h: c.height, cls: c.className })),
  }));
  fs.writeFileSync(`${WS}/fragments/${slug}.assets.json`, JSON.stringify(assets, null, 1));

  // DOM
  const dom = await page.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('script,style,noscript,svg path').forEach(n => n.remove()); return c.outerHTML; });
  fs.writeFileSync(`${WS}/fragments/${slug}.dom.html`, dom);
  await ctx.close();
}
await browser.close();
