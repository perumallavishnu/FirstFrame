/* cam3d_model.js: a procedural 3D model of the camera body and its lenses, built from simple shapes.
   Proportions follow the EOS R100 (about 116 × 86 × 69 mm). It is a teaching model, not a scan. Units are centimetres. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const K = (FF.cam3dModel = {});

  /* ---- part descriptions: id -> [name, what it does, how to use / tip, optional link] ---- */
  K.PARTS = {
    body: ['Camera body', 'The light-tight box that holds everything. On the R100 it is a polycarbonate shell around a metal chassis.', 'Hold it with your right hand on the grip and your left hand under the lens.'],
    grip: ['Grip', 'Rubber-covered handle for your right hand. The battery and memory card sit inside it.', 'Wrap three fingers around it, index finger resting on the shutter button.'],
    shutterbtn: ['Shutter button', 'Two stages. Half-press: the camera focuses and measures the light. Full press: it takes the photo.', 'Squeeze it gently. Jabbing it shakes the camera.', '#lesson-focus'],
    maindial: ['Main dial', 'Changes the main setting of the current mode: shutter speed in Tv, aperture in Av, and both (with the exposure compensation key) in M.', 'Turn it with your index finger without taking your eye from the viewfinder.'],
    moviebtn: ['Movie button', 'Starts and stops video recording in any mode.', 'The R100 records 4K at 25p (cropped) or Full HD up to 60p.'],
    modedial: ['Mode dial', 'Chooses who decides the exposure: the camera (A+, scene modes), both of you (P, Tv, Av) or you alone (M).', 'Click the dial here to turn it. Learn in Av first.', '#lesson-modes'],
    power: ['Power switch', 'Turns the camera on and off.', 'Click it to switch on. The screen wakes up and the menu becomes available.'],
    hotshoe: ['Hot shoe', 'A mount with electrical contacts on top of the camera for an external flash or trigger.', 'An external flash can bounce light off a ceiling, which looks far softer than the built-in flash.'],
    flash: ['Built-in flash', 'A small pop-up flash with a guide number of about 6 (metres at ISO 100). Good as fill light for backlit faces within a couple of metres.', 'On the R100 you lift it by hand. Click it here to raise or lower it.', '#lesson-metering'],
    evf: ['Electronic viewfinder (EVF)', 'A tiny OLED screen with 2.36 million dots behind a magnifying eyepiece. It shows exactly what the sensor sees, including exposure.', 'Use it in bright sun when the rear screen is hard to see. Pressing the camera to your face also steadies it.'],
    eyesensor: ['Viewfinder sensor', 'Detects your eye and switches the picture from the rear screen to the viewfinder.', 'If the screen goes black on a tripod, something is covering this sensor.'],
    diopter: ['Dioptric adjustment', 'Focuses the viewfinder for your eyesight. It does not affect the photo.', 'Look at the numbers in the viewfinder and slide it until they are sharp.'],
    screen: ['Rear screen', 'A fixed 3.0-inch LCD with 1.04 million dots. It shows the live picture, menus and playback. It is not a touchscreen.', 'Turn the camera on and press MENU to explore every setting.'],
    menubtn: ['MENU button', 'Opens the menu, where every setting lives, and steps back out of sub-menus.', 'Click it, then use the cross keys and SET.'],
    infobtn: ['INFO button', 'Cycles what is shown over the picture: full information, basic information, or a clean view.', 'In playback it shows the histogram and shooting data.'],
    crossup: ['Cross keys: up (exposure compensation / erase)', 'Moves up in menus. While shooting it opens exposure compensation, so you can make the picture brighter or darker. In playback it erases the photo.', 'The icon beside it is a +/− square and a bin.', '#lesson-modes'],
    crossdown: ['Cross keys: down (drive mode / self-timer)', 'Moves down in menus. While shooting it chooses single shot, continuous shooting or the 10 s and 2 s self-timers.', 'The icon is a stack of frames with a small clock.'],
    crossleft: ['Cross keys: left (ISO)', 'Moves left in menus. While shooting it opens ISO speed.', 'Marked ISO.', '#lesson-iso'],
    crossright: ['Cross keys: right (flash)', 'Moves right in menus. While shooting it opens the flash settings.', 'Marked with a lightning bolt.'],
    accesslamp: ['Access lamp', 'Lights while the camera is writing to the memory card.', 'Never open the card door or remove the battery while it is lit.'],
    setbtn: ['Q / SET button', 'Confirms a choice in menus. While shooting it opens the Quick Control screen, a shortcut to the most-used settings.', 'Press it on the shooting screen, then use up/down to pick and left/right to change.'],
    playbtn: ['Playback button', 'Shows the photos on the card.', 'Left/right moves between photos. INFO shows the histogram.'],
    aelock: ['AE lock / FE lock button (✱)', 'Freezes the exposure reading so you can recompose without the brightness changing. In playback it zooms in.', 'Point at your subject, press ✱, recompose, shoot.', '#lesson-metering'],
    afpoint: ['AF point selection button', 'Lets you move the focus point with the cross keys. In playback it zooms out to an index of thumbnails.', '', '#lesson-focus'],
    lamp: ['AF-assist / self-timer lamp', 'Lights up dim subjects so autofocus can lock, blinks during the self-timer countdown and reduces red-eye.', 'You can turn the assist beam off in the menu for discreet shooting.'],
    release: ['Lens release button', 'Unlocks the lens so that it can be twisted off.', 'Click it here: the lens unlocks and you can drag it away. Change lenses with the camera off and the mount facing down.'],
    mount: ['RF lens mount', 'The metal ring the lens locks into. It is 54 mm wide and only 20 mm from the sensor.', 'Line up the white (RF-S) or red (RF) mark on the lens with the mark on the mount, then twist clockwise until it clicks.'],
    contacts: ['Electrical contacts', 'Twelve gold pins that carry power and data between body and lens: focus, aperture, stabilisation and lens information.', 'Never touch them. Dirty contacts cause lens communication errors.'],
    sensor: ['Image sensor', 'A 22.3 × 14.9 mm APS-C CMOS chip with 24.1 million pixels. Each pixel turns light into an electrical charge.', 'It is exposed when the lens is off. Do not touch it or blow on it with your mouth.', '#lesson-light'],
    shutter: ['Shutter', 'Two curtains in front of the sensor. They open and close to time the exposure, from 30 s to 1/4000 s.', 'Press the shutter button here with the lens off to watch it run.', '#lesson-shutter'],
    processor: ['Main board and DIGIC 8 processor', 'Reads the sensor, runs autofocus and face detection, and turns raw data into JPEGs and video.', ''],
    battery: ['LP-E17 battery', 'A rechargeable 7.2 V lithium-ion pack. Canon rates it at about 320 shots through the viewfinder or 400 on the screen (power saving).', 'Carry a spare. Cold weather drains it faster.'],
    card: ['SD memory card', 'Stores the photos. The R100 has one slot for SD, SDHC or SDXC cards (UHS-I).', 'Format new cards in the camera. Push the card in to release it.'],
    door: ['Card / battery compartment cover', 'A sprung door under the grip.', 'Click it to open. Slide the lock, the door swings down, and the battery pops out against its latch.'],
    tripod: ['Tripod socket', 'A standard ¼-inch thread for tripods, monopods and plates.', 'Needed for long exposures, night scenes and self-portraits.', '#lesson-longexp'],
    terminals: ['Terminal cover, grip side (USB-C and HDMI)', 'Behind it are the digital terminal (USB Type-C) for copying photos and a micro HDMI output for a TV or monitor.', 'Click it to open.'],
    terminals2: ['Terminal cover, left side (microphone and remote)', 'Behind it are a 3.5 mm microphone input and the socket for a wired remote switch.', 'A remote lets you fire the shutter on a tripod without touching the camera.'],
    strap: ['Strap mount', 'Metal eyelets on both sides for the neck strap.', 'Thread the strap back through its buckle so it cannot slip.'],
    speaker: ['Microphone and speaker', 'The built-in monaural microphone records sound for video; the speaker plays it back and makes the focus beep.', ''],
    focalplane: ['Focal plane mark', 'A small symbol (a circle with a line through it) that marks exactly where the sensor sits inside the body.', 'Minimum focus distances are measured from this mark, not from the front of the lens.'],
    lens: ['Lens', 'Gathers light and focuses it on the sensor. The focal length sets the angle of view; the aperture sets brightness and depth of field.', '', '#lesson-lenses'],
    zoomring: ['Zoom ring', 'Turning it changes the focal length. On a retractable kit lens it also extends the barrel from its parked position.', 'Use the Zoom slider below and watch the barrel move.'],
    focusring: ['Focus / control ring', 'Turns to focus by hand in MF mode. On RF lenses it can also be set to change aperture, ISO or exposure compensation.', ''],
    frontelement: ['Front element', 'The first piece of glass. Its coatings cut reflections and flare.', 'Keep it clean with a blower and a microfibre cloth. A lens hood protects it.'],
    iris: ['Aperture diaphragm', 'Seven curved blades that form an adjustable hole. A small f-number is a big hole.', 'Use the Aperture slider below and look into the front of the lens.', '#lesson-aperture'],
    elements: ['Lens elements', 'Several glass elements in groups. Together they bend light to a sharp image and cancel each other’s colour and shape errors.', 'Pull the exploded view to see them separate.'],
    lensmount: ['Lens mount and contacts', 'The bayonet that locks into the body, with matching gold contacts and the alignment mark.', '']
  };

  let T3;
  const mats = {};
  function M(name, o) { if (!mats[name]) mats[name] = new T3.MeshStandardMaterial(o); return mats[name]; }
  function noiseTex(size, draw, rep) { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, size, size); draw(x, size); const t = new T3.CanvasTexture(c); t.wrapS = t.wrapT = T3.RepeatWrapping; t.repeat.set(rep, rep); return t; }
  function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function matsInit() {
    M('shell', { color: 0x1d1e21, roughness: 0.58, metalness: 0.1 }); M('rubber', { color: 0x121314, roughness: 0.9 });
    M('metal', { color: 0xb9bdc3, roughness: 0.3, metalness: 0.9 }); M('dark', { color: 0x08090a, roughness: 0.9 });
    M('btn', { color: 0x2a2c30, roughness: 0.45, metalness: 0.15 }); M('red', { color: 0xd0342c, roughness: 0.5 }); M('white', { color: 0xe9ecef, roughness: 0.5 });
    M('gold', { color: 0xd8b24a, roughness: 0.3, metalness: 1 }); M('pcb', { color: 0x1f6b45, roughness: 0.6 }); M('chip', { color: 0x30343a, roughness: 0.35, metalness: 0.6 });
    mats.glass = new T3.MeshPhysicalMaterial({ color: 0x0d1424, roughness: 0.03, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [180, 520], transparent: true, opacity: 0.62, envMapIntensity: 1.8 });
    // surface grain: leatherette on the grip, fine moulding texture on the shell, brushed lines on metal
    const r1 = rnd(7); mats.rubber.bumpMap = noiseTex(256, (x, n) => { for (let i = 0; i < 5200; i++) { const g = 60 + r1() * 150 | 0; x.fillStyle = `rgb(${g},${g},${g})`; x.beginPath(); x.ellipse(r1() * n, r1() * n, 1.2 + r1() * 2.6, 1 + r1() * 2, r1() * 3, 0, 7); x.fill(); } }, 1.6); mats.rubber.bumpScale = 1.6;
    const r2 = rnd(11); mats.shell.bumpMap = noiseTex(256, (x, n) => { const d = x.getImageData(0, 0, n, n); for (let i = 0; i < d.data.length; i += 4) { const g = 110 + r2() * 40 | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = g; } x.putImageData(d, 0, 0); }, 3); mats.shell.bumpScale = 0.5;
    const r3 = rnd(23); mats.metal.roughnessMap = noiseTex(256, (x, n) => { for (let i = 0; i < 900; i++) { const g = 90 + r3() * 120 | 0; x.fillStyle = `rgb(${g},${g},${g})`; x.fillRect(0, r3() * n, n, 1); } }, 1); mats.metal.roughness = 0.55; M('sensor', { color: 0x3b6e8f, roughness: 0.12, metalness: 0.85 });
    M('screen', { color: 0x050607, roughness: 0.15 }); M('batt', { color: 0x3a3d42, roughness: 0.6 }); M('card', { color: 0x2456a6, roughness: 0.5 });
    M('curtain', { color: 0x2a2c30, roughness: 0.5, metalness: 0.4 }); M('port', { color: 0x70757c, roughness: 0.4, metalness: 0.8 }); M('lamp', { color: 0xffe2a0, roughness: 0.3, emissive: 0x332200 });
    M('flashglass', { color: 0xf4f6f8, roughness: 0.2, emissive: 0x000000 });
  }
  function rbox(w, h, d, r, hole) {
    const s = new T3.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01);
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    if (hole) { const hp = new T3.Path(); hp.absarc(hole[0], hole[1], hole[2], 0, Math.PI * 2, true); s.holes.push(hp); }
    const b = Math.min(0.12, d / 4); const g = new T3.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 3, curveSegments: hole ? 24 : 8 }); g.translate(0, 0, -(d - 2 * b) / 2); return g;
  }
  const box = (w, h, d) => new T3.BoxGeometry(w, h, d);
  const cyl = (r, h, seg, r2) => new T3.CylinderGeometry(r2 == null ? r : r2, r, h, seg || 32);
  function mesh(geo, mat, pos, part, parent, rot) {
    const m = new T3.Mesh(geo, typeof mat === 'string' ? mats[mat] : mat); if (pos) m.position.set(pos[0], pos[1], pos[2]); if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    if (part) m.userData.part = part; parent.add(m); return m;
  }
  function group(parent, pos, ex, name) { const g = new T3.Group(); if (pos) g.position.set(pos[0], pos[1], pos[2]); g.userData.base = g.position.clone(); g.userData.ex = new T3.Vector3(...(ex || [0, 0, 0])); g.name = name || ''; parent.add(g); return g; }
  function label(text, w, h, fg, bg, font) { // small canvas texture for printed labels
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); } x.fillStyle = fg || '#fff'; x.font = font || `600 ${h * 0.6}px Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 1);
    const t = new T3.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function decal(text, w, h, pos, rot, parent, part, fg) { const m = new T3.Mesh(new T3.PlaneGeometry(w, h), new T3.MeshBasicMaterial({ map: label(text, Math.round(w * 180), Math.round(h * 180), fg || '#d8dce0'), transparent: true, depthWrite: false })); m.position.set(...pos); if (rot) m.rotation.set(...rot); if (part) m.userData.part = part; parent.add(m); return m; }

  const MX = 0.9, MY = -0.1, MZ = 1.72;       // mount centre on the front face
  K.MOUNT = [MX, MY, MZ];
  K.MODES = ['A+', 'HYB', 'SCN', 'FX', 'MOV', 'M', 'Av', 'Tv', 'P']; // physical ring order (Canon Part Names, mode dial diagram)
  K.DIAL = { 'A+': ['Scene Intelligent Auto', true], HYB: ['Hybrid Auto: records a short clip before each photo and joins them into a digest movie', false], SCN: ['Special scene modes', true], FX: ['Creative filters: grainy B/W, soft focus, fish-eye, toy camera, miniature', false], P: ['Program AE', true], Tv: ['Shutter-priority AE', true], Av: ['Aperture-priority AE', true], M: ['Manual exposure', true], MOV: ['Movie recording', false] };

  /* ---------------- camera body ---------------- */
  K.buildBody = function (THREE, lcdTexture) {
    T3 = THREE; matsInit();
    const root = new T3.Group(), A = { units: [], anim: {} };
    const X = Math.PI / 2;

    // front shell with grip
    const front = group(root, [0, 0, 0], [0, 0, 3.2], 'front'); A.units.push(front);
    mesh(rbox(11, 6.4, 1.3, 0.7, [MX, MY, 2.5]), 'shell', [0, 0, 1.05], 'body', front);
    const mid = group(root, [0, 0, 0], [0, 0, 0], 'chassis'); A.units.push(mid);
    [[0, 3.0, 10.9, 0.35], [0, -3.0, 10.9, 0.35], [5.28, 0, 0.35, 6.3], [-5.28, 0, 0.35, 6.3]].forEach((b) => mesh(box(b[2], b[3], 0.95), 'shell', [b[0], b[1], 0], 'body', mid));
    mesh(rbox(2.5, 6.0, 2.3, 1.0), 'rubber', [-4.2, -0.15, 2.25], 'grip', front);
    mesh(new T3.SphereGeometry(0.26, 16, 12), 'lamp', [-2.3, 2.25, 1.62], 'lamp', front);
    mesh(cyl(0.42, 0.34, 24), 'btn', [4.35, -1.0, 1.72], 'release', front, [X, 0, 0]);
    mesh(rbox(3.6, 1.0, 1.2, 0.3), 'shell', [MX, 3.35, 1.05], 'body', front);
    decal('EOS R100', 1.9, 0.38, [-2.9, 2.75, 1.705 + 0.01], null, front, 'body', '#cfd3d7');
    [-5.62, 5.62].forEach((x) => mesh(new T3.TorusGeometry(0.28, 0.07, 8, 16), 'metal', [x, 2.6, 0.3], 'strap', front, [0, X, 0]));

    // lens mount
    const mount = group(root, [MX, MY, MZ], [0, 0, 5.4], 'mount'); A.units.push(mount);
    mesh(new T3.RingGeometry(2.45, 3.0, 64), 'metal', [0, 0, 0.18], 'mount', mount);
    mesh(new T3.CylinderGeometry(3.0, 3.0, 0.36, 64, 1, true), 'metal', [0, 0, 0], 'mount', mount, [X, 0, 0]);
    mesh(new T3.CylinderGeometry(2.45, 2.3, 1.1, 48, 1, true), new T3.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.9, side: T3.BackSide }), [0, 0, -0.4], 'mount', mount, [X, 0, 0]);
    for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + (i - 5.5) * 0.085; mesh(box(0.13, 0.22, 0.06), 'gold', [Math.cos(a) * 2.2, Math.sin(a) * 2.2, -0.2], 'contacts', mount, [0, 0, a + X]); }
    mesh(new T3.CircleGeometry(0.11, 12), 'white', [2.72 * Math.cos(1.05), 2.72 * Math.sin(1.05), 0.19], 'mount', mount);
    mesh(new T3.CircleGeometry(0.11, 12), 'red', [2.72 * Math.cos(1.57), 2.72 * Math.sin(1.57), 0.19], 'mount', mount);

    // shutter
    const shut = group(root, [MX, MY, 0.92], [0, 0, 2.0], 'shutter'); A.units.push(shut);
    [[0, 1.08, 3.3, 0.38], [0, -1.08, 3.3, 0.38], [-1.46, 0, 0.38, 1.8], [1.46, 0, 0.38, 1.8]].forEach((b) => mesh(box(b[2], b[3], 0.22), 'chip', [b[0], b[1], 0], 'shutter', shut));
    A.curtain1 = mesh(box(2.56, 1.8, 0.04), 'curtain', [0, 1.8, 0.05], 'shutter', shut); A.curtain2 = mesh(box(2.56, 1.8, 0.04), 'curtain', [0, 1.8, -0.05], 'shutter', shut);
    for (let i = 0; i < 3; i++) { mesh(box(2.56, 0.02, 0.05), 'dark', [0, -0.45 + i * 0.45, 0], null, A.curtain1); }

    // sensor
    const sens = group(root, [MX, MY, 0.55], [0, 0, 0.9], 'sensor'); A.units.push(sens);
    mesh(box(3.7, 2.9, 0.12), 'pcb', [0, 0, -0.08], 'sensor', sens);
    mesh(box(2.7, 1.95, 0.1), 'chip', [0, 0, 0], 'sensor', sens);
    A.sensorFace = mesh(box(2.23, 1.49, 0.04), 'sensor', [0, 0, 0.07], 'sensor', sens);

    // main board
    const pcb = group(root, [0, 0, -0.15], [0, 0, -1.4], 'board'); A.units.push(pcb);
    mesh(box(8.2, 5.2, 0.12), 'pcb', [0.4, -0.1, 0], 'processor', pcb);
    mesh(box(1.5, 1.5, 0.14), 'chip', [-1.6, 0.3, -0.12], 'processor', pcb); decal('DIGIC 8', 1.2, 0.3, [-1.6, 0.3, -0.2], [0, Math.PI, 0], pcb, 'processor', '#cfd3d7');
    [[1.2, 1.4, 1, 0.7], [2.6, -1.2, 0.8, 0.8], [-0.2, -1.5, 1.2, 0.5]].forEach((b) => mesh(box(b[2], b[3], 0.1), 'chip', [b[0], b[1], -0.1], 'processor', pcb));

    // rear shell: screen and buttons (face is -z)
    const rear = group(root, [0, 0, 0], [0, 0, -3.8], 'rear'); A.units.push(rear);
    const Zb = -1.705, R = [0, Math.PI, 0];
    mesh(rbox(11, 6.4, 1.3, 0.7), 'shell', [0, 0, -1.05], 'body', rear);
    mesh(rbox(6.9, 4.7, 0.16, 0.25), 'dark', [1.55, -0.45, Zb - 0.02], 'screen', rear);
    A.lcd = mesh(new T3.PlaneGeometry(6.3, 4.2), new T3.MeshBasicMaterial({ map: lcdTexture }), [1.55, -0.45, Zb - 0.105], 'screen', rear, R);
    mesh(rbox(2.5, 6.0, 0.5, 0.5), 'rubber', [-4.3, -0.3, -1.6], 'grip', rear);
    const ico = (kind, w, hh, pos, part, col) => { const c = document.createElement('canvas'); c.width = 128; c.height = Math.round(128 * hh / w); const x = c.getContext('2d'), W = c.width, H = c.height; x.strokeStyle = x.fillStyle = col || '#dfe3e7'; x.lineWidth = 7; x.lineJoin = 'round'; x.textAlign = 'center'; x.textBaseline = 'middle';
      if (kind === 'star') { x.font = '700 ' + H * 0.95 + 'px Arial'; x.fillText('✱', W / 2, H / 2 + 4); }
      else if (kind === 'afpt') { x.strokeRect(W * 0.2, H * 0.18, W * 0.6, H * 0.64); for (let i = 0; i < 3; i++) x.fillRect(W * (0.3 + i * 0.16), H * 0.42, W * 0.08, H * 0.16); }
      else if (kind === 'play') { x.strokeRect(W * 0.16, H * 0.14, W * 0.68, H * 0.72); x.beginPath(); x.moveTo(W * 0.42, H * 0.3); x.lineTo(W * 0.66, H * 0.5); x.lineTo(W * 0.42, H * 0.7); x.closePath(); x.fill(); }
      else if (kind === 'flash') { x.beginPath(); x.moveTo(W * 0.58, H * 0.06); x.lineTo(W * 0.3, H * 0.56); x.lineTo(W * 0.48, H * 0.56); x.lineTo(W * 0.4, H * 0.94); x.lineTo(W * 0.72, H * 0.4); x.lineTo(W * 0.53, H * 0.4); x.closePath(); x.fill(); }
      else if (kind === 'ec') { x.strokeRect(W * 0.04, H * 0.12, W * 0.44, H * 0.76); x.beginPath(); x.moveTo(W * 0.04, H * 0.88); x.lineTo(W * 0.48, H * 0.12); x.stroke(); x.font = '700 ' + H * 0.4 + 'px Arial'; x.fillText('+', W * 0.17, H * 0.36); x.fillText('−', W * 0.36, H * 0.68); x.fillStyle = '#5aa7ff'; x.fillRect(W * 0.62, H * 0.34, W * 0.28, H * 0.54); x.fillRect(W * 0.58, H * 0.2, W * 0.36, H * 0.1); }
      else if (kind === 'drive') { x.lineWidth = 6; x.strokeRect(W * 0.04, H * 0.3, W * 0.34, H * 0.5); x.strokeRect(W * 0.12, H * 0.16, W * 0.34, H * 0.5); x.beginPath(); x.arc(W * 0.74, H * 0.5, H * 0.3, 0, 7); x.stroke(); x.beginPath(); x.moveTo(W * 0.74, H * 0.5); x.lineTo(W * 0.74, H * 0.28); x.moveTo(W * 0.74, H * 0.5); x.lineTo(W * 0.84, H * 0.56); x.stroke(); }
      else { x.font = '700 ' + H * 0.74 + 'px Arial'; x.fillText(kind, W / 2, H / 2 + 3); }
      const t = new T3.CanvasTexture(c); t.anisotropy = 8; const m = new T3.Mesh(new T3.PlaneGeometry(w, hh), new T3.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); m.position.set(pos[0], pos[1], Zb - 0.012); m.rotation.set(0, Math.PI, 0); if (part) m.userData.part = part; rear.add(m); return m; };
    const rb = (id, x, y, r) => { const b = mesh(cyl(r, 0.2, 28), 'btn', [x, y, Zb - 0.12], id, rear, [X, 0, 0]); mesh(new T3.TorusGeometry(r + 0.03, 0.025, 8, 28), 'dark', [x, y, Zb - 0.02], null, rear); A[id] = b; return b; };
    // top-right shoulder: AE lock and AF point; INFO above the pad; Playback and MENU below it
    rb('aelock', -3.75, 2.55, 0.29); ico('star', 0.34, 0.34, [-3.75, 3.03], 'aelock', '#5aa7ff'); rb('afpoint', -4.75, 2.55, 0.29); ico('afpt', 0.42, 0.32, [-4.75, 3.03], 'afpoint', '#5aa7ff');
    rb('infobtn', -3.1, 1.2, 0.27); ico('INFO', 0.62, 0.2, [-3.1, 1.66], 'infobtn');
    const cx = -4.0, cy = -0.55;
    mesh(cyl(1.08, 0.1, 48), 'btn', [cx, cy, Zb - 0.06], null, rear, [X, 0, 0]); mesh(new T3.TorusGeometry(1.1, 0.03, 8, 48), 'dark', [cx, cy, Zb - 0.02], null, rear);
    [['crossup', 0, 0.7], ['crossdown', 0, -0.7], ['crossleft', 0.7, 0], ['crossright', -0.7, 0]].forEach((k) => { A[k[0]] = mesh(k[1] ? box(0.5, 0.74, 0.1) : box(0.74, 0.5, 0.1), 'btn', [cx + k[1], cy + k[2], Zb - 0.11], k[0], rear); });
    ico('ec', 0.62, 0.3, [cx, cy + 1.36], 'crossup'); ico('drive', 0.62, 0.3, [cx, cy - 1.36], 'crossdown'); ico('ISO', 0.46, 0.2, [cx + 1.42, cy], 'crossleft'); ico('flash', 0.26, 0.36, [cx - 1.3, cy], 'crossright');
    A.setbtn = mesh(cyl(0.4, 0.22, 28), 'btn', [cx, cy, Zb - 0.14], 'setbtn', rear, [X, 0, 0]); { const m = ico('Q', 0.3, 0.3, [cx, cy + 0.1], 'setbtn'); m.position.z = Zb - 0.255; const m2 = ico('SET', 0.42, 0.16, [cx, cy - 0.16], 'setbtn'); m2.position.z = Zb - 0.255; }
    rb('playbtn', -3.3, -2.5, 0.27); ico('play', 0.36, 0.3, [-2.72, -2.5], 'playbtn', '#5aa7ff'); rb('menubtn', -4.7, -2.5, 0.27); ico('MENU', 0.6, 0.19, [-4.7, -2.05], 'menubtn');
    mesh(cyl(0.06, 0.04, 10), 'red', [-2.55, -2.05, Zb - 0.01], 'accesslamp', rear, [X, 0, 0]);
    mesh(box(0.5, 0.04, 0.5), 'btn', [-1.2, 2.72, Zb + 0.05], 'speaker', rear);

    // top cover: dials, buttons, hot shoe
    const top = group(root, [0, 0, 0], [0, 2.4, 0], 'top'); A.units.push(top);
    mesh(rbox(11, 3.4, 0.5, 0.25), 'shell', [0, 3.05, 0], 'body', top, [X, 0, 0]);
    A.dial = mesh(cyl(1.0, 0.55, 40), 'btn', [-2.55, 3.55, -0.35], 'modedial', top);
    const dc = document.createElement('canvas'); dc.width = dc.height = 256; const dx = dc.getContext('2d'); dx.fillStyle = '#2b2e32'; dx.beginPath(); dx.arc(128, 128, 128, 0, 7); dx.fill();
    K.MODES.forEach((m, i) => { const a = (i / K.MODES.length) * Math.PI * 2; dx.save(); dx.translate(128 + Math.sin(a) * 88, 128 - Math.cos(a) * 88); dx.rotate(a); dx.textAlign = 'center'; dx.textBaseline = 'middle'; dx.fillStyle = '#e8ebee'; dx.strokeStyle = '#e8ebee'; dx.lineWidth = 3;
      if (m === 'A+') { dx.fillStyle = '#58c783'; dx.fillRect(-21, -15, 42, 30); dx.fillStyle = '#12161a'; dx.font = '700 22px Arial'; dx.fillText('A', -5, 1); dx.font = '700 15px Arial'; dx.fillText('+', 10, -5); }
      else if (m === 'HYB') { dx.strokeRect(-20, -13, 26, 26); dx.font = '700 17px Arial'; dx.fillText('A', -7, 1); dx.beginPath(); dx.moveTo(10, -8); dx.lineTo(22, 0); dx.lineTo(10, 8); dx.closePath(); dx.fill(); }
      else if (m === 'FX') { dx.beginPath(); dx.arc(-7, 0, 11, 0, 7); dx.stroke(); dx.beginPath(); dx.arc(7, 0, 11, 0, 7); dx.stroke(); }
      else if (m === 'MOV') { dx.fillRect(-18, -9, 24, 18); dx.beginPath(); dx.moveTo(8, -3); dx.lineTo(19, -10); dx.lineTo(19, 10); dx.lineTo(8, 3); dx.closePath(); dx.fill(); }
      else { dx.font = '700 ' + (m === 'SCN' ? 24 : 30) + 'px Arial'; dx.fillText(m, 0, 1); }
      dx.restore(); });
    const dt = new T3.CanvasTexture(dc); mesh(new T3.CircleGeometry(0.96, 40), new T3.MeshBasicMaterial({ map: dt }), [0, 0.28, 0], 'modedial', A.dial, [-X, 0, 0]);
    for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; mesh(box(0.06, 0.5, 0.06), 'dark', [Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0], null, A.dial); }
    mesh(box(0.08, 0.04, 0.3), 'white', [-2.55, 3.31, 0.85], 'modedial', top);
    A.power = mesh(box(0.9, 0.22, 0.34), 'btn', [-0.95, 3.4, -0.75], 'power', top); mesh(box(0.2, 0.3, 0.3), 'white', [0.3, 0.05, 0], 'power', A.power); decal('ON  OFF', 0.9, 0.2, [-0.95, 3.305, -0.4], [-X, 0, 0], top, 'power');
    const gt = group(top, [-4.25, 3.3, 2.3], null);
    A.shutterBtn = mesh(cyl(0.48, 0.3, 28), 'metal', [0, 0.18, 0.35], 'shutterbtn', gt);
    A.mainDial = mesh(cyl(0.62, 0.36, 30), 'btn', [0, 0.02, -0.75], 'maindial', gt, [0, 0, X]);
    for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; mesh(box(0.05, 0.36, 0.05), 'dark', [Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62], null, A.mainDial); }
    mesh(cyl(0.2, 0.12, 20), 'red', [-3.6, 3.36, 0.75], 'moviebtn', top);
    decal('⦵', 0.34, 0.34, [3.9, 3.31, -0.6], [-X, 0, 0], top, 'focalplane');

    // viewfinder hump with flash
    const hump = group(root, [MX, 0, 0], [0, 4.4, -0.6], 'evf'); A.units.push(hump);
    mesh(rbox(3.6, 1.9, 2.9, 0.4), 'shell', [0, 4.2, -0.35], 'evf', hump);
    mesh(rbox(2.5, 1.9, 0.9, 0.45), 'rubber', [0, 3.75, -2.05], 'evf', hump);
    mesh(box(1.5, 1.0, 0.1), 'glass', [0, 3.8, -2.52], 'evf', hump);
    mesh(box(0.5, 0.12, 0.05), 'dark', [0, 4.42, -2.48], 'eyesensor', hump);
    mesh(box(0.14, 0.4, 0.3), 'btn', [1.33, 3.9, -1.9], 'diopter', hump);
    mesh(box(1.9, 0.14, 1.7), 'metal', [0, 5.2, -0.95], 'hotshoe', hump); mesh(box(1.5, 0.1, 1.5), 'dark', [0, 5.28, -0.95], 'hotshoe', hump);
    mesh(box(0.9, 0.7, 0.5), 'chip', [0, 3.9, -1.0], 'evf', hump);
    A.flash = group(hump, [0, 5.05, 0.05], null); // hinge at the back edge
    mesh(rbox(3.3, 0.55, 1.5, 0.2), 'shell', [0, -0.05, 0.75], 'flash', A.flash);
    A.flashGlass = mesh(box(2.2, 0.42, 0.08), mats.flashglass.clone(), [0, -0.1, 1.5], 'flash', A.flash);

    // bottom: battery door, battery, card, tripod socket
    const bottom = group(root, [0, 0, 0], [0, -2.2, 0], 'bottom'); A.units.push(bottom);
    mesh(cyl(0.5, 0.12, 24), 'metal', [MX, -3.22, 0.2], 'tripod', bottom); mesh(cyl(0.3, 0.14, 20), 'dark', [MX, -3.23, 0.2], 'tripod', bottom);
    A.door = group(bottom, [-3.0, -3.22, 1.2], null); // hinge on the inner edge
    mesh(box(2.6, 0.12, 3.0), 'shell', [-1.3, 0, 0], 'door', A.door); mesh(box(0.5, 0.06, 0.25), 'btn', [-2.2, -0.08, 1.1], 'door', A.door);
    A.battery = group(root, [-4.35, -0.5, 1.75], [0, -5.4, 0], 'battery'); A.units.push(A.battery);
    mesh(rbox(1.5, 4.6, 3.3, 0.2), 'batt', [0, 0, 0], 'battery', A.battery, [0, X, 0]); decal('LP-E17', 1.2, 0.3, [0, -2.31, 0], [X, 0, 0], A.battery, 'battery');
    mesh(box(0.8, 0.05, 0.25), 'gold', [0, 2.31, -1.0], 'battery', A.battery);
    A.card = group(root, [-4.35, -1.4, 0.15], [-0.6, -5.0, -1.2], 'card'); A.units.push(A.card);
    mesh(box(0.22, 3.2, 2.4), 'card', [0, 0, 0], 'card', A.card); decal('SD', 0.9, 0.5, [0.115, 0.6, 0], [0, X, 0], A.card, 'card');

    // side terminal covers
    const sideL = group(root, [-5.5, 0, 0], [-2.6, 0, 0], 'terminals'); sideL.scale.x = -1; A.units.push(sideL);
    mesh(box(0.1, 0.5, 0.9), 'port', [-0.1, 0.9, 0.2], 'terminals', sideL); mesh(box(0.1, 0.35, 0.7), 'port', [-0.1, 0.1, 0.2], 'terminals', sideL);
    A.cover = group(sideL, [0.02, 1.5, -0.45], null); mesh(rbox(1.5, 2.2, 0.12, 0.2), 'rubber', [0, -1.0, 0.65], 'terminals', A.cover, [0, X, 0]);
    const sideR = group(root, [5.5, 0, 0], [2.6, 0, 0], 'terminals2'); sideR.scale.x = -1; A.units.push(sideR);
    mesh(cyl(0.2, 0.1, 16), 'port', [0.08, 1.9, -0.5], 'terminals2', sideR, [0, 0, X]); mesh(cyl(0.15, 0.1, 16), 'port', [0.08, 1.3, -0.5], 'terminals2', sideR, [0, 0, X]);
    A.cover2 = group(sideR, [-0.02, 2.4, -1.0], null); mesh(rbox(1.0, 1.6, 0.1, 0.2), 'rubber', [0, -0.8, 0.5], 'terminals2', A.cover2, [0, X, 0]);

    A.shellMats = [mats.shell, mats.rubber];
    return { root, A };
  };

  /* ---------------- lenses ---------------- */
  // size (mm): [diameter, length]; ext = how far the barrel extends at the long end (mm); park = retracted length saved when parked
  K.lensDims = (l) => l.dims || [69, 60];
  K.buildLens = function (THREE, l) {
    T3 = THREE; if (!mats.shell) matsInit();
    const [dia, len] = K.lensDims(l), r = dia / 20, L = len / 10, X = Math.PI / 2, isZoom = l.fmin !== l.fmax;
    const g = new T3.Group(); g.userData.lens = l.id;
    const A = { r, L, ext: (l.ext || 0) / 10, parts: [] };
    const seg = (z0, z1, rad, mat, part, par) => mesh(new T3.CylinderGeometry(rad, rad, z1 - z0, 48), mat, [0, 0, (z0 + z1) / 2], part, par || g, [X, 0, 0]);
    const ribbed = (z0, z1, rad, part, par) => { const m = seg(z0, z1, rad, 'rubber', part, par); const n = Math.round(rad * 22); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; mesh(box(0.07, z1 - z0 - 0.08, 0.07), 'dark', [Math.cos(a) * rad, 0, Math.sin(a) * rad], null, m); } return m; };
    // mount end
    seg(-0.22, 0.02, 2.42, 'metal', 'lensmount'); seg(0.02, 0.32, r * 0.86, 'metal', 'lensmount');
    mesh(new T3.CircleGeometry(0.1, 12), l.name.indexOf('RF-S') === 0 ? 'white' : 'red', [Math.cos(1.2) * r * 0.97, Math.sin(1.2) * r * 0.97, 0.9], null, g, [0, 0, 0]);
    const zr0 = 0.32, zEnd = L;
    seg(zr0, L * 0.34, r, 'shell', 'lens');
    A.zoomRing = isZoom ? ribbed(L * 0.34, L * 0.72, r * 1.02, 'zoomring') : seg(L * 0.34, L * 0.62, r, 'shell', 'lens');
    const SC = { kit: [18, 24, 35, 45], tele: [55, 70, 100, 135, 210], wide: [10, 12, 14, 18], travel: [18, 24, 35, 50, 85, 150], super: [100, 135, 200, 300, 400] }[l.id];
    if (isZoom && SC) {
      const c = document.createElement('canvas'); c.width = 2048; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#16181b'; x.fillRect(0, 0, 2048, 64); x.fillStyle = '#f2f4f6'; x.font = '700 40px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
      SC.forEach((f) => { const k = (f - l.fmin) / (l.fmax - l.fmin), u = (Math.PI - k * 1.3) / (2 * Math.PI); x.fillText(String(f), u * 2048, 30); x.fillRect(u * 2048 - 2, 54, 4, 10); });
      const t = new T3.CanvasTexture(c); t.colorSpace = T3.SRGBColorSpace; t.anisotropy = 8;
      const band = new T3.Mesh(new T3.CylinderGeometry(r * 1.02 + 0.05, r * 1.02 + 0.05, 0.36, 64, 1, true), new T3.MeshStandardMaterial({ map: t, roughness: 0.6 })); band.position.y = -(L * 0.38) / 2 + 0.2; band.userData.part = 'zoomring'; A.zoomRing.add(band); A.scale = band;
      mesh(box(0.06, 0.02, 0.26), 'white', [0, r + 0.012, L * 0.34 - 0.16], 'zoomring', g);
    }
    A.focusRing = ribbed(isZoom ? L * 0.76 : L * 0.66, isZoom ? L * 0.9 : L * 0.9, r * 0.99, 'focusring');
    seg(isZoom ? L * 0.72 : L * 0.62, isZoom ? L * 0.76 : L * 0.66, r * 0.97, 'shell', 'lens'); seg(L * 0.9, zEnd, r * 0.97, 'shell', 'lens');
    // inner barrel that extends
    A.inner = new T3.Group(); g.add(A.inner);
    const ri = r * 0.84; seg(L * 0.5, zEnd + 0.12, ri, 'shell', 'lens', A.inner);
    { const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d'); x.fillStyle = '#0c0d0e'; x.fillRect(0, 0, 1024, 1024); x.fillStyle = '#e9ecef'; x.font = '600 44px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const txt = ('CANON LENS ' + l.name.replace('mm F', 'mm 1:').replace(/(\d)-(\d)/g, '$1-$2') + '   ⌀' + l.filter + 'mm').toUpperCase(), rad = 1024 * 0.43, step = 0.062; let a0 = -Math.PI / 2 - (txt.length - 1) * step / 2;
      for (const ch of txt) { x.save(); x.translate(512 + Math.cos(a0) * rad, 512 + Math.sin(a0) * rad); x.rotate(a0 + Math.PI / 2); x.fillText(ch, 0, 0); x.restore(); a0 += step; }
      const t = new T3.CanvasTexture(c); t.colorSpace = T3.SRGBColorSpace; t.anisotropy = 8;
      mesh(new T3.RingGeometry(ri * 0.72, ri, 64), new T3.MeshStandardMaterial({ map: t, roughness: 0.55 }), [0, 0, zEnd + 0.125], 'frontelement', A.inner); }
    A.front = mesh(new T3.SphereGeometry(ri * 1.5, 40, 16, 0, Math.PI * 2, 0, Math.asin(0.72 / 1.5)), 'glass', [0, 0, zEnd + 0.1 - ri * 1.5 * Math.cos(Math.asin(0.72 / 1.5))], 'frontelement', A.inner, [X, 0, 0]);
    A.irisZ = L * 0.45; A.irisR = ri * 0.66;
    A.irisBack = mesh(new T3.CircleGeometry(ri * 0.7, 40), new T3.MeshStandardMaterial({ color: 0x8f6a3a, roughness: 0.3, metalness: 0.4, emissive: 0x2a1c08 }), [0, 0, A.irisZ - 0.3], 'iris', g);
    A.iris = mesh(new T3.RingGeometry(0.2, ri * 0.72, 7, 1), new T3.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.5, metalness: 0.5, side: T3.DoubleSide }), [0, 0, A.irisZ], 'iris', g);
    // inner glass elements (seen in x-ray and exploded views)
    A.elements = [];
    const n = Math.max(3, Math.min(7, Math.round(L / 1.4)));
    for (let i = 0; i < n; i++) { const z = 0.5 + (i / (n - 1)) * (L - 0.9), rr = ri * (0.55 + 0.35 * (i / (n - 1))); const e = mesh(new T3.CylinderGeometry(rr, rr, 0.16 + 0.1 * ((i * 7) % 3), 36), 'glass', [0, 0, z], 'elements', g, [X, 0, 0]); e.userData.z0 = z; e.userData.k = i / (n - 1) - 0.5; A.elements.push(e); }
    const lt = label(l.short || l.name, 512, 64, '#e8ebee'); const lb = mesh(new T3.PlaneGeometry(Math.min(L * 0.5, 3.4), 0.36), new T3.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false }), [0, r + 0.015, L * 0.2], 'lens', g, [-X, 0, -X]); lb.userData.label = true;
    A.shell = [];
    g.traverse((o) => { if (o.isMesh && (o.material === mats.shell || o.material === mats.rubber)) A.shell.push(o); });
    A.setZoom = (k) => { A.inner.position.z = A.ext * k; if (A.zoomRing && isZoom) A.zoomRing.rotation.y = k * 1.3; };
    A.setAperture = (N) => { const maxN = l.maxAp[0], rad = Math.max(0.03, A.irisR * Math.min(1, maxN / N)); A.iris.geometry.dispose(); A.iris.geometry = new T3.RingGeometry(rad, A.irisR * 1.09, 7, 1); A.iris.rotation.z = N * 0.2; };
    A.explode = (k) => { A.elements.forEach((e) => { e.position.z = e.userData.z0 + e.userData.k * k * L * 1.6; }); A.inner.position.z = A.ext * (A.zoomK || 0) + k * L * 1.3; A.iris.position.z = A.irisZ + k * -0.2; };
    g.userData.A = A; return g;
  };
})();
