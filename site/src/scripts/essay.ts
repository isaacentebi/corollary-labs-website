// Essay page: sidenotes placed beside their reference (desktop), note/ref hover pairing, and contents progress.
export function initEssay() {
  const body = document.querySelector<HTMLElement>('[data-essay-body]');
  if (!body) return;
  const notes = [...body.querySelectorAll<HTMLElement>('.sidenote')];
  const refs = [...body.querySelectorAll<HTMLAnchorElement>('.note-ref')];
  const wide = matchMedia('(min-width: 1100px)');

  const layout = () => {
    if (!wide.matches) { notes.forEach((n) => n.style.removeProperty('--note-top')); return; }
    const bTop = body.getBoundingClientRect().top + scrollY;
    let prev = -1e9;
    notes.forEach((n) => {
      const ref = body.querySelector<HTMLElement>(`#ref-${n.dataset.note}`);
      let top = ref ? ref.getBoundingClientRect().top + scrollY - bTop - 4 : 0;
      top = Math.max(top, prev + 16);
      n.style.setProperty('--note-top', `${top}px`);
      prev = top + n.offsetHeight;
    });
  };
  document.fonts?.ready.then(layout); layout();
  new ResizeObserver(layout).observe(body);

  const hot = (n: string | null) => {
    body.classList.toggle('has-hot', !!n);
    notes.forEach((x) => x.classList.toggle('is-hot', x.dataset.note === n));
    refs.forEach((x) => x.classList.toggle('is-hot', x.dataset.note === n));
  };
  refs.forEach((r) => {
    r.addEventListener('mouseenter', () => hot(r.dataset.note!)); r.addEventListener('mouseleave', () => hot(null));
    r.addEventListener('focus', () => hot(r.dataset.note!)); r.addEventListener('blur', () => hot(null));
    r.addEventListener('click', (e) => { e.preventDefault(); const n = body.querySelector<HTMLElement>(`#note-${r.dataset.note}`); if (n && !wide.matches) n.scrollIntoView({ block: 'center', behavior: 'smooth' }); hot(r.dataset.note!); setTimeout(() => hot(null), 1400); });
  });
  notes.forEach((n) => { n.addEventListener('mouseenter', () => hot(n.dataset.note!)); n.addEventListener('mouseleave', () => hot(null)); });

  // contents: each section's dot fills as you read it
  const h2s = [...body.querySelectorAll<HTMLElement>(':scope > h2')];
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-toc]')];
  const upd = () => {
    const y = scrollY + innerHeight * 0.4; const end = body.getBoundingClientRect().bottom + scrollY;
    h2s.forEach((h, i) => {
      const a = h.getBoundingClientRect().top + scrollY, b = h2s[i + 1] ? h2s[i + 1].getBoundingClientRect().top + scrollY : end;
      const p = Math.min(1, Math.max(0, (y - a) / (b - a)));
      links[i]?.style.setProperty('--p', p.toFixed(3));
      links[i]?.classList.toggle('is-on', y >= a && y < b);
    });
  };
  upd(); addEventListener('scroll', upd, { passive: true });
}
