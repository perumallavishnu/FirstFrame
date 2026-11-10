/* pages.js: home, camera guide, portfolio, glossary. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const U = FF.ui, h = U.h, P = FF.phys;
  const pg = (FF.pages = {});

  pg.home = function (root) {
    const pr = FF.progress.data, done = Object.keys(pr.lessons).length;
    const lab = FF.Renderer && FF.Renderer.ok ? FF.lab({ title: 'Try it: freeze the fan', scene: 'fan', f: 30, N: 5.6, t: 1 / 60, iso: 1600, speed: 1800, sliders: ['t'], comp: 'aperture', toggles: ['comp'], width: 560, note: 'This is a real simulation of the Canon EOS R100 and its kit lens. Slide the shutter speed to the right to freeze the blades.' }) : h('div', { class: 'callout' }, 'The live preview needs WebGL2.');
    root.replaceChildren(
      h('section', { class: 'hero' },
        h('div', { class: 'hero-copy' },
          h('span', { class: 'tag acc' }, 'Learn photography without buying a camera'),
          h('h1', null, 'Your first frame, before your first camera.'),
          h('p', { class: 'lead' }, 'FirstFrame is a free camera you can use in your browser. It copies one real beginner camera, the Canon EOS R100, with its real lenses, so every shutter speed, aperture and ISO you set behaves the way it would in your hands. Then it shows you why the picture came out the way it did.'),
          h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#simulator' }, 'Pick up the camera'), h('a', { class: 'btn', href: '#camera' }, 'Explore it in 3D'), h('a', { class: 'btn', href: '#academy' }, 'Start the lessons'), h('a', { class: 'btn', href: '#missions' }, 'Take a mission')),
          h('p', { class: 'small muted' }, 'No sign-up, no server. Your progress stays in this browser.')),
        h('div', { class: 'hero-lab' }, lab)),
      h('section', { class: 'three' },
        h('a', { class: 'card feat', href: '#camera' }, h('h3', null, 'The camera in 3D'), h('p', null, 'Rotate the EOS R100, click every button and door, pull it apart in an exploded view, use its menu screen, and drag ten different lenses onto the mount.')),
        h('a', { class: 'card feat', href: '#simulator' }, h('h3', null, 'A camera that behaves'), h('p', null, 'Ten live scenes, three of them real 3D sets: a still life, a carousel at dusk and a cyclist. Depth of field, motion blur, panning, noise and flash all come from the settings you choose.')),
        h('a', { class: 'card feat', href: '#academy' }, h('h3', null, 'Lessons with live experiments'), h('p', null, 'Fifteen short lessons. Drag a slider and the same optics as the simulator redraw the picture. 3D diagrams show the light path and the inside of the sensor.')),
        h('a', { class: 'card feat', href: '#missions' }, h('h3', null, 'Photos that explain themselves'), h('p', null, 'Every shot gets a review: blur measured in pixels, focus, noise, a histogram, a 100% crop and plain-English advice on what went wrong.'))),
      h('section', { class: 'card why' },
        h('h2', null, 'Why the Canon EOS R100?'),
        h('p', null, 'It is a good first camera because it is cheap for what it does, small enough to carry everywhere, and has the full set of controls (Auto, Program, Shutter priority, Aperture priority and Manual) on a proper mount with a growing lens range. What you learn on it transfers to any camera.'),
        h('div', { class: 'row' }, h('a', { class: 'btn', href: '#gear' }, 'See the camera and its lenses'), h('span', { class: 'small muted' }, done ? done + ' lesson(s) completed so far' : 'Lesson 1 takes six minutes'))));
  };

  pg.gear = function (root) {
    const B = FF.BODY;
    const acc = [['sd', 'An SD card, 64 GB or larger, UHS-I', 'Pick a known brand. Format it in the camera.'], ['bat', 'A spare LP-E17 battery', 'Mirrorless cameras use power for the screen. About 400 shots per charge.'], ['prime', 'RF 50 mm f/1.8 STM', 'The best first upgrade for portraits and low light.'], ['tele', 'RF-S 55-210 mm IS STM', 'Only if you shoot sport, birds or far-off things.'], ['strap', 'A comfortable strap', 'Wrist or sling. Saves drops.'], ['clean', 'Blower and microfibre cloth', 'Never wipe grit; blow it off first.'], ['tripod', 'A small tripod', 'Needed for night, water and self-timer pictures.'], ['bag', 'A padded bag or insert', 'Keeps the kit safe and dry.']];
    const have = U.store.get('gear', {});
    root.replaceChildren(
      h('div', { class: 'page-head' }, h('h1', null, B.name), h('p', { class: 'lead' }, 'A small mirrorless camera designed for people moving up from a phone. This page lists what it can do, the ten lenses you can mount in the simulator, and what to buy first.')),
      h('div', { class: 'two' },
        h('section', { class: 'card' }, h('h2', null, 'Specifications'), h('div', { class: 'tablewrap' }, h('table', { class: 'specs' }, h('tbody', null, B.specs.map((r) => h('tr', null, h('th', { scope: 'row' }, r[0]), h('td', null, r[1])))))), h('p', { class: 'small muted' }, 'Figures are from public Canon and retailer pages and may differ by region. Check the box before you buy.')),
        h('section', { class: 'card' }, h('h2', null, 'What it is good and bad at'), h('h3', null, 'Strengths'), h('ul', null, ['Light (about 356 g) and simple. You will carry it.', 'Good 24 MP image quality in daylight and decent indoors.', 'Fast, reliable face and eye autofocus.', 'Full set of manual controls.', 'RF mount, so lenses carry over to any later Canon body.'].map((t) => h('li', null, t))), h('h3', null, 'Limits to know about'), h('ul', null, ['No stabilisation in the body, so use IS lenses or faster shutters.', 'Fixed rear screen; no touch or flip.', 'Basic video: 4K with a heavy crop.', 'Smaller lens line-up than older systems, and fewer budget RF-S lenses.'].map((t) => h('li', null, t))), h('div', { class: 'callout' }, 'Prices change often, so this page lists none. A kit with the 18-45 mm lens is the usual way to start.'))),
      h('h2', { style: { marginTop: '28px' } }, 'The lenses (all ten work in the Simulator)'),
      h('div', { class: 'cards' }, FF.LENSES.map((l) => h('article', { class: 'card lens-card' }, h('span', { class: 'tag' }, l.role), h('h3', null, l.name), h('p', null, l.blurb),
        h('dl', { class: 'dl' }, [['Focal length', l.fmin === l.fmax ? l.fmin + ' mm' : l.fmin + '–' + l.fmax + ' mm'], ['On full frame', l.equiv], ['Max aperture', 'f/' + l.maxAp.join('–f/')], ['Close focus', U.fmt.dist(l.mfd(l.fmin)) + (l.fmin !== l.fmax ? ' to ' + U.fmt.dist(l.mfd(l.fmax)) : '')], ['Stabiliser', l.isStops ? 'About ' + l.isStops + ' stops' : 'None'], ['Weight', l.weight + ' g']].map(([a, b]) => [h('dt', null, a), h('dd', null, b)])),
        h('div', { class: 'row' }, l.bestFor.map((t) => h('span', { class: 'tag' }, t)))))),
      h('p', null, h('a', { class: 'btn primary', href: '#camera' }, 'See them in 3D and attach them')),
      h('h3', { style: { marginTop: '20px' } }, 'Other lenses that fit'), h('ul', null, FF.LENS_MORE.map((r) => h('li', null, h('b', null, r[0] + '. '), r[1]))),
      h('h2', { style: { marginTop: '28px' } }, 'Your shopping list'),
      h('section', { class: 'card' }, h('p', { class: 'small muted' }, 'Tick what you have. Buy the first four lines before anything else.'),
        h('div', { class: 'checks' }, acc.map(([id, t, d]) => { const i = h('input', { type: 'checkbox', id: 'g-' + id, checked: have[id] || null, onchange: () => { have[id] = i.checked; U.store.set('gear', have); } }); return h('label', { for: 'g-' + id, class: 'check' }, i, h('span', null, h('b', null, t), h('br'), h('span', { class: 'small muted' }, d))); }))));
  };

  pg.portfolio = function (root) {
    const pf = U.store.get('portfolio', []);
    const list = pf.length ? h('div', { class: 'gallery' }, pf.map((p, i) => h('figure', { class: 'card shot' },
      h('img', { src: p.thumb, alt: 'Photo: ' + FF.sceneById(p.scene).name, loading: 'lazy', width: 240, height: 160 }),
      h('figcaption', null, h('b', null, FF.sceneById(p.scene).name), h('div', { class: 'mono small muted' }, p.mode + ' · ' + P.fmtShutter(p.tv) + ' s · ' + P.fmtAperture(p.N) + ' · ISO ' + Math.round(p.iso)), h('div', { class: 'row' }, h('span', { class: 'tag ' + (p.score >= 80 ? 'ok' : p.score >= 55 ? 'warn' : 'bad') }, 'Score ' + p.score), h('button', { class: 'btn sm', type: 'button', onclick: () => { pf.splice(i, 1); U.store.set('portfolio', pf); pg.portfolio(root); } }, 'Delete')))))) : h('div', { class: 'callout' }, 'No photos yet. Take some in the simulator and they will appear here, with the settings you used.');
    root.replaceChildren(h('div', { class: 'page-head' }, h('h1', null, 'Portfolio'), h('p', { class: 'lead' }, 'The last ' + 24 + ' photos you took, with their settings and review score. They live in this browser only.'), pf.length ? h('button', { class: 'btn sm', type: 'button', onclick: () => { U.store.set('portfolio', []); pg.portfolio(root); } }, 'Clear all') : null), list);
  };

  pg.glossary = function (root) {
    const q = h('input', { type: 'search', placeholder: 'Search terms', 'aria-label': 'Search glossary', class: 'search' }); const out = h('dl', { class: 'gloss' });
    const paint = () => { const s = q.value.trim().toLowerCase(); out.replaceChildren(...FF.GLOSSARY.filter(([a, b]) => !s || (a + ' ' + b).toLowerCase().includes(s)).map(([a, b]) => h('div', { class: 'g' }, h('dt', null, a), h('dd', null, b)))); if (!out.children.length) out.append(h('p', { class: 'muted' }, 'No matches.')); };
    q.oninput = paint; paint();
    root.replaceChildren(h('div', { class: 'page-head' }, h('h1', null, 'Glossary'), h('p', { class: 'lead' }, 'Photography words in plain language.'), q), out);
  };
})();
