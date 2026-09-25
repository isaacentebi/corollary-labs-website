import type { Prim } from './model';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Colors { ink: string; band: string; hl: string; hlA: number; paper: string }

export const INK = '#111213';
export const PENCIL = '#a9abad';
export const HL = '#ffe14a';
export const PAPER = '#f3f3ef';
export const FONT = '"Inter Tight Variable", "Inter Tight", system-ui, sans-serif';

export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });

/** Draw a system's primitives into rect. `s` scales stroke widths. */
export function drawPrims(ctx: CanvasRenderingContext2D, prims: Prim[], r: Rect, c: Colors, s: number, pass: 'hl' | 'ink') {
  const X = (t: number) => r.x + t * r.w;
  const Y = (y: number) => r.y + y * r.h;
  ctx.lineJoin = 'round';
  if (pass === 'hl') {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = c.hl;
    ctx.lineCap = 'butt';
    for (const p of prims) {
      if (p.k !== 'hl' || p.pts.length < 2) continue;
      ctx.globalAlpha = p.a * c.hlA;
      ctx.lineWidth = Math.max(3, p.w * s);
      ctx.beginPath();
      p.pts.forEach(([t, y], i) => (i ? ctx.lineTo(X(t), Y(y)) : ctx.moveTo(X(t), Y(y))));
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  ctx.fillStyle = c.ink;
  ctx.strokeStyle = c.ink;
  ctx.lineCap = 'butt';
  for (const p of prims) {
    switch (p.k) {
      case 'ribbon': {
        ctx.beginPath();
        p.pts.forEach(([t, y, w], i) => { const x = X(t), yy = Y(y) - (w * s) / 2; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); });
        for (let i = p.pts.length - 1; i >= 0; i--) { const [t, y, w] = p.pts[i]; ctx.lineTo(X(t), Y(y) + (w * s) / 2); }
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'path': {
        if (p.pts.length < 2) break;
        ctx.lineWidth = Math.max(0.6, p.w * s);
        ctx.lineCap = p.role ? 'round' : 'butt';
        ctx.beginPath();
        p.pts.forEach(([t, y], i) => (i ? ctx.lineTo(X(t), Y(y)) : ctx.moveTo(X(t), Y(y))));
        ctx.stroke();
        ctx.lineCap = 'butt';
        break;
      }
      case 'rect': {
        const x = X(p.t), y = Y(p.y), w = p.w * r.w, h = p.h * r.h;
        if (p.fill) {
          ctx.fillStyle = c.band; ctx.fillRect(x, y, w, h); ctx.fillStyle = c.ink;
          ctx.lineWidth = Math.max(0.5, 0.6 * s); ctx.strokeRect(x, y, w, h);
        } else {
          ctx.lineWidth = Math.max(0.5, 0.9 * s); ctx.strokeRect(x + 1, y, w - 2, h);
          if (p.n && w > 14 && h > 9) {
            ctx.font = `500 ${Math.round(Math.min(h * 0.62, 11))}px ${FONT}`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(String(p.n), x + w / 2, y + h / 2 + 0.5);
          }
        }
        break;
      }
      case 'dot': {
        const x = X(p.t), y = Y(p.y);
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.8, p.r * s), 0, 6.2832); ctx.fill();
        if (p.stem) { ctx.lineWidth = Math.max(0.5, 0.8 * s); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + p.stem * r.h); ctx.stroke(); }
        break;
      }
      case 'hairpin': {
        if (p.len <= 0) break;
        const x0 = X(p.t), x1 = X(p.t + p.len), y = Y(p.y), o = p.open * r.h;
        ctx.lineWidth = Math.max(0.6, 1 * s);
        ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = c.hl; ctx.globalAlpha = c.hlA; ctx.beginPath(); ctx.moveTo(x1, y - o); ctx.lineTo(x0, y); ctx.lineTo(x1, y + o); ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.beginPath(); ctx.moveTo(x1, y - o); ctx.lineTo(x0, y); ctx.lineTo(x1, y + o); ctx.stroke();
        break;
      }
      case 'niente': {
        ctx.lineWidth = Math.max(0.6, 1.1 * s);
        ctx.beginPath(); ctx.arc(X(p.t), Y(p.y), Math.max(1.5, 3.4 * s), 0, 6.2832); ctx.stroke();
        break;
      }
    }
  }
}
