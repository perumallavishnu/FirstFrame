/* eos_r100_profile.js: the canonical Canon EOS R100 camera profile.
   One registry for every part: Canon's official name, a short UI alias, which face it is on, the GLB mesh and anchor
   names, what clicking it does, the lesson it links to, its printed marking, and where each fact comes from.
   Hotspots, the part list, the tour, the detail panel and the validator all read from here.
   status: 'verified'    = name and position confirmed by Canon's Part Names diagram and product photos
           'approximate' = name verified, position estimated from the diagram because the photos don't show it clearly
           'educational' = internal or illustrative part, not an externally visible Canon-labelled control */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const PN = 'https://cam.start.canon/en/C015/manual/html/UG-00_Before_0110.html';
  const SPEC = 'https://cam.start.canon/en/C015/manual/html/UG-11_Reference_0080.html';
  const PHOTO = 'assets/models/canon-eos-r100/reference/';
  const D = '2026-11-10';

  // [id, Canon name, UI alias|null, view, legacy id|null, interaction|null, lesson|null, marking|null, description, how to use, status, source]
  const ROWS = [
    // ---- top ----
    ['mode-dial', 'Mode dial', null, 'top', 'modedial', 'rotate-dial', '#lesson-modes', 'A+, Hybrid Auto, SCN, Creative filters, Movie, M, Av, Tv, P', 'Chooses the shooting mode: Basic Zone modes where the camera decides everything, the Creative Zone (P, Tv, Av, M) where you share or take control, and movie recording.', 'Turn it one click at a time. Start in Av to learn aperture.', 'verified', PN],
    ['dial', 'Dial', 'Main dial', 'top', 'maindial', null, '#lesson-modes', null, 'A knurled wheel behind the shutter button. It changes the main setting of the current mode: shutter speed in Tv, aperture in Av, shutter speed in M (hold the exposure compensation key to change aperture).', 'Roll it with your index finger without taking your eye from the viewfinder.', 'verified', PN],
    ['shutter-button', 'Shutter button', null, 'top', 'shutterbtn', 'press', '#lesson-focus', null, 'Two stages. Half-press to focus and meter, press fully to take the picture.', 'Squeeze it gently. Jabbing it shakes the camera.', 'verified', PN],
    ['movie-shooting-button', 'Movie shooting button', 'Movie button', 'top', 'moviebtn', null, null, 'red dot', 'Starts and stops movie recording.', 'The R100 records 4K at 23.98p or 25p and Full HD up to 59.94p.', 'verified', PN],
    ['power-switch', 'Power switch', null, 'top', 'power', 'toggle', null, 'ON / OFF', 'Turns the camera on and off. It is a lever beside the mode dial.', 'Push it forward to ON. The screen wakes up and the menu becomes available.', 'verified', PN],
    ['hot-shoe', 'Hot shoe', null, 'top', 'hotshoe', null, null, null, 'A metal mount with electrical contacts for an external flash or other accessory.', 'An external flash bounced off a ceiling gives far softer light than the built-in flash.', 'verified', PN],
    ['built-in-flash', 'Built-in flash', null, 'top', 'flash', 'toggle', '#lesson-metering', null, 'A pop-up flash in the top of the viewfinder housing, guide number about 6 (ISO 100, metres). Good as fill light for faces within a couple of metres.', 'On the R100 you raise it with your fingers. Click it here to raise or lower it.', 'verified', PN],
    ['microphone', 'Microphone (monaural)', 'Microphone', 'top', null, null, null, null, 'The built-in microphone records sound for movies. It is monaural (one channel).', 'For better sound plug an external microphone into the MIC terminal.', 'approximate', PN],
    ['speaker', 'Speaker', null, 'top', 'speaker', null, null, null, 'Plays back movie sound and the focus-confirmation beep.', '', 'approximate', PN],
    ['focal-plane-mark', 'Focal plane mark', null, 'top', 'focalplane', null, null, 'circle with a line through it', 'Marks where the image sensor sits inside the body.', 'Minimum focus distances are measured from this mark, not from the front of the lens.', 'verified', PN],
    // ---- front ----
    ['grip', 'Grip', null, 'front', 'grip', null, null, null, 'Rubber-covered handle for your right hand. The battery and card sit inside it.', 'Wrap three fingers around it, index finger resting on the shutter button.', 'verified', PN],
    ['lens-mount', 'Lens mount', 'RF lens mount', 'front', 'mount', null, '#lesson-lenses', null, 'The metal RF bayonet the lens locks into. Its opening is 54 mm wide and the sensor sits 20 mm behind it.', 'Line up the lens mark with the mount index, then turn the lens until it clicks.', 'verified', PN],
    ['rf-lens-mount-index', 'RF lens mount index', null, 'front', null, null, null, 'red dot', 'The red dot you line up with the mark on an RF lens when attaching it. RF-S lenses use a white mark.', '', 'verified', PN],
    ['contacts', 'Contacts', null, 'front', 'contacts', null, null, null, 'Gold pins that carry power and data between body and lens: focus, aperture, stabilisation and lens information.', 'Never touch them. Dirty contacts cause lens communication errors.', 'verified', PN],
    ['lens-lock-pin', 'Lens lock pin', null, 'front', null, null, null, null, 'A spring pin that drops into the lens bayonet and stops the lens turning once attached.', 'Press the lens release button to retract it.', 'verified', PN],
    ['lens-release-button', 'Lens release button', null, 'front', 'release', 'press', null, null, 'Retracts the lens lock pin so the lens can be turned off.', 'Hold it in and turn the lens. Change lenses with the camera off and the mount facing down.', 'verified', PN],
    ['image-sensor', 'Image sensor', null, 'front', 'sensor', null, '#lesson-light', null, 'An APS-C CMOS sensor, 22.3 x 14.9 mm, 24.1 effective megapixels.', 'It is exposed when the lens is off. Never touch it or blow on it.', 'verified', SPEC],
    ['af-lamp', 'AF-assist beam/red-eye reduction/self-timer/remote control lamp', 'AF-assist lamp', 'front', 'lamp', null, null, null, 'Lights dim subjects so autofocus can lock, reduces red-eye, and blinks during the self-timer or remote countdown.', 'You can turn the assist beam off in the menu for discreet shooting.', 'verified', PN],
    ['body-cap', 'Body cap', null, 'front', null, null, null, null, 'Covers the mount when no lens is attached, keeping dust off the sensor.', '', 'educational', PN],
    // ---- left side (mic side) ----
    ['terminal-cover-left', 'Terminal cover', 'Terminal cover (MIC / remote)', 'left', 'terminals2', 'open-cover', null, 'MIC, remote symbol', 'Rubber covers over the external microphone IN terminal and the remote control terminal.', 'Click it to open.', 'verified', PN],
    ['external-mic-in', 'External microphone IN terminal', 'MIC IN', 'left', null, null, null, 'MIC', 'A 3.5 mm stereo mini jack for an external microphone.', '', 'verified', SPEC],
    ['remote-terminal', 'Remote control terminal', null, 'left', null, null, '#lesson-longexp', 'remote symbol', 'Socket for the RS-60E3 wired remote switch, for firing the shutter on a tripod without touching the camera.', '', 'verified', SPEC],
    ['strap-mount-left', 'Strap mount', null, 'left', 'strap', null, null, null, 'Metal eyelet for the neck strap.', 'Thread the strap back through its buckle so it cannot slip.', 'verified', PN],
    // ---- right side (grip side) ----
    ['terminal-cover-right', 'Terminal cover', 'Terminal cover (USB / HDMI)', 'right', 'terminals', 'open-cover', null, 'USB and HDMI symbols', 'Covers the digital terminal and the HDMI micro OUT terminal.', 'Click it to open.', 'verified', PN],
    ['digital-terminal', 'Digital terminal', 'USB-C', 'right', null, null, null, 'USB symbol', 'USB Type-C port for connecting to a computer or smartphone.', '', 'verified', SPEC],
    ['hdmi-micro-out', 'HDMI micro OUT terminal', 'HDMI', 'right', null, null, null, 'HDMI', 'Type D micro HDMI output for a TV or monitor.', '', 'verified', SPEC],
    ['dc-cord-hole', 'DC cord hole', null, 'right', null, null, null, null, 'A small flap the cable of an optional DC coupler passes through when powering the camera from the mains.', '', 'approximate', PN],
    ['strap-mount-right', 'Strap mount', null, 'right', null, null, null, null, 'Metal eyelet for the neck strap.', '', 'verified', PN],
    // ---- rear ----
    ['eyecup', 'Eyecup', null, 'rear', null, null, null, null, 'Soft rubber surround that blocks stray light around the viewfinder.', 'Pressing it to your brow also steadies the camera.', 'verified', PN],
    ['viewfinder-eyepiece', 'Viewfinder eyepiece', 'Viewfinder', 'rear', 'evf', null, null, null, 'An OLED electronic viewfinder with about 2.36 million dots and 100% coverage. It shows what the sensor sees, including exposure.', 'Use it in bright sun when the screen is hard to see.', 'verified', SPEC],
    ['viewfinder-sensor', 'Viewfinder sensor', null, 'rear', 'eyesensor', null, null, null, 'Detects your eye and switches the picture from the screen to the viewfinder.', 'If the screen goes black on a tripod, something is covering this sensor.', 'verified', PN],
    ['dioptric-adjustment-slider', 'Dioptric adjustment slider', 'Diopter', 'bottom', 'diopter', null, null, null, 'Focuses the viewfinder for your eyesight. It sits under the viewfinder housing and does not affect the photo.', 'Look at the viewfinder information and slide it until the text is sharp.', 'verified', PN],
    ['screen', 'Screen', null, 'rear', 'screen', null, null, null, 'A fixed 3.0-inch LCD with about 1.04 million dots for live view, menus and playback. It is not a touchscreen.', 'Turn the camera on and press MENU to explore every setting.', 'verified', SPEC],
    ['ae-lock-button', 'AE lock/FE lock/magnify button', 'AE lock', 'rear', 'aelock', null, '#lesson-metering', 'asterisk; magnify glyph', 'Locks the exposure (or flash exposure) so you can recompose. In playback it magnifies the image.', 'Point at your subject, press it, recompose, shoot.', 'verified', PN],
    ['af-point-button', 'AF point selection/index/reduce button', 'AF point', 'rear', 'afpoint', null, '#lesson-focus', 'AF frame glyph; index glyph', 'Lets you move the AF point. In playback it reduces magnification and shows an index of thumbnails.', '', 'verified', PN],
    ['info-button', 'Info button', 'INFO', 'rear', 'infobtn', 'press', null, 'INFO', 'Changes what is shown on the screen. In playback it shows shooting information and the histogram.', '', 'verified', PN],
    ['cross-keys', 'Cross keys', null, 'rear', 'crossup', 'press', null, 'four markings, one per direction', 'One ring with four press points. In menus it moves the selection; while shooting each direction opens a setting.', 'Up: exposure compensation / erase. Down: drive mode / self-timer. Left: ISO. Right: flash.', 'verified', PN],
    ['quick-control-set', 'Quick Control/Set button', 'Q/SET', 'rear', 'setbtn', 'press', null, 'Q / SET', 'Confirms a choice in menus. While shooting it opens the Quick Control screen with the most-used settings.', 'Press it, use up/down to choose a setting and left/right to change it.', 'verified', PN],
    ['playback-button', 'Playback button', null, 'rear', 'playbtn', 'press', null, 'playback triangle', 'Shows the photos on the card.', 'Left/right moves between photos.', 'verified', PN],
    ['menu-button', 'Menu button', 'MENU', 'rear', 'menubtn', 'press', null, 'MENU', 'Opens the menu, where every setting lives, and steps back out of sub-menus.', 'Use the cross keys and SET to move around.', 'verified', PN],
    ['access-lamp', 'Access lamp', null, 'rear', 'accesslamp', null, null, null, 'Lights while the camera is writing to or reading the card.', 'Never open the card door while it is lit.', 'approximate', PN],
    // ---- bottom ----
    ['tripod-socket', 'Tripod socket', null, 'bottom', 'tripod', null, '#lesson-longexp', null, 'A standard 1/4-inch thread for tripods and plates, in line with the lens axis.', 'Needed for long exposures and night scenes.', 'verified', PN],
    ['card-battery-cover', 'Card/battery compartment cover', 'Card / battery door', 'bottom', 'door', 'open-cover', null, 'CARD/BATT.', 'The hinged door under the grip over the battery and the SD card slot.', 'Slide the lock to OPEN and the door swings open.', 'verified', PN],
    ['card-battery-cover-lock', 'Card/battery compartment cover lock', null, 'bottom', null, 'open-cover', null, 'OPEN / LOCK', 'The slide that unlatches the card/battery door.', '', 'verified', PN],
    ['serial-number', 'Serial number (body number)', 'Serial number', 'bottom', null, null, null, null, 'The body number printed on the label under the camera.', '', 'verified', PN],
    // ---- internal / accessory (educational; not on Canon's external part diagram) ----
    ['shutter', 'Shutter', null, 'internal', 'shutter', 'press', '#lesson-shutter', null, 'Curtains in front of the sensor that time the exposure, from 30 s to 1/4000 s (the R100 also uses an electronic first curtain). Internal geometry here is illustrative.', 'Press the shutter button with the lens off to watch it run.', 'educational', SPEC],
    ['processor', 'Main board and processor', null, 'internal', 'processor', null, null, null, 'Reads the sensor, runs autofocus and subject detection, and turns raw data into JPEGs and video. Illustrative only.', '', 'educational', null],
    ['battery', 'Battery Pack LP-E17', 'LP-E17 battery', 'internal', 'battery', null, null, 'LP-E17', 'A rechargeable lithium-ion pack. Canon rates it at about 320 shots through the viewfinder or 400 on the screen (power saving).', 'Carry a spare. Cold drains it faster.', 'educational', SPEC],
    ['card', 'SD memory card', null, 'internal', 'card', null, null, 'SD', 'One slot for SD, SDHC or SDXC cards (UHS-I).', 'Format new cards in the camera.', 'educational', SPEC],
    // ---- lens (kit RF-S 18-45mm and others; educational detail) ----
    ['lens', 'Lens', null, 'lens', 'lens', null, '#lesson-lenses', null, 'Gathers light and focuses it on the sensor. Focal length sets the angle of view; aperture sets brightness and depth of field.', '', 'educational', null],
    ['zoom-ring', 'Zoom ring', null, 'lens', 'zoomring', null, '#lesson-lenses', null, 'Turning it changes the focal length. On a retractable kit lens it also extends the barrel.', '', 'educational', null],
    ['focus-ring', 'Focus/control ring', null, 'lens', 'focusring', null, '#lesson-focus', null, 'Focuses by hand in MF; on RF lenses it can be assigned to other settings.', '', 'educational', null],
    ['front-element', 'Front element', null, 'lens', 'frontelement', null, null, null, 'The first piece of glass. Its coatings cut reflections and flare.', 'Keep it clean with a blower and a microfibre cloth.', 'educational', null],
    ['aperture-diaphragm', 'Aperture diaphragm', null, 'lens', 'iris', null, '#lesson-aperture', null, 'Curved blades forming an adjustable opening. A small f-number is a big opening.', '', 'educational', null],
    ['lens-elements', 'Lens elements', null, 'lens', 'elements', null, null, null, 'Glass elements in groups that bend light to a sharp image and cancel each other’s errors. Positions here are illustrative.', '', 'educational', null]
  ];

  const pascal = (id) => id.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
  // GLB mesh names that don't follow PART_<PascalId>
  const MESH = { 'lens': ['LENS_Barrel'], 'zoom-ring': ['LENS_ZoomRing'], 'focus-ring': ['LENS_ControlRing'], 'front-element': ['LENS_FrontElement'],
    'aperture-diaphragm': ['LENS_Aperture'], 'lens-elements': ['LENS_Elements'], 'body-cap': [],
    'terminal-cover-left': ['PART_TerminalCoverLeft', 'PART_TerminalCoverLeftRemote'] };
  const parts = ROWS.map((r) => ({
    id: r[0], officialLabel: r[1], uiLabel: r[2] || r[1], view: r[3], legacyId: r[4], interactive: r[5], lesson: r[6], marking: r[7],
    description: r[8], operation: r[9], status: r[10],
    meshNames: MESH[r[0]] || ['PART_' + pascal(r[0])], anchorName: 'ANCHOR_' + pascal(r[0]),
    sourceUrl: r[11], photoRef: r[10] === 'educational' ? null : PHOTO, verificationDate: D
  }));
  // Canon names each press point of the cross keys; they are functions of one physical ring, each with its own child anchor
  const ck = parts.find((p) => p.id === 'cross-keys');
  ck.functions = [
    ['up', 'Up/exposure compensation/erase button', 'exposure compensation + erase', 'crossup'],
    ['down', 'Down/self-timer/drive mode selection button', 'drive + self-timer', 'crossdown'],
    ['left', 'Left/ISO speed setting button', 'ISO', 'crossleft'],
    ['right', 'Right/Flash button', 'flash', 'crossright']
  ].map(([dir, officialLabel, marking, legacyId]) => ({ dir, officialLabel, marking, legacyId, menuKey: dir, anchorName: 'ANCHOR_CrossKeys_' + dir[0].toUpperCase() + dir.slice(1) }));
  const byId = {}, byLegacy = {};
  parts.forEach((p) => { byId[p.id] = p; if (p.legacyId) byLegacy[p.legacyId] = p; });
  // the cross keys are one physical part; the old per-direction ids all resolve to it
  ['crossdown', 'crossleft', 'crossright'].forEach((k) => (byLegacy[k] = byId['cross-keys']));
  byLegacy.lensmount = byId['lens-mount'];

  const profile = {
    id: 'canon-eos-r100', manufacturer: 'Canon', model: 'EOS R100', displayName: 'Canon EOS R100',
    modelUrl: 'assets/models/canon-eos-r100/Canon_EOS_R100.glb', mobileModelUrl: 'assets/models/canon-eos-r100/Canon_EOS_R100_mobile.glb', units: 'meters',
    lensRoots: { kit: 'R100_Lens_Kit' }, bodyRoot: 'R100_Body', screenMesh: 'SCREEN_Display',
    // mode dial in physical ring order (Canon Part Names, mode dial diagram); clockwise seen from above
    modeDial: ['A+', 'HYB', 'SCN', 'FX', 'MOV', 'M', 'Av', 'Tv', 'P'],
    specs: {
      size: { value: 'Approx. 116.3 x 85.5 x 68.8 mm', sourceUrl: SPEC, verifiedAt: D },
      weight: { value: 'Approx. 356 g with battery and card; 309 g body only', sourceUrl: SPEC, verifiedAt: D },
      sensor: { value: 'APS-C CMOS, approx. 22.3 x 14.9 mm, 24.1 effective megapixels', sourceUrl: SPEC, verifiedAt: D },
      af: { value: 'Dual Pixel CMOS AF (stills, Full HD); contrast AF in 4K. Max. 143 zones (13x11) for stills', sourceUrl: SPEC, verifiedAt: D },
      burst: { value: '6.5 shots/s (One-Shot AF), 3.5 shots/s (Servo AF)', sourceUrl: SPEC, verifiedAt: D },
      shutter: { value: '1/4000 to 30 s, Bulb (M mode)', sourceUrl: SPEC, verifiedAt: D },
      iso: { value: 'ISO 100 to 12800, expandable to H (25600)', sourceUrl: SPEC, verifiedAt: D },
      flash: { value: 'Built-in, guide number approx. 6 (ISO 100, m)', sourceUrl: SPEC, verifiedAt: D },
      viewfinder: { value: 'OLED EVF, approx. 2.36 million dots, 100% coverage, 0.95x', sourceUrl: SPEC, verifiedAt: D },
      screen: { value: 'Fixed 3.0-inch TFT LCD, approx. 1.04 million dots, not touch', sourceUrl: SPEC, verifiedAt: D },
      movie: { value: '4K UHD 23.98/25p; Full HD up to 59.94p', sourceUrl: SPEC, verifiedAt: D },
      battery: { value: 'LP-E17: approx. 320 shots (viewfinder) / 400 (screen), power saving', sourceUrl: SPEC, verifiedAt: D },
      card: { value: 'One SD/SDHC/SDXC slot, UHS-I', sourceUrl: SPEC, verifiedAt: D },
      terminals: { value: 'USB Type-C, HDMI micro (Type D), 3.5 mm mic IN, RS-60E3 remote', sourceUrl: SPEC, verifiedAt: D },
      microphone: { value: 'Built-in monaural', sourceUrl: SPEC, verifiedAt: D }
    },
    parts, part: (id) => byId[id] || byLegacy[id] || null, fromLegacy: (id) => byLegacy[id] || null
  };

  FF.cameraProfiles = FF.cameraProfiles || {};
  FF.cameraProfiles[profile.id] = profile;
  FF.camera = FF.camera || profile; // the active profile
})();
