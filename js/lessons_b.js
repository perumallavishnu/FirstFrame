/* lessons_b.js: curriculum part 2 and the glossary. */
(function () {
  'use strict';
  const FF = window.FF, add = FF.lessons.add;

  add({ id: 'modes', min: 7, title: 'Shooting modes: from Auto to Manual', sum: 'A+, P, Tv, Av and M, and which to use when.',
    body: [
      'The mode dial decides who makes which choice, you or the camera.',
      { table: [['Mode', 'You choose', 'Camera chooses', 'Use it for'], ['A+', 'Nothing', 'Everything', 'Handing the camera to a friend'], ['P', 'ISO, EC, more', 'Aperture and shutter', 'Quick snaps with some control'], ['Tv', 'Shutter speed', 'Aperture (and ISO if Auto)', 'Action, motion blur'], ['Av', 'Aperture', 'Shutter speed (and ISO if Auto)', 'Portraits, landscapes, most of the time'], ['M', 'Aperture, shutter, ISO', 'Nothing (it shows a meter)', 'Studio, tripods, tricky light']] },
      { key: 'Aperture priority (Av) with Auto ISO is the best everyday mode for learning. You control depth of field; the camera keeps the exposure right.' },
      { h: 'Exposure compensation' },
      'In P, Tv and Av the camera aims for a middle-grey picture. A white wall comes out grey; a black cat comes out grey. Exposure compensation (EC) tells it to aim brighter (+) or darker (−) by a number of stops. Snow: +1. Dark moody scene: −1.',
      { lab: { title: 'Exposure compensation on a backlit portrait', scene: 'portrait', lens: 'prime', f: 50, N: 2.8, t: 1 / 500, iso: 100, sliders: ['light', 't'], note: 'The “Light level” slider here stands in for exposure compensation: move it up and watch the face brighten.' } },
      { sim: { label: 'Try each mode in the simulator' } }
    ],
    quiz: [
      { q: 'Which mode lets you set depth of field and keeps exposure automatic?', o: ['Tv', 'Av', 'M', 'A+'], a: 1, why: 'Av is aperture priority.' },
      { q: 'Snow comes out grey in Av. Fix?', o: ['−2 EC', '+1 EC', 'Higher f-number', 'Lower ISO'], a: 1, why: 'The meter aims for mid-grey. Add exposure to make white look white.' },
      { q: 'In Manual mode the camera…', o: ['Chooses nothing but shows a meter', 'Picks everything', 'Only picks ISO', 'Locks the shutter'], a: 0, why: 'Manual gives all control; the meter guides you.' }
    ] });

  add({ id: 'metering', min: 7, title: 'Metering and histograms', sum: 'How the camera judges brightness, and how to check it.',
    body: [
      'The camera measures the scene and picks an exposure that would make the <i>average</i> look mid-grey. It has several ways of measuring:',
      { ul: ['<b>Evaluative:</b> looks at the whole frame and uses rules. Best default.', '<b>Partial / Spot:</b> only a small centre area. Use on a face against a bright sky.', '<b>Centre-weighted:</b> the middle counts most.'] },
      { h: 'Backlight' },
      'With the sun behind your subject the average is dominated by sky, so the camera exposes for the sky and the face becomes a silhouette. Fixes: spot metering on the face, +1 to +2 exposure compensation, or fill flash.',
      { lab: { title: 'Rescue a backlit face', scene: 'portrait', lens: 'prime', f: 50, N: 2.8, t: 1 / 1000, iso: 100, sliders: ['t', 'iso'], note: 'Slow the shutter and watch the face emerge, and the sky burn out. That is the trade-off.' } },
      { h: 'Reading the histogram' },
      'The histogram is a bar graph of how many pixels are dark (left) to bright (right). Mass hard against the right edge means highlights clipped. Mass against the left means crushed shadows. There is no perfect shape; it is a check against losing detail you wanted.',
      { warn: 'Clipped highlights cannot be recovered. If in doubt, expose slightly darker and brighten later.' },
      { mission: 'backlit' }
    ],
    quiz: [
      { q: 'A person is backlit by the sun and appears dark. Best first step?', o: ['Stop down', 'Spot meter on the face or add +EC', 'Lower ISO', 'Zoom in'], a: 1, why: 'Tell the camera to expose for the face.' },
      { q: 'A histogram bunched at the right edge means…', o: ['Shadows lost', 'Highlights clipped', 'Perfect', 'Noise'], a: 1, why: 'Right edge is pure white.' },
      { q: 'Which metering is best by default?', o: ['Spot', 'Evaluative', 'Off', 'Centre of a corner'], a: 1, why: 'Evaluative copes with most scenes.' }
    ] });

  add({ id: 'focus', min: 7, title: 'Autofocus and manual focus', sum: 'One-Shot, Servo, focus points and when AF fails.',
    body: [
      { ul: ['<b>One-Shot AF:</b> focuses once when you half-press and locks. For still subjects.', '<b>Servo AF:</b> keeps refocusing while you hold the button. For moving subjects.', '<b>Manual focus (MF):</b> you turn the ring. For macro, night and when AF hunts.'] },
      'The R100 detects faces and eyes. For anything else, tap the screen or move the point onto the subject. <b>Focus and recompose</b>: half-press on your subject, keep holding, swing the frame to compose, press fully. At wide apertures and close range the small shift can matter.',
      { h: 'Why AF fails' },
      { ul: ['Too dark. The R100’s AF works down to about −2.5 EV with a bright lens; in dimmer light it hunts.', 'Low contrast: a plain wall or sky.', 'Too close: every lens has a minimum focus distance.', 'The subject moves faster than it can track.'] },
      { tip: 'In the simulator, switch to the Candlelit Table, stop down and watch the AF indicator. Then try Manual and use the focus slider.' },
      { sim: { scene: 'candle', label: 'Open the candle scene' } }
    ],
    quiz: [
      { q: 'Which AF mode for a running dog?', o: ['One-Shot', 'Servo', 'Manual', 'Off'], a: 1, why: 'Servo keeps tracking.' },
      { q: 'AF hunts in a dim room. Best idea?', o: ['Add light or switch to manual focus', 'Close the aperture', 'Lower ISO', 'Zoom out'], a: 0, why: 'AF needs light and contrast.' },
      { q: 'What does “focus and recompose” mean?', o: ['Focus with a point, then reframe before shooting', 'Focus twice', 'Turn the camera off', 'Change lens'], a: 0, why: 'You lock focus and then change the framing.' }
    ] });

  add({ id: 'wb', min: 6, title: 'White balance and colour', sum: 'Why candlelight looks orange and how to correct it.',
    body: [
      'Light has colour, measured as a temperature in kelvin. Candles are about 1900 K (orange), tungsten bulbs 3000 K, daylight 5500 K, shade 7000 K (blue). Your eyes adjust automatically. A camera needs to be told, or to guess, what is white.',
      'White balance (WB) applies the opposite tint so whites look white. Auto WB is usually fine. When it is not, choose a preset or set kelvin yourself. Set it too low and the picture goes blue; too high and it goes orange.',
      { lab: { title: 'Same scene, different white balance', scene: 'cafe', lens: 'prime', f: 50, N: 2.0, t: 1 / 60, iso: 800, sliders: ['wbK', 'cct'], note: 'Light colour changes the lamp; white balance changes how the camera corrects it. Match them and the whites look white.' } },
      { key: 'Shoot RAW and white balance becomes a choice you make later, without any loss of quality.' },
      { tip: 'Warm light feels cosy. Sometimes the right choice is to leave the warmth in on purpose. AWB (Ambience) does exactly that.' }
    ],
    quiz: [
      { q: 'Candles look orange because…', o: ['Low ISO', 'Their light has a low colour temperature', 'Wrong lens', 'Small aperture'], a: 1, why: 'Around 1900 K is very warm light.' },
      { q: 'You set WB to 3000 K in daylight. Result?', o: ['Orange', 'Blue', 'Green', 'Neutral'], a: 1, why: 'The camera subtracts warmth that is not there.' },
      { q: 'Why shoot RAW for WB?', o: ['Smaller files', 'You can change it later with no loss', 'Faster burst', 'It improves AF'], a: 1, why: 'RAW stores the sensor data before WB is baked in.' }
    ] });

  add({ id: 'lenses', min: 9, title: 'Lenses and crop factor', sum: 'Wide, normal, tele, zoom and prime: what each is for.',
    body: [
      'The lens decides what you see and how the background looks. <b>Focal length</b> in millimetres sets the angle of view: small numbers are wide, large numbers are zoomed in.',
      { x: 'crop' },
      { table: [['Lens', 'Equivalent', 'Best for'], ['RF-S 18-45 mm f/4.5-6.3 IS STM (kit)', '29–72 mm', 'Everything to start with. Light and sharp enough.'], ['RF 50 mm f/1.8 STM', '80 mm', 'Portraits, low light, soft backgrounds. About 3 stops brighter than the kit at 45 mm.'], ['RF-S 55-210 mm f/5-7.1 IS STM', '88–336 mm', 'Sport, wildlife, distant details.']] },
      { h: 'Zoom or prime?' },
      'A <b>zoom</b> covers a range, so it is flexible. A <b>prime</b> has one focal length and usually a wider maximum aperture, so it is brighter, sharper and gives softer backgrounds. Your feet become the zoom.',
      { h: 'Perspective' },
      'Wide lenses stretch distance and exaggerate things near the camera. Long lenses compress, making backgrounds look closer and larger. Perspective depends on where you stand, not the lens, but the lens decides how far back you must stand for the same framing.',
      { sim: { label: 'Swap lenses in the simulator' } }
    ],
    quiz: [
      { q: 'A 50 mm lens on the R100 behaves like…', o: ['31 mm', '50 mm', '80 mm', '150 mm'], a: 2, why: '50 × 1.6 = 80 mm on full frame.' },
      { q: 'Why is a prime brighter than a kit zoom?', o: ['It has more glass', 'Simpler design allows a wide maximum aperture', 'It is bigger', 'It has IS'], a: 1, why: 'f/1.8 gathers much more light than f/6.3.' },
      { q: 'Which lens for a distant bird?', o: ['18-45', '50 f/1.8', '55-210', 'Wide-angle'], a: 2, why: 'Reach.' }
    ] });

  add({ id: 'composition', min: 7, title: 'Composition basics', sum: 'Seeing like a photographer.',
    body: [
      'A technically perfect picture of a boring arrangement is still boring. These guides help.',
      { ul: ['<b>Rule of thirds.</b> Imagine a 3×3 grid. Put the subject on a line or intersection, not dead centre. The simulator can show it: turn on the grid.', '<b>Leading lines.</b> Roads, fences and rivers lead the eye to the subject.', '<b>Framing.</b> Use doors, arches and branches to frame the subject.', '<b>Simplify.</b> Move so that clutter leaves the frame. Fewer things, clearer picture.', '<b>Look at the edges.</b> Check for stray objects touching the border before you press.', '<b>Change your height.</b> Crouch for children and pets; climb for a view.'] },
      { key: 'Great photographs are 90% deciding where to stand and when to press, and 10% settings.' },
      { tip: 'In the simulator, drag in the viewfinder to aim around the scene and click to place the focus point on the subject.' },
      { sim: { label: 'Practise composing' } }
    ],
    quiz: [
      { q: 'The rule of thirds suggests…', o: ['Centre the subject', 'Place subjects near grid lines or intersections', 'Use three lenses', 'Shoot at 1/3 s'], a: 1, why: 'Off-centre placement feels dynamic.' },
      { q: 'Which usually improves a cluttered picture?', o: ['More zoom out', 'Move to remove clutter or simplify', 'Raise ISO', 'Turn on flash'], a: 1, why: 'Simplify first.' },
      { q: 'Leading lines do what?', o: ['Draw the eye to the subject', 'Sharpen the lens', 'Reduce noise', 'Brighten shadows'], a: 0, why: 'They guide the viewer’s attention.' }
    ] });

  add({ id: 'genres', min: 6, title: 'Cheat sheet by subject', sum: 'Starting settings for portraits, landscapes, sports, night and more.',
    body: [
      'These are starting points, not laws. Adjust after looking at the result.',
      { table: [['Subject', 'Mode', 'Aperture', 'Shutter', 'ISO', 'Lens', 'Tip'], ['Portrait', 'Av', 'f/1.8–f/2.8', 'auto', 'Auto', '50 mm', 'Focus on the eye. Soft light from the side.'], ['Landscape', 'Av', 'f/8–f/11', 'auto (tripod if slow)', '100', '18 mm', 'Focus about a third into the scene.'], ['Sports / kids', 'Tv', 'auto', '1/500–1/1000', 'Auto', '55–210', 'Servo AF and burst.'], ['Pets', 'Tv or Av', 'f/2.8–f/5.6', '1/250+', 'Auto', '50 / kit', 'Eye level, patience.'], ['Waterfall', 'Tv or M', 'f/11–f/16', '½–2 s', '100', 'kit', 'Tripod, self-timer.'], ['Night street', 'M', 'f/8', '8–15 s', '100–400', 'kit', 'Tripod. Lights become trails.'], ['Candlelit indoor', 'Av', 'f/1.8', 'auto ≥1/60', '3200', '50 mm', 'Hold your breath. Brace your elbows.'], ['Macro-ish details', 'Av', 'f/5.6–f/8', 'auto', 'Auto', 'kit at 45 mm', 'Stand at the minimum focus distance.']] },
      { sim: { label: 'Try these in the simulator' } }
    ],
    quiz: [
      { q: 'Best starting mode for a football match?', o: ['Av f/16', 'Tv 1/1000 s with Servo AF', 'M 1 s', 'A+ with flash'], a: 1, why: 'Motion requires a fast shutter.' },
      { q: 'Landscape depth of field: choose…', o: ['f/1.8', 'f/8–f/11', 'f/32', 'f/2'], a: 1, why: 'Mid-range apertures balance depth and sharpness.' },
      { q: 'A tripod is most vital for…', o: ['Sports', 'Night street at 10 s', 'Pets', 'Portraits'], a: 1, why: 'Long exposures need stability.' }
    ] });

  add({ id: 'raw', min: 6, title: 'RAW vs JPEG and basic editing', sum: 'What the file is and why it matters.',
    body: [
      'A <b>JPEG</b> is a finished picture: the camera applies white balance, contrast, colour and noise reduction, and compresses it. Small and ready to share. Tweaks later are limited.',
      'A <b>RAW</b> file is the sensor data with the settings attached as suggestions. It is much larger, needs processing, and gives you a lot of room to correct exposure, white balance and highlights.',
      { ul: ['<b>Beginners:</b> shoot RAW + JPEG. Share the JPEG, keep the RAW for pictures you love.', 'The R100 offers a Creative Assist and several Picture Styles for JPEG: Standard, Portrait, Landscape, Neutral, Monochrome.', 'Back up photos. A memory card is not a backup.'] },
      { h: 'A simple edit order' },
      { ol: ['Straighten and crop.', 'Fix exposure and white balance.', 'Recover highlights, lift shadows.', 'Add contrast and a little colour.', 'Sharpen last, and reduce noise if needed.'] },
      { key: 'The best edit is a well-exposed original. Editing lets you tweak, not rescue.' }
    ],
    quiz: [
      { q: 'Why does RAW allow larger corrections?', o: ['Higher resolution', 'It keeps the sensor data with little processing', 'It uses a better lens', 'It is compressed more'], a: 1, why: 'Less is baked in.' },
      { q: 'Good habit for new shooters?', o: ['Delete RAW', 'Shoot RAW + JPEG', 'Only JPEG always', 'Edit before shooting'], a: 1, why: 'You get a quick share file and a flexible original.' },
      { q: 'Which edit step should come last?', o: ['Crop', 'Sharpening', 'Exposure', 'WB'], a: 1, why: 'Sharpening depends on the final size and tones.' }
    ] });

  /* ---------- glossary ---------- */
  FF.GLOSSARY = [
    ['Aperture', 'The adjustable opening in the lens, measured as an f-number.'], ['APS-C', 'A sensor size about 22 × 15 mm, found in the EOS R100. Crop factor about 1.6.'], ['Auto ISO', 'The camera chooses ISO within a limit you set.'], ['AWB', 'Auto white balance.'], ['Bokeh', 'The look of out-of-focus areas, especially bright points of light.'],
    ['Bracketing', 'Taking several shots at different exposures.'], ['Buffer', 'Memory that holds photos during a burst before they are written to the card.'], ['Burst', 'Continuous shooting at several frames per second.'], ['Circle of confusion', 'The disc an out-of-focus point of light becomes on the sensor.'], ['Clipping', 'Pure white or pure black pixels with no detail.'],
    ['Crop factor', 'Ratio of full-frame size to the sensor size. 1.6 for the R100.'], ['Depth of field', 'The range of distances that look acceptably sharp.'], ['Diffraction', 'Softening of fine detail when light passes through a very small aperture.'], ['Dynamic range', 'The span from the darkest to the brightest detail a sensor can record.'], ['EC (exposure compensation)', 'A request to the camera to shoot brighter or darker than its meter suggests.'],
    ['EV (exposure value)', 'A number for scene or exposure brightness; each step is one stop.'], ['EVF', 'Electronic viewfinder.'], ['Exposure', 'The amount of light that reaches the sensor, and how bright the picture is.'], ['f-number', 'Focal length divided by aperture diameter. Smaller means a wider opening.'], ['Focal length', 'Millimetre distance that sets the angle of view.'],
    ['Full frame', 'A 36 × 24 mm sensor, the size of 35 mm film.'], ['Histogram', 'A graph of how many pixels sit at each brightness.'], ['IS', 'Image stabilisation. Moves lens elements to cancel small hand movements.'], ['ISO', 'Amplification applied to the sensor signal.'], ['JPEG', 'A compressed, finished image file.'],
    ['Kelvin', 'The unit for colour temperature of light.'], ['Metering', 'How the camera measures scene brightness.'], ['Mirrorless', 'A camera with no mirror; the sensor shows a live view.'], ['ND filter', 'Neutral-density filter. A dark glass that cuts light to allow longer exposures.'], ['Noise', 'Random speckle caused by weak signal and amplification.'],
    ['Panning', 'Following a moving subject with the camera during a slow exposure.'], ['Prime lens', 'A lens with one fixed focal length.'], ['RAW', 'A file with unprocessed sensor data.'], ['Servo AF', 'Autofocus that keeps tracking a moving subject.'], ['Shutter speed', 'How long the sensor is exposed.'],
    ['Stop', 'A doubling or halving of light.'], ['Telephoto', 'A long focal length that magnifies distant subjects.'], ['Tv / Av', 'Shutter priority / Aperture priority modes on Canon cameras.'], ['White balance', 'Correction for the colour of the light so that whites look white.'], ['Zoom lens', 'A lens that covers a range of focal lengths.']
  ].sort((a, b) => a[0].localeCompare(b[0]));
})();
