/* analyze.js: reads a finished shot and explains what went right or wrong. Uses both the real pixels and the settings. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const P = FF.phys;
  const srgb2lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };

  FF.pixelStats = function (canvas, afPt) {
    const w = 270, h = 180, c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(canvas, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const hist = { r: new Float32Array(64), g: new Float32Array(64), b: new Float32Array(64), l: new Float32Array(64) };
    let hi = 0, lo = 0; const lumas = new Uint8Array(w * h);
    for (let i = 0, k = 0; i < d.length; i += 4, k++) {
      const r = d[i], g = d[i + 1], b = d[i + 2], l = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
      hist.r[r >> 2]++; hist.g[g >> 2]++; hist.b[b >> 2]++; hist.l[l >> 2]++;
      if (r > 250 || g > 250 || b > 250) hi++;
      if (l < 6) lo++; lumas[k] = l;
    }
    const sorted = Array.from(lumas).sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    // subject patch around the AF point
    let sx = 0, n = 0; const cx = Math.round((afPt ? afPt.x : 0.5) * w), cy = Math.round((afPt ? afPt.y : 0.5) * h), rr = 10;
    for (let y = Math.max(0, cy - rr); y < Math.min(h, cy + rr); y++) for (let x = Math.max(0, cx - rr); x < Math.min(w, cx + rr); x++) { sx += lumas[y * w + x]; n++; }
    return { hist, clipHi: hi / (w * h), clipLo: lo / (w * h), median, subj: n ? sx / n : median, n: w * h };
  };

  function motionInfo(plan) {
    const sc = FF.sceneById(plan.state.scene), cfg = plan.cfg, T = cfg.T, f = cfg.f, d = cfg.subjD, v = cfg.speed;
    let vs = 0;
    if (sc.id === 'fan') vs = 2 * Math.PI * v / 60 * 0.21; else if (sc.id === 'water' || sc.id === 'car' || sc.id === 'night') vs = v; else if (sc.motion) vs = sc.motion(v);
    const rel = Math.abs(vs - cfg.panRate * d);
    const subjPx = (rel * f / d) * T / P.SENSOR.pitch;
    const bgPx = cfg.panRate * f * T / P.SENSOR.pitch;
    return { vs, subjPx, bgPx, moving: vs > 0 };
  }

  function fmtStops(x) { return (x > 0 ? '+' : '') + x.toFixed(1); }

  FF.analyze = function (shot) {
    const plan = shot.plan, eff = plan.eff, st = plan.state, cfg = plan.cfg;
    const sc = FF.sceneById(st.scene), lens = FF.lensById(st.lens);
    const px = FF.pixelStats(shot.canvas, plan.afPt || st.af);
    const m = motionInfo(plan);
    const shakePx = st.stab === 'tripod' ? 0 : P.shakeBlurPx(plan.shake, cfg.f, cfg.t0, cfg.T);
    const sD = cfg.focusM * 1000, dSub = Math.hypot(cfg.subjD, (cfg.pos || [0, 0])[0], (cfg.pos || [0, 0])[1]) * 1000;
    const defocusPx = P.coc(cfg.f, eff.N, sD, dSub) / P.SENSOR.pitch;
    const bgD = sc.bg[0] * 1000;
    const bgBlurPct = P.coc(cfg.f, eff.N, sD, bgD) / P.SENSOR.h * 100;
    const v100mid = 0.18 * Math.pow(2, eff.ind);
    const snr = P.snrDB(Math.max(v100mid, 1e-4), eff.iso, 1);
    const night = sc.id === 'night' || sc.id === 'candle';
    const metrics = { N: eff.N, t: eff.t, iso: eff.iso, f: cfg.f, ind: eff.ind, subjPx: m.subjPx, bgPx: m.bgPx, shakePx, defocusPx, bgBlurPct, snr, median: px.median, subj: px.subj, clipHi: px.clipHi, clipLo: px.clipLo, moving: m.moving, tripod: st.stab === 'tripod', flash: eff.flashOn, afState: plan.afState };
    const issues = [];
    const add = (level, tag, title, detail, fix) => issues.push({ level, tag, title, detail, fix });

    /* ----- exposure ----- */
    const subjScene = ['portrait', 'cafe', 'candle', 'fan', 'still3d'].includes(sc.id);
    const target = srgbTarget(sc);
    const subjDelta = Math.log2(srgb2lin(target) / Math.max(1e-4, srgb2lin(px.subj)));
    const medDelta = Math.log2(srgb2lin(night ? 40 : 110) / Math.max(1e-4, srgb2lin(px.median)));
    let expLevel = 'good', expTitle = 'Exposure looks good', expDetail = 'Midtones sit near the middle of the histogram and the highlights are intact.', expFix = null, delta = 0;
    if (px.clipHi > 0.12 && !night) { expLevel = px.clipHi > 0.3 ? 'bad' : 'warn'; expTitle = 'Highlights are clipped'; expDetail = Math.round(px.clipHi * 100) + '% of the picture is pure white, so detail there is gone for good.'; delta = -Math.min(2.5, Math.max(0.7, Math.log2(1 + px.clipHi * 4))); }
    if (subjScene && subjDelta > 1.0) { expLevel = subjDelta > 2 ? 'bad' : 'warn'; expTitle = 'The ' + sc.subj.label.toLowerCase() + ' is too dark'; expDetail = Math.abs(eff.ind) < 0.7 ? 'The camera exposed correctly for what it measured, but the bright parts of the scene fooled the meter.' : 'It is about ' + subjDelta.toFixed(1) + ' stops darker than it should be.'; delta = subjDelta; }
    else if (subjScene && subjDelta < -1.0) { expLevel = subjDelta < -2 ? 'bad' : 'warn'; expTitle = 'The ' + sc.subj.label.toLowerCase() + ' is too bright'; expDetail = 'It is about ' + (-subjDelta).toFixed(1) + ' stops brighter than it should be.'; delta = subjDelta; }
    else if (!subjScene || expLevel === 'good') {
      if (medDelta > 1.2 && px.median < (night ? 14 : 70)) { expLevel = medDelta > 2.2 ? 'bad' : 'warn'; expTitle = 'Underexposed by about ' + medDelta.toFixed(1) + ' stops'; expDetail = 'The whole picture is darker than the middle of the histogram.'; delta = medDelta; }
      else if (medDelta < -1.2 && !night) { expLevel = 'warn'; expTitle = 'Overexposed by about ' + (-medDelta).toFixed(1) + ' stops'; expDetail = 'The picture is brighter than it needs to be.'; delta = medDelta; }
    }
    if (expLevel !== 'good') expFix = exposureFixes(delta, eff, st, lens, cfg);
    add(expLevel, 'Exposure', expTitle, expDetail, expFix);

    /* ----- motion ----- */
    if (m.moving) {
      const what = sc.id === 'fan' ? 'blade tips' : sc.id === 'water' ? 'the water' : sc.id === 'car' ? 'the car' : sc.three ? 'the ' + sc.subj.label.toLowerCase() : 'the traffic';
      const creative = sc.id === 'water' || sc.id === 'night';
      if (creative) {
        const len = m.subjPx;
        if (sc.id === 'water') add(len > 250 ? 'good' : 'info', 'Motion', len > 250 ? 'Silky water' : 'Water still looks textured', len > 250 ? 'The water moved about ' + Math.round(len) + ' px, so it blurs into a smooth veil.' : 'Water moved only ~' + Math.round(len) + ' px. Use 1/2 s or slower, a small aperture and low ISO for silk.', len > 250 ? null : 'Tripod, ISO 100, f/16–f/22, then slow the shutter to about 1 s.');
        else add(len > 600 ? 'good' : 'info', 'Motion', len > 600 ? 'Light trails drawn' : 'Short or no light trails', 'Lights moved about ' + Math.round(len) + ' px during the exposure.' + (len > 600 ? '' : ' Try 8 s or longer.'), len > 600 ? null : 'Use a tripod, ISO 100, f/8–f/11 and 8–15 s.');
      } else {
        const blurred = m.subjPx;
        if (blurred > 8) add('bad', 'Motion', 'Motion blur on ' + what, what.replace(/^./, (c) => c.toUpperCase()) + ' moved about ' + Math.round(blurred) + ' px while the shutter was open.', 'Use a faster shutter: about 1/' + Math.round(1 / (eff.t * Math.max(2, blurred / 2.5))) + ' s or quicker' + (sc.id === 'car' || sc.id === 'cyclist3d' ? ', or pan with the subject.' : '.'));
        else if (blurred > 3) add('warn', 'Motion', 'Slight blur on ' + what, 'Moved about ' + Math.round(blurred) + ' px. Fine for small prints, soft at 100%.', 'Go one or two stops faster on the shutter.');
        else add('good', 'Motion', 'Motion frozen', what.replace(/^./, (c) => c.toUpperCase()) + ' moved only ' + blurred.toFixed(1) + ' px.', null);
        if (m.bgPx > 30) add('good', 'Panning', 'Streaked background', 'Background streaked by ~' + Math.round(m.bgPx) + ' px, which gives the feeling of speed.', null);
      }
    }

    /* ----- shake ----- */
    if (st.stab === 'tripod') add('good', 'Shake', 'Tripod: no shake', 'The camera did not move.', null);
    else if (shakePx > 8) add('bad', 'Shake', 'Camera shake blur', 'Your hands moved the camera about ' + Math.round(shakePx) + ' px during 1/' + Math.round(1 / eff.t) + ' s at ' + Math.round(cfg.f) + ' mm.', shakeFix(eff, st, lens, cfg));
    else if (shakePx > 3.5) add('warn', 'Shake', 'Slight shake', 'About ' + Math.round(shakePx) + ' px of hand-shake blur. Fine on a phone screen, soft at 100%.', shakeFix(eff, st, lens, cfg));
    else add('good', 'Shake', 'Steady', 'Hand shake blur was only ' + shakePx.toFixed(1) + ' px.', null);

    /* ----- focus ----- */
    if (plan.afState === 'fail') add('bad', 'Focus', 'Autofocus did not lock', 'The camera could not find focus, so it kept the previous distance.', 'Aim at a brighter, higher-contrast spot, or switch to manual focus.');
    else if (defocusPx > 8) add('bad', 'Focus', 'Subject out of focus', 'The ' + sc.subj.label.toLowerCase() + ' is blurred by about ' + Math.round(defocusPx) + ' px.', 'Press the shutter button halfway on the subject first, or stop down to f/8 for a deeper zone of sharpness.');
    else if (defocusPx > 3) add('warn', 'Focus', 'Focus slightly soft', 'Blur circle of about ' + Math.round(defocusPx) + ' px on the subject.', 'Refocus on the subject, or use a smaller aperture.');
    else add('good', 'Focus', 'Subject in focus', 'Blur circle on the subject is ' + defocusPx.toFixed(1) + ' px.', null);

    /* ----- depth of field (informational) ----- */
    if (bgBlurPct > 1) add('info', 'Depth', bgBlurPct > 6 ? 'Strong background blur' : 'Some background blur', 'The background is blurred by about ' + bgBlurPct.toFixed(1) + '% of the frame height.', null);

    /* ----- noise ----- */
    const noiseLevel = snr >= 28 ? 'good' : snr >= 22 ? 'good' : snr >= 16 ? 'warn' : 'bad';
    add(noiseLevel, 'Noise', snr >= 28 ? 'Clean image' : snr >= 22 ? 'Slight noise at 100%' : snr >= 16 ? 'Visible noise' : 'Heavy noise', 'ISO ' + Math.round(eff.iso) + ' gives roughly ' + Math.round(snr) + ' dB signal-to-noise in the midtones.' + (snr < 22 ? ' Less light reached the sensor, so the camera amplified it.' : ''), snr < 22 ? 'Add light (flash, wider aperture, slower shutter on a tripod) so you can lower the ISO.' : null);

    /* ----- diffraction ----- */
    if (eff.N >= 16) add('warn', 'Sharpness', 'Diffraction softening', 'At f/' + eff.N.toFixed(0) + ' light bends around the aperture blades and fine detail softens.', 'Use f/8–f/11 when you do not need the extra depth of field.');

    /* ----- white balance ----- */
    const dm = P.mired(plan.wbK) - P.mired(Math.min(10000, Math.max(2500, cfg.cct)));
    if (Math.abs(dm) > 70) add('warn', 'Colour', dm > 0 ? 'Colour looks too cool' : 'Colour looks too warm', 'White balance was set for ' + Math.round(plan.wbK) + ' K but the light is about ' + Math.round(cfg.cct) + ' K.', 'Use Auto WB, or set the Kelvin value near ' + Math.round(cfg.cct) + ' K.');
    /* ----- flash ----- */
    if (eff.flashOn && eff.flashLimited) add('warn', 'Flash', 'Flash too weak', 'The pop-up flash reaches about ' + (FF.BODY.flash.gn / eff.N).toFixed(1) + ' m at this aperture and ISO.', 'Open the aperture, raise ISO, or move closer.');

    const bad = issues.filter((i) => i.level === 'bad').length, warn = issues.filter((i) => i.level === 'warn').length;
    const score = Math.max(0, Math.round(100 - bad * 28 - warn * 10));
    return { px, metrics, issues, score, delta };
  };

  function srgbTarget(sc) { return sc.id === 'portrait' ? 120 : 120; }

  function exposureFixes(delta, eff, st, lens, cfg) {
    const out = [];
    const manualAuto = st.mode === 'M' ? 'In Manual, change the settings' : 'In ' + st.mode + ', use exposure compensation ' + FF.ui.fmt.ec(Math.round(delta * 3)) + ' EV';
    if (Math.abs(delta) < 0.4) return null;
    if (delta > 0) {
      out.push(manualAuto + ' (' + fmtStops(delta) + ' stops).');
      if (eff.iso * Math.pow(2, delta) <= 12800) out.push('Raise ISO from ' + Math.round(eff.iso) + ' to about ' + Math.round(eff.iso * Math.pow(2, delta) / 10) * 10 + '.');
      if (st.stab !== 'tripod' && eff.t * Math.pow(2, delta) < 1 / Math.max(30, cfg.f * 1.6) * 1.5) out.push('Or slow the shutter to about 1/' + Math.round(1 / (eff.t * Math.pow(2, delta))) + ' s.');
      if (cfg.N > P.apertureValue(P.apertureRange(lens, cfg.f)[0]) * 1.05) out.push('Or open the aperture towards f/' + P.apertureValue(P.apertureRange(lens, cfg.f)[0]).toFixed(1) + '.');
      if (st.scene === 'portrait') out.push('For backlit subjects: spot-meter the face or use fill flash.');
    } else {
      out.push(manualAuto + ' (' + fmtStops(delta) + ' stops).');
      out.push('Lower the ISO, close the aperture, or speed up the shutter by ' + (-delta).toFixed(1) + ' stops.');
    }
    return out.join(' ');
  }
  function shakeFix(eff, st, lens, cfg) {
    const need = 1 / Math.max(60, cfg.f * 1.6 * 2);
    const bits = ['Use about 1/' + Math.round(1 / need) + ' s or faster at this focal length.'];
    if (lens.isStops && !st.is) bits.push('Turn the lens IS switch on.');
    if (!lens.isStops) bits.push('This lens has no stabilisation, so the shutter speed has to do the work.');
    bits.push('Or put the camera on a tripod.');
    return bits.join(' ');
  }
})();
