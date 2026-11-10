/* params.js: turns camera + scene settings into the uniform set the renderer needs. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const P = FF.phys;

  const ZERO_SHAKE = { yaw: [[0, 1, 0], [0, 1, 0], [0, 1, 0]], pitch: [[0, 1, 0], [0, 1, 0], [0, 1, 0]] };
  FF.ZERO_SHAKE = ZERO_SHAKE;
  const flat = (a) => { const o = new Float32Array(12); a.forEach((c, i) => { o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; }); return o; };

  /* cfg: {scene, lens, f, N, focusM, t0, T, subjD, speed, evOffset, cct, aim:[x,y], panRate, shake, flash:{k,tf}, corr} */
  FF.buildParams = function (cfg) {
    const sc = FF.sceneById(cfg.scene), lens = FF.lensById(cfg.lens);
    const f = cfg.f, N = cfg.N, nMax = lens.at(f, lens.maxAp);
    const open = P.clamp(1 - Math.log2(N / nMax) / 2, 0, 1);
    const o = lens.opt;
    const ab0 = lens.lin(f, [o.ab[0][0], o.ab[1][0]]), ab1 = lens.lin(f, [o.ab[0][1], o.ab[1][1]]);
    const abk = Math.pow(P.clamp(1 - Math.log2(N / nMax) / Math.max(0.2, Math.log2(o.sweet / nMax)), 0, 1), 1.5);
    const k1 = lens.lin(f, o.k1);
    const sh = cfg.shake || ZERO_SHAKE;
    const flash = cfg.flash || { k: 0, tf: 0 };
    return {
      scene: sc.gl, three: sc.three ? sc.id : null, pos: cfg.pos || [0, 0], f, N, focus: cfg.focusM * 1000,
      blades: lens.blades, poly: 0.25 + 0.75 * P.clamp(Math.log2(N / nMax) / 1.5, 0, 1),
      cat: lens.lin(f, o.cat) * open, dist: cfg.corr === false ? k1 : k1 * 0.08,
      base: Math.hypot(0.25 * N, 1.4), ab: [1 + ab0 * abk, 1 + ab1 * abk],
      t0: cfg.t0, T: cfg.T, sceneEV: sc.ev + (cfg.evOffset || 0), cct: cfg.cct || sc.cct,
      subjD: cfg.subjD, speed: cfg.speed, aim: cfg.aim || [0, 0], panRate: cfg.panRate || 0,
      shX: flat(sh.yaw), shY: flat(sh.pitch), flashK: flash.k, tf: flash.tf
    };
  };

  // Display-pass options from camera settings.
  FF.buildDisplay = function (cfg) {
    return {
      iso: cfg.iso, M: cfg.M || 8, nr: cfg.nr == null ? 1 : cfg.nr, wb: P.wbGains(cfg.wbK || 5200),
      style: cfg.style || [0.25, 1.1], corr: cfg.corr !== false, seed: cfg.seed || 1
    };
  };

  // Sensor window for a 1:1 (100%) crop centred on (cx, cy) in 0..1 frame coordinates (y down).
  FF.cropWindow = function (w, h, cx, cy) {
    const S = P.SENSOR, ww = w * S.pitch, hh = h * S.pitch;
    const x = P.clamp((cx - 0.5) * S.w, -S.w / 2 + ww / 2, S.w / 2 - ww / 2), y = P.clamp((0.5 - cy) * S.h, -S.h / 2 + hh / 2, S.h / 2 - hh / 2);
    return [x, y, ww, hh];
  };
  FF.fullWindow = () => [0, 0, P.SENSOR.w, P.SENSOR.h];
})();
