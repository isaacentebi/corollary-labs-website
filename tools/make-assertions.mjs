// Generates assertions from OUR spec (DESIGN.md tokens), per page × viewport.
// Keys: "<page>@<viewport> <selector>". Expected values are the spec tokens resolved at that viewport
// (root 17px @1920, 15px @768/375; essay base 18px @1920, 14px @768, 12px @375).
import fs from 'node:fs';

const INK = 'rgb(13, 13, 12)', PAPER = 'rgb(250, 250, 248)', INK2 = 'rgb(86, 86, 79)', PAPER2 = 'rgb(242, 242, 239)';
const SERIF = '"Instrument Serif", "Times New Roman", serif';
const SANS = '"Inter Tight Variable", "Helvetica Neue", Arial, sans-serif';
const MONO = '"Space Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const EASE_OUT = 'cubic-bezier(0.215, 0.61, 0.355, 1)';
const EASE_EXPO = 'cubic-bezier(0.23, 1, 0.32, 1)';
const px = (n) => `${+n.toFixed(4)}px`;

const A = [];
const add = (key, props) => { for (const [prop, expected] of Object.entries(props)) A.push({ selector: key, prop, expected: String(expected) }); };

// ── landing ─────────────────────────────────────────────
const VP = { desktop: { w: 1920, root: 17 }, tablet: { w: 768, root: 15 }, mobile: { w: 375, root: 15 } };
for (const [vp, { w, root }] of Object.entries(VP)) {
  const K = (s) => `home@${vp} ${s}`;
  const cols = w <= 699 ? 4 : w <= 1024 ? 8 : 12;
  const gutter = w <= 699 ? 10 : 20;
  const margin = (w <= 1024 ? 1.3333333333 : 2.6666666667) * root;
  const h1 = w <= 699 ? 2.4 * root : w <= 1024 ? 3.3333333333 * root : 4.6666666667 * root;
  const medium = w <= 699 ? 18 : w <= 1024 ? 1.6 * root : 1.7333333333 * root;
  const huge = w <= 699 ? 40 : 0.076388888889 * w;
  add(K('html'), { backgroundColor: PAPER, fontSize: px(root), color: INK });
  add(K('body'), { backgroundColor: PAPER });
  add(K('.c-footer__list a'), { fontFamily: SANS, fontSize: px(medium), textUnderlineOffset: px(medium * 0.1), textDecorationThickness: '1px' });
  add(K('.story__stage'), { position: 'sticky', top: '0px' });
  add(K('.field'), { cursor: 'crosshair' });
  add(K('.story__cue'), { fontFamily: MONO, color: INK2 });
  add(K('.story__line'), { fontFamily: MONO });
  add(K('.story__n'), { fontFamily: MONO, color: INK2 });
  add(K('.dg-label'), { fontFamily: MONO });
  add(K('.writing__title'), { fontFamily: SERIF, fontSize: px(h1) });
  add(K('.writing-row'), { borderBottomWidth: '1px', fontSize: px(medium), transitionDuration: '0.3s' });
  add(K('.c-footer'), { marginTop: px(10.6666666667 * root), fontSize: px(medium), paddingLeft: px(margin) });
  add(K('.c-footer__big'), { fontFamily: SERIF });
  add(K('.c-footer__copy'), { fontFamily: MONO, color: INK2 });
}

