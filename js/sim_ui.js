/* sim_ui.js: the control deck (right-hand panes). */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const P = FF.phys, C = FF.cam, U = FF.ui, h = U.h;
  const sim = (FF.sim = FF.sim || {});
  const refreshers = [];
  const S = () => C.state;
  const reg = (fn) => { refreshers.push(fn); return fn; };
  sim.refreshControls = () => refreshers.forEach((fn) => fn());
  // every camera change (from this deck, the viewfinder, the rear menu or the 3D model) goes through FF.act;
  // the deck redraws once per change, whatever its source
  const D = (type, payload) => { const r = FF.act.dispatch(type, payload, 'deck'); if (!r.ok && r.reason && sim.msg) sim.msg(r.reason); return r; };
  sim.act = D;
  FF.act.on(() => { if (sim.built) sim.refreshControls(); sim.hudDirty = true; });
  const changed = () => { C.refreshMeter(true); sim.refreshControls(); sim.hudDirty = true; };
  sim.changed = changed;

  const isAuto = (what) => {
    const s = S(), m = FF.MODES.find((x) => x.id === s.mode);
    if (what === 'iso') return C.isoAutoNow();
    return m.auto.includes(what);
  };

  sim.setMode = function (m) { D('mode/set', { mode: m }); sim.setKnob && sim.setKnob(); };
  sim.stepAperture = (d) => { if (!isAuto('N')) D('aperture/step', { d }); };
  sim.stepShutter = (d) => { if (!isAuto('t')) D('shutter/step', { d }); };
  sim.stepISO = (d) => { if (!isAuto('iso')) D('iso/step', { d }); };
  sim.stepEC = (d) => D('ec/step', { d });

  /* ---------- EXPOSURE pane ---------- */
  function paneExposure() {
    const root = h('div');
    const info = h('div', { class: 'callout info small' });
    const ap = U.stepper(() => ({ text: P.fmtAperture(C.eff.N), auto: isAuto('N'), sub: isAuto('N') ? 'AUTO' : '', locked: isAuto('N') }), () => sim.stepAperture(1), () => sim.stepAperture(-1));
    const sh = U.stepper(() => ({ text: P.fmtShutter(C.eff.t) + (C.eff.t >= 0.28 ? '' : ' s'), auto: isAuto('t'), sub: isAuto('t') ? 'AUTO' : '', locked: isAuto('t') }), () => sim.stepShutter(1), () => sim.stepShutter(-1));
    const iso = U.stepper(() => ({ text: String(Math.round(C.eff.iso)), auto: isAuto('iso'), sub: isAuto('iso') ? 'AUTO' : '', locked: isAuto('iso') }), () => sim.stepISO(-1), () => sim.stepISO(1));
    const isoAuto = U.toggle('Auto ISO', S().isoAuto, (v) => D('iso/auto', { on: v }));
    const isoMax = h('select', { id: 'isomax', 'aria-label': 'Auto ISO maximum', onchange: (e) => D('iso/max', { idx: +e.target.value }) }, P.ISO_LABELS.map((l, i) => i >= 6 ? h('option', { value: i }, 'max ' + l) : null));
    isoMax.value = S().isoMaxIdx;
    const ec = h('input', { type: 'range', min: -9, max: 9, step: 1, value: 0, 'aria-label': 'Exposure compensation', oninput: (e) => D('ec/set', { ec: +e.target.value }) });
    const ecVal = h('span');
    const meter = U.seg([{ v: 'evaluative', label: 'Evaluative' }, { v: 'partial', label: 'Partial' }, { v: 'spot', label: 'Spot' }, { v: 'center', label: 'Centre' }], S().meter, (v) => D('meter/set', { meter: v }));
    const lockBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => D('ae/lock') }, 'AE lock');
    const hist = h('canvas', { class: 'hist', width: 256, height: 86, id: 'hist' });
    sim.histCanvas = hist;
    const readout = h('div', { class: 'mini' });
    root.append(
      info,
      U.ctl('Aperture', ap, ''), U.ctl('Shutter speed', sh, ''),
      U.ctl('ISO', h('div', { class: 'grid', style: { gap: '8px' } }, iso, h('div', { class: 'row' }, isoAuto, isoMax))),
      U.ctl('Exposure compensation', h('div', null, ec), 'Tells the camera to make the picture brighter (+) or darker (−) than it thinks is right. Not used in Manual.', ecVal),
      U.ctl('Metering mode', h('div', { class: 'row' }, meter, lockBtn), 'Spot reads only the centre of the frame. Aim at the face, press AE lock, then recompose.'),
      U.ctl('Live histogram', h('div', null, hist, readout), 'Left is shadows, right is highlights. A pile-up at the right edge means blown highlights.')
    );
    reg(() => {
      const m = FF.MODES.find((x) => x.id === S().mode);
      info.innerHTML = '<b>' + m.label + ' · ' + m.name + '.</b> ' + m.desc + (S().mode === 'SCN' ? ' <i>Scene: ' + S().scn + '</i>' : '');
      ap.refresh(); sh.refresh(); iso.refresh();
      isoAuto.input.checked = S().isoAuto || S().mode === 'A+' || S().mode === 'SCN'; isoAuto.input.disabled = S().mode === 'A+' || S().mode === 'SCN';
      isoMax.disabled = !C.isoAutoNow(); isoMax.value = S().isoMaxIdx;
      const manualEC = S().mode === 'M' || S().mode === 'A+' || S().mode === 'SCN';
      ec.disabled = S().mode === 'A+' || S().mode === 'SCN'; ec.value = S().ec; ecVal.textContent = (S().ec > 0 ? '+' : '') + U.fmt.ec(S().ec) + ' EV';
      meter.set(S().meter); Array.from(meter.children).forEach((b) => (b.disabled = S().mode === 'A+' || S().mode === 'SCN'));
      lockBtn.textContent = S().aeLock != null ? 'AE locked ✓' : 'AE lock'; lockBtn.classList.toggle('primary', S().aeLock != null);
      const mi = C.meterInfo;
      readout.replaceChildren(h('span', null, 'Scene EV ' + (C.sceneEV()).toFixed(1)), h('span', null, 'Meter reads EV ' + mi.EVm.toFixed(1)), h('span', null, 'Offset ' + U.fmt.ev(C.eff.ind) + ' stops'));
    });
    return root;
  }

  /* ---------- FOCUS pane ---------- */
  function paneFocus() {
    const root = h('div');
    const afMode = U.seg([{ v: 'oneshot', label: 'One-Shot' }, { v: 'servo', label: 'Servo' }, { v: 'mf', label: 'Manual' }], S().afMode, (v) => D('af/mode', { mode: v }));
    const area = U.seg([{ v: '1pt', label: '1-point AF' }, { v: 'whole', label: 'Whole area' }], S().afArea, (v) => D('af/area', { area: v }));
    const face = U.toggle('Detect faces and eyes', S().face, (v) => D('af/face', { on: v }));
    const mfS = h('input', { type: 'range', min: 0, max: 1000, step: 1, value: 500, 'aria-label': 'Manual focus distance', oninput: (e) => { const l = C.lens(), a = Math.log(l.mfd(S().f) * 0.9), b = Math.log(60); D('mf/set', { dist: Math.exp(a + (b - a) * (+e.target.value / 1000)) }); } });
    const half = h('button', { class: 'btn primary', type: 'button', onclick: () => { D('af/press'); sim.msg(S().afState === 'fail' ? S().afNote : 'AF: focused'); } }, 'Focus now (half-press)');
    const note = h('div', { class: 'callout info small' });
    const dofRead = h('div', { class: 'mini' });
    root.append(
      note,
      U.ctl('Focus mode', afMode, 'One-Shot locks once. Servo keeps following the subject (and slows the burst to 3.5 fps). Manual puts you in charge.'),
      U.ctl('AF area', area, 'Click on the viewfinder to place the AF point. Whole area picks a face or the nearest subject for you.'),
      U.ctl('Subject detection', face),
      U.ctl('Manual focus', h('div', null, mfS), 'Drag until the subject looks sharp. The distance readout and the Depth tab show where the sharp zone sits.'),
      U.ctl('Autofocus', half), U.ctl('Depth of field now', dofRead)
    );
    reg(() => {
      const s = S(), mf = s.afMode === 'mf';
      mfS.disabled = !mf; afMode.set(s.afMode); area.set(s.afArea);
      Array.from(area.children).forEach((b) => (b.disabled = mf || s.mode === 'A+' || s.mode === 'SCN')); half.disabled = mf;
      const l = C.lens(), a = Math.log(l.mfd(s.f) * 0.9), b = Math.log(60);
      if (!mf) mfS.value = String(Math.round(1000 * (Math.log(Math.max(0.1, s.focusDist)) - a) / (b - a)));
      note.innerHTML = '<b>Dual Pixel CMOS AF</b> works on the image sensor. The ' + FF.BODY.short + ' needs about ' + (FF.BODY.afLimitEV + 2 * Math.log2(P.apertureValue(C.apRange()[0]) / 2)).toFixed(1) + ' EV at the AF point with this lens, so dark scenes need a faster lens.' + (s.afState === 'fail' ? '<br><b style="color:var(--bad)">' + s.afNote + '</b>' : '');
      const d = C.hyper();
      dofRead.replaceChildren(h('span', null, 'Focused at ' + U.fmt.dist(s.focusDist)), h('span', null, 'Sharp from ' + U.fmt.dist(d.near) + ' to ' + (d.far === Infinity ? '∞' : U.fmt.dist(d.far))), h('span', null, 'Hyperfocal ' + U.fmt.dist(d.hyperfocal)));
    });
    return root;
  }

  /* ---------- COLOUR pane ---------- */
  function paneColor() {
    const root = h('div');
    const wb = h('select', { id: 'wbsel', 'aria-label': 'White balance', onchange: (e) => D('wb/set', { wb: e.target.value }) }, FF.WB.map((w) => h('option', { value: w.id }, w.label + (w.k && w.id !== 'k' ? ' · ' + w.k + ' K' : ''))));
    const k = h('input', { type: 'range', min: 2500, max: 10000, step: 100, value: 5200, 'aria-label': 'Colour temperature', oninput: (e) => D('wb/set', { wb: 'k', k: +e.target.value }) });
    const kv = h('span');
    const style = U.seg(FF.STYLES.map((x) => ({ v: x.id, label: x.label })), S().style, (v) => D('style/set', { style: v }));
    const corr = U.toggle('Lens corrections (vignetting and distortion)', S().corr, (v) => D('corr/set', { on: v }));
    const nr = U.seg([{ v: 'off', label: 'Off' }, { v: 'std', label: 'Standard' }, { v: 'high', label: 'High' }], S().nr, (v) => D('nr/set', { nr: v }));
    const note = h('div', { class: 'hint' });
    root.append(
      U.ctl('White balance', h('div', { class: 'grid', style: { gap: '8px' } }, wb, k), 'Tells the camera what colour the light is so whites come out white. Warm light is about 2000–3500 K, daylight about 5500 K, shade 7000 K.', kv),
      h('div', { class: 'ctl' }, note),
      U.ctl('Picture Style', style, 'Changes contrast and colour saturation in JPEG files. Neutral leaves most room for editing.'),
      U.ctl('High ISO noise reduction', nr, 'Smooths grain at the cost of fine detail.'), U.ctl('Corrections', corr, 'Turn off to see what the raw lens does: darker corners and, at 18 mm, barrel distortion.')
    );
    reg(() => {
      wb.value = S().wb; k.value = Math.round(C.wbKelvin()); kv.textContent = Math.round(C.wbKelvin()) + ' K';
      const dm = P.mired(C.wbKelvin()) - P.mired(Math.min(10000, Math.max(2500, C.sceneCCT())));
      note.innerHTML = 'The light here is about <b>' + Math.round(C.sceneCCT()) + ' K</b>. ' + (Math.abs(dm) < 40 ? 'Your setting matches it, so colours look natural.' : dm > 0 ? 'Your setting is cooler than the light, so the picture looks <b>bluish</b>?? No: it is too <b>warm</b>-corrected. Check it.' : 'Your setting is warmer than the light, so the picture looks <b>too warm</b>.');
      note.innerHTML = 'The light here is about <b>' + Math.round(C.sceneCCT()) + ' K</b>. ' + (Math.abs(dm) < 40 ? 'Your setting matches it, so colours look natural.' : dm > 0 ? 'The camera is set for a <b>cooler</b> light than this, so the picture looks too <b>warm</b> (orange).' : 'The camera is set for a <b>warmer</b> light than this, so the picture looks too <b>cool</b> (blue).');
    });
    return root;
  }

  /* ---------- DRIVE / FLASH / STABILITY ---------- */
  function paneDrive() {
    const root = h('div');
    const drive = U.seg([{ v: 'single', label: 'Single' }, { v: 'cont', label: 'Continuous' }, { v: 't2', label: '2 s timer' }, { v: 't10', label: '10 s timer' }], S().drive, (v) => D('drive/set', { drive: v }));
    const flash = U.seg([{ v: 'off', label: 'Off' }, { v: 'auto', label: 'Auto' }, { v: 'on', label: 'On (fill)' }], S().flash, (v) => D('flash/set', { flash: v }));
    const stab = U.seg([{ v: 'hand', label: 'Hand-held' }, { v: 'tripod', label: 'Tripod' }], S().stab, (v) => D('stab/set', { stab: v }));
    const is = U.toggle('Lens image stabiliser (IS)', S().is, (v) => D('is/set', { on: v }));
    const pan = U.toggle('Pan with subject', S().pan, (v) => D('pan/set', { on: v }));
    const note = h('div', { class: 'hint' }), fnote = h('div', { class: 'hint' });
    root.append(
      U.ctl('Drive mode', drive, 'Continuous shoots up to 6.5 fps with One-Shot AF and 3.5 fps with Servo AF. Hold the shutter button down.'),
      U.ctl('Built-in flash', flash, '', null), h('div', { class: 'ctl' }, fnote),
      U.ctl('Camera support', stab, 'On a tripod there is no shake, so long exposures work. Hand-held shots need fast shutter speeds.'),
      U.ctl('Stabilisation', is), h('div', { class: 'ctl' }, note),
      U.ctl('Panning', pan, 'Turns the camera to follow a moving subject. The subject stays sharp while the background streaks.')
    );
    reg(() => {
      const l = C.lens();
      is.input.checked = S().is; is.input.disabled = !l.isStops || S().stab === 'tripod';
      note.textContent = l.isStops ? 'This lens has ' + l.isStops + ' stops of stabilisation. The ' + FF.BODY.short + ' has no stabiliser in the body.' : 'This lens has no stabiliser, and the body has none either. Use a faster shutter speed.';
      const e = C.eff;
      fnote.textContent = S().flash === 'off' ? 'Flash is off.' : e.flashOn ? 'Flash will fire. Shutter limited to 1/200 s or slower. Reach at this aperture: about ' + (FF.BODY.flash.gn / e.N).toFixed(1) + ' m.' : 'Auto flash fires only in A+ mode when the light is too low for a safe shutter speed.';
      pan.input.checked = S().pan; drive.set(S().drive); stab.set(S().stab); flash.set(S().flash);
    });
    return root;
  }

  /* ---------- LENS pane ---------- */
  function rigSVG() {
    const s = S(), l = C.lens();
    const d = l.dims || [69, 60], zk = l.fmax > l.fmin ? (s.f - l.fmin) / (l.fmax - l.fmin) : 0; const len = Math.min(210, d[1] * 1.45 + (l.ext || 0) * 1.45 * zk);
    const x0 = 150 - len;
    const rings = [];
    for (let i = 0; i < 9; i++) rings.push(`<rect x="${x0 + 14 + i * 4}" y="${l.type === 'prime' ? 46 : 38}" width="2" height="${l.type === 'prime' ? 64 : 80}" fill="#0c0f10" opacity=".7"/>`);
    const rh = l.type === 'prime' ? 64 : 80, ry = l.type === 'prime' ? 46 : 38;
    return `<svg viewBox="0 0 520 190" class="rig" role="img" aria-label="Side view of the camera with the ${l.name} mounted">
      <g id="lensg" style="transition:transform .35s ease, opacity .35s">
        <rect x="${x0}" y="${ry}" width="${len}" height="${rh}" rx="8" fill="#20262a" stroke="#0a0d0f"/>
        <rect x="${x0 - 6}" y="${ry + 4}" width="10" height="${rh - 8}" rx="4" fill="#12171a"/>
        ${rings.join('')}
        <rect x="${x0 + len - 18}" y="${ry + 6}" width="14" height="${rh - 12}" rx="3" fill="#c0392f" opacity=".9"/>
        <text x="${x0 + len / 2}" y="${ry + rh + 16}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" fill="currentColor">${l.short}${l.fmin !== l.fmax ? ' @ ' + Math.round(s.f) + ' mm' : ''}</text>
      </g>
      <g>
        <path d="M150 52 h210 q16 0 16 16 v78 q0 16 -16 16 h-210 z" fill="#2e353a" stroke="#0a0d0f"/>
        <path d="M230 52 v-14 q0 -10 10 -10 h60 q10 0 10 10 v14" fill="#252b2f" stroke="#0a0d0f"/>
        <rect x="262" y="22" width="30" height="7" rx="2" fill="#12171a"/>
        <circle cx="338" cy="44" r="9" fill="#11161a" stroke="#555"/><circle cx="338" cy="44" r="3" fill="#FFB020"/>
        <rect x="320" y="34" width="26" height="6" rx="3" fill="#c0392f" transform="translate(0,-10)"/>
        <path d="M350 60 q26 0 26 24 v40 q0 14 -14 14 h-12" fill="#262c30" stroke="#0a0d0f"/>
        <rect x="150" y="62" width="14" height="94" fill="#12171a"/>
        <circle cx="150" cy="${ry + rh / 2}" r="${rh / 2 + 2}" fill="none" stroke="#12171a" stroke-width="5"/>
      </g></svg>`;
  }
  function paneLens() {
    const root = h('div');
    const rig = h('div'); const zoom = h('input', { type: 'range', min: 18, max: 45, step: 1, value: 30, 'aria-label': 'Zoom ring', oninput: (e) => { D('focal/set', { f: +e.target.value }); sim.redrawRig(); } });
    const zv = h('span'); const cards = h('div', { class: 'grid', style: { gap: '8px' } });
    const spec = h('div', { class: 'small muted' });
    root.append(rig, U.ctl('Zoom ring', zoom, 'Wider (smaller number) fits more in. Longer (bigger number) brings things closer and blurs backgrounds more.', zv), U.ctl('Lens locker', cards, 'Click a lens to mount it.'), h('div', { class: 'ctl' }, spec));
    FF.LENSES.forEach((l) => {
      cards.append(h('button', {
        class: 'lens-card', type: 'button', 'data-id': l.id, onclick: () => {
          const g = rig.querySelector('#lensg'); if (g) { g.style.transform = 'translateX(-60px)'; g.style.opacity = '0'; }
          setTimeout(() => { D('lens/set', { id: l.id, f: l.id === 'prime' ? 50 : l.fmin + (l.fmax - l.fmin) * 0.25 }); sim.redrawRig(); const g2 = rig.querySelector('#lensg'); if (g2) { g2.style.transform = 'translateX(-60px)'; g2.style.opacity = '0'; requestAnimationFrame(() => requestAnimationFrame(() => { g2.style.transform = ''; g2.style.opacity = '1'; })); } U.toast(l.name + ' mounted'); }, 280);
        }
      }, h('b', null, l.short), h('span', null, l.role + ' · ' + l.equiv + ' equiv.'), h('span', null, l.bestFor.join(' · '))));
    });
    sim.redrawRig = () => { rig.innerHTML = rigSVG(); };
    reg(() => {
      const l = C.lens(), s = S();
      zoom.min = l.fmin; zoom.max = l.fmax; zoom.value = s.f; zoom.disabled = l.fmin === l.fmax;
      zv.textContent = Math.round(s.f) + ' mm · ' + Math.round(C.fEq()) + ' mm equiv.';
      Array.from(cards.children).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === s.lens)));
      const r = C.apRange();
      spec.innerHTML = '<b>' + l.name + '</b><br>Aperture f/' + P.apertureValue(r[0]).toFixed(1) + ' – f/' + P.apertureValue(r[1]).toFixed(0) + ' at ' + Math.round(s.f) + ' mm · closest focus ' + U.fmt.dist(l.mfd(s.f)) + ' · ' + l.blades + ' blades · ' + l.weight + ' g · ' + (l.isStops ? l.isStops + '-stop IS' : 'no IS') + '<br>Field of view ' + P.fovH(s.f).toFixed(0) + '° wide.';
      sim.redrawRig();
    });
    sim.redrawRig();
    return root;
  }

  /* ---------- SCENE pane ---------- */
  function paneScene() {
    const root = h('div');
    const sel = h('select', { id: 'scenesel', 'aria-label': 'Scene', onchange: (e) => { sim.pickScene(e.target.value); } }, FF.SCENES.map((s) => h('option', { value: s.id }, s.name + ' · ' + s.skill)));
    const desc = h('div', { class: 'callout small' });
    const light = h('input', { type: 'range', min: -5, max: 3, step: 0.5, value: 0, 'aria-label': 'Light level', oninput: (e) => D('scene/light', { ev: +e.target.value }) });
    const lv = h('span');
    const cctT = U.toggle('Change colour of the light', S().cctOn, (v) => D('scene/cct', { on: v }));
    const cct = h('input', { type: 'range', min: 2000, max: 10000, step: 100, value: 5000, 'aria-label': 'Light colour temperature', oninput: (e) => D('scene/cct', { k: +e.target.value }) });
    const cv = h('span');
    const dist = h('input', { type: 'range', min: 1, max: 10, step: 0.1, value: 2, 'aria-label': 'Subject distance', oninput: (e) => D('scene/subject', { dist: +e.target.value }) });
    const dv = h('span');
    const spd = h('input', { type: 'range', min: 1, max: 10, step: 1, value: 5, 'aria-label': 'Subject speed', oninput: (e) => D('scene/subject', { speed: +e.target.value }) });
    const sv = h('span'); const spdCtl = U.ctl('Speed', spd, '', sv);
    const move = (i) => h('input', { type: 'range', min: -1, max: 1, step: 0.05, value: 0, 'aria-label': i ? 'Camera height' : 'Move left or right', oninput: (e) => { const ps = (S().pos || [0, 0]).slice(); ps[i] = +e.target.value; D('scene/move', { pos: ps, settle: true }); } });
    const mx = move(0), my = move(1), mxv = h('span'), myv = h('span');
    const roamCtl = h('div', null, U.ctl('Move left / right', mx, 'Walk around the subject. The camera keeps facing it. Keys: A and D.', mxv), U.ctl('Camera height', my, 'Crouch for a low angle or climb for a high one. Keys: Q and E. W and S walk closer or back.', myv));
    const pause = U.toggle('Pause the scene', S().paused, (v) => D('scene/pause', { on: v }));
    const aim = h('button', { class: 'btn sm', type: 'button', onclick: () => D('scene/move', { aim: [0, 0], settle: true }) }, 'Re-centre camera');
    root.append(
      U.ctl('Wall screen', sel), h('div', { class: 'ctl' }, desc),
      U.ctl('Light level', light, 'Dim or brighten the whole scene, from late dusk to bright sun.', lv),
      U.ctl('Light colour', h('div', { class: 'grid', style: { gap: '6px' } }, cctT, cct), 'Warm bulbs are about 2700 K. Daylight is about 5500 K. Cloudy shade is 7000 K and up.', cv),
      U.ctl('Distance to subject', dist, 'Walk closer or step back. Closer means a bigger subject and shallower depth of field.', dv), roamCtl, spdCtl,
      U.ctl('Playback', h('div', { class: 'row' }, pause, aim), 'Drag on the viewfinder to aim the camera. Scroll over it to change the main setting.')
    );
    reg(() => {
      const sc = C.scene(), s = S();
      sel.value = s.scene; desc.innerHTML = '<b>' + sc.skill + '.</b> ' + sc.desc + '<br><span class="muted">Tip: ' + sc.tip + '</span>';
      light.value = s.light; lv.textContent = U.fmt.ev(s.light) + ' EV';
      cctT.input.checked = s.cctOn; cct.value = s.cct; cv.textContent = Math.round(C.sceneCCT()) + ' K';
      dist.min = sc.subj.min; dist.max = sc.subj.max; dist.value = s.subjD; dv.textContent = sc.subj.label + ' at ' + U.fmt.dist(s.subjD);
      spdCtl.style.display = sc.speed ? '' : 'none'; roamCtl.style.display = sc.roam ? '' : 'none';
      if (sc.roam) { const ps = s.pos || (s.pos = [0, 0]); mx.min = -sc.roam.x; mx.max = sc.roam.x; mx.value = ps[0]; my.min = sc.roam.y[0]; my.max = sc.roam.y[1]; my.value = ps[1]; mxv.textContent = (ps[0] === 0 ? 'centre' : U.fmt.dist(Math.abs(ps[0])) + (ps[0] < 0 ? ' left' : ' right')); myv.textContent = (ps[1] >= 0 ? '+' : '−') + U.fmt.dist(Math.abs(ps[1])); }
      if (sc.speed) { spd.min = sc.speed.min; spd.max = sc.speed.max; spd.step = sc.speed.step; spd.value = s.speed; sv.textContent = s.speed + ' ' + sc.speed.unit; spdCtl.querySelector('.lab span').textContent = sc.speed.label; }
    });
    return root;
  }

  /* ---------- DEPTH pane (top-down diagram) ---------- */
  function paneDepth() {
    const root = h('div');
    const cv = h('canvas', { class: 'topdown', width: 640, height: 260 });
    const txt = h('div', { class: 'small muted' });
    root.append(h('div', { class: 'ctl' }, h('div', { class: 'hint' }, 'A bird’s-eye view. The camera is on the left. The amber band is the zone that looks sharp. Everything outside it is blurred by an amount that grows with distance from the focus plane.')), cv, h('div', { class: 'ctl' }, txt));
    sim.depthCanvas = cv;
    reg(() => {
      if (!cv.offsetParent) return;
      const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, sc = C.scene(), s = S();
      const cs = getComputedStyle(document.documentElement);
      const ink = cs.getPropertyValue('--ink').trim() || '#000', muted = cs.getPropertyValue('--muted').trim(), accent = cs.getPropertyValue('--accent').trim();
      ctx.clearRect(0, 0, W, H);
      const dmax = Math.max(sc.bg[sc.bg.length - 1] > 100 ? sc.bg[Math.max(0, sc.bg.length - 2)] * 1.15 : sc.bg[sc.bg.length - 1] * 1.15, s.subjD * 2);
      const xOf = (d) => 40 + (W - 70) * Math.pow(Math.min(d, dmax) / dmax, 0.6);
      const d = C.hyper();
      const cy = H / 2;
      const near = xOf(d.near), far = d.far === Infinity ? W - 12 : xOf(d.far);
      ctx.fillStyle = accent; ctx.globalAlpha = 0.22; ctx.fillRect(near, 24, far - near, H - 48); ctx.globalAlpha = 1;
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xOf(s.focusDist), 20); ctx.lineTo(xOf(s.focusDist), H - 20); ctx.stroke();
      ctx.fillStyle = muted; ctx.font = '12px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
      [1, 2, 5, 10, 20, 50].filter((v) => v < dmax).forEach((v) => { const x = xOf(v); ctx.fillRect(x, H - 20, 1, 6); ctx.fillText(v + ' m', x, H - 4); });
      // camera and field of view
      ctx.fillStyle = ink; ctx.fillRect(10, cy - 10, 22, 20);
      const half = Math.atan(P.SENSOR.w / (2 * s.f)); ctx.strokeStyle = muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(32, cy); ctx.lineTo(W - 10, cy - (W - 42) * Math.tan(half) * 0.25); ctx.moveTo(32, cy); ctx.lineTo(W - 10, cy + (W - 42) * Math.tan(half) * 0.25); ctx.stroke();
      // subjects
      const items = [[s.subjD, sc.subj.label, true]].concat(sc.bg.filter((b) => b <= dmax).map((b, i) => [b, 'Background ' + (i + 1), false]));
      items.forEach(([dist, label, main], i) => {
        const x = xOf(dist), coc = P.coc(s.f, C.eff.N, s.focusDist * 1000, dist * 1000) / P.SENSOR.pitch;
        ctx.fillStyle = main ? ink : muted; ctx.beginPath(); ctx.arc(x, cy + (i % 2 ? 36 : -36), main ? 9 : 7, 0, 7); ctx.fill();
        ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.fillText(label, x, cy + (i % 2 ? 62 : -50)); ctx.fillStyle = muted; ctx.fillText(Math.round(coc) + ' px blur', x, cy + (i % 2 ? 76 : -38));
      });
      txt.textContent = 'Focused at ' + U.fmt.dist(s.focusDist) + '. Sharp zone ' + U.fmt.dist(d.near) + ' to ' + (d.far === Infinity ? '∞' : U.fmt.dist(d.far)) + ' (' + (d.far === Infinity ? 'everything beyond the near limit' : U.fmt.dist(d.far - d.near) + ' deep') + ') at ' + P.fmtAperture(C.eff.N) + ' and ' + Math.round(s.f) + ' mm.';
    });
    return root;
  }

  sim.buildDeck = function () {
    const tabs = [['Exposure', paneExposure], ['Focus', paneFocus], ['Colour', paneColor], ['Drive', paneDrive], ['Lens', paneLens], ['Scene', paneScene], ['Depth', paneDepth]];
    const bar = h('div', { class: 'tabs', role: 'tablist' }), panes = [];
    tabs.forEach(([name, fn], i) => {
      const p = h('div', { class: 'pane' + (i === 0 ? ' on' : ''), role: 'tabpanel' }, fn());
      const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(i === 0), onclick: () => { Array.from(bar.children).forEach((x, j) => { x.setAttribute('aria-selected', String(j === i)); panes[j].classList.toggle('on', j === i); }); sim.refreshControls(); } }, name);
      bar.append(b); panes.push(p);
    });
    sim.selectTab = (i) => bar.children[i].click();
    return h('div', { class: 'deck' }, bar, panes);
  };
})();
