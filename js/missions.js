/* missions.js: graded challenges. Each mission has required checks (to pass) and bonus checks (one star each). */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const U = FF.ui, h = U.h;
  const M = (FF.missions = {});

  const exposureOK = (a) => { const i = a.issues.find((x) => x.tag === 'Exposure'); return !i || i.level === 'good'; };
  const exposureNotBad = (a) => { const i = a.issues.find((x) => x.tag === 'Exposure'); return !i || i.level !== 'bad'; };
  const ck = (label, ok, detail) => ({ label, ok: !!ok, detail });

  M.list = [
    {
      id: 'freeze', title: 'Freeze the fan', scene: 'fan', skill: 'Shutter speed', lesson: 'shutter', level: 'Beginner',
      brief: 'The fan spins at 800 rpm. Make every blade sharp and keep the picture well exposed.',
      hint: 'Switch to Tv mode and set 1/1000 s or faster. Let Auto ISO raise the sensitivity.',
      setup: { mode: 'Tv', speed: 800, tIdx: true },
      required: (m, a) => [ck('Blades frozen (under 70 px of blur at 100% zoom)', m.subjPx <= 70, 'Blur: ' + m.subjPx.toFixed(0) + ' px'), ck('Not badly over or underexposed', exposureNotBad(a), ''), ck('No camera shake (under 4 px)', m.shakePx <= 4, 'Shake: ' + m.shakePx.toFixed(1) + ' px')],
      bonus: (m, a) => [ck('Razor sharp: under 25 px of blur', m.subjPx <= 25, ''), ck('ISO 3200 or lower', m.iso <= 3200, 'ISO ' + Math.round(m.iso)), ck('Well exposed', exposureOK(a), '')]
    },
    {
      id: 'bokeh', title: 'Creamy background', scene: 'cafe', skill: 'Aperture', lesson: 'aperture', level: 'Beginner',
      brief: 'Photograph the cup with the string lights melted into soft circles. The cup must stay sharp.',
      hint: 'Aperture priority (Av), widest aperture. Mount the 50 mm f/1.8. Step closer to the cup.',
      setup: { mode: 'Av', lens: 'kit', aperture: 'max' },
      required: (m, a) => [ck('Cup in focus', m.defocusPx <= 8, 'Focus error: ' + m.defocusPx.toFixed(1) + ' px'), ck('Background blurred (4% of frame height or more)', m.bgBlurPct >= 4, m.bgBlurPct.toFixed(1) + '%'), ck('Not badly over or underexposed', exposureNotBad(a), '')],
      bonus: (m, a) => [ck('Very soft background (9% or more)', m.bgBlurPct >= 9, m.bgBlurPct.toFixed(1) + '%'), ck('ISO 3200 or lower', m.iso <= 3200, 'ISO ' + Math.round(m.iso)), ck('Well exposed', exposureOK(a), '')]
    },
    {
      id: 'silk', title: 'Silky waterfall', scene: 'water', skill: 'Long exposure', lesson: 'longexp', level: 'Intermediate',
      brief: 'Turn the falling water into smooth silk. The rocks and ferns must stay crisp.',
      hint: 'Tripod on. Manual or Tv with 1 s. ISO 100 and a small aperture (f/11–f/22) stop the picture from overexposing.',
      setup: { mode: 'Tv', stab: 'tripod' },
      required: (m, a) => [ck('Tripod used', m.tripod, ''), ck('Water blurred into silk', m.subjPx >= 250, Math.round(m.subjPx) + ' px of motion'), ck('Not badly over or underexposed', exposureNotBad(a), '')],
      bonus: (m, a) => [ck('Exposure of 1 s or longer', m.t >= 1, ''), ck('ISO 200 or lower', m.iso <= 200, 'ISO ' + Math.round(m.iso)), ck('Well exposed', exposureOK(a), '')]
    },
    {
      id: 'pan', title: 'Pan with the car', scene: 'car', skill: 'Panning', lesson: 'shutter', level: 'Intermediate',
      brief: 'Follow the red car so it stays sharp while the background streaks into speed lines.',
      hint: 'Turn on “Pan with subject” in the Drive tab. Use about 1/30 s in Tv mode.',
      setup: { mode: 'Tv', pan: true },
      required: (m, a) => [ck('Panning on', m.bgPx > 1, ''), ck('Car sharp (under 12 px of blur)', m.subjPx <= 12, Math.round(m.subjPx) + ' px'), ck('Background streaked (100 px or more)', m.bgPx >= 100, Math.round(m.bgPx) + ' px'), ck('Not badly over or underexposed', exposureNotBad(a), '')],
      bonus: (m, a) => [ck('Car very sharp (under 5 px)', m.subjPx <= 5, ''), ck('Strong streaks (300 px or more)', m.bgPx >= 300, Math.round(m.bgPx) + ' px')]
    },
    {
      id: 'candle', title: 'Candlelight, no flash', scene: 'candle', skill: 'Low light', lesson: 'iso', level: 'Intermediate',
      brief: 'Capture the candle hand-held with a sharp, bright picture and flash off.',
      hint: 'The 50 mm f/1.8 gathers about 3 stops more light than the kit lens. Keep the shutter at 1/60 s or faster and let ISO rise. The bright flame fools the meter, so try −1 exposure compensation.',
      setup: { mode: 'Av', lens: 'prime' },
      required: (m, a) => [ck('Flash off', !m.flash, ''), ck('Sharp (under 5 px of shake)', m.shakePx <= 5 || m.tripod, 'Shake: ' + m.shakePx.toFixed(1) + ' px'), ck('Candle in focus', m.defocusPx <= 8, 'Focus error: ' + m.defocusPx.toFixed(1) + ' px'), ck('Not badly over or underexposed', exposureNotBad(a), '')],
      bonus: (m, a) => [ck('ISO 6400 or lower', m.iso <= 6400, 'ISO ' + Math.round(m.iso)), ck('Used f/2.8 or wider', m.N <= 2.85, P_(m.N)), ck('Well exposed', exposureOK(a), '')]
    },
    {
      id: 'backlit', title: 'Rescue the silhouette', scene: 'portrait', skill: 'Metering', lesson: 'metering', level: 'Intermediate',
      brief: 'The sun is behind the subject. Expose for the face, not the sky.',
      hint: 'Try Spot metering on the face (Focus tab or Exposure tab), about +1 exposure compensation, or the built-in flash as fill. Check the histogram.',
      setup: { mode: 'Av', lens: 'prime' },
      required: (m, a) => [ck('Face well exposed (brightness 85–175 of 255)', m.subj >= 85 && m.subj <= 175, 'Face brightness ' + Math.round(m.subj) + ' / 255'), ck('Face in focus', m.defocusPx <= 8, 'Focus error: ' + m.defocusPx.toFixed(1) + ' px'), ck('Sharp (under 5 px of shake)', m.shakePx <= 5, '')],
      bonus: (m, a) => [ck('Sky not mostly blown out (under 25% clipped)', m.clipHi < 0.25, Math.round(m.clipHi * 100) + '% clipped'), ck('ISO 800 or lower', m.iso <= 800, 'ISO ' + Math.round(m.iso))]
    },
    {
      id: 'trails', title: 'Light trails', scene: 'night', skill: 'Tripod and long exposure', lesson: 'longexp', level: 'Advanced',
      brief: 'Turn the passing traffic into ribbons of light. The street furniture must stay sharp.',
      hint: 'Tripod on. Manual mode, ISO 100–400, f/8–f/11 and 8 seconds or longer.',
      setup: { mode: 'M', stab: 'tripod' },
      required: (m, a) => [ck('Tripod used', m.tripod, ''), ck('Exposure of 5 s or longer', m.t >= 5, ''), ck('Light trails (600 px or more)', m.subjPx >= 600, Math.round(m.subjPx) + ' px'), ck('Not badly over or underexposed', exposureNotBad(a), '')],
      bonus: (m, a) => [ck('ISO 400 or lower', m.iso <= 400, 'ISO ' + Math.round(m.iso)), ck('Aperture between f/8 and f/16', m.N >= 7.9 && m.N <= 16.1, P_(m.N)), ck('Well exposed', exposureOK(a), '')]
    }
    ,{
      id: 'deep3d', title: 'Sharp from front to back', scene: 'still3d', skill: 'Depth of field', lesson: 'aperture', level: 'Beginner',
      brief: 'In the 3D still life, keep the teapot sharp and make the distance labels behind it readable too.',
      hint: 'Aperture priority, f/8 or f/11. The shutter will get slow, so use the tripod or let ISO rise.',
      setup: { mode: 'Av', lens: 'prime' },
      required: (m, a) => [ck('Aperture f/8 or smaller', m.N >= 7.9, P_(m.N)), ck('Teapot in focus', m.defocusPx <= 8, 'Focus error: ' + m.defocusPx.toFixed(1) + ' px'), ck('Sharp (under 5 px of shake)', m.shakePx <= 5 || m.tripod, 'Shake: ' + m.shakePx.toFixed(1) + ' px'), ck('Not badly over or underexposed', exposureNotBad(a), '')],
      bonus: (m, a) => [ck('ISO 1600 or lower', m.iso <= 1600, 'ISO ' + Math.round(m.iso)), ck('Not beyond f/16 (diffraction)', m.N <= 16.1, P_(m.N))]
    },
    {
      id: 'pan3d', title: 'Pan with the cyclist', scene: 'cyclist3d', skill: 'Panning', lesson: 'shutter', level: 'Intermediate',
      brief: 'In the 3D street, follow the cyclist so the rider is sharp and the buildings streak.',
      hint: 'Turn on “Pan with subject” in the Drive tab. Tv mode, about 1/30 s.',
      setup: { mode: 'Tv', pan: true },
      required: (m, a) => [ck('Panning on', m.bgPx > 1, ''), ck('Cyclist sharp (under 12 px of blur)', m.subjPx <= 12, Math.round(m.subjPx) + ' px'), ck('Background streaked (100 px or more)', m.bgPx >= 100, Math.round(m.bgPx) + ' px'), ck('Not badly over or underexposed', exposureNotBad(a), '')],
      bonus: (m, a) => [ck('Strong streaks (250 px or more)', m.bgPx >= 250, Math.round(m.bgPx) + ' px'), ck('Well exposed', exposureOK(a), '')]
    }
  ];
  function P_(n) { return FF.phys.fmtAperture(n); }
  M.byId = (id) => M.list.find((m) => m.id === id);
  M.active = U.store.get('activeMission', null);

  M.start = function (id) {
    const m = M.byId(id), C = FF.cam, s = C.state, st = m.setup || {};
    M.active = id; U.store.set('activeMission', id);
    FF.act.dispatch('mission/setup', { scene: m.scene, setup: st }, 'mission');
    location.hash = 'simulator';
    setTimeout(() => {
      if (FF.sim.setMode && st.mode) FF.sim.setMode(st.mode);
      FF.sim.refreshControls && FF.sim.refreshControls(); FF.sim.setKnob && FF.sim.setKnob();
      FF.app.renderMissionBar();
    }, 80);
    U.toast('Mission: ' + m.title);
  };
  M.quit = function () { M.active = null; U.store.set('activeMission', null); FF.app.renderMissionBar(); };

  // Returns a DOM panel or null. Called by the review screen.
  M.evaluate = function (shot) {
    if (!M.active) return null;
    const m = M.byId(M.active); if (!m || shot.plan.state.scene !== m.scene) return h('div', { class: 'callout small' }, 'Active mission: “' + m.title + '” uses the ' + FF.sceneById(m.scene).name + ' scene.');
    const met = shot.analysis.metrics, a = shot.analysis;
    const req = m.required(met, a), bon = m.bonus(met, a);
    const pass = req.every((c) => c.ok), stars = pass ? 1 + bon.filter((c) => c.ok).length : 0;
    shot.mission = { id: m.id, pass, stars };
    let msg = '';
    if (pass) msg = FF.progress.completeMission(m.id, Math.min(3, stars));
    const row = (c, bonus) => h('div', { class: 'issue ' + (c.ok ? 'good' : bonus ? 'info' : 'bad') }, h('span', { class: 'dot' }), h('div', null, h('b', null, (bonus ? 'Bonus: ' : '') + c.label), c.detail ? h('span', { class: 'muted' }, ' · ' + c.detail) : null));
    return h('div', { class: 'card', style: { padding: '12px', borderColor: pass ? 'var(--ok)' : 'var(--line)' } },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { style: { margin: 0 } }, 'Mission: ' + m.title), h('span', { class: 'tag ' + (pass ? 'ok' : 'warn') }, pass ? 'Passed · ' + '★'.repeat(Math.min(3, stars)) + '☆'.repeat(3 - Math.min(3, stars)) : 'Not yet')),
      h('div', { class: 'grid', style: { gap: '5px', marginTop: '8px' } }, req.map((c) => row(c)), bon.map((c) => row(c, true))),
      msg ? h('div', { class: 'small', style: { marginTop: '6px', color: 'var(--ok)' } }, msg) : (pass ? null : h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'Hint: ' + m.hint)));
  };

  /* ---------- progress ---------- */
  const PR = (FF.progress = {});
  const data = Object.assign({ xp: 0, lessons: {}, missions: {}, shots: 0, days: [], quiz: {} }, U.store.get('progress', {}));
  const save = () => U.store.set('progress', data);
  PR.data = data;
  PR.level = () => Math.floor(Math.sqrt(data.xp / 40)) + 1;
  PR.levelFloor = (l) => (l - 1) * (l - 1) * 40;
  PR.names = ['Newcomer', 'Snapshooter', 'Apprentice', 'Hobbyist', 'Enthusiast', 'Skilled', 'Craftsperson', 'Expert', 'Master'];
  PR.title = () => PR.names[Math.min(PR.names.length - 1, PR.level() - 1)];
  PR.streak = () => {
    const days = new Set(data.days); let n = 0; const d = new Date();
    if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    while (days.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  };
  function touchDay() { const k = new Date().toISOString().slice(0, 10); if (!data.days.includes(k)) { data.days.push(k); data.days = data.days.slice(-90); } }
  PR.chip = () => { const el = document.getElementById('xpchip'); if (el) { el.textContent = 'Lv ' + PR.level() + ' · ' + data.xp + ' XP'; el.title = PR.title() + ' · streak ' + PR.streak() + ' day(s)'; } };
  PR.add = (n, why) => {
    const before = PR.level(); data.xp += n; touchDay(); save(); PR.chip();
    if (PR.level() > before) U.toast('Level up! You are now a ' + PR.title() + '.'); else if (why) U.toast('+' + n + ' XP · ' + why);
  };
  PR.onShot = (shot) => { data.shots++; PR.add(2); };
  PR.completeMission = (id, stars) => {
    const prev = data.missions[id] || 0; let msg = '';
    if (stars > prev) { data.missions[id] = stars; PR.add(40 + stars * 15 - (prev ? 40 : 0), ''); msg = prev ? 'New best: ' + stars + ' star(s)! ' : 'Mission complete! +' + (40 + stars * 15) + ' XP. '; save(); if (FF.app && FF.app.refreshMissionPage) FF.app.refreshMissionPage(); }
    else msg = 'Passed again (best is ' + prev + ' star' + (prev > 1 ? 's' : '') + ').';
    return msg;
  };
  PR.completeLesson = (id, score) => { if (!data.lessons[id]) { data.lessons[id] = 1; PR.add(25, 'Lesson complete'); } if (score != null) { data.quiz[id] = Math.max(data.quiz[id] || 0, score); save(); } };
  PR.reset = () => { Object.assign(data, { xp: 0, lessons: {}, missions: {}, shots: 0, days: [], quiz: {} }); save(); PR.chip(); };

  /* ---------- missions page ---------- */
  M.renderPage = function (root) {
    const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
    const total = M.list.reduce((a, m) => a + (data.missions[m.id] || 0), 0);
    root.replaceChildren(
      h('div', { class: 'page-head' }, h('h1', null, 'Missions'), h('p', { class: 'lead' }, 'Nine short challenges. Each one drops you into a scene with a goal. Take a photo and the camera checks the result with the same numbers the analyzer uses: blur in pixels, exposure, noise, shake.'), h('div', { class: 'tag' }, total + ' / ' + M.list.length * 3 + ' stars')),
      h('div', { class: 'cards' }, M.list.map((m) => {
        const best = data.missions[m.id] || 0, sc = FF.sceneById(m.scene);
        return h('article', { class: 'card mission' + (M.active === m.id ? ' on' : '') },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'tag' }, m.level), h('span', { class: 'stars', 'aria-label': best + ' of 3 stars' }, stars(best))),
          h('h3', null, m.title), h('p', null, m.brief),
          h('div', { class: 'small muted' }, 'Scene: ' + sc.name + ' · Skill: ' + m.skill),
          h('details', null, h('summary', null, 'Need a hint?'), h('p', { class: 'small' }, m.hint)),
          h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => M.start(m.id) }, best ? 'Try again' : 'Start mission'), m.lesson ? h('a', { class: 'btn', href: '#lesson-' + m.lesson }, 'Read the lesson') : null));
      })));
  };
})();
