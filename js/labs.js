/* labs.js: small live experiments built on the same renderer as the simulator. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const P = FF.phys, U = FF.ui, h = U.h;

  /* opts: scene, lens, f, N, t, iso, subjD, speed, light, cct, wbK, tripod, is, comp ('iso'|'shutter'|'aperture'|null),
     sliders: [keys], width, height, t0, title, note */
  FF.lab = function (o) {
    const sc = FF.sceneById(o.scene), lens = FF.lensById(o.lens || sc.start.lens);
    const st = Object.assign({ f: sc.start.f, N: lens.at(sc.start.f, lens.maxAp), t: 1 / 250, iso: 400, subjD: sc.subj.def, speed: sc.speed ? sc.speed.def : 0, light: 0, cct: sc.cct, wbK: 5200, tripod: false, is: true, comp: null, focus: null, t0: 3, zoom: false }, o);
    st.cct = o.cct || sc.cct;
    const W = o.width || 540, H = Math.round(W * 2 / 3);
    const cv = h('canvas', { width: W, height: H, 'aria-label': (o.title || 'Experiment') + ' preview' });
    const read = h('div', { class: 'exif' });
    const wrap = h('div', { class: 'lab card' });
    const sliders = h('div', { class: 'lab-sl' });
    const note = h('div', { class: 'small muted lab-note' });
    let EVm = 10, token = 0, timer = 0;

    const range = () => P.apertureRange(lens, st.f);
    const meter = () => {
      const cfg = { scene: o.scene, lens: lens.id, f: st.f, N: st.N, focusM: st.subjD, t0: st.t0, T: 0, subjD: st.subjD, speed: st.speed, evOffset: st.light, cct: st.cct };
      const m = FF.Renderer.meter(FF.buildParams(cfg));
      EVm = sc.ev + st.light + Math.log2(P.meterReading(m.lum, 'evaluative', m.gx, m.gy, { x: 0.5, y: 0.5 }));
    };
    function settle() {
      let { N, t, iso } = st;
      const [aLo, aHi] = range(); N = P.apertureValue(Math.min(aHi, Math.max(aLo, P.apertureIndex(N))));
      const EVt = EVm;
      if (st.comp === 'iso') iso = P.isoValue(Math.min(P.ISO_N - 1, Math.max(0, P.isoIndex(P.solveISO(EVt, N, t)))));
      else if (st.comp === 'shutter') t = P.shutterValue(Math.min(P.SHUTTER_N - 1, Math.max(0, P.shutterIndex(P.solveShutter(EVt, N, iso)))));
      else if (st.comp === 'aperture') N = P.apertureValue(Math.min(aHi, Math.max(aLo, P.apertureIndex(P.solveAperture(EVt, t, iso)))));
      return { N, t, iso };
    }
    async function draw() {
      const my = ++token;
      meter();
      const e = settle(); e.ind = P.indicator(EVm, e.N, e.t, e.iso);
      const focus = st.focus || st.subjD;
      const rnd = P.mulberry(11);
      const shake = st.tripod ? FF.ZERO_SHAKE : P.makeShake(rnd, st.is && lens.isStops ? Math.pow(2, -0.8 * lens.isStops) : 1, 0.65);
      const cfg = { scene: o.scene, lens: lens.id, f: st.f, N: e.N, focusM: focus, t0: st.t0, T: e.t, subjD: st.subjD, speed: st.speed, evOffset: st.light, cct: st.cct, shake, panRate: st.pan ? st.speed / st.subjD : 0 };
      const plan = { cfg, disp: { iso: e.iso, M: st.zoom ? 1 : 8, nr: 0.75, wbK: st.wbK, style: [0.25, 1.1], corr: true, seed: 5 }, seed: 5 };
      const win = st.zoom ? FF.cropWindow(W, H, 0.5, 0.5) : FF.fullWindow();
      const out = await C_develop(plan, W, H, win, st.zoom ? 1 : 8);
      if (my !== token) return;
      cv.getContext('2d').drawImage(out, 0, 0);
      read.replaceChildren(
        h('div', null, h('small', null, 'SHUTTER'), P.fmtShutter(e.t)), h('div', null, h('small', null, 'APERTURE'), P.fmtAperture(e.N)), h('div', null, h('small', null, 'ISO'), Math.round(e.iso)),
        h('div', { style: { color: Math.abs(e.ind) > 1 ? '#ff7468' : '#3cc79a' } }, h('small', null, 'EXPOSURE'), U.fmt.ev(e.ind) + ' EV'));
      st._e = e;
      if (o.onDraw) o.onDraw(e, st);
    }
    function C_develop(plan, w, hh, win, M) {
      const q = FF.labQ = FF.labQ || { ns: 48, passes: 4 }; const t0 = performance.now();
      return Promise.resolve(FF.cam.develop(plan, { w, h: hh, win, passes: q.passes, ns: q.ns, M, sync: true })).then((r) => { const ms = performance.now() - t0; if (ms > 1800 && q.ns > 8) q.ns = Math.max(8, q.ns >> 1); return r; });
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(draw, 90); };

    const defs = {
      t: () => ({ label: 'Shutter speed', min: 0, max: P.SHUTTER_N - 1, step: 1, get: () => P.shutterIndex(st._e ? st._e.t : st.t), set: (v) => (st.t = P.shutterValue(v)), fmt: (v) => P.fmtShutterIdx(v) + (v < 31 ? ' s' : ''), off: st.comp === 'shutter' }),
      N: () => ({ label: 'Aperture', min: range()[0], max: range()[1], step: 1, get: () => P.apertureIndex(st._e ? st._e.N : st.N), set: (v) => (st.N = P.apertureValue(v)), fmt: (v) => 'f/' + P.APERTURE_LABELS[v], off: st.comp === 'aperture' }),
      iso: () => ({ label: 'ISO', min: 0, max: P.ISO_N - 1, step: 1, get: () => P.isoIndex(st._e ? st._e.iso : st.iso), set: (v) => (st.iso = P.isoValue(v)), fmt: (v) => P.ISO_LABELS[v], off: st.comp === 'iso' }),
      f: () => ({ label: 'Focal length', min: lens.fmin, max: lens.fmax, step: 1, get: () => st.f, set: (v) => { st.f = v; }, fmt: (v) => v + ' mm (' + Math.round(v * 1.6) + ' equiv.)' }),
      subjD: () => ({ label: 'Distance to subject', min: sc.subj.min, max: sc.subj.max, step: 0.05, get: () => st.subjD, set: (v) => { st.subjD = v; }, fmt: (v) => U.fmt.dist(v) }),
      wbK: () => ({ label: 'White balance', min: 2500, max: 10000, step: 100, get: () => st.wbK, set: (v) => { st.wbK = v; }, fmt: (v) => v + ' K' }),
      light: () => ({ label: 'Light level', min: -4, max: 3, step: 0.5, get: () => st.light, set: (v) => { st.light = v; }, fmt: (v) => U.fmt.ev(v) + ' EV' }),
      cct: () => ({ label: 'Light colour', min: 2000, max: 9000, step: 100, get: () => st.cct, set: (v) => { st.cct = v; }, fmt: (v) => v + ' K' }),
      speed: () => ({ label: sc.speed ? sc.speed.label : 'Speed', min: sc.speed.min, max: sc.speed.max, step: sc.speed.step, get: () => st.speed, set: (v) => { st.speed = v; }, fmt: (v) => v + ' ' + sc.speed.unit })
    };
    const makers = {};
    (o.sliders || []).forEach((k) => {
      const d = defs[k](); const inp = U.range(d.min, d.max, d.step, d.get(), () => {}); const val = h('span', { class: 'mono' });
      const upd = () => { const dd = defs[k](); inp.min = dd.min; inp.max = dd.max; val.textContent = dd.fmt(+inp.value); };
      inp.oninput = () => { defs[k]().set(+inp.value); upd(); schedule(); };
      makers[k] = { inp, upd, d: () => defs[k]() };
      sliders.append(h('label', { class: 'lab-row' }, h('span', { class: 'lab-name' }, d.label), inp, val));
      upd();
    });
    function syncSliders() { Object.keys(makers).forEach((k) => { const m = makers[k], d = m.d(); m.inp.disabled = !!d.off; if (st._e) { m.inp.value = d.get(); } m.upd(); }); }
    const toggles = h('div', { class: 'row' });
    if (o.toggles) o.toggles.forEach((tg) => {
      if (tg === 'zoom') toggles.append(U.toggle('View at 100% (pixel level)', st.zoom, (v) => { st.zoom = v; draw(); }));
      if (tg === 'tripod') toggles.append(U.toggle('Tripod', st.tripod, (v) => { st.tripod = v; draw(); }));
      if (tg === 'pan') toggles.append(U.toggle('Pan with the subject', !!st.pan, (v) => { st.pan = v; draw(); }));
      if (tg === 'comp') toggles.append(U.toggle('Keep exposure constant', !!st.comp, (v) => { st.comp = v ? o.comp : null; syncSliders(); draw(); }));
    });
    const origDraw = draw;
    draw = async function () { await origDraw(); syncSliders(); };
    wrap.append(o.title ? h('h4', null, o.title) : null, h('div', { class: 'lab-view' }, cv), read, sliders, toggles, o.note ? h('div', { class: 'small muted' }, o.note) : null);
    wrap.draw = draw; wrap.state = st;
    // render when it scrolls into view the first time
    const run = () => { if (FF.Renderer.ok) draw(); };
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) { io.disconnect(); run(); } }, { rootMargin: '200px' }); io.observe(wrap); } else run();
    return wrap;
  };
})();
