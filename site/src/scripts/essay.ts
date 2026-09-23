// Essay page: section markers, heading/pull-quote/figure reveals (Ref B motion), sidenote layout + reveal
// + hover dim (Ref B tertiary asides), rail TOC with per-section adoption bars, reading progress,
// and the velocity diffusion text engine.
import { gsap, ScrollTrigger, onDispose, reduced, lenis, onScroll, scrollState, DUR, STAGGER, G } from './core';
import { scrambleIn, scrambleText, revealLines, shuffle } from './text';
import { initDiffusionText } from './diffusionText';

export function initEssay(introDone: Promise<void>) {
  const body = document.querySelector<HTMLElement>('[data-essay-body]');
  if (!body) return;
  const RM = reduced();

  // ── section markers (mono § 0n + drawing rule) ───────────
  const h2s = [...body.querySelectorAll<HTMLElement>(':scope > h2')];
  h2s.forEach((h, i) => {
    if (h.previousElementSibling?.classList.contains('h-marker')) return;
    const m = document.createElement('div');
    m.className = 'h-marker'; m.setAttribute('aria-hidden', 'true');
    m.innerHTML = `<b class="h-marker__s">§</b><span>${String(i + 1).padStart(2, '0')}</span><i class="h-marker__rule"></i>`;
    h.before(m);
  });
  body.querySelectorAll<HTMLElement>('.pullquote').forEach((q, i) => {
    if (q.querySelector('.pullquote__mark')) return;
    const s = document.createElement('span'); s.className = 'pullquote__mark'; s.setAttribute('aria-hidden', 'true');
    s.textContent = `↳ ${String(i + 1).padStart(2, '0')}`; q.prepend(s);
  });

  if (!RM) {
    // headings: marker scramble + rule draw + heading chars
    h2s.forEach((h) => {
      const m = h.previousElementSibling as HTMLElement;
      gsap.set(h, { visibility: 'hidden' }); gsap.set(m, { visibility: 'hidden' });
      const st = ScrollTrigger.create({ trigger: m, start: 'top 88%', once: true, onEnter: () => {
        gsap.set([h, m], { visibility: 'visible' });
        scrambleText(m.querySelector('span')!);
        gsap.fromTo(m.querySelector('.h-marker__rule'), { scaleX: 0 }, { scaleX: 1, duration: DUR.d900, ease: G.out });
        scrambleIn(h, { stagger: 0.012, delay: 0.1 });
      } });
      onDispose(() => st.kill());
    });
    // pull quotes: masked line rise + mark
    body.querySelectorAll<HTMLElement>('.pullquote').forEach((q) => {
      const p = q.querySelector<HTMLElement>('p'); if (!p) return;
      gsap.set(q, { visibility: 'hidden' });
      const st = ScrollTrigger.create({ trigger: q, start: 'top 85%', once: true, onEnter: () => {
        gsap.set(q, { visibility: 'visible' });
        gsap.fromTo(q, { borderTopColor: 'rgba(13,13,12,0)' }, { borderTopColor: 'rgba(13,13,12,1)', duration: DUR.d600 });
        revealLines(p, { stagger: STAGGER.line });
        const mark = q.querySelector<HTMLElement>('.pullquote__mark'); if (mark) scrambleText(mark, { delay: 0.2 });
      } });
      onDispose(() => st.kill());
    });
    // figures: plate fade, strokes draw, cells/nodes in order; then scroll-linked "live" state
    body.querySelectorAll<HTMLElement>('[data-figure]').forEach((fig) => {
      const svg = fig.querySelector('svg')!; const kind = fig.dataset.kind;
      const strokes = [...svg.querySelectorAll<SVGPathElement>('path[pathLength]')];
      const timed = [...svg.querySelectorAll<SVGElement>('[data-t]')].sort((a, b) => +a.dataset.t! - +b.dataset.t!);
      gsap.set(fig, { opacity: 0 });
      const scrubbed = kind === 'dissolve' || kind === 'org';
      const st = ScrollTrigger.create({ trigger: fig, start: 'top 85%', once: true, onEnter: () => {
        gsap.to(fig, { opacity: 1, duration: DUR.d600, ease: G.out });
        gsap.fromTo(strokes.filter((s) => !s.classList.contains('fig-net')), { strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', stagger: 0.1 });
        if (!scrubbed) gsap.fromTo(timed, { opacity: 0 }, { opacity: 1, duration: DUR.d300, stagger: Math.min(0.02, 0.9 / Math.max(1, timed.length)) });
        const cap = fig.querySelector<HTMLElement>('.fig__cap'); if (cap) revealLines(cap, { delay: 0.3 });
      } });
      onDispose(() => st.kill());
      // live: scroll drives the figure (marker along curve / lattice dissolving / cells adopting)
      const live = [...svg.querySelectorAll<SVGGraphicsElement>('[data-live]')];
      const curve = svg.querySelector<SVGPathElement>('[data-curve]') || svg.querySelector<SVGPathElement>('.fig-line');
      const len = curve ? curve.getTotalLength() : 0;
      const nets = timed.filter((e) => e.classList.contains('fig-net'));
      nets.forEach((n) => { n.style.strokeDasharray = '1 1'; n.style.strokeDashoffset = '1'; });
      const sst = ScrollTrigger.create({ trigger: fig, start: 'top 90%', end: 'bottom 15%', scrub: 0.6, onUpdate: (s) => {
        const p = s.progress;
        live.forEach((m) => {
          if (!curve) return;
          const a = +(m.dataset.liveFrom || 0), b = +(m.dataset.liveTo || 1);
          const pt = curve.getPointAtLength(len * (a + (b - a) * p));
          m.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
        });
        if (scrubbed) {
          timed.forEach((e) => {
            const t = +e.dataset.t!, on = t < p * 1.08;
            if (e.classList.contains('fig-lattice')) e.style.opacity = on ? '0.08' : '1';
            else if (e.classList.contains('fig-net')) e.style.strokeDashoffset = on ? '0' : '1';
            else e.style.opacity = on ? '1' : kind === 'org' ? '0.12' : '0';
          });
        }
      } });
      onDispose(() => sst.kill());
    });
  } else {
    body.querySelectorAll('[data-live]').forEach((m) => {
      const svg = m.closest('svg')!; const curve = svg.querySelector<SVGPathElement>('[data-curve]') || svg.querySelector<SVGPathElement>('.fig-line');
      if (!curve) return; const b = +((m as HTMLElement).dataset.liveTo || 1);
      const pt = curve.getPointAtLength(curve.getTotalLength() * b); m.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
    });
  }

  // ── sidenotes ─────────────────────────────────────────────
  const notes = [...body.querySelectorAll<HTMLElement>('.sidenote')];
  const refs = [...body.querySelectorAll<HTMLAnchorElement>('.note-ref')];
  const wide = matchMedia('(min-width: 1000px)');
  const layout = () => {
    if (!wide.matches) { notes.forEach((n) => n.style.removeProperty('--note-top')); return; }
    const bTop = body.getBoundingClientRect().top + scrollY;
    const obstacles = [...body.querySelectorAll<HTMLElement>('.fig.-wide, .pullquote')].map((o) => { const r = o.getBoundingClientRect(); return [r.top + scrollY - bTop, r.bottom + scrollY - bTop]; });
    let prev = -1e9;
    notes.forEach((n) => {
      const ref = body.querySelector<HTMLElement>(`#ref-${n.dataset.note}`);
      let top = ref ? ref.getBoundingClientRect().top + scrollY - bTop - 6 : 0;
      top = Math.max(top, prev + 14);
      const h = n.offsetHeight;
      for (const [a, b] of obstacles) if (top < b + 14 && top + h > a - 14) top = b + 18;
      n.style.setProperty('--note-top', `${top}px`);
      prev = top + h;
    });
  };
  document.fonts.ready.then(() => { layout(); ScrollTrigger.refresh(); });
  layout();
  const ro = new ResizeObserver(() => layout()); ro.observe(body);
  onDispose(() => ro.disconnect());
  notes.forEach((n) => {
    const ref = body.querySelector<HTMLElement>(`#ref-${n.dataset.note}`) || n;
    if (RM) { n.classList.add('is-shown'); return; }
    const st = ScrollTrigger.create({ trigger: wide.matches ? ref : n, start: 'top 88%', once: true, onEnter: () => {
      n.classList.add('is-shown');
      if (!wide.matches) gsap.fromTo(n, { opacity: 0, y: 3 }, { opacity: 1, y: 0, duration: DUR.d180, ease: G.expo });
    } });
    onDispose(() => st.kill());
  });
  const hot = (n: string | null) => {
    body.classList.toggle('has-hot', !!n);
    notes.forEach((x) => x.classList.toggle('is-hot', x.dataset.note === n));
    refs.forEach((x) => x.classList.toggle('is-hot', x.dataset.note === n));
  };
  refs.forEach((r) => {
    r.addEventListener('mouseenter', () => hot(r.dataset.note!));
    r.addEventListener('mouseleave', () => hot(null));
    r.addEventListener('focus', () => hot(r.dataset.note!));
    r.addEventListener('blur', () => hot(null));
    r.addEventListener('click', (e) => {
      e.preventDefault();
      const n = body.querySelector<HTMLElement>(`#note-${r.dataset.note}`);
      hot(r.dataset.note!); setTimeout(() => hot(null), 1400);
      if (n && !wide.matches) lenis ? lenis.scrollTo(n, { offset: -120, duration: 1 }) : n.scrollIntoView({ block: 'center' });
    });
  });
  notes.forEach((n) => { n.addEventListener('mouseenter', () => hot(n.dataset.note!)); n.addEventListener('mouseleave', () => hot(null)); });

  // ── rail: TOC per-section bars + reading progress ─────────
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]')];
  const rp = document.querySelector<HTMLElement>('[data-read-progress]')?.parentElement;
  const toc = document.querySelector<HTMLElement>('[data-toc]');
  const tog = document.querySelector<HTMLButtonElement>('[data-toc-toggle]');
  if (toc && tog) {
    if (!wide.matches) { toc.classList.add('is-collapsed'); tog.setAttribute('aria-expanded', 'false'); }
    tog.addEventListener('click', () => { const c = toc.classList.toggle('is-collapsed'); tog.setAttribute('aria-expanded', String(!c)); shuffle(tog.querySelector('span')!); requestAnimationFrame(() => ScrollTrigger.refresh()); });
  }
  const upd = () => {
    const bTop = body.getBoundingClientRect().top + scrollY, bBot = bTop + body.offsetHeight;
    const y = scrollState.y + innerHeight * 0.4;
    rp?.style.setProperty('--rp', Math.min(1, Math.max(0, (y - bTop) / (bBot - bTop))).toFixed(4));
    let activeIdx = -1;
    h2s.forEach((h, i) => {
      const a = h.getBoundingClientRect().top + scrollY, b = h2s[i + 1] ? h2s[i + 1].getBoundingClientRect().top + scrollY : bBot;
      const p = Math.min(1, Math.max(0, (y - a) / (b - a)));
      links[i]?.style.setProperty('--sp', p.toFixed(4));
      if (y >= a && y < b) activeIdx = i;
    });
    links.forEach((l, i) => { const was = l.classList.contains('is-active'); l.classList.toggle('is-active', i === activeIdx); if (!was && i === activeIdx && !RM) shuffle(l.querySelector('.rail-toc__label')!, { steps: 4 }); });
  };
  upd();
  onDispose(onScroll(upd));
  if (RM) addEventListener('scroll', upd, { passive: true });

  // ── text diffusion engine (after intro so first paint is calm) ──
  introDone.then(() => document.fonts.ready).then(() => initDiffusionText(body));
}
