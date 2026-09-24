// Shared page behaviour: reveal-on-enter, the table hover grammar, and the full-width footer name.
const els = document.querySelectorAll<HTMLElement>('.reveal');
if (els.length) {
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { (e.target as HTMLElement).classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -6% 0px' });
  els.forEach((el, i) => { el.style.transitionDelay = `${Math.min(i, 6) * 60}ms`; io.observe(el); });
}

// Tables read like the home table: hovering a cell lights its row and its column, and inverts the cell.
document.querySelectorAll<HTMLTableElement>('table.tb').forEach((tb) => {
  const clear = () => tb.querySelectorAll('.-x, .-xr, .-xc').forEach((c) => c.classList.remove('-x', '-xr', '-xc'));
  tb.addEventListener('pointerover', (ev) => {
    const td = (ev.target as HTMLElement).closest('td');
    if (!td || !tb.contains(td)) return;
    clear();
    const tr = td.parentElement as HTMLTableRowElement;
    const ci = (td as HTMLTableCellElement).cellIndex;
    Array.from(tr.cells).forEach((c) => c.classList.add('-xr'));
    Array.from(tb.tBodies).forEach((b) => Array.from(b.rows).forEach((r) => r.cells[ci]?.classList.add('-xc')));
    td.classList.add('-x');
  });
  tb.addEventListener('pointerleave', clear);
});

// The footer name spans the full width of the page.
const fit = () => document.querySelectorAll<HTMLElement>('[data-fit]').forEach((el) => {
  const span = el.firstElementChild as HTMLElement | null;
  if (!span) return;
  el.style.fontSize = '100px';
  const cs = getComputedStyle(el);
  const w = span.getBoundingClientRect().width, target = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (w > 0) el.style.fontSize = `${(100 * target) / w}px`;
});
fit();
document.fonts?.ready.then(fit);
addEventListener('resize', fit);
