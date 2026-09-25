// Builds every version of the site into ONE static folder and adds a version switcher to every page.
//   /           Plotter (master, site/)
//   /<key>/     each direction branch (direction/<key>), built with Astro `base: '/<key>'`
// Usage: node tools/combine.mjs [--deploy] [--only=wild,organic]   (Plotter is always included)
//   --deploy  deploys deploy/out to the Vercel project linked in site/.vercel (corollarylabs.vercel.app)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'deploy/out');
const NODE_MODULES = path.join(ROOT, 'site/node_modules');
const VERSIONS = [
  { key: '', name: 'Plotter', group: 'Versions', note: 'The original: plotter drawing, paper and green' },
  { key: 'organic', name: 'Organic', group: 'Versions', note: 'A firm as a cell under a lens, refined and label-free' },
  { key: 'proof', name: 'Proof', group: 'Versions', note: 'A live mathematics paper with string diagrams' },
  { key: 'wild', name: 'Tableau', group: 'Versions', note: 'The economy as one input–output table on black' },
  { key: 'plotsoft', name: 'Plotter soft', group: 'Versions', note: 'Plotter softened: mist, jade, breathing forms' },
  { key: 'soft', name: 'Soft', group: 'Versions', note: 'Raked lines around stones; outlines that never split' },
  { key: 'free', name: 'Loops', group: 'Versions', note: 'Tiles that only rotate; colour travels along loops' },
  { key: 'out', name: 'Interference', group: 'Versions', note: 'Moiré traces deformation; navigation by folding' },
  { key: 'weave', name: 'Weave', group: 'Sketches', note: 'After Anni Albers and the Jacquard loom' },
  { key: 'metab', name: 'Metabolism', group: 'Sketches', note: 'After Kurokawa, Tange and plug-in megastructures' },
  { key: 'score', name: 'Score', group: 'Sketches', note: 'After graphic scores: Cardew, Xenakis, Brown' },
  { key: 'swiss', name: 'Swiss', group: 'Sketches', note: 'After Müller-Brockmann, Crouwel and Gerstner' },
  { key: 'martens', name: 'Overprint', group: 'Sketches', note: 'After Karel Martens\' monoprints' },
  { key: 'supre', name: 'Suprematist', group: 'Sketches', note: 'After Malevich, Lissitzky and early Hadid' },
  { key: 'cyber', name: 'Cybersyn', group: 'Sketches', note: 'After Cybersyn, Rams and Olivetti' },
];
const sh = (cmd, cwd = ROOT) => execSync(cmd, { cwd, stdio: 'inherit' });
const out = (cmd, cwd = ROOT) => execSync(cmd, { cwd, encoding: 'utf8' });

// where each branch is checked out (a lead's worktree), or a fresh temporary worktree
function worktreeFor(branch) {
  const list = out('git worktree list --porcelain').split('\n\n');
  for (const w of list) {
    const p = /^worktree (.+)$/m.exec(w)?.[1], b = /^branch refs\/heads\/(.+)$/m.exec(w)?.[1];
    if (b === branch && p) return p;
  }
  try { out(`git rev-parse --verify ${branch}`); } catch { return null; }
  const tmp = path.join(ROOT, 'deploy/wt', branch.replace('/', '-'));
  fs.rmSync(tmp, { recursive: true, force: true });
  sh(`git worktree add --force "${tmp}" ${branch}`);
  return tmp;
}

function buildInto(siteDir, dest) {
  const nm = path.join(siteDir, 'node_modules');
  if (!fs.existsSync(nm)) fs.symlinkSync(NODE_MODULES, nm);
  sh('npx astro build', siteDir);
  fs.cpSync(path.join(siteDir, 'dist'), dest, { recursive: true });
}

const switcherOnly = process.argv.includes('--switcher-only');
if (!switcherOnly) { fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true }); }
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const built = [];
for (const v of VERSIONS) {
  if (v.key && only && !only.includes(v.key)) continue;
  if (switcherOnly) { if (!v.key || fs.existsSync(path.join(OUT, v.key))) built.push(v); continue; }
  if (!v.key) { buildInto(path.join(ROOT, 'site'), OUT); built.push(v); continue; }
  const wt = worktreeFor(`direction/${v.key}`);
  if (!wt) { console.warn(`skip ${v.key}: no branch direction/${v.key} yet`); continue; }
  buildInto(path.join(wt, 'site'), path.join(OUT, v.key));
  // a version built without its base path would load Plotter's assets: catch it here
  const html = fs.readFileSync(path.join(OUT, v.key, 'index.html'), 'utf8');
  if (new RegExp(`(?:src|href)="/(?!/)(?!${v.key}/)`).test(html)) console.warn(`WARNING ${v.key}: root-absolute URLs in index.html (base path not applied?)`);
  built.push(v);
}

