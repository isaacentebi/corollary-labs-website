// The site's physical controls: the rotary selector (navigation) and the motion switch.

const root = document.documentElement;
export const motionOn = () => root.getAttribute('data-motion') !== 'off';

/* ---------- motion switch ---------- */
function syncSwitches() {
  const on = motionOn();
  document.querySelectorAll<HTMLButtonElement>('[data-motion-switch]').forEach((b) => {
    b.setAttribute('aria-checked', String(on));
    b.querySelector('.lamp')?.classList.toggle('is-on', on);
  });
}
document.querySelectorAll<HTMLButtonElement>('[data-motion-switch]').forEach((b) => {
  b.addEventListener('click', () => {
    const next = motionOn() ? 'off' : 'on';
    root.setAttribute('data-motion', next);
    try { localStorage.setItem('cyber.motion', next); } catch { /* storage may be unavailable */ }
    syncSwitches();
    window.dispatchEvent(new CustomEvent('motionchange', { detail: next }));
  });
});
syncSwitches();

/* ---------- rotary selector ---------- */
document.querySelectorAll<HTMLElement>('[data-selector]').forEach((sel) => {
  const dial = sel.querySelector<HTMLElement>('[data-dial]')!;
  const links = [...sel.querySelectorAll<HTMLAnchorElement>('a[data-ang]')];
  const home = Number(sel.dataset.currentAngle || 0);
  const set = (a: number) => sel.style.setProperty('--a', `${a}deg`);
  const angOf = (a: HTMLAnchorElement) => Number(a.dataset.ang);

  links.forEach((a) => {
    a.addEventListener('pointerenter', () => set(angOf(a)));
    a.addEventListener('focus', () => set(angOf(a)));
    a.addEventListener('pointerleave', () => set(home));
    a.addEventListener('blur', () => set(home));
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (a.getAttribute('aria-current') === 'page' && !a.hash) { e.preventDefault(); set(home); window.scrollTo({ top: 0, behavior: motionOn() ? 'smooth' : 'auto' }); return; }
      e.preventDefault();
      set(angOf(a));
      setTimeout(() => { location.href = a.href; }, motionOn() ? 220 : 0);
    });
  });

  // turn the knob: snaps to the nearest detent, navigates on release
  let dragging = false, target: HTMLAnchorElement | null = null;
  const nearest = (ev: PointerEvent) => {
    const r = dial.getBoundingClientRect();
    const ang = (Math.atan2(ev.clientX - (r.left + r.width / 2), -(ev.clientY - (r.top + r.height / 2))) * 180) / Math.PI;
    return links.reduce((b, l) => (Math.abs(angOf(l) - ang) < Math.abs(angOf(b) - ang) ? l : b), links[0]);
  };
  dial.addEventListener('pointerdown', (ev) => {
    dragging = true; target = null; sel.classList.add('is-dragging');
    dial.setPointerCapture(ev.pointerId);
  });
  dial.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    target = nearest(ev);
    set(angOf(target));
  });
  const end = () => {
    if (!dragging) return;
    dragging = false; sel.classList.remove('is-dragging');
    if (target && angOf(target) !== home) setTimeout(() => { location.href = target!.href; }, 160);
    else set(home);
  };
  dial.addEventListener('pointerup', end);
  // coming back through history: the knob points at this page again
  window.addEventListener('pageshow', () => set(home));
  dial.addEventListener('pointercancel', end);
});
