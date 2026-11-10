/* cam_actions.js: the one way to change the camera.
   Every input (simulator deck, viewfinder, rear-screen menu, Quick Control, missions, 3D buttons) calls
   FF.act.dispatch(type, payload, source). The dispatcher validates the change against the shooting mode, clamps it
   to the lens and the camera, writes FF.cam.state, re-runs metering/exposure (C.refreshMeter) and autofocus when the
   change affects them, then notifies every view once. HUD, rear LCD, deck, 3D model and the capture all read the same
   FF.cam.state / FF.cam.eff afterwards, so they cannot disagree. No DOM here. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const P = FF.phys, C = FF.cam;
  const A = (FF.act = {});
  const subs = [];
  const S = () => C.state;
  A.on = (fn) => { subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; };
  A.log = []; // last 50 actions, for debugging and tests

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const oneOf = (v, list, key) => { if (!list.includes(v)) throw new Error(key + ' must be one of ' + list.join(', ')); return v; };
  const mode = () => FF.MODES.find((m) => m.id === S().mode) || FF.MODES[0];
  // is a setting decided by the camera in the current mode? (iso also follows the Auto ISO switch)
  C.isAuto = (what) => (what === 'iso' ? C.isoAutoNow() : mode().auto.includes(what));
  const basic = () => S().mode === 'A+' || S().mode === 'SCN';

  // effects: 'meter' = re-solve exposure, 'af' = refocus quietly, 'lens' = lens/focal changed
  const H = {
    'mode/set': (p, s) => {
      oneOf(p.mode, FF.MODES.map((m) => m.id), 'mode');
      const eff = C.eff; // carry the current exposure into the new mode, as the camera does when you turn the dial
      if (p.mode === 'Av' || p.mode === 'M') s.aIdx = eff.aIdx;
      if (p.mode === 'Tv' || p.mode === 'M') s.tIdx = eff.tIdx;
      if (p.mode === 'M' && !s.isoAuto) s.isoIdx = eff.iIdx;
      s.mode = p.mode; return ['meter', 'af'];
    },
    'scn/set': (p, s) => { s.scn = oneOf(p.scn, FF.SCN.map((x) => x.id), 'scn'); return ['meter']; },
    'aperture/step': (p, s) => { if (C.isAuto('N')) return refuse('Aperture is set by the camera in ' + s.mode + '.'); const r = C.apRange(); s.aIdx = clamp(s.aIdx + (p.d | 0), r[0], r[1]); return ['meter']; },
    'aperture/set': (p, s) => { if (C.isAuto('N')) return refuse('Aperture is set by the camera in ' + s.mode + '.'); const r = C.apRange(); s.aIdx = clamp(p.idx | 0, r[0], r[1]); return ['meter']; },
    'shutter/step': (p, s) => { if (C.isAuto('t')) return refuse('Shutter speed is set by the camera in ' + s.mode + '.'); s.tIdx = clamp(s.tIdx + (p.d | 0), 0, P.SHUTTER_N - 1); return ['meter']; },
    'shutter/set': (p, s) => { if (C.isAuto('t')) return refuse('Shutter speed is set by the camera in ' + s.mode + '.'); s.tIdx = clamp(p.idx | 0, 0, P.SHUTTER_N - 1); return ['meter']; },
    'iso/step': (p, s) => { if (C.isAuto('iso')) return refuse('ISO is automatic. Turn Auto ISO off first.'); s.isoIdx = clamp(s.isoIdx + (p.d | 0), 0, P.ISO_N - 1); return ['meter']; },
    'iso/set': (p, s) => { // idx, or 'auto'
      if (basic()) return refuse('ISO is automatic in ' + s.mode + '.');
      if (p.idx === 'auto') { s.isoAuto = true; return ['meter']; }
      s.isoAuto = false; s.isoIdx = clamp(p.idx | 0, 0, P.ISO_N - 1); return ['meter'];
    },
    'iso/auto': (p, s) => { if (basic()) return refuse('ISO is automatic in ' + s.mode + '.'); s.isoAuto = !!p.on; if (!s.isoAuto) s.isoIdx = C.eff.iIdx; return ['meter']; },
    'iso/max': (p, s) => { s.isoMaxIdx = clamp(p.idx | 0, 0, P.ISO_N - 1); return ['meter']; },
    'ec/set': (p, s) => { if (basic()) return refuse('Exposure compensation is not available in ' + s.mode + '.'); s.ec = clamp(Math.round(p.ec), -9, 9); return ['meter']; },
    'ec/step': (p, s) => { if (basic()) return refuse('Exposure compensation is not available in ' + s.mode + '.'); s.ec = clamp(s.ec + (p.d | 0), -9, 9); return ['meter']; },
    'meter/set': (p, s) => { if (basic()) return refuse('Metering is automatic in ' + s.mode + '.'); s.meter = oneOf(p.meter, ['evaluative', 'partial', 'spot', 'center'], 'meter'); return ['meter']; },
    'ae/lock': (p, s) => { const want = p.on == null ? s.aeLock == null : !!p.on; s.aeLock = want ? C.meterInfo.L : null; return ['meter']; },
    'af/mode': (p, s) => { s.afMode = oneOf(p.mode, ['oneshot', 'servo', 'mf'], 'af mode'); if (s.afMode === 'mf') s.mfDist = s.focusDist; return ['af']; },
    'af/area': (p, s) => { s.afArea = oneOf(p.area, ['1pt', 'whole'], 'af area'); if (p.face != null) s.face = !!p.face; return ['af']; },
    'af/face': (p, s) => { s.face = !!p.on; return ['af']; },
    'af/point': (p, s) => { if (s.afArea !== '1pt' || basic()) return refuse('Choose 1-point AF to place the AF point.'); s.af = { x: clamp(+p.x, 0.06, 0.94), y: clamp(+p.y, 0.08, 0.92) }; return ['meter', 'af']; },
    'af/press': () => ['afloud'],
    'mf/set': (p, s) => { s.mfDist = Math.max(C.lens().mfd(s.f) * 0.75, Math.min(1000, +p.dist)); s.focusTarget = s.mfDist; return []; },
    'wb/set': (p, s) => { s.wb = oneOf(p.wb, FF.WB.map((w) => w.id), 'white balance'); if (p.k != null) s.wbK = clamp(Math.round(p.k), 2500, 10000); else if (s.wb === 'k') s.wbK = Math.round(C.wbKelvin()); return []; },
    'style/set': (p, s) => { s.style = oneOf(p.style, FF.STYLES.map((x) => x.id), 'picture style'); return []; },
    'nr/set': (p, s) => { s.nr = oneOf(p.nr, ['off', 'std', 'high'], 'noise reduction'); return []; },
    'corr/set': (p, s) => { s.corr = !!p.on; return ['meter']; },
    'drive/set': (p, s) => { s.drive = oneOf(p.drive, ['single', 'cont', 't2', 't10'], 'drive mode'); return []; },
    'flash/set': (p, s) => { s.flash = oneOf(p.flash, ['off', 'auto', 'on'], 'flash'); if (s.flash === 'off') s.pop = false; else if (s.flash === 'on') s.pop = true; return ['meter']; },
    'flash/pop': (p, s) => { s.pop = !!p.up; if (!s.pop && s.flash === 'on') s.flash = 'off'; return ['meter']; },
    'stab/set': (p, s) => { s.stab = oneOf(p.stab, ['hand', 'tripod'], 'support'); return ['meter']; },
    'is/set': (p, s) => { s.is = !!p.on; C.liveShake = null; return []; },
    'pan/set': (p, s) => { s.pan = !!p.on; return []; },
    'lens/set': (p) => { C.setLens(p.id, p.f); return ['meter', 'af', 'lens']; },
    'focal/set': (p) => { C.setFocal(+p.f); return ['meter', 'af', 'lens']; },
    // the scene in front of the camera (not camera settings, but routed here so views stay in step)
    'scene/set': (p) => { C.setScene(p.id, p.opts); return ['lens']; },
    'scene/light': (p, s) => { s.light = clamp(+p.ev, -5, 3); return ['meter']; },
    'scene/cct': (p, s) => { s.cctOn = p.on == null ? true : !!p.on; if (p.k != null) s.cct = clamp(+p.k, 2000, 10000); else if (s.cctOn && p.on) s.cct = C.scene().cct; return ['meter']; },
    'scene/subject': (p, s) => { const sc = C.scene().subj; if (p.dist != null) s.subjD = clamp(+p.dist, sc.min != null ? sc.min : 0.3, sc.max != null ? sc.max : 100); if (p.speed != null) s.speed = clamp(+p.speed, 0, 100); return ['meter', 'af']; },
    'scene/move': (p, s) => { if (p.pos) s.pos = [+p.pos[0], +p.pos[1]]; if (p.aim) s.aim = [+p.aim[0], +p.aim[1]]; return p.settle ? ['meter', 'af'] : []; },
    'scene/pause': (p, s) => { s.paused = !!p.on; return []; },
    // a mission's starting state: a known baseline, with any aperture/shutter it wants pre-set for later
    'mission/setup': (p, s) => {
      const st = p.setup || {};
      if (p.scene) C.setScene(p.scene);
      if (st.lens) C.setLens(st.lens, st.lens === 'prime' ? 50 : 30);
      if (st.speed) s.speed = +st.speed;
      Object.assign(s, { stab: st.stab === 'tripod' ? 'tripod' : 'hand', pan: !!st.pan, flash: 'off', pop: false, ec: 0, meter: 'evaluative', afMode: 'oneshot', afArea: '1pt', isoAuto: true, aeLock: null, drive: 'single' });
      C.clampAperture();
      if (st.aperture === 'max') s.aIdx = C.apRange()[0];
      if (st.tIdx) s.tIdx = P.shutterIndex(1 / 250);
      if (st.mode) s.mode = oneOf(st.mode, FF.MODES.map((m) => m.id), 'mode');
      return ['meter', 'af', 'lens'];
    },
    // missions and lessons set several things at once; each key still goes through its own action
    'preset/apply': (p) => { const fx = new Set(); Object.keys(p.actions || {}).forEach((t) => { const r = run(t, p.actions[t]); (r || []).forEach((e) => fx.add(e)); }); return [...fx]; },
  };
  let refused = null;
  function refuse(msg) { refused = msg; return null; }
  function run(type, payload) { const fn = H[type]; if (!fn) throw new Error('Unknown camera action: ' + type); return fn(payload || {}, S()); }

  A.types = Object.keys(H);
  A.dispatch = function (type, payload, source) {
    refused = null;
    // the placeholder exposure has no step indices until the first solve; handlers copy them (mode switch, Auto ISO off)
    if (C.eff.aIdx == null) C.eff = C.solve(C.meterInfo.EVm);
    const before = JSON.stringify(S());
    let fx;
    try { fx = run(type, payload); } catch (e) { console.warn('[FirstFrame] action', type, 'rejected:', e.message); return { ok: false, reason: e.message }; }
    if (fx == null) { return { ok: false, reason: refused || 'Not allowed now.' }; }
    C.clampAperture();
    // re-solve exposure; where the scene renderer isn't running (e.g. the 3D page) solve from the last meter reading,
    // so the rear LCD and the next capture never show stale numbers
    if (fx.includes('meter') || fx.includes('lens')) { const r = FF.Renderer && FF.Renderer.meter ? C.refreshMeter(true) : null; if (!r) C.eff = C.solve(C.meterInfo.EVm); }
    if (fx.includes('af') && C.meterMap) C.afPress(true);
    if (fx.includes('afloud') && C.meterMap) C.afPress(false);
    const changed = JSON.stringify(S()) !== before || fx.includes('afloud');
    const act = { type, payload: payload || {}, source: source || 'ui', fx, t: Date.now() };
    A.log.push(act); if (A.log.length > 50) A.log.shift();
    if (changed) { subs.forEach((fn) => { try { fn(act, S()); } catch (e) { console.error('[FirstFrame] action subscriber failed', e); } }); C.emit('state'); }
    return { ok: true, changed };
  };
  A.d = A.dispatch; // short alias
})();
