/* render3d.js: photographs real 3D scenes (three.js) with the same camera model as the shader scenes.
   Each sample renders the scene from a random point on the lens aperture at a random moment of the exposure,
   so depth of field, motion blur, shake and panning all come from geometry. Samples accumulate in a float buffer
   and then go through the same sensor/processing shader (noise, ISO, clipping, white balance, picture style). */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const P = FF.phys, G = FF.GLSL;
  const R3 = (FF.Render3D = { ok: false, canvas: null, scenes: {} });
  let T3, rdr, rts = {}, quad, qScene, qCam, addMat, resMat, dispMat, depthMat, cam, passes = 0, last = null;
  const MAXW = 1200, MAXH = 800, PI = Math.PI;

  R3.init = function () {
    if (R3.ok) return true; if (!window.THREE) return false;
    T3 = window.THREE;
    try {
      const c = document.createElement('canvas'); c.width = MAXW; c.height = MAXH;
      rdr = new T3.WebGLRenderer({ canvas: c, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      rdr.setPixelRatio(1); rdr.setSize(MAXW, MAXH, false); rdr.outputColorSpace = T3.LinearSRGBColorSpace; rdr.toneMapping = T3.NoToneMapping; rdr.autoClear = false;
      rdr.shadowMap.enabled = true; rdr.shadowMap.type = T3.PCFSoftShadowMap;
      if (!rdr.capabilities.isWebGL2 || !rdr.extensions.get('EXT_color_buffer_float')) throw new Error('Float render targets are not available.');
      const geo = new T3.BufferGeometry(); geo.setAttribute('position', new T3.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
      const vs = 'in vec3 position; void main(){ gl_Position = vec4(position.xy, 0., 1.); }';
      const raw = (fs, u, extra) => new T3.RawShaderMaterial(Object.assign({ glslVersion: T3.GLSL3, vertexShader: vs, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false }, extra || {}));
      addMat = raw('precision highp float; out vec4 o; uniform sampler2D uTex; uniform vec3 uW; uniform vec2 uRes; uniform vec4 uWin; uniform float uF; void main(){ vec2 xs = uWin.xy + (gl_FragCoord.xy/uRes-0.5)*uWin.zw; float c4 = pow(cos(atan(length(xs)/uF)), 4.); o = vec4(max(texelFetch(uTex, ivec2(gl_FragCoord.xy), 0).rgb, 0.)*uW*c4, 1.); }',
        { uTex: { value: null }, uW: { value: new T3.Vector3() }, uRes: { value: new T3.Vector2() }, uWin: { value: new T3.Vector4() }, uF: { value: 30 } }, { blending: T3.CustomBlending, blendEquation: T3.AddEquation, blendSrc: T3.OneFactor, blendDst: T3.OneFactor });
      resMat = raw('precision highp float; out vec4 o; uniform sampler2D uTex; uniform float uK; void main(){ o = vec4(texelFetch(uTex, ivec2(gl_FragCoord.xy), 0).rgb*uK, 1.); }', { uTex: { value: null }, uK: { value: 1 } });
      const U = {}; ['uAcc'].forEach((k) => (U[k] = { value: null })); ['uG', 'uFWC', 'uRead', 'uM', 'uNR', 'uSeed', 'uCorr', 'uCat', 'uF'].forEach((k) => (U[k] = { value: 0 }));
      U.uRes = { value: new T3.Vector2() }; U.uWin = { value: new T3.Vector4() }; U.uWB = { value: new T3.Vector3() }; U.uStyle = { value: new T3.Vector3() }; U.uPreview = { value: 0 };
      dispMat = raw(G.displayFrag.replace(/^#version 300 es\s*/, ''), U);
      depthMat = new T3.ShaderMaterial({ vertexShader: 'varying float vz; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vz = -mv.z; gl_Position = projectionMatrix*mv; }', fragmentShader: 'varying float vz; void main(){ gl_FragColor = vec4(vz, vz, vz, 1.); }' });
      quad = new T3.Mesh(geo, addMat); quad.frustumCulled = false; qScene = new T3.Scene(); qScene.add(quad); qCam = new T3.Camera();
      cam = new T3.PerspectiveCamera(40, 1.5, 0.05, 2000); cam.matrixAutoUpdate = true;
      R3.canvas = c; R3.ok = true;
    } catch (e) { R3.error = String(e.message || e); console.error(e); }
    return R3.ok;
  };

  function rt(key, w, h, type, depth) {
    const k = key + w + 'x' + h; if (rts[k]) return rts[k];
    const keys = Object.keys(rts); if (keys.length > 14) { keys.slice(0, 5).forEach((x) => { rts[x].dispose(); delete rts[x]; }); }
    return (rts[k] = new T3.WebGLRenderTarget(w, h, { type, format: T3.RGBAFormat, depthBuffer: !!depth, minFilter: T3.NearestFilter, magFilter: T3.NearestFilter, colorSpace: T3.LinearSRGBColorSpace }));
  }
  function getScene(id) {
    if (!R3.scenes[id]) { const s = FF.SCENES3D[id](T3, helpers()); s.id = id; R3.scenes[id] = s; }
    return R3.scenes[id];
  }
  function helpers() {
    const H = {};
    H.amb = (units) => units * PI / 0.18;                       // light intensity that makes a grey card read `units`
    H.mat = (col, o) => new T3.MeshStandardMaterial(Object.assign({ color: col, roughness: 0.8, metalness: 0 }, o || {}));
    H.glow = (col, units) => new T3.MeshBasicMaterial({ color: new T3.Color(col).multiplyScalar(units) });
    H.add = (par, geo, m, pos, rot, sh) => { const x = new T3.Mesh(geo, m); if (pos) x.position.set(pos[0], pos[1], pos[2]); if (rot) x.rotation.set(rot[0], rot[1], rot[2]); x.castShadow = sh !== false; x.receiveShadow = true; par.add(x); return x; };
    H.tex = (w, h, draw, rx, ry) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T3.CanvasTexture(c); t.colorSpace = T3.SRGBColorSpace; t.wrapS = t.wrapT = T3.RepeatWrapping; if (rx) t.repeat.set(rx, ry || rx); t.anisotropy = 4; return t; };
    H.sun = (scene, units, dir, size) => { const l = new T3.DirectionalLight(0xffffff, H.amb(units)); l.position.set(dir[0], dir[1], dir[2]); l.castShadow = true; const s = size || 12; Object.assign(l.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 80 }); l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.0015; l.shadow.normalBias = 0.03; l.userData.units = units; scene.add(l); scene.add(l.target); return l; };
    H.sky = (scene, units, skyCol, groundCol) => { const l = new T3.HemisphereLight(skyCol, groundCol, H.amb(units)); l.userData.units = units; scene.add(l); return l; };
    return H;
  }

  /* camera for one sample */
  function setCam(p, win, w, h, lp, th, jit, sc) {
    const n = 0.05, f = p.f, s = Math.max(p.focus, f * 1.2) / 1000;
    const l = (win[0] - win[2] / 2 + jit[0]) / f * n, r = (win[0] + win[2] / 2 + jit[0]) / f * n, b = (win[1] - win[3] / 2 + jit[1]) / f * n, t = (win[1] + win[3] / 2 + jit[1]) / f * n;
    const dx = lp[0] / 1000, dy = lp[1] / 1000, sh = n / s;
    cam.projectionMatrix.makePerspective(l - dx * sh, r - dx * sh, t - dy * sh, b - dy * sh, n, 2000); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    const e = sc.eyeOf ? sc.eyeOf(p) : sc.eye || [0, 1.5, 0], q = p.pos || [0, 0];
    // moving sideways or up keeps the camera turned towards the subject, so you walk around it
    cam.rotation.set((sc.pitch || 0) + th[1] - Math.atan2(q[1], p.subjD), -th[0] + Math.atan2(q[0], p.subjD) + (sc.yaw || 0), 0, 'YXZ'); cam.position.set(e[0] + q[0], e[1] + q[1], e[2]); if (sc.yaw) cam.position.applyAxisAngle(YAX, sc.yaw); if (sc.flashLight) sc.flashLight.position.copy(cam.position); cam.updateMatrix(); cam.translateX(dx); cam.translateY(dy); cam.updateMatrixWorld(true);
  }
  let YAX = null;
  function tint(sc, p) { if (!YAX) YAX = new T3.Vector3(0, 1, 0); const c = P.cct2rgb(p.cct), m = Math.max(c[0], c[1], c[2]); sc.lights.forEach((l) => { const k = l.userData.units == null ? 1 : l.userData.units; if (l.userData.tint !== false) l.color.setRGB(c[0] / m, c[1] / m, c[2] / m); l.intensity = k * PI / 0.18 * (l.userData.gain || 1); l.visible = true; }); }
  const shakeAt = (a, t) => { let v = 0; for (let c = 0; c < 3; c++) v += a[c * 4] * Math.sin(2 * PI * a[c * 4 + 1] * t + a[c * 4 + 2]); return v; };
  const fr = (x) => x - Math.floor(x);

  R3.pass = function (p, o, pass) {
    if (!R3.init()) return 0;
    const sc = getScene(p.three), w = o.w, h = o.h, win = o.win;
    const sample = rt('s', w, h, T3.HalfFloatType, true), sum = rt('a', w, h, T3.FloatType, false);
    if (pass === 0) { rdr.setRenderTarget(sum); rdr.setClearColor(0x000000, 1); rdr.clear(true, false, false); passes = 0; }
    const ns = o.preview ? Math.max(3, Math.min(12, o.ns >> 2)) : Math.max(4, Math.min(32, o.ns >> 1));
    const rnd = P.mulberry(((o.seed | 0) * 7919 + pass * 104729 + 13) >>> 0), h3 = [rnd(), rnd(), rnd()];
    const Rap = p.f / (2 * p.N), tmid = p.t0 + 0.5 * p.T, sector = 2 * PI / p.blades, norm = Math.sqrt(PI / (0.5 * p.blades * Math.sin(sector)));
    const K = 0.18 * Math.pow(2, p.sceneEV) * p.T / (p.N * p.N), px = win[2] / w;
    const sig = Math.hypot(p.base, (p.ab[0] + p.ab[1]) / 2) * 1e-3;
    tint(sc, p); if (sc.flashLight) sc.flashLight.visible = false;
    addMat.uniforms.uRes.value.set(w, h); addMat.uniforms.uWin.value.set(win[0], win[1], win[2], win[3]); addMat.uniforms.uF.value = p.f;
    const shot = (tt, lp, th, wgt) => {
      setCam(p, win, w, h, lp, th, [(rnd() - 0.5) * px + gauss(rnd) * sig, (rnd() - 0.5) * px + gauss(rnd) * sig], sc);
      sc.update(tt, p, p.panRate ? tmid : null);
      rdr.setRenderTarget(sample); rdr.setClearColor(0x000000, 1); rdr.clear(); rdr.render(sc.scene, cam);
      quad.material = addMat; addMat.uniforms.uTex.value = sample.texture; addMat.uniforms.uW.value.set(wgt[0], wgt[1], wgt[2]);
      rdr.setRenderTarget(sum); rdr.render(qScene, qCam);
    };
    for (let i = 0; i < ns; i++) {
      const fi = i + pass * ns, r = [fr(0.8191725134 * (fi + 1) + h3[0]), fr(0.6710436067 * (fi + 1) + h3[1]), fr(0.5497004779 * (fi + 1) + h3[2])];
      const rad = Math.sqrt(r[0]), ang = 2 * PI * r[1], a2 = (ang % sector) - 0.5 * sector, pf = Math.cos(0.5 * sector) / Math.cos(a2) * norm, k = rad * (1 + (pf - 1) * p.poly);
      const tt = p.t0 + p.T * r[2];
      const th = [p.aim[0] + p.panRate * (tt - tmid) + shakeAt(p.shX, tt), p.aim[1] + shakeAt(p.shY, tt)];
      shot(tt, [Math.cos(ang) * k * Rap, Math.sin(ang) * k * Rap], th, [K / ns, K / ns, K / ns]);
    }
    if (p.flashK > 0) {
      sc.lights.forEach((l) => (l.visible = false)); if (!sc.flashLight) { sc.flashLight = new T3.PointLight(0xffffff, PI, 0, 2); sc.scene.add(sc.flashLight); }
      const e = sc.eyeOf ? sc.eyeOf(p) : sc.eye || [0, 1.5, 0]; sc.flashLight.position.set(e[0], e[1] + 0.08, e[2]); sc.flashLight.visible = true; (sc.glows || []).forEach((g) => (g.visible = false));
      const c = P.cct2rgb(5600), bg = sc.scene.background; sc.scene.background = null;
      shot(p.tf, [0, 0], [p.aim[0] + p.panRate * (p.tf - tmid) + shakeAt(p.shX, p.tf), p.aim[1] + shakeAt(p.shY, p.tf)], [p.flashK * c[0], p.flashK * c[1], p.flashK * c[2]]);
      sc.scene.background = bg; sc.flashLight.visible = false; (sc.glows || []).forEach((g) => (g.visible = true));
    }
    passes = pass + 1; last = { w, h };
    rdr.setRenderTarget(null);
    return 0;
  };
  function gauss(rnd) { return Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-4))) * Math.cos(2 * PI * rnd()); }

  R3.present = function (p, o) {
    if (!R3.ok) return;
    const w = o.w, h = o.h, sum = rt('a', w, h, T3.FloatType, false), acc = rt('r', w, h, T3.FloatType, false);
    quad.material = resMat; resMat.uniforms.uTex.value = sum.texture; resMat.uniforms.uK.value = 1 / Math.max(1, passes); rdr.setRenderTarget(acc); rdr.render(qScene, qCam);
    const u = dispMat.uniforms; u.uAcc.value = acc.texture; u.uRes.value.set(w, h); u.uWin.value.set(o.win[0], o.win[1], o.win[2], o.win[3]);
    u.uG.value = o.iso / 100; u.uFWC.value = P.SENSOR.fwc; u.uRead.value = P.SENSOR.readNoise(o.iso); u.uM.value = o.M; u.uNR.value = o.nr; u.uSeed.value = o.seed * 0.37 + 1.3; u.uCorr.value = o.corr ? 1 : 0; u.uCat.value = p.cat; u.uF.value = p.f;
    u.uWB.value.set(o.wb[0], o.wb[1], o.wb[2]); u.uStyle.value.set(o.style[0], o.style[1], 0); u.uPreview.value = o.preview ? 1 : 0;
    quad.material = dispMat; rdr.setRenderTarget(null); rdr.setViewport(0, 0, w, h); rdr.setScissor(0, 0, w, h); rdr.setScissorTest(true); rdr.render(qScene, qCam); rdr.setScissorTest(false); rdr.setViewport(0, 0, MAXW, MAXH);
  };

  R3.meter = function (p, gx, gy) {
    const n = gx * gy, lum = new Float32Array(n).fill(0.5), depth = new Float32Array(n).fill(10), sub = new Uint8Array(n);
    if (!R3.init()) return { lum, depth, sub, gx, gy };
    const sc = getScene(p.three), win = [0, 0, P.SENSOR.w, P.SENSOR.h], t = rt('m', gx * 2, gy * 2, T3.FloatType, true), W = gx * 2, Hh = gy * 2, buf = new Float32Array(W * Hh * 4), dbuf = new Float32Array(W * Hh * 4);
    tint(sc, p); if (sc.flashLight) sc.flashLight.visible = false;
    setCam(p, win, W, Hh, [0, 0], [p.aim[0], p.aim[1]], [0, 0], sc); sc.update(p.t0, p, p.panRate ? p.t0 : null);
    rdr.setRenderTarget(t); rdr.setClearColor(0x000000, 1); rdr.clear(); rdr.render(sc.scene, cam); rdr.readRenderTargetPixels(t, 0, 0, W, Hh, buf);
    const bg = sc.scene.background; sc.scene.background = null; sc.scene.overrideMaterial = depthMat; rdr.setClearColor(new T3.Color(900, 900, 900), 1); rdr.clear(); rdr.render(sc.scene, cam); rdr.readRenderTargetPixels(t, 0, 0, W, Hh, dbuf);
    sc.scene.overrideMaterial = null; sc.scene.background = bg; rdr.setClearColor(0x000000, 1); rdr.setRenderTarget(null);
    // subject cells: inside the projected bounding box of each tagged object and near its depth
    const boxes = (sc.subjects || []).map((s) => { const b = new T3.Box3().setFromObject(s.obj), c = [], v = new T3.Vector3(); let zmin = 1e9, zmax = 0;
      for (let i = 0; i < 8; i++) { v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z); const d = v.clone().applyMatrix4(cam.matrixWorldInverse); zmin = Math.min(zmin, -d.z); zmax = Math.max(zmax, -d.z); v.project(cam); c.push([v.x, v.y]); }
      return { id: s.id, x0: Math.min(...c.map((q) => q[0])), x1: Math.max(...c.map((q) => q[0])), y0: Math.min(...c.map((q) => q[1])), y1: Math.max(...c.map((q) => q[1])), zmin: zmin - 0.1, zmax: zmax + 0.1 }; });
    for (let y = 0; y < gy; y++) for (let x = 0; x < gx; x++) {
      let L = 0, d = 1e9; const yy = (gy - 1 - y) * 2;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const k = ((yy + j) * W + x * 2 + i) * 4; L += 0.2126 * buf[k] + 0.7152 * buf[k + 1] + 0.0722 * buf[k + 2]; d = Math.min(d, dbuf[k]); }
      const di = y * gx + x; lum[di] = Math.max(L / 4, 1e-4); depth[di] = Math.min(d, 500);
      const nx = (x + 0.5) / gx * 2 - 1, ny = 1 - (y + 0.5) / gy * 2;
      for (const b of boxes) if (nx >= b.x0 && nx <= b.x1 && ny >= b.y0 && ny <= b.y1 && d >= b.zmin && d <= b.zmax) { sub[di] = Math.max(sub[di], b.id); depth[di] = Math.hypot(p.subjD, (p.pos || [0, 0])[0], (p.pos || [0, 0])[1]); }
    }
    return { lum, depth, sub, gx, gy };
  };
})();
