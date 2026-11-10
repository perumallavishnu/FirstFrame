/* cam_capture.js: preview rendering, still capture (progressive), burst. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const P = FF.phys, C = FF.cam, R = FF.Renderer;

  const CAP = { w: 1080, h: 720, passes: 8, ns: 64 };
  const PRE = { w: 720, h: 480, ns: 28 };
  C.quality = 1;                       // 1 normal, 0.6 low
  C.shots = [];                        // session shots (most recent first)
  let seq = 0;

  /* ----- live view ----- */
  C.live = { ms: 16 };
  C.renderPreview = function (ctx, cw, ch, opts) {
    opts = opts || {};
    const s = C.state, eff = C.eff;
    const q = C.quality;
    const w = Math.round(PRE.w * q) & ~1, h = Math.round(PRE.h * q) & ~1;
    // Live view shows the exposure effect (educational). Long exposures are capped so the picture keeps moving.
    const T = opts.exact ? eff.t : Math.min(eff.t, 0.4);
    const shake = s.stab === 'tripod' ? FF.ZERO_SHAKE : (C.liveShake || (C.liveShake = P.makeShake(P.mulberry(7), C.isFactor(), 0.65)));
    const cfg = C.baseCfg(T, { shake, panRate: C.panRate(), flash: { k: 0, tf: 0 } });
    const p = FF.buildParams(cfg);
    const disp = FF.buildDisplay({ iso: eff.iso, M: 8, nr: C.nrFactor(), wbK: C.wbKelvin(), style: C.styleVals(), corr: s.corr, seed: (performance.now() / 33) | 0 });
    const win = opts.zoom ? FF.cropWindow(w, h, s.af.x, s.af.y).map((v, i) => (i < 2 ? v : v * 1.0)) : FF.fullWindow();
    const win2 = opts.zoom ? (() => { const ww = P.SENSOR.w / 6, hh = P.SENSOR.h / 6; return [P.clamp((s.af.x - 0.5) * P.SENSOR.w, -P.SENSOR.w / 2 + ww / 2, P.SENSOR.w / 2 - ww / 2), P.clamp((0.5 - s.af.y) * P.SENSOR.h, -P.SENSOR.h / 2 + hh / 2, P.SENSOR.h / 2 - hh / 2), ww, hh]; })() : win;
    const o = Object.assign(disp, { w, h, win: win2, ns: Math.round(PRE.ns * (C.quality < 1 ? 0.7 : 1)), passes: 1, seed: (performance.now() / 50) | 0, preview: true });
    R.render(p, o);
    ctx.imageSmoothingEnabled = true;
    R.blit(ctx, w, h, 0, 0, cw, ch);
  };
  C.isFactor = () => { const l = C.lens(); return C.state.is && l.isStops ? Math.pow(2, -0.8 * l.isStops) : 1; };

  /* ----- still capture ----- */
  // Builds the immutable description of one exposure.
  C.plan = function (timeOffset) {
    const s = C.state, eff = C.eff, sc = C.scene();
    const seed = (Math.random() * 1e9) | 0, rnd = P.mulberry(seed);
    const shake = s.stab === 'tripod' ? FF.ZERO_SHAKE : P.makeShake(rnd, C.isFactor(), 0.65);
    const panErr = 1 + (rnd() - 0.5) * 0.08;
    const t0 = C.simT + (timeOffset || 0);
    const T = eff.t;
    const cfg = C.baseCfg(T, { t0, shake, panRate: C.panRate() * panErr, flash: eff.flashOn ? { k: eff.flashK || 0, tf: t0 } : { k: 0, tf: 0 } });
    cfg.focusM = Math.max(s.focusDist, C.lens().mfd(s.f) * 0.7);
    const disp = { iso: eff.iso, M: 8, nr: C.nrFactor(), wbK: C.wbKelvin(), style: C.styleVals(), corr: s.corr, seed: seed % 997 };
    return {
      id: ++seq, seed, cfg, disp, eff: Object.assign({}, eff), shake,
      state: JSON.parse(JSON.stringify({ mode: s.mode, scn: s.scn, meter: s.meter, ec: s.ec, afMode: s.afMode, afArea: s.afArea, af: s.af, wb: s.wb, style: s.style, stab: s.stab, is: s.is, flash: s.flash, pan: s.pan, aim: s.aim, light: s.light, cctOn: s.cctOn, cct: s.cct, speed: s.speed, subjD: s.subjD, scene: s.scene, lens: s.lens, f: s.f, corr: s.corr, nr: s.nr })),
      afPt: s.afAuto || s.af, wbK: C.wbKelvin(), meterInfo: Object.assign({}, C.meterInfo), afDepth: C.afDepth, afState: s.afState, time: Date.now()
    };
  };

  // Render a plan into a canvas progressively. Resolves with the canvas.
  C.develop = function (plan, opts) {
    opts = opts || {};
    const w = opts.w || CAP.w, h = opts.h || CAP.h, passes = opts.passes || CAP.passes, ns = opts.ns || CAP.ns;
    const win = opts.win || FF.fullWindow();
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const ctx = out.getContext('2d');
    const p = FF.buildParams(plan.cfg);
    const o = Object.assign({}, FF.buildDisplay(plan.disp), { w, h, win, ns, passes, seed: plan.seed % 9973, preview: false, M: opts.M || (opts.win ? 1 : 8) });
    if (plan.disp.M && !opts.win) o.M = plan.disp.M;
    return new Promise((resolve) => {
      let i = 0, idx = 0;
      const step = () => {
        const t0 = performance.now();
        do { idx = R.pass(p, o, i); i++; } while (i < passes && performance.now() - t0 < 24 && !opts.sync);
        if (opts.onProgress) opts.onProgress(i / passes);
        if (i < passes) { opts.sync ? step() : setTimeout(step, 0); return; }
        R.present(p, o, idx);
        ctx.drawImage(R.canvas, 0, R.MAXH - h, w, h, 0, 0, w, h);
        resolve(out);
      };
      step();
    });
  };

  // Full shot: plan, develop, analyse, register.
  C.shoot = async function (opts) {
    opts = opts || {};
    const plan = opts.plan || C.plan(opts.offset || 0);
    const canvas = await C.develop(plan, { w: opts.w, h: opts.h, passes: opts.passes, onProgress: opts.onProgress });
    const shot = { plan, canvas, id: plan.id };
    shot.analysis = FF.analyze(shot);
    shot.url = canvas.toDataURL('image/jpeg', 0.9);
    const t = document.createElement('canvas'); t.width = 360; t.height = 240; t.getContext('2d').drawImage(canvas, 0, 0, 360, 240);
    shot.thumb = t.toDataURL('image/jpeg', 0.72);
    C.shots.unshift(shot);
    if (C.shots.length > 60) C.shots.pop();
    C.emit('shot');
    return shot;
  };

  // 100% crop of an existing shot, centred on (cx, cy) in 0..1.
  C.crop100 = function (shot, cx, cy) {
    const w = 720, h = 480;
    return C.develop(shot.plan, { w, h, win: FF.cropWindow(w, h, cx, cy), passes: 8, ns: 56, M: 1 });
  };

  C.driveFps = () => (C.state.afMode === 'servo' ? FF.BODY.servoFps : FF.BODY.maxFps);
})();
