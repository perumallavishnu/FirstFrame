/* <camera-id>_profile.js: the <Maker Model> camera profile. Copy the structure of js/camera/eos_r100_profile.js.
   status: 'verified' | 'approximate' | 'educational' (see eos_r100_profile.js header).
   Every row and spec cites a source. Never add a control the official part-names diagram doesn't show. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const PN = '<official part-names page URL>';
  const SPEC = '<official specifications page URL>';
  const D = '<YYYY-MM-DD>';

  // [id, official name, UI alias|null, view, legacy id|null, interaction|null, lesson|null, marking|null,
  //  description, how to use, status, source]
  const ROWS = [
    ['shutter-button', 'Shutter-release button', 'Shutter button', 'top', null, 'press', '#lesson-focus', null,
     'Two stages: half-press to focus and meter, press fully to take the picture.', 'Squeeze it gently.', 'verified', PN]
    // ...one row per numbered item on the part-names diagrams, in their exact wording
  ];

  // Mesh and anchor names default to PART_<PascalId> / ANCHOR_<PascalId>; override here when they differ.
  // Field names must match eos_r100_profile.js exactly: the viewer, Explore panel and validator read these.
  const PHOTO = 'assets/models/<camera-id>/reference/';
  const MESH = {};
  const pascal = (id) => id.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
  const parts = ROWS.map((r) => ({
    id: r[0], officialLabel: r[1], uiLabel: r[2] || r[1], view: r[3], legacyId: r[4], interactive: r[5], lesson: r[6], marking: r[7],
    description: r[8], operation: r[9], status: r[10],
    meshNames: MESH[r[0]] || ['PART_' + pascal(r[0])], anchorName: 'ANCHOR_' + pascal(r[0]),
    sourceUrl: r[11], photoRef: r[10] === 'educational' ? null : PHOTO, verificationDate: D
  }));
  // Multi-function controls: one part with functions, each with its own child anchor, e.g.
  // byId-lookup the part, then part.functions = [{ dir, officialLabel, marking, legacyId, menuKey, anchorName: 'ANCHOR_<Pascal>_<Dir>' }]
  const byId = {}, byLegacy = {};
  parts.forEach((p) => { byId[p.id] = p; if (p.legacyId) byLegacy[p.legacyId] = p; });

  const profile = {
    id: '<camera-id>', manufacturer: '<Maker>', model: '<Model>', displayName: '<Maker Model>', status: 'beta',
    mount: '<mount id, e.g. nikon-z>',
    modelUrl: 'assets/models/<camera-id>/<Name>.glb', mobileModelUrl: 'assets/models/<camera-id>/<Name>_mobile.glb', units: 'meters',
    lensRoots: { kit: '<Model>_Lens_Kit' }, bodyRoot: '<Model>_Body', screenMesh: 'SCREEN_Display',
    modeDial: [/* physical order, clockwise seen from above; [] if the camera has none */],
    specs: {
      size: { value: '<W x H x D mm>', sourceUrl: SPEC, verifiedAt: D }
      // weight, sensor, af, burst, shutter, iso, flash, viewfinder, screen, movie, battery, card, terminals, microphone
    },
    sim: { // simulator constants (replaces FF.BODY once the app is generalised)
      flash: null, afLimitEV: null, afLimitAperture: null, maxFps: null, servoFps: null, buffer: null, ecRange: null,
      isoRange: [null, null], shutterRange: [null, null]
    },
    parts, part: (id) => byId[id] || byLegacy[id] || null, fromLegacy: (id) => byLegacy[id] || null
  };

  FF.cameraProfiles = FF.cameraProfiles || {};
  FF.cameraProfiles[profile.id] = profile;
  FF.camera = FF.camera || profile; // never replace the active camera on load
})();
