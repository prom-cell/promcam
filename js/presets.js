/* PromCam — presets.js
 * Empat preset foto yang diterapkan langsung ke piksel foto akhir (Canvas 2D).
 * Tanpa library. Semua angka di sini bisa disetel ulang setelah uji di HP sungguhan.
 *
 * Urutan per piksel:
 *   1. Kurva nada per kanal (LUT 256 nilai: eksposur, white balance, kontras, hitam/putih)
 *   2. Saturasi
 *   3. Split-toning (warna bayangan & highlight)
 *   4. Faktor radial (vignette / jatuhnya cahaya blitz)
 *   5. Grain
 */
(function (global) {
  'use strict';

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
      id: 'disposable',
      name: 'Disposable',
      desc: 'Kontras tinggi, kesan instan.',
      blurb: 'Seperti kamera sekali pakai: grain kasar, sudut gelap, dan cap tanggal oranye di pojok.',
      traits: { tone: 'Retro', grain: 'Kasar', contrast: 'Tinggi' },
      tone: { exposure: 1.04, wb: [1.03, 1.02, 0.93], contrast: 0.50, black: 10, white: 250 },
      saturation: 1.08,
      shadowTint: [-5, 10, -2],
      highlightTint: [10, 8, -8],
      radial: { center: 0.05, edge: 0.55, power: 1.4 },
      grain: { amount: 15, size: 2 },
      dateStamp: true,
      preview: { filter: 'contrast(1.22) saturate(1.06) sepia(0.14)',
                 overlay: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 100%)' }
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
    }
  ];

  function byId(id) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
    return null;
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /* Kurva S: campuran nilai asli dengan smoothstep. strength 0..1. */
  function sCurve(v, strength) {
    var s = v * v * (3 - 2 * v);
    return v + (s - v) * strength;
  }

  function buildLUT(tone, ch) {
    var lut = new Uint8ClampedArray(256);
    var gain = tone.exposure * tone.wb[ch];
    var crush = tone.crush || 0;
    for (var x = 0; x < 256; x++) {
      var v = clamp01((x / 255) * gain);
      v = sCurve(v, tone.contrast);
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

  /* Hash bilangan bulat cepat -> 0..1, deterministik per posisi + seed. */
  function hash(x, y, seed) {
    var h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
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
    var gShift = preset.grain.size === 2 ? 1 : 0;
    var seed = opts.seed == null ? 7 : opts.seed;
    var cx = w / 2, cy = h / 2, inv = 1 / (cx * cx + cy * cy);

    for (var y = 0; y < h; y++) {
      var dy2 = (y - cy) * (y - cy);
      var gy = y >> gShift;
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) << 2;
        var r = lutR[d[i]], g = lutG[d[i + 1]], b = lutB[d[i + 2]];

        var l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;

        var ln = l / 255, sh = (1 - ln) * (1 - ln), hi = ln * ln;
        r += st[0] * sh + ht[0] * hi;
        g += st[1] * sh + ht[1] * hi;
        b += st[2] * sh + ht[2] * hi;

        var dx = x - cx;
        var k = rad[((dx * dx + dy2) * inv * 1024) | 0];
        r *= k; g *= k; b *= k;

        if (gAmt) {
          var n = (hash(x >> gShift, gy, seed) - 0.5) * 2 * gAmt * (1 - Math.abs(2 * ln - 1) * 0.5);
          r += n; g += n; b += n;
        }
        d[i] = r; d[i + 1] = g; d[i + 2] = b; // Uint8ClampedArray membatasi 0..255
      }
    }
    return (global.performance || Date).now() - t0;
  }

  function drawDateStamp(ctx, w, h, date) {
    date = date || new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    var text = p(date.getMonth() + 1) + ' ' + p(date.getDate()) + " '" + String(date.getFullYear()).slice(2);
    var size = Math.round(Math.min(w, h) * 0.045);
    ctx.save();
    ctx.font = 'bold ' + size + 'px "Courier New", Courier, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(255,120,20,0.85)';
    ctx.shadowBlur = size * 0.35;
    ctx.fillStyle = '#ffab3d';
    ctx.globalAlpha = 0.92;
    ctx.fillText(text, w - size * 1.4, h - size * 1.2);
    ctx.restore();
  }

  /* Menerapkan preset pada canvas (di tempat). opts: {dateStamp, date, seed}. */
  function applyToCanvas(canvas, presetId, opts) {
    opts = opts || {};
    var preset = byId(presetId);
    if (!preset) throw new Error('Preset tidak dikenal: ' + presetId);
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var ms = processImageData(img, preset, opts);
    ctx.putImageData(img, 0, 0);
    var stamp = opts.dateStamp == null ? !!preset.dateStamp : (opts.dateStamp && !!preset.dateStamp);
    if (stamp) drawDateStamp(ctx, canvas.width, canvas.height, opts.date);
    return ms;
  }

  /* Thumbnail preset dari foto contoh (assets/sample.jpg; panitia boleh menggantinya).
   * Foto dipotong tengah (cover) ke ukuran w×h, lalu diberi preset dengan kode yang sama dengan foto tamu.
   * Jika browser menolak membaca piksel (halaman dibuka sebagai file lokal), foto tampil tanpa preset. */
  function makeThumb(presetId, w, h, img) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
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

  /* Bingkai polaroid yang ikut tersimpan di file foto (seperti album RekapMomen).
   * frame: { style: 'polaroid' | 'none', caption, hashtag }. Mengembalikan Promise<canvas> baru.
   * Huruf tulisan tangan (Caveat) dimuat dulu agar tidak jatuh ke huruf cadangan. */
  function applyFrame(src, frame) {
    if (!frame || frame.style !== 'polaroid') return Promise.resolve(src);
    var w = src.width, h = src.height;
    var side = Math.round(w * 0.045), bottom = Math.round(w * 0.22);
    var cap = Math.round(bottom * 0.4), tag = Math.round(bottom * 0.15);
    var fontsReady = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('500 ' + cap + 'px Caveat'), document.fonts.load('500 ' + tag + 'px "Hanken Grotesk"')]).catch(function () {})
      : Promise.resolve();
    return fontsReady.then(function () {
      var c = document.createElement('canvas');
      c.width = w + side * 2; c.height = h + side + bottom;
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
    loadImage: loadImage
  };
})(window);
