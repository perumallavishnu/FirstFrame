/* lessons.js: lesson engine plus the first half of the curriculum. Content continues in lessons_b.js. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const U = FF.ui, h = U.h;
  const L = (FF.lessons = { list: [], byId: (id) => L.list.find((l) => l.id === id) });
  FF.LESSONS = L.list;
  const add = (l) => L.list.push(l);
  L.add = add;

  /* render a body item */
  function item(b) {
    if (typeof b === 'string') return h('p', { html: b });
    if (b.h) return h('h3', null, b.h);
    if (b.ul) return h('ul', null, b.ul.map((t) => h('li', { html: t })));
    if (b.ol) return h('ol', null, b.ol.map((t) => h('li', { html: t })));
    if (b.tip) return h('div', { class: 'callout tip' }, h('b', null, 'Try this. '), h('span', { html: b.tip }));
    if (b.key) return h('div', { class: 'callout key' }, h('b', null, 'Remember. '), h('span', { html: b.key }));
    if (b.warn) return h('div', { class: 'callout warn' }, h('b', null, 'Watch out. '), h('span', { html: b.warn }));
    if (b.lab) return FF.Renderer && FF.Renderer.ok ? FF.lab(b.lab) : h('div', { class: 'callout' }, 'The live experiment needs WebGL2, which this browser did not provide.');
    if (b.x) return FF.explain[b.x]();
    if (b.table) return h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, b.table[0].map((c) => h('th', null, c)))), h('tbody', null, b.table.slice(1).map((r) => h('tr', null, r.map((c) => h('td', { html: c })))))));
    if (b.sim) return h('p', null, h('a', { class: 'btn primary', href: '#simulator', onclick: () => { if (b.sim.scene && FF.cam) { FF.cam.setScene(b.sim.scene); } } }, b.sim.label || 'Practise in the simulator'));
    if (b.mission) return h('p', null, h('a', { class: 'btn primary', href: '#missions' }, 'Take the mission: ' + FF.missions.byId(b.mission).title));
    return null;
  }

  function quizBlock(lesson) {
    const done = U.store.get('progress', {}).quiz || {};
    const wrap = h('section', { class: 'quiz card' }, h('h3', null, 'Check yourself'));
    let answered = 0, right = 0; const total = lesson.quiz.length;
    const res = h('div', { class: 'quiz-res', role: 'status' });
    lesson.quiz.forEach((q, qi) => {
      const fb = h('div', { class: 'small fb' }); const box = h('fieldset', { class: 'q' }, h('legend', null, (qi + 1) + '. ' + q.q));
      const name = 'q-' + lesson.id + '-' + qi;
      q.o.forEach((o, oi) => {
        const id = name + '-' + oi;
        const inp = h('input', { type: 'radio', name, id, onchange: () => {
          if (box.dataset.done) return; box.dataset.done = '1'; answered++;
          const ok = oi === q.a; if (ok) right++;
          Array.from(box.querySelectorAll('label')).forEach((lb, j) => { lb.classList.add(j === q.a ? 'right' : j === oi ? 'wrong' : ''); }); box.querySelectorAll('input').forEach((i) => (i.disabled = true));
          fb.textContent = (ok ? 'Correct. ' : 'Not quite. ') + q.why;
          if (answered === total) {
            const sc = Math.round(100 * right / total);
            res.textContent = 'You scored ' + right + ' out of ' + total + '.' + (right === total ? ' Perfect!' : ' You can retake it by reloading the lesson.');
            FF.progress.completeLesson(lesson.id, sc); window.dispatchEvent(new Event('ff-progress'));
          }
        } });
        box.append(h('label', { for: id, class: 'opt' }, inp, h('span', null, o)));
      });
      box.append(fb); wrap.append(box);
    });
    wrap.append(res);
    if (done[lesson.id] != null) wrap.append(h('div', { class: 'small muted' }, 'Best score so far: ' + done[lesson.id] + '%'));
    return wrap;
  }

  L.renderAcademy = function (root) {
    const pr = FF.progress.data; const n = L.list.filter((l) => pr.lessons[l.id]).length;
    root.replaceChildren(
      h('div', { class: 'page-head' }, h('h1', null, 'Academy'), h('p', { class: 'lead' }, 'Fifteen short lessons that take you from “what do these buttons do?” to shooting confidently in manual. Every lesson has a live experiment that uses the same optics as the simulator, and a quick quiz.'), h('div', { class: 'tag' }, n + ' of ' + L.list.length + ' complete'), h('progress', { max: L.list.length, value: n, 'aria-label': 'Lessons completed' })),
      h('div', { class: 'cards' }, L.list.map((l, i) => h('a', { class: 'card lesson-card' + (pr.lessons[l.id] ? ' done' : ''), href: '#lesson-' + l.id },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'tag' }, 'Lesson ' + (i + 1)), pr.lessons[l.id] ? h('span', { class: 'tag ok' }, '✓ Done') : h('span', { class: 'small muted' }, l.min + ' min')),
        h('h3', null, l.title), h('p', { class: 'small' }, l.sum)))));
  };

  L.renderLesson = function (root, id) {
    const l = L.byId(id), i = L.list.indexOf(l);
    if (!l) { root.replaceChildren(h('div', { class: 'page-head' }, h('h1', null, 'Lesson not found'), h('a', { class: 'btn', href: '#academy' }, 'Back to the Academy'))); return; }
    const prev = L.list[i - 1], next = L.list[i + 1];
    root.replaceChildren(
      h('a', { class: 'small', href: '#academy' }, '← All lessons'),
      h('article', { class: 'lesson' },
        h('div', { class: 'page-head' }, h('span', { class: 'tag' }, 'Lesson ' + (i + 1) + ' of ' + L.list.length + ' · ' + l.min + ' min'), h('h1', null, l.title), h('p', { class: 'lead' }, l.sum)),
        l.body.map(item), quizBlock(l),
        h('nav', { class: 'row lesson-nav', 'aria-label': 'Lesson navigation' }, prev ? h('a', { class: 'btn', href: '#lesson-' + prev.id }, '← ' + prev.title) : h('span'), next ? h('a', { class: 'btn primary', href: '#lesson-' + next.id }, next.title + ' →') : h('a', { class: 'btn primary', href: '#missions' }, 'On to the missions →'))));
  };

  /* ================= curriculum, part 1 ================= */
  add({ id: 'meet', min: 6, title: 'Meet your camera', sum: 'The Canon EOS R100 and the parts of any camera that matter.',
    body: [
      'A camera is a box that keeps out all light except for a controlled amount, for a controlled time, landing on a light-sensitive surface. Everything else, from the mode dial to the lens, is there to control those three things.',
      { h: 'The parts' },
      { ul: ['<b>Lens.</b> Gathers light from the scene and focuses it into a small image. Changeable on the R100: it uses the RF mount.', '<b>Aperture.</b> An adjustable hole inside the lens. Wide lets in more light, narrow lets in less.', '<b>Shutter.</b> A curtain that opens for a set time. Short for freezing motion, long for blur or dim light.', '<b>Sensor.</b> The chip that turns light into electrical signals. The R100 has an APS-C sensor with 24.1 million pixels.', '<b>Processor.</b> Turns the signals into a picture: colour, contrast, noise reduction, JPEG.', '<b>Viewfinder or screen.</b> The R100 has an electronic viewfinder (EVF) that shows you the picture as it will be recorded, including brightness.'] },
      { h: 'Why the EOS R100?' },
      'It is Canon’s lowest-priced mirrorless camera, light enough to carry everywhere, with the same RF lens mount as the professional bodies. It has every exposure mode a beginner needs, from a fully automatic mode through to full manual. Whatever you learn here carries over to any other camera.',
      { tip: 'Open the simulator and look along the top of the camera: the mode dial, the shutter button and the screen. We will use all of them in the next lessons.' },
      { sim: { label: 'Open the simulator' } }
    ],
    quiz: [
      { q: 'Which three things does a camera control to make a picture?', o: ['Colour, contrast, sharpness', 'How much light, for how long, and how sensitive the sensor is', 'Lens, flash, battery', 'Zoom, focus, resolution'], a: 1, why: 'Aperture and shutter speed set how much light arrives and for how long; ISO sets how strongly the signal is amplified.' },
      { q: 'What does the R100’s RF mount mean for you later?', o: ['Nothing', 'You can fit RF and RF-S lenses, including professional ones', 'You can use any brand’s lenses without an adapter', 'The camera cannot change lens'], a: 1, why: 'The R100 uses Canon’s RF mount, so you can upgrade lenses without changing body.' },
      { q: 'An electronic viewfinder shows you…', o: ['A direct optical view through the lens', 'A live video of what the sensor sees', 'Only the last photo', 'A grid of focus points'], a: 1, why: 'An EVF is a tiny screen fed by the sensor, so it can preview exposure before you shoot.' }
    ] });

  add({ id: 'light', min: 7, title: 'How a camera captures light', sum: 'Rays, lenses, the sensor, and why focus is a distance.',
    body: [
      'Every point on a sunlit object scatters light in all directions. A lens catches the rays that reach it and bends them so that rays from one point meet again at one point. That is an image. Put the sensor exactly where the rays meet and the picture is sharp. Put it anywhere else and each point becomes a small disc, a <b>circle of confusion</b>.',
      { x: 'lightPath' },
      { key: 'Focusing means moving lens elements so the image of your subject lands exactly on the sensor. Things closer or farther than the subject land in front of or behind it, so they spread into discs: blur.' },
      { h: 'The sensor' },
      'The sensor is millions of tiny light buckets called photodiodes. Light is photons; each bucket turns them into electrons. More light means more electrons, a brighter pixel. A colour filter over each bucket lets through only red, green or blue, and the processor combines neighbours to give every pixel full colour.',
      { x: 'sensor' },
      { h: 'Why sensor size matters' },
      'A larger sensor collects more total light for the same exposure, because it is a larger window. Random variation in photon counts, called shot noise, matters less when more photons are counted, so large sensors look cleaner in dim light. The R100’s APS-C sensor is bigger than a phone sensor and smaller than full frame.'
    ],
    quiz: [
      { q: 'What is a circle of confusion?', o: ['A lens defect', 'The disc a point of light becomes when it is not focused on the sensor', 'The shape of the aperture', 'A kind of flash'], a: 1, why: 'Out-of-focus points land in front of or behind the sensor and spread into discs.' },
      { q: 'Why are large sensors cleaner at the same exposure?', o: ['They have more megapixels', 'They collect more photons in total, so random noise matters less', 'They use better filters', 'They never overheat'], a: 1, why: 'More light collected means a better signal compared with random shot noise.' },
      { q: 'What does the colour filter on each photodiode do?', o: ['Makes the sensor waterproof', 'Lets only red, green or blue light reach that pixel', 'Sharpens the picture', 'Reduces noise'], a: 1, why: 'The camera reconstructs full colour from the red, green and blue samples of neighbouring pixels.' }
    ] });

  add({ id: 'triangle', min: 8, title: 'The exposure triangle', sum: 'Aperture, shutter speed and ISO: three controls, one brightness.',
    body: [
      '<b>Exposure</b> is how bright the finished picture is. Three controls decide it:',
      { ul: ['<b>Aperture</b> (f-number): how wide the lens opening is.', '<b>Shutter speed</b>: how long the sensor is exposed.', '<b>ISO</b>: how much the sensor signal is amplified.'] },
      'They are measured in <b>stops</b>. One stop is a doubling or halving of brightness. Open the aperture one stop, or halve the shutter time, or double the ISO, and the picture changes by one stop. This lets you trade one for another: a faster shutter needs a wider aperture or a higher ISO to stay equally bright.',
      { lab: { title: 'Trade one for another and the picture stays equally bright', scene: 'cafe', lens: 'prime', f: 50, N: 2.8, t: 1 / 100, iso: 800, sliders: ['N', 't', 'iso'], comp: 'iso', toggles: ['comp'], subjD: 1.2, note: 'The checkbox keeps exposure constant: move the aperture or the shutter and ISO follows. Look at what else changes besides brightness: background blur, noise and sharpness.' } },
      { key: 'Each control has a side effect. Aperture changes depth of field. Shutter speed changes motion blur. ISO changes noise. Choosing exposure is choosing which side effect you want.' },
      { table: [['Control', 'Brighter picture by…', 'Side effect'], ['Aperture', 'Wider (smaller f-number)', 'Shallower depth of field'], ['Shutter', 'Slower', 'More motion blur and shake'], ['ISO', 'Higher', 'More noise']] }
    ],
    quiz: [
      { q: 'You change from f/4 to f/2.8. What happens to the light?', o: ['Halved', 'Doubled (one stop more)', 'Four times as much', 'No change'], a: 1, why: 'Each full f-stop step (f/2.8, 4, 5.6, 8…) halves or doubles the light.' },
      { q: 'You want a faster shutter but the same brightness. Which change is NOT a fix?', o: ['Wider aperture', 'Higher ISO', 'More light on the scene', 'Smaller aperture'], a: 3, why: 'A smaller aperture lets in less light, making it worse.' },
      { q: 'One stop of exposure is…', o: ['10%', 'A doubling or halving of light', 'A shutter click', 'A fixed number of lux'], a: 1, why: 'Stops are a ratio of two.' }
    ] });

  add({ id: 'aperture', min: 8, title: 'Aperture and depth of field', sum: 'How the lens opening makes backgrounds soft or everything sharp.',
    body: [
      'Aperture is written as an f-number: f/1.8, f/4, f/8. The number is the focal length divided by the opening diameter, so a <b>small number is a big opening</b>. That is confusing at first. Think of it as a fraction: 1/2 is bigger than 1/8.',
      { h: 'Depth of field' },
      'Only one distance is perfectly in focus. Nearby distances look acceptably sharp too; the range that does is the <b>depth of field</b> (DoF). Three things change it:',
      { ul: ['<b>Aperture.</b> Wider aperture, shallower DoF.', '<b>Distance.</b> Closer subject, shallower DoF.', '<b>Focal length.</b> Longer lens, shallower DoF at the same framing distance.'] },
      { lab: { title: 'Aperture and background blur', scene: 'cafe', lens: 'prime', f: 50, N: 1.8, t: 1 / 100, iso: 800, subjD: 0.8, sliders: ['N', 'subjD'], comp: 'shutter', toggles: ['comp', 'zoom'], note: 'Exposure is held steady by changing the shutter. Notice how the string lights turn into discs (bokeh) as the aperture opens up.' } },
      { h: 'Going too far' },
      'Closing the aperture a lot (f/16 and beyond) makes everything sharp, but light bends around the edges of a tiny opening and softens fine detail. This is <b>diffraction</b>. On the R100 the sharpest apertures are usually around f/5.6 to f/8.',
      { tip: 'Mount the 50 mm f/1.8 in the simulator, stand 1 metre from the café cup and compare f/1.8 with f/8.' },
      { mission: 'bokeh' }
    ],
    quiz: [
      { q: 'Which gives the softest background?', o: ['f/16, far from the subject', 'f/1.8, close to the subject', 'f/8, at 18 mm', 'f/22, with flash'], a: 1, why: 'A wide aperture and a close subject both reduce depth of field.' },
      { q: 'What does a larger f-number mean?', o: ['Wider opening', 'Smaller opening', 'Faster lens', 'Longer lens'], a: 1, why: 'f-number is focal length divided by opening diameter.' },
      { q: 'Why not always shoot at f/22?', o: ['It is illegal', 'Diffraction softens fine detail and it needs a lot of light', 'It makes backgrounds blurry', 'Lenses cannot do it'], a: 1, why: 'Very small apertures reduce light and cause diffraction softness.' }
    ] });

  add({ id: 'shutter', min: 8, title: 'Shutter speed and motion', sum: 'Freezing a fan blade, blurring a river and panning with a car.',
    body: [
      'Shutter speed is how long the sensor collects light, written as a fraction of a second: 1/1000 is a thousandth of a second. A moving subject keeps moving while the shutter is open, so the picture records its path as blur.',
      { x: 'shutter' },
      { h: 'Rules of thumb' },
      { ul: ['<b>Hand-held sharpness:</b> use a shutter speed of at least 1 divided by your focal length on the crop sensor, about 1 / (1.6 × f). At 50 mm that is 1/80 s. The stabiliser (IS) buys about 3 more stops.', '<b>Walking people:</b> about 1/250 s.', '<b>Running children, pets:</b> 1/500 s.', '<b>Sport and birds:</b> 1/1000 s or faster.', '<b>Water to silk:</b> 1/2 s or longer on a tripod.'] },
      { lab: { title: 'The fan at different shutter speeds', scene: 'fan', f: 30, N: 5.6, t: 1 / 250, iso: 800, speed: 1500, sliders: ['t', 'speed'], comp: 'iso', toggles: ['comp'], note: 'The fan turns at the rpm shown. Faster shutters freeze the blades; slower ones draw them into a blur.' } },
      { h: 'Panning' },
      'To keep a moving subject sharp and streak the background, use a medium speed such as 1/30 s and swing the camera to follow the subject. In the simulator, turn on “Pan with subject” in the Drive tab.',
      { mission: 'freeze' }
    ],
    quiz: [
      { q: 'You want to freeze a running dog. Roughly what shutter speed?', o: ['1/15 s', '1/60 s', '1/500 s', '1 s'], a: 2, why: 'Fast subjects need 1/500 s or faster.' },
      { q: 'What causes blur when the subject is still?', o: ['High ISO', 'Camera shake with a slow shutter', 'A wide aperture', 'The sensor size'], a: 1, why: 'Your hands move during a long exposure.' },
      { q: 'Panning needs…', o: ['A very fast shutter', 'A medium shutter and following the subject', 'A tripod always', 'The flash on'], a: 1, why: 'Following the subject keeps it sharp while the background smears.' }
    ] });

  add({ id: 'longexp', min: 7, title: 'Long exposures and tripods', sum: 'Silky water, light trails and night scenes.',
    body: [
      'When the shutter stays open for a second or more, anything moving smooths out and anything still stays crisp. Waterfalls become silk, traffic becomes ribbons of light, clouds streak.',
      { h: 'What you need' },
      { ul: ['A <b>tripod</b> or a solid surface. Even tiny shake is visible over seconds. Turn off lens stabilisation on a tripod.', 'A <b>self-timer</b> or remote so you do not shake the camera pressing the button.', '<b>ISO 100</b> and a <b>small aperture</b> to keep the picture from over-exposing in daylight. In bright light a neutral-density filter (a dark glass for the lens) helps.'] },
      { lab: { title: 'Waterfall from fast to slow', scene: 'water', f: 30, N: 11, t: 1 / 8, iso: 100, sliders: ['t', 'N'], toggles: ['tripod'], tripod: true, note: 'Pull the shutter slider towards 1 second and beyond. The picture will get brighter; narrow the aperture to compensate.' } },
      { warn: 'Long exposures at high ISO are noisy and brighter than you expect. Keep ISO low and let time do the work.' },
      { mission: 'silk' }
    ],
    quiz: [
      { q: 'Why a tripod for a 2-second exposure?', o: ['To look professional', 'Hand shake would blur everything', 'To make the aperture wider', 'To increase ISO'], a: 1, why: 'A tripod keeps stationary parts sharp.' },
      { q: 'Daytime waterfall at 1 s is too bright. Best first fix?', o: ['Raise ISO', 'Lower ISO to 100 and use a smaller aperture', 'Open the aperture', 'Turn on flash'], a: 1, why: 'Reduce the light reaching the sensor.' },
      { q: 'What should you turn off on a tripod?', o: ['The screen', 'Image stabilisation', 'AF', 'The self-timer'], a: 1, why: 'The IS system can introduce tiny movements when it has nothing to correct.' }
    ] });

  add({ id: 'iso', min: 7, title: 'ISO and noise', sum: 'Amplifying a weak signal and what it costs.',
    body: [
      'ISO sets how much the sensor’s electrical signal is amplified before it becomes a number. It does not make the sensor see more light. It makes a weak signal louder, and along with it the random noise.',
      { ul: ['<b>Low ISO (100–400):</b> clean, for bright scenes.', '<b>Medium (800–3200):</b> indoor, dusk, fast action. Fine on the R100.', '<b>High (6400–12800):</b> usable for small sharing, grainy when you look closely.'] },
      { lab: { title: 'ISO noise at 100% zoom', scene: 'candle', lens: 'prime', f: 50, N: 1.8, t: 1 / 60, iso: 1600, sliders: ['iso', 'light'], comp: 'shutter', toggles: ['zoom'], zoom: true, note: 'Switch to 100% zoom and push ISO up. Dark areas break up into coloured speckle first.' } },
      { key: 'The best way to get a clean picture in low light is more light: wider aperture, slower shutter (if the subject is still), a tripod, or a lamp. Use ISO last.' },
      { h: 'Auto ISO' },
      'Auto ISO lets the camera choose ISO inside a limit you set. In shutter or aperture priority it is a good beginner choice.',
      { mission: 'candle' }
    ],
    quiz: [
      { q: 'Does raising ISO make the sensor more sensitive to light?', o: ['Yes, physically', 'It amplifies the signal, including noise', 'It opens the aperture', 'It lengthens the exposure'], a: 1, why: 'The photodiodes collect the same light; ISO amplifies afterwards.' },
      { q: 'You are at 1/60 s, f/1.8, ISO 6400 and still too dark. Best idea?', o: ['Close the aperture', 'Add a light source', 'Lower shutter speed to 1/2000', 'Raise ISO to 100'], a: 1, why: 'More actual light is the cleanest fix.' },
      { q: 'Where does noise show first?', o: ['Bright sky', 'Dark shadows', 'White walls', 'Metal'], a: 1, why: 'Shadows have the least signal to hide it.' }
    ] });
})();
