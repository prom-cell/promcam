/* PromCam — presets.js
 * Gaya film yang diterapkan langsung ke piksel foto akhir. Tanpa library.
 * Berjalan di halaman (Canvas) maupun di Web Worker (OffscreenCanvas), dengan kode yang sama.
 *
 * Urutan pengolahan satu foto:
 *   1. Resampel opsional: lo-fi digital (soften) atau goresan horizontal pita VHS (hsmear)
 *   2. Per piksel: kurva nada (LUT: eksposur, white balance, bahu highlight, kontras, hitam/putih),
 *      geser warna (chroma, VHS), saturasi, split-toning, faktor radial (vignette / jatuhnya blitz),
 *      garis scan, grain
 *   3. Glow highlight (dreamy), bocor cahaya (light leak), cap tanggal
 */
(function (global) {
  'use strict';

  var HAS_DOC = typeof document !== 'undefined';

  var PRESETS = [
    {
      id: 'party',
      name: 'Party Flash',
      desc: 'Terang, tajam, warna hangat.',
      blurb: 'Cocok untuk ruangan gelap. Wajah dibuat terang dan tajam seperti terkena blitz langsung.',
      traits: { tone: 'Hangat', grain: 'Sedang', contrast: 'Tinggi' },
      tone: { exposure: 1.05, wb: [1.03, 1.00, 0.97], contrast: 0.60, black: 0, white: 255 },
      saturation: 1.22,
      shadowTint: [0, 0, 0],
      highlightTint: [0, 2, 8],
      radial: { center: 0.07, edge: 0.42, power: 1.2 },
      grain: { amount: 9, size: 1 },
      preview: { filter: 'contrast(1.28) saturate(1.22) brightness(1.08)',
                 overlay: 'radial-gradient(ellipse at center, rgba(255,255,255,0.10) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.45) 100%)' }
    },
    {
      id: 'digicam',
      name: 'Digicam 2005',
      desc: 'Blitz langsung, bayangan dingin, tajam digital.',
      blurb: 'Seperti kamera saku digital awal 2000-an: wajah terang kena blitz, latar gelap kebiruan, dan cap waktu digital di pojok.',
      traits: { tone: 'Dingin cerah', grain: 'Halus', contrast: 'Tinggi' },
      tone: { exposure: 1.08, wb: [0.98, 1.00, 1.06], contrast: 0.46, black: 0, white: 255 },
      saturation: 1.12,
      shadowTint: [-4, 0, 12],
      highlightTint: [4, 6, 10],
      radial: { center: 0.14, edge: 0.40, power: 1.1 },
      grain: { amount: 4, size: 1 },
      stamp: 'digital',
      preview: { filter: 'brightness(1.1) contrast(1.16) saturate(1.12) hue-rotate(4deg)',
                 overlay: 'radial-gradient(ellipse at center, rgba(255,255,255,0.14) 0%, rgba(0,0,0,0) 40%, rgba(10,20,60,0.45) 100%)' }
    },
    {
      id: 'y2k',
      name: 'Y2K Cam',
      desc: 'Lo-fi digital, blitz kebiruan, cap piksel.',
      blurb: 'Tekstur kamera digital resolusi rendah tahun 2000-an dengan warna blitz dingin dan cap tanggal piksel. Paling seru untuk potret pesta di dalam ruangan.',
      traits: { tone: 'Dingin', grain: 'Digital', contrast: 'Tinggi' },
      tone: { exposure: 1.06, wb: [0.95, 1.00, 1.09], contrast: 0.50, black: 4, white: 255 },
      saturation: 1.20,
      shadowTint: [-6, 2, 16],
      highlightTint: [2, 8, 14],
      radial: { center: 0.10, edge: 0.40, power: 1.2 },
      grain: { amount: 6, size: 1 },
      soften: 0.42,
      chroma: 0.8,
      stamp: 'pixel',
      preview: { filter: 'brightness(1.06) contrast(1.2) saturate(1.25) blur(0.5px)',
                 overlay: 'linear-gradient(rgba(70,110,255,0.12), rgba(70,110,255,0.12))', blend: 'screen' }
    },
    {
      id: 'disposable',
      name: 'Disposable',
      desc: 'Kontras tinggi, kesan instan.',
      blurb: 'Seperti kamera sekali pakai: grain kasar, sudut gelap, bocoran cahaya tipis, dan cap tanggal oranye di pojok.',
      traits: { tone: 'Retro', grain: 'Kasar', contrast: 'Tinggi' },
      tone: { exposure: 1.04, wb: [1.03, 1.02, 0.93], contrast: 0.50, black: 10, white: 250 },
      saturation: 1.08,
      shadowTint: [-5, 10, -2],
      highlightTint: [10, 8, -8],
      radial: { center: 0.05, edge: 0.55, power: 1.4 },
      grain: { amount: 15, size: 2 },
      leak: { color: [255, 120, 40], strength: 0.16 },
      stamp: 'film',
      preview: { filter: 'contrast(1.22) saturate(1.06) sepia(0.14)',
                 overlay: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 100%)' }
    },
    {
      id: 'golden',
      name: 'Golden Film',
      desc: 'Lembut, keemasan, nuansa vintage.',
      blurb: 'Warna hangat dengan highlight keemasan dan hitam yang sedikit pudar, seperti film lama.',
      traits: { tone: 'Keemasan', grain: 'Halus', contrast: 'Lembut' },
      tone: { exposure: 1.02, wb: [1.07, 1.01, 0.88], contrast: 0.28, black: 20, white: 248 },
      saturation: 0.94,
      shadowTint: [10, 4, -6],
      highlightTint: [14, 8, -12],
      radial: { center: 0.0, edge: 0.20, power: 1.6 },
      grain: { amount: 8, size: 1 },
      preview: { filter: 'sepia(0.28) saturate(1.0) contrast(1.04) brightness(1.04)',
                 overlay: 'radial-gradient(ellipse at center, rgba(255,200,120,0.08) 0%, rgba(40,20,0,0.25) 100%)' }
    },
    {
      id: 'softglow',
      name: 'Soft Glow',
      desc: 'Hangat lembut, kulit tampak cantik.',
      blurb: 'Kontras rendah dan nada kulit hangat. Cocok untuk potret berdua atau foto close-up.',
      traits: { tone: 'Hangat lembut', grain: 'Halus', contrast: 'Lembut' },
      tone: { exposure: 1.06, wb: [1.05, 1.01, 0.95], contrast: 0.16, black: 16, white: 250 },
      saturation: 0.92,
      shadowTint: [6, 2, -2],
      highlightTint: [10, 6, 0],
      radial: { center: 0.05, edge: 0.15, power: 1.6 },
      grain: { amount: 4, size: 1 },
      preview: { filter: 'contrast(0.94) saturate(0.92) brightness(1.06) sepia(0.08)',
                 overlay: 'radial-gradient(ellipse at center, rgba(255,214,180,0.10) 0%, rgba(40,20,10,0.18) 100%)' }
    },
    {
      id: 'dreamy',
      name: 'Dreamy',
      desc: 'Kabut keemasan, highlight berpendar.',
      blurb: 'Cahaya lampu dan tepi rambut berpendar lembut, wajah tetap jelas. Paling cantik saat ada lampu di belakang atau samping.',
      traits: { tone: 'Keemasan', grain: 'Halus', contrast: 'Sangat lembut' },
      tone: { exposure: 1.05, wb: [1.06, 1.01, 0.92], contrast: 0.12, black: 18, white: 248, shoulder: 0.72 },
      saturation: 0.95,
      shadowTint: [8, 2, -4],
      highlightTint: [16, 10, -8],
      radial: { center: 0.05, edge: 0.14, power: 1.6 },
      grain: { amount: 4, size: 1 },
      glow: { threshold: 0.5, strength: 0.75, radius: 0.04 },
      preview: { filter: 'brightness(1.08) contrast(0.88) saturate(0.95) sepia(0.15) blur(0.4px)',
                 overlay: 'radial-gradient(ellipse at center, rgba(255,215,160,0.18) 0%, rgba(255,190,120,0.08) 60%, rgba(40,20,0,0.15) 100%)', blend: 'screen' }
    },
    {
      id: 'sunset',
      name: 'Sunset Amber',
      desc: 'Hangat sore, warna amber musim panas.',
      blurb: 'Warna jingga keemasan seperti cahaya senja, dengan bocoran cahaya hangat di tepi foto.',
      traits: { tone: 'Amber', grain: 'Sedang', contrast: 'Sedang' },
      tone: { exposure: 1.03, wb: [1.12, 1.00, 0.82], contrast: 0.32, black: 8, white: 252, shoulder: 0.8 },
      saturation: 1.12,
      shadowTint: [8, 2, -10],
      highlightTint: [18, 8, -16],
      radial: { center: 0.02, edge: 0.28, power: 1.4 },
      grain: { amount: 7, size: 1 },
      leak: { color: [255, 110, 40], strength: 0.32 },
      preview: { filter: 'sepia(0.3) saturate(1.25) hue-rotate(-10deg) contrast(1.05)',
                 overlay: 'linear-gradient(120deg, rgba(255,120,40,0.22) 0%, rgba(255,120,40,0) 45%)', blend: 'screen' }
    },
    {
      id: 'nineties',
      name: '90s Print',
      desc: 'Kuning hangat, pudar, cetakan lama.',
      blurb: 'Seperti foto cetak tahun 90-an di album keluarga: kuning hangat, hitam pudar, kontras lembut, dan cap tanggal oranye.',
      traits: { tone: 'Kuning hangat', grain: 'Sedang', contrast: 'Lembut' },
      tone: { exposure: 1.03, wb: [1.06, 1.04, 0.86], contrast: 0.20, black: 26, white: 240 },
      saturation: 0.82,
      shadowTint: [6, 8, -4],
      highlightTint: [12, 10, -14],
      radial: { center: 0.0, edge: 0.25, power: 1.5 },
      grain: { amount: 10, size: 1 },
      leak: { color: [255, 150, 60], strength: 0.12 },
      stamp: 'film',
      preview: { filter: 'sepia(0.35) contrast(0.88) saturate(0.85) brightness(1.04)',
                 overlay: 'linear-gradient(rgba(255,220,140,0.10), rgba(255,220,140,0.10))', blend: 'multiply' }
    },
    {
      id: 'vintage',
      name: 'Vintage',
      desc: 'Warna kalem, kontras cetakan.',
      blurb: 'Warna dibuat kalem dengan bayangan kehijauan dan kontras khas foto cetak lama. Elegan untuk foto bersama.',
      traits: { tone: 'Kalem', grain: 'Sedang', contrast: 'Sedang' },
      tone: { exposure: 1.02, wb: [1.02, 1.00, 0.94], contrast: 0.38, black: 14, white: 244 },
      saturation: 0.68,
      shadowTint: [-4, 6, 6],
      highlightTint: [10, 6, -6],
      radial: { center: 0.0, edge: 0.30, power: 1.4 },
      grain: { amount: 9, size: 1 },
      preview: { filter: 'sepia(0.2) saturate(0.7) contrast(1.05)',
                 overlay: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(20,30,20,0.35) 100%)' }
    },
    {
      id: 'instant',
      name: 'Instant',
      desc: 'Warna lembut seperti foto instan.',
      blurb: 'Nuansa kamera instan: bayangan sedikit kebiruan, highlight krem, kontras rendah. Paling pas dengan bingkai polaroid.',
      traits: { tone: 'Krem & cyan', grain: 'Halus', contrast: 'Lembut' },
      tone: { exposure: 1.04, wb: [1.00, 1.02, 0.98], contrast: 0.14, black: 22, white: 246, shoulder: 0.72 },
      saturation: 0.88,
      shadowTint: [-8, 6, 12],
      highlightTint: [12, 8, 0],
      radial: { center: 0.04, edge: 0.22, power: 1.5 },
      grain: { amount: 5, size: 1 },
      preview: { filter: 'contrast(0.88) saturate(0.88) brightness(1.06)',
                 overlay: 'linear-gradient(180deg, rgba(120,200,210,0.10) 0%, rgba(255,230,190,0.10) 100%)', blend: 'soft-light' }
    },
    {
      id: 'finefilm',
      name: 'Fine Film',
      desc: 'Grain halus, warna natural, highlight lembut.',
      blurb: 'Rasa film negatif modern: warna apa adanya, grain halus, dan highlight lampu yang tidak pecah.',
      traits: { tone: 'Natural', grain: 'Halus', contrast: 'Normal' },
      tone: { exposure: 1.02, wb: [1.02, 1.00, 0.97], contrast: 0.30, black: 6, white: 252, shoulder: 0.78 },
      saturation: 1.04,
      shadowTint: [0, 2, 4],
      highlightTint: [6, 4, -2],
      radial: { center: 0.0, edge: 0.12, power: 1.6 },
      grain: { amount: 6, size: 1 },
      preview: { filter: 'contrast(1.06) saturate(1.04)', overlay: '' }
    },
    {
      id: 'cinema',
      name: 'Cinema Night',
      desc: 'Bayangan teal, lampu oranye, sinematik.',
      blurb: 'Nuansa film malam: bayangan kebiruan dan cahaya lampu hangat. Paling hidup di bawah lampu kuning.',
      traits: { tone: 'Teal & oranye', grain: 'Halus', contrast: 'Tinggi' },
      tone: { exposure: 1.0, wb: [0.94, 0.99, 1.08], contrast: 0.42, black: 4, white: 252 },
      saturation: 1.05,
      shadowTint: [-8, 6, 14],
      highlightTint: [16, 8, -6],
      radial: { center: 0.0, edge: 0.3, power: 1.3 },
      grain: { amount: 7, size: 1 },
      preview: { filter: 'contrast(1.18) saturate(1.05) hue-rotate(-6deg)',
                 overlay: 'linear-gradient(180deg, rgba(0,80,90,0.18) 0%, rgba(255,140,60,0.10) 100%)', blend: 'soft-light' }
    },
    {
      id: 'midnight',
      name: 'Midnight Blue',
      desc: 'Dingin, elegan, untuk cahaya redup.',
      blurb: 'Nuansa biru malam dengan bayangan pekat. Paling cocok untuk lampu panggung dan lantai dansa.',
      traits: { tone: 'Dingin', grain: 'Halus', contrast: 'Tinggi' },
      tone: { exposure: 0.98, wb: [0.88, 0.97, 1.12], contrast: 0.48, black: 0, white: 255, crush: 12 },
      saturation: 0.84,
      shadowTint: [-6, 0, 24],
      highlightTint: [2, 4, 10],
      radial: { center: 0.0, edge: 0.34, power: 1.3 },
      grain: { amount: 6, size: 1 },
      preview: { filter: 'contrast(1.22) saturate(0.82) brightness(0.94)',
                 overlay: 'radial-gradient(ellipse at center, rgba(40,60,170,0.28) 0%, rgba(10,12,70,0.6) 100%)',
                 blend: 'multiply' }
    },
    {
      id: 'vhs',
      name: 'VHS Tape',
      desc: 'Noise pita, warna luber, gaya handycam.',
      blurb: 'Seperti rekaman handycam: warna sedikit luber, garis scan, noise pita, dan tulisan PLAY di layar.',
      traits: { tone: 'Retro video', grain: 'Kasar', contrast: 'Sedang' },
      tone: { exposure: 1.02, wb: [1.02, 1.00, 1.04], contrast: 0.35, black: 12, white: 238 },
      saturation: 1.15,
      shadowTint: [0, 4, 10],
      highlightTint: [8, 0, 6],
      radial: { center: 0.0, edge: 0.30, power: 1.3 },
      grain: { amount: 12, size: 2 },
      hsmear: 0.33,
      chroma: 3,
      scanlines: { lines: 240, strength: 0.10 },
      stamp: 'vhs',
      preview: { filter: 'contrast(1.1) saturate(1.25) blur(0.6px)',
                 overlay: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.14) 0px, rgba(0,0,0,0.14) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 4px)' }
    },
    {
      id: 'mono',
      name: 'Mono Grain',
      desc: 'Hitam-putih, grain kasar, dramatis.',
      blurb: 'Hitam-putih klasik dengan grain terasa. Lampu pesta jadi titik terang yang dramatis.',
      traits: { tone: 'Hitam-putih', grain: 'Kasar', contrast: 'Tinggi' },
      tone: { exposure: 1.02, wb: [1.0, 1.0, 1.0], contrast: 0.55, black: 6, white: 252 },
      saturation: 0,
      shadowTint: [0, 0, 0],
      highlightTint: [0, 0, 0],
      radial: { center: 0.04, edge: 0.35, power: 1.4 },
      grain: { amount: 14, size: 1 },
      preview: { filter: 'grayscale(1) contrast(1.3)',
                 overlay: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%)' }
    },
    {
      id: 'booth',
      name: 'Photo Booth',
      desc: 'Hitam-putih tegas ala bilik foto.',
      blurb: 'Hitam-putih kontras tinggi seperti bilik foto: wajah terang, hitam pekat, grain tipis.',
      traits: { tone: 'Hitam-putih', grain: 'Halus', contrast: 'Sangat tinggi' },
      tone: { exposure: 1.08, wb: [1.0, 1.0, 1.0], contrast: 0.70, black: 0, white: 255, crush: 18 },
      saturation: 0,
      shadowTint: [0, 0, 0],
      highlightTint: [0, 0, 0],
      radial: { center: 0.08, edge: 0.30, power: 1.3 },
      grain: { amount: 7, size: 1 },
      preview: { filter: 'grayscale(1) contrast(1.5) brightness(1.08)', overlay: '' }
    },
    {
      id: 'natural',
      name: 'Asli',
      desc: 'Warna apa adanya, sedikit dirapikan.',
      blurb: 'Hampir tanpa olahan: kontras dan warna hanya dirapikan tipis. Pilihan aman untuk foto yang akan dicetak.',
      traits: { tone: 'Netral', grain: 'Tanpa', contrast: 'Normal' },
      tone: { exposure: 1.0, wb: [1.0, 1.0, 1.0], contrast: 0.10, black: 0, white: 255 },
      saturation: 1.03,
      shadowTint: [0, 0, 0],
      highlightTint: [0, 0, 0],
      radial: { center: 0.0, edge: 0.0, power: 1 },
      grain: { amount: 0, size: 1 },
      preview: { filter: 'contrast(1.04) saturate(1.03)', overlay: '' }
    }
  ];

  function byId(id) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
    return null;
  }

  /* Kanvas yang sama di halaman maupun di worker. */
  function newCanvas(w, h) {
    if (HAS_DOC) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    return new OffscreenCanvas(w, h);
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /* Kurva S: campuran nilai asli dengan smoothstep. strength 0..1. */
  function sCurve(v, strength) {
    var s = v * v * (3 - 2 * v);
    return v + (s - v) * strength;
  }

  /* Bahu highlight: di atas titik knee, nilai mendekati putih secara halus (tidak terpotong keras). */
  function shoulder(v, knee) {
    if (v <= knee) return v;
    var r = 1 - knee, t = (v - knee) / r;
    var e = Math.exp(2 * t);
    return knee + r * ((e - 1) / (e + 1)); // tanh(t)
  }

  function buildLUT(tone, ch) {
    var lut = new Uint8ClampedArray(256);
    var gain = tone.exposure * tone.wb[ch];
    var crush = tone.crush || 0;
    for (var x = 0; x < 256; x++) {
      var v = (x / 255) * gain;
      v = tone.shoulder ? shoulder(v, tone.shoulder) : clamp01(v);
      v = sCurve(clamp01(v), tone.contrast);
      if (crush) v = clamp01((v * 255 - crush) / (255 - crush));
      lut[x] = tone.black + v * (tone.white - tone.black);
    }
    return lut;
  }

  /* Tabel faktor radial berdasarkan r^2 (0 = tengah, 1 = sudut). */
  function buildRadialLUT(radial) {
    var n = 1024, lut = new Float32Array(n + 1);
    for (var i = 0; i <= n; i++) {
      var r2 = i / n;
      lut[i] = 1 + radial.center * (1 - r2) - radial.edge * Math.pow(r2, radial.power);
    }
    return lut;
  }

  /* Ubin noise 512×512 (−1..1) dibuat sekali. Jauh lebih cepat daripada hash per piksel;
   * pengulangan 512 px tidak terlihat pada grain acak. Posisi ubin digeser per foto (seed). */
  var TILE = 512, noiseTile = null;
  function getNoise() {
    if (noiseTile) return noiseTile;
    noiseTile = new Float32Array(TILE * TILE);
    var s = 0x9E3779B9 | 0;
    for (var i = 0; i < noiseTile.length; i++) {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      noiseTile[i] = ((s >>> 0) / 4294967295) * 2 - 1;
    }
    return noiseTile;
  }

  /* Memproses ImageData di tempat. Mengembalikan waktu proses (ms). */
  function processImageData(img, preset, opts) {
    opts = opts || {};
    var t0 = (global.performance || Date).now();
    var d = img.data, w = img.width, h = img.height;
    var lutR = buildLUT(preset.tone, 0), lutG = buildLUT(preset.tone, 1), lutB = buildLUT(preset.tone, 2);
    var rad = buildRadialLUT(preset.radial);
    var sat = preset.saturation;
    var st = preset.shadowTint, ht = preset.highlightTint;
    var gAmt = preset.grain.amount * (opts.grainScale == null ? 1 : opts.grainScale);
    var seed = opts.seed == null ? 7 : opts.seed;
    var cx = w / 2, cy = h / 2, inv = 1024 / (cx * cx + cy * cy);

    // Ukuran butir grain mengikuti ukuran foto: tampak sama di pratinjau maupun file 12 MP.
    var cell = Math.max(1, Math.round((preset.grain.size || 1) * Math.max(w, h) / 2000));
    var noise = gAmt ? getNoise() : null, colIdx = null;
    var ox = (seed * 131) & (TILE - 1), oy = (seed * 71) & (TILE - 1);
    if (noise) {
      colIdx = new Int32Array(w);
      for (var cxi = 0; cxi < w; cxi++) colIdx[cxi] = (((cxi / cell) | 0) + ox) & (TILE - 1);
    }

    // Warna luber (VHS/Y2K): merah bergeser ke kanan, biru ke kiri.
    var cs = preset.chroma ? Math.max(1, Math.round(preset.chroma * w / 1000)) : 0;
    var rowR = cs ? new Uint8ClampedArray(w) : null, rowB = cs ? new Uint8ClampedArray(w) : null;

    // Garis scan: setengah periode digelapkan.
    var sl = preset.scanlines, slPeriod = sl ? Math.max(2, Math.round(h / sl.lines)) : 0, slDark = sl ? 1 - sl.strength : 1;

    for (var y = 0; y < h; y++) {
      var dy2 = (y - cy) * (y - cy);
      var rowBase = y * w;
      var nRow = noise ? (((((y / cell) | 0) + oy) & (TILE - 1)) * TILE) : 0;
      var lineK = slPeriod && (y % slPeriod) >= slPeriod / 2 ? slDark : 1;
      if (cs) {
        for (var k0 = 0; k0 < w; k0++) { var j = (rowBase + k0) << 2; rowR[k0] = d[j]; rowB[k0] = d[j + 2]; }
      }
      for (var x = 0; x < w; x++) {
        var i = (rowBase + x) << 2;
        var r, g, b;
        if (cs) {
          r = lutR[rowR[x + cs < w ? x + cs : w - 1]];
          g = lutG[d[i + 1]];
          b = lutB[rowB[x - cs >= 0 ? x - cs : 0]];
        } else {
          r = lutR[d[i]]; g = lutG[d[i + 1]]; b = lutB[d[i + 2]];
        }

        var l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;

        var ln = l * 0.00392156862745098, inl = 1 - ln, sh = inl * inl, hi = ln * ln;
        r += st[0] * sh + ht[0] * hi;
        g += st[1] * sh + ht[1] * hi;
        b += st[2] * sh + ht[2] * hi;

        var dx = x - cx;
        var k = rad[((dx * dx + dy2) * inv) | 0] * lineK;
        r *= k; g *= k; b *= k;

        if (noise) {
          var m = ln * 2 - 1; if (m < 0) m = -m;
          var n = noise[nRow + colIdx[x]] * gAmt * (1 - m * 0.5);
          r += n; g += n; b += n;
        }
        d[i] = r; d[i + 1] = g; d[i + 2] = b; // Uint8ClampedArray membatasi 0..255
      }
    }
    return (global.performance || Date).now() - t0;
  }

  /* ---------- Efek berbasis kanvas ---------- */

  /* Resampel: perkecil lalu perbesar lagi. fx/fy = faktor (mis. 0,4 = lo-fi; fx 0,33 saja = goresan VHS). */
  function resample(canvas, fx, fy) {
    var w = canvas.width, h = canvas.height;
    var sw = Math.max(8, Math.round(w * fx)), sh = Math.max(8, Math.round(h * fy));
    var small = newCanvas(sw, sh), sx = small.getContext('2d');
    sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = 'high';
    sx.drawImage(canvas, 0, 0, sw, sh);
    var x = canvas.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(small, 0, 0, w, h);
  }

  /* Blur kotak 3 lintasan (mendekati gaussian) pada RGBA, radius r px. */
  function boxBlur(img, r) {
    if (r < 1) return;
    var w = img.width, h = img.height, src = img.data, tmp = new Uint8ClampedArray(src.length);
    function pass(a, b, horiz) {
      var len = horiz ? w : h, lines = horiz ? h : w, step = horiz ? 4 : w * 4, div = 1 / (r * 2 + 1);
      for (var line = 0; line < lines; line++) {
        var base = horiz ? line * w * 4 : line * 4;
        for (var c = 0; c < 3; c++) {
          var sum = 0;
          for (var k = -r; k <= r; k++) sum += a[base + Math.min(len - 1, Math.max(0, k)) * step + c];
          for (var p = 0; p < len; p++) {
            b[base + p * step + c] = sum * div;
            var add = Math.min(len - 1, p + r + 1), rem = Math.max(0, p - r);
            sum += a[base + add * step + c] - a[base + rem * step + c];
          }
        }
      }
    }
    for (var it = 0; it < 3; it++) { pass(src, tmp, true); pass(tmp, src, false); }
  }

  /* Glow: ambil bagian terang, buramkan pada resolusi kecil, lalu tumpuk dengan mode "screen". */
  function applyGlow(canvas, glow) {
    var w = canvas.width, h = canvas.height;
    var sw = Math.max(16, Math.round(w / 8)), sh = Math.max(16, Math.round(h / 8));
    var small = newCanvas(sw, sh), sx = small.getContext('2d', { willReadFrequently: true });
    sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = 'high';
    sx.drawImage(canvas, 0, 0, sw, sh);
    var img = sx.getImageData(0, 0, sw, sh), d = img.data, t = glow.threshold * 255, k = 1 / (255 - t);
    for (var i = 0; i < d.length; i += 4) {
      var l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      var f = l <= t ? 0 : (l - t) * k;
      d[i] *= f; d[i + 1] *= f; d[i + 2] *= f;
    }
    boxBlur(img, Math.max(1, Math.round(Math.max(sw, sh) * glow.radius)));
    sx.putImageData(img, 0, 0);
    var x = canvas.getContext('2d');
    x.save();
    x.globalCompositeOperation = 'screen';
    x.globalAlpha = glow.strength;
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(small, 0, 0, w, h);
    x.restore();
  }

  /* Angka acak deterministik dari seed (posisi bocor cahaya berbeda tiap foto, sama untuk pratinjau & file akhir). */
  function rand(seed, n) {
    var s = (seed * 2654435761 + n * 40503) >>> 0;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 4294967295;
  }

  /* Bocoran cahaya dari salah satu tepi. */
  function applyLeak(canvas, leak, seed) {
    var w = canvas.width, h = canvas.height, x = canvas.getContext('2d');
    var left = rand(seed, 1) < 0.5;
    var cx = left ? -0.08 * w : 1.08 * w, cy = (0.15 + rand(seed, 2) * 0.7) * h;
    var rr = Math.max(w, h) * (0.45 + rand(seed, 3) * 0.25), c = leak.color;
    var g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + leak.strength + ')');
    g.addColorStop(0.45, 'rgba(' + c[0] + ',' + Math.round(c[1] * 0.7) + ',' + c[2] + ',' + (leak.strength * 0.45) + ')');
    g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
    x.save(); x.globalCompositeOperation = 'screen'; x.fillStyle = g; x.fillRect(0, 0, w, h); x.restore();
  }

  /* ---------- Cap tanggal ---------- */
  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  function p2(n) { return (n < 10 ? '0' : '') + n; }

  function drawStamp(ctx, w, h, date, style) {
    date = date || new Date();
    var base = Math.min(w, h), size;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    if (style === 'digital') {
      // Kamera saku digital: tanggal & jam kuning-oranye
      size = Math.round(base * 0.04);
      ctx.font = 'bold ' + size + 'px "Courier New", Courier, monospace';
      ctx.textAlign = 'right';
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = size * 0.2;
      ctx.fillStyle = '#ffc93c';
      ctx.fillText(date.getFullYear() + '/' + p2(date.getMonth() + 1) + '/' + p2(date.getDate()) + ' ' +
        p2(date.getHours()) + ':' + p2(date.getMinutes()), w - size * 1.2, h - size * 1.1);
    } else if (style === 'pixel') {
      // Y2K: huruf kecil yang diperbesar tanpa penghalusan → kotak-kotak piksel
      var text = date.getFullYear() + '.' + p2(date.getMonth() + 1) + '.' + p2(date.getDate());
      var px = 10, tw = Math.ceil(text.length * px * 0.62) + 4, th = px + 4;
      var t = newCanvas(tw, th), tx = t.getContext('2d');
      tx.font = 'bold ' + px + 'px monospace'; tx.textBaseline = 'top';
      tx.fillStyle = 'rgba(40,10,0,0.8)'; tx.fillText(text, 3, 3);
      tx.fillStyle = '#ffb02e'; tx.fillText(text, 2, 2);
      var scale = Math.max(2, Math.round(base * 0.045 / px));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(t, w - tw * scale - base * 0.05, h - th * scale - base * 0.05, tw * scale, th * scale);
    } else if (style === 'vhs') {
      // Handycam: "PLAY ▶" kiri atas, jam & tanggal kiri bawah
      size = Math.round(base * 0.05);
      ctx.font = 'bold ' + size + 'px "Courier New", Courier, monospace';
      ctx.textAlign = 'left';
      ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = size * 0.15; ctx.shadowOffsetX = size * 0.06; ctx.shadowOffsetY = size * 0.06;
      ctx.fillStyle = '#f4f4f4';
      var m = size * 0.9;
      ctx.fillText('PLAY', m, m + size);
      var pw = ctx.measureText('PLAY ').width;
      ctx.beginPath(); ctx.moveTo(m + pw, m + size * 0.18); ctx.lineTo(m + pw + size * 0.7, m + size * 0.58); ctx.lineTo(m + pw, m + size * 0.98); ctx.closePath(); ctx.fill();
      var hr = date.getHours(), ap = hr < 12 ? 'AM' : 'PM', h12 = hr % 12 || 12;
      ctx.fillText(ap + ' ' + h12 + ':' + p2(date.getMinutes()), m, h - m - size * 1.25);
      ctx.fillText(MONTHS[date.getMonth()] + '. ' + p2(date.getDate()) + ' ' + date.getFullYear(), m, h - m);
    } else {
      // Film: oranye bercahaya di pojok kanan bawah (kamera sekali pakai)
      size = Math.round(base * 0.045);
      ctx.font = 'bold ' + size + 'px "Courier New", Courier, monospace';
      ctx.textAlign = 'right';
      ctx.shadowColor = 'rgba(255,120,20,0.85)'; ctx.shadowBlur = size * 0.35;
      ctx.fillStyle = '#ffab3d'; ctx.globalAlpha = 0.92;
      ctx.fillText(p2(date.getMonth() + 1) + ' ' + p2(date.getDate()) + " '" + String(date.getFullYear()).slice(2), w - size * 1.4, h - size * 1.2);
    }
    ctx.restore();
  }

  /* Menerapkan preset pada canvas (di tempat). opts: {dateStamp, date, seed}. Mengembalikan ms proses piksel. */
  function applyToCanvas(canvas, presetId, opts) {
    opts = opts || {};
    var preset = byId(presetId);
    if (!preset) throw new Error('Preset tidak dikenal: ' + presetId);
    var seed = opts.seed == null ? 7 : opts.seed;
    if (preset.soften) resample(canvas, preset.soften, preset.soften);
    if (preset.hsmear) resample(canvas, preset.hsmear, 1);
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var ms = processImageData(img, preset, opts);
    ctx.putImageData(img, 0, 0);
    if (preset.glow) applyGlow(canvas, preset.glow);
    if (preset.leak) applyLeak(canvas, preset.leak, seed);
    var style = preset.stamp || (preset.dateStamp ? 'film' : null);
    if (style && opts.dateStamp !== false) drawStamp(ctx, canvas.width, canvas.height, opts.date, style);
    return ms;
  }

  /* Thumbnail preset dari foto contoh (assets/sample.jpg; panitia boleh menggantinya).
   * Foto dipotong tengah (cover) ke ukuran w×h, lalu diberi preset dengan kode yang sama dengan foto tamu.
   * Jika browser menolak membaca piksel (halaman dibuka sebagai file lokal), foto tampil tanpa preset. */
  function makeThumb(presetId, w, h, img) {
    var c = newCanvas(w, h);
    var ctx = c.getContext('2d', { willReadFrequently: true });
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    var scale = Math.max(w / iw, h / ih), sw = w / scale, sh = h / scale;
    ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, w, h);
    try { applyToCanvas(c, presetId, { dateStamp: false }); } catch (e) { /* kanvas tercemar (file://) */ }
    return c.toDataURL('image/jpeg', 0.85);
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Gagal memuat ' + src)); };
      img.src = src;
    });
  }

  function fontSet() { return global.fonts || (HAS_DOC ? document.fonts : null); }

  /* Bingkai polaroid yang ikut tersimpan di file foto (seperti album RekapMomen).
   * frame: { style: 'polaroid' | 'none', caption, hashtag }. Mengembalikan Promise<canvas> baru.
   * Huruf tulisan tangan (Caveat) dimuat dulu agar tidak jatuh ke huruf cadangan. */
  function applyFrame(src, frame) {
    if (!frame || frame.style !== 'polaroid') return Promise.resolve(src);
    var w = src.width, h = src.height;
    var side = Math.round(w * 0.045), bottom = Math.round(w * 0.22);
    var cap = Math.round(bottom * 0.4), tag = Math.round(bottom * 0.15);
    var fs = fontSet();
    var fontsReady = fs && fs.load
      ? Promise.all([fs.load('500 ' + cap + 'px Caveat'), fs.load('500 ' + tag + 'px "Hanken Grotesk"')]).catch(function () {})
      : Promise.resolve();
    return fontsReady.then(function () {
      var c = newCanvas(w + side * 2, h + side + bottom);
      var x = c.getContext('2d');
      x.fillStyle = '#F4F0E8'; x.fillRect(0, 0, c.width, c.height);
      // Tekstur kertas tipis
      var g = x.createLinearGradient(0, 0, c.width, c.height);
      g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(120,100,80,0.08)');
      x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(src, side, side);
      x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = Math.max(1, w / 1200);
      x.strokeRect(side, side, w, h);
      var mid = c.width / 2, base = h + side + bottom * (frame.hashtag ? 0.5 : 0.6);
      x.textAlign = 'center'; x.textBaseline = 'alphabetic';
      x.fillStyle = '#4A3B2E';
      x.font = '500 ' + cap + 'px Caveat, "Segoe Print", cursive';
      x.fillText(frame.caption || '', mid, base);
      if (frame.hashtag) {
        x.fillStyle = '#8A7A6A';
        x.font = '500 ' + tag + 'px "Hanken Grotesk", system-ui, sans-serif';
        x.fillText(frame.hashtag, mid, base + tag * 1.7);
      }
      return c;
    });
  }

  /* ---------- JPEG bertahap (halaman & worker) ----------
   *   1. kualitas jpegQuality; 2. jika > softMaxMB: jpegQualityFallback;
   *   3. jika masih > hardMaxMB: perkecil ke shrinkEdge px; 4. jika masih > hardMaxMB: tolak. */
  var MB = 1024 * 1024;
  function toJpeg(canvas, q) {
    if (canvas.convertToBlob) return canvas.convertToBlob({ type: 'image/jpeg', quality: q });
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('Gagal membuat JPEG')); }, 'image/jpeg', q);
    });
  }

  function shrinkCanvas(src, maxEdge) {
    var s = Math.min(1, maxEdge / Math.max(src.width, src.height));
    var c = newCanvas(Math.round(src.width * s), Math.round(src.height * s)), x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  function encode(canvas, cfg) {
    cfg = cfg || {};
    var softMax = (cfg.softMaxMB || 6) * MB, hardMax = (cfg.hardMaxMB || 10) * MB;
    var q1 = cfg.jpegQuality || 0.92, q2 = cfg.jpegQualityFallback || 0.85, shrink = cfg.shrinkEdge || 3000;
    return toJpeg(canvas, q1).then(function (b) {
      if (b.size <= softMax) return { blob: b, quality: q1, canvas: canvas };
      return toJpeg(canvas, q2).then(function (b2) {
        if (b2.size <= hardMax) return { blob: b2, quality: q2, canvas: canvas };
        var small = shrinkCanvas(canvas, shrink);
        return toJpeg(small, q2).then(function (b3) {
          if (b3.size > hardMax) throw new Error('Foto terlalu besar setelah dikompres');
          return { blob: b3, quality: q2, canvas: small };
        });
      });
    }).then(function (r) {
      r.width = r.canvas.width; r.height = r.canvas.height;
      return r;
    });
  }

  /* Gaya film yang diizinkan panitia (config.enabledPresets), urut sesuai daftar itu. */
  function enabled(ids) {
    if (!ids || !ids.length) return PRESETS.slice();
    return ids.map(byId).filter(Boolean);
  }

  global.PromPresets = {
    list: PRESETS,
    enabled: enabled,
    applyFrame: applyFrame,
    get: byId,
    applyToCanvas: applyToCanvas,
    processImageData: processImageData,
    makeThumb: makeThumb,
    loadImage: loadImage,
    encode: encode,
    newCanvas: newCanvas
  };
})(typeof window !== 'undefined' ? window : self);
