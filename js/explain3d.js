/* explain3d.js: interactive 3D explainers drawn with a small canvas projection (no libraries). */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const U = FF.ui, h = U.h;
  const X = (FF.explain = {});
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';

  /* orbit camera: yaw/pitch around a target, perspective projection */
  function Orbit(cv, o) {
    const s = { yaw: o.yaw || -0.6, pitch: o.pitch || 0.35, dist: o.dist || 9, fov: 1.6, ox: 0, oy: 0, tx: o.tx || 0 };
    let drag = null;
    cv.style.touchAction = 'none'; cv.style.cursor = 'grab';
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; s.auto = false; });
    cv.addEventListener('pointermove', (e) => { if (!drag) return; s.yaw += (e.clientX - drag.x) * 0.008; s.pitch = Math.max(-1.2, Math.min(1.2, s.pitch + (e.clientY - drag.y) * 0.008)); drag = { x: e.clientX, y: e.clientY }; o.onChange && o.onChange(); });
    const end = () => { drag = null; cv.style.cursor = 'grab'; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('keydown', (e) => { const d = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key]; if (d) { s.yaw += d[0]; s.pitch += d[1]; o.onChange && o.onChange(); e.preventDefault(); } });
    cv.tabIndex = 0;
    s.p = function (x, y, z) { // world (x right, y up, z toward viewer) -> screen
      const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw), cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
      x -= s.tx; let X1 = x * cy + z * sy, Z1 = -x * sy + z * cy;
      let Y2 = y * cp - Z1 * sp, Z2 = y * sp + Z1 * cp;
      const d = s.dist - Z2, k = (cv.width * s.fov * 0.5) / Math.max(0.5, d);
      return [cv.width / 2 + X1 * k + s.ox, cv.height / 2 - Y2 * k + s.oy, d];
    };
    return s;
  }
  const line = (c, O, a, b, col, w, dash) => { const p = O.p(...a), q = O.p(...b); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.strokeStyle = col; c.lineWidth = w || 1; c.setLineDash(dash || []); c.stroke(); c.setLineDash([]); };
  const poly = (c, O, pts, fill, stroke, w) => { c.beginPath(); pts.forEach((q, i) => { const p = O.p(...q); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = w || 1; c.stroke(); } };
  const ring = (cx, cy, cz, r, n) => { const a = []; for (let i = 0; i < (n || 40); i++) { const t = (i / (n || 40)) * 6.2832; a.push([cx, cy + Math.cos(t) * r, cz + Math.sin(t) * r]); } return a; };
  const text = (c, t, x, y, col, sz, al) => { c.fillStyle = col; c.font = (sz || 12) + 'px "IBM Plex Mono", monospace'; c.textAlign = al || 'left'; c.fillText(t, x, y); };

  function card(title, cv, controls, note) { return h('div', { class: 'card ex3d' }, h('h4', null, title), h('div', { class: 'lab-view' }, cv), controls, note ? h('div', { class: 'small muted' }, note) : null); }
  function slider(label, min, max, step, val, fmt, on) {
    const v = h('span', { class: 'mono' }, fmt(val)); const i = U.range(min, max, step, val, (x) => { v.textContent = fmt(x); on(x); });
    return h('label', { class: 'lab-row' }, h('span', { class: 'lab-name' }, label), i, v);
  }
  function visible(cv, draw) { // redraw only while on screen
    let on = true; if ('IntersectionObserver' in window) new IntersectionObserver((e) => { on = e.some((x) => x.isIntersecting); if (on) draw(); }).observe(cv);
    return () => on && draw();
  }

  /* ---------- 1. light path through a lens (thin lens, 3D rays) ---------- */
  X.lightPath = function () {
    const cv = h('canvas', { width: 640, height: 380, role: 'img', 'aria-label': 'Interactive 3D diagram of light rays passing through a lens onto a sensor. Drag to rotate.' });
    const c = cv.getContext('2d');
    const st = { N: 2.8, focus: 3, bgOn: true };
    const F = 0.5; // focal length in diagram units (0.5 ~ 50 mm)
    const redraw = visible(cv, draw), O = Orbit(cv, { yaw: -0.75, pitch: 0.3, dist: 6.2, tx: -2.6, onChange: () => redraw() });
    O.ox = 0;
    const rays = [];
    function draw() {
      const ink = css('--ink'), mut = css('--muted'), acc = css('--accent'), ok = css('--ok') || '#3cc79a', blue = '#4c8dff', line_ = css('--line');
      c.clearRect(0, 0, cv.width, cv.height);
      const A = F / st.N * 1.0; // aperture radius (scaled for visibility)
      const R = Math.max(0.04, A * 1.1 / 2 * 2.2);
      // geometry along x. lens at x=0, subject to the left (negative x).
      const sx = (d) => -d * 0.9; // distance (m) -> diagram units
      const uF = st.focus, vF = 1 / (1 / F - 1 / (uF * 2)) * 1; // sensor distance, diagram units; scene scaled so 1 m = 2 F-units
      const sensorX = vF;
      const pts = [{ d: st.focus, y: 0.55, col: acc, name: 'Subject' }];
      if (st.bgOn) pts.push({ d: 9, y: 0.55, col: blue, name: 'Background' });
      // sensor and lens
      const sw = 0.9, sh = 0.6;
      poly(c, O, [[sensorX, -sh, -sw], [sensorX, sh, -sw], [sensorX, sh, sw], [sensorX, -sh, sw]], 'rgba(120,130,140,.18)', mut, 1.2);
      text(c, 'SENSOR', ...O.p(sensorX, -sh - 0.12, 0).slice(0, 2), mut, 11, 'center');
      const rr = Math.min(0.9, 0.55), ap = Math.min(rr, A * 3);
      poly(c, O, ring(0, 0, 0, rr, 48), 'rgba(110,170,230,.12)', '#6aa8e6', 1.5);
      poly(c, O, ring(0, 0, 0, ap, 36), 'rgba(0,0,0,0)', ink, 2.2);
      text(c, 'LENS + APERTURE', ...O.p(0, rr + 0.18, 0).slice(0, 2), mut, 11, 'center');
      line(c, O, [sx(10), 0, 0], [sensorX + 0.4, 0, 0], line_, 1, [4, 5]);
      // subject points
      pts.forEach((pt, k) => {
        const u = pt.d * 2, v = 1 / (1 / F - 1 / u);
        const P0 = [sx(pt.d) , pt.y * (k ? 1.4 : 1), 0];
        const img = [v, -P0[1] * v / u, 0]; // image point (inverted)
        const nRays = 14;
        for (let i = 0; i < nRays; i++) {
          const th = (i / nRays) * 6.2832, rad = i % 2 ? ap : ap * 0.55;
          const L = [0, rad * Math.cos(th), rad * Math.sin(th)];
          // ray from subject through lens point continues to image point; extend to sensor plane
          const dir = [img[0] - L[0], img[1] - L[1], img[2] - L[2]], tt = (sensorX - L[0]) / dir[0];
          const S = [sensorX, L[1] + dir[1] * tt, L[2] + dir[2] * tt];
          const colr = pt.col;
          line(c, O, P0, L, colr + '55', 1);
          line(c, O, L, S, colr, 1.1);
        }
        // subject marker
        const p = O.p(...P0); c.beginPath(); c.arc(p[0], p[1], k ? 7 : 6, 0, 6.2832); c.fillStyle = pt.col; c.fill();
        text(c, pt.name, p[0], p[1] - 12, pt.col, 11, 'center');
        // circle of confusion on sensor
        const coc = ap * Math.abs(sensorX - v) / v;
        const cc = ring(sensorX, 0, 0, 1, 1); const cx = img[0] === sensorX ? 0 : 0;
        const cyc = -P0[1] * v / u; const pts2 = []; for (let i = 0; i < 32; i++) { const t = i / 32 * 6.2832; pts2.push([sensorX, cyc + Math.cos(t) * coc, Math.sin(t) * coc]); }
        poly(c, O, pts2, pt.col + '44', pt.col, 2);
        pt.coc = coc;
      });
      const sharp = pts[0].coc < 0.012;
      const lines = ['Aperture f/' + st.N.toFixed(1), 'Focused at ' + st.focus.toFixed(1) + ' m (scaled scene)'];
      text(c, lines[0], 12, 20, ink, 12); text(c, lines[1], 12, 38, mut, 11);
      if (st.bgOn) { const b = pts[1].coc; text(c, b < 0.012 ? 'Background: sharp' : 'Background blur circle: ' + (b * 100).toFixed(1) + ' units', 12, 56, blue, 11); }
      text(c, sharp ? 'Subject converges to a point on the sensor: sharp' : 'Subject is out of focus', 12, cv.height - 12, sharp ? ok : acc, 12);
    }
    const ctr = h('div', { class: 'lab-sl' },
      slider('Aperture', 1.4, 16, 0.1, st.N, (v) => 'f/' + v.toFixed(1), (v) => { st.N = v; redraw(); }),
      slider('Focus distance', 1.5, 8, 0.1, st.focus, (v) => v.toFixed(1) + ' m', (v) => { st.focus = v; redraw(); }),
      U.toggle('Show a distant background point', st.bgOn, (v) => { st.bgOn = v; redraw(); }));
    const el = card('Where does the light go? (drag to rotate)', cv, ctr, 'Each point of the scene sends rays through the whole opening of the lens. The lens bends them to meet at one point, but only if the sensor sits at the right distance. Move the focus and watch the sensor move. A narrower aperture lets fewer, steeper rays through, so the blur circles for out-of-focus points shrink.');
    setTimeout(redraw, 0); return el;
  };

  /* ---------- 2. sensor stack: microlenses, colour filter, photodiodes ---------- */
  X.sensor = function () {
    const cv = h('canvas', { width: 640, height: 400, role: 'img', 'aria-label': 'Exploded 3D view of a camera sensor: microlenses, Bayer colour filter and photodiodes. Drag to rotate.' });
    const c = cv.getContext('2d'); const st = { light: 0.6, iso: 0, explode: 1, t: 0 };
    const redraw = visible(cv, draw), O = Orbit(cv, { yaw: -0.5, pitch: 0.7, dist: 11, onChange: () => redraw() });
    const G = 4, cell = 0.62; // 4x4 pixels
    const bayer = (i, j) => ((i % 2 === 0 && j % 2 === 0) ? '#e5484d' : (i % 2 === 1 && j % 2 === 1) ? '#4c8dff' : '#3cc79a');
    function draw() {
      c.clearRect(0, 0, cv.width, cv.height);
      const ink = css('--ink'), mut = css('--muted');
      const e = st.explode, zs = [0, 0.5 + 1.0 * e, 1.0 + 2.0 * e, 1.5 + 3.0 * e]; // photodiode, filter, microlens
      const half = (G * cell) / 2;
      const cellsBack = [];
      for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) cellsBack.push([i, j]);
      cellsBack.sort((a, b) => { const pa = O.p((a[0] - 1.5) * cell, 0, (a[1] - 1.5) * cell), pb = O.p((b[0] - 1.5) * cell, 0, (b[1] - 1.5) * cell); return pb[2] - pa[2]; });
      const layerY = (k) => zs[k] - 1.2;
      const lbl = ['Photodiodes (the “buckets”)', 'Colour filter (Bayer pattern)', 'Microlenses'];
      // photodiodes: wells that fill with electrons
      cellsBack.forEach(([i, j]) => {
        const x = (i - 1.5) * cell, z = (j - 1.5) * cell, w = cell * 0.44, y0 = layerY(0);
        const hole = 0.4; const fill = Math.min(1, st.light * Math.pow(2, st.iso * 0.0) * (0.55 + 0.45 * Math.sin(i * 1.7 + j * 2.3 + 1)));
        poly(c, O, [[x - w, y0, z - w], [x + w, y0, z - w], [x + w, y0, z + w], [x - w, y0, z + w]], '#222a31', mut, 1);
        const top = y0 + hole * fill;
        const colr = bayer(i, j);
        poly(c, O, [[x - w, y0, z - w], [x + w, y0, z - w], [x + w, top, z - w], [x - w, top, z - w]], colr + 'cc', null);
        poly(c, O, [[x - w, y0, z + w], [x - w, y0, z - w], [x - w, top, z - w], [x - w, top, z + w]], colr + '99', null);
        poly(c, O, [[x - w, top, z - w], [x + w, top, z - w], [x + w, top, z + w], [x - w, top, z + w]], colr, ink, 1);
      });
      // colour filter layer
      cellsBack.forEach(([i, j]) => { const x = (i - 1.5) * cell, z = (j - 1.5) * cell, w = cell * 0.48; poly(c, O, [[x - w, layerY(1), z - w], [x + w, layerY(1), z - w], [x + w, layerY(1), z + w], [x - w, layerY(1), z + w]], bayer(i, j) + '99', bayer(i, j), 1); });
      // microlenses
      cellsBack.forEach(([i, j]) => { const x = (i - 1.5) * cell, z = (j - 1.5) * cell; const p = O.p(x, layerY(2), z), q = O.p(x + cell * 0.47, layerY(2), z); const r = Math.abs(q[0] - p[0]); const g = c.createRadialGradient(p[0] - r * 0.3, p[1] - r * 0.3, r * 0.1, p[0], p[1], r); g.addColorStop(0, 'rgba(255,255,255,.65)'); g.addColorStop(1, 'rgba(120,170,230,.28)'); c.beginPath(); c.ellipse(p[0], p[1], r, r * Math.max(0.35, Math.abs(Math.cos(O.pitch))), 0, 0, 6.2832); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(160,200,240,.8)'; c.stroke(); });
      // incoming light with animated photons
      const tt = st.t; const n = 10 + Math.round(st.light * 18);
      for (let k = 0; k < n; k++) {
        const ph = ((tt * 0.4 + k / n) % 1), i = (k * 5) % G, j = (k * 3 + 1) % G; const x = (i - 1.5) * cell + (((k * 37) % 10) / 10 - 0.5) * cell * 0.5, z = (j - 1.5) * cell;
        const y = layerY(2) + 2.3 - ph * (2.3 + (layerY(2) - layerY(0)));
        const p = O.p(x, y, z); c.beginPath(); c.arc(p[0], p[1], 2.4, 0, 6.2832); c.fillStyle = 'rgba(255,220,120,.95)'; c.fill();
      }
      const lp = (k) => O.p(half + 0.5, layerY(k), -half - 0.1);
      lbl.forEach((t, k) => { const p = lp(k); text(c, t, Math.min(cv.width - 12, p[0] + 14), p[1] + 4, ink, 11, 'left'); });
      text(c, 'Light arrives from the top. Each bucket collects electrons in proportion to the light it receives.', 12, cv.height - 30, mut, 11);
      text(c, 'Only one colour reaches each bucket, so the camera works out the other two from its neighbours.', 12, cv.height - 12, mut, 11);
      const isoV = FF.phys.ISO_LABELS ? FF.phys.ISO_LABELS[st.iso] : 100;
      text(c, 'Amplifier gain (ISO ' + isoV + '): ×' + (isoV / 100).toFixed(isoV >= 1000 ? 0 : 1), 12, 20, ink, 12);
    }
    let raf = 0; const anim = () => { st.t += 0.016; if (cv.offsetParent) draw(); raf = requestAnimationFrame(anim); };
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) raf = requestAnimationFrame(anim);
    const ctr = h('div', { class: 'lab-sl' },
      slider('Amount of light', 0.1, 1, 0.05, st.light, (v) => Math.round(v * 100) + '%', (v) => { st.light = v; redraw(); }),
      slider('Pull the layers apart', 0, 1, 0.05, st.explode, (v) => Math.round(v * 100) + '%', (v) => { st.explode = v; redraw(); }));
    const note = h('div', { class: 'small muted' }, 'The EOS R100 sensor is an APS-C chip with 24.1 million of these pixels. Bigger pixels hold more light, so they are less noisy. That is the main reason a larger sensor gives a cleaner picture in dim light.');
    const el = card('Inside the sensor (drag to rotate)', cv, ctr); el.append(note); setTimeout(redraw, 0); return el;
  };

  /* ---------- 3. shutter curtain ---------- */
  X.shutter = function () {
    const cv = h('canvas', { width: 640, height: 260, role: 'img', 'aria-label': 'Animation of a shutter curtain slit moving across the frame while a ball moves.' });
    const c = cv.getContext('2d'); const st = { ti: 18, run: 0, ph: 0 };
    const P = FF.phys; let raf = 0, last = 0;
    function draw(ts) {
      const ink = css('--ink'), mut = css('--muted'), acc = css('--accent'); const W = cv.width, H = cv.height;
      c.clearRect(0, 0, W, H);
      const fx = 90, fy = 30, fw = 460, fh = 170;
      const t = P.shutterValue(st.ti); // seconds
      c.fillStyle = 'rgba(120,130,140,.12)'; c.fillRect(fx, fy, fw, fh); c.strokeStyle = mut; c.strokeRect(fx, fy, fw, fh);
      // the ball moves right at constant speed; accumulate as we reveal
      const dur = 2.2, T = (st.ph % dur) / dur; // 0..1 across the sweep
      const slit = Math.min(1, Math.max(0.02, t / 0.005)); // slit width in fractions of frame for sync speed 1/200
      // Real shutters sweep at ~1/200 s for the whole frame. Slower speeds mean the slit is the full frame, exposing all at once.
      const open = t >= 1 / 200;
      const ballX = (u) => fx + 40 + u * (fw - 80);
      if (open) {
        const span = Math.min(1, t * 1.2); // fraction of travel during exposure
        const a0 = 0.15, a1 = Math.min(0.95, a0 + span * 0.8);
        for (let k = 0; k <= 24; k++) { const u = a0 + (a1 - a0) * k / 24; c.beginPath(); c.arc(ballX(u), fy + fh / 2, 20, 0, 6.2832); c.fillStyle = acc + (a1 - a0 < 0.05 ? 'ff' : '1f'); c.fill(); }
        text(c, t >= 1 / 200 ? 'Whole frame is open for ' + P.fmtShutter(t) + ' s: the ball smears across ' + Math.round((a1 - a0) * 100) + '% of the width.' : '', fx, fy + fh + 22, ink, 11);
      } else {
        const u = 0.15 + T * 0.7; const sx = fx + fw * T; const sw = Math.max(3, fw * slit);
        c.beginPath(); c.arc(ballX(u), fy + fh / 2, 20, 0, 6.2832); c.fillStyle = acc; c.fill();
        c.fillStyle = 'rgba(10,12,14,.82)'; c.fillRect(fx, fy, Math.max(0, sx - sw / 2 - fx), fh); c.fillRect(Math.min(fx + fw, sx + sw / 2), fy, Math.max(0, fx + fw - (sx + sw / 2)), fh);
        text(c, 'Faster than 1/200 s: a narrow slit sweeps across, so each strip is exposed for only ' + P.fmtShutter(t) + ' s.', fx, fy + fh + 22, ink, 11);
      }
      text(c, 'Shutter speed ' + P.fmtShutter(t) + (t < 0.5 ? ' s' : ' s'), 12, 18, ink, 12);
      text(c, 'Frame (sensor)', fx + fw / 2, fy - 6, mut, 10, 'center');
    }
    function loop(ts) { const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; st.ph += dt; if (cv.offsetParent) draw(); raf = requestAnimationFrame(loop); }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { st.ph = 0.8; draw(); } else raf = requestAnimationFrame(loop);
    const ctr = h('div', { class: 'lab-sl' }, slider('Shutter speed', 3, 50, 1, st.ti, (v) => P.fmtShutterIdx(v) + ' s', (v) => { st.ti = v; if (matchMedia('(prefers-reduced-motion: reduce)').matches) draw(); }));
    const el = card('How a shutter exposes the sensor', cv, ctr, 'Slow speeds: the whole sensor is open at once and moving things smear. Fast speeds: a thin slit travels across the frame, so each strip sees the scene for only a moment.');
    return el;
  };

  /* ---------- 4. crop factor ---------- */
  X.crop = function () {
    const cv = h('canvas', { width: 640, height: 300, role: 'img', 'aria-label': 'Comparison of full frame and APS-C sensor sizes and the field of view each captures.' });
    const c = cv.getContext('2d'); const st = { f: 18 }; const CROP = FF.phys.SENSOR.crop;
    function draw() {
      c.clearRect(0, 0, cv.width, cv.height);
      const ink = css('--ink'), mut = css('--muted'), acc = css('--accent');
      const cx = 170, cy = 150, k = 7.2; // px per mm
      c.fillStyle = 'rgba(120,130,140,.12)'; c.fillRect(cx - 18 * k, cy - 12 * k, 36 * k, 24 * k); c.strokeStyle = mut; c.strokeRect(cx - 18 * k, cy - 12 * k, 36 * k, 24 * k);
      const w = 22.3 * k, hh = 14.8 * k; c.fillStyle = acc + '33'; c.fillRect(cx - w / 2, cy - hh / 2, w, hh); c.strokeStyle = acc; c.lineWidth = 2; c.strokeRect(cx - w / 2, cy - hh / 2, w, hh); c.lineWidth = 1;
      text(c, 'Full frame 36 × 24 mm', cx, cy - 12 * k - 8, mut, 11, 'center'); text(c, 'EOS R100 (APS-C) 22.3 × 14.8 mm', cx, cy + 12 * k + 16, acc, 11, 'center');
      // scene preview (simple landscape) shown for both fields of view
      const sx = 390, sy = 40, sw = 230, sh = 220; const fovFF = 2 * Math.atan(18 / (st.f * CROP) / 1), eq = st.f * CROP;
      const g = c.createLinearGradient(0, sy, 0, sy + sh); g.addColorStop(0, '#7fb6ee'); g.addColorStop(0.62, '#cfe4f5'); g.addColorStop(0.62, '#5f8f55'); g.addColorStop(1, '#3d6b3a'); c.fillStyle = g; c.fillRect(sx, sy, sw, sh);
      c.fillStyle = '#e9e1d0'; c.fillRect(sx + 105, sy + 90, 22, 55); c.fillStyle = '#b5523b'; c.beginPath(); c.moveTo(sx + 98, sy + 90); c.lineTo(sx + 116, sy + 62); c.lineTo(sx + 134, sy + 90); c.fill();
      c.fillStyle = '#2f5a2e'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(sx + 20 + i * 38, sy + 140, 18 + (i % 3) * 5, 0, 6.2832); c.fill(); }
      const fw = Math.min(sw, 36 / (st.f * CROP) * 0 + sw * (18 / (eq / 1)) * 1.0); // field shown by this lens on the APS-C sensor relative to the 18 mm-equivalent widest field
      const widest = 18 * CROP, rel = widest / eq; const bw = sw * rel, bh = sh * rel;
      c.strokeStyle = acc; c.lineWidth = 3; c.strokeRect(sx + (sw - bw) / 2, sy + (sh - bh) / 2, bw, bh); c.lineWidth = 1;
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(sx, sy, sw, (sh - bh) / 2); c.fillRect(sx, sy + (sh + bh) / 2, sw, (sh - bh) / 2); c.fillRect(sx, sy + (sh - bh) / 2, (sw - bw) / 2, bh); c.fillRect(sx + (sw + bw) / 2, sy + (sh - bh) / 2, (sw - bw) / 2, bh);
      text(c, 'Field of view at ' + st.f + ' mm', sx + sw / 2, sy - 10, ink, 11, 'center');
      text(c, st.f + ' mm on the R100 looks like ' + Math.round(eq) + ' mm on full frame', 12, 20, ink, 12);
    }
    const ctr = h('div', { class: 'lab-sl' }, slider('Focal length', 18, 210, 1, st.f, (v) => v + ' mm', (v) => { st.f = v; draw(); }));
    const el = card('Crop factor: what “×1.6” means', cv, ctr, 'The R100’s sensor is smaller than a full-frame one, so it sees a narrower slice of what the lens projects. Multiply the focal length by 1.6 to compare it with full-frame lenses. Shown here is the slice the sensor crops out of the scene at the widest setting; the bright frame is what you actually get at the chosen focal length.');
    setTimeout(draw, 0); return el;
  };
})();
