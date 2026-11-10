/* data.js: the camera, lenses, scenes and presets. Swap the numbers here to model a different camera. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const P = FF.phys;

  /* ---------- Body: Canon EOS R100 (specs checked against Canon and retailer spec pages, Nov 2026) ---------- */
  FF.BODY = {
    name: 'Canon EOS R100',
    short: 'EOS R100',
    sensor: 'APS-C CMOS, 22.3 × 14.9 mm, 24.1 MP (6000 × 4000)',
    specs: [
      ['Sensor', 'APS-C CMOS, 22.3 × 14.9 mm, 24.1 MP'],
      ['Crop factor', '1.6× (a 50 mm lens frames like 80 mm on full frame)'],
      ['ISO', '100–12,800 (25,600 expanded)'],
      ['Shutter speeds', '30 s to 1/4000 s, plus Bulb'],
      ['Burst', '6.5 fps (One-Shot AF), 3.5 fps (Servo AF)'],
      ['Autofocus', 'Dual Pixel CMOS AF, 143 zones, people and eye detection'],
      ['AF low-light limit', '−2.5 EV (measured with an f/2 lens)'],
      ['Viewfinder', 'Electronic, 2.36 M dots, 100% coverage'],
      ['Rear screen', '3.0 in, 1.04 M dots, fixed (does not tilt or flip)'],
      ['Stabilisation', 'None in the body. Stabilisation comes from IS lenses'],
      ['Video', '4K 24p (1.55× extra crop), Full HD up to 60p'],
      ['Flash', 'Built-in pop-up flash and hot shoe'],
      ['Battery', 'LP-E17, about 400 shots on the rear screen (320 with the viewfinder)'],
      ['Card', 'One SD slot (UHS-I)'],
      ['Weight', '356 g with battery and card'],
      ['Size', '116 × 86 × 69 mm']
    ],
    // Simulator constants
    flash: { gn: 6, sync: 1 / 200, label: 'Pop-up flash (guide number ≈ 6 m at ISO 100)' },
    afLimitEV: -2.5, afLimitAperture: 2,   // EV limit is measured at f/2
    maxFps: 6.5, servoFps: 3.5, buffer: 40,
    ecRange: 3                               // ±3 EV in the simulator
  };

  /* ---------- Lenses ---------- */
  FF.LENSES = [
    {
      id: 'kit', name: 'RF-S 18-45mm F4.5-6.3 IS STM', short: '18–45 kit', role: 'The kit lens', type: 'zoom',
      fmin: 18, fmax: 45, maxAp: [4.5, 6.3], minAp: [22, 32], mfdPts: [[18, 0.20], [35, 0.30], [45, 0.35]],
      isStops: 4, blades: 7, weight: 130, filter: 49, construction: '7 elements in 7 groups', equiv: '29–72 mm',
      bestFor: ['Everyday', 'Travel', 'Landscape', 'Street', 'Family'],
      blurb: 'Light, small and versatile. It is the lens you shoot with while you learn the exposure triangle. Stabilised, so it forgives slow shutter speeds, but dim at f/4.5–6.3, so low light needs high ISO.',
      // simulated optical character (not manufacturer data)
      dims: [69, 44], ext: 22,
      opt: { cat: [1.0, 0.6], k1: [-0.075, 0.012], ab: [[3.5, 9], [3, 7]], sweet: 7.1 }
    },
    {
      id: 'prime', name: 'RF 50mm F1.8 STM', short: '50 f/1.8', role: 'The first upgrade', type: 'prime',
      fmin: 50, fmax: 50, maxAp: [1.8, 1.8], minAp: [22, 22], mfdPts: [[50, 0.30]],
      isStops: 0, blades: 7, weight: 160, filter: 43, construction: '6 elements in 5 groups', equiv: '80 mm',
      bestFor: ['Portraits', 'Low light', 'Food', 'Background blur', 'Street'],
      blurb: 'Lets in about 3.3 stops more light than the kit lens at 45 mm and gives a shallow depth of field. On this camera it frames like an 80 mm lens, a classic portrait length. It has no stabilisation, so mind your shutter speed.',
      dims: [69, 40], ext: 6,
      opt: { cat: [0.9, 0.9], k1: [-0.012, -0.012], ab: [[6, 12], [6, 12]], sweet: 4.5 }
    },
    {
      id: 'tele', name: 'RF-S 55-210mm F5-7.1 IS STM', short: '55–210 tele', role: 'Reach for sport and wildlife', type: 'zoom',
      fmin: 55, fmax: 210, maxAp: [5, 7.1], minAp: [22, 32], mfdPts: [[55, 1.0], [210, 0.73]],
      isStops: 4.5, blades: 7, weight: 270, filter: 55, construction: '11 elements in 8 groups', equiv: '88–336 mm',
      bestFor: ['Sports', 'Wildlife', 'Distant subjects', 'Compressed landscapes'],
      blurb: 'Brings far-away subjects close and squeezes depth, so backgrounds look large and soft. It needs fast shutter speeds and good light.',
      dims: [69, 93], ext: 40,
      opt: { cat: [0.6, 0.5], k1: [0.02, 0.02], ab: [[4, 8], [4, 8]], sweet: 8 }
    },
    {
      id: 'wide', name: 'RF-S 10-18mm F4.5-6.3 IS STM', short: '10–18 wide', role: 'Ultra-wide zoom', type: 'zoom',
      fmin: 10, fmax: 18, maxAp: [4.5, 6.3], minAp: [22, 32], mfdPts: [[10, 0.14], [18, 0.14]],
      isStops: 4, blades: 7, weight: 150, filter: 49, construction: '12 elements in 10 groups', equiv: '16–29 mm',
      bestFor: ['Interiors', 'Landscape', 'Architecture', 'Vlogging'],
      blurb: 'Fits a whole room or a sweeping view into the frame. Things near the camera look large and the background recedes. Dim, so use it in good light or on a tripod.',
      dims: [69, 45], ext: 18,
      opt: { cat: [1.0, 0.8], k1: [-0.11, -0.03], ab: [[4, 10], [3.5, 8]], sweet: 7.1 }
    },
    {
      id: 'travel', name: 'RF-S 18-150mm F3.5-6.3 IS STM', short: '18–150 travel', role: 'One lens for everything', type: 'zoom',
      fmin: 18, fmax: 150, maxAp: [3.5, 6.3], minAp: [22, 40], mfdPts: [[18, 0.17], [50, 0.17], [150, 0.45]],
      isStops: 4.5, blades: 7, weight: 310, filter: 55, construction: '17 elements in 13 groups', equiv: '29–240 mm',
      bestFor: ['Travel', 'Family', 'Zoo', 'One-lens kit'],
      blurb: 'Covers wide angle to long telephoto without changing lenses. A good upgrade from the kit lens if you want reach and convenience more than low-light ability.',
      dims: [69, 85], ext: 48,
      opt: { cat: [0.9, 0.5], k1: [-0.08, 0.02], ab: [[3.5, 9], [4, 8]], sweet: 8 }
    },
    {
      id: 'p16', name: 'RF 16mm F2.8 STM', short: '16 f/2.8', role: 'Small bright wide prime', type: 'prime',
      fmin: 16, fmax: 16, maxAp: [2.8, 2.8], minAp: [22, 22], mfdPts: [[16, 0.13]],
      isStops: 0, blades: 7, weight: 165, filter: 43, construction: '9 elements in 7 groups', equiv: '26 mm',
      bestFor: ['Street', 'Vlogging', 'Night sky', 'Travel'],
      blurb: 'A tiny wide-angle prime. On this camera it frames like 26 mm, a natural phone-like view, with a brighter f/2.8 aperture than any kit zoom.',
      dims: [69, 40], ext: 4,
      opt: { cat: [1.0, 1.0], k1: [-0.09, -0.09], ab: [[5, 12], [5, 12]], sweet: 5.6 }
    },
    {
      id: 'p28', name: 'RF 28mm F2.8 STM', short: '28 f/2.8 pancake', role: 'Pocketable everyday prime', type: 'prime',
      fmin: 28, fmax: 28, maxAp: [2.8, 2.8], minAp: [22, 22], mfdPts: [[28, 0.23]],
      isStops: 0, blades: 7, weight: 120, filter: 55, construction: '8 elements in 6 groups', equiv: '45 mm',
      bestFor: ['Street', 'Everyday', 'Travel', 'Documentary'],
      blurb: 'A pancake lens only 25 mm long. It frames like 45 mm, close to how your eyes see, and makes the camera small enough for a jacket pocket.',
      dims: [69, 25], ext: 5,
      opt: { cat: [0.9, 0.9], k1: [-0.02, -0.02], ab: [[4, 9], [4, 9]], sweet: 5.6 }
    },
    {
      id: 'p35', name: 'RF 35mm F1.8 MACRO IS STM', short: '35 f/1.8 macro', role: 'Bright normal lens with close focus', type: 'prime',
      fmin: 35, fmax: 35, maxAp: [1.8, 1.8], minAp: [22, 22], mfdPts: [[35, 0.17]],
      isStops: 5, blades: 7, weight: 305, filter: 52, construction: '11 elements in 9 groups', equiv: '56 mm',
      bestFor: ['Food', 'Details', 'Low light', 'Everyday', 'Close-ups'],
      blurb: 'Bright, stabilised and able to focus as close as 17 cm for half-life-size close-ups. On this camera it is a classic “normal” lens.',
      dims: [74, 63], ext: 8,
      opt: { cat: [0.9, 0.9], k1: [-0.015, -0.015], ab: [[5, 10], [5, 10]], sweet: 4 }
    },
    {
      id: 'p85', name: 'RF 85mm F2 MACRO IS STM', short: '85 f/2 macro', role: 'Portrait and close-up lens', type: 'prime',
      fmin: 85, fmax: 85, maxAp: [2, 2], minAp: [29, 29], mfdPts: [[85, 0.35]],
      isStops: 5, blades: 9, weight: 500, filter: 67, construction: '12 elements in 11 groups', equiv: '136 mm',
      bestFor: ['Portraits', 'Headshots', 'Close-ups', 'Stage'],
      blurb: 'A tight portrait lens on this camera. It flattens faces pleasantly and blurs backgrounds strongly, but you need room to step back.',
      dims: [78, 91], ext: 20,
      opt: { cat: [0.8, 0.8], k1: [0.01, 0.01], ab: [[4, 9], [4, 9]], sweet: 4 }
    },
    {
      id: 'super', name: 'RF 100-400mm F5.6-8 IS USM', short: '100–400 super-tele', role: 'Birds and far-off action', type: 'zoom',
      fmin: 100, fmax: 400, maxAp: [5.6, 8], minAp: [32, 45], mfdPts: [[100, 1.2], [200, 0.88], [400, 1.05]],
      isStops: 5.5, blades: 7, weight: 635, filter: 67, construction: '12 elements in 9 groups', equiv: '160–640 mm',
      bestFor: ['Birds', 'Wildlife', 'Sport', 'Aircraft', 'Moon'],
      blurb: 'Reaches the equivalent of 640 mm. Needs bright light or high ISO because f/8 is dim, and fast shutter speeds because every wobble is magnified.',
      dims: [80, 165], ext: 60,
      opt: { cat: [0.5, 0.4], k1: [0.015, 0.02], ab: [[3, 7], [3.5, 8]], sweet: 9 }
    }
  ];
  // Other lenses that fit the RF mount but are not simulated here.
  FF.LENS_MORE = [
    ['RF-S 14-30mm F4-6.3 IS STM PZ', 'Power-zoom wide lens made for video and vlogging.'], ['RF 24mm F1.8 MACRO IS STM', 'Bright, stabilised semi-wide prime (38 mm equivalent).'],
    ['RF 24-105mm F4-7.1 IS STM', 'Full-frame standard zoom; works on the R100 as a 38–168 mm equivalent.'], ['RF 600mm F11 IS STM', 'Very long, light telephoto for birds and the moon in bright light.'],
    ['RF-S 3.9mm F3.5 STM DUAL FISHEYE / RF-S 7.8mm F4 STM DUAL', 'Twin-lens optics for 3D and VR video on supported bodies.'],
    ['Third-party RF-mount lenses', 'Sigma and Tamron now make autofocus APS-C lenses for the RF mount, including bright f/2.8 zooms and f/1.4 primes.'],
    ['EF and EF-S lenses with the EF-EOS R adapter', 'Older Canon DSLR lenses work with full autofocus through the adapter, a cheap way to find used lenses.']
  ];
  FF.LENSES.forEach((l) => {
    l.mfd = (f) => {
      const a = l.mfdPts;
      if (a.length === 1) return a[0][1];
      if (f <= a[0][0]) return a[0][1];
      for (let i = 1; i < a.length; i++) if (f <= a[i][0]) return P.lerp(a[i - 1][1], a[i][1], (f - a[i - 1][0]) / (a[i][0] - a[i - 1][0]));
      return a[a.length - 1][1];
    };
    l.at = (f, arr) => P.interpFocal(l, f, arr);                   // interpolate (log) over focal range
    l.lin = (f, arr) => (l.fmin === l.fmax ? arr[0] : P.lerp(arr[0], arr[1], (f - l.fmin) / (l.fmax - l.fmin)));
  });
  FF.lensById = (id) => FF.LENSES.find((l) => l.id === id);

  /* ---------- Colour ---------- */
  FF.WB = [
    { id: 'awb', label: 'AWB (Ambience)', hint: 'Auto. Keeps some of the warm mood of the light.' },
    { id: 'awbw', label: 'AWB (White)', hint: 'Auto. Tries to make whites look white.' },
    { id: 'day', label: 'Daylight', k: 5200 }, { id: 'shade', label: 'Shade', k: 7000 }, { id: 'cloud', label: 'Cloudy', k: 6000 },
    { id: 'tung', label: 'Tungsten', k: 3200 }, { id: 'fluo', label: 'White fluorescent', k: 4000 }, { id: 'flash', label: 'Flash', k: 6000 },
    { id: 'k', label: 'Colour temp. (K)', k: 5200 }
  ];
  FF.STYLES = [
    { id: 'auto', label: 'Auto', contrast: 0.22, sat: 1.1 }, { id: 'std', label: 'Standard', contrast: 0.25, sat: 1.12 },
    { id: 'port', label: 'Portrait', contrast: 0.15, sat: 1.0 }, { id: 'land', label: 'Landscape', contrast: 0.35, sat: 1.38 },
    { id: 'neutral', label: 'Neutral', contrast: 0.05, sat: 0.85 }, { id: 'mono', label: 'Monochrome', contrast: 0.32, sat: 0.0 }
  ];

  /* ---------- Scenes (the "walls") ---------- */
  // glIndex matches the shader. subj = movable subject layer distance (m). speed = scene-specific motion parameter.
  FF.SCENES = [
    {
      id: 'fan', gl: 0, name: 'Spinning Fan', skill: 'Freeze motion', concept: 'Shutter speed', ev: 11.5, cct: 5600,
      desc: 'A desk fan at full speed. Blade tips move at nearly 40 m/s, so only a very fast shutter freezes them.',
      subj: { min: 1.0, max: 3.5, def: 1.8, label: 'Fan' }, bg: [5.0],
      speed: { label: 'Fan speed', unit: 'rpm', min: 300, max: 3000, step: 50, def: 1500 },
      start: { lens: 'kit', f: 30 }, moving: true,
      tip: 'Blade tips travel about 2π × 0.21 m × rev/s. Try 1/1000 s or faster.'
    },
    {
      id: 'water', gl: 1, name: 'Waterfall', skill: 'Silky water', concept: 'Long exposure', ev: 9.0, cct: 6800,
      desc: 'A shaded gorge. A long exposure turns falling water into silk, but it needs a tripod.',
      subj: { min: 7, max: 14, def: 11, label: 'Waterfall' }, bg: [16.0],
      speed: { label: 'Water speed', unit: 'm/s', min: 2, max: 10, step: 0.5, def: 6 },
      start: { lens: 'kit', f: 24 }, moving: true, tripodHint: true,
      tip: 'Low ISO, small aperture and a slow shutter. Put the camera on the tripod.'
    },
    {
      id: 'car', gl: 2, name: 'Passing Car', skill: 'Panning', concept: 'Motion blur', ev: 14.5, cct: 5500,
      desc: 'A hatchback drives past at 54 km/h. Follow it with the camera for a sharp car and a streaked background.',
      subj: { min: 6, max: 14, def: 8, label: 'Car' }, bg: [30.0, 300.0],
      speed: { label: 'Car speed', unit: 'm/s', min: 4, max: 25, step: 1, def: 15 },
      start: { lens: 'kit', f: 40 }, moving: true, panHint: true,
      tip: 'Turn on Pan with subject, then use about 1/30 s.'
    },
    {
      id: 'cafe', gl: 3, name: 'Café Table', skill: 'Background blur', concept: 'Aperture', ev: 6.5, cct: 3300,
      desc: 'A cup of coffee with string lights behind it. Open the aperture and the lights turn into bokeh.',
      subj: { min: 0.45, max: 1.8, def: 0.8, label: 'Cup' }, bg: [2.2, 4.5, 9.0],
      speed: null, start: { lens: 'prime', f: 50 }, moving: false,
      tip: 'Wide aperture, longer focal length, closer to the cup, further from the lights.'
    },
    {
      id: 'portrait', gl: 4, name: 'Golden Hour Portrait', skill: 'Backlight', concept: 'Metering', ev: 13.0, cct: 4300,
      desc: 'Sun behind the subject. The camera sees a bright sky and underexposes the face.',
      subj: { min: 1.2, max: 6, def: 2.4, label: 'Portrait' }, bg: [14.0, 200.0],
      speed: null, start: { lens: 'prime', f: 50 }, moving: false,
      tip: 'Try spot metering on the face, +2 exposure compensation, or fill flash.'
    },
    {
      id: 'candle', gl: 5, name: 'Candlelit Table', skill: 'Low light', concept: 'ISO & noise', ev: 1.5, cct: 1900,
      desc: 'One candle and nothing else. Learn how ISO, aperture and shutter trade off when light is scarce.',
      subj: { min: 0.6, max: 1.5, def: 1.0, label: 'Candle' }, bg: [1.8, 3.5, 6.0],
      speed: null, start: { lens: 'prime', f: 50 }, moving: false,
      tip: 'f/1.8 helps a lot. Watch the shutter speed against hand shake.'
    },
    {
      id: 'night', gl: 6, name: 'Night Street', skill: 'Light trails', concept: 'Tripod & bulb', ev: 2.0, cct: 3800,
      desc: 'Cars stream past. A long exposure draws their lights as ribbons, if the camera stays still.',
      subj: { min: 6, max: 20, def: 10, label: 'Road' }, bg: [28.0, 90.0, 1000.0],
      speed: { label: 'Traffic speed', unit: 'm/s', min: 4, max: 25, step: 1, def: 12 },
      start: { lens: 'kit', f: 22 }, moving: true, tripodHint: true,
      tip: 'Tripod, ISO 100–400, f/8–f/11 and 8 seconds or more.'
    },
    {
      id: 'still3d', gl: -1, three: true, look: true, place: 'A concert hall', name: 'Still Life in a Concert Hall', skill: 'Depth of field', concept: 'Aperture & focus', ev: 7.5, cct: 5200,
      desc: 'A tabletop set inside a 360° photograph of a real concert hall. A teapot and fruit, with a pawn every half metre behind it. Change the aperture and watch which pawns, and how much of the hall, stay sharp.',
      subj: { min: 0.35, max: 3.0, def: 0.9, label: 'Teapot' }, bg: [30], roam: { x: 0.7, y: [-0.12, 0.6] },
      start: { lens: 'prime', f: 50 },
      tip: 'Each pawn is labelled with its distance. Focus on one, then stop down from f/1.8 to f/11 and count how many become sharp.'
    },
    {
      id: 'carousel3d', gl: -1, three: true, look: true, place: 'Venice lagoon', name: 'Carousel on the Venice Lagoon', skill: 'Motion and low light', concept: 'Shutter vs ISO', ev: 7.0, cct: 4600,
      desc: 'A turning carousel on the Venice waterfront at sunset, photographed in 360°. Slow shutters streak the horses and bulbs; fast ones need high ISO in this light. Drag to look around.',
      subj: { min: 6, max: 16, def: 9, label: 'Carousel' }, bg: [60], roam: { x: 7, y: [-1.2, 3] },
      speed: { label: 'Carousel speed', unit: 'rpm', min: 2, max: 14, step: 1, def: 6 }, motion: (v) => 2 * Math.PI * 1.95 * v / 60,
      start: { lens: 'kit', f: 18 }, moving: true,
      tip: 'Try 1/250 s to freeze the horses, then 1/4 s on a tripod to turn the rim lights into rings.'
    },
    {
      id: 'cyclist3d', gl: -1, three: true, look: true, place: 'Potsdamer Platz, Berlin', name: 'Cyclist at Potsdamer Platz', skill: 'Freeze or pan', concept: 'Shutter speed', ev: 12.6, cct: 6000,
      desc: 'A cyclist crosses Potsdamer Platz in Berlin on an overcast day, inside a 360° photograph of the square. Freeze the wheels, let them blur, or pan with the rider so the buildings streak.',
      subj: { min: 4, max: 20, def: 8, label: 'Cyclist' }, bg: [60], roam: { x: 6, y: [-1.25, 3.5] },
      speed: { label: 'Cyclist speed', unit: 'm/s', min: 2, max: 14, step: 0.5, def: 7 }, motion: (v) => v,
      start: { lens: 'kit', f: 35 }, moving: true,
      tip: 'Turn on “Pan with subject” and use 1/30 s. The rider stays sharp and the buildings smear.'
    },
    {
      id: 'canal3d', gl: -1, three: true, look: true, place: 'Ponte San Giuseppe, Venice', name: 'Pigeons by a Venice Canal', skill: 'Fast action', concept: 'Shutter speed', ev: 14.0, cct: 5600,
      desc: 'A flock of pigeons circles in front of you beside a canal in Venice, inside a 360° photograph of the spot. Wings beat about ten times a second, so they need a very fast shutter.',
      subj: { min: 4, max: 15, def: 7, label: 'Pigeons' }, bg: [40], roam: { x: 4, y: [-1.2, 2] },
      speed: { label: 'Flight speed', unit: 'm/s', min: 3, max: 12, step: 0.5, def: 7 }, motion: (v) => v,
      start: { lens: 'kit', f: 35 }, moving: true,
      tip: 'Try 1/2000 s with Servo AF and continuous drive. Then drop to 1/60 s and see the wings dissolve.'
    }
  ];
  FF.SCENES.sort((a, b) => (b.three ? 1 : 0) - (a.three ? 1 : 0));   // the 3D sets come first on the wall
  FF.sceneById = (id) => FF.SCENES.find((s) => s.id === id);

  /* ---------- Camera modes ---------- */
  FF.MODES = [
    { id: 'A+', label: 'A+', name: 'Scene Intelligent Auto', desc: 'Camera decides everything.', auto: ['N', 't', 'iso', 'ec', 'meter', 'wb', 'af', 'flash'] },
    { id: 'SCN', label: 'SCN', name: 'Special Scene', desc: 'Picks settings for portrait, landscape or sports.', auto: ['N', 't', 'iso'] },
    { id: 'P', label: 'P', name: 'Program AE', desc: 'Camera picks aperture and shutter. You choose the rest.', auto: ['N', 't'] },
    { id: 'Tv', label: 'Tv', name: 'Shutter priority', desc: 'You pick the shutter speed. The camera picks the aperture.', auto: ['N'] },
    { id: 'Av', label: 'Av', name: 'Aperture priority', desc: 'You pick the aperture. The camera picks the shutter speed.', auto: ['t'] },
    { id: 'M', label: 'M', name: 'Manual', desc: 'You pick everything.', auto: [] }
  ];
  FF.SCN = [
    { id: 'portrait', label: 'Portrait', desc: 'Widest aperture for a soft background.' },
    { id: 'landscape', label: 'Landscape', desc: 'f/8 for front-to-back sharpness.' },
    { id: 'sports', label: 'Sports', desc: 'Fast shutter, Servo AF, burst.' }
  ];
})();
