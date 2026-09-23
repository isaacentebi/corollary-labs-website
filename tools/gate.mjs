// The gate (contract §5 + §6): build → serve → read computed styles → assert against OUR spec.
// PASS = 0 style-assertion failures AND `npm run build` exits 0. Writes 06-qa/cycle-N/{clone-styles,metrics}.json.
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const site = path.join(root, 'site');
const ws = path.join(root, 'clone-workspace/corollary');
const spec = path.join(ws, '03-design-spec');
const qa = path.join(ws, '06-qa');
fs.mkdirSync(qa, { recursive: true });
const cycle = (fs.readdirSync(qa).filter((d) => d.startsWith('cycle-')).map((d) => +d.slice(6)).sort((a, b) => b - a)[0] || 0) + 1;
const dir = path.join(qa, `cycle-${cycle}`);
fs.mkdirSync(dir, { recursive: true });

execSync(`node ${path.join(here, 'make-assertions.mjs')} ${spec}`, { stdio: 'inherit' });
let build_ok = true;
try { execSync('npx astro build', { cwd: site, stdio: 'pipe' }); } catch (e) { build_ok = false; console.error(String(e.stdout || e)); }
const port = 4399;
const srv = spawn('npx', ['astro', 'preview', '--port', String(port)], { cwd: site, stdio: 'ignore' });
const base = `http://localhost:${port}`;
for (let i = 0; i < 60; i++) { try { const r = await fetch(base); if (r.ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
let code = 1;
try {
  execSync(`node ${path.join(here, 'qa-read.mjs')} ${base} ${path.join(spec, 'assertions.json')} ${path.join(dir, 'clone-styles.json')}`, { stdio: 'inherit' });
  fs.writeFileSync(path.join(dir, 'metrics.json'), JSON.stringify({ cycle, build_ok }, null, 2));
  try {
    execSync(`node ${path.join(here, 'scripts/assert-styles.mjs')} --assertions ${path.join(spec, 'assertions.json')} --clone-styles ${path.join(dir, 'clone-styles.json')} --out ${path.join(dir, 'metrics.json')}`, { stdio: 'inherit' });
    code = build_ok ? 0 : 1;
  } catch { code = 1; }
} finally { srv.kill(); }
const m = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json')));
console.log(`cycle ${cycle}: build_ok=${m.build_ok} assertions ${m.style_assertions?.passed}/${m.style_assertions?.total} failed=${m.style_assertions?.failed}`);
if (m.style_assertions?.failed) console.log(JSON.stringify(m.style_assertions.failures.slice(0, 60), null, 1));
process.exit(code);
