/* cam3d_glb.js: the Canon EOS R100 production model (Blender -> GLB) for the 3D viewer.
   Loads assets/models/canon-eos-r100/Canon_EOS_R100.glb once, then gives each viewer its own copy wired to the same
   interface the procedural model offers (FF.cam3dModel), so cam3d.js can drive either:
   A.units (explode), A.pose(cur, shot) (flash, door, covers, dials, power, shutter), A.lcd, A.shellMats, A.parts.
   Pivots, axes and ranges come from glTF extras written by blender/eos-r100/build_r100.py (ff_motion, ff_axis, ...).
   Units: the GLB is in metres; the viewer works in centimetres, so the copy is scaled by 100. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const G = (FF.cam3dGLB = {});
  let gltfP = null;

  G.available = () => !!(FF.camera && FF.camera.modelUrl);
  // phones and low-memory devices get the lighter level of detail (same parts, anchors and pivots)
  G.useMobile = function () {
    try { if (new URLSearchParams(location.search).has('lod')) return new URLSearchParams(location.search).get('lod') === 'mobile'; } catch (e) { /* no URL */ }
    const small = Math.min(screen.width || 9999, screen.height || 9999) < 700, lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
    return !!(FF.camera.mobileModelUrl && (small || lowMem));
  };
  G.url = () => (G.useMobile() ? FF.camera.mobileModelUrl : FF.camera.modelUrl);
  const DRACO = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/';
  G.load = function (T3) {
    if (!gltfP) {
      const url = G.url();
      gltfP = Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js')]).then(([{ GLTFLoader }, { DRACOLoader }]) => new Promise((res, rej) => {
        const draco = new DRACOLoader(); draco.setDecoderPath(DRACO);
        const ld = new GLTFLoader(); ld.setDRACOLoader(draco);
        ld.load(url, (g) => { g.userData.url = url; res(g); }, undefined, (e) => rej(new Error('Could not load the camera model (' + (e && e.message || 'network error') + ').')));
      }));
      gltfP.catch(() => { gltfP = null; });
    }
    return gltfP;
  };

  // explode offsets (cm) by part, so the exploded view separates real assemblies
  const EXPLODE = [
    [/^(PART_LensMount|BODY_MountBase|PART_RfLensMountIndex|PART_LensLockPin|PART_Contacts|BODY_ContactBlock)/, [0, 0, 4.2]],
    [/^(PART_ImageSensor|BODY_SensorPackage|BODY_SensorPlate)/, [0, 0, 0.9]], [/^PART_Shutter$/, [0, 0, 2.0]], [/^PART_Processor$/, [0, 0, -1.6]],
    [/^(PART_Screen|PART_AeLockButton|PART_AfPointButton|PART_InfoButton|PART_PlaybackButton|PART_MenuButton|PART_CrossKeys|PART_QuickControlSet|PART_AccessLamp|BODY_\w*Bezel|BODY_ThumbRest)/, [0, 0, -3.6]],
    [/^(PART_ShutterButton|BODY_ShutterCollar|PART_Dial|PART_MovieShootingButton|BODY_MovieButtonRing|PART_ModeDial|BODY_ModeDialIndex|PART_PowerSwitch)/, [0, 2.4, 0]],
    [/^(PART_BuiltInFlash|PART_HotShoe|BODY_HotShoeBase|PART_Microphone)/, [0, 4.0, 0.6]], [/^(PART_Eyecup|BODY_EyepieceWell|PART_ViewfinderEyepiece|PART_ViewfinderSensor|PART_DioptricAdjustmentSlider)/, [0, 1.6, -3.0]],
    [/^PART_CardBatteryCover$/, [0, -2.2, 0]], [/^PART_Battery$/, [0, -5.2, 0]], [/^PART_Card$/, [-0.6, -4.6, -1.2]], [/^PART_TripodSocket|BODY_TripodHole/, [0, -1.6, 0]],
    [/^(PART_TerminalCoverRight|PART_DigitalTerminal|PART_HdmiMicroOut|PART_DcCordHole)/, [-2.6, 0, 0]], [/^(PART_TerminalCoverLeft|PART_ExternalMicIn|PART_RemoteTerminal)/, [2.6, 0, 0]],
  ];
  const SHELL = /^(BODY_Shell|BODY_Leatherette|PART_Grip|BODY_ThumbRest|PART_Eyecup|PART_BuiltInFlash|PART_CardBatteryCover|PART_TerminalCover)/;

  G.build = async function (T3, lcdTex) {
    const gltf = await G.load(T3);
    const P = FF.camera;
    const scene = gltf.scene.clone(true);
    // own materials per viewer (x-ray and flash glow must not leak between the landing page and the explorer)
    const matCache = new Map();
    scene.traverse((o) => {
      if (o.isMesh) { o.material = matCache.get(o.material) || (matCache.set(o.material, o.material.clone()), matCache.get(o.material)); o.castShadow = o.receiveShadow = false; }
    });
    const byName = {}; scene.traverse((o) => { if (o.name) byName[o.name] = o; });
    const body = byName[P.bodyRoot], lensRoot = byName[P.lensRoots.kit];
    if (!body) throw new Error('The camera model is missing ' + P.bodyRoot + '.');
    const root = new T3.Group(); root.name = 'R100'; root.scale.setScalar(100); root.add(body);

    // part ids on meshes (registry ids); detail children inherit through partOf()
    P.parts.forEach((p) => p.meshNames.forEach((n) => { if (byName[n]) byName[n].userData.part = p.id; }));
    const anchors = {}; Object.keys(byName).forEach((n) => { if (n.startsWith('ANCHOR_')) anchors[n] = byName[n]; });

    // rear LCD: paint the live menu canvas onto SCREEN_Display (UVs rebuilt so u runs left->right, v up, as seen from behind)
    const disp = byName[P.screenMesh];
    if (disp && disp.isMesh) {
      const g = disp.geometry = disp.geometry.clone(), pos = g.attributes.position, uv = g.attributes.uv;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < pos.count; i++) { x0 = Math.min(x0, pos.getX(i)); x1 = Math.max(x1, pos.getX(i)); z0 = Math.min(z0, pos.getZ(i)); z1 = Math.max(z1, pos.getZ(i)); }
      for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x0) / (x1 - x0), (z1 - pos.getZ(i)) / (z1 - z0));
      uv.needsUpdate = true;
      disp.material = new T3.MeshBasicMaterial({ map: lcdTex, toneMapped: false });
    }

    // animated parts: remember the rest pose, read pivots/axes from the extras
    const mot = {};
    [root, scene].forEach((r) => r.traverse((o) => { const e = o.userData; if (e && e.ff_motion) mot[o.name] = { o, e, q0: o.quaternion.clone(), p0: o.position.clone(), axis: new T3.Vector3().fromArray(e.ff_axis || [0, 1, 0]) }; })); // body already lives under root
    const q = new T3.Quaternion();
    const rot = (m, a) => { if (!m) return; q.setFromAxisAngle(m.axis, a); m.o.quaternion.copy(q).multiply(m.q0); };
    const slide = (m, d) => { if (!m) return; m.o.position.copy(m.p0).addScaledVector(m.axis, d); };

    // explode units
    const units = [];
    body.children.forEach((o) => {
      const hit = EXPLODE.find(([re]) => re.test(o.name));
      if (!hit) return;
      o.userData.base = o.position.clone(); o.userData.ex = new T3.Vector3(...hit[1]).multiplyScalar(0.01);
      units.push(o);
    });

    const shellMats = []; body.traverse((o) => { if (o.isMesh && SHELL.test(o.name) && !shellMats.includes(o.material)) shellMats.push(o.material); });
    const md = mot.PART_ModeDial, order = (md && md.e.ff_order) || P.modeDial, step = ((md && md.e.ff_step_deg) || -40) * Math.PI / 180;
    const flashWin = byName.PART_BuiltInFlash_Window;
    const pressT = {};
    const A = {
      glb: true, url: gltf.userData.url, units, shellMats, anchors, byName, lcd: disp, mot,
      flashGlass: flashWin, mount: new T3.Vector3(), modeOrder: order,
      press(name) { pressT[name] = 0.16; },
      pose(cur, dt) {
        rot(mot.PART_BuiltInFlash, cur.flash * -0.95);
        rot(mot.PART_CardBatteryCover, cur.door * (mot.PART_CardBatteryCover ? mot.PART_CardBatteryCover.e.ff_open : -1.55));
        rot(mot.PART_TerminalCoverRight, cur.cover * 1.6);
        rot(mot.PART_TerminalCoverLeft, cur.cover2 * 1.6); rot(mot.PART_TerminalCoverLeftRemote, cur.cover2 * 1.6);
        rot(mot.PART_ModeDial, cur.dialIndex * step);
        rot(mot.PART_PowerSwitch, cur.power > 0.5 ? 0.14 : -0.14);
        slide(mot.PART_ShutterButton, -cur.press * 0.0007);
        // battery and card drop out a little when the door opens (and stay put in the exploded view)
        if (mot.PART_Battery) mot.PART_Battery.o.position.y = mot.PART_Battery.o.userData.base.y - 0.015 * cur.door * (1 - cur.explode) + mot.PART_Battery.o.userData.ex.y * cur.explode;
        if (mot.PART_Card) mot.PART_Card.o.position.y = mot.PART_Card.o.userData.base.y - 0.008 * cur.door * (1 - cur.explode) + mot.PART_Card.o.userData.ex.y * cur.explode;
        Object.keys(pressT).forEach((n) => { const m = mot[n]; pressT[n] -= dt; if (m) slide(m, pressT[n] > 0 ? (m.e.ff_range ? m.e.ff_range[1] : 0.0005) : 0); if (pressT[n] <= 0) delete pressT[n]; });
        return Object.keys(pressT).length > 0;
      },
      shutter(s) { // s 0..1 through a shot; curtains slide over the sensor and back (electronic first curtain, simplified)
        const c1 = mot.PART_Shutter_Curtain1, c2 = mot.PART_Shutter_Curtain2;
        const k1 = s < 0.4 ? 0 : s < 0.75 ? (s - 0.4) / 0.35 : s < 0.9 ? 1 : 1 - (s - 0.9) / 0.1;
        slide(c2, k1 * 0.0165); slide(c1, 0);
      },
    };
    // mount face centre in viewer units (cm): from the lens root's rest position
    if (lensRoot) { lensRoot.updateWorldMatrix(true, false); A.mount.setFromMatrixPosition(lensRoot.matrixWorld).multiplyScalar(100); }
    else A.mount.set(1.115, -0.785, 2.28);

    // the kit lens as its own object, oriented like the procedural lenses: origin on the mount face, +z forward, cm
    let kit = null;
    if (lensRoot) kit = buildKitLens(T3, lensRoot, byName);
    // the other shelf lenses: roots R100_Lens_<id>, objects <Kind>__<id> (built from Canon photos in Blender)
    const lenses = { kit };
    Object.keys(byName).forEach((n) => { const m = /^R100_Lens_(\w+)$/.exec(n); if (m && m[1] !== 'Kit' && byName[n].userData.ff_lens) lenses[byName[n].userData.ff_lens] = buildShelfLens(T3, byName[n], byName[n].userData.ff_lens); });
    return { root, A, kit, lenses, anchors };
  };

  // GLB object-name prefix -> camera-profile part id, for the shelf lenses' suffixed objects
  const LENS_PART = [[/^LENS_ZoomRing/, 'zoom-ring'], [/^LENS_(ControlRing|FocusRing)/, 'focus-ring'], [/^LENS_FrontElement/, 'front-element'], [/^LENS_Aperture/, 'aperture-diaphragm'], [/^LENS_Elements/, 'lens-elements'], [/^LENS_/, 'lens']];
  function buildShelfLens(T3, lensRoot, lid) {
    const wq = new T3.Quaternion(); lensRoot.updateWorldMatrix(true, false); lensRoot.getWorldQuaternion(wq);
    lensRoot.removeFromParent(); lensRoot.position.set(0, 0, 0); lensRoot.quaternion.copy(wq); lensRoot.scale.setScalar(1);
    const g = new T3.Group(); g.add(lensRoot); g.scale.setScalar(100); g.userData.lens = lid;
    const find = (base) => { let f = null; lensRoot.traverse((o) => { if (!f && o.name === base + '__' + lid) f = o; }); return f; };
    lensRoot.traverse((o) => { o.userData.lensPart = true; const hit = o.name && LENS_PART.find(([re]) => re.test(o.name)); if (hit && !o.name.startsWith('LENS_Print') && !o.name.startsWith('LENS_Scale')) o.userData.part = hit[1]; });
    const Y = new T3.Vector3(0, 1, 0), q = new T3.Quaternion();
    const zr = find('LENS_ZoomRing'), ib = find('LENS_InnerBarrel'), ap = find('LENS_Aperture'), el = find('LENS_Elements');
    const zq0 = zr && zr.quaternion.clone(), ib0 = ib && ib.position.clone(), el0 = el && el.position.clone();
    const zrange = zr && zr.userData.ff_range ? zr.userData.ff_range[1] : 0, ext = ib && ib.userData.ff_range ? ib.userData.ff_range[1] : 0;
    // iris: a 7/9-blade opening that tracks the f-number, sized from the modelled aperture ring
    let iris = null, irisMax = 0.01, irisOuter = 0.02;
    if (ap) {
      ap.geometry.computeBoundingBox(); const bb = ap.geometry.boundingBox; irisOuter = Math.max(bb.max.x, bb.max.z) * 0.98; irisMax = irisOuter * 0.55;
      iris = new T3.Mesh(new T3.RingGeometry(irisMax, irisOuter, ap.userData.ff_blades || 7, 1), new T3.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.5, metalness: 0.5, side: T3.DoubleSide }));
      iris.rotation.x = -Math.PI / 2; iris.position.copy(ap.position); iris.position.y = (bb.min.y + bb.max.y) / 2 + ap.position.y; iris.userData.part = 'aperture-diaphragm';
      ap.parent.add(iris); ap.visible = false;
    }
    const l = FF.lensById && FF.lensById(lid);
    const A = {
      zoomK: 0, parts: [], shell: [],
      setZoom(k) { A.zoomK = k; if (zr) { q.setFromAxisAngle(Y, zrange * k); zr.quaternion.copy(q).multiply(zq0); } if (ib) ib.position.copy(ib0).addScaledVector(Y, ext * k); },
      setAperture(N) {
        if (!iris) return; const maxN = l ? l.maxAp[0] : 4, rad = Math.max(irisOuter * 0.04, irisMax * Math.min(1, maxN / N));
        iris.geometry.dispose(); iris.geometry = new T3.RingGeometry(rad, irisOuter, ap.userData.ff_blades || 7, 1); iris.rotation.z = N * 0.2;
      },
      explode(k) { if (ib) ib.position.copy(ib0).addScaledVector(Y, ext * A.zoomK + k * 0.03); if (el) el.position.copy(el0).addScaledVector(Y, k * 0.02); },
    };
    g.userData.A = A; return g;
  }

  function buildKitLens(T3, lensRoot, byName) {
    lensRoot.updateWorldMatrix(true, true);
    const wq = new T3.Quaternion(); lensRoot.getWorldQuaternion(wq);
    lensRoot.removeFromParent(); lensRoot.position.set(0, 0, 0); lensRoot.quaternion.copy(wq); lensRoot.scale.setScalar(1);
    const g = new T3.Group(); g.add(lensRoot); g.scale.setScalar(100); g.userData.lens = 'kit';
    lensRoot.traverse((o) => { o.userData.lensPart = true; });
    // lens-local axis: Blender local +Z (forward) arrives as local +Y under the lens root
    const zr = byName.LENS_ZoomRing, ib = byName.LENS_InnerBarrel, ap = byName.LENS_Aperture, el = byName.LENS_Elements;
    const zq0 = zr.quaternion.clone(), ib0 = ib.position.clone(), Y = new T3.Vector3(0, 1, 0), q = new T3.Quaternion();
    // aperture: replace the static annulus with a 7-blade opening that tracks the f-number
    const irisMax = 0.0118, irisOuter = 0.0235;
    const irisMat = new T3.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.5, metalness: 0.5, side: T3.DoubleSide });
    const iris = new T3.Mesh(new T3.RingGeometry(irisMax, irisOuter, 7, 1), irisMat); iris.rotation.x = -Math.PI / 2; iris.position.y = 0.0222;
    iris.userData.part = 'aperture-diaphragm'; ap.parent.add(iris); ap.visible = false;
    const el0 = el.position.clone();
    const l = FF.lensById && FF.lensById('kit');
    const A = {
      r: 3.45, L: 4.43, ext: 3.0, zoomK: 0, parts: [], shell: [],
      setZoom(k) { // 18 mm -> 45 mm turns the ring 55 deg; the barrel is longest at the wide end (approximation)
        A.zoomK = k; q.setFromAxisAngle(Y, -k * 55 * Math.PI / 180); zr.quaternion.copy(q).multiply(zq0);
        ib.position.copy(ib0).addScaledVector(Y, 0.030 - 0.008 * k);
      },
      setAperture(N) {
        const maxN = l ? l.maxAp[0] : 4.5, rad = Math.max(0.0008, irisMax * Math.min(1, maxN / N));
        iris.geometry.dispose(); iris.geometry = new T3.RingGeometry(rad, irisOuter, 7, 1); iris.rotation.z = N * 0.2;
      },
      explode(k) { ib.position.copy(ib0).addScaledVector(Y, 0.030 - 0.008 * A.zoomK + k * 0.03); el.position.copy(el0).addScaledVector(Y, k * 0.02); },
    };
    g.userData.A = A; A.setZoom(0.3);
    return g;
  }
})();
