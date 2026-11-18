/* smooth.js: one clock and smooth page scrolling.
   GSAP's ticker is the single clock; Lenis rides it for smooth, fast window scrolling.
   Inner scrollers (side panels, the simulator deck, the lens rail, the 3D canvas) keep their own native wheel scrolling.
   Reduced motion, or the libraries failing to load: plain native scrolling, nothing else changes. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const INNER = '[data-lenis-prevent], .c3d-stage, .c3d-rail, .c3d-right, .deck, .rv, .tablewrap, .wall, .film, .t3-stage, select, textarea';

  // the clock: GSAP's ticker when present, else a single rAF loop
  const subs = new Set();
  if (window.gsap) gsap.ticker.add((t) => subs.forEach((f) => f(t * 1000)));
  else (function loop(t) { subs.forEach((f) => f(t)); requestAnimationFrame(loop); })(performance.now());
  FF.clock = { add: (f) => subs.add(f), remove: (f) => subs.delete(f) };

  let lenis = null;
  function start() {
    if (lenis || reduce.matches || typeof window.Lenis !== 'function') return;
    lenis = new Lenis({ lerp: 0.14, wheelMultiplier: 1.05, smoothWheel: true, syncTouch: false, prevent: (node) => !!(node.closest && node.closest(INNER)) });
    FF.clock.add(lenis.__tick = (t) => lenis.raf(t));
    if (window.gsap) gsap.ticker.lagSmoothing(0);
  }
  function stop() { if (!lenis) return; FF.clock.remove(lenis.__tick); lenis.destroy(); lenis = null; }
  reduce.addEventListener('change', () => (reduce.matches ? stop() : start()));
  start();

  FF.scroll = {
    get smooth() { return !!lenis; },
    to(target, opts) {
      opts = opts || {};
      if (lenis) lenis.scrollTo(target, { immediate: !!opts.immediate, duration: opts.duration, offset: opts.offset || 0, force: true });
      else window.scrollTo({ top: typeof target === 'number' ? target : (target.getBoundingClientRect().top + scrollY + (opts.offset || 0)), behavior: opts.immediate || reduce.matches ? 'auto' : 'smooth' });
    },
    resize() { if (lenis) lenis.resize(); }
  };
})();
