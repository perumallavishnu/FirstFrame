/* cam3d.js: interactive 3D camera viewer. Orbit, click parts, open doors, explode, x-ray, detach and drag lenses.
   Model: the Canon EOS R100 production GLB (cam3d_glb.js, parts and anchors from the camera profile) when it loads,
   otherwise the procedural teaching model (cam3d_model.js). Both expose the same handles, so behaviour is shared.
   Hotspots on the GLB sit on named ANCHOR_* nodes authored in Blender; they are never estimated from bounding boxes. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const U = FF.ui, h = U.h, K = FF.cam3dModel;
  const V = (FF.cam3d = {});
  let threeP = null;
  // Three.js r160 as an ES module (import map in index.html), exposed as window.THREE for the older modules
  FF.loadThree = function () {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (!threeP) threeP = import('three').then((m) => (window.THREE = m)).catch((e) => { threeP = null; throw new Error('Could not load the 3D library.'); });
    return threeP;
  };
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- procedural model: legacy hotspot table (face direction + bounding box) ---- */
  const HOT = [['shutterbtn', 'top'], ['maindial', 'top'], ['moviebtn', 'top'], ['modedial', 'top'], ['power', 'top'], ['hotshoe', 'top'], ['flash', 'top'], ['focalplane', 'top'],
    ['grip', 'front'], ['lamp', 'front'], ['release', 'front'], ['mount', 'front', 'nolens'], ['contacts', 'front', 'nolens'], ['sensor', 'front', 'open'], ['shutter', 'front', 'in'], ['processor', 'back', 'in'],
    ['evf', 'back'], ['eyesensor', 'back'], ['diopter', 'back'], ['screen', 'back'], ['menubtn', 'back'], ['infobtn', 'back'], ['crossup', 'back'], ['setbtn', 'back'], ['playbtn', 'back'], ['aelock', 'back'], ['afpoint', 'back'],
    ['door', 'bottom'], ['tripod', 'bottom'], ['battery', 'bottom', 'door'], ['card', 'bottom', 'door'], ['terminals', 'right'], ['terminals2', 'left'], ['accesslamp', 'back'], ['strap', 'left'],
    ['zoomring', 'top', 'lens'], ['focusring', 'top', 'lens'], ['frontelement', 'front', 'lens'], ['iris', 'front', 'lensin'], ['elements', 'top', 'lensin']];
  const DIR = { top: [0, 1, 0], bottom: [0, -1, 0], front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0] };
  const VIEWS = { front: [0.5, 1.2], back: [Math.PI - 0.35, 1.25], top: [0.25, 0.32], bottom: [0.3, 2.75], left: [1.45, 1.35], right: [-1.45, 1.35] };
  // actions and menu keys, keyed by the legacy ids (both models translate their own ids to these)
  const ACTION = { power: 'Flip the power switch', flash: 'Raise or lower the flash', door: 'Open or close the door', battery: 'Open or close the door', card: 'Open or close the door', terminals: 'Open or close the cover', terminals2: 'Open or close the cover',
    modedial: 'Turn the dial one click', release: 'Unlock the lens', shutterbtn: 'Press the shutter', shutter: 'Fire the shutter', mount: 'Attach the loose lens', menubtn: 'Press MENU', infobtn: 'Press INFO', setbtn: 'Press Q/SET', playbtn: 'Press Playback', crossup: 'Press ▲', crossdown: 'Press ▼', crossleft: 'Press ◀', crossright: 'Press ▶' };
  const KEYS = { menubtn: 'menu', infobtn: 'info', setbtn: 'set', playbtn: 'play', crossup: 'up', crossdown: 'down', crossleft: 'left', crossright: 'right' };
  // registry ids whose behaviour maps onto a legacy action
  const REG_LEGACY = { 'card-battery-cover-lock': 'door', 'terminal-cover-right': 'terminals', 'terminal-cover-left': 'terminals2' };
  // when a registry part's hotspot may show
  const REG_COND = { 'lens-mount': 'nolens', contacts: 'nolens', 'lens-lock-pin': 'nolens', 'rf-lens-mount-index': 'nolens', 'image-sensor': 'open', 'body-cap': 'never',
    shutter: 'in', processor: 'in', battery: 'door', card: 'door', 'digital-terminal': 'cover', 'hdmi-micro-out': 'cover', 'dc-cord-hole': 'cover', 'external-mic-in': 'cover2', 'remote-terminal': 'cover2',
    lens: 'lens', 'zoom-ring': 'lens', 'focus-ring': 'lens', 'front-element': 'lens', 'aperture-diaphragm': 'lensin', 'lens-elements': 'lensin' };
  const VIEW_OF = { top: 'top', front: 'front', rear: 'back', bottom: 'bottom', left: 'left', right: 'right', internal: 'front', lens: 'left' };

  V.create = async function (stage, opt) {
    opt = opt || {};
    const T3 = await FF.loadThree();
    const C = FF.cam, P = FF.phys;
    const canvas = h('canvas', { class: 'c3d-canvas', tabindex: 0, 'aria-label': '3D model of the Canon EOS R100. Drag to rotate, scroll to zoom, click a part to learn about it.' });
    const hotLayer = h('div', { class: 'c3d-hot' });
    const tag = h('div', { class: 'c3d-tag', hidden: true, 'aria-hidden': 'true' });
    hotLayer.append(tag);
    stage.append(canvas, hotLayer);
    const renderer = new T3.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!opt.preserve });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new T3.Scene(), cam = new T3.PerspectiveCamera(30, 1.5, 0.5, 400);
    { const env = new T3.Scene(), pm = new T3.PMREMGenerator(renderer), E = (w, hh, col, k, pos, ry, rx) => { const m = new T3.Mesh(new T3.PlaneGeometry(w, hh), new T3.MeshBasicMaterial({ color: new T3.Color(col).multiplyScalar(k), side: T3.DoubleSide })); m.position.set(...pos); m.rotation.set(rx || 0, ry || 0, 0); env.add(m); };
      env.background = new T3.Color(0x14171b); E(30, 14, 0xffffff, 9, [0, 26, 6], 0, Math.PI / 2); E(10, 22, 0xfff2e0, 7, [-28, 6, 6], Math.PI / 2); E(8, 20, 0xdfeaff, 5, [28, 4, -6], -Math.PI / 2); E(40, 10, 0xffffff, 1.6, [0, 2, 30], Math.PI); E(40, 8, 0x8090a8, 1.2, [0, 0, -30], 0); E(60, 60, 0x30343a, 1, [0, -18, 0], 0, Math.PI / 2);
      scene.environment = pm.fromScene(env, 0.03).texture; pm.dispose(); }
    renderer.toneMapping = T3.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    scene.add(new T3.HemisphereLight(0xffffff, 0x6a707a, 0.7));
    const key = new T3.DirectionalLight(0xffffff, 1.6); key.position.set(8, 14, 16); scene.add(key);
    const rim = new T3.DirectionalLight(0xbcd0ff, 1.4); rim.position.set(-12, 8, -14); scene.add(rim);
    const fill = new T3.DirectionalLight(0xffffff, 0.7); fill.position.set(0, -12, 4); scene.add(fill);

    /* screen texture shared with the menu */
    const lcdCv = opt.lcd || h('canvas', { width: 720, height: 480 });
    const lcdTex = new T3.CanvasTexture(lcdCv); lcdTex.colorSpace = T3.SRGBColorSpace; lcdTex.anisotropy = 8;

    /* ---- the model: GLB first, procedural fallback ---- */
    const M = await buildModel(T3, lcdTex, opt);
    const { root, A } = M; scene.add(root);
    const flashLight = new T3.PointLight(0xffffff, 0, 60); flashLight.position.set(M.mount.x, 6, 3); scene.add(flashLight);
    /* ---- highlight: the selected part's own surfaces glow amber, a hovered part lifts slightly ----
       each lit mesh gets a cached clone of its material, so parts that share a material don't light up together */
    const HI = { sel: [0xffb224, 0.42], hover: [0xffffff, 0.10] }, hiCache = new Map(), lit = { sel: null, hover: null };
    function hiMat(m, kind) {
      if (!m || !m.emissive) return m;
      const key = m.uuid + kind; let c = hiCache.get(key);
      if (!c) { c = m.clone(); c.emissive = new T3.Color(HI[kind][0]); c.emissiveIntensity = HI[kind][1]; if (c.emissiveMap) c.emissiveMap = null; hiCache.set(key, c); }
      c.transparent = m.transparent; c.opacity = m.opacity; c.depthWrite = m.depthWrite; return c;
    }
    function partMeshes(id) { const out = []; if (!id) return out; const look = (o) => { if (o.isMesh && partOf(o) === id) out.push(o); }; root.traverse(look); if (st.lens && lensObjs[st.lens]) lensObjs[st.lens].traverse(look); return out; }
    function light(kind, id) {
      if (lit[kind]) lit[kind].meshes.forEach((o) => { if (o.userData._baseMat) { o.material = o.userData._baseMat; delete o.userData._baseMat; } });
      lit[kind] = null;
      if (kind === 'sel' && lit.hover) { const hid = lit.hover.id; lit.hover.meshes.forEach((o) => { if (o.userData._baseMat) { o.material = o.userData._baseMat; delete o.userData._baseMat; } }); lit.hover = null; if (hid && hid !== id) light('hover', hid); }
      if (!id) return;
      const meshes = partMeshes(id).filter((o) => !o.userData._baseMat && o.material && o.material.emissive);
      meshes.forEach((o) => { o.userData._baseMat = o.material; o.material = hiMat(o.material, kind); });
      lit[kind] = { id, meshes }; touch();
    }
    const relight = () => { const s1 = lit.sel && lit.sel.id, h1 = lit.hover && lit.hover.id; light('hover', null); light('sel', null); hiCache.forEach((m) => m.dispose()); hiCache.clear(); if (s1) light('sel', s1); if (h1 && h1 !== s1) light('hover', h1); };

    const modeIdx = (name) => Math.max(0, K.MODES.indexOf(name));
    const st = { theta: 0.5, phi: 1.2, radius: M.radius || 30, target: M.target.clone(), sel: null, xray: false, hotspots: !opt.scroll, mode: modeIdx(C.state.mode), zoomK: 0, N: 5.6, lens: null, lensState: 'none' };
    const cur = { lensOut: 0, offX: 0, offY: 0, free: 0, flash: 0, door: 0, cover: 0, cover2: 0, explode: 0, dial: 0, dialIndex: 0, power: 0, theta: st.theta, phi: st.phi, radius: st.radius, press: 0 };
    const tgt = Object.assign({}, cur);
    const dialIndexOf = (m) => Math.max(0, (A.modeOrder || K.MODES).indexOf(K.MODES[m]));
    tgt.dial = cur.dial = -st.mode * Math.PI * 2 / K.MODES.length; tgt.dialIndex = cur.dialIndex = dialIndexOf(st.mode);
    if (!opt.scroll && stage.clientWidth && stage.clientWidth < 560) tgt.radius = cur.radius = st.radius = st.radius * 0.86; // phones: frame a little closer
    if (!opt.scroll && !reduceMotion()) { cur.theta = st.theta + 1.4; cur.phi = 1.05; cur.radius = 52; } // entrance: swing in from the side and settle on the three-quarter view
    let dirty = true, running = false, raf = 0, shutT = -1, tweens = [], pressed = null, settled = 0;
    const api = { st, tgt, canvas, lcd: lcdCv, on: {}, A, model: M.kind };
    const fire = (ev, a) => { if (api.on[ev]) api.on[ev](a); };
    const touch = () => { dirty = true; settled = 0; };

    /* ---- lenses ---- */
    const lensObjs = {};
    const lensObj = (id) => lensObjs[id] || (lensObjs[id] = M.lens(id));
    const mountPos = M.mount.clone();
    function showLens(id, state) {
      if (st.lens && st.lens !== id) scene.remove(lensObjs[st.lens]);
      const o = lensObj(id); st.lens = id; st.lensState = state; scene.add(o);
      if (state === 'mounted') { o.position.copy(mountPos); o.rotation.set(0, 0, 0); }
      const l = FF.lensById(id); st.zoomK = l.fmax > l.fmin ? (C.state.lens === id ? (C.state.f - l.fmin) / (l.fmax - l.fmin) : 0.3) : 0;
      o.userData.A.zoomK = st.zoomK; o.userData.A.setZoom(st.zoomK); st.N = Math.max(l.at(l.fmin + (l.fmax - l.fmin) * st.zoomK, l.maxAp), Math.min(st.N, 22)); o.userData.A.setAperture(st.N);
      tgt.free = state === 'mounted' ? 0 : 1; applyXray(); touch(); fire('lens');
    }
    function tween(obj, to, ms, done) { const from = {}; Object.keys(to).forEach((k) => (from[k] = k === 'rz' ? obj.rotation.z : obj.position[k])); tweens.push({ obj, from, to, ms: reduceMotion() ? 1 : ms, t: 0, done }); touch(); }
    api.detach = function () {
      if (st.lensState !== 'mounted') return; const o = lensObjs[st.lens]; st.lensState = 'moving'; tgt.free = 1;
      tween(o, { rz: 1.05 }, 380, () => tween(o, { z: mountPos.z + 1.5, x: mountPos.x + 9.5, y: mountPos.y - 0.5 }, 520, () => { st.lensState = 'free'; fire('lens'); U.toast('Lens unlocked. Drag it back onto the mount, or pick another lens.'); }));
      fire('lens');
    };
    api.attach = function (id) {
      id = id || st.lens; if (!id) return;
      const go = () => {
        if (st.lens !== id || st.lensState === 'none') { showLens(id, 'free'); lensObjs[id].position.set(mountPos.x + 9.5, mountPos.y - 0.5, mountPos.z + 1.5); }
        const o = lensObjs[id]; st.lensState = 'moving'; o.rotation.z = 1.05;
        tween(o, { x: mountPos.x, y: mountPos.y, z: mountPos.z + 3 }, 420, () => tween(o, { z: mountPos.z }, 260, () => tween(o, { rz: 0 }, 300, () => {
          st.lensState = 'mounted'; const l = FF.lensById(id); if (C.state.lens !== id) FF.act.dispatch('lens/set', { id, f: l.fmin + (l.fmax - l.fmin) * 0.3 }, '3d');
          showLens(id, 'mounted'); U.toast(l.name + ' attached'); })));
      };
      if (st.lensState === 'mounted' && st.lens !== id) { const old = lensObjs[st.lens]; st.lensState = 'moving'; tween(old, { rz: 1.05 }, 300, () => tween(old, { z: mountPos.z + 9, x: mountPos.x - 9, y: mountPos.y - 4 }, 380, () => { scene.remove(old); old.rotation.z = 0; st.lensState = 'none'; go(); })); } else go();
    };
    api.offer = function (id) { // put a lens beside the camera, ready to drag
      if (st.lens === id && st.lensState !== 'none') return;
      if (st.lensState === 'mounted') { api.attach(id); return; }
      showLens(id, 'free'); const o = lensObjs[id]; o.rotation.set(0, 0, 1.05); o.position.set(mountPos.x + 9.5, mountPos.y - 0.5, mountPos.z + 1.5); touch();
    };
    api.setZoom = (k) => { st.zoomK = k; const o = lensObjs[st.lens]; if (!o) return; o.userData.A.zoomK = k; o.userData.A.setZoom(k); o.userData.A.explode(cur.explode); const l = FF.lensById(st.lens); if (st.lensState === 'mounted' && C.state.lens === st.lens && l.fmax > l.fmin) FF.act.dispatch('focal/set', { f: Math.round(l.fmin + (l.fmax - l.fmin) * k) }, '3d'); touch(); };
    api.setAperture = (N) => { st.N = N; const o = lensObjs[st.lens]; if (o) o.userData.A.setAperture(N); touch(); };

    /* ---- state changes ---- */
    function applyXray() { const o = st.xray; A.shellMats.forEach((m) => { m.transparent = o; m.opacity = o ? 0.16 : 1; m.depthWrite = !o; m.needsUpdate = true; }); if (typeof relight === 'function') relight(); touch(); }
    api.set = function (k, v) {
      if (k === 'xray') { st.xray = v; applyXray(); }
      else if (k === 'hotspots') { st.hotspots = v; }
      else if (k === 'view') { tgt.theta = VIEWS[v][0]; tgt.phi = VIEWS[v][1]; cur.theta = ((cur.theta + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; }
      else if (k === 'mode') { st.mode = v; tgt.dial = -v * Math.PI * 2 / K.MODES.length; tgt.dialIndex = dialIndexOf(v); }
      else tgt[k] = v;
      if (reduceMotion() && (k === 'view')) { cur.theta = tgt.theta; cur.phi = tgt.phi; }
      touch(); fire('state');
    };
    api.toggle = (k) => api.set(k, tgt[k] > 0.5 ? 0 : 1);
    // act on a part (either model's id); dir picks a cross-key press point
    api.act = function (id, dir) {
      const lg = M.legacy(id) || id;
      if (lg === 'crossup' && M.kind === 'glb' && id === 'cross-keys') { const d = dir || 'up'; FF.menu.key(d); pressMesh('PART_CrossKeys'); touch(); return; }
      if (lg === 'power') { FF.menu.key('power'); api.set('power', FF.menu.power ? 1 : 0); }
      else if (lg === 'flash') { FF.act.dispatch('flash/pop', { up: !(tgt.flash > 0.5) }, '3d'); }
      else if (lg === 'door' || lg === 'battery' || lg === 'card') { api.toggle('door'); if (tgt.door) api.set('view', 'bottom'); }
      else if (lg === 'terminals') api.toggle('cover'); else if (lg === 'terminals2') api.toggle('cover2');
      else if (lg === 'modedial') { const m = (st.mode + 1) % K.MODES.length; api.set('mode', m); const name = K.MODES[m], d = K.DIAL[name]; if (d[1]) { FF.act.dispatch('mode/set', { mode: name }, '3d'); if (FF.sim && FF.sim.setKnob) FF.sim.setKnob(); } FF.menu.toast = d[0].split(':')[0]; FF.menu.key('noop'); U.toast((name === 'A+' ? 'A+' : name === 'HYB' ? 'Hybrid Auto' : name === 'FX' ? 'Creative filters' : name === 'MOV' ? 'Movie' : name) + ' · ' + d[0] + (d[1] ? '' : ' (explained here, not simulated)')); }
      else if (lg === 'release') { api.detach(); pressMesh('PART_LensReleaseButton'); }
      else if (lg === 'mount') { if (st.lensState === 'free') api.attach(); }
      else if (lg === 'shutterbtn' || lg === 'shutter') { if (shutT < 0) { shutT = 0; cur.press = 1; FF.menu.key('shutter'); } }
      else if (KEYS[lg]) { FF.menu.key(KEYS[lg]); if (M.kind === 'glb') pressMesh(M.meshOf(id)); else pressed = { m: A[lg], t: 0 }; }
      touch();
    };
    function pressMesh(name) { if (A.press && name) { A.press(name); touch(); } }
    api.actionLabel = (id) => { const lg = M.legacy(id) || id; return id === 'cross-keys' ? null : ACTION[lg] || null; };
    api.select = function (id, quiet) { st.sel = id; light('sel', id); touch(); if (!quiet) fire('select', id); };
    // turn the camera so the part faces the viewer (shortest way round); instant with reduced motion
    api.focus = function (id) {
      const n = M.normalOf(id); if (!n) return;
      let th = Math.atan2(n.x, n.z), ph = Math.acos(Math.max(-1, Math.min(1, n.y)));
      ph = Math.max(0.35, Math.min(2.8, ph * 0.85 + 1.2 * 0.15)); th += 0.25 * Math.sign(n.x || 1) * (Math.abs(n.y) < 0.8 ? 1 : 0);
      while (th - cur.theta > Math.PI) th -= 2 * Math.PI; while (th - cur.theta < -Math.PI) th += 2 * Math.PI;
      tgt.theta = th; tgt.phi = ph; if (reduceMotion()) { cur.theta = th; cur.phi = ph; } touch();
    };

    function partMesh(id) { let f = null; const look = (o) => { if (!f && o.isMesh && o.userData.part === id) f = o; }; root.traverse(look); if (!f && st.lens && lensObjs[st.lens]) lensObjs[st.lens].traverse(look); return f; }
    function partOf(o) { while (o) { if (o.userData && o.userData.part) return o.userData.part; o = o.parent; } return null; }
    function lensOf(o) { while (o) { if (o.userData && o.userData.lens) return o; o = o.parent; } return null; }

    /* ---- pointer: orbit, click, drag lens ---- */
    const ray = new T3.Raycaster(), ndc = new T3.Vector2(), plane = new T3.Plane(), tmp = new T3.Vector3();
    const pts = new Map(); let down = null, dragLens = null, pinch0 = 0;
    canvas.addEventListener('pointerleave', () => { if (lit.hover) light('hover', null); });
    const pickables = () => { const objs = [root]; if (st.lens && st.lensState !== 'none') objs.push(lensObjs[st.lens]); return objs; };
    const usable = (x) => !(st.xray && A.shellMats.includes(x.object.material)) && !x.object.userData.label && x.object.visible;
    function pick(e) { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); const hits = ray.intersectObjects(pickables(), true).filter(usable); return hits[0] || null; }
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const a = [...pts.values()]; pinch0 = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); down = null; dragLens = null; return; }
      down = { x: e.clientX, y: e.clientY, moved: 0 };
      const hit = pick(e), lo = hit && lensOf(hit.object);
      if (lo && st.lensState === 'free') { dragLens = lo; cam.getWorldDirection(tmp); plane.setFromNormalAndCoplanarPoint(tmp, lo.position); canvas.style.cursor = 'grabbing'; }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (pts.has(e.pointerId)) {
        const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2) { const a = [...pts.values()], d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (pinch0) { tgt.radius = cur.radius = Math.max(12, Math.min(90, cur.radius * pinch0 / d)); } pinch0 = d; touch(); return; }
        if (down) {
          down.moved += Math.abs(dx) + Math.abs(dy);
          if (dragLens) { pick(e); if (ray.ray.intersectPlane(plane, tmp)) dragLens.position.copy(tmp); nearMount(); touch(); }
          else if (down.moved > 3) { tgt.theta = cur.theta = cur.theta - dx * 0.008; tgt.phi = cur.phi = Math.max(0.12, Math.min(3.02, cur.phi - dy * 0.008)); touch(); }
          return;
        }
      }
      if (e.pointerType === 'mouse') { const hit = pick(e), id = hit && partOf(hit.object); canvas.style.cursor = id ? 'pointer' : 'grab'; const hid = id && id !== st.sel ? id : null; if ((lit.hover && lit.hover.id) !== hid) light('hover', hid); }
    });
    function nearMount() { const d = dragLens ? dragLens.position.distanceTo(tmp.copy(mountPos).setZ(mountPos.z + 2.5)) : 99; canvas.classList.toggle('snap', d < 5); return d < 5; }
    // which press point of the cross-key ring a hit landed on (ring local: +x = user's right, -z = up)
    function crossDir(hit) { const o = M.byName && M.byName.PART_CrossKeys; if (!o) return 'up'; const lp = o.worldToLocal(hit.point.clone()); const dx = lp.x, dy = -lp.z; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'up' : 'down'); }
    function up(e) {
      pts.delete(e.pointerId); pinch0 = 0;
      if (!down) return; const d = down; down = null; canvas.style.cursor = 'grab';
      if (dragLens) { const near = nearMount(); canvas.classList.remove('snap'); dragLens = null; if (near || d.moved < 5) api.attach(); return; }
      if (d.moved < 6) {
        const hit = pick(e), id = hit && partOf(hit.object);
        if (id) { api.select(id); const lg = M.legacy(id) || id; if (id === 'cross-keys' && M.kind === 'glb') api.act(id, crossDir(hit)); else if (ACTION[lg] && lg !== 'mount' && lg !== 'shutter') api.act(id); }
        else api.select(null);
      }
    }
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    if (!opt.scroll) canvas.addEventListener('wheel', (e) => { e.preventDefault(); tgt.radius = Math.max(12, Math.min(90, tgt.radius * (1 + Math.sign(e.deltaY) * 0.1))); touch(); }, { passive: false });
    canvas.addEventListener('keydown', (e) => { const k = { ArrowLeft: [0.15, 0], ArrowRight: [-0.15, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key]; if (k) { tgt.theta += k[0]; tgt.phi = Math.max(0.12, Math.min(3.02, tgt.phi + k[1])); e.preventDefault(); touch(); } if (e.key === '+' || e.key === '=') { tgt.radius *= 0.9; touch(); } if (e.key === '-') { tgt.radius *= 1.1; touch(); } });
    canvas.addEventListener('dragover', (e) => e.preventDefault());
    canvas.addEventListener('drop', (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/lens'); if (id && FF.lensById(id)) api.attach(id); });

    /* ---- hotspots ---- */
    const hots = M.hots.map((hs) => { const b = h('button', { class: 'c3d-dot', type: 'button', title: M.info(hs.id).name, 'aria-label': M.info(hs.id).name, onclick: () => { api.select(hs.id); api.focus(hs.id); } }); hotLayer.append(b); return Object.assign({ b, mesh: null, occ: false }, hs); });
    const box3 = new T3.Box3(), cen = new T3.Vector3(), camDir = new T3.Vector3(), nrm = new T3.Vector3(), wq = new T3.Quaternion(), occRay = new T3.Raycaster();
    function condOK(o, lensOn, open) {
      const c = o.cond;
      if (c === 'never') return false; if (c === 'in') return open; if (c === 'open') return open || !lensOn; if (c === 'nolens') return !lensOn || cur.explode > 0.25;
      if (c === 'door') return cur.door > 0.5 || cur.explode > 0.25; if (c === 'cover') return cur.cover > 0.5; if (c === 'cover2') return cur.cover2 > 0.5;
      if (c === 'lens') return st.lensState !== 'none'; if (c === 'lensin') return st.lensState !== 'none' && (open || o.id === 'iris' || o.id === 'aperture-diaphragm');
      return true;
    }
    function anchorOf(o) { if (o.lensPart) return M.lensAnchor ? M.lensAnchor(o.id, st.lens) : null; return o.anchor || null; }
    function placeHots(checkOcclusion) {
      const w = canvas.clientWidth, hh = canvas.clientHeight, lensOn = st.lensState === 'mounted', open = cur.explode > 0.25 || st.xray;
      let selPos = null;
      hots.forEach((o) => {
        // small stages show only the controls you can operate (plus the selection) so dots don't bury the camera
        let show = st.hotspots && condOK(o, lensOn, open) && (w >= 640 || o.primary || st.sel === o.id);
        const an = show && anchorOf(o);
        if (show && an) {
          an.getWorldPosition(cen); an.getWorldQuaternion(wq); nrm.set(0, 1, 0).applyQuaternion(wq); // anchor local +Y is the surface normal
          camDir.copy(cam.position).sub(cen).normalize();
          show = camDir.dot(nrm) > 0.12 || st.xray;
          if (show && checkOcclusion && !st.xray) { // something else between the camera and the anchor hides it
            const dist = cam.position.distanceTo(cen); occRay.set(cam.position, tmp.copy(cen).sub(cam.position).normalize()); occRay.far = dist - 0.12;
            const hit = occRay.intersectObjects(pickables(), true).find(usable); o.occ = !!hit && partOf(hit.object) !== o.id;
          }
          if (o.occ && !st.xray) show = false;
        } else if (show) { // procedural model, or a lens without anchors: bounding box pushed out along a face
          o.mesh = partMesh(o.id); show = !!o.mesh;
          if (show) {
            box3.setFromObject(o.mesh); box3.getCenter(cen); const sz = box3.getSize(tmp); cen.addScaledVector(o.dir, 0.5 * Math.abs(sz.dot(o.dir)) + 0.05);
            camDir.copy(cam.position).sub(cen).normalize(); const dirW = o.cond && String(o.cond).indexOf('lens') === 0 && st.lens ? tmp.copy(o.dir).applyQuaternion(lensObjs[st.lens].quaternion) : o.dir;
            show = camDir.dot(dirW) > 0.18;
          }
        }
        if (show) {
          cen.project(cam); const x = (cen.x + 1) / 2 * w, y = (1 - cen.y) / 2 * hh;
          show = cen.z < 1 && x > -8 && x < w + 8 && y > -8 && y < hh + 8;
          if (show) { o.b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; o.b.classList.toggle('on', st.sel === o.id); if (st.sel === o.id) selPos = [x, y]; }
        }
        o.b.style.display = show ? '' : 'none';
      });
      // label for the selected part: the dot stays on the anchor, only the label moves to stay inside the stage
      if (selPos && st.hotspots) {
        tag.hidden = false; tag.textContent = M.info(st.sel).short;
        const tw = tag.offsetWidth || 120, th = tag.offsetHeight || 24;
        let lx = selPos[0] + 16, ly = selPos[1] - th - 12; const flip = lx + tw > w - 6;
        if (flip) lx = selPos[0] - tw - 16; if (ly < 4) ly = selPos[1] + 14;
        tag.classList.toggle('flip', flip); tag.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px)`;
      } else tag.hidden = true;
    }

    /* ---- frame ---- */
    function resize() { const w = stage.clientWidth, hh = opt.scroll ? stage.clientHeight : Math.max(260, Math.min(w * 0.72, window.innerHeight * 0.68)); if (!w || !hh) return; st.vw = w; st.vh = hh; renderer.setSize(w, hh, false); canvas.style.width = w + 'px'; canvas.style.height = hh + 'px'; cam.aspect = w / hh; cam.fov = w < 520 ? 38 : 30; cam.updateProjectionMatrix(); touch(); }
    const ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null; if (ro) ro.observe(stage);
    let last = 0;
    function frame(ts) {
      raf = running ? requestAnimationFrame(frame) : 0;
      const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
      let moving = false;
      Object.keys(tgt).forEach((k) => { const d = tgt[k] - cur[k]; if (Math.abs(d) > 0.0008) { cur[k] += d * Math.min(1, dt * (k === 'explode' ? 5 : k === 'radius' || k === 'theta' || k === 'phi' ? 5.5 : 9)); moving = true; } else cur[k] = tgt[k]; });
      if (tweens.length) { moving = true; const tw = tweens[0]; tw.t += dt * 1000; const k = Math.min(1, tw.t / tw.ms), e = k * k * (3 - 2 * k); Object.keys(tw.to).forEach((p) => { const v = tw.from[p] + (tw.to[p] - tw.from[p]) * e; if (p === 'rz') tw.obj.rotation.z = v; else tw.obj.position[p] = v; }); if (k >= 1) { tweens.shift(); tw.done && tw.done(); } }
      let flashOn = false;
      if (shutT >= 0) {
        moving = true; shutT += dt / 0.9; const s = shutT;
        flashOn = s > 0.36 && s < 0.5 && cur.flash > 0.6; flashLight.intensity = flashOn ? 900 : 0;
        cur.press = s < 0.5 ? 1 : 0;
        if (M.kind === 'glb') A.shutter(Math.min(1, s));
        else { const c1 = A.curtain1.position, c2 = A.curtain2.position; c1.y = s < 0.2 ? 1.8 - 9 * s : s < 0.55 ? 0 - (s - 0.2) * 5.2 : -1.8; c2.y = s < 0.4 ? 1.8 : s < 0.75 ? 1.8 - (s - 0.4) * 5.2 : 0; if (s >= 1) { c1.y = 1.8; c2.y = 1.8; } }
        if (s >= 1) { shutT = -1; if (M.kind === 'glb') A.shutter(0); }
      }
      if (A.flashGlass && A.flashGlass.material && A.flashGlass.material.emissive) A.flashGlass.material.emissive.setHex(flashOn ? 0xffffff : 0);
      if (pressed) { moving = true; pressed.t += dt; pressed.m.scale.setScalar(pressed.t < 0.12 ? 0.86 : 1); if (pressed.t > 0.16) pressed = null; }
      if (!moving && !dirty) { if (settled === 1 && st.hotspots) placeHots(true); settled++; return; }
      dirty = false;
      A.units.forEach((g) => g.position.copy(g.userData.base).addScaledVector(g.userData.ex, cur.explode));
      if (M.kind === 'glb') { if (A.pose(cur, dt)) moving = true; }
      else {
        A.flash.rotation.x = -cur.flash * 1.0; A.door.rotation.z = cur.door * 1.55; A.cover.rotation.y = cur.cover * 1.7; A.cover2.rotation.y = -cur.cover2 * 1.7;
        A.dial.rotation.y = cur.dial; A.power.position.x = -0.95 - cur.power * 0.22; A.shutterBtn.position.y = 0.18 - cur.press * 0.1;
        A.battery.position.y += -1.5 * cur.door * (1 - cur.explode); A.card.position.y += -0.8 * cur.door * (1 - cur.explode);
      }
      if (st.lens && st.lensState === 'mounted') { const o = lensObjs[st.lens]; o.position.set(mountPos.x, mountPos.y, mountPos.z + cur.explode * 8.5 + cur.lensOut * 7); o.rotation.z = Math.min(1, cur.lensOut * 5) * 1.05; o.userData.A.explode(cur.explode); }
      const sp = Math.sin(cur.phi), rad = cur.radius * (1 + 0.75 * cur.explode + 0.28 * cur.free), tz = st.target.z + cur.explode * 3.5, tx = st.target.x + 3.4 * cur.free; cam.position.set(tx + rad * sp * Math.sin(cur.theta), st.target.y + rad * Math.cos(cur.phi), tz + rad * sp * Math.cos(cur.theta)); cam.lookAt(tx, st.target.y, tz);
      if (opt.scroll && st.vw) cam.setViewOffset(st.vw, st.vh, -cur.offX * st.vw, cur.offY * st.vh, st.vw, st.vh);
      renderer.render(scene, cam); placeHots(false); settled = 0;
    }
    api.start = () => { if (!running) { running = true; resize(); touch(); raf = requestAnimationFrame(frame); } };
    api.stop = () => { running = false; cancelAnimationFrame(raf); };
    api.refreshScreen = () => { FF.menu.draw(lcdCv); lcdTex.needsUpdate = true; touch(); };
    api.touch = touch; api.ACTION = ACTION;
    api.snap = () => { Object.keys(tgt).forEach((k) => (cur[k] = tgt[k])); touch(); }; // jump to the target pose (tests, reduced motion)
    api.lensState = () => ({ id: st.lens, state: st.lensState });
    // the part catalogue for the page: ids, names and text from the camera profile (GLB) or the teaching model
    api.parts = () => M.parts; api.partInfo = (id) => M.info(id); api.viewOf = (id) => M.view(id); api.tour = () => M.tour;
    FF.menu.on(api.refreshScreen);
    // follow camera changes made anywhere else (simulator deck, viewfinder, rear menu, missions): the 3D controls move to match
    const unsub = FF.act.on((a, s) => {
      if (a.source === '3d') return;
      if (a.type === 'mode/set' || a.type === 'mission/setup') { const m = modeIdx(s.mode); if (m !== st.mode) api.set('mode', m); }
      if (a.type === 'flash/pop' || a.type === 'flash/set' || a.type === 'mission/setup') { const want = s.pop ? 1 : 0; if (tgt.flash !== want) api.set('flash', want); }
      if ((a.type === 'lens/set' || a.type === 'mission/setup' || a.type === 'scene/set') && st.lensState === 'mounted' && st.lens !== s.lens) api.swap(s.lens);
      if (a.type === 'focal/set' || a.type === 'lens/set') { const l = FF.lensById(s.lens), o = lensObjs[st.lens]; if (o && st.lens === s.lens && l.fmax > l.fmin) { st.zoomK = (s.f - l.fmin) / (l.fmax - l.fmin); o.userData.A.zoomK = st.zoomK; o.userData.A.setZoom(st.zoomK); touch(); } }
      fire('state');
    });
    api.dispose = () => { unsub(); api.stop(); };
    api.swap = (id) => { if (st.lens !== id) showLens(id, 'mounted'); };
    if (opt.scroll) { canvas.style.pointerEvents = 'none'; canvas.tabIndex = -1; canvas.setAttribute('aria-hidden', 'true'); hotLayer.hidden = true; }
    showLens(opt.lens || C.state.lens, 'mounted'); api.refreshScreen();
    return api;
  };

  /* ---------------- model adapters ---------------- */
  async function buildModel(T3, lcdTex, opt) {
    if (FF.cam3dGLB && FF.cam3dGLB.available() && !opt.procedural) {
      try { return await glbModel(T3, lcdTex); } catch (e) { console.warn('[FirstFrame] GLB camera unavailable, using the teaching model:', e.message); }
    }
    return proceduralModel(T3, lcdTex);
  }

  async function glbModel(T3, lcdTex) {
    const P = FF.camera, built = await FF.cam3dGLB.build(T3, lcdTex), A = built.A;
    const legacyToReg = {}; P.parts.forEach((p) => { if (p.legacyId) legacyToReg[p.legacyId] = p.id; });
    ['crossdown', 'crossleft', 'crossright'].forEach((k) => (legacyToReg[k] = 'cross-keys'));
    const legacy = (id) => REG_LEGACY[id] || (P.part(id) && P.part(id).legacyId) || null;
    const isLens = (p) => p.view === 'lens';
    const hots = P.parts.filter((p) => REG_COND[p.id] !== 'never').map((p) => ({
      id: p.id, cond: REG_COND[p.id] || null, anchor: built.anchors[p.anchorName] || null, lensPart: isLens(p), primary: !!p.interactive || p.id === 'screen' || p.id === 'lens-mount',
      dir: new T3.Vector3(...DIR[{ top: 'top', bottom: 'bottom', front: 'front', rear: 'back', left: 'left', right: 'right' }[p.view] || 'top'])
    }));
    const info = (id) => {
      const p = P.part(id); if (!p) return { name: id, short: id };
      return { name: p.officialLabel, short: p.uiLabel || p.officialLabel, official: p.officialLabel, desc: p.description, use: p.operation, lesson: p.lesson, marking: p.marking, status: p.status, source: p.sourceUrl, functions: p.functions || null, view: p.view };
    };
    const tour = ['power-switch', 'mode-dial', 'shutter-button', 'dial', 'screen', 'menu-button', 'quick-control-set', 'cross-keys', 'viewfinder-eyepiece', 'built-in-flash', 'lens-release-button', 'lens-mount', 'image-sensor', 'shutter', 'card-battery-cover', 'battery', 'card', 'terminal-cover-right', 'zoom-ring', 'aperture-diaphragm'];
    const normalOf = (id) => { const p = P.part(id), an = p && built.anchors[p.anchorName]; if (!an) return null; const q = new T3.Quaternion(); an.getWorldQuaternion(q); return new T3.Vector3(0, 1, 0).applyQuaternion(q); };
    const meshOf = (id) => { const p = P.part(id); return p && p.meshNames[0]; };
    // lenses: the kit lens is the modelled GLB lens; others stay procedural, with their part tags mapped to registry ids
    const lens = (id) => {
      if (built.lenses && built.lenses[id] && !built.lenses[id].userData.used) { built.lenses[id].userData.used = true; return built.lenses[id]; } // modelled from Canon photos
      const g = K.buildLens(T3, FF.lensById(id)); g.traverse((o) => { if (o.userData.part && legacyToReg[o.userData.part]) o.userData.part = legacyToReg[o.userData.part]; }); return g;
    };
    return {
      kind: 'glb', root: built.root, A, byName: A.byName, mount: A.mount, target: new T3.Vector3(0.3, -0.35, 1.2), radius: 36,
      parts: P.parts.filter((p) => REG_COND[p.id] !== 'never').map((p) => ({ id: p.id, name: p.officialLabel, short: p.uiLabel, view: p.view })),
      hots, info, legacy, tour, normalOf, meshOf, lens,
      lensAnchor: (pid, lid) => { const p = P.part(pid); return p && built.anchors[p.anchorName + (lid === 'kit' ? '' : '__' + lid)] || null; },
      view: (id) => { const p = P.part(id); return p ? VIEW_OF[p.view] || 'front' : 'front'; }
    };
  }

  function proceduralModel(T3, lcdTex) {
    const { root, A } = K.buildBody(T3, lcdTex);
    const SIDE = { power: 'top', modedial: 'top', shutterbtn: 'top', maindial: 'top', moviebtn: 'top', hotshoe: 'top', flash: 'front', focalplane: 'top', screen: 'back', menubtn: 'back', infobtn: 'back', setbtn: 'back', crossup: 'back', crossdown: 'back', crossleft: 'back', crossright: 'back', playbtn: 'back', aelock: 'back', afpoint: 'back', evf: 'back', eyesensor: 'back', diopter: 'back', speaker: 'back', processor: 'back',
      door: 'bottom', battery: 'bottom', card: 'bottom', tripod: 'bottom', terminals: 'right', terminals2: 'left', accesslamp: 'back', strap: 'left' };
    const info = (id) => { const p = K.PARTS[id]; return p ? { name: p[0], short: p[0], desc: p[1], use: p[2], lesson: p[3], status: 'educational', note: 'Teaching model: simplified shapes and positions.' } : { name: id, short: id }; };
    return {
      kind: 'procedural', root, A, mount: new T3.Vector3(K.MOUNT[0], K.MOUNT[1], K.MOUNT[2] + 0.2), target: new T3.Vector3(0.4, 0.9, 1.6), radius: 30,
      parts: Object.keys(K.PARTS).filter((k) => k !== 'body' && k !== 'lens').map((k) => ({ id: k, name: K.PARTS[k][0] })),
      hots: HOT.map(([id, side, cond]) => ({ id, cond, anchor: null, primary: !!ACTION[id], dir: new T3.Vector3(...DIR[side]) })),
      info, legacy: (id) => id, normalOf: () => null, meshOf: () => null, lens: (id) => K.buildLens(T3, FF.lensById(id)),
      tour: ['power', 'modedial', 'shutterbtn', 'maindial', 'screen', 'menubtn', 'setbtn', 'evf', 'flash', 'release', 'mount', 'sensor', 'shutter', 'door', 'battery', 'card', 'terminals', 'zoomring', 'iris'],
      view: (id) => SIDE[id] || (['zoomring', 'focusring', 'elements'].includes(id) ? 'left' : 'front')
    };
  }
})();
