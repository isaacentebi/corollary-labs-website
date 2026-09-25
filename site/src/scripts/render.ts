import type { Prim } from './model';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Colors { ink: string; band: string; hl: string; hlA: number }

export const INK = '#111213';
export const PENCIL = '#a6a8aa';
export const GREY = '#6c6f73';
export const HL = '#ffe14a';
export const PAPER = '#f3f3ef';
export const FONT = '"Inter Tight Variable", "Inter Tight", system-ui, sans-serif';

export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });

function polyline(ctx: CanvasRenderingContext2D, pts: [number, number][], X: (t: number) => number, Y: (y: number) => number) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) { const x = X(pts[i][0]), y = Y(pts[i][1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
}

/** Draw a system's primitives into rect. `s` scales stroke widths. */
export function drawPrims(ctx: CanvasRenderingContext2D, prims: Prim[], r: Rect, c: Colors, s: number, pass: 'hl' | 'ink') {
  const X = (t: number) => r.x + t * r.w;
  const Y = (y: number) => r.y + y * r.h;
  if (pass === 'hl') {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = c.hl; ctx.fillStyle = c.hl;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const p of prims) {
      if (p.k === 'hl' && p.pts.length > 1) {
        ctx.globalAlpha = p.a * c.hlA;
        ctx.lineWidth = Math.max(2.5, p.w * s);
        polyline(ctx, p.pts, X, Y); ctx.stroke();
      } else if (p.k === 'hairpin') {
        const x0 = X(p.t), x1 = X(p.t + p.len), y = Y(p.y), o = p.open * r.h;
        ctx.globalAlpha = c.hlA;
        ctx.beginPath(); ctx.moveTo(x1, y - o); ctx.lineTo(x0, y); ctx.lineTo(x1, y + o); ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
    return;
  }
  ctx.fillStyle = c.ink;
  ctx.strokeStyle = c.ink;
  for (const p of prims) {
    switch (p.k) {
      case 'ribbon': {
        const pts = p.pts; if (pts.length < 2) break;
        const sr = p.role === 'user' ? Math.max(s, 0.8) : s;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) { const [t, y, w] = pts[i]; const x = X(t), yy = Y(y) - Math.max(0.35, (w * sr) / 2); i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
        for (let i = pts.length - 1; i >= 0; i--) { const [t, y, w] = pts[i]; ctx.lineTo(X(t), Y(y) + Math.max(0.35, (w * sr) / 2)); }
        ctx.closePath(); ctx.fill();
        if (p.role === 'user') {
          // rounded pen ends
          const [ta, ya, wa] = pts[0], [tb, yb, wb] = pts[pts.length - 1];
          ctx.beginPath(); ctx.arc(X(ta), Y(ya), Math.max(0.4, (wa * sr) / 2), 0, 6.2832); ctx.fill();
          ctx.beginPath(); ctx.arc(X(tb), Y(yb), Math.max(0.4, (wb * sr) / 2), 0, 6.2832); ctx.fill();
        }
        break;
      }
      case 'path': {
        if (p.pts.length < 2) break;
        ctx.lineWidth = Math.max(0.5, p.w * s);
        const soft = p.role === 'agent' || p.role === 'string';
        ctx.lineCap = soft ? 'round' : 'butt';
        ctx.lineJoin = 'round';
        polyline(ctx, p.pts, X, Y); ctx.stroke();
        break;
      }
      case 'rect': {
        // glyph height follows the system's proportions but never stretches past a readable shape
        const gh = Math.min(r.h, r.w * 0.42);
        const cy = Y(p.y + p.h / 2);
        const h = Math.max(1, Math.round(p.h * gh));
        const x = Math.round(X(p.t)) + 0.5, y = Math.round(cy - h / 2) + 0.5;
        const w = Math.max(1, Math.round(p.w * r.w) - 1);
        if (p.hlFill) {
          ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = c.hlA; ctx.fillStyle = c.hl; ctx.fillRect(x, y, w, h); ctx.restore();
          ctx.lineWidth = Math.max(0.5, 0.8 * s); ctx.strokeRect(x, y, w, h);
        } else if (p.fill) {
          ctx.fillStyle = c.band; ctx.fillRect(x, y, w, h); ctx.fillStyle = c.ink;
          ctx.lineWidth = Math.max(0.5, 0.7 * s); ctx.strokeRect(x, y, w, h);
        } else {
          ctx.lineWidth = Math.max(0.6, (p.lw ?? 1) * Math.min(1, s * 1.1)); ctx.strokeRect(x + 1, y, w - 2, h);
          if (p.n && w > 13 && h > 9) {
            ctx.font = `560 ${Math.round(Math.min(h * 0.62, 11))}px ${FONT}`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(String(p.n), x + w / 2, y + h / 2 + 0.5);
          }
        }
        break;
      }
      case 'dot': {
        const x = X(p.t), y = Y(p.y);
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.7, p.r * s), 0, 6.2832); ctx.fill();
        if (p.stem) { ctx.lineWidth = Math.max(0.5, 0.75 * s); ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + p.stem * r.h); ctx.stroke(); }
        break;
      }
      case 'hairpin': {
        const x0 = X(p.t), x1 = X(p.t + p.len), y = Y(p.y), o = p.open * r.h;
        ctx.lineWidth = Math.max(0.6, 1 * s); ctx.lineCap = 'round'; ctx.lineJoin = 'miter';
        ctx.beginPath(); ctx.moveTo(x1, y - o); ctx.lineTo(x0, y); ctx.lineTo(x1, y + o); ctx.stroke();
        break;
      }
      case 'niente': {
        ctx.lineWidth = Math.max(0.6, 1.1 * s);
        ctx.beginPath(); ctx.arc(X(p.t), Y(p.y), Math.max(1.5, 3.2 * s), 0, 6.2832); ctx.stroke();
        break;
      }
    }
  }
}

/**
 * An orchestral bracket: a heavy bar with thin horns curling right at both ends.
 * x is the bar's right edge; a..b the span in px.
 */
export function bracket(ctx: CanvasRenderingContext2D, x: number, a: number, b: number, k = 1) {
  const w = 3 * k, pad = 4 * k, horn = 9 * k;
  ctx.fillRect(x - w, a - pad, w, b - a + pad * 2);
  ctx.beginPath();
  ctx.moveTo(x - w, a - pad);
  ctx.quadraticCurveTo(x - w, a - pad - horn * 0.55, x + horn * 0.9, a - pad - horn * 0.75);
  ctx.quadraticCurveTo(x + 1 * k, a - pad - horn * 0.3, x, a - pad);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - w, b + pad);
  ctx.quadraticCurveTo(x - w, b + pad + horn * 0.55, x + horn * 0.9, b + pad + horn * 0.75);
  ctx.quadraticCurveTo(x + 1 * k, b + pad + horn * 0.3, x, b + pad);
  ctx.closePath(); ctx.fill();
}
