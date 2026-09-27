/**
 * Marks `.moc-sweep` surfaces with `data-seen` the first time they enter the viewport,
 * which starts their accent sweep (design/motion.css). New surfaces are picked up as
 * they mount. Reduced motion needs no special case: `:root.rm` collapses the animation.
 */
export function initSweep(): void {
  if (typeof IntersectionObserver === 'undefined') {
    document.documentElement.classList.add('moc-sweep-all');
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.setAttribute('data-seen', '');
      io.unobserve(e.target);
    }
  });
  const watched = new WeakSet<Element>();
  let queued = false;
  const scan = () => {
    queued = false;
    for (const el of document.querySelectorAll('.moc-sweep:not([data-seen])')) {
      if (watched.has(el)) continue;
      watched.add(el);
      io.observe(el);
    }
  };
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(scan);
  }).observe(document.body, { childList: true, subtree: true });
  scan();
}
