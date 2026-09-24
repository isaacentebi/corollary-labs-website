// Minimal reveal-on-enter for non-home pages. Content is visible without JS and with reduced motion.
const els = document.querySelectorAll<HTMLElement>('.reveal');
if (els.length) {
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { (e.target as HTMLElement).classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -6% 0px' });
  els.forEach((el, i) => { el.style.transitionDelay = `${Math.min(i, 6) * 60}ms`; io.observe(el); });
}
