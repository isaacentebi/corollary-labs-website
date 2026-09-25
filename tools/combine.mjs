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
  { key: '', name: 'Plotter' },
  { key: 'organic', name: 'Organic' },
  { key: 'proof', name: 'Proof' },
  { key: 'wild', name: 'Tableau' },
  { key: 'plotsoft', name: 'Plotter soft' },
  { key: 'soft', name: 'Soft' },
  { key: 'free', name: 'Loops' },
  { key: 'out', name: 'Interference' },
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

// the switcher: a small fixed pill (desktop) or a compact menu (narrow screens); full page loads between versions
// (data-astro-reload keeps Astro's router out of it)
const links = built.map((v) => `{h:${JSON.stringify('/' + (v.key ? v.key + '/' : ''))},n:${JSON.stringify(v.name)},k:${JSON.stringify(v.key)}}`).join(',');
fs.writeFileSync(path.join(OUT, 'switcher.js'), `(()=>{if(document.getElementById('cl-switch'))return;
const V=[${links}];const seg=location.pathname.split('/')[1]||'';const cur=V.find(v=>v.k&&v.k===seg)?seg:'';const curName=(V.find(v=>v.k===cur)||V[0]).n;
const s=document.createElement('style');s.textContent=\`#cl-switch{position:fixed;right:12px;bottom:12px;z-index:2147483000;font:500 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;text-transform:uppercase}
#cl-switch .cl-list{display:flex;gap:2px;padding:3px;border-radius:999px;background:rgba(250,250,248,.94);box-shadow:0 0 0 1px rgba(13,13,12,.18),0 6px 24px rgba(13,13,12,.12);backdrop-filter:blur(6px)}
#cl-switch a{padding:7px 10px;border-radius:999px;color:#0d0d0c;text-decoration:none;white-space:nowrap}
#cl-switch a[aria-current]{background:#0d0d0c;color:#fafaf8}#cl-switch a:not([aria-current]):hover{background:rgba(13,13,12,.08)}
#cl-switch .cl-toggle{display:none;font:inherit;letter-spacing:inherit;text-transform:inherit;border:0;cursor:pointer;padding:9px 14px;border-radius:999px;background:#0d0d0c;color:#fafaf8;box-shadow:0 6px 24px rgba(13,13,12,.18)}
@media (max-width:760px){#cl-switch .cl-toggle{display:block}#cl-switch .cl-list{display:none;position:absolute;right:0;bottom:calc(100% + 8px);flex-direction:column;border-radius:14px;min-width:170px}
#cl-switch.open .cl-list{display:flex}#cl-switch .cl-list a{border-radius:10px;padding:11px 12px}}
@media print{#cl-switch{display:none}}\`;document.head.appendChild(s);
const n=document.createElement('nav');n.id='cl-switch';n.setAttribute('aria-label','Site versions');
const t=document.createElement('button');t.className='cl-toggle';t.type='button';t.setAttribute('aria-expanded','false');t.textContent='Version: '+curName+' ▴';
t.addEventListener('click',()=>{const o=n.classList.toggle('open');t.setAttribute('aria-expanded',String(o));});
document.addEventListener('keydown',(e)=>{if(e.key==='Escape'){n.classList.remove('open');t.setAttribute('aria-expanded','false');}});
const l=document.createElement('div');l.className='cl-list';
for(const v of V){const a=document.createElement('a');a.href=v.h;a.textContent=v.n;a.setAttribute('data-astro-reload','');if(v.k===cur)a.setAttribute('aria-current','page');l.appendChild(a);}
n.appendChild(l);n.appendChild(t);document.body.appendChild(n);
// Astro's client router swaps the body on in-version navigation: put the switcher back
document.addEventListener('astro:after-swap',()=>{if(!document.getElementById('cl-switch')){document.head.appendChild(s);document.body.appendChild(n);}});})();
`);
if (process.argv.includes('--switcher-only')) process.exit(0);
let n = 0;
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.html')) { const h = fs.readFileSync(p, 'utf8'); if (!h.includes('/switcher.js')) { fs.writeFileSync(p, h.replace('</body>', '<script src="/switcher.js" defer></script></body>')); n++; } } } };
walk(OUT);
fs.writeFileSync(path.join(OUT, 'vercel.json'), JSON.stringify({ framework: null, buildCommand: '', installCommand: '', outputDirectory: '.', cleanUrls: false, trailingSlash: true }, null, 2));
console.log(`built: ${built.map((v) => v.name).join(', ')} · switcher injected into ${n} pages → ${OUT}`);

if (process.argv.includes('--deploy')) {
  fs.cpSync(path.join(ROOT, 'site/.vercel'), path.join(OUT, '.vercel'), { recursive: true });
  sh('vercel deploy --prod --yes', OUT);
}
