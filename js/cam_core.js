/* cam_core.js: camera state, exposure modes, metering, autofocus. No DOM. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const P = FF.phys;
  const C = (FF.cam = {});
  const listeners = [];
  C.on = (fn) => listeners.push(fn);
  C.emit = (what) => listeners.forEach((fn) => fn(what));

  C.defaults = () => ({
    mode: 'Av', scn: 'portrait',
    lens: 'kit', f: 30,
    aIdx: P.apertureIndex(5.6), tIdx: P.shutterIndex(1 / 125), isoIdx: 0, isoAuto: true, isoMaxIdx: P.isoIndex(6400),
    ec: 0, meter: 'evaluative', aeLock: null,
    afMode: 'oneshot', afArea: '1pt', face: true, af: { x: 0.5, y: 0.5 }, mfDist: 2,
    focusDist: 2, focusTarget: 2, afState: 'idle', afNote: '',
    wb: 'awb', wbK: 5200, style: 'std', corr: true, nr: 'std',
    drive: 'single', flash: 'off', stab: 'hand', is: true, pop: false,
    scene: 'fan', light: 0, cctOn: false, cct: 5600, subjD: 1.8, speed: 1500, paused: false,
    aim: [0, 0], pos: [0, 0], pan: false, peek: false
  });
  C.state = C.defaults();
  C.simT = 20;
  C.meterMap = null;
  C.meterInfo = { EVm: 10, L: 1, region: 'evaluative', locked: false };
  C.eff = { N: 5.6, t: 1 / 125, iso: 100, flashOn: false, flashP: 0, notes: [] };

  const S = () => C.state;
  C.scene = () => FF.sceneById(S().scene);
  C.lens = () => FF.lensById(S().lens);
  C.fEq = () => S().f * P.SENSOR.crop;
  C.sceneEV = () => C.scene().ev + S().light;
  C.sceneCCT = () => (S().cctOn ? S().cct : C.scene().cct);

  /* ----- scene / lens changes ----- */
  C.setScene = function (id, opts) {
    const sc = FF.sceneById(id), s = S();
    s.scene = id; s.subjD = sc.subj.def; s.speed = sc.speed ? sc.speed.def : 0; s.light = 0; s.cctOn = false; s.cct = sc.cct;
    s.aim = [0, 0]; s.pos = [0, 0]; s.pan = false; s.aeLock = null; s.af = { x: 0.5, y: 0.5 };
    if (!opts || !opts.keepLens) { C.setLens(sc.start.lens, sc.start.f); }
    s.focusDist = s.focusTarget = sc.subj.def; s.afState = 'idle';
    C.refreshMeter(true); C.afPress(true);
    C.emit('scene');
  };
  C.setLens = function (id, f) {
    const s = S(), l = FF.lensById(id);
    s.lens = id; s.f = Math.min(l.fmax, Math.max(l.fmin, f || l.fmin));
    C.clampAperture();
    s.mfDist = Math.max(s.mfDist, l.mfd(s.f));
    C.emit('lens');
  };
  C.setFocal = (f) => { const l = C.lens(); S().f = Math.min(l.fmax, Math.max(l.fmin, Math.round(f))); C.clampAperture(); C.emit('lens'); };
  C.apRange = () => P.apertureRange(C.lens(), S().f);
  C.clampAperture = function () { const r = C.apRange(), s = S(); s.aIdx = Math.min(r[1], Math.max(r[0], s.aIdx)); };

  /* ----- exposure solving ----- */
  C.tSafe = () => 1 / Math.max(30, C.fEq());                       // slowest comfortable hand-held shutter speed
  C.autoList = () => {
    const s = S(); const m = FF.MODES.find((x) => x.id === s.mode);
    return m ? m.auto : [];
  };
  C.isoAutoNow = () => { const s = S(); return s.mode === 'A+' || s.mode === 'SCN' || s.isoAuto; };

  // Core solver: given the metered EV (reflected, ISO 100) returns the effective settings.
  C.solve = function (EVm) {
    const s = S(), lens = C.lens(), [aLo, aHi] = C.apRange();
    const Nmax = P.apertureValue(aLo), Nmin = P.apertureValue(aHi);
    const isoMax = P.isoValue(s.isoMaxIdx), isoAuto = C.isoAutoNow();
    const sceneFlash = s.flash === 'on' || (s.flash === 'auto' && s.mode === 'A+');
    const ec = (s.mode === 'A+' || s.mode === 'SCN') ? 0 : s.ec / 3;
    const EVt = EVm - ec;
    const tSafe = s.stab === 'tripod' ? 1 / 30 : C.tSafe();
    let N, t, iso = isoAuto ? 100 : P.isoValue(s.isoIdx);
    const notes = [];
    const clampN = (n) => Math.min(Nmin, Math.max(Nmax, n));
    const fixedIso = !isoAuto;
    const raiseIso = (Nf, tf) => Math.min(isoMax, Math.max(100, P.solveISO(EVt, Nf, tf)));
    let mode = s.mode, tv = null, av = null;
    if (mode === 'SCN') {
      if (s.scn === 'portrait') { mode = 'Av'; av = Nmax; }
      else if (s.scn === 'landscape') { mode = 'Av'; av = clampN(8); }
      else { mode = 'Tv'; tv = 1 / 1000; }
    }
    if (mode === 'Av') {
      N = av != null ? av : P.apertureValue(s.aIdx);
      iso = fixedIso ? iso : 100;
      t = P.solveShutter(EVt, N, iso);
      if (isoAuto && t > tSafe) { iso = raiseIso(N, tSafe); t = P.solveShutter(EVt, N, iso); }
    } else if (mode === 'Tv') {
      t = tv != null ? tv : P.shutterValue(s.tIdx);
      iso = fixedIso ? iso : 100;
      N = P.solveAperture(EVt, t, iso);
      if (isoAuto) {
        if (N < Nmax) { N = Nmax; iso = raiseIso(N, t); } else if (N > Nmin) { N = Nmin; iso = 100; }
      } else N = clampN(N);
    } else if (mode === 'M') {
      N = P.apertureValue(s.aIdx); t = P.shutterValue(s.tIdx);
      if (isoAuto) iso = raiseIso(N, t);
    } else { // P and A+: program line
      iso = 100;
      N = clampN(Math.pow(2, 1.2 + 0.2 * (EVt - 2)));
      if (N > 8 && mode !== 'A+') N = Math.min(N, 8);
      t = P.solveShutter(EVt, N, iso);
      const tTarget = s.mode === 'A+' && C.scene().moving ? 1 / 500 : tSafe;
      for (let g = 0; g < 14 && t > tTarget && N > Nmax * 1.01; g++) { N = clampN(N / 1.122); t = P.solveShutter(EVt, N, iso); }
      if (t > tTarget) { iso = raiseIso(N, tTarget); t = P.solveShutter(EVt, N, iso); }
    }
    // flash decision and sync limit
    let flashOn = sceneFlash;
    if (s.flash === 'auto' && s.mode !== 'A+') flashOn = false;
    if (s.flash === 'auto' && s.mode === 'A+' && t <= tSafe * 1.05) flashOn = false;
    if (flashOn && !s.pop) { s.pop = true; }
    flashOn = flashOn || (s.flash === 'on');
    if (flashOn) {
      const sync = FF.BODY.flash.sync;
      if (t < sync) { t = sync; notes.push('Shutter limited to 1/200 s while the flash is on.'); }
      if (s.mode === 'P' || s.mode === 'Av' || s.mode === 'A+') t = Math.min(Math.max(t, 1 / 200), 1 / 60);
    }
    // snap to third-stop steps
    const aIdx = Math.min(aHi, Math.max(aLo, P.apertureIndex(N))); N = P.apertureValue(aIdx);
    const tIdx = Math.min(P.SHUTTER_N - 1, Math.max(0, P.shutterIndex(t))); t = P.shutterValue(tIdx);
    const iIdx = Math.min(P.ISO_N - 1, Math.max(0, P.isoIndex(iso))); iso = P.isoValue(iIdx);
    if (s.mode === 'M' || fixedIso) { /* user values stay */ }
    const eff = { N, t, iso, aIdx, tIdx, iIdx, flashOn, flashP: 0, notes, ec, EVm, EVt };
    eff.ind = P.indicator(EVm, N, t, iso);
    if (flashOn) {
      const d = Math.max(0.3, C.afDepth || S().focusDist);
      const GN = FF.BODY.flash.gn;
      eff.flashP = Math.min(1, (N * d) * (N * d) / (GN * GN));
      eff.flashLimited = (N * d) > GN * 1.0;
      eff.flashK = GN * GN * eff.flashP / (N * N);
    }
    eff.shutterNote = t > tSafe && s.stab !== 'tripod' ? 'Slower than 1/' + Math.round(1 / tSafe) + ' s: hand shake can blur the photo.' : '';
    return eff;
  };

  /* ----- metering ----- */
  C.refreshMeter = function (force) {
    const s = S();
    const cfg = C.baseCfg(0);
    const p = FF.buildParams(cfg);
    const m = FF.Renderer.meter(p);
    if (!m) return;
    C.meterMap = m;
    const af = s.af;
    let region = s.meter;
    if (s.mode === 'A+' || s.mode === 'SCN') region = 'evaluative';
    let L = P.meterReading(m.lum, region, m.gx, m.gy, af);
    let locked = false;
    if (s.aeLock != null) { locked = true; L = s.aeLock; }
    const EVm = C.sceneEV() + Math.log2(L);
    C.meterInfo = { EVm, L, region, locked };
    C.eff = C.solve(EVm);
    if (s.afMode === 'servo' && s.afState !== 'fail') C.afPress(true);
    return C.eff;
  };
  C.lockAE = function () {
    const s = S();
    if (s.aeLock != null) s.aeLock = null; else s.aeLock = C.meterInfo.L;
    C.refreshMeter(true); C.emit('settings');
  };

  /* ----- autofocus ----- */
  C.afDepth = 2;
  function cellAt(x, y) { const m = C.meterMap; return Math.min(m.gy - 1, Math.max(0, Math.floor(y * m.gy))) * m.gx + Math.min(m.gx - 1, Math.max(0, Math.floor(x * m.gx))); }
  C.afTarget = function () {
    const m = C.meterMap, s = S(); if (!m) return null;
    let pt = s.af;
    if (s.afArea === 'whole' || s.mode === 'A+' || s.mode === 'SCN') {
      let best = null;
      for (let want of s.face ? [2, 1] : [1]) {
        let sx = 0, sy = 0, n = 0;
        for (let y = 0; y < m.gy; y++) for (let x = 0; x < m.gx; x++) if (m.sub[y * m.gx + x] === want) { sx += x; sy += y; n++; }
        if (n > 3) { best = { x: (sx / n + 0.5) / m.gx, y: (sy / n + 0.5) / m.gy, face: want === 2 }; break; }
      }
      pt = best || { x: 0.5, y: 0.5 };
      s.afAuto = pt;
    } else s.afAuto = null;
    return pt;
  };
  C.afPress = function (quiet) {
    const s = S(), m = C.meterMap;
    if (!m) return;
    if (s.afMode === 'mf') { s.focusTarget = s.mfDist; s.afState = 'idle'; return; }
    const pt = C.afTarget();
    let dsum = 0, lsum = 0, n = 0, lmax = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = Math.min(0.999, Math.max(0, pt.x + dx / m.gx)), y = Math.min(0.999, Math.max(0, pt.y + dy / m.gy)), i = cellAt(x, y);
      dsum += m.depth[i]; lsum += m.lum[i]; lmax = Math.max(lmax, m.lum[i]); n++;
    }
    const depth = dsum / n, lum = lsum / n;
    C.afDepth = depth;
    const lens = C.lens(), nMax = P.apertureValue(C.apRange()[0]);
    const evAF = C.sceneEV() + Math.log2(Math.max(lum, 1e-3));
    const limit = FF.BODY.afLimitEV + 2 * Math.log2(nMax / FF.BODY.afLimitAperture);
    const mfd = lens.mfd(s.f);
    if (evAF < limit) { s.afState = 'fail'; s.afNote = 'Too dark to focus (' + evAF.toFixed(1) + ' EV, needs about ' + limit.toFixed(1) + ' EV with this lens). Try a brighter spot, a faster lens or manual focus.'; return; }
    if (depth < mfd) { s.afState = 'fail'; s.afNote = 'Closer than the minimum focus distance (' + mfd.toFixed(2) + ' m). Step back.'; s.focusTarget = mfd; return; }
    s.focusTarget = depth; s.afState = 'locked'; s.afNote = pt.face ? 'Face detected' : '';
    s.afPoint = pt;
    if (!quiet) s.afFlash = performance.now();
  };
  C.setMF = function (d) { const s = S(); s.mfDist = Math.max(C.lens().mfd(s.f) * 0.75, Math.min(1000, d)); s.focusTarget = s.mfDist; C.emit('settings'); };

  C.tick = function (dt) {
    const s = S();
    if (!s.paused) C.simT = (C.simT + dt) % 600;
    // focus motor: exponential approach in log space
    const a = Math.log(s.focusDist), b = Math.log(Math.max(0.1, s.focusTarget));
    const k = 1 - Math.exp(-dt * 9);
    s.focusDist = Math.exp(a + (b - a) * k);
    if (Math.abs(a - b) < 0.002) s.focusDist = s.focusTarget;
  };

  /* ----- config for the renderer ----- */
  C.baseCfg = function (T, extra) {
    const s = S(), sc = C.scene(), eff = C.eff;
    const cfg = {
      scene: s.scene, lens: s.lens, f: s.f, N: eff.N, focusM: Math.max(s.focusDist, C.lens().mfd(s.f) * 0.7),
      t0: C.simT, T, subjD: s.subjD, speed: s.speed, evOffset: s.light, cct: C.sceneCCT(), aim: s.aim.slice(), pos: (s.pos || [0, 0]).slice(), corr: s.corr
    };
    return Object.assign(cfg, extra || {});
  };
  C.panRate = () => (S().pan ? S().speed / S().subjD : 0);
  C.styleVals = () => { const st = FF.STYLES.find((x) => x.id === S().style) || FF.STYLES[1]; return [st.contrast, st.sat]; };
  C.nrFactor = () => ({ off: 1, std: 0.75, high: 0.5 }[S().nr] || 1);

  // White balance kelvin actually applied.
  C.wbKelvin = function () {
    const s = S(), sceneK = Math.min(10000, Math.max(2500, C.sceneCCT()));
    if (s.wb === 'awbw') return sceneK;
    if (s.wb === 'awb') return P.fromMired(P.mired(sceneK) * 0.8 + P.mired(5500) * 0.2);
    if (s.wb === 'k') return s.wbK;
    return FF.WB.find((w) => w.id === s.wb).k;
  };
  C.hyper = () => {
    const s = S(), eff = C.eff;
    return P.dof(s.f, eff.N, s.focusDist * 1000, 0.019);
  };
})();
