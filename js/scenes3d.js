/* scenes3d.js: three real 3D scenes to photograph. Each returns { scene, lights, update(t, params, panMid), subjects, eye, pitch }.
   Distances are metres. Light levels are in "grey card = 1" units (see render3d.js). */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const S3 = (FF.SCENES3D = {});
  const X = Math.PI / 2;

  /* ---- 1. Tabletop still life: a ruler of objects in depth, for aperture and focus ---- */
  S3.still3d = function (T3, H) {
    const scene = new T3.Scene(); scene.background = new T3.Color(0.5, 0.42, 0.34);
    const key = H.sun(scene, 1.0, [-4, 5, 2], 5), fill = H.sky(scene, 0.32, 0xfff4e4, 0x8a6a4a);
    const wood = H.mat(0xffffff, { map: H.tex(256, 256, (c, w, h) => { c.fillStyle = '#9a6a3c'; c.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(${60 + i % 40},${35 + i % 20},15,${0.08 + (i % 5) * 0.03})`; c.fillRect(0, (i * 37) % h, w, 2 + (i % 4)); } }, 3, 6), roughness: 0.55 });
    H.add(scene, new T3.BoxGeometry(3.2, 0.06, 9), wood, [0, -0.03, -3.6]);
    const wall = H.mat(0xffffff, { map: H.tex(512, 256, (c, w, h) => { c.fillStyle = '#c9b79c'; c.fillRect(0, 0, w, h); for (let s = 0; s < 3; s++) { c.fillStyle = '#5b4028'; c.fillRect(0, 40 + s * 78, w, 8); for (let i = 0; i < 26; i++) { const bw = 10 + (i * 7 + s * 3) % 14, bh = 40 + (i * 13 + s * 5) % 26; c.fillStyle = ['#8c2f2a', '#2d4f7c', '#3d6b4a', '#b88a2e', '#5a3d6e', '#d8d2c4'][(i + s * 2) % 6]; c.fillRect(8 + i * 19.4, 40 + s * 78 - bh, bw, bh); } } }) });
    H.add(scene, new T3.PlaneGeometry(9, 4.5), wall, [0, 1.6, -8.2], null, false);
    const glows = [];
    for (let i = 0; i < 22; i++) { const g = H.add(scene, new T3.SphereGeometry(0.022, 10, 8), H.glow(['#ffd27a', '#ff9d5c', '#ffe9b0'][i % 3], 14), [-3.2 + i * 0.3, 2.35 + 0.16 * Math.sin(i * 0.9), -8.0], null, false); glows.push(g); }
    // depth ruler: chess-like pawns every 50 cm, alternating sides
    const cols = [0xd94f3d, 0xe9b949, 0x3f8f6b, 0x3a6fb5, 0x8a55a8, 0xe07a3a, 0x4fb3bf, 0xc94f7c];
    for (let i = 0; i < 8; i++) { const z = -(0.5 + i * 0.5), x = (i % 2 ? 0.34 : -0.34) + (i % 2 ? 1 : -1) * i * 0.02, m = H.mat(cols[i], { roughness: 0.45 }); const g = new T3.Group(); g.position.set(x, 0, z); scene.add(g);
      H.add(g, new T3.CylinderGeometry(0.035, 0.05, 0.02, 24), m, [0, 0.01, 0]); H.add(g, new T3.CylinderGeometry(0.018, 0.04, 0.09, 24), m, [0, 0.065, 0]); H.add(g, new T3.SphereGeometry(0.03, 20, 14), m, [0, 0.135, 0]);
      const lab = H.tex(128, 64, (c) => { c.fillStyle = '#fbf7ee'; c.fillRect(0, 0, 128, 64); c.fillStyle = '#222'; c.font = '700 38px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((0.5 + i * 0.5).toFixed(1) + ' m', 64, 34); }); H.add(g, new T3.PlaneGeometry(0.1, 0.05), H.mat(0xffffff, { map: lab, roughness: 0.9 }), [0, 0.03, 0.062], [-0.35, 0, 0], false); }
    // the subject: a small still life on a cloth
    const subj = new T3.Group(); scene.add(subj);
    H.add(subj, new T3.CylinderGeometry(0.16, 0.16, 0.006, 40), H.mat(0xa9a59c, { roughness: 0.95 }), [0, 0.003, 0]);
    H.add(subj, new T3.SphereGeometry(0.075, 32, 20), H.mat(0xc4c4c4, { map: H.tex(128, 64, (c) => { c.fillStyle = '#f5f1e6'; c.fillRect(0, 0, 128, 64); c.fillStyle = '#2f5d8a'; for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(8 + i * 16, 32, 5, 0, 7); c.fill(); } c.fillRect(0, 14, 128, 3); c.fillRect(0, 47, 128, 3); }), roughness: 0.25 }), [0, 0.07, 0]).scale.set(1, 0.85, 1);
    H.add(subj, new T3.CylinderGeometry(0.03, 0.045, 0.02, 24), H.mat(0xb9bfbd, { roughness: 0.25 }), [0, 0.137, 0]); H.add(subj, new T3.SphereGeometry(0.014, 12, 8), H.mat(0x2f5d8a, { roughness: 0.3 }), [0, 0.155, 0]);
    H.add(subj, new T3.TorusGeometry(0.04, 0.009, 10, 24, Math.PI), H.mat(0xb9bfbd, { roughness: 0.25 }), [0.09, 0.07, 0], [0, 0, -X]); H.add(subj, new T3.CylinderGeometry(0.008, 0.016, 0.09, 12), H.mat(0xb9bfbd, { roughness: 0.25 }), [-0.095, 0.085, 0], [0, 0, 1.0]);
    H.add(subj, new T3.SphereGeometry(0.036, 24, 16), H.mat(0xf08a24, { roughness: 0.6 }), [-0.11, 0.036, 0.09]); H.add(subj, new T3.SphereGeometry(0.03, 24, 16), H.mat(0xc8322c, { roughness: 0.35 }), [0.12, 0.03, 0.08]); H.add(subj, new T3.SphereGeometry(0.027, 24, 16), H.mat(0xe7d04a, { roughness: 0.5 }), [0.05, 0.027, 0.13]).scale.set(1.3, 1, 1);
    return { scene, lights: [key, fill], glows, subjects: [{ obj: subj, id: 1 }], eye: [0, 0.2, 0], pitch: -0.08, update: (t, p) => { subj.position.set(0, 0, -p.subjD); } };
  };

  /* ---- 2. Carousel at dusk: rotation for shutter speed, lights for bokeh, dim light for ISO ---- */
  S3.carousel3d = function (T3, H) {
    const scene = new T3.Scene(); scene.background = new T3.Color(0.10, 0.11, 0.17);
    const moon = H.sun(scene, 0.35, [5, 9, 6], 9), sky = H.sky(scene, 0.3, 0xc0c8e6, 0x4a4038); moon.userData.tint = false; sky.userData.tint = false; moon.color.set(0xd8deef);
    H.add(scene, new T3.PlaneGeometry(80, 80), H.mat(0x6b6660, { roughness: 0.95 }), [0, 0, -20], [-X, 0, 0], false);
    const glows = [], car = new T3.Group(); scene.add(car);
    const lamps = [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]].map((q) => { const l = new T3.PointLight(0xffc98a, 1, 0, 2); l.userData.units = 5; l.userData.tint = false; l.position.set(q[0], 2.9, q[1]); car.add(l); return l; });
    H.add(car, new T3.CylinderGeometry(2.5, 2.5, 0.18, 48), H.mat(0xb23a48, { roughness: 0.5 }), [0, 0.09, 0]); H.add(car, new T3.CylinderGeometry(0.22, 0.22, 3.3, 24), H.mat(0xf3e6c8, { roughness: 0.4 }), [0, 1.8, 0]);
    const stripe = H.tex(256, 64, (c) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#f6efe0' : '#c8323e'; c.fillRect(i * 16, 0, 16, 64); } });
    H.add(car, new T3.ConeGeometry(2.9, 1.1, 48, 1, true), H.mat(0xffffff, { map: stripe, roughness: 0.6, side: T3.DoubleSide }), [0, 3.95, 0]); H.add(car, new T3.CylinderGeometry(2.9, 2.9, 0.3, 48, 1, true), H.mat(0xf2c14e, { roughness: 0.5, side: T3.DoubleSide }), [0, 3.3, 0]);
    for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; glows.push(H.add(car, new T3.SphereGeometry(0.05, 10, 8), H.glow('#ffd9a0', 22), [Math.cos(a) * 2.92, 3.3, Math.sin(a) * 2.92], null, false)); }
    const horses = [], hc = [0xf4f1ea, 0x3a3a3a, 0xc98b4a, 0xf4f1ea, 0x7a4a2a, 0xe6d6b8, 0x3a3a3a, 0xc98b4a];
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, g = new T3.Group(); g.position.set(Math.cos(a) * 1.95, 0, Math.sin(a) * 1.95); g.rotation.y = -a; car.add(g); const m = H.mat(hc[i], { roughness: 0.4 }), gold = H.mat(0xd9a93a, { roughness: 0.3, metalness: 0.7 });
      H.add(g, new T3.CylinderGeometry(0.025, 0.025, 3.1, 10), gold, [0, 1.7, 0]); const hb = new T3.Group(); g.add(hb); hb.userData.ph = i * 1.7;
      H.add(hb, new T3.CapsuleGeometry(0.16, 0.5, 6, 14), m, [0, 0, 0], [X, 0, 0]); H.add(hb, new T3.CapsuleGeometry(0.09, 0.26, 6, 12), m, [0, 0.26, 0.36], [0.7, 0, 0]); H.add(hb, new T3.CapsuleGeometry(0.075, 0.2, 6, 12), m, [0, 0.42, 0.52], [X + 0.3, 0, 0]);
      [[-0.09, 0.26], [0.09, 0.26], [-0.09, -0.26], [0.09, -0.26]].forEach((q) => H.add(hb, new T3.CylinderGeometry(0.035, 0.03, 0.42, 8), m, [q[0], -0.32, q[1]]));
      H.add(hb, new T3.BoxGeometry(0.2, 0.05, 0.3), H.mat([0xc8323e, 0x2d6fb5, 0x3f8f6b, 0xe9b949][i % 4], { roughness: 0.5 }), [0, 0.17, -0.02]); horses.push(hb); }
    // background: stalls and distant lights
    for (let i = 0; i < 7; i++) { const x = -18 + i * 6; H.add(scene, new T3.BoxGeometry(3.4, 2.6, 2), H.mat([0x2e4a7a, 0x7a2e3a, 0x2e6a52][i % 3], { roughness: 0.8 }), [x, 1.3, -17 - (i % 2) * 2]); H.add(scene, new T3.ConeGeometry(2.8, 1.2, 4), H.mat([0xf2c14e, 0xf6efe0][i % 2], { roughness: 0.7 }), [x, 3.2, -17 - (i % 2) * 2], [0, Math.PI / 4, 0]);
      glows.push(H.add(scene, new T3.PlaneGeometry(2.6, 0.9), H.glow(['#ffcf8a', '#ff9d7a', '#a8e0ff'][i % 3], 3.5), [x, 1.5, -15.95 - (i % 2) * 2], null, false)); }
    for (let i = 0; i < 46; i++) glows.push(H.add(scene, new T3.SphereGeometry(0.07, 8, 6), H.glow(['#ffd27a', '#ff7a7a', '#7ac8ff', '#a8ff9a'][i % 4], 18), [-22 + i * 1.0, 4.6 + 0.5 * Math.sin(i * 0.55), -15.5 - (i % 3)], null, false));
    return { scene, lights: [moon, sky].concat(lamps), glows, subjects: [{ obj: car, id: 1 }], eye: [0, 1.5, 0], pitch: 0.02,
      update: (t, p) => { car.position.set(0, 0, -p.subjD); car.rotation.y = -t * p.speed / 60 * Math.PI * 2; horses.forEach((hb) => { hb.position.y = 1.1 + 0.22 * Math.sin(t * p.speed / 60 * Math.PI * 4 + hb.userData.ph); }); } };
  };

  /* ---- 3. Cyclist on a sunny street: freeze, blur or pan ---- */
  S3.cyclist3d = function (T3, H) {
    const scene = new T3.Scene(); scene.background = new T3.Color(2.2, 3.0, 4.4);
    const sun = H.sun(scene, 1.0, [6, 10, 7], 16), sky = H.sky(scene, 0.38, 0xbfd8ff, 0x8a8478); sky.userData.tint = false;
    H.add(scene, new T3.PlaneGeometry(160, 160), H.mat(0x8f8f8a, { roughness: 0.95 }), [0, 0, -30], [-X, 0, 0], false);
    const road = H.tex(256, 64, (c) => { c.fillStyle = '#4a4b4d'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#e8e4d4'; c.fillRect(20, 29, 90, 6); c.fillStyle = '#d8d4c4'; c.fillRect(0, 2, 256, 3); c.fillRect(0, 59, 256, 3); }, 30, 1);
    H.add(scene, new T3.PlaneGeometry(160, 5), H.mat(0xffffff, { map: road, roughness: 0.9 }), [0, 0.01, 0], [-X, 0, 0], false);
    const rider = new T3.Group(); scene.add(rider);
    const dark = H.mat(0x1c1c1e, { roughness: 0.6 }), frame = H.mat(0xd8372e, { roughness: 0.35, metalness: 0.3 }), skin = H.mat(0xd9a57e, { roughness: 0.7 });
    const wheels = [-0.52, 0.52].map((x) => { const w = new T3.Group(); w.position.set(x, 0.34, 0); rider.add(w); H.add(w, new T3.TorusGeometry(0.32, 0.022, 10, 36), dark); for (let i = 0; i < 6; i++) H.add(w, new T3.CylinderGeometry(0.005, 0.005, 0.62, 6), H.mat(0xc8ccd0, { metalness: 0.8, roughness: 0.3 }), [0, 0, 0], [0, 0, i * Math.PI / 6]); return w; });
    const tube = (a, b, r, m) => { const va = new T3.Vector3(...a), vb = new T3.Vector3(...b), d = vb.clone().sub(va), x = H.add(rider, new T3.CylinderGeometry(r, r, d.length(), 10), m, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]); x.quaternion.setFromUnitVectors(new T3.Vector3(0, 1, 0), d.normalize()); return x; };
    tube([-0.52, 0.34, 0], [-0.1, 0.36, 0], 0.016, frame); tube([-0.1, 0.36, 0], [0.38, 0.86, 0], 0.02, frame); tube([-0.1, 0.36, 0], [-0.22, 0.9, 0], 0.018, frame); tube([-0.22, 0.86, 0], [0.38, 0.86, 0], 0.018, frame); tube([-0.52, 0.34, 0], [-0.22, 0.86, 0], 0.014, frame); tube([0.52, 0.34, 0], [0.38, 0.92, 0], 0.016, frame); tube([0.38, 0.98, -0.2], [0.38, 0.98, 0.2], 0.013, dark);
    H.add(rider, new T3.BoxGeometry(0.22, 0.04, 0.1), dark, [-0.24, 0.94, 0]);
    const body = new T3.Group(); rider.add(body);
    H.add(body, new T3.CapsuleGeometry(0.13, 0.42, 6, 14), H.mat(0x2a6fd0, { roughness: 0.7 }), [-0.02, 1.27, 0], [0, 0, -0.75]); const head = H.add(body, new T3.SphereGeometry(0.105, 20, 16), skin, [0.27, 1.58, 0]); H.add(body, new T3.SphereGeometry(0.115, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), H.mat(0xf2d23a, { roughness: 0.4 }), [0.27, 1.6, 0]);
    tube([0.12, 1.42, 0.14], [0.38, 1.0, 0.18], 0.035, skin); tube([0.12, 1.42, -0.14], [0.38, 1.0, -0.18], 0.035, skin);
    const legs = [0.09, -0.09].map((z, i) => { const g = new T3.Group(); g.position.set(-0.2, 0.98, z); rider.add(g); H.add(g, new T3.CapsuleGeometry(0.055, 0.5, 6, 10), H.mat(0x22252b, { roughness: 0.8 }), [0, -0.3, 0]); g.userData.ph = i * Math.PI; return g; });
    // street furniture and backdrop
    for (let i = -4; i <= 4; i++) { H.add(scene, new T3.CylinderGeometry(0.05, 0.06, 3.2, 10), H.mat(0x2e3338, { roughness: 0.5 }), [i * 7 + 2.6, 1.6, 2.9]); H.add(scene, new T3.SphereGeometry(0.14, 12, 8), H.mat(0xf4f0e0, { roughness: 0.3 }), [i * 7 + 2.6, 3.25, 2.9]); }
    for (let i = -7; i <= 7; i++) { const x = i * 5.5 + 1.3, z = -5.5; H.add(scene, new T3.CylinderGeometry(0.13, 0.17, 2.2, 10), H.mat(0x5a4130, { roughness: 0.9 }), [x, 1.1, z]); H.add(scene, new T3.SphereGeometry(1.25, 14, 12), H.mat([0x3f7a3c, 0x4f8f44, 0x356b36][(i + 9) % 3], { roughness: 0.95 }), [x, 3.0, z]).scale.set(1, 1.15, 1); }
    for (let i = -6; i <= 6; i++) { const w = 7.5, hgt = 9 + ((i * 7 + 20) % 5) * 2.2, fac = H.tex(128, 256, (c) => { c.fillStyle = ['#c9b8a0', '#a8b4c0', '#d8c9a8', '#b89a88'][(i + 8) % 4]; c.fillRect(0, 0, 128, 256); for (let y = 0; y < 7; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x * 3 + y * 5 + i) % 4 ? '#3a4a5c' : '#8fb2cf'; c.fillRect(12 + x * 29, 14 + y * 34, 18, 22); } c.fillStyle = '#5a4030'; c.fillRect(0, 232, 128, 24); });
      H.add(scene, new T3.BoxGeometry(w, hgt, 6), H.mat(0xffffff, { map: fac, roughness: 0.85 }), [i * (w + 0.4), hgt / 2, -13]); }
    return { scene, lights: [sun, sky], glows: [], subjects: [{ obj: rider, id: 1 }, { obj: head, id: 2 }], eye: [0, 1.55, 8], eyeOf: (p) => [0, 1.55, p.subjD], pitch: 0.0,
      update: (t, p, panMid) => { const v = p.speed, x = panMid != null ? v * (t - panMid) : ((v * t + 7) % 14 + 14) % 14 - 7; rider.position.set(x, 0, 0); const a = -(v * t) / 0.34; wheels.forEach((w) => (w.rotation.z = a)); legs.forEach((g) => (g.rotation.z = 0.5 * Math.sin(a * 0.35 + g.userData.ph) + 0.25)); } };
  };

  /* ---- 4. Pigeons: a flock circling in front of you. Fast, erratic wings for shutter-speed practice ---- */
  S3.canal3d = function (T3, H) {
    const scene = new T3.Scene(); scene.background = new T3.Color(2, 2.6, 3.4);
    const sun = H.sun(scene, 1.0, [6, 10, 7], 14), sky = H.sky(scene, 0.4, 0xcfe0ff, 0x9a9488);
    const flock = new T3.Group(); scene.add(flock); const birds = [];
    const wingGeo = new T3.BufferGeometry(); wingGeo.setAttribute('position', new T3.BufferAttribute(new Float32Array([0, 0, 0.07, 0, 0, -0.09, 0.34, 0, -0.02]), 3)); wingGeo.computeVertexNormals();
    for (let i = 0; i < 9; i++) { const b = new T3.Group(), g = [0x8d939b, 0x6f757d, 0xb9bcc2, 0x5c6168][i % 4], m = H.mat(g, { roughness: 0.7, side: T3.DoubleSide });
      H.add(b, new T3.CapsuleGeometry(0.055, 0.16, 6, 10), m, [0, 0, 0], [X, 0, 0]); H.add(b, new T3.SphereGeometry(0.045, 12, 10), H.mat(0x4f6f6a, { roughness: 0.5 }), [0, 0.03, 0.14]); H.add(b, new T3.ConeGeometry(0.014, 0.05, 6), H.mat(0xe0a23a), [0, 0.02, 0.2], [X, 0, 0]);
      const wl = new T3.Group(), wr = new T3.Group(); H.add(wl, wingGeo, m); const w2 = H.add(wr, wingGeo, m); w2.scale.x = -1; b.add(wl, wr); b.userData = { wl, wr, ph: i * 0.9, r: 1.6 + (i % 3) * 0.7, h: 1.0 + (i * 0.37) % 1.4, a0: i * 0.7, f: 7 + (i % 4) }; flock.add(b); birds.push(b); }
    return { scene, lights: [sun, sky], glows: [], subjects: [{ obj: flock, id: 1 }], eye: [0, 1.55, 0], pitch: 0.02,
      update: (t, p, panMid) => { flock.position.set(0, 0, -p.subjD); birds.forEach((b) => { const u = b.userData, w = p.speed / u.r, a = u.a0 + (panMid != null ? 0 : 1) * w * t + (panMid != null ? w * (t - panMid) : 0);
        b.position.set(Math.cos(a) * u.r, u.h + 0.18 * Math.sin(t * 2.1 + u.ph), Math.sin(a) * u.r * 0.6); b.rotation.y = -a + Math.PI; const fl = Math.sin(t * u.f * 2 * Math.PI * (0.6 + p.speed / 12) + u.ph) * 0.95; u.wl.rotation.z = fl; u.wr.rotation.z = -fl; }); } };
  };

  /* ---- real places: each 3D set stands inside a 360° photograph of a real location (CC0 panoramas from Poly Haven) ---- */
  function onLocation(make, o) {
    return function (T3, H) {
      const s = make(T3, H), world = new T3.Group();
      s.scene.children.slice().forEach((c) => { if (c.isLight || c.type === 'Object3D') return; if (c.isMesh && o.drop(c)) { s.scene.remove(c); return; } world.add(c); });
      const lon = (o.face - 0.5) * 2 * Math.PI; s.yaw = Math.atan2(-Math.cos(lon), -Math.sin(lon)); world.rotation.y = s.yaw; s.scene.add(world);
      const inWorld = (g) => { let n = g; while (n) { if (n === world) return true; n = n.parent; } return false; }; s.glows = (s.glows || []).filter(inWorld);
      if (o.catcher) { const c = new T3.Mesh(new T3.PlaneGeometry(90, 90), new T3.ShadowMaterial({ opacity: o.catcher })); c.rotation.x = -X; c.position.y = 0.002; c.receiveShadow = true; s.scene.add(c); }
      const tex = new T3.TextureLoader().load('img/pano/' + o.pano + '.jpg', () => { if (FF.Render3D.onAsset) FF.Render3D.onAsset(o.id); }); tex.mapping = T3.EquirectangularReflectionMapping; tex.colorSpace = T3.SRGBColorSpace;
      s.scene.background = tex; s.scene.backgroundIntensity = o.bg || 3.3;
      const sl = (o.sunAt[0] - 0.5) * 2 * Math.PI, la = Math.max(0.22, (0.5 - o.sunAt[1]) * Math.PI), d = [Math.cos(la) * Math.cos(sl), Math.sin(la), Math.cos(la) * Math.sin(sl)];
      const c0 = new T3.Vector3(0, 0, -(o.dist || 8)).applyAxisAngle(new T3.Vector3(0, 1, 0), s.yaw), sun = s.lights[0], sky = s.lights[1];
      sun.position.set(c0.x + d[0] * 30, d[1] * 30, c0.z + d[2] * 30); sun.target.position.copy(c0); sun.userData.units = o.sun[0]; sun.color.set(o.sun[1]); sun.userData.tint = false;
      sky.userData.units = o.sky[0]; sky.color.set(o.sky[1]); sky.groundColor.set(o.sky[2]); sky.userData.tint = false;
      return s;
    };
  }
  const meshOnly = (c) => true;
  S3.still3d = onLocation(S3.still3d, { id: 'still3d', pano: 'hall', face: 0.5, drop: (c) => c.position.z < -7, sunAt: [0.533, 0.213], sun: [0.75, 0xffe6c4], sky: [0.5, 0xffe9cf, 0xb36a4a], dist: 1, bg: 2.6 });
  S3.carousel3d = onLocation(S3.carousel3d, { id: 'carousel3d', pano: 'lagoon', face: 0.88, drop: meshOnly, catcher: 0.4, sunAt: [0.5996, 0.4805], sun: [0.55, 0xffc48a], sky: [0.42, 0xc9d2f0, 0x8a7f78], dist: 9, bg: 3.0 });
  S3.cyclist3d = onLocation(S3.cyclist3d, { id: 'cyclist3d', pano: 'platz', face: 0.57, drop: meshOnly, catcher: 0.34, sunAt: [0.3555, 0.3], sun: [0.5, 0xffffff], sky: [0.72, 0xf2f5fa, 0xa7a29c], dist: 8, bg: 3.2 });
  S3.canal3d = onLocation(S3.canal3d, { id: 'canal3d', pano: 'canal', face: 0.42, drop: meshOnly, catcher: 0.34, sunAt: [0.5996, 0.3408], sun: [1.0, 0xfff4e2], sky: [0.42, 0xcfe0ff, 0xa39c90], dist: 7, bg: 3.3 });
})();