/* render.js: WebGL2 engine. One shared offscreen canvas; callers copy results with blit(). */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const G = FF.GLSL;
  const MAXW = 1200, MAXH = 800, MGX = 48, MGY = 32;

  const R = (FF.Renderer = {
    ok: false, error: '', canvas: null, MAXW, MAXH, MGX, MGY, lastMs: 0
  });
  let gl, progS, progD, vao, tex = [], fbo = [], mTex, mFbo, uc = {};

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n').slice(0, 0));
    return s;
  }
  function program(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  function loc(p, n) { const k = (p === progS ? 's' : 'd') + n; if (!(k in uc)) uc[k] = gl.getUniformLocation(p, n); return uc[k]; }
  const f1 = (p, n, v) => { const l = loc(p, n); if (l) gl.uniform1f(l, v); };
  const i1 = (p, n, v) => { const l = loc(p, n); if (l) gl.uniform1i(l, v); };
  const f2 = (p, n, a, b) => { const l = loc(p, n); if (l) gl.uniform2f(l, a, b); };
  const f3 = (p, n, a, b, c) => { const l = loc(p, n); if (l) gl.uniform3f(l, a, b, c); };
  const f4 = (p, n, a, b, c, d) => { const l = loc(p, n); if (l) gl.uniform4f(l, a, b, c, d); };
  const fv4 = (p, n, arr) => { const l = loc(p, n); if (l) gl.uniform4fv(l, arr); };

  function makeTex(w, h, internal, format, type) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function makeFbo(t) {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return f;
  }

  R.init = function () {
    if (R.ok || R.error) return R.ok;
    try {
      const c = document.createElement('canvas'); c.width = MAXW; c.height = MAXH;
      gl = c.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
      if (!gl) throw new Error('WebGL2 is not available in this browser.');
      const e32 = gl.getExtension('EXT_color_buffer_float'); gl.getExtension('EXT_color_buffer_half_float');
      if (!e32) throw new Error('This GPU cannot render to floating-point textures (EXT_color_buffer_float).');
      progS = program(G.vert, G.scenePass());
      progD = program(G.vert, G.displayFrag);
      vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      for (let i = 0; i < 2; i++) {
        tex[i] = makeTex(MAXW, MAXH, gl.RGBA32F, gl.RGBA, gl.FLOAT); fbo[i] = makeFbo(tex[i]);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Float framebuffer incomplete.');
      }
      mTex = makeTex(MGX, MGY, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE); mFbo = makeFbo(mTex);
      R.canvas = c; R.own = c; R.ok = true;
    } catch (err) { R.error = String(err.message || err); console.error(err); }
    return R.ok;
  };

  function setScene(p, w, h, win, pass, ns, seed, meter) {
    gl.useProgram(progS);
    i1(progS, 'uScene', p.scene); f2(progS, 'uRes', w, h); f4(progS, 'uWin', win[0], win[1], win[2], win[3]);
    f1(progS, 'uF', p.f); f1(progS, 'uN', p.N); f1(progS, 'uFocus', Math.max(p.focus, p.f * 1.2));
    i1(progS, 'uBlades', p.blades); f1(progS, 'uPoly', p.poly); f1(progS, 'uCat', p.cat); f1(progS, 'uDist', p.dist);
    f1(progS, 'uBase', p.base); f2(progS, 'uAb', p.ab[0], p.ab[1]);
    f1(progS, 'uT0', p.t0); f1(progS, 'uT', p.T); i1(progS, 'uNS', ns); i1(progS, 'uPass', pass); f1(progS, 'uSeed', seed);
    f1(progS, 'uSceneEV', p.sceneEV); f1(progS, 'uCCT', p.cct); f1(progS, 'uSubjD', p.subjD); f1(progS, 'uSpeed', p.speed);
    f2(progS, 'uAim', p.aim[0], p.aim[1]); f1(progS, 'uPanRate', p.panRate);
    fv4(progS, 'uShX', p.shX); fv4(progS, 'uShY', p.shY);
    f1(progS, 'uFlashK', p.flashK); f1(progS, 'uTf', p.tf); i1(progS, 'uMeter', meter ? 1 : 0);
  }

  // One accumulation pass into ping-pong buffer. Returns index of the texture holding the result.
  R.pass = function (p, o, pass) {
    if (p.three) { if (FF.Render3D.init()) { R.canvas = FF.Render3D.canvas; return FF.Render3D.pass(p, o, pass); } FF.loadThree && FF.loadThree(); p = Object.assign({}, p, { scene: 0 }); }
    R.canvas = R.own;
    const w = o.w, h = o.h, cur = pass % 2, prev = 1 - cur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[cur]); gl.viewport(0, 0, w, h);
    setScene(p, w, h, o.win, pass, o.ns, o.seed, false);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[prev]); i1(progS, 'uPrev', 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return cur;
  };

  // Sensor + processing pass onto the shared canvas.
  R.present = function (p, o, texIdx) {
    if (p.three && FF.Render3D.ok) return FF.Render3D.present(p, o);
    const w = o.w, h = o.h;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h);
    gl.useProgram(progD);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[texIdx]); i1(progD, 'uAcc', 0);
    f2(progD, 'uRes', w, h); f4(progD, 'uWin', o.win[0], o.win[1], o.win[2], o.win[3]);
    f1(progD, 'uG', o.iso / 100); f1(progD, 'uFWC', FF.phys.SENSOR.fwc); f1(progD, 'uRead', FF.phys.SENSOR.readNoise(o.iso));
    f1(progD, 'uM', o.M); f1(progD, 'uNR', o.nr); f1(progD, 'uSeed', o.seed * 0.37 + 1.3); f1(progD, 'uCorr', o.corr ? 1 : 0);
    f1(progD, 'uCat', p.cat); f1(progD, 'uF', p.f);
    f3(progD, 'uWB', o.wb[0], o.wb[1], o.wb[2]); f3(progD, 'uStyle', o.style[0], o.style[1], 0);
    i1(progD, 'uPreview', o.preview ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // Convenience: full synchronous render. o: {w,h,win,ns,passes,iso,M,nr,wb,style,corr,seed,preview}
  R.render = function (p, o) {
    if (!R.ok) return null;
    const t0 = performance.now();
    let idx = 0;
    for (let i = 0; i < o.passes; i++) idx = R.pass(p, o, i);
    R.present(p, o, idx);
    R.lastMs = performance.now() - t0;
    return R.canvas;
  };

  // Copy the last rendered w x h region into a 2D context.
  R.blit = function (ctx, w, h, dx, dy, dw, dh) {
    ctx.drawImage(R.canvas, 0, MAXH - h, w, h, dx || 0, dy || 0, dw || w, dh || h);
  };

  // Meter + AF map. Returns {lum, depth, sub} with row 0 at the top.
  R.meter = function (p) {
    if (!R.ok) return null;
    if (p.three) return FF.Render3D.meter(p, MGX, MGY);
    gl.bindFramebuffer(gl.FRAMEBUFFER, mFbo); gl.viewport(0, 0, MGX, MGY);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[0]);
    setScene(p, MGX, MGY, [0, 0, FF.phys.SENSOR.w, FF.phys.SENSOR.h], 0, 1, 0, true);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const buf = new Uint8Array(MGX * MGY * 4);
    gl.readPixels(0, 0, MGX, MGY, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const lum = new Float32Array(MGX * MGY), depth = new Float32Array(MGX * MGY), sub = new Uint8Array(MGX * MGY);
    for (let y = 0; y < MGY; y++) for (let x = 0; x < MGX; x++) {
      const si = ((MGY - 1 - y) * MGX + x) * 4, di = y * MGX + x;
      lum[di] = Math.pow(2, (buf[si] / 255) * 26 - 12);
      depth[di] = Math.pow(2, (buf[si + 1] / 255) * 10 - 1);
      sub[di] = Math.round((buf[si + 2] / 255) * 4);
    }
    return { lum, depth, sub, gx: MGX, gy: MGY };
  };
})();