// the switcher: one compact button → a grouped menu (Versions / Sketches) + the overview page; [ and ] cycle versions.
// Links are prerendered on hover (speculation rules) and cross-fade (cross-document view transitions), so switching is instant.
const links = built.map((v) => ({ h: '/' + (v.key ? v.key + '/' : ''), n: v.name, k: v.key, g: v.group }));
fs.writeFileSync(path.join(OUT, 'switcher.js'), `(()=>{if(document.getElementById('cl-switch'))return;
const V=${JSON.stringify(links)};const seg=location.pathname.split('/')[1]||'';const hub=seg==='versions';
const cur=hub?'versions':(V.find(v=>v.k&&v.k===seg)?seg:'');const ci=V.findIndex(v=>v.k===cur);
const s=document.createElement('style');s.textContent=\`#cl-switch{position:fixed;right:12px;bottom:12px;z-index:2147483000;font:500 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;text-transform:uppercase;color:#0d0d0c}
#cl-switch .cl-t{display:flex;align-items:center;gap:8px;font:inherit;letter-spacing:inherit;text-transform:inherit;border:0;cursor:pointer;padding:10px 14px;border-radius:999px;background:#0d0d0c;color:#fafaf8;box-shadow:0 6px 24px rgba(13,13,12,.22)}
#cl-switch .cl-t b{font-weight:500;opacity:.55}
#cl-switch .cl-p{position:absolute;right:0;bottom:calc(100% + 8px);width:250px;max-height:min(70vh,560px);overflow:auto;padding:8px;border-radius:14px;background:rgba(250,250,248,.97);box-shadow:0 0 0 1px rgba(13,13,12,.14),0 16px 40px rgba(13,13,12,.18);backdrop-filter:blur(8px);opacity:0;transform:translateY(6px);pointer-events:none;transition:opacity .16s,transform .16s}
#cl-switch.open .cl-p{opacity:1;transform:none;pointer-events:auto}
#cl-switch .cl-g{padding:10px 8px 4px;color:#8e8e86;font-size:10px}
#cl-switch .cl-p a{display:flex;justify-content:space-between;padding:9px 8px;border-radius:8px;color:#0d0d0c;text-decoration:none}
#cl-switch .cl-p a:hover,#cl-switch .cl-p a:focus-visible{background:rgba(13,13,12,.07);outline:none}
#cl-switch .cl-p a[aria-current]{background:#0d0d0c;color:#fafaf8}
#cl-switch .cl-p a i{font-style:normal;opacity:.45}
#cl-switch .cl-f{display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding:8px;border-top:1px solid rgba(13,13,12,.1);color:#8e8e86;font-size:10px}
#cl-switch .cl-f a{padding:0;display:inline;color:#0d0d0c;text-decoration:underline;text-underline-offset:3px}
@media print{#cl-switch{display:none}}\`;document.head.appendChild(s);
const n=document.createElement('nav');n.id='cl-switch';n.setAttribute('aria-label','Site versions');
const t=document.createElement('button');t.className='cl-t';t.type='button';t.setAttribute('aria-expanded','false');
t.innerHTML='<b>Version</b>'+(hub?'Overview':(V[ci]||V[0]).n)+' \\u25B4';
const p=document.createElement('div');p.className='cl-p';let g='';
V.forEach((v,i)=>{if(v.g!==g){g=v.g;const h=document.createElement('div');h.className='cl-g';h.textContent=g;p.appendChild(h);}
const a=document.createElement('a');a.href=v.h;a.setAttribute('data-astro-reload','');a.innerHTML=v.n+'<i>'+(i+1)+'</i>';if(v.k===cur&&!hub)a.setAttribute('aria-current','page');p.appendChild(a);});
const f=document.createElement('div');f.className='cl-f';f.innerHTML='<a href="/versions/" data-astro-reload>Overview</a><span>[ ] to cycle · Esc</span>';p.appendChild(f);
const close=()=>{n.classList.remove('open');t.setAttribute('aria-expanded','false');};
t.addEventListener('click',(e)=>{e.stopPropagation();const o=n.classList.toggle('open');t.setAttribute('aria-expanded',String(o));});
document.addEventListener('click',(e)=>{if(!n.contains(e.target))close();});
document.addEventListener('keydown',(e)=>{if(e.key==='Escape')return close();const tg=e.target;if(tg&&(tg.isContentEditable||/INPUT|TEXTAREA|SELECT/.test(tg.tagName)))return;
if(e.key===']'||e.key==='['){const i=ci<0?0:ci;const j=(i+(e.key===']'?1:-1)+V.length)%V.length;location.href=V[j].h;}});
n.appendChild(p);n.appendChild(t);document.body.appendChild(n);
document.addEventListener('astro:after-swap',()=>{if(!document.getElementById('cl-switch')){document.head.appendChild(s);document.body.appendChild(n);}});})();
`);
// the overview page: every version as a card (thumbnails come from tools/thumbs.mjs)
const card = (v) => `<a class="c" href="/${v.key ? v.key + '/' : ''}"><span class="im"><img src="/versions/${v.key || 'plotter'}.jpg" alt="" loading="lazy" onerror="this.remove()"></span><span class="nm">${v.name}</span><span class="nt">${v.note}</span></a>`;
const groups = [...new Set(built.map((v) => v.group))];
fs.mkdirSync(path.join(OUT, 'versions'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'versions', 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Versions — Corollary Labs</title><meta name="robots" content="noindex">
<style>:root{color-scheme:light}body{margin:0;background:#f3f2ee;color:#0d0d0c;font:15px/1.4 ui-sans-serif,system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif}
main{max-width:1320px;margin:0 auto;padding:48px 20px 120px}h1{font-weight:500;font-size:clamp(28px,4vw,44px);letter-spacing:-.02em;margin:0 0 6px}
p.l{color:#6b6a64;margin:0 0 36px}h2{font:500 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#8e8e86;margin:40px 0 14px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.c{display:grid;gap:6px;color:inherit;text-decoration:none}.im{aspect-ratio:16/10;border-radius:10px;overflow:hidden;background:#e4e2dc;box-shadow:0 0 0 1px rgba(13,13,12,.08)}
.im img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s cubic-bezier(.2,.7,.2,1)}.c:hover img{transform:scale(1.03)}
.nm{font-weight:600;margin-top:4px}.nt{color:#6b6a64;font-size:13px}</style>
<script type="speculationrules">{"prefetch":[{"where":{"selector_matches":".c"},"eagerness":"moderate"}]}</script>
<style>@view-transition{navigation:auto}</style></head><body><main><h1>Corollary Labs — versions</h1><p class="l">${built.length} directions. Use the switcher (bottom right) or [ and ] to move between them.</p>
${groups.map((g) => `<h2>${g}</h2><div class="g">${built.filter((v) => v.group === g).map(card).join('')}</div>`).join('')}</main></body></html>`);
if (process.argv.includes('--switcher-only')) process.exit(0);
const HEAD = '<script type="speculationrules">{"prerender":[{"where":{"selector_matches":"#cl-switch a"},"eagerness":"moderate"}]}</script><style>@view-transition{navigation:auto}::view-transition-old(root),::view-transition-new(root){animation-duration:.28s}</style>';
let n = 0;
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.html')) { const h = fs.readFileSync(p, 'utf8'); if (!h.includes('/switcher.js')) { fs.writeFileSync(p, h.replace('</head>', HEAD + '</head>').replace('</body>', '<script src="/switcher.js" defer></script></body>')); n++; } } } };
walk(OUT);
const IMMUTABLE = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }];
fs.writeFileSync(path.join(OUT, 'vercel.json'), JSON.stringify({ framework: null, buildCommand: '', installCommand: '', outputDirectory: '.', cleanUrls: false, trailingSlash: true,
  headers: [{ source: '/_astro/(.*)', headers: IMMUTABLE }, { source: '/:v/_astro/(.*)', headers: IMMUTABLE }, { source: '/versions/(.*).jpg', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }] }] }, null, 2));
console.log(`built: ${built.map((v) => v.name).join(', ')} · switcher injected into ${n} pages → ${OUT}`);

if (process.argv.includes('--deploy')) {
  sh('node tools/thumbs.mjs');
  fs.cpSync(path.join(ROOT, 'site/.vercel'), path.join(OUT, '.vercel'), { recursive: true });
  sh('vercel deploy --prod --yes', OUT);
}
