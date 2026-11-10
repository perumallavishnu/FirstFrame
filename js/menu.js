/* menu.js: the rear-screen menu system. Tab and item names follow the EOS R100's menu structure; the drawing is our own.
   Many items are wired to the simulator's real settings (FF.cam.state); the rest remember their value and explain themselves. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const U = FF.ui, P = FF.phys;
  const M = (FF.menu = { screen: 'off', tab: 0, page: 0, row: 0, opt: 0, qrow: 0, msg: '', info: 0, power: false, live: null });
  const S = () => FF.cam.state;
  const saved = U.store.get('menu', {});
  const listeners = [];
  M.on = (fn) => listeners.push(fn);
  const emit = () => { listeners.forEach((f) => f()); };

  /* ---- bindings to the simulator: reads come from FF.cam.state, writes go through FF.act like every other input ---- */
  const D = (type, payload) => FF.act.dispatch(type, payload, 'menu');
  const pick = (key, vals, type, field) => ({ get: () => Math.max(0, vals.indexOf(S()[key])), set: (i) => D(type, { [field]: vals[i] }) });
  const ISO_VALS = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
  const B = {
    flash: pick('flash', ['off', 'auto', 'on'], 'flash/set', 'flash'),
    corr: { get: () => (S().corr ? 0 : 1), set: (i) => D('corr/set', { on: i === 0 }) },
    ec: { get: () => S().ec + 9, set: (i) => D('ec/set', { ec: i - 9 }) },
    iso: { get: () => (FF.cam.isoAutoNow() ? 0 : 1 + Math.max(0, ISO_VALS.indexOf(Math.round(P.isoValue(S().isoIdx))))), set: (i) => D('iso/set', { idx: i === 0 ? 'auto' : P.isoIndex(ISO_VALS[i - 1]) }) },
    isoMax: { get: () => Math.max(0, [400, 800, 1600, 3200, 6400, 12800].indexOf(Math.round(P.isoValue(S().isoMaxIdx)))), set: (i) => D('iso/max', { idx: P.isoIndex([400, 800, 1600, 3200, 6400, 12800][i]) }) },
    meter: pick('meter', ['evaluative', 'partial', 'spot', 'center'], 'meter/set', 'meter'),
    wb: { get: () => Math.max(0, FF.WB.findIndex((w) => w.id === S().wb)), set: (i) => D('wb/set', { wb: FF.WB[i].id }) },
    style: { get: () => Math.max(0, FF.STYLES.findIndex((w) => w.id === S().style)), set: (i) => D('style/set', { style: FF.STYLES[i].id }) },
    nr: pick('nr', ['off', 'std', 'high'], 'nr/set', 'nr'),
    drive: pick('drive', ['single', 'cont', 't10', 't2'], 'drive/set', 'drive'),
    afop: { get: () => (S().afMode === 'servo' ? 1 : 0), set: (i) => (S().afMode !== 'mf' ? D('af/mode', { mode: i ? 'servo' : 'oneshot' }) : { ok: false, reason: 'Switch the lens to AF first.' }) },
    afmethod: { get: () => (S().afArea === 'whole' ? 0 : 1), set: (i) => D('af/area', { area: i === 0 ? 'whole' : '1pt', face: i === 0 }) },
    focusmode: { get: () => (S().afMode === 'mf' ? 1 : 0), set: (i) => D('af/mode', { mode: i ? 'mf' : 'oneshot' }) },
    is: { get: () => (S().is ? 0 : 1), set: (i) => D('is/set', { on: i === 0 }) },
    grid: { get: () => (FF.sim && FF.sim.grid ? 1 : 0), set: (i) => { if (FF.sim) FF.sim.grid = i > 0; return { ok: true }; } }
  };
  // any camera change, from any input, redraws the rear screen
  if (FF.act) FF.act.on(() => emit());
  const ecOpts = []; for (let i = -9; i <= 9; i++) ecOpts.push(U.fmt.ec(i) === '0' ? '±0' : U.fmt.ec(i));

  /* ---- menu data: [label, options|null(action), default index, help, binding] ---- */
  const T = (M.tabs = [
    { id: 'shoot', name: 'Shooting', glyph: '◉', col: '#e5484d', pages: [
      [['Image quality', ['L (JPEG, large)', 'RAW + L', 'RAW', 'M (JPEG, medium)', 'S (JPEG, small)'], 0, 'RAW keeps all sensor data for editing. JPEG is finished and small. RAW + L gives you both.'],
        ['Still img aspect ratio', ['3:2', '4:3', '16:9', '1:1'], 0, 'The shape of the picture. 3:2 uses the whole sensor.'],
        ['Image review', ['Off', '2 sec.', '4 sec.', '8 sec.', 'Hold'], 1, 'How long the photo is shown right after you take it.'],
        ['Release shutter without card', ['Enable', 'Disable'], 0, 'Set to Disable so you can never shoot a whole day with no card inside.'],
        ['Lens aberration correction', ['Enable', 'Disable'], 0, 'Fixes dark corners, distortion and colour fringes that the lens causes.', 'corr'],
        ['Flash firing', ['Off', 'Auto', 'On (fill)'], 0, 'Whether the built-in flash fires. Raise the flash by hand first.', 'flash']],
      [['Expo. comp.', ecOpts, 9, 'Makes the camera expose brighter (+) or darker (−) than its meter suggests. Works in P, Tv and Av.', 'ec'],
        ['ISO speed settings: Max for Auto', ['400', '800', '1600', '3200', '6400', '12800'], 4, 'The highest ISO that Auto ISO may use. Lower means cleaner pictures but slower shutter speeds.', 'isoMax'],
        ['Auto Lighting Optimizer', ['Off', 'Low', 'Standard', 'High'], 2, 'Lifts dark areas in JPEGs when contrast is high.'],
        ['Highlight tone priority', ['Off', 'On'], 0, 'Protects bright areas such as white dresses and clouds. Minimum ISO becomes 200.'],
        ['Metering mode', ['Evaluative', 'Partial', 'Spot', 'Centre-weighted average'], 0, 'How the camera measures brightness. Spot reads only a small circle, useful for backlit faces.', 'meter'],
        ['Metering timer', ['4 sec.', '8 sec.', '16 sec.', '30 sec.'], 1, 'How long the exposure reading stays active after you half-press.'],
        ['ISO speed', ['AUTO', '100', '200', '400', '800', '1600', '3200', '6400', '12800'], 0, 'How sensitive the sensor is. AUTO lets the camera choose; low numbers give the cleanest pictures. On the camera, the left cross key opens this while shooting.', 'iso']],
      [['White balance', FF.WB.map((w) => w.label), 0, 'Corrects the colour of the light so that whites look white.', 'wb'],
        ['Custom White Balance', null, 0, 'Photograph a white or grey card under your light and the camera uses it as the reference for white.'],
        ['WB Shift/Bkt.', ['0,0', 'A2', 'B2', 'G2', 'M2'], 0, 'Fine-tunes white balance towards amber, blue, green or magenta.'],
        ['Color space', ['sRGB', 'Adobe RGB'], 0, 'Leave on sRGB unless you have a colour-managed print workflow.'],
        ['Picture Style', FF.STYLES.map((w) => w.label), 1, 'The look of JPEGs: contrast, colour and sharpness.', 'style']],
      [['Long exp. noise reduction', ['Off', 'Auto', 'On'], 0, 'After exposures of 1 s or longer, takes a second dark frame to subtract hot pixels. Doubles the wait.'],
        ['High ISO speed NR', ['Off', 'Standard', 'High'], 1, 'Smooths noise in JPEGs at high ISO. Stronger settings also blur fine detail.', 'nr'],
        ['Dust Delete Data', null, 0, 'Records where dust sits on the sensor so software can remove the spots later.'],
        ['Drive mode', ['Single shooting', 'Continuous shooting', 'Self-timer: 10 sec.', 'Self-timer: 2 sec.'], 0, 'One photo per press, a burst while you hold the button, or a delayed shot.', 'drive'],
        ['Interval timer', ['Disable', 'Enable'], 0, 'Takes a photo every few seconds or minutes for time-lapse sequences.']],
      [['AF operation', ['One-Shot AF', 'Servo AF'], 0, 'One-Shot locks focus once for still subjects. Servo keeps refocusing on moving subjects.', 'afop'],
        ['AF method', ['Face + Tracking', '1-point AF', 'Spot AF', 'Zone AF'], 0, 'Where the camera looks for a subject. Face + Tracking finds people; 1-point lets you choose the spot.', 'afmethod'],
        ['Eye Detection AF', ['Enable', 'Disable'], 0, 'Focuses on the nearest eye of a detected face.'],
        ['Continuous AF', ['Enable', 'Disable'], 0, 'Keeps the lens roughly focused before you half-press, so focusing is quicker. Uses more battery.'],
        ['Focus mode', ['AF', 'MF'], 0, 'Autofocus or manual focus. The kit lens has no AF/MF switch, so you choose here.', 'focusmode'],
        ['AF-assist beam firing', ['Enable', 'Disable'], 0, 'The lamp on the front lights up dim subjects so autofocus can lock.']],
      [['MF peaking settings', ['Off', 'On: Red', 'On: Yellow', 'On: Blue'], 0, 'In manual focus, outlines the sharp edges in colour.'],
        ['IS (Image Stabilizer) mode', ['On', 'Off'], 0, 'Lens stabilisation. Turn it off on a tripod.', 'is'],
        ['Lens electronic MF', ['Disable after One-Shot', 'One-Shot → enabled'], 0, 'Lets you turn the focus ring to fine-tune after autofocus.'],
        ['Shooting creative filters', ['Off', 'Grainy B/W', 'Soft focus', 'Fish-eye effect', 'Toy camera effect', 'Miniature effect'], 0, 'Applies an effect as you shoot. JPEG only.']],
      [['Grid display', ['Off', '3x3', '6x4', '3x3 + diag'], 0, 'Lines over the picture that help you level the horizon and compose by thirds.', 'grid'],
        ['Histogram disp', ['Brightness', 'RGB'], 0, 'The histogram shows how many pixels are dark, mid or bright.'],
        ['VF display format', ['Display 1', 'Display 2'], 0, 'How the viewfinder lays out the picture and the numbers.'],
        ['Disp. performance', ['Power saving', 'Smooth'], 0, 'Smooth refreshes the screen faster and uses more battery.'],
        ['Expo. simulation', ['Enable', 'Disable'], 0, 'The screen shows how bright the photo will be. Leave it on while you learn.']]] },
    { id: 'play', name: 'Playback', glyph: '▶', col: '#4c8dff', pages: [
      [['Protect images', null, 0, 'Locks chosen photos so they cannot be erased by mistake. Formatting still deletes them.'],
        ['Rotate stills', null, 0, 'Turns a photo by 90°.'], ['Erase images', null, 0, 'Deletes chosen photos, a folder, or everything on the card.'],
        ['Print order', null, 0, 'Marks photos for printing on a compatible printer.'], ['Photobook Set-up', null, 0, 'Marks photos to gather into a photo book.']],
      [['RAW image processing', null, 0, 'Develops a RAW file into a JPEG in the camera, with a new white balance, brightness or Picture Style.'],
        ['Creative filters', null, 0, 'Applies an effect to a finished photo and saves a copy.'], ['Resize', null, 0, 'Saves a smaller copy for sharing.'],
        ['Cropping', null, 0, 'Saves a trimmed copy.'], ['Rating', null, 0, 'Gives photos one to five stars so you can find the best ones later.']],
      [['Slide show', null, 0, 'Plays the photos one after another.'], ['Set image search conditions', null, 0, 'Shows only photos that match a date, rating or type.'],
        ['Image jump w/ dial', ['1 image', '10 images', 'By date', 'By rating'], 1, 'How far the dial jumps during playback.'],
        ['Playback information display', ['Basic', 'Basic + histogram', 'Detailed'], 2, 'Which shooting details appear over the photo.'],
        ['Highlight alert', ['Disable', 'Enable'], 0, 'Blown-out areas blink in playback. Turn it on: it is the fastest check for overexposure.'],
        ['AF point disp.', ['Disable', 'Enable'], 0, 'Shows the focus point that was used.']]] },
    { id: 'wifi', name: 'Wireless', glyph: '⌔', col: '#b07cf5', pages: [
      [['Wi-Fi/Bluetooth connection', null, 0, 'Connects to a phone running Canon Camera Connect to copy photos or use the phone as a remote.'],
        ['Airplane mode', ['Off', 'On'], 0, 'Turns off all radios. Saves battery when you do not need wireless.'],
        ['Wi-Fi settings', ['Enable', 'Disable'], 0, 'Wi-Fi is the fast link used to copy pictures.'],
        ['Bluetooth settings', ['Enable', 'Disable'], 0, 'Bluetooth keeps a low-power link to your phone.'],
        ['Nickname', null, 0, 'The name the camera shows to other devices.'], ['GPS device settings', ['Disable', 'Smartphone'], 0, 'Adds the phone’s location to each photo.'],
        ['Clear settings', null, 0, 'Resets all wireless settings.']]] },
    { id: 'setup', name: 'Set-up', glyph: '⚙', col: '#e2a400', pages: [
      [['Select folder', null, 0, 'Chooses or creates the folder on the card where photos are stored.'], ['File numbering', ['Continuous', 'Auto reset'], 0, 'Continuous keeps counting across cards so file names never repeat.'],
        ['Format card', null, 0, 'Erases everything and prepares the card. Do this in the camera with every new card.'],
        ['Auto rotate', ['On (camera + computer)', 'On (computer only)', 'Off'], 0, 'Turns vertical photos upright.'],
        ['Date/Time/Zone', null, 0, 'Sets the clock. The time is written into every photo.'], ['Language', ['English', 'Deutsch', 'Français', 'Español', '日本語'], 0, 'Menu language.']],
      [['Video system', ['For NTSC', 'For PAL'], 1, 'Matches frame rates to your region: 30/60 fps (NTSC) or 25/50 fps (PAL).'], ['Beep', ['Enable', 'Disable'], 0, 'The focus-confirmation sound. Disable it in quiet places.'],
        ['Power saving', ['Auto power off: 30 sec.', '1 min.', '3 min.', 'Disable'], 1, 'How long the camera waits before sleeping.'], ['Eco mode', ['Off', 'On'], 0, 'Dims and turns off the screen sooner to stretch the battery.'],
        ['Screen brightness', ['1', '2', '3', '4', '5', '6', '7'], 3, 'Brightness of the rear screen. It does not change the photo.'], ['Viewfinder brightness', ['1', '2', '3', '4', '5'], 2, 'Brightness of the viewfinder.']],
      [['Screen/viewfinder display', ['Auto', 'Screen', 'Viewfinder'], 0, 'Auto switches to the viewfinder when your eye comes close.'], ['HDMI resolution', ['Auto', '1080p'], 0, 'Output size for a TV or monitor.'],
        ['Sensor cleaning', null, 0, 'Shakes dust off the sensor. For stubborn spots use a blower with the lens off and the mount facing down.'],
        ['Reset camera', null, 0, 'Returns settings to how they were when the camera was new.'],
        ['Custom Functions (C.Fn)', null, 0, 'Deeper options, such as exposure steps of 1/3 or 1/2 stop, and what the buttons do.'],
        ['Copyright information', null, 0, 'Writes your name into every photo.'], ['Firmware', null, 0, 'Shows the camera software version and installs updates from the card.']]] },
    { id: 'disp', name: 'Display level', glyph: '▤', col: '#3cc79a', pages: [
      [['Shooting screen', ['Guided', 'Standard'], 1, 'Guided explains each setting with pictures as you change it.'], ['Menu display', ['Guided', 'Standard'], 1, 'Guided shows a description of each tab.'],
        ['Mode guide', ['Enable', 'Disable'], 0, 'Shows a short explanation when you turn the mode dial.'], ['Feature guide', ['Enable', 'Disable'], 0, 'Shows a short explanation of items in the Quick Control screen.']]] },
    { id: 'my', name: 'My Menu', glyph: '★', col: '#ff8a3d', pages: [
      [['Add My Menu tab', null, 0, 'Collect the items you use most on one page, for example Format card, Image quality and Expo. comp.'],
        ['Delete all My Menu tabs', null, 0, 'Removes your custom pages.'], ['Menu display', ['Normal display', 'Display from My Menu tab'], 0, 'Open the menu on your own page first.']]] }
  ]);
  const item = () => T[M.tab].pages[M.page][M.row];
  const keyOf = (t, p, r) => t + '.' + p + '.' + r;
  M.value = function (t, p, r) { const it = T[t].pages[p][r]; if (!it[1]) return null; if (it[4] && B[it[4]] && FF.cam) return B[it[4]].get(); const k = keyOf(t, p, r); return k in saved ? saved[k] : it[2]; };
  function setValue(i) {
    const it = item();
    if (it[4] && B[it[4]]) { const r = B[it[4]].set(i); if (r && !r.ok && r.reason) M.toast = r.reason; } // the dispatcher refreshes every view
    else { saved[keyOf(M.tab, M.page, M.row)] = i; U.store.set('menu', saved); }
  }
  M.current = () => (M.screen === 'menu' || M.screen === 'opt' ? { tab: T[M.tab], item: item(), value: M.value(M.tab, M.page, M.row) } : null);

  /* ---- quick control list (Q button) ---- */
  const Q = [['AF method', 0, 4, 1], ['AF operation', 0, 4, 0], ['Drive mode', 0, 3, 3], ['Metering mode', 0, 1, 4], ['Image quality', 0, 0, 0], ['White balance', 0, 2, 0], ['Picture Style', 0, 2, 4], ['Auto Lighting Optimizer', 0, 1, 2]];

  /* ---- keys ---- */
  M.key = function (k) {
    if (k === 'power') { M.power = !M.power; M.screen = M.power ? 'shoot' : 'off'; return emit(); }
    if (!M.power) { M.msg = ''; return emit(); }
    const sc = M.screen;
    if (sc === 'msg') { M.screen = 'menu'; return emit(); }
    if (k === 'menu') { M.screen = sc === 'menu' || sc === 'opt' ? (sc === 'opt' ? 'menu' : 'shoot') : 'menu'; return emit(); }
    if (k === 'play') { M.screen = sc === 'play' ? 'shoot' : 'play'; return emit(); }
    if (k === 'info') { M.info = (M.info + 1) % 3; return emit(); }
    if (k === 'shutter') { M.screen = 'shoot'; return emit(); }
    if (sc === 'shoot') { if (k === 'set') { M.screen = 'q'; } else if (k === 'left') { goto(0, 1, 6); } else if (k === 'down') { goto(0, 3, 3); } else if (k === 'right') { goto(0, 0, 5); } else if (k === 'up') { goto(0, 1, 0); } return emit(); }
    if (sc === 'q') {
      const q = Q[M.qrow];
      if (k === 'up') M.qrow = (M.qrow + Q.length - 1) % Q.length; if (k === 'down') M.qrow = (M.qrow + 1) % Q.length;
      if (k === 'left' || k === 'right') { M.tab = q[1]; M.page = q[2]; M.row = q[3]; const n = item()[1].length; setValue((M.value(q[1], q[2], q[3]) + (k === 'right' ? 1 : n - 1)) % n); }
      if (k === 'set') M.screen = 'shoot';
      return emit();
    }
    if (sc === 'menu') {
      const pages = T[M.tab].pages, rows = pages[M.page];
      if (k === 'up') M.row = (M.row + rows.length - 1) % rows.length;
      if (k === 'down') M.row = (M.row + 1) % rows.length;
      if (k === 'right') { if (M.page < pages.length - 1) M.page++; else { M.tab = (M.tab + 1) % T.length; M.page = 0; } M.row = 0; }
      if (k === 'left') { if (M.page > 0) M.page--; else { M.tab = (M.tab + T.length - 1) % T.length; M.page = T[M.tab].pages.length - 1; } M.row = 0; }
      if (k === 'set') { const it = item(); if (it[1]) { M.opt = M.value(M.tab, M.page, M.row); M.screen = 'opt'; } else { M.msg = it[0]; M.screen = 'msg'; } }
      return emit();
    }
    if (sc === 'opt') {
      const n = item()[1].length;
      if (k === 'up' || k === 'left') M.opt = (M.opt + n - 1) % n; if (k === 'down' || k === 'right') M.opt = (M.opt + 1) % n;
      if (k === 'set') { setValue(M.opt); M.screen = 'menu'; }
      return emit();
    }
    if (sc === 'play') { if (k === 'left') M.playIdx = Math.max(0, (M.playIdx || 0) - 1); if (k === 'right') M.playIdx = (M.playIdx || 0) + 1; return emit(); }
    emit();
  };
  function goto(t, p, r) { M.tab = t; M.page = p; M.row = r; M.opt = M.value(t, p, r); M.screen = 'opt'; }
  M.goto = (t, p, r) => { M.power = true; M.tab = t; M.page = p; M.row = r; M.screen = 'menu'; emit(); };
  M.setTab = (t) => { M.power = true; M.tab = t; M.page = 0; M.row = 0; M.screen = 'menu'; emit(); };

  /* ---- drawing ---- */
  const FONT = '"Instrument Sans", "Helvetica Neue", Arial, sans-serif', MONO = '"IBM Plex Mono", ui-monospace, monospace';
  const imgCache = {};
  function image(src) { if (!src) return null; if (!imgCache[src]) { const i = new Image(); i.onload = emit; i.src = src; imgCache[src] = i; } const i = imgCache[src]; return i.complete && i.naturalWidth ? i : null; }
  function cover(c, im, W, H) { const r = Math.max(W / im.width, H / im.height), w = im.width * r, h = im.height * r; c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); }
  function clip(c, s, w) { if (c.measureText(s).width <= w) return s; while (s.length > 3 && c.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; }

  M.draw = function (cv) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, u = W / 720;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#050607'; c.fillRect(0, 0, W, H);
    if (!M.power) { c.fillStyle = '#2a2f33'; c.font = `500 ${18 * u}px ${FONT}`; c.textAlign = 'center'; c.fillText('Camera is off. Flip the power switch.', W / 2, H / 2); return; }
    c.save(); c.scale(u, u); const h = H / u;
    if (M.screen === 'shoot' || M.screen === 'q') shootScreen(c, 720, h);
    else if (M.screen === 'play') playScreen(c, 720, h);
    else menuScreen(c, 720, h);
    // messages (mode-dial name, or why a setting can't change now) show on every screen
    if (M.toast) { c.font = `600 17px ${FONT}`; const tw = Math.min(680, c.measureText(M.toast).width + 32); c.fillStyle = 'rgba(0,0,0,.78)'; c.fillRect(360 - tw / 2, 60, tw, 40); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(clip(c, M.toast, tw - 20), 360, 80); M.toast = ''; }
    c.restore();
  };

  function shootScreen(c, W, H) {
    const s = S(), e = FF.cam.eff, sc = FF.cam.scene();
    const im = M.live || image(M.liveSrc);
    if (im) cover(c, im, W, H); else { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#31414f'); g.addColorStop(1, '#141a1f'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    if (M.info === 2) return;
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, W, 44); c.fillRect(0, H - 58, W, 58);
    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillStyle = '#ffb224'; c.fillRect(12, 9, 54, 26); c.fillStyle = '#111'; c.font = `700 18px ${MONO}`; c.textAlign = 'center'; c.fillText(s.mode, 39, 23);
    c.fillStyle = '#fff'; c.font = `500 15px ${MONO}`; c.textAlign = 'left';
    c.fillText((s.afMode === 'mf' ? 'MF' : s.afMode === 'servo' ? 'SERVO' : 'ONE SHOT') + '   ' + (FF.WB.find((w) => w.id === s.wb) || {}).label.split(' ')[0] + '   ' + s.meter.slice(0, 4).toUpperCase() + '   ' + s.drive.toUpperCase(), 80, 23);
    c.textAlign = 'right'; c.fillText('▮▮▮  [ 3128 ]', W - 12, 23);
    c.textAlign = 'left'; c.font = `600 24px ${MONO}`;
    c.fillText(P.fmtShutter(e.t), 16, H - 28); c.fillStyle = '#ffb224'; c.fillText(P.fmtAperture(e.N), 150, H - 28); c.fillStyle = '#fff';
    c.font = `500 15px ${MONO}`; c.fillText('ISO', 520, H - 26); c.font = `600 24px ${MONO}`; c.fillText((s.isoAuto ? 'A ' : '') + Math.round(e.iso), 556, H - 28);
    const x0 = 290, w = 190, y = H - 28; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath();
    for (let i = -3; i <= 3; i++) { const x = x0 + (i + 3) * w / 6; c.moveTo(x, y - 6); c.lineTo(x, y + 6); } c.stroke();
    const px = x0 + (Math.max(-3, Math.min(3, s.ec / 3)) + 3) * w / 6; c.fillStyle = '#ffb224'; c.beginPath(); c.moveTo(px, y - 8); c.lineTo(px - 6, y - 17); c.lineTo(px + 6, y - 17); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(W / 2 - 34, H / 2 - 24, 68, 48);
    if (M.info === 1) { c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(W - 190, 56, 176, 92); c.fillStyle = '#fff'; c.font = `500 13px ${MONO}`; c.fillText(sc.name, W - 180, 74); c.fillText(FF.lensById(s.lens).short, W - 180, 96); c.fillText(Math.round(s.f) + ' mm', W - 180, 118); c.fillText('Style: ' + s.style, W - 180, 138); }
    if (M.screen === 'q') {
      c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(0, 44, W, H - 102); c.textAlign = 'left';
      Q.forEach((q, i) => { const y2 = 62 + i * 44, on = i === M.qrow, it = T[q[1]].pages[q[2]][q[3]];
        if (on) { c.fillStyle = '#ffb224'; c.fillRect(16, y2 - 4, W - 32, 40); }
        c.fillStyle = on ? '#111' : '#fff'; c.font = `600 17px ${FONT}`; c.fillText(q[0], 30, y2 + 16);
        c.textAlign = 'right'; c.font = `500 17px ${FONT}`; c.fillText((on ? '◂ ' : '') + it[1][M.value(q[1], q[2], q[3])] + (on ? ' ▸' : ''), W - 30, y2 + 16); c.textAlign = 'left'; });
    }
  }
  function playScreen(c, W, H) {
    const pf = U.store.get('portfolio', []); c.textAlign = 'center'; c.textBaseline = 'middle';
    if (!pf.length) { c.fillStyle = '#9aa3aa'; c.font = `500 20px ${FONT}`; c.fillText('No images yet. Take a photo in the Simulator.', W / 2, H / 2); return; }
    M.playIdx = Math.min(pf.length - 1, M.playIdx || 0); const p = pf[M.playIdx], im = image(p.thumb); if (im) cover(c, im, W, H);
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(0, H - 46, W, 46); c.fillStyle = '#fff'; c.font = `500 17px ${MONO}`;
    c.fillText(P.fmtShutter(p.tv) + '   ' + P.fmtAperture(p.N) + '   ISO ' + Math.round(p.iso) + '      ' + (M.playIdx + 1) + '/' + pf.length, W / 2, H - 23);
  }
  function menuScreen(c, W, H) {
    const tab = T[M.tab], rows = tab.pages[M.page];
    c.textBaseline = 'middle';
    c.fillStyle = '#16191c'; c.fillRect(0, 0, W, 58);
    T.forEach((t, i) => { const x = 14 + i * 62, on = i === M.tab; c.fillStyle = on ? t.col : '#2a2f34'; rr(c, x, 9, 52, 40, 7); c.fill(); c.fillStyle = on ? '#111' : '#aab1b7'; c.font = `600 22px ${FONT}`; c.textAlign = 'center'; c.fillText(t.glyph, x + 26, 30); });
    c.textAlign = 'right'; c.fillStyle = tab.col; c.font = `700 17px ${FONT}`; c.fillText(tab.name.toUpperCase() + (tab.pages.length > 1 ? '  ' + (M.page + 1) : ''), W - 16, 22);
    for (let i = 0; i < tab.pages.length; i++) { c.fillStyle = i === M.page ? tab.col : '#3a4046'; c.fillRect(W - 16 - (tab.pages.length - i) * 16, 38, 12, 5); }
    c.fillStyle = tab.col; c.fillRect(0, 58, W, 3);
    const rh = Math.min(50, (H - 61 - 62) / Math.max(6, rows.length));
    rows.forEach((it, i) => {
      const y = 66 + i * rh, on = i === M.row;
      if (on) { c.fillStyle = tab.col; rr(c, 10, y, W - 20, rh - 4, 6); c.fill(); }
      c.fillStyle = on ? '#111' : '#eef1f3'; c.textAlign = 'left'; c.font = `600 19px ${FONT}`; c.fillText(clip(c, it[0], 370), 24, y + rh / 2 - 2);
      c.textAlign = 'right'; c.font = `500 18px ${FONT}`; c.fillStyle = on ? '#111' : '#aab1b7';
      c.fillText(it[1] ? clip(c, it[1][M.value(M.tab, M.page, i)], 280) : '▸', W - 24, y + rh / 2 - 2);
    });
    c.fillStyle = '#16191c'; c.fillRect(0, H - 58, W, 58); c.fillStyle = '#c9cfd4'; c.font = `400 14.5px ${FONT}`; c.textAlign = 'left';
    wrap(c, item()[3], 16, H - 40, W - 32, 19, 2);
    if (M.screen === 'opt') {
      const it = item(), n = it[1].length, per = 7, start = Math.max(0, Math.min(n - per, M.opt - 3)), bh = Math.min(n, per) * 44 + 64;
      c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(0, 0, W, H); c.fillStyle = '#1d2125'; rr(c, 90, (H - bh) / 2, W - 180, bh, 12); c.fill(); c.strokeStyle = tab.col; c.lineWidth = 2; c.stroke();
      c.fillStyle = tab.col; c.font = `700 18px ${FONT}`; c.textAlign = 'left'; c.fillText(clip(c, it[0], W - 230), 112, (H - bh) / 2 + 30);
      for (let j = start; j < Math.min(n, start + per); j++) { const y = (H - bh) / 2 + 54 + (j - start) * 44, on = j === M.opt; if (on) { c.fillStyle = tab.col; rr(c, 104, y, W - 208, 38, 6); c.fill(); }
        c.fillStyle = on ? '#111' : '#eef1f3'; c.font = `500 18px ${FONT}`; c.fillText(it[1][j], 122, y + 19); if (j === M.value(M.tab, M.page, M.row)) { c.textAlign = 'right'; c.fillText('●', W - 122, y + 19); c.textAlign = 'left'; } }
    }
    if (M.screen === 'msg') {
      c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(0, 0, W, H); c.fillStyle = '#1d2125'; rr(c, 110, H / 2 - 80, W - 220, 160, 12); c.fill(); c.strokeStyle = tab.col; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = `700 20px ${FONT}`; c.fillText(M.msg, W / 2, H / 2 - 40); c.font = `400 15px ${FONT}`; c.fillStyle = '#c9cfd4';
      c.textAlign = 'left'; wrap(c, 'This opens a sub-screen on the real camera. Nothing is changed here. Press any key to go back.', 134, H / 2 - 6, W - 268, 20, 3);
    }
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function wrap(c, s, x, y, w, lh, max) { const words = s.split(' '); let line = '', n = 0; for (const wd of words) { if (c.measureText(line + wd).width > w && line) { c.fillText(n === max - 1 ? clip(c, line + wd, w) : line, x, y + n * lh); if (++n >= max) return; line = ''; } line += wd + ' '; } c.fillText(line, x, y + n * lh); }
})();
