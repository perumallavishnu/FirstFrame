/* landing.js: the scroll-driven landing page. One sticky 3D stage; scrolling plays the camera through five chapters.
   Concept: the page is one exposure. You scroll, the camera turns, opens, changes lens and finally fires.
   Motion verb: "turn like a dial" (eased rotation, no bounces). Reduced-motion users get the same chapters as a static page. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const U = FF.ui, h = U.h;
  const pg = FF.pages;
  let api = null, built = false, raf = 0, stageEl, caps = [], ticks = [], sheet, flashEl, on = false, lastP = -1, state = { power: false, xray: false, lens: 'kit', fired: false }, thumbsDone = false;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => innerWidth < 860;

  // chapters: [start, end] of scroll progress, copy, and where the camera sits
  const CH = [
    { a: 0.0, b: 0.15, k: 'Learn photography', t: 'Your first frame, before your first camera.', p: 'A real beginner camera, rebuilt in your browser. Every dial, every lens and every setting behaves the way it would in your hands.', cta: [['#simulator', 'Pick up the camera', 1], ['#academy', 'Start the course']] },
    { a: 0.17, b: 0.32, k: '01 · The camera', t: 'Every button has a job. Press them all.', p: 'Turn the Canon EOS R100 over, switch it on and work the menus on its rear screen. Thirty-eight parts explain themselves when you click them.', cta: [['#camera', 'Explore it in 3D']] },
    { a: 0.34, b: 0.49, k: '02 · Inside', t: 'Pull it apart to see how a photo is made.', p: 'Mount, shutter, sensor, processor, screen. The exploded view shows the path light takes and what each layer adds.', cta: [['#lesson-light', 'How a camera captures light']] },
    { a: 0.51, b: 0.66, k: '03 · Lenses', t: 'Ten lenses. One twist to change the picture.', p: 'From a 10 mm ultra-wide to a 400 mm telephoto. Unlock one, drag another onto the mount, and the simulator shoots through it.', cta: [['#gear', 'See the lenses']] },
    { a: 0.68, b: 0.83, k: '04 · Practice', t: 'Then go and shoot.', p: 'Ten scenes with real depth of field, motion blur, noise and flash. Every photo is graded and tells you what to change.', cta: [['#simulator', 'Open the simulator', 1], ['#missions', 'Take a mission']] },
    { a: 0.85, b: 1.01, k: '05 · The course', t: 'Fifteen lessons from Auto to Manual.', p: 'Short, plain-language lessons with live experiments and quizzes, nine graded missions, and a portfolio of what you shot.', cta: [['#academy', 'See the course', 1]] }
  ];
  // camera keyframes over scroll progress
  const KF = [
    { p: 0.0, theta: 0.62, phi: 1.22, radius: 31, offX: 0.2, explode: 0, lensOut: 0, flash: 0 },
    { p: 0.15, theta: 0.9, phi: 1.1, radius: 30, offX: 0.2, explode: 0, lensOut: 0, flash: 0 },
    { p: 0.24, theta: 2.75, phi: 1.12, radius: 29, offX: -0.25, explode: 0, lensOut: 0, flash: 0 },
    { p: 0.32, theta: 3.4, phi: 0.7, radius: 29, offX: -0.25, explode: 0, lensOut: 0, flash: 0 },
    { p: 0.42, theta: 5.0, phi: 1.25, radius: 30, offX: 0.26, explode: 1, lensOut: 0, flash: 0 },
    { p: 0.49, theta: 5.5, phi: 1.2, radius: 30, offX: 0.26, explode: 0.9, lensOut: 0, flash: 0 },
    { p: 0.54, theta: 6.9, phi: 1.25, radius: 34, offX: -0.18, explode: 0, lensOut: 1, flash: 0 },
    { p: 0.6, theta: 7.1, phi: 1.2, radius: 34, offX: -0.18, explode: 0, lensOut: 1, flash: 0 },
    { p: 0.66, theta: 7.0, phi: 1.3, radius: 32, offX: -0.18, explode: 0, lensOut: 0, flash: 0 },
    { p: 0.74, theta: 6.36, phi: 1.5, radius: 24, offX: 0.2, explode: 0, lensOut: 0, flash: 1 },
    { p: 0.83, theta: 6.3, phi: 1.52, radius: 22, offX: 0.2, explode: 0, lensOut: 0, flash: 1 },
    { p: 0.92, theta: 6.9, phi: 1.2, radius: 36, offX: -0.22, explode: 0, lensOut: 0, flash: 0 },
    { p: 1.0, theta: 7.0, phi: 1.18, radius: 36, offX: -0.22, explode: 0, lensOut: 0, flash: 0 }
  ];
  const sm = (x) => x * x * (3 - 2 * x);
  function pose(p) {
    let i = 0; while (i < KF.length - 2 && p > KF[i + 1].p) i++;
    const a = KF[i], b = KF[i + 1], k = sm(Math.max(0, Math.min(1, (p - a.p) / (b.p - a.p)))), o = {};
    ['theta', 'phi', 'radius', 'offX', 'explode', 'lensOut', 'flash'].forEach((key) => (o[key] = a[key] + (b[key] - a[key]) * k));
    return o;
  }
  function progress() { const r = stageEl.getBoundingClientRect(), span = r.height - innerHeight; return span > 0 ? Math.max(0, Math.min(1, -r.top / span)) : 0; }

  function apply(p) {
    if (reduce()) p = 0.02;
    if (api) {
      const o = pose(p), n = narrow(), T = api.tgt;
      T.theta = o.theta; T.phi = o.phi; T.radius = o.radius * (n ? 1.4 : 1); T.offX = n ? 0 : o.offX; T.offY = n ? 0.2 : 0; T.explode = o.explode; T.lensOut = o.lensOut; T.flash = o.flash;
      const want = { power: p > 0.19 && p < 0.335, xray: p > 0.37 && p < 0.5, lens: p > 0.57 && p < 0.9 ? 'p85' : 'kit' };
      if (want.power !== state.power) { state.power = want.power; if (FF.menu.power !== want.power) FF.menu.key('power'); T.power = want.power ? 1 : 0; if (want.power) FF.menu.key('menu'); }
      if (want.xray !== state.xray) { state.xray = want.xray; api.set('xray', want.xray); }
      if (want.lens !== state.lens) { state.lens = want.lens; api.swap(want.lens); }
      const fire = p > 0.775 && p < 0.86; if (fire && !state.fired) { api.act('shutterbtn'); if (!reduce()) { flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go'); } } state.fired = fire;
      api.touch();
    }
    caps.forEach((c, i) => { const ch = CH[i], f = 0.035, v = Math.max(0, Math.min(1, Math.min((p - ch.a) / f + (i === 0 ? 1 : 0), (ch.b - p) / f))); c.style.opacity = v; c.style.transform = 'translate3d(0,' + ((1 - v) * (p < (ch.a + ch.b) / 2 ? 28 : -28)).toFixed(1) + 'px,0)'; c.style.visibility = v > 0.01 ? 'visible' : 'hidden'; c.toggleAttribute('inert', v < 0.5); });
    ticks.forEach((t, i) => t.classList.toggle('on', p >= CH[i].a - 0.01 && p < CH[i].b + 0.01));
    const sv = Math.max(0, Math.min(1, Math.min((p - 0.78) / 0.04, (0.865 - p) / 0.03))); sheet.style.opacity = sv; sheet.style.transform = 'translate3d(0,' + ((1 - sv) * 30).toFixed(1) + 'px,0) rotate(-2deg)'; sheet.style.visibility = sv > 0.01 ? 'visible' : 'hidden';
    if (p > 0.6 && !thumbsDone && api) { thumbsDone = true; ['still3d', 'carousel3d', 'cyclist3d'].forEach((id, i) => setTimeout(() => { try { if (FF.Renderer.ok) { const im = sheet.children[i].firstChild; im.src = FF.sim.makeThumb(id); setTimeout(() => { try { FF.sim.dropThumb(id); im.src = FF.sim.makeThumb(id); } catch (e) { /* optional */ } }, 2600); } } catch (e) { /* thumbnails are optional */ } }, i * 260)); }
  }
  function loop() { raf = on ? requestAnimationFrame(loop) : 0; const p = progress(); if (Math.abs(p - lastP) > 0.0004) { lastP = p; apply(p); } }

  pg.home = function (root) {
    if (built) { start(); return; }
    built = true;
    const stage3d = h('div', { class: 'lp-3d' });
    flashEl = h('div', { class: 'lp-flash', 'aria-hidden': 'true' });
    sheet = h('div', { class: 'lp-sheet', 'aria-hidden': 'true' }, ['Still life · f/1.8', 'Carousel · 1/8 s', 'Cyclist · panned'].map((t) => h('figure', null, h('img', { alt: '', width: 240, height: 160 }), h('figcaption', null, t))));
    caps = CH.map((c, i) => h('div', { class: 'lp-cap ' + (i % 2 ? 'r' : 'l') + (i === 4 ? ' l4' : '') },
      h('span', { class: 'lp-k' }, c.k), h(i === 0 ? 'h1' : 'h2', { class: 'lp-t' }, c.t), h('p', { class: 'lp-p' }, c.p),
      h('div', { class: 'row' }, c.cta.map((b) => h('a', { class: 'btn' + (b[2] ? ' primary' : ' ghost'), href: b[0] }, b[1])))));
    ticks = CH.map((c, i) => h('button', { class: 'lp-tick', type: 'button', 'aria-label': 'Go to chapter: ' + c.k, onclick: () => { const r = stageEl.getBoundingClientRect(), span = r.height - innerHeight; window.scrollTo({ top: window.scrollY + r.top + span * (c.a + 0.05), behavior: reduce() ? 'auto' : 'smooth' }); } }, h('span', null, c.k.split('·').pop().trim())));
    stageEl = h('section', { class: 'lp-stage' + (reduce() ? ' static' : ''), 'aria-label': 'Introduction' },
      h('div', { class: 'lp-sticky' }, stage3d, flashEl, sheet, h('div', { class: 'lp-caps' }, caps), h('nav', { class: 'lp-ticks', 'aria-label': 'Chapters' }, ticks), h('div', { class: 'lp-hint', 'aria-hidden': 'true' }, 'Scroll')));
    const L = FF.lessons.list, pr = FF.progress.data;
    const groups = [['Start here', ['meet', 'light']], ['Exposure', ['triangle', 'aperture', 'shutter', 'longexp', 'iso']], ['Control', ['modes', 'metering', 'focus', 'wb']], ['Seeing', ['lenses', 'composition', 'genres', 'raw']]];
    const course = h('section', { class: 'lp-sec' }, h('div', { class: 'lp-head' }, h('span', { class: 'lp-k' }, 'The course'), h('h2', null, 'Four parts. About two hours. Nothing to buy.'), h('p', { class: 'lead' }, 'Each lesson is five to nine minutes, has a live experiment that uses the same optics as the simulator, and ends with a three-question check.')),
      h('div', { class: 'lp-course' }, groups.map((g, gi) => h('div', { class: 'lp-part' }, h('div', { class: 'lp-num' }, '0' + (gi + 1)), h('h3', null, g[0]), h('ol', null, g[1].map((id) => { const l = FF.lessons.byId(id); return l ? h('li', null, h('a', { href: '#lesson-' + id }, l.title), h('span', { class: 'small muted' }, (pr.lessons[id] ? '✓ done · ' : '') + l.min + ' min')) : null; }))))));
    const sc3 = FF.SCENES.filter((s) => s.three), sc2 = FF.SCENES.filter((s) => !s.three);
    const practice = h('section', { class: 'lp-sec' }, h('div', { class: 'lp-head' }, h('span', { class: 'lp-k' }, 'Practice'), h('h2', null, 'Scenes built to teach one thing each.'), h('p', { class: 'lead' }, 'Three are full 3D sets you can walk around in. Seven more are layered scenes tuned for a single skill.')),
      h('div', { class: 'lp-scenes' }, sc3.concat(sc2).map((s) => h('a', { class: 'lp-scene', href: '#simulator', onclick: () => { try { FF.cam.setScene(s.id); } catch (e) { /* set on open */ } } }, h('span', { class: 'tag' + (s.three ? ' acc' : '') }, s.three ? '3D set' : s.concept), h('b', null, s.name.replace(' (3D)', '')), h('span', { class: 'small muted' }, s.skill)))));
    const missions = h('section', { class: 'lp-sec' }, h('div', { class: 'lp-head' }, h('span', { class: 'lp-k' }, 'Missions'), h('h2', null, 'Nine briefs. The camera marks your work.'), h('p', { class: 'lead' }, 'Blur is measured in pixels, exposure in stops. Pass the brief, then chase three stars.')),
      h('ol', { class: 'lp-missions' }, FF.missions.list.map((m) => h('li', null, h('a', { href: '#missions' }, h('b', null, m.title), h('span', { class: 'small muted' }, m.skill + ' · ' + m.level), h('span', { class: 'stars' }, '★'.repeat(pr.missions[m.id] || 0) + '☆'.repeat(3 - (pr.missions[m.id] || 0))))))));
    const honest = h('section', { class: 'lp-sec lp-note' }, h('h2', null, 'What this is, and is not'), h('div', { class: 'two' },
      h('p', null, 'FirstFrame is an independent learning tool. It models one real camera, the Canon EOS R100, because it is a common first camera with a full set of manual controls. It is not made by or affiliated with Canon.'),
      h('p', null, 'The optics are calculated: exposure, depth of field, motion blur, noise and diffraction follow the real formulas. The 3D models and scenes are built by hand from simple shapes, so they teach accurately but do not look like photographs.')),
      h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#simulator' }, 'Pick up the camera'), h('a', { class: 'btn', href: '#camera' }, 'Explore it in 3D'), h('a', { class: 'btn', href: '#academy' }, 'Start lesson 1')));
    root.replaceChildren(h('div', { class: 'lp' }, stageEl, course, practice, missions, honest));
    // sections rise into place once, as they enter
    const items = root.querySelectorAll('.lp-head > *, .lp-part, .lp-scene, .lp-missions li, .lp-note > *'); items.forEach((el) => { el.classList.add('rise'); el.style.setProperty('--i', Array.prototype.indexOf.call(el.parentNode.children, el) % 8); });
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { rootMargin: '0px 0px -8% 0px' }); items.forEach((el) => io.observe(el)); } else items.forEach((el) => el.classList.add('in'));
    const hd = document.querySelector('header.top'); root.style.setProperty('--hh', (hd ? hd.offsetHeight : 56) + 'px');
    apply(0);
    FF.cam3d.create(stage3d, { scroll: true, lens: 'kit' }).then((a) => { api = a; lastP = -1; if (on) api.start(); apply(progress()); }).catch(() => { stage3d.classList.add('failed'); });
    start();
  };
  function start() { on = true; lastP = -1; if (api) api.start(); if (!raf) raf = requestAnimationFrame(loop); }
  pg.homeStop = function () { on = false; cancelAnimationFrame(raf); raf = 0; if (api) { api.stop(); if (state.xray) { api.set('xray', false); state.xray = false; } } if (state.power && FF.menu.power) { FF.menu.key('power'); } state.power = false; };
})();
