// Screenshots each version's home page from deploy/out into deploy/out/versions/<key>.jpg (for the overview page).
// Serves deploy/out on a local port, so it works before deploying.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'deploy/out');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let f = path.join(OUT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(4399);

const keys = ['', ...fs.readdirSync(OUT, { withFileTypes: true }).filter((d) => d.isDirectory() && !['_astro', 'versions'].includes(d.name) && fs.existsSync(path.join(OUT, d.name, 'index.html')) && fs.existsSync(path.join(OUT, d.name, '_astro'))).map((d) => d.name)];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { try { sessionStorage.setItem('corollary.intro', '1'); } catch {} });
for (const k of keys) {
  const p = await ctx.newPage();
  try {
    await p.goto(`http://localhost:4399/${k ? k + '/' : ''}`, { waitUntil: 'networkidle', timeout: 30000 });
    await p.waitForTimeout(3500);
    await p.evaluate(() => document.getElementById('cl-switch')?.remove());
    await p.screenshot({ path: path.join(OUT, 'versions', `${k || 'plotter'}.jpg`), type: 'jpeg', quality: 62 });
    console.log('thumb', k || 'plotter');
  } catch (e) { console.warn('thumb failed', k, e.message); }
  await p.close();
}
await b.close();
server.close();
