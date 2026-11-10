/* Camera state, exposure and dispatcher tests.  Run: node --test tests/
   Loads the real physics, data, camera core and action dispatcher with a flat light meter standing in for the WebGL
   renderer, so exposure maths and state rules are tested exactly as the app runs them. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

function load() {
  for (const k of Object.keys(require.cache)) if (k.includes(path.sep + 'js' + path.sep)) delete require.cache[k];
  global.window = {};
  global.performance = global.performance || { now: () => Date.now() };
  const js = (f) => require(path.join(__dirname, '..', 'js', f));
  js('physics.js'); js('data.js');
  const FF = window.FF;
  // flat grey scene at a known brightness: every meter cell reads 0.18, depth 2 m, no faces
  const G = 8, N = G * G;
  FF.buildParams = () => ({});
  FF.Renderer = { meter: () => ({ lum: new Array(N).fill(0.18), depth: new Array(N).fill(2), sub: new Array(N).fill(0), gx: G, gy: G }) };
  js('cam_core.js'); js('cam_actions.js');
  FF.cam.setScene(FF.cam.state.scene);
  return FF;
}
// the camera stores exact third-stop values (2^(-k/3)) behind nominal labels: 1/32 s shows as 1/30, f/11.3 as f/11
const nominal = (a, b, msg) => assert.ok(Math.abs(Math.log2(a / b)) < 0.12, `${msg}: ${a} vs nominal ${b}`);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

test('physics: exposure value reciprocity (EV = log2(N^2/t) at ISO 100)', () => {
  const { phys: P } = load();
  // f/8 at 1/125 is EV 13; f/5.6 at 1/250 is the same exposure
  near(Math.log2(8 * 8 * 125), 12.97, 0.01, 'EV of f/8 1/125');
  const t1 = P.solveShutter(13, 8, 100), t2 = P.solveShutter(13, 5.6, 100);
  near(t1 / t2, 2, 0.05, 'one stop wider aperture halves the time');
  near(P.solveShutter(13, 8, 200), t1 / 2, t1 * 0.02, 'doubling ISO halves the time');
});

test('physics: third-stop scales round-trip through their indices', () => {
  const { phys: P } = load();
  for (const n of [1.8, 2.8, 4, 5.6, 8, 11, 16, 22]) { nominal(P.apertureValue(P.apertureIndex(n)), n, 'aperture ' + n); assert.equal(P.apertureIndex(P.apertureValue(P.apertureIndex(n))), P.apertureIndex(n)); }
  for (const t of [1 / 4000, 1 / 1000, 1 / 125, 1 / 30, 1, 30]) { nominal(P.shutterValue(P.shutterIndex(t)), t, 'shutter ' + t); assert.equal(P.shutterIndex(P.shutterValue(P.shutterIndex(t))), P.shutterIndex(t)); }
  for (const iso of [100, 400, 1600, 6400, 12800]) nominal(P.isoValue(P.isoIndex(iso)), iso, 'ISO ' + iso);
});

test('Av: the aperture you set is used; shutter follows the light', () => {
  const FF = load(), C = FF.cam, A = FF.act;
  A.dispatch('mode/set', { mode: 'Av' }); A.dispatch('iso/auto', { on: false }); A.dispatch('iso/set', { idx: FF.phys.isoIndex(100) });
  A.dispatch('aperture/set', { idx: FF.phys.apertureIndex(8) });
  near(C.eff.N, 8, 0.1, 'aperture'); const t8 = C.eff.t;
  A.dispatch('aperture/step', { d: -3 }); // one stop wider
  assert.ok(C.eff.N < 8 && C.eff.t < t8, 'wider aperture gives a faster shutter');
  near(t8 / C.eff.t, 2, 0.3, 'one stop');
});

test('Tv: shutter is yours, aperture is refused', () => {
  const FF = load(), C = FF.cam, A = FF.act;
  A.dispatch('mode/set', { mode: 'Tv' });
  A.dispatch('shutter/set', { idx: FF.phys.shutterIndex(1 / 500) });
  near(C.eff.t, 1 / 500, 1 / 5000, 'shutter');
  const r = A.dispatch('aperture/step', { d: 1 });
  assert.equal(r.ok, false); assert.match(r.reason, /Aperture is set by the camera/);
});

test('M: aperture, shutter and fixed ISO are all kept; the meter only reports', () => {
  const FF = load(), C = FF.cam, A = FF.act, P = FF.phys;
  A.dispatch('mode/set', { mode: 'M' }); A.dispatch('iso/auto', { on: false });
  A.dispatch('aperture/set', { idx: P.apertureIndex(11) }); A.dispatch('shutter/set', { idx: P.shutterIndex(1 / 60) }); A.dispatch('iso/set', { idx: P.isoIndex(400) });
  nominal(C.eff.N, 11, 'N'); nominal(C.eff.t, 1 / 60, 't'); nominal(C.eff.iso, 400, 'ISO');
  A.dispatch('scene/light', { ev: -3 }); // darker scene: settings stay, the indicator moves
  nominal(C.eff.N, 11, 'N after light change'); assert.ok(C.eff.ind < -1, 'meter shows under-exposure');
});

test('switching mode carries the current exposure into the new mode', () => {
  const FF = load(), C = FF.cam, A = FF.act;
  A.dispatch('mode/set', { mode: 'P' }); const { aIdx, tIdx } = C.eff;
  A.dispatch('mode/set', { mode: 'M' });
  assert.equal(C.state.aIdx, aIdx); assert.equal(C.state.tIdx, tIdx);
});

test('exposure compensation brightens in Av and is refused in A+', () => {
  const FF = load(), C = FF.cam, A = FF.act;
  A.dispatch('mode/set', { mode: 'Av' }); A.dispatch('iso/auto', { on: false });
  const t0 = C.eff.t; A.dispatch('ec/set', { ec: 3 }); // +1 EV
  near(C.eff.t / t0, 2, 0.3, '+1 EV doubles the time');
  A.dispatch('mode/set', { mode: 'A+' });
  assert.equal(A.dispatch('ec/set', { ec: -3 }).ok, false);
});

test('lens change clamps the aperture to what the lens can do', () => {
  const FF = load(), C = FF.cam, A = FF.act, P = FF.phys;
  A.dispatch('mode/set', { mode: 'Av' });
  A.dispatch('lens/set', { id: 'prime', f: 50 }); A.dispatch('aperture/set', { idx: P.apertureIndex(1.8) });
  near(C.eff.N, 1.8, 0.05, 'f/1.8 on the 50 mm');
  A.dispatch('lens/set', { id: 'kit', f: 18 });
  near(C.eff.N, 4.5, 0.15, 'clamped to the kit lens maximum f/4.5');
});

test('flash: turning it on raises the flash and limits the shutter to 1/200 s', () => {
  const FF = load(), C = FF.cam, A = FF.act, P = FF.phys;
  A.dispatch('mode/set', { mode: 'Tv' }); A.dispatch('shutter/set', { idx: P.shutterIndex(1 / 1000) });
  A.dispatch('flash/set', { flash: 'on' });
  assert.equal(C.state.pop, true); assert.ok(C.eff.flashOn);
  assert.equal(FF.phys.fmtShutter(C.eff.t), '1/200', 'held at the 1/200 s sync step'); assert.match(C.eff.notes.join(' '), /1\/200/);
  A.dispatch('flash/pop', { up: false });
  assert.equal(C.state.flash, 'off');
});

test('every view hears each change once, with its source; no-op changes are silent', () => {
  const FF = load(), A = FF.act, seen = [];
  A.on((a) => seen.push(a.type + '@' + a.source));
  A.dispatch('ec/set', { ec: 2 }, 'menu'); A.dispatch('ec/set', { ec: 2 }, 'menu'); A.dispatch('drive/set', { drive: 'cont' }, '3d');
  assert.deepEqual(seen, ['ec/set@menu', 'drive/set@3d']);
});

test('a mode switch before any metering keeps valid numbers (fresh page)', () => {
  const FF = load(), C = FF.cam;
  C.eff = { N: 5.6, t: 1 / 125, iso: 100, flashOn: false, flashP: 0, notes: [] }; // the placeholder cam_core starts with
  FF.act.dispatch('mode/set', { mode: 'M' }); FF.act.dispatch('iso/auto', { on: false });
  for (const k of ['aIdx', 'tIdx', 'isoIdx']) assert.ok(Number.isInteger(C.state[k]), k + ' is a step index');
  for (const k of ['N', 't', 'iso']) assert.ok(Number.isFinite(C.eff[k]), k + ' is a number');
});

test('invalid values are rejected without touching state', () => {
  const FF = load(), A = FF.act, before = JSON.stringify(FF.cam.state);
  assert.equal(A.dispatch('meter/set', { meter: 'matrix' }).ok, false);
  assert.equal(A.dispatch('nope/x', {}).ok, false);
  assert.equal(JSON.stringify(FF.cam.state), before);
});

test('mission setup applies a known baseline in one action', () => {
  const FF = load(), C = FF.cam, A = FF.act;
  A.dispatch('ec/set', { ec: 5 }); A.dispatch('flash/set', { flash: 'on' });
  A.dispatch('mission/setup', { scene: C.state.scene, setup: { mode: 'Tv', lens: 'tele' } }, 'mission');
  assert.equal(C.state.mode, 'Tv'); assert.equal(C.state.lens, 'tele'); assert.equal(C.state.ec, 0); assert.equal(C.state.flash, 'off');
});
