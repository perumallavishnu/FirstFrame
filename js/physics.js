/* physics.js: pure photographic maths. No DOM, no WebGL. Unit-testable in Node. */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const P = (FF.phys = {});

  /* ---------- Sensor (APS-C, 24 MP) ---------- */
  P.SENSOR = {
    w: 22.3, h: 14.9, px: [6000, 4000], pitch: 22.3 / 6000, // mm
    crop: 1.6, diag: Math.hypot(22.3, 14.9),
    fwc: 22000,                                   // full-well capacity at base ISO (electrons), simulation value
    readNoise: (iso) => 5.5 - 3.0 * Math.min(1, Math.max(0, Math.log2(iso / 100) / 4)) // e-, falls with ISO (dual-gain-like)
  };

  /* ---------- Third-stop tables (nominal labels, exact values from 2^(n/3)) ---------- */
  P.SHUTTER_LABELS = ['1/4000','1/3200','1/2500','1/2000','1/1600','1/1250','1/1000','1/800','1/640','1/500','1/400','1/320','1/250','1/200','1/160','1/125','1/100','1/80','1/60','1/50','1/40','1/30','1/25','1/20','1/15','1/13','1/10','1/8','1/6','1/5','1/4','0.3"','0.4"','0.5"','0.6"','0.8"','1"','1.3"','1.6"','2"','2.5"','3.2"','4"','5"','6"','8"','10"','13"','15"','20"','25"','30"'];
  P.SHUTTER_N = P.SHUTTER_LABELS.length;           // 52
  P.shutterValue = (i) => Math.pow(2, (i - 36) / 3); // i=0 -> 1/4096 s, i=36 -> 1 s, i=51 -> 32 s
  P.shutterIndex = (t) => Math.round(36 + 3 * Math.log2(t));
  P.APERTURE_LABELS = ['1.8','2','2.2','2.5','2.8','3.2','3.5','4','4.5','5','5.6','6.3','7.1','8','9','10','11','13','14','16','18','20','22','25','29','32'];
  P.APERTURE_N = P.APERTURE_LABELS.length;
  P.apertureValue = (i) => Math.pow(2, (i + 5) / 6);
  P.apertureIndex = (n) => Math.round(6 * Math.log2(n) - 5);
  P.ISO_LABELS = ['100','125','160','200','250','320','400','500','640','800','1000','1250','1600','2000','2500','3200','4000','5000','6400','8000','10000','12800'];
  P.ISO_N = P.ISO_LABELS.length;
  P.isoValue = (i) => 100 * Math.pow(2, i / 3);
  P.isoIndex = (iso) => Math.round(3 * Math.log2(iso / 100));
  P.fmtShutter = (t) => {
    { const i = Math.round(36 + 3 * Math.log2(t)); if (i >= 0 && i < P.SHUTTER_N && Math.abs(Math.pow(2, (i - 36) / 3) / t - 1) < 0.03) return P.SHUTTER_LABELS[i]; }
    if (t >= 0.28) { const v = t >= 10 ? Math.round(t) : Math.round(t * 10) / 10; return v + '"'; }
    return '1/' + Math.round(1 / t);
  };
  P.fmtShutterIdx = (i) => P.SHUTTER_LABELS[Math.max(0, Math.min(P.SHUTTER_N - 1, i))];
  P.fmtAperture = (n) => 'f/' + P.APERTURE_LABELS[Math.max(0, Math.min(P.APERTURE_N - 1, P.apertureIndex(n)))];
  P.fmtISO = (iso) => String(Math.round(iso / (iso >= 1000 ? 10 : 1)) * (iso >= 1000 ? 10 : 1));

  /* ---------- Exposure maths ---------- */
  // Exposure value for settings, referenced to ISO 100.
  P.ev100 = (N, t, iso) => Math.log2((N * N) / t) - Math.log2(iso / 100);
  // Key relation used everywhere: with mid-grey metered at EVm, the "correct" settings satisfy ev100 == EVm.
  P.indicator = (EVm, N, t, iso) => EVm - P.ev100(N, t, iso);   // + means over-exposed (stops)
  P.solveShutter = (EVt, N, iso) => (N * N) / Math.pow(2, EVt + Math.log2(iso / 100));
  P.solveAperture = (EVt, t, iso) => Math.sqrt(t * Math.pow(2, EVt + Math.log2(iso / 100)));
  P.solveISO = (EVt, N, t) => 100 * (N * N) / (t * Math.pow(2, EVt));
  // Sensor value at ISO 100 for a surface with radiance r (1 = 18% grey under key light) -> 0.18 when exposed correctly.
  P.value100 = (r, sceneEV, N, t) => r * 0.18 * Math.pow(2, sceneEV) * t / (N * N);

  /* ---------- Optics ---------- */
  P.fovH = (f) => 2 * Math.atan(P.SENSOR.w / (2 * f)) * 180 / Math.PI;
  P.fovV = (f) => 2 * Math.atan(P.SENSOR.h / (2 * f)) * 180 / Math.PI;
  P.equiv = (f) => f * P.SENSOR.crop;
  // Blur-circle diameter on the sensor (mm) for a point at distance d when focused at s. All in mm.
  P.coc = (f, N, s, d) => {
    if (s <= f) return 0;
    return Math.abs((f * f) / (N * (s - f)) * (d - s) / d);
  };
  // Depth of field using CoC limit c (mm). Returns metres, far may be Infinity.
  P.dof = (f, N, s, c) => {
    c = c || 0.019;
    const H = (f * f) / (N * c) + f;
    const near = (H * s) / (H + (s - f));
    const far = s >= H ? Infinity : (H * s) / (H - (s - f));
    return { near: near / 1000, far: far === Infinity ? Infinity : far / 1000, hyperfocal: H / 1000, total: far === Infinity ? Infinity : (far - near) / 1000 };
  };
  P.nearestFocusOK = (lens, f) => lens.mfd(f) * 1000;

  /* ---------- Noise ---------- */
  // Standard deviation of the output value (0..1 scale) for a pixel carrying linear signal v100 (ISO-100 referred), binned M sensor pixels.
  P.noiseSigma = (v100, iso, M) => {
    const g = iso / 100, fwc = P.SENSOR.fwc, r = P.SENSOR.readNoise(iso);
    const ne = Math.max(v100, 0) * fwc;
    return g * Math.sqrt(ne + r * r) / fwc / Math.sqrt(M || 1);
  };
  P.snrDB = (v100, iso, M) => 20 * Math.log10(Math.max(1e-9, v100 * iso / 100) / P.noiseSigma(v100, iso, M));

  /* ---------- Colour temperature (Tanner Helland approximation, as used in the shader) ---------- */
  P.cct2rgb = (k) => {
    const t = Math.min(12000, Math.max(1000, k)) / 100;
    let r, g, b;
    if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
    else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
    if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    const c = [r, g, b].map((x) => Math.max(0.03, Math.pow(Math.min(1, Math.max(0, x / 255)), 2.2)));
    const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return c.map((x) => x / y);
  };
  P.wbGains = (k) => { const c = P.cct2rgb(k); return [c[1] / c[0], 1, c[1] / c[2]]; };
  P.mired = (k) => 1e6 / k;
  P.fromMired = (m) => 1e6 / m;

  /* ---------- Hand shake (sum of three tremor/sway components) ---------- */
  P.SHAKE_F = [1.7, 4.1, 8.3];
  P.SHAKE_W = [0.012, 0.022, 0.015];               // angular velocity RMS contribution, rad/s
  // seed -> {yaw:[[A,f,phi]..], pitch:[..]}. `reduce` is the stabilisation factor (1 = none).
  P.makeShake = (rnd, reduce, amp) => {
    const mk = () => P.SHAKE_F.map((f, i) => [amp * P.SHAKE_W[i] * Math.SQRT2 / (2 * Math.PI * f) * reduce * (0.7 + 0.6 * rnd()), f * (0.9 + 0.2 * rnd()), rnd() * 2 * Math.PI]);
    return { yaw: mk(), pitch: mk() };
  };
  P.shakeAt = (sh, t) => {
    const ev = (a) => a.reduce((s, c) => s + c[0] * Math.sin(2 * Math.PI * c[1] * t + c[2]), 0);
    return [ev(sh.yaw), ev(sh.pitch)];
  };
  // Blur length in sensor pixels caused by shake during [t0, t0+T] at focal length f.
  P.shakeBlurPx = (sh, f, t0, T) => {
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    const n = 64;
    for (let i = 0; i <= n; i++) {
      const a = P.shakeAt(sh, t0 + (T * i) / n);
      minx = Math.min(minx, a[0]); maxx = Math.max(maxx, a[0]); miny = Math.min(miny, a[1]); maxy = Math.max(maxy, a[1]);
    }
    return Math.hypot(maxx - minx, maxy - miny) * f / P.SENSOR.pitch;
  };

  /* ---------- Metering ---------- */
  // lum: Float32Array of linear luminance per cell (1 = grey card under key light), gx x gy cells.
  P.meterWeights = (mode, gx, gy, af) => {
    const w = new Float32Array(gx * gy);
    for (let y = 0; y < gy; y++) for (let x = 0; x < gx; x++) {
      const u = (x + 0.5) / gx, v = (y + 0.5) / gy;
      const dx = u - 0.5, dy = v - 0.5;
      let val = 0;
      if (mode === 'spot') val = Math.hypot(dx * 1.5, dy) < 0.105 ? 1 : 0;           // ~3.5% of frame
      else if (mode === 'partial') val = Math.hypot(dx * 1.5, dy) < 0.155 ? 1 : 0;   // ~7% of frame
      else if (mode === 'center') val = Math.exp(-((dx * dx) / (2 * 0.2 * 0.2) + (dy * dy) / (2 * 0.26 * 0.26)));
      else { // evaluative: wide centre bias, plus extra weight around the active AF point
        const ax = u - (af ? af.x : 0.5), ay = v - (af ? af.y : 0.5);
        val = 0.7 * Math.exp(-((dx * dx) / (2 * 0.38 * 0.38) + (dy * dy) / (2 * 0.38 * 0.38))) + 0.9 * Math.exp(-((ax * ax + ay * ay) / (2 * 0.1 * 0.1)));
      }
      w[y * gx + x] = val;
    }
    return w;
  };
  // Returns relative luminance the meter will try to render as mid-grey (grey card = 1).
  P.meterReading = (lum, mode, gx, gy, af) => {
    const w = P.meterWeights(mode, gx, gy, af);
    let s = 0, ws = 0;
    const cap = mode === 'evaluative' ? 14 : 1e9; // evaluative metering holds back from small very bright areas
    for (let i = 0; i < lum.length; i++) { s += w[i] * Math.min(lum[i], cap); ws += w[i]; }
    return Math.max(1e-4, s / Math.max(ws, 1e-6));
  };

  /* ---------- Lens helpers ---------- */
  P.lerp = (a, b, t) => a + (b - a) * t;
  P.interpFocal = (lens, f, arr) => {
    if (lens.fmin === lens.fmax) return arr[0];
    const u = (f - lens.fmin) / (lens.fmax - lens.fmin);
    return Math.pow(2, P.lerp(Math.log2(arr[0]), Math.log2(arr[1]), Math.min(1, Math.max(0, u))));
  };
  // Index range of usable apertures at focal length f.
  P.apertureRange = (lens, f) => {
    const nMax = P.interpFocal(lens, f, lens.maxAp), nMin = P.interpFocal(lens, f, lens.minAp);
    return [Math.max(0, Math.ceil(P.apertureIndex(nMax) - 0.2)), Math.min(P.APERTURE_N - 1, Math.floor(P.apertureIndex(nMin) + 0.2))];
  };

  /* ---------- Misc ---------- */
  P.clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  P.mulberry = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
