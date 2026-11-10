/* types3d.js: 3D cutaways of the main kinds of camera, with the light path animated. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const U = FF.ui, h = U.h;
  const Y = (FF.types3d = { built: false });
  const TYPES = [
    { id: 'mirrorless', name: 'Mirrorless', ex: 'Canon EOS R100, Sony a6100, Nikon Z50, Fujifilm X-T30',
      how: 'Light goes straight through the lens onto the sensor, all the time. The sensor feeds a live picture to the rear screen and to a tiny screen in the viewfinder. Press the shutter and the sensor records the frame.',
      pros: ['What you see is what you get: exposure and colour are previewed', 'Small and light, with few moving parts', 'Autofocus works across the whole frame, with face and eye detection', 'Where all new lenses and cameras are being made'], cons: ['Uses the battery faster, because a screen is always on', 'The viewfinder is a screen, which some people dislike in very dim light'], best: 'Almost everyone starting today.' },
    { id: 'dslr', name: 'DSLR', ex: 'Canon EOS Rebel T7 / 2000D, Nikon D3500, Pentax K-70',
      how: 'A mirror sits in front of the sensor and reflects the light up into a prism and out through the viewfinder, so you look through the lens itself. Press the shutter: the mirror flips up, the viewfinder goes black, the shutter opens and the sensor is exposed. Then the mirror drops back.',
      pros: ['Optical viewfinder with no delay', 'Long battery life', 'Huge choice of cheap second-hand lenses'], cons: ['Bigger and heavier', 'The viewfinder does not show the exposure you will get', 'Mirror slap adds noise and vibration', 'Makers have largely stopped developing them'], best: 'Bargain hunters buying used.' },
    { id: 'compact', name: 'Compact', ex: 'Sony RX100 series, Canon PowerShot G7 X, Ricoh GR',
      how: 'A mirrorless camera shrunk down, with a lens that is built in and cannot be changed. The lens usually retracts into the body. Most have a smaller sensor and are framed on the rear screen.',
      pros: ['Fits in a pocket', 'One sealed unit: no dust on the sensor', 'Often a long zoom range'], cons: ['Smaller sensor: more noise, less background blur', 'You cannot change the lens', 'Fewer physical controls'], best: 'Travel and everyday carry.' },
    { id: 'phone', name: 'Smartphone', ex: 'Any modern phone',
      how: 'Several tiny camera modules, each with a fixed lens of a few millimetres and a very small sensor. There is no mechanical shutter or adjustable aperture. The phone takes a burst of frames and merges them with software to cut noise, widen dynamic range and fake background blur.',
      pros: ['Always with you', 'Software makes hard scenes easy', 'Instant sharing'], cons: ['Tiny sensor and lens: limited real background blur and reach', 'The software decides the look for you', 'Poor at fast action and long telephoto'], best: 'Snapshots, and learning composition.' },
    { id: 'film', name: 'Film SLR', ex: 'Canon AE-1, Pentax K1000, Nikon FM2',
      how: 'Works like a DSLR, but the light lands on a strip of light-sensitive film. Each frame is used once; a lever winds the next piece of film into place. ISO is fixed by the film you loaded.',
      pros: ['A distinctive look', 'Every frame costs money, so you slow down and think', 'Fully mechanical models need no battery'], cons: ['No preview and no histogram', 'Film and developing are costly', 'ISO cannot change mid-roll'], best: 'Learning discipline, and the fun of it.' }
  ];
  let T3, renderer, scene, cam, canvas, model, parts = {}, photons = [], path = [], labels = [], labelLayer, raf = 0, running = false, orbit = { th: -0.75, ph: 1.25, r: 30 }, cur = TYPES[0], mirror = 0, mirrorT = 0, firing = -1, detail, last = 0, stageEl;

  const mat = (c, o) => new T3.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6 }, o || {}));
  function add(geo, m, pos, rot, par) { const x = new T3.Mesh(geo, m); x.position.set(...pos); if (rot) x.rotation.set(...rot); (par || model).add(x); return x; }
  function lab(text, pos) { const b = h('div', { class: 't3-label' }, text); labelLayer.append(b); labels.push({ b, p: new T3.Vector3(...pos) }); }

  function build(t) {
    if (model) scene.remove(model); model = new T3.Group(); scene.add(model); photons = []; labels = []; labelLayer.replaceChildren(); parts = {}; mirror = 0; mirrorT = 0; firing = -1;
    const shell = mat(0x7d8793, { transparent: true, opacity: 0.2, depthWrite: false }), glass = mat(0x8fc1ff, { transparent: true, opacity: 0.45, roughness: 0.05 }), dark = mat(0x23272c), X = Math.PI / 2;
    const lens = (z0, len, r, n) => { add(new T3.CylinderGeometry(r, r, len, 40, 1, true), mat(0x30353b, { transparent: true, opacity: 0.35, side: T3.DoubleSide, depthWrite: false }), [0, 0, z0 + len / 2], [X, 0, 0]); for (let i = 0; i < n; i++) add(new T3.CylinderGeometry(r * (0.7 + 0.2 * (i % 2)), r * (0.7 + 0.2 * (i % 2)), 0.25, 32), glass, [0, 0, z0 + 0.5 + i * (len - 1) / Math.max(1, n - 1)], [X, 0, 0]); };
    const sensor = (z, w, hh, film) => { parts.sensor = add(new T3.BoxGeometry(w, hh, 0.12), mat(film ? 0x7a4a2a : 0x2f7aa8, { metalness: 0.6, roughness: 0.25 }), [0, 0, z]); };
    if (t.id === 'mirrorless') {
      add(new T3.BoxGeometry(11.5, 6.6, 3.6), shell, [-0.9, 0, -0.4]); add(new T3.BoxGeometry(3.4, 2, 3), shell, [0, 4.2, -0.6]); lens(1.5, 5, 2.6, 4); sensor(0, 2.3, 1.5);
      parts.curtain = add(new T3.BoxGeometry(2.6, 1.8, 0.05), dark, [0, 1.9, 0.5]);
      add(new T3.BoxGeometry(0.9, 0.7, 0.1), mat(0x9fe3ff, { emissive: 0x2a6f8f }), [0, 4.0, -1.0]); add(new T3.CylinderGeometry(0.55, 0.55, 0.3, 24), glass, [0, 4.0, -1.8], [X, 0, 0]);
      add(new T3.BoxGeometry(6.2, 4.2, 0.12), mat(0x9fe3ff, { emissive: 0x1d5068 }), [-1.2, -0.4, -2.2]); add(new T3.BoxGeometry(1.4, 1.4, 0.2), mat(0x3a3f46, { metalness: 0.6 }), [-3.2, 0.4, -1.0]);
      path = [[[0, 0.6, 13], [0, 0.2, 6.4], [0, 0, 0.1]]];
      wire([[0, 0, -0.1], [-3.2, 0.4, -1.0], [0, 4.0, -1.05]]); wire([[-3.2, 0.4, -1.0], [-1.2, -0.4, -2.15]]);
      lab('Lens', [0, 3, 4]); lab('Sensor (always exposed to light)', [0, -1.2, 0]); lab('Processor', [-3.2, 1.6, -1]); lab('Electronic viewfinder: a tiny screen', [0, 5.6, -1]); lab('Rear screen', [-1.2, -3, -2.2]); lab('Shutter', [1.8, 2.2, 0.5]);
    } else if (t.id === 'dslr' || t.id === 'film') {
      add(new T3.BoxGeometry(13, 8.2, 5.4), shell, [-1, 0, -1.6]); lens(2.2, 5.5, 2.8, 4); sensor(-3.6, t.id === 'film' ? 3.6 : 2.3, t.id === 'film' ? 2.4 : 1.5, t.id === 'film');
      const pivot = new T3.Group(); pivot.position.set(0, 1.55, -2.55); model.add(pivot); parts.mirror = pivot; add(new T3.BoxGeometry(3.3, 0.08, 4.3), mat(0xdfe6ee, { metalness: 1, roughness: 0.08 }), [0, 0, 2.15], null, pivot); pivot.rotation.x = Math.PI / 4;
      add(new T3.BoxGeometry(3.3, 0.1, 3), mat(0xf2f2e8, { transparent: true, opacity: 0.6 }), [0, 1.9, -1.0]);
      const sh = new T3.Shape(); sh.moveTo(-1.6, 0); sh.lineTo(1.6, 0); sh.lineTo(1.9, 1.3); sh.lineTo(0.3, 2.6); sh.lineTo(-1.5, 1.6); sh.closePath(); const pg = new T3.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false }); pg.translate(0, 0, -1.5);
      add(pg, glass, [0, 2.05, -1.0], [0, -X, 0]); add(new T3.CylinderGeometry(0.6, 0.6, 0.4, 24), glass, [0, 3.3, -4.2], [X, 0, 0]);
      parts.curtain = add(new T3.BoxGeometry(3.7, 2.5, 0.05), dark, [0, 0, -3.3]);
      if (t.id === 'film') { [-3.4, 3.4].forEach((x) => add(new T3.CylinderGeometry(1.1, 1.1, 2.6, 24), mat(0x40342a), [x, 0, -3.3])); add(new T3.BoxGeometry(6.8, 2.4, 0.04), mat(0x5e3b22), [0, 0, -3.72]); lab('Film: each frame is exposed once', [3.4, -2.2, -3.4]); }
      path = [[[0, 0.6, 15], [0, 0.2, 7.6], [0, 0, -0.5], [0, 1.9, -0.9], [0, 3.6, -0.4], [0, 3.3, -2.2], [0, 3.3, -6.5]]];
      Y.pathFire = [[[0, 0.6, 15], [0, 0.2, 7.6], [0, 0, -3.5]]];
      lab('Lens', [0, 3.2, 5]); lab('Mirror (flips up for the photo)', [2.4, -0.6, -0.6]); lab('Focusing screen', [-2.6, 1.9, -1]); lab('Pentaprism', [0, 5, -1]); lab('Optical viewfinder → your eye', [0, 3.3, -6.5]); lab(t.id === 'film' ? 'Shutter, with film behind it' : 'Shutter and sensor', [0, -2, -3.5]);
    } else if (t.id === 'compact') {
      add(new T3.BoxGeometry(10, 5.8, 2.8), shell, [-0.8, 0, -0.6]); lens(0.8, 3.2, 1.9, 5); sensor(0.2, 1.32, 0.88); add(new T3.BoxGeometry(6.6, 4.4, 0.12), mat(0x9fe3ff, { emissive: 0x1d5068 }), [-0.8, 0, -2.0]);
      path = [[[0, 0.4, 11], [0, 0.15, 4], [0, 0, 0.3]]]; wire([[0, 0, 0.1], [-0.8, 0, -1.95]]);
      lab('Built-in zoom lens (retracts)', [0, 2.6, 2.4]); lab('1-inch sensor: about a third the area of APS-C', [0, -1.4, 0.2]); lab('Rear screen', [-0.8, -3, -2]);
    } else {
      add(new T3.BoxGeometry(7.2, 15, 0.85), shell, [0, 0, -0.4]); add(new T3.BoxGeometry(6.8, 14.4, 0.06), mat(0x9fe3ff, { emissive: 0x1d5068 }), [0, 0, -0.86]);
      [[-1.8, 5.2], [-1.8, 3.4], [-0.2, 4.3]].forEach((p, i) => { add(new T3.CylinderGeometry(0.55, 0.55, 0.5, 24), glass, [p[0], p[1], 0.05], [X, 0, 0]); add(new T3.BoxGeometry(0.7, 0.55, 0.06), mat(0x2f7aa8, { metalness: 0.6 }), [p[0], p[1], -0.45]); });
      add(new T3.BoxGeometry(1.6, 1.6, 0.12), mat(0x3a3f46, { metalness: 0.6 }), [1.4, 1, -0.4]);
      path = [[[-1.8, 5.6, 9], [-1.8, 5.2, 0.3], [-1.8, 5.2, -0.42]]]; wire([[-1.8, 5.2, -0.45], [1.4, 1, -0.4]]);
      lab('Tiny fixed lenses, one per camera', [-1.8, 6.6, 0.4]); lab('Very small sensors', [-3.6, 4.3, -0.4]); lab('Chip that merges many frames into one photo', [1.4, -0.4, -0.4]); lab('Screen', [0, -5, -0.9]);
    }
    for (let i = 0; i < 9; i++) { const s = new T3.Mesh(new T3.SphereGeometry(0.2, 10, 8), new T3.MeshBasicMaterial({ color: 0xffc94d })); model.add(s); photons.push({ s, o: i / 9 }); }
    if (t.id !== 'dslr' && t.id !== 'film') Y.pathFire = null;
    place();
  }
  function wire(pts) { const g = new T3.BufferGeometry().setFromPoints(pts.map((p) => new T3.Vector3(...p))); model.add(new T3.Line(g, new T3.LineBasicMaterial({ color: 0x3cc79a }))); }
  function along(pp, k) { const segs = []; let tot = 0; for (let i = 1; i < pp.length; i++) { const d = Math.hypot(pp[i][0] - pp[i - 1][0], pp[i][1] - pp[i - 1][1], pp[i][2] - pp[i - 1][2]); segs.push(d); tot += d; } let d = k * tot; for (let i = 0; i < segs.length; i++) { if (d <= segs[i]) { const u = d / segs[i]; return pp[i].map((v, j) => v + (pp[i + 1][j] - v) * u); } d -= segs[i]; } return pp[pp.length - 1]; }
  function place() { const sp = Math.sin(orbit.ph); cam.position.set(orbit.r * sp * Math.sin(orbit.th), 1 + orbit.r * Math.cos(orbit.ph), orbit.r * sp * Math.cos(orbit.th)); cam.lookAt(0, 0.8, 0.5); }
  function frame(ts) {
    raf = running ? requestAnimationFrame(frame) : 0; const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (firing >= 0) { firing += dt / 1.6; mirrorT = firing < 0.75 ? 1 : 0; if (parts.curtain) parts.curtain.visible = !(firing > 0.25 && firing < 0.6); if (firing >= 1) { firing = -1; if (parts.curtain) parts.curtain.visible = true; } }
    mirror += (mirrorT - mirror) * Math.min(1, dt * 12); if (parts.mirror) parts.mirror.rotation.x = Math.PI / 4 - mirror * (Math.PI / 4 - 0.03);
    const pp = (Y.pathFire && mirror > 0.5) ? Y.pathFire[0] : path[0];
    photons.forEach((p) => { if (!reduce) p.o = (p.o + dt * 0.22) % 1; const q = along(pp, p.o); p.s.position.set(q[0], q[1], q[2]); });
    if (parts.sensor) parts.sensor.material.emissive.setHex(firing > 0.25 && firing < 0.6 ? 0x66ccff : (cur.id === 'mirrorless' || cur.id === 'compact' ? 0x0b2a3a : 0));
    renderer.render(scene, cam);
    const w = canvas.clientWidth, hh = canvas.clientHeight, v = new T3.Vector3();
    labels.forEach((l) => { v.copy(l.p).project(cam); l.b.style.transform = `translate(-50%,-50%) translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * hh).toFixed(1)}px)`; });
  }
  function resize() { const w = stageEl.clientWidth; if (!w) return; const hh = Math.max(280, Math.min(w * 0.66, window.innerHeight * 0.62)); renderer.setSize(w, hh, false); canvas.style.width = w + 'px'; canvas.style.height = hh + 'px'; cam.aspect = w / hh; cam.updateProjectionMatrix(); }
  function showDetail() {
    const t = cur;
    detail.replaceChildren(h('span', { class: 'tag' }, 'Examples: ' + t.ex), h('h3', null, t.name), h('p', null, t.how),
      h('div', { class: 'two' }, h('div', null, h('h4', null, 'Good'), h('ul', null, t.pros.map((x) => h('li', null, x)))), h('div', null, h('h4', null, 'Less good'), h('ul', null, t.cons.map((x) => h('li', null, x))))),
      h('p', null, h('b', null, 'Best for: '), t.best), h('button', { class: 'btn primary', type: 'button', onclick: () => { firing = 0; } }, 'Press the shutter and watch'));
  }
  Y.mount = function (root) {
    if (Y.built) { Y.start(); return; }
    Y.built = true;
    stageEl = h('div', { class: 'c3d-stage' }, h('div', { class: 'c3d-loading' }, 'Loading…')); labelLayer = h('div', { class: 'c3d-hot' }); detail = h('div', { class: 'card' });
    const seg = U.seg(TYPES.map((t) => ({ v: t.id, label: t.name })), cur.id, (v) => { cur = TYPES.find((t) => t.id === v); if (T3) build(cur); showDetail(); });
    const table = h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, ['', 'Mirrorless', 'DSLR', 'Compact', 'Smartphone', 'Film SLR'].map((c) => h('th', null, c)))), h('tbody', null, [
      ['Viewfinder', 'Electronic', 'Optical, through the lens', 'Usually none', 'None', 'Optical, through the lens'], ['Change lenses', 'Yes', 'Yes', 'No', 'No', 'Yes'], ['Typical sensor', 'APS-C or full frame', 'APS-C or full frame', '1-inch or smaller', 'Very small', '35 mm film'],
      ['Size', 'Small to medium', 'Medium to large', 'Pocket', 'Pocket', 'Medium'], ['Preview of exposure', 'Yes', 'Only on the rear screen', 'Yes', 'Yes', 'No'], ['Moving parts', 'Shutter only', 'Mirror and shutter', 'Lens and shutter', 'Almost none', 'Mirror, shutter, film advance']
    ].map((r) => h('tr', null, r.map((c, i) => h(i ? 'td' : 'th', i ? null : { scope: 'row' }, c)))))));
    root.replaceChildren(h('p', { class: 'small muted' }, 'Pick a type. The yellow dots are light travelling through the camera. Drag to rotate.'), seg, h('div', { class: 'c3d-grid' }, h('div', { class: 'c3d-left' }, stageEl), h('div', { class: 'c3d-right' }, detail)), h('h3', { class: 'c3d-h' }, 'Side by side'), table);
    showDetail();
    FF.loadThree().then((t3) => {
      T3 = t3; canvas = h('canvas', { class: 'c3d-canvas', tabindex: 0, 'aria-label': '3D cutaway of the selected camera type. Drag to rotate.' }); stageEl.replaceChildren(canvas, labelLayer);
      renderer = new T3.WebGLRenderer({ canvas, antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); scene = new T3.Scene(); cam = new T3.PerspectiveCamera(32, 1.5, 0.5, 300);
      scene.add(new T3.HemisphereLight(0xffffff, 0x556070, 1.8)); const d = new T3.DirectionalLight(0xffffff, 2); d.position.set(6, 12, 10); scene.add(d);
      let dn = null; canvas.addEventListener('pointerdown', (e) => { dn = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', (e) => { if (!dn) return; orbit.th -= (e.clientX - dn[0]) * 0.008; orbit.ph = Math.max(0.2, Math.min(2.9, orbit.ph - (e.clientY - dn[1]) * 0.008)); dn = [e.clientX, e.clientY]; place(); });
      const end = () => { dn = null; }; canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
      canvas.addEventListener('wheel', (e) => { e.preventDefault(); orbit.r = Math.max(14, Math.min(60, orbit.r * (1 + Math.sign(e.deltaY) * 0.1))); place(); }, { passive: false });
      canvas.addEventListener('keydown', (e) => { const k = { ArrowLeft: 0.15, ArrowRight: -0.15 }[e.key]; if (k) { orbit.th += k; place(); e.preventDefault(); } });
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stageEl);
      build(cur); resize(); Y.start();
    }).catch((e) => stageEl.replaceChildren(h('div', { class: 'callout warn' }, 'The 3D view could not start: ' + e.message)));
  };
  Y.start = function () { if (!renderer || running) return; running = true; resize(); raf = requestAnimationFrame(frame); };
  Y.stop = function () { running = false; cancelAnimationFrame(raf); };
})();