// ── essay ───────────────────────────────────────────────
const EVP = { desktop: { w: 1920, root: 17, fs: 18 }, tablet: { w: 768, root: 15, fs: 14 }, mobile: { w: 375, root: 15, fs: 12 } };
for (const [vp, { w, root, fs }] of Object.entries(EVP)) {
  const K = (s) => `essay@${vp} ${s}`;
  const med = fs * 1.43, h2 = fs * 2.42, large = fs * 3.14, xl = fs * 5.2;
  add(K('.essay-body > p'), { fontFamily: SANS, fontSize: px(med), lineHeight: px(med * 1.36), marginBottom: px(med * 1.28), color: INK, fontWeight: '400' });
  add(K('.essay-body h2'), { fontFamily: SANS, fontSize: px(h2), lineHeight: px(h2 * 1.15), fontWeight: '700', color: INK });
  add(K('.essay-head__title'), { fontFamily: SERIF, fontSize: px(xl), lineHeight: px(xl), fontWeight: '400' });
  add(K('.essay-head__kicker'), { fontFamily: MONO, color: INK2, fontSize: px(fs) });
  add(K('.h-marker'), { fontFamily: MONO, fontSize: px(fs), color: INK2 });
  add(K('.sidenote'), { fontSize: px(fs), lineHeight: px(fs * 1.28), backgroundColor: PAPER2, borderTopLeftRadius: px(0.375 * root) });
  add(K('.note-ref'), { fontFamily: MONO, cursor: 'crosshair', borderTopLeftRadius: px(0.125 * root) });
  add(K('.term'), { backgroundColor: INK, color: PAPER, cursor: 'crosshair', borderTopLeftRadius: px(0.125 * root), paddingLeft: px(0.25 * root) });
  add(K('.essay-body .pullquote'), { fontFamily: SERIF, fontSize: px(large), lineHeight: px(large * 1.1), borderTopWidth: '1px' });
  add(K('.fig__cap'), { fontSize: px(fs * 0.857), color: INK2 });
  add(K('.fig__plate'), { borderTopLeftRadius: px(0.375 * root), borderTopWidth: '1px' });
  add(K('.next-essay'), { transitionDuration: '0.1s, 0.3s' });
  add(K('.next-essay__title'), { fontFamily: SERIF, fontSize: px(large) });
  add(K('.rail-card'), { borderTopLeftRadius: px(0.375 * root), backgroundColor: PAPER });
  if (vp === 'desktop') {
    const pad = fs * 1.5, gap = fs * 2.25;
    const col = (w - pad * 2 - gap * 11) / 12;
    const textW = col * 6 + gap * 5;
    add(K('.essay-body'), { width: px(textW) });
    add(K('.essay-body .sidenote'), { position: 'absolute', width: px(textW / 2 - gap / 2), transitionDuration: '0.18s, 0.18s', transitionTimingFunction: `${EASE_EXPO}, ${EASE_EXPO}` });
    add(K('.essay-body .pullquote'), { width: px(textW * 1.5 + gap / 2) });
    add(K('.essay-rail'), { position: 'sticky' });
  } else {
    add(K('.essay-body .sidenote'), { position: 'relative' });
  }
}

// ── essays index ────────────────────────────────────────
for (const [vp, { w, root }] of Object.entries(VP)) {
  const K = (s) => `index@${vp} ${s}`;
  const medium = w <= 699 ? 18 : w <= 1024 ? 1.6 * root : 1.7333333333 * root;
  const huge = w <= 699 ? 40 : 0.076388888889 * w;
  add(K('.index-band__field'), { cursor: 'crosshair', position: 'absolute' });
  add(K('.index-band__count'), { fontFamily: MONO, color: INK2 });
  add(K('.index-row'), { fontSize: px(medium), borderBottomWidth: '1px', borderBottomColor: INK, transitionDuration: '0.3s, 0.1s' });
  add(K('.index-row__glyph'), { transitionDuration: '0.2s', transitionTimingFunction: EASE_EXPO });
  add(K('.index-row__date'), { fontFamily: MONO, color: INK2 });
  add(K('.index-row__dek'), { color: INK2 });
}

const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/assertions.json`, JSON.stringify(A, null, 1));
fs.writeFileSync(`${out}/assertions-landing.json`, JSON.stringify(A.filter((a) => a.selector.startsWith('home@') || a.selector.startsWith('index@')), null, 1));
fs.writeFileSync(`${out}/assertions-essay.json`, JSON.stringify(A.filter((a) => a.selector.startsWith('essay@')), null, 1));
console.log('assertions', A.length);
