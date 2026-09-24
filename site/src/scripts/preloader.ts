// Intro. A lattice of points fills the paper; a front sweeps left→right and every point flows (on a curved
// path) into the name, flashing on the adoption colour as it arrives. The assembled name is handed to the hero
// field at exactly the same coordinates, then dissolves left→right into the network — after that it only
// reappears where the cursor moves.
// Timing borrows Ref A's preloader rhythm (0.25 s block offsets, 0.01 s per-item stagger, 16 ms glyph steps)
// scaled to a particle system. First visit per session: full (~3 s). Later visits to home: quick (×2.2).
// Skippable: click, any key, or the button.
import { gsap, reduced } from './core';
import { sampleWord, loadWordFonts } from './wordmask';
import type { DiffusionField } from './field';

const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
// quintic in-out with a whisper of overshoot at the end: points glide in and settle
const ease = (x: number) => { const e = x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2; return e + Math.sin(Math.PI * x) * Math.sin(Math.PI * x * 2) * -0.02; };

export function runPreloader(): Promise<void> {
  const el = document.querySelector<HTMLElement>('[data-preloader]');
  const root = document.documentElement;
  const home = root.dataset.page === 'home';
  let seen = false;
  try { seen = !!sessionStorage.getItem('corollary.intro'); } catch {}
  if (!el || reduced() || (seen && !home)) { el?.remove(); return Promise.resolve(); }
  try { sessionStorage.setItem('corollary.intro', '1'); } catch {}
  const speed = seen ? 2.2 : 1;

  return new Promise((resolve) => {
    const canvas = el.querySelector<HTMLCanvasElement>('[data-preloader-canvas]')!;
    const ctx = canvas.getContext('2d')!;
    const w = innerWidth, h = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = w * dpr; canvas.height = h * dpr;
    const C = { ink: css('--ink'), ink3: css('--ink-3'), rule: css('--rule'), signal: css('--signal') };
    let raf = 0, done = false, handed = false, t0 = 0;
    let P: { sx: number; sy: number; tx: number; ty: number; cx: number; cy: number; at: number }[] = [];
    let size = 2, g = 20, cols = 0, rows = 0, END = 2.7;

    const setup = () => {
      const { pts, step } = sampleWord(w, h);
      size = Math.max(1.6, step * 0.5);
      const n = pts.length / 2;
      g = Math.sqrt((w * h) / (n * 1.15));
      cols = Math.ceil(w / g); rows = Math.ceil(h / g);
      const starts: [number, number][] = [];
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) starts.push([(i + 0.5) * g, (j + 0.5) * g]);
      const tg: [number, number][] = []; for (let i = 0; i < n; i++) tg.push([pts[i * 2], pts[i * 2 + 1]]);
      starts.sort((a, b) => a[0] - b[0]); tg.sort((a, b) => a[0] - b[0]);
      const stride = starts.length / n;
      P = tg.map(([tx, ty], i) => {
        const [sx, sy] = starts[Math.min(starts.length - 1, Math.floor(i * stride + Math.random() * stride))];
        const mx = (sx + tx) / 2, my = (sy + ty) / 2, dx = tx - sx, dy = ty - sy, k = (Math.random() - 0.5) * 0.7;
        return { sx, sy, tx, ty, cx: mx - dy * k, cy: my + dx * k, at: 0.35 + (tx / w) * 0.95 + Math.random() * 0.16 };
      });
      END = 0.35 + 0.95 + 0.16 + 1.0 + 0.3;
    };

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const front = ((t - 0.35) / 0.95) * w; // the sweep, in px
      // old lattice: appears, then dissolves behind the front
      ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.lineCap = 'round';
      const la = Math.min(1, t / 0.35);
      ctx.beginPath();
      for (let j = 0; j <= rows; j++) { const y = j * g; for (let i = 0; i < cols; i++) { const x = i * g; const f = Math.min(1, Math.max(0, (x - front + 120) / 240)); if (f <= 0) continue; const hl = (g / 2) * f * la; ctx.moveTo(x + g / 2 - hl, y); ctx.lineTo(x + g / 2 + hl, y); } }
      for (let i = 0; i <= cols; i++) { const x = i * g; if (x < front - 120) continue; const f = Math.min(1, Math.max(0, (x - front + 120) / 240)); for (let j = 0; j < rows; j++) { const y = j * g, hl = (g / 2) * f * la; ctx.moveTo(x, y + g / 2 - hl); ctx.lineTo(x, y + g / 2 + hl); } }
      ctx.stroke();
      // particles
      const xs = new Float32Array(P.length), ys = new Float32Array(P.length), st = new Uint8Array(P.length);
      for (let i = 0; i < P.length; i++) {
        const p = P[i], u = Math.min(1, Math.max(0, (t - p.at) / 1.0)), e = ease(u);
        const a = 1 - e;
        xs[i] = a * a * p.sx + 2 * a * e * p.cx + e * e * p.tx;
        ys[i] = a * a * p.sy + 2 * a * e * p.cy + e * e * p.ty;
        st[i] = u <= 0 ? 0 : u < 0.72 ? 1 : u < 1 ? 2 : 3;
      }
      const pass = (s: number, color: string, alpha: number, sz: number) => {
        ctx.fillStyle = color; ctx.globalAlpha = alpha * la;
        const path = new Path2D(), r = sz / 2;
        for (let i = 0; i < P.length; i++) if (st[i] === s) { path.moveTo(xs[i] + r, ys[i]); path.arc(xs[i], ys[i], r, 0, 6.2832); }
        ctx.fill(path);
      };
      pass(0, C.ink3, 0.6, 1.6); pass(1, C.ink3, 0.9, size); pass(3, C.ink, 1, size); pass(2, C.signal, 1, size + 1);
      ctx.globalAlpha = 1;
    };

    const handoff = () => {
      if (handed) return; handed = true;
      const field = (window as any).__heroField as DiffusionField | undefined;
      removeEventListener('keydown', skip); el.removeEventListener('click', skip);
      if (field && home) {
        field.reveal = 1; field.sweep = -1;
        gsap.to(el, { opacity: 0, duration: 0.8, ease: 'sine.inOut', onComplete: finish });
        const box = { x: -260 };
        gsap.to(box, { x: w + 260, duration: 1.9 / Math.sqrt(speed), delay: 0.5, ease: 'power2.inOut', onUpdate: () => { field.sweep = box.x; }, onComplete: () => { field.reveal = 0; field.sweep = -1; } });
        gsap.delayedCall(0.25, resolveOnce);
      } else {
        // elsewhere: the name scatters and the paper lifts
        const t = { k: 0 };
        gsap.to(t, { k: 1, duration: 0.6, ease: 'power2.in', onUpdate: () => {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h); ctx.fillStyle = C.ink; ctx.globalAlpha = 1 - t.k;
          const path = new Path2D(), r = size / 2;
          for (const p of P) { const dx = p.tx - w / 2, dy = p.ty - h / 2, x = p.tx + dx * t.k * 0.6, y = p.ty + dy * t.k * 0.6; path.moveTo(x + r, y); path.arc(x, y, r, 0, 6.2832); }
          ctx.fill(path);
        } });
        gsap.to(el, { opacity: 0, duration: 0.45, delay: 0.3, onComplete: finish });
        gsap.delayedCall(0.35, resolveOnce);
      }
    };
    let resolved = false;
    const resolveOnce = () => { if (!resolved) { resolved = true; root.classList.add('intro-seen'); resolve(); } };
    const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); el.remove(); resolveOnce(); };
    const skip = () => { cancelAnimationFrame(raf); draw(99); handoff(); };

    const loop = (now: number) => {
      const t = ((now - t0) / 1000) * speed;
      draw(t);
      if (t >= END) { handoff(); return; }
      raf = requestAnimationFrame(loop);
    };
    addEventListener('keydown', skip, { once: true });
    el.addEventListener('click', skip);
    loadWordFonts().then(() => { setup(); t0 = performance.now(); raf = requestAnimationFrame(loop); });
    setTimeout(() => { if (!done && !P.length) { setup(); t0 = performance.now(); raf = requestAnimationFrame(loop); } }, 2500);
  });
}
