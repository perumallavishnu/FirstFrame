/* sim_view.js: viewfinder, HUD, input, shutter flow, review. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const P = FF.phys, C = FF.cam, U = FF.ui, h = U.h, $ = U.$;
  const sim = (FF.sim = FF.sim || {});
  sim.active = false; sim.busy = false;
  const S = () => C.state;
  let vf, ctx, ov, octx, hud = {}, msgEl, flashEl, countEl, busyEl, raf = 0, grid = false, mag = false, thumbs = {}, holding = false;
  const VW = 720, VH = 480;

  /* ---------- sound ---------- */
  let actx;
  function click() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const n = actx.createBufferSource(), b = actx.createBuffer(1, 2400, 22050), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 380) * (i < 900 ? 1 : 0.6);
      n.buffer = b; const g = actx.createGain(); g.gain.value = 0.25; n.connect(g).connect(actx.destination); n.start();
    } catch (e) {}
  }

  /* ---------- wall thumbnails ---------- */
  sim.dropThumb = (id) => { delete thumbs[id]; };
  sim.makeThumb = function (id) {
    if (thumbs[id]) return thumbs[id];
    const sc = FF.sceneById(id), lens = FF.lensById(sc.start.lens);
    const f = sc.start.f, nMax = lens.at(f, lens.maxAp), N = Math.max(nMax, 4);
    const cfg = { scene: id, lens: lens.id, f, N, focusM: sc.subj.def, t0: id === 'car' ? 1.55 : id === 'fan' ? 3.0 : 8.0, T: 1 / 250, subjD: sc.subj.def, speed: sc.speed ? sc.speed.def : 0 };
    if (id === 'cafe' || id === 'candle') cfg.N = nMax;
    let p = FF.buildParams(cfg); const m = FF.Renderer.meter(p);
    const L = P.meterReading(m.lum, 'evaluative', m.gx, m.gy, { x: 0.5, y: 0.5 });
    let t = 1 / 125, iso = Math.min(12800, Math.max(100, P.solveISO(sc.ev + Math.log2(L), cfg.N, t)));
    if (iso >= 6400) { t = 1 / 30; iso = Math.min(12800, Math.max(100, P.solveISO(sc.ev + Math.log2(L), cfg.N, t))); }
    cfg.T = t; p = FF.buildParams(cfg);
    const o = Object.assign(FF.buildDisplay({ iso, M: 8, wbK: sc.cct < 2500 ? 3000 : sc.cct, style: [0.25, 1.1] }), { w: 240, h: 160, win: FF.fullWindow(), ns: 24, passes: 2, seed: 3 });
    FF.Renderer.render(p, o);
    const c = document.createElement('canvas'); c.width = 240; c.height = 160; FF.Renderer.blit(c.getContext('2d'), 240, 160);
    return (thumbs[id] = c.toDataURL('image/jpeg', 0.8));
  };

  /* ---------- build ---------- */
  sim.build = function (root) {
    const wall = h('div', { class: 'wall', role: 'group', 'aria-label': 'Scene wall' });
    FF.SCENES.forEach((sc) => wall.append(h('button', { class: 'screen', type: 'button', 'data-id': sc.id, 'aria-pressed': 'false', onclick: () => sim.pickScene(sc.id) }, h('img', { alt: sc.name, width: 240, height: 160 }), h('div', { class: 'cap' }, h('b', null, sc.name), h('span', null, sc.skill)))));
    sim.wall = wall;

    // mode dial
    const knobSvg = h('div', { html: '<svg class="knob" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="#11161a" stroke="#3b454b" stroke-width="3"/><g class="needle" id="needle"><rect x="47" y="8" width="6" height="26" rx="2" fill="#FFB020"/></g><circle cx="50" cy="50" r="10" fill="#2b3338"/></svg>' });
    const modeSeg = U.seg(FF.MODES.map((m) => ({ v: m.id, label: m.label, title: m.name })), S().mode, (v) => sim.setMode(v));
    sim.modeSeg = modeSeg;
    sim.setKnob = () => { const i = FF.MODES.findIndex((m) => m.id === S().mode); const n = $('#needle', knobSvg); if (n) n.style.transform = 'rotate(' + (-75 + i * 30) + 'deg)'; modeSeg.set(S().mode); const scnWrap = $('#scnwrap'); if (scnWrap) scnWrap.style.display = S().mode === 'SCN' ? '' : 'none'; };
    const scnSeg = U.seg(FF.SCN.map((m) => ({ v: m.id, label: m.label, title: m.desc })), S().scn, (v) => FF.act.dispatch('scn/set', { scn: v }, 'viewfinder'));
    const lensName = h('div', { class: 'lens-name' });
    const top = h('div', { class: 'body-top' }, h('div', { class: 'modes' }, knobSvg, modeSeg, h('span', { id: 'scnwrap', style: { display: 'none' } }, scnSeg)), lensName);

    // viewfinder
    vf = h('canvas', { width: VW, height: VH, id: 'vfc', 'aria-label': 'Viewfinder' }); ov = h('canvas', { width: VW, height: VH, style: { pointerEvents: 'none' } });
    ctx = vf.getContext('2d'); octx = ov.getContext('2d');
    const T = (cls, txt) => (hud[cls] = h('span', { class: cls }, txt));
    const ptr = h('div', { class: 'ptr' }); hud.ptr = ptr;
    const eb = h('div', { class: 'eb' }, h('div', { class: 'scale' }));
    for (let i = -3; i <= 3; i++) { eb.append(h('div', { class: 'tick' + (i === 0 ? ' mid' : ''), style: { left: 50 + i * (100 / 6) + '%' } })); if (i % 1 === 0) eb.append(h('div', { class: 'num', style: { left: 50 + i * (100 / 6) + '%' } }, i === 0 ? '0' : (i > 0 ? '+' : '−') + Math.abs(i))); }
    eb.append(ptr);
    msgEl = h('div', { class: 'msg' }); flashEl = h('div', { class: 'flashfx' }); countEl = h('div', { class: 'count' }); busyEl = h('div', { class: 'busy' }, h('i'));
    const vfBox = h('div', { class: 'vf', tabindex: 0, role: 'img', 'aria-label': 'Live viewfinder. Click to move the AF point, drag to aim, scroll to change the main setting.' },
      vf, ov,
      h('div', { class: 'hud hud-top' }, h('div', { class: 'grp' }, T('modeb', ''), T('wbt', ''), T('mett', ''), T('aft', '')), h('div', { class: 'grp' }, T('drv', ''), T('left', ''), '▮▮▮')),
      h('div', { class: 'hud hud-bot' }, h('div', { class: 'grp' }, h('span', null, h('span', { class: 'big shv' }, ''), h('span', { class: 'lbl' }, ' s')), h('span', { class: 'big apv' }, ''), h('span', null, h('span', { class: 'lbl' }, 'ISO '), h('span', { class: 'big isov' }, '')), h('span', { class: 'ecv' }, '')), eb),
      msgEl, flashEl, countEl, busyEl);
    sim.vfBox = vfBox;
    hud.shv = $('.shv', vfBox); hud.apv = $('.apv', vfBox); hud.isov = $('.isov', vfBox); hud.ecv = $('.ecv', vfBox);

    // bottom controls
    const shutter = h('button', { class: 'shutter', type: 'button', 'aria-label': 'Shutter button. Press and hold in continuous mode.' });
    sim.shutterBtn = shutter;
    const aeL = h('button', { type: 'button', title: 'AE lock (L)', onclick: () => C.lockAE() }, '★ AE-L');
    const afOn = h('button', { type: 'button', title: 'Focus now (F)', onclick: () => { C.afPress(); sim.msg(S().afState === 'fail' ? S().afNote : 'Focused'); } }, 'AF-ON');
    const gridB = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => { grid = !grid; gridB.setAttribute('aria-pressed', String(grid)); } }, 'GRID');
    const magB = h('button', { type: 'button', 'aria-pressed': 'false', title: 'Magnify around the AF point (check manual focus)', onclick: () => { mag = !mag; magB.setAttribute('aria-pressed', String(mag)); } }, '6× MAG');
    const revB = h('button', { type: 'button', onclick: () => { if (C.shots.length) sim.openReview([C.shots[0]], 0); else U.toast('Take a photo first'); } }, '▶ REVIEW');
    sim.aeLBtn = aeL;
    const bot = h('div', { class: 'body-bot' }, h('div', { class: 'cb' }, aeL, afOn, gridB), shutter, h('div', { class: 'cb r' }, magB, revB));
    const zoomR = h('div', { class: 'zoomring' }, h('span', null, 'ZOOM'), h('input', { type: 'range', min: 18, max: 45, step: 1, value: 30, id: 'zr', 'aria-label': 'Zoom ring', oninput: (e) => FF.act.dispatch('focal/set', { f: +e.target.value }, 'viewfinder') }), h('span', { id: 'zrv' }, ''));
    const body = h('div', { class: 'body' }, top, vfBox, bot, zoomR);
    const coach = h('div', { class: 'coach', id: 'coach' });
    sim.coachEl = coach;
    const left = h('div', { class: 'sim-left' }, wall, body, coach);
    const deck = sim.buildDeck();
    root.replaceChildren(h('div', { class: 'sim' }, left, deck));
    sim.lensName = lensName;
    bindInput(vfBox, shutter);
    sim.refreshControls(); sim.setKnob();
  };

  /* ---------- scene switching ---------- */
  sim.pickScene = function (id) {
    C.setScene(id); C.liveShake = null;
    sim.refreshControls(); sim.hudDirty = true;
    const sc = FF.sceneById(id);
    sim.msg(sc.name + ': ' + sc.skill);
    $$wall();
  };
  function $$wall() { Array.from(sim.wall.children).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === S().scene))); }
  sim.msg = function (t, ms) { msgEl.textContent = t; msgEl.classList.add('on'); clearTimeout(sim._mt); sim._mt = setTimeout(() => msgEl.classList.remove('on'), ms || 2200); };

  /* ---------- input ---------- */
  function bindInput(box, shutter) {
    let down = null, moved = false;
    box.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, aim: S().aim.slice() }; moved = false; box.setPointerCapture(e.pointerId); });
    box.addEventListener('pointermove', (e) => {
      if (!down) return; const r = box.getBoundingClientRect(), dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 6) moved = true;
      if (moved) { const fov = P.fovH(S().f) * Math.PI / 180; { const lk = C.scene().look; FF.act.dispatch('scene/move', { aim: [lk ? ((down.aim[0] - dx / r.width * fov + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI : P.clamp(down.aim[0] - dx / r.width * fov, -0.3, 0.3), P.clamp(down.aim[1] + dy / r.width * fov, lk ? -0.7 : -0.2, lk ? 0.9 : 0.2)] }, 'viewfinder'); } }
    });
    box.addEventListener('pointerup', (e) => {
      if (!down) return; const r = box.getBoundingClientRect();
      if (!moved && S().afArea === '1pt' && S().mode !== 'A+' && S().mode !== 'SCN') { FF.act.dispatch('af/point', { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }, 'viewfinder'); FF.act.dispatch('af/press', {}, 'viewfinder'); sim.msg(S().afState === 'fail' ? S().afNote : 'AF point moved'); }
      else if (moved) FF.act.dispatch('scene/move', { settle: true, aim: S().aim }, 'viewfinder');
      down = null;
    });
    box.addEventListener('wheel', (e) => {
      const m = S().mode, d = e.deltaY > 0 ? 1 : -1;
      if (m === 'Av') sim.stepAperture(d); else if (m === 'Tv' || m === 'M') sim.stepShutter(d); else if (m === 'P') sim.stepEC(-d); else return;
      e.preventDefault();
    }, { passive: false });
    const press = () => { if (S().drive === 'cont') startBurst(); else sim.shutter(); };
    shutter.addEventListener('pointerdown', (e) => { e.preventDefault(); shutter.classList.add('down'); if (S().drive === 'cont') startBurst(); });
    shutter.addEventListener('pointerup', () => { shutter.classList.remove('down'); holding = false; });
    shutter.addEventListener('pointerleave', () => { holding = false; shutter.classList.remove('down'); });
    shutter.addEventListener('click', () => { if (S().drive !== 'cont') sim.shutter(); });
    window.addEventListener('keydown', (e) => {
      if (!sim.active || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.type !== 'range') return;
      if (document.querySelector('.review.on')) { if (e.key === 'Escape') sim.closeReview(); return; }
      if (e.code === 'Space') { e.preventDefault(); if (e.repeat) return; if (S().drive === 'cont') startBurst(); else sim.shutter(); }
      else if (e.key === 'f' || e.key === 'F') { FF.act.dispatch('af/press', {}, 'viewfinder'); sim.msg(S().afState === 'fail' ? S().afNote : 'Focused'); }
      else if (e.key === 'l' || e.key === 'L') FF.act.dispatch('ae/lock', {}, 'viewfinder');
      else if (C.scene().three && 'adqews'.indexOf(e.key.toLowerCase()) >= 0 && !e.ctrlKey && !e.metaKey) { const s = S(), sc = C.scene(), k = e.key.toLowerCase(), st = sc.roam.x / 14; const ps = (s.pos || [0, 0]).slice();
        if (k === 'a') ps[0] = Math.max(-sc.roam.x, ps[0] - st); if (k === 'd') ps[0] = Math.min(sc.roam.x, ps[0] + st); if (k === 'q') ps[1] = Math.max(sc.roam.y[0], ps[1] - st * 0.5); if (k === 'e') ps[1] = Math.min(sc.roam.y[1], ps[1] + st * 0.5);
        if (k === 'w' || k === 's') FF.act.dispatch('scene/subject', { dist: k === 'w' ? Math.max(sc.subj.min, s.subjD * 0.94) : Math.min(sc.subj.max, s.subjD / 0.94) }, 'viewfinder');
        else FF.act.dispatch('scene/move', { pos: ps, settle: true }, 'viewfinder'); }
      else if (e.key === 'ArrowLeft') { S().mode === 'Tv' || S().mode === 'M' ? sim.stepShutter(1) : sim.stepAperture(1); }
      else if (e.key === 'ArrowRight') { S().mode === 'Tv' || S().mode === 'M' ? sim.stepShutter(-1) : sim.stepAperture(-1); }
    });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') holding = false; });
    window.addEventListener('pointerup', () => { holding = false; });
  }

  /* ---------- shutter flow ---------- */
  function beep(n) { countEl.textContent = n; countEl.classList.toggle('on', !!n); }
  async function preShot() {
    const s = S();
    if (s.afMode !== 'mf') { C.afPress(true); if (s.afState === 'fail' && s.afMode === 'oneshot') { sim.msg('No photo: autofocus did not lock. ' + s.afNote, 3200); return false; } s.focusDist = s.focusTarget; }
    C.refreshMeter(true);
    if (C.eff.flashOn) { sim.msg('Flash!', 600); }
    return true;
  }
  sim.shutter = async function () {
    if (sim.busy) return;
    const s = S();
    if (s.drive === 't2' || s.drive === 't10') {
      sim.busy = true; for (let n = s.drive === 't2' ? 2 : 10; n > 0; n--) { beep(n); await new Promise((r) => setTimeout(r, 1000)); } beep(0); sim.busy = false;
    }
    if (!(await preShot())) return;
    sim.busy = true; click(); flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on');
    busyEl.classList.add('on'); const bar = busyEl.firstChild;
    const eff = C.eff; if (eff.t >= 0.5) sim.msg('Exposing for ' + P.fmtShutter(eff.t) + (eff.t >= 0.28 ? '' : ' s') + ' (simulated)…', 1500);
    const shot = await C.shoot({ onProgress: (f) => (bar.style.width = f * 100 + '%') });
    busyEl.classList.remove('on'); bar.style.width = '0'; sim.busy = false;
    afterShot(shot);
    sim.openReview([shot], 0);
  };
  async function startBurst() {
    if (sim.busy) return; holding = true;
    if (!(await preShot())) { holding = false; return; }
    sim.busy = true; const fps = C.driveFps(), frames = [], t00 = performance.now();
    for (let i = 0; i < FF.BODY.buffer && (holding || i === 0); i++) {
      click(); flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on');
      const shot = await C.shoot({ offset: i / fps, w: 720, h: 480, passes: 3 }); frames.push(shot); afterShot(shot, true);
      sim.msg('Burst: ' + frames.length + ' frames', 500);
      const wait = (i + 1) / fps * 1000 - (performance.now() - t00); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
    holding = false; sim.busy = false;
    sim.openReview(frames, 0);
  }
  function afterShot(shot, quiet) {
    FF.progress && FF.progress.onShot(shot);
    const pf = U.store.get('portfolio', []);
    pf.unshift({ id: shot.id + '-' + shot.plan.time, thumb: shot.thumb, t: shot.plan.time, scene: shot.plan.state.scene, lens: shot.plan.state.lens, f: Math.round(shot.plan.cfg.f), N: shot.plan.eff.N, tv: shot.plan.eff.t, iso: shot.plan.eff.iso, mode: shot.plan.state.mode, score: shot.analysis.score });
    if (!quiet || pf.length % 4 === 0) U.store.set('portfolio', pf.slice(0, 24));
  }

  /* ---------- render loop ---------- */
  function drawOverlay() {
    const s = S(); octx.clearRect(0, 0, VW, VH);
    octx.lineWidth = 2;
    if (grid) { octx.strokeStyle = 'rgba(255,255,255,.35)'; octx.lineWidth = 1; octx.beginPath(); for (let i = 1; i < 3; i++) { octx.moveTo(VW * i / 3, 0); octx.lineTo(VW * i / 3, VH); octx.moveTo(0, VH * i / 3); octx.lineTo(VW, VH * i / 3); } octx.stroke(); octx.lineWidth = 2; }
    const pt = (s.afMode === 'mf') ? null : (s.afAuto || s.af);
    const m = s.meter, auto = s.mode === 'A+' || s.mode === 'SCN';
    if (!auto && (m === 'spot' || m === 'partial')) { octx.strokeStyle = 'rgba(255,255,255,.5)'; octx.setLineDash([4, 4]); octx.beginPath(); octx.ellipse(VW / 2, VH / 2, VW * (m === 'spot' ? 0.07 : 0.103), VH * (m === 'spot' ? 0.105 : 0.155), 0, 0, 7); octx.stroke(); octx.setLineDash([]); }
    if (pt) {
      const age = performance.now() - (s.afFlash || 0), col = s.afState === 'fail' ? '#ff5a4d' : s.afState === 'locked' ? (age < 700 || s.afMode === 'servo' ? '#3cc79a' : 'rgba(255,255,255,.85)') : '#fff';
      octx.strokeStyle = col; const w = 62, hh = 50, x = pt.x * VW - w / 2, y = pt.y * VH - hh / 2, c = 12;
      octx.beginPath(); [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + hh, 1, -1], [x + w, y + hh, -1, -1]].forEach(([cx, cy, sx, sy]) => { octx.moveTo(cx, cy + sy * c); octx.lineTo(cx, cy); octx.lineTo(cx + sx * c, cy); }); octx.stroke();
      if (pt.face) { octx.beginPath(); octx.arc(pt.x * VW, pt.y * VH, 6, 0, 7); octx.stroke(); }
    }
    if (mag) { octx.strokeStyle = '#FFB020'; octx.strokeRect(2, 2, VW - 4, VH - 4); octx.fillStyle = '#FFB020'; octx.font = '700 14px IBM Plex Mono, monospace'; octx.fillText('6× MAGNIFIED', 12, VH - 14); }
  }
  function updateHUD() {
    const s = S(), e = C.eff, m = FF.MODES.find((x) => x.id === s.mode);
    const auto = (k) => (m.auto.includes(k) ? ' auto' : '');
    hud.modeb.innerHTML = '<span class="modebadge">' + s.mode + '</span>';
    hud.wbt.textContent = 'WB ' + (s.wb === 'awb' || s.wb === 'awbw' ? 'AWB' : Math.round(C.wbKelvin()) + 'K');
    hud.mett.textContent = (s.mode === 'A+' || s.mode === 'SCN' ? 'EVAL' : { evaluative: 'EVAL', partial: 'PART', spot: 'SPOT', center: 'CTR' }[s.meter]) + (s.aeLock != null ? ' ★' : '');
    hud.aft.textContent = { oneshot: 'ONE SHOT', servo: 'SERVO', mf: 'MF' }[s.afMode];
    hud.drv.textContent = { single: '□ SINGLE', cont: '▣ CONT', t2: '⏱ 2s', t10: '⏱ 10s' }[s.drive] + (e.flashOn ? ' ⚡' : '') + (s.stab === 'tripod' ? ' ⌗' : '');
    hud.left.textContent = (3128 - C.shots.length) + ' ▤';
    hud.shv.textContent = P.fmtShutter(e.t); hud.shv.className = 'big shv' + (m.auto.includes('t') || s.mode === 'A+' || s.mode === 'SCN' ? ' auto' : '') + (e.t > C.tSafe() && s.stab !== 'tripod' ? ' warn' : '');
    hud.apv.textContent = P.fmtAperture(e.N); hud.apv.className = 'big apv' + (m.auto.includes('N') ? ' auto' : '');
    hud.isov.textContent = Math.round(e.iso); hud.isov.className = 'big isov' + (C.isoAutoNow() ? ' auto' : '');
    hud.ecv.textContent = s.ec ? 'EC ' + (s.ec > 0 ? '+' : '') + U.fmt.ec(s.ec) : '';
    const ind = P.clamp(e.ind - 0, -3.3, 3.3); hud.ptr.style.left = 50 + ind * (100 / 6) + '%'; hud.ptr.classList.toggle('out', Math.abs(e.ind) > 3);
    sim.lensName.textContent = C.lens().name + ' · ' + Math.round(s.f) + ' mm · ' + P.fmtAperture(e.N);
    const zr = $('#zr'); if (zr) { const l = C.lens(); zr.min = l.fmin; zr.max = l.fmax; zr.value = s.f; zr.disabled = l.fmin === l.fmax; $('#zrv').textContent = Math.round(s.f) + ' mm'; }
    sim.aeLBtn.setAttribute('aria-pressed', String(s.aeLock != null));
    coach();
  }
  function coach() {
    const s = S(), e = C.eff, lines = [];
    const add = (cls, b, t) => lines.push(h('div', { class: 'line ' + cls }, h('b', null, b), h('span', null, t)));
    if (s.afState === 'fail') add('bad', 'Focus', s.afNote);
    if (Math.abs(e.ind) > 1.3) add('warn', e.ind > 0 ? 'Overexposed' : 'Underexposed', 'The meter says this will be ' + Math.abs(e.ind).toFixed(1) + ' stops ' + (e.ind > 0 ? 'too bright' : 'too dark') + '. ' + (s.mode === 'M' ? 'Change shutter, aperture or ISO until the pointer reaches 0.' : 'Use exposure compensation or change the limits.'));
    if (e.t > C.tSafe() && s.stab !== 'tripod') add('warn', 'Shake risk', P.fmtShutter(e.t) + ' s is slower than 1/' + Math.round(1 / C.tSafe()) + ' s for ' + Math.round(s.f) + ' mm. Use a tripod or a faster shutter.');
    if (e.notes && e.notes.length) add('', 'Flash', e.notes[0]);
    if (!lines.length) add('ok', 'Ready', C.scene().tip);
    sim.coachEl.replaceChildren(...lines.slice(0, 3));
  }

  let last = 0, meterT = 0, histT = 0, hudT = 0, slow = 0, lastRender = 0, depthT = 0;
  function frame(ts) {
    raf = 0; if (!sim.active) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (ts - last) / 1000); last = ts;
    if (document.querySelector('.review.on')) return;
    C.tick(dt);
    if (sim.busy) return;
    if (ts - lastRender < 36) return; lastRender = ts;
    meterT += dt; hudT += dt; histT += dt; depthT += dt;
    if (meterT > 0.2) { meterT = 0; C.refreshMeter(); sim.hudDirty = true; }
    const t0 = performance.now();
    C.renderPreview(ctx, VW, VH, { zoom: mag });
    const ms = performance.now() - t0; slow = slow * 0.9 + ms * 0.1;
    if (slow > 70 && C.quality > 0.6) { C.quality = 0.6; } else if (slow < 25 && C.quality < 1 && !sim.lowQ) C.quality = 1;
    drawOverlay();
    if (hudT > 0.1 || sim.hudDirty) { hudT = 0; sim.hudDirty = false; updateHUD(); }
    if (histT > 0.33) { histT = 0; drawHist(sim.histCanvas, vf); }
    if (depthT > 0.4) { depthT = 0; sim.refreshControls(); }
  }
  sim.start = function () {
    if (!FF.Renderer.ok) return; sim.active = true; last = performance.now();
    $$wall(); sim.refreshControls(); sim.hudDirty = true;
    if (!raf) raf = requestAnimationFrame(frame);
  };
  sim.stop = function () { sim.active = false; };

  /* ---------- histogram ---------- */
  const hc = document.createElement('canvas'); hc.width = 96; hc.height = 64; const hx = hc.getContext('2d', { willReadFrequently: true });
  function drawHist(cv, src) {
    if (!cv || !cv.offsetParent) return;
    hx.drawImage(src, 0, 0, 96, 64); const d = hx.getImageData(0, 0, 96, 64).data;
    const H = { r: new Float32Array(64), g: new Float32Array(64), b: new Float32Array(64) };
    for (let i = 0; i < d.length; i += 4) { H.r[d[i] >> 2]++; H.g[d[i + 1] >> 2]++; H.b[d[i + 2] >> 2]++; }
    sim.paintHist(cv, H);
  }
  sim.paintHist = function (cv, H) {
    const c = cv.getContext('2d'), W = cv.width, HH = cv.height; c.clearRect(0, 0, W, HH);
    let mx = 1; ['r', 'g', 'b'].forEach((k) => H[k].forEach((v) => (mx = Math.max(mx, v)))); mx = Math.sqrt(mx);
    c.globalCompositeOperation = 'lighter';
    [['r', '#e5484d'], ['g', '#3cc79a'], ['b', '#4c8dff']].forEach(([k, col]) => { c.fillStyle = col; c.globalAlpha = 0.75; for (let i = 0; i < 64; i++) { const v = Math.sqrt(H[k][i]) / mx; c.fillRect(i * W / 64, HH - v * (HH - 4), W / 64 + 0.6, v * (HH - 4)); } });
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1; c.beginPath(); for (let i = 1; i < 4; i++) { c.moveTo(W * i / 4, 0); c.lineTo(W * i / 4, HH); } c.stroke();
  };

  /* ---------- review ---------- */
  let rv, rvShots = [], rvIdx = 0, rvHi = false;
  sim.closeReview = function () { rv && rv.classList.remove('on'); };
  sim.openReview = function (shots, idx) {
    rvShots = shots; rvIdx = idx || 0;
    if (!rv) { rv = h('div', { class: 'review', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Photo review' }); document.body.append(rv); rv.addEventListener('click', (e) => { if (e.target === rv) sim.closeReview(); }); }
    renderReview(); rv.classList.add('on'); rv.scrollTop = 0;
  };
  function renderReview() {
    const shot = rvShots[rvIdx], a = shot.analysis, pl = shot.plan, e = pl.eff;
    const img = h('img', { src: shot.url, alt: 'Captured photo', width: 1080, height: 720 });
    const over = h('canvas', { class: 'over', width: 270, height: 180 }); const box = h('div', { class: 'rv-img' }, img, over);
    const hist = h('canvas', { class: 'hist', width: 256, height: 86 });
    const hi = U.toggle('Highlight alert', rvHi, (v) => { rvHi = v; paintBlink(); });
    function paintBlink() { const c = over.getContext('2d'); c.clearRect(0, 0, 270, 180); if (!rvHi) return; const t = document.createElement('canvas'); t.width = 270; t.height = 180; const tx = t.getContext('2d', { willReadFrequently: true }); tx.drawImage(shot.canvas, 0, 0, 270, 180); const d = tx.getImageData(0, 0, 270, 180); const o = c.createImageData(270, 180); for (let i = 0; i < d.data.length; i += 4) if (d.data[i] > 250 || d.data[i + 1] > 250 || d.data[i + 2] > 250) { o.data[i] = 255; o.data[i + 1] = 40; o.data[i + 2] = 40; o.data[i + 3] = 220; } c.putImageData(o, 0, 0); }
    const cropHost = h('div'); const zoomBtn = h('button', { class: 'btn sm', type: 'button', onclick: zoom100 }, 'Check at 100%');
    let cropping = false;
    async function zoom100() {
      if (cropping) return; cropping = true; zoomBtn.textContent = 'Developing 100% crop…';
      const cv = await C.crop100(shot, pl.afPt.x, pl.afPt.y); cropping = false; zoomBtn.textContent = 'Check at 100% again';
      cropHost.replaceChildren(h('div', { class: 'small muted' }, 'This is a 100% crop around the focus point: one screen pixel = one sensor pixel. Fine detail, shake blur and noise show up here.'), h('div', { class: 'rv-crop' }, cv));
    }
    const ex = h('div', { class: 'exif' },
      h('div', null, h('small', null, 'SHUTTER'), P.fmtShutter(e.t)), h('div', null, h('small', null, 'APERTURE'), P.fmtAperture(e.N)), h('div', null, h('small', null, 'ISO'), Math.round(e.iso)), h('div', null, h('small', null, 'FOCAL'), Math.round(pl.cfg.f) + ' mm'));
    const meta = h('div', { class: 'mini' }, h('span', null, pl.state.mode + ' mode'), h('span', null, FF.lensById(pl.state.lens).short), h('span', null, 'WB ' + Math.round(pl.wbK) + ' K'), h('span', null, pl.state.stab === 'tripod' ? 'Tripod' : 'Hand-held'), h('span', null, 'Meter: ' + pl.meterInfo.region + ' EV ' + pl.meterInfo.EVm.toFixed(1)), e.flashOn ? h('span', null, 'Flash') : null);
    const issues = h('div', { class: 'grid', style: { gap: '6px' } }, a.issues.map((i) => h('div', { class: 'issue ' + i.level }, h('span', { class: 'dot' }), h('div', null, h('b', null, i.title), ' ', h('span', { class: 'muted' }, i.detail), i.fix ? h('div', { class: 'fix' }, 'Fix: ' + i.fix) : null))));
    const mres = FF.missions && FF.missions.evaluate ? FF.missions.evaluate(shot) : null;
    const film = rvShots.length > 1 ? h('div', null, h('div', { class: 'small muted' }, rvShots.length + ' frames. Pick the sharpest one.'), h('div', { class: 'film' }, rvShots.map((s, i) => h('button', { type: 'button', 'aria-pressed': String(i === rvIdx), onclick: () => { rvIdx = i; renderReview(); } }, h('img', { src: s.thumb, alt: 'Frame ' + (i + 1) }))))) : null;
    const close = h('button', { class: 'btn primary', type: 'button', onclick: sim.closeReview }, 'Back to shooting');
    rv.replaceChildren(h('div', { class: 'rv' },
      h('div', { style: { minWidth: 0 } }, box, film, cropHost),
      h('div', { class: 'rv-side' },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { style: { margin: 0 } }, 'Photo review'), h('span', { class: 'tag ' + (a.score >= 75 ? 'ok' : a.score >= 50 ? 'warn' : 'bad') }, 'Score ' + a.score)),
        ex, meta, hist, h('div', { class: 'row' }, hi, zoomBtn),
        mres ? mres : null,
        h('div', null, h('h4', null, 'What happened'), issues),
        h('div', { class: 'row' }, close, h('a', { class: 'btn', href: '#portfolio', onclick: sim.closeReview }, 'Portfolio'))
      )));
    sim.paintHist(hist, a.px.hist);
    paintBlink();
  }
})();
