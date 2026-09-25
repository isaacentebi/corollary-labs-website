// The site's physical controls: the rotary selector (navigation, with detents),
// the Motion and Sound switches, the phone menu, and page-to-page continuity.
import { sound } from './sound';

const root = document.documentElement;
export const motionOn = () => root.getAttribute('data-motion') !== 'off';

/* ---------- switches ---------- */
const attr = { motion: 'data-motion', sound: 'data-sound' } as const;
type Sw = keyof typeof attr;
const isOn = (k: Sw) => root.getAttribute(attr[k]) === 'on';
function syncSwitches() {
  document.querySelectorAll<HTMLButtonElement>('[data-switch]').forEach((b) => {
    const on = isOn(b.dataset.switch as Sw);
    b.setAttribute('aria-checked', String(on));
  });
}
document.querySelectorAll<HTMLButtonElement>('[data-switch]').forEach((b) => {
  b.addEventListener('click', () => {
    const k = b.dataset.switch as Sw;
    const next = isOn(k) ? 'off' : 'on';
    root.setAttribute(attr[k], next);
    try { localStorage.setItem(`cyber.${k}`, next); } catch { /* storage unavailable */ }
    syncSwitches();
    if (k === 'sound' && next === 'on') sound.unlock();
    (next === 'on' ? sound.switchOn : sound.switchOff)();
    if (k === 'motion') window.dispatchEvent(new CustomEvent('motionchange', { detail: next }));
  });
});
syncSwitches();

/* ---------- rotary selector: a spring-loaded knob with detents ---------- */
const go = (href: string, delay: number) => { window.setTimeout(() => { location.href = href; }, motionOn() ? delay : 0); };

document.querySelectorAll<HTMLElement>('[data-selector]').forEach((sel) => {
  const dial = sel.querySelector<HTMLElement>('[data-dial]')!;
  const links = [...sel.querySelectorAll<HTMLAnchorElement>('a[data-ang]')];
  const home = Number(sel.dataset.currentAngle || 0);
  const angOf = (a: HTMLAnchorElement) => Number(a.dataset.ang);
  let a = home, v = 0, target = home, raf = 0, last = 0, detent = home;

  const inMenu = !!sel.closest('[data-menu]');
  const paint = () => {
    sel.style.setProperty('--a', `${a.toFixed(2)}deg`);
    // the small knob in the phone header turns with the one in the menu
    if (inMenu) document.querySelectorAll<HTMLElement>('[data-menu-toggle]').forEach((t) => t.style.setProperty('--a', `${a.toFixed(2)}deg`));
  };
  const run = (now: number) => {
    const dt = Math.min(0.034, (now - (last || now)) / 1000) || 0.016; last = now;
    v += (-420 * (a - target) - 24 * v) * dt; a += v * dt;
    paint();
    if (Math.abs(a - target) > 0.05 || Math.abs(v) > 0.5) raf = requestAnimationFrame(run);
    else { a = target; v = 0; paint(); raf = 0; last = 0; }
  };
  const set = (t: number) => {
    target = t;
    if (!motionOn()) { a = t; v = 0; paint(); return; }
    if (!raf) raf = requestAnimationFrame(run);
  };
  const toDetent = (d: number) => {
    if (d !== detent) { detent = d; sound.detent(); navigator.vibrate?.(4); }
    set(d);
  };

  links.forEach((l) => {
    l.addEventListener('pointerenter', () => toDetent(angOf(l)));
    l.addEventListener('focus', () => toDetent(angOf(l)));
    l.addEventListener('pointerleave', () => toDetent(home));
    l.addEventListener('blur', () => toDetent(home));
    l.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      if (angOf(l) === home && l.getAttribute('aria-current') === 'page') {
        toDetent(home); window.scrollTo({ top: 0, behavior: motionOn() ? 'smooth' : 'auto' });
        closeMenu(); return;
      }
      toDetent(angOf(l));
      go(l.href, 260);
    });
  });

  // turn the knob: it resists between detents and snaps into them; navigate on release
  let dragging = false, chosen: HTMLAnchorElement | null = null;
  const angleAt = (ev: PointerEvent) => {
    const r = dial.getBoundingClientRect();
    return (Math.atan2(ev.clientX - (r.left + r.width / 2), -(ev.clientY - (r.top + r.height / 2))) * 180) / Math.PI;
  };
  dial.addEventListener('pointerdown', (ev) => {
    dragging = true; chosen = null; sel.classList.add('is-dragging');
    dial.setPointerCapture(ev.pointerId); ev.preventDefault();
  });
  dial.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const raw = Math.max(-125, Math.min(125, angleAt(ev)));
    chosen = links.reduce((b, l) => (Math.abs(angOf(l) - raw) < Math.abs(angOf(b) - raw) ? l : b), links[0]);
    const d = angOf(chosen);
    if (d !== detent) { detent = d; sound.detent(); navigator.vibrate?.(4); }
    set(d + (raw - d) * 0.35);
  });
  const end = () => {
    if (!dragging) return;
    dragging = false; sel.classList.remove('is-dragging');
    if (chosen && angOf(chosen) !== home) { toDetent(angOf(chosen)); go(chosen.href, 200); }
    else toDetent(home);
  };
  dial.addEventListener('pointerup', end);
  dial.addEventListener('pointercancel', end);
  // coming back through history: the knob points at this page again
  window.addEventListener('pageshow', () => { detent = home; a = target = home; v = 0; paint(); });
});

/* ---------- phone menu ---------- */
const menu = document.querySelector<HTMLElement>('[data-menu]');
const toggles = [...document.querySelectorAll<HTMLButtonElement>('[data-menu-toggle]')];
function closeMenu() {
  if (!menu || menu.hidden) return;
  menu.classList.remove('is-open');
  toggles.forEach((t) => t.setAttribute('aria-expanded', 'false'));
  root.classList.remove('menu-open');
  window.setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, motionOn() ? 260 : 0);
}
function openMenu() {
  if (!menu) return;
  menu.hidden = false;
  requestAnimationFrame(() => menu.classList.add('is-open'));
  toggles.forEach((t) => t.setAttribute('aria-expanded', 'true'));
  root.classList.add('menu-open');
  sound.detent();
  (menu.querySelector<HTMLElement>('a[aria-current="page"]') ?? menu.querySelector<HTMLElement>('a'))?.focus({ preventScroll: true });
}
toggles.forEach((t) => t.addEventListener('click', () => (menu?.hidden ? openMenu() : closeMenu())));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
menu?.addEventListener('click', (e) => { if (e.target === menu) closeMenu(); });
window.addEventListener('pageshow', () => { if (menu) { menu.classList.remove('is-open'); menu.hidden = true; root.classList.remove('menu-open'); } });

/* ---------- page-to-page: the face persists (cross-document view transitions) ---------- */
window.addEventListener('pageswap', (e) => {
  const vt = (e as Event & { viewTransition?: { skipTransition(): void } }).viewTransition;
  if (vt && !motionOn()) vt.skipTransition();
});
window.addEventListener('pagereveal', (e) => {
  const vt = (e as Event & { viewTransition?: { skipTransition(): void } }).viewTransition;
  if (vt && !motionOn()) vt.skipTransition();
});
