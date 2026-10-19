/* PromCam — app.js: alur layar dan state aplikasi.
 * Alur: pembuka → gaya film (→ detail) → kamera → pratinjau → tersimpan → Your Roll → detail foto / album → album akan dibuka.
 * Foto yang dipakai langsung tersimpan di HP (IndexedDB) lalu dikirim ke album di latar belakang (upload.js). */
(function () {
  'use strict';

  var CFG = window.PROMCAM_CONFIG;
  var P = window.PromPresets, U = window.PromUpload, C = window.PromCamera, PIPE = window.PromPipeline;
  var $ = function (id) { return document.getElementById(id); };

  function load(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function keep(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* mode privat */ } }

  var state = {
    screen: 'landing',
    preset: load('promcam.preset', CFG.defaultPreset),
    timer: load('promcam.timer', '0') === '1',
    flash: load('promcam.flash', '0') === '1',
    joined: load('promcam.joined', '0') === '1',   // sudah pernah masuk: pembuka langsung ke beranda
    busy: false,
    counting: null,
    source: 'stream',   // 'stream' (kamera web) atau 'native' (kamera bawaan HP)
    shot: null,         // hasil terakhir: { previewBlob, url, thumb, width, height, preset, takenAt, final: Promise }
    savedId: null,      // uploadId foto yang ditampilkan di layar "Foto tersimpan"
    photoId: null       // uploadId foto yang dibuka di layar detail
  };
  var PRESETS = P.enabled(CFG.enabledPresets);
  function allowed(id) { return PRESETS.some(function (p) { return p.id === id; }); }
  if (!allowed(state.preset)) state.preset = allowed(CFG.defaultPreset) ? CFG.defaultPreset : PRESETS[0].id;

  /* ---------- Navigasi ---------- */
  var CAMERA_SCREENS = { camera: 1, review: 1, saved: 1 };
  var RENDER = {};

  function go(name) {
    if (name === 'camera' && !canShoot()) name = phase() === 'before' ? 'countdown' : 'hub';
    var prev = state.screen;
    document.querySelectorAll('.screen').forEach(function (s) {
      s.classList.toggle('is-active', s.id === 'screen-' + name);
    });
    state.screen = name;
    if (!CAMERA_SCREENS[name] && C.isActive()) C.stop();
    if (name === 'camera' && prev !== 'camera') openCamera();
    if (RENDER[name]) RENDER[name]();
    var active = $('screen-' + name);
    if (active) active.scrollTop = 0;
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go]');
    if (t) go(t.getAttribute('data-go'));
  });

  /* ---------- Teks & gambar dari config ---------- */
  function setText(id, text) { if ($(id)) $(id).textContent = text; }
  document.title = 'PromCam, ' + CFG.eventName;
  setText('landing-invite', CFG.invitation);
  setText('landing-tagline', CFG.tagline);
  setText('landing-closing', CFG.closingLine);
  setText('saved-caption', CFG.polaroidCaption);
  setText('reveal-thanks', CFG.thanksLine);

  /* ---------- Jadwal acara & hitung mundur (WIB) ---------- */
  var TZ = 'Asia/Jakarta';
  // Jadwal dari SATU tanggal mulai (TANGGAL_MULAI di server, cadangan: config/HP): acara 17.00 – 04.00 WIB,
  // album dibuka 12.00 keesokan harinya. eventStart/eventEnd/revealAt di config (bila diisi) menimpa, untuk pengujian.
  var START, END, REVEAL, TGL_KEY = 'promcam.tgl';
  function validTgl(d) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) return false;
    var t = Date.parse(d + 'T17:00:00+07:00');
    return !isNaN(t) && new Date(t + 7 * 3600e3).toISOString().slice(0, 10) === d;
  }
  function setSchedule(tgl) {
    var s = Date.parse(tgl + 'T17:00:00+07:00');
    START = CFG.eventStart ? Date.parse(CFG.eventStart) : s;
    END = CFG.eventEnd ? Date.parse(CFG.eventEnd) : s + 11 * 3600e3;
    REVEAL = CFG.revealAt ? Date.parse(CFG.revealAt) : s + 19 * 3600e3;
  }
  var TGL = (function () {
    try { var v = localStorage.getItem(TGL_KEY); if (validTgl(v)) return v; } catch (e) { /* tanpa penyimpanan */ }
    return validTgl(CFG.tanggalMulai) ? CFG.tanggalMulai : '2026-11-02';
  })();
  setSchedule(TGL);
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(t) { return new Date(t).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }); }
  function fmtTime(t) { return new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).replace(':', '.') + ' WIB'; }
  function split(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
  }
  function shortLeft(ms) {
    var p = split(ms);
    if (p.d) return p.d + ' hari ' + p.h + ' jam';
    if (p.h) return p.h + 'j ' + pad(p.m) + 'm';
    return p.m + 'm ' + pad(p.s) + 'd';
  }
  function phase() {
    var now = Date.now();
    if (now < START) return 'before';
    if (now >= END) return 'after';
    return 'live';
  }
  // Di luar jam acara kamera tetap bisa dipakai sebagai uji coba (foto ke folder terpisah, tidak memakai jatah).
  var TRIAL = CFG.trialOutsideEvent !== false;
  function canShoot() { return phase() === 'live' || TRIAL; }
  function shotMode() { return phase() === 'live' ? 'acara' : 'uji'; }

  function dateRange(a, b) {
    var o = { timeZone: TZ }, da = new Date(a), db = new Date(b);
    var d1 = da.toLocaleDateString('id-ID', Object.assign({ day: 'numeric' }, o)), d2 = db.toLocaleDateString('id-ID', Object.assign({ day: 'numeric' }, o));
    var m1 = da.toLocaleDateString('id-ID', Object.assign({ month: 'long' }, o)), m2 = db.toLocaleDateString('id-ID', Object.assign({ month: 'long' }, o));
    var y = db.toLocaleDateString('id-ID', Object.assign({ year: 'numeric' }, o));
    return m1 === m2 ? d1 + ' – ' + d2 + ' ' + m2 + ' ' + y : d1 + ' ' + m1 + ' – ' + d2 + ' ' + m2 + ' ' + y;
  }
  function applySchedule() {
    setText('landing-date', CFG.eventDate || dateRange(START, END - 1));
    setText('reveal-date', fmtDate(REVEAL));
    setText('reveal-time', 'Pukul ' + fmtTime(REVEAL));
    setText('help-reveal', fmtDate(REVEAL) + ', pukul ' + fmtTime(REVEAL));
    setText('cd-date', fmtDate(START) + ' · ' + fmtTime(START));
    setText('hub-reveal-date', fmtDate(REVEAL) + ' · ' + fmtTime(REVEAL));
  }
  applySchedule();
  // Tanggal terbaru dari server (diubah panitia di Apps Script → Properti Skrip → TANGGAL_MULAI).
  if (CFG.endpoint && window.fetch) {
    fetch(CFG.endpoint).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !validTgl(j.tanggal) || j.tanggal === TGL) return;
      TGL = j.tanggal;
      try { localStorage.setItem(TGL_KEY, TGL); } catch (e) { /* tanpa penyimpanan */ }
      setSchedule(TGL); applySchedule(); // layar hitung mundur/beranda ikut berubah pada detik berikutnya
    }).catch(function () { /* offline: pakai tanggal tersimpan */ });
  }
  $('btn-cd-test').hidden = !TRIAL;
  if (!TRIAL) setText('cd-note', 'Kamera terbuka otomatis begitu waktunya tiba.');
  ['cd-title', 'hub-title'].forEach(function (id) { setText(id, CFG.eventName); });
  (function () {
    var words = CFG.eventName.split(' ');
    var h1 = $('landing-title'); h1.textContent = '';
    words.forEach(function (w, i) {
      var s = document.createElement('span'); s.textContent = w; h1.appendChild(s);
      if (i < words.length - 1) h1.appendChild(document.createTextNode(' '));
    });
  })();
  // Alamat absolut: url() di variabel CSS dibaca relatif terhadap folder css/, bukan halaman.
  function absUrl(path) { return new URL(path, location.href).href; }
  document.documentElement.style.setProperty('--hero-img', 'url("' + absUrl(CFG.heroImage) + '")');
  document.documentElement.style.setProperty('--sample-img', 'url("' + absUrl(CFG.sampleImage) + '")');
  if (CFG.helpWhatsApp) {
    var contact = $('help-contact');
    contact.hidden = false;
    contact.href = 'https://wa.me/' + String(CFG.helpWhatsApp).replace(/\D/g, '');
    contact.querySelector('span').textContent = 'Hubungi ' + (CFG.helpName || 'panitia');
  }

  /* ---------- Browser dalam aplikasi ---------- */
  var ua = navigator.userAgent || '';
  var inApp = /Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|TikTok|musical_ly|Snapchat/i.test(ua) ||
              (/Android/.test(ua) && /; wv\)/.test(ua));

  /* ---------- Roll (jatah frame per HP) ---------- */
  var UNLIMITED = !(CFG.rollSize > 0);

  // Jatah roll hanya untuk foto di jam acara; foto uji coba (dan foto lama tanpa tanda) tidak dihitung.
  function framesUsed() { return U.list().filter(function (i) { return i.mode === 'acara'; }).length; }
  function framesLeft() { return UNLIMITED ? Infinity : Math.max(0, CFG.rollSize - framesUsed()); }
  function noFrames() { return shotMode() === 'acara' && framesLeft() === 0; }

  function updateRoll(animate) {
    var left = framesLeft();
    var num = $('frames-left'), text = UNLIMITED ? '∞' : String(left);
    if (num.textContent !== text) {
      num.textContent = text;
      if (animate) { num.classList.remove('wind'); void num.offsetWidth; num.classList.add('wind'); }
    }
    $('landing-frames').textContent = UNLIMITED ? 'Frame tanpa batas' : left + ' frame tersedia';
    var empty = noFrames();
    $('frame-counter').classList.toggle('is-empty', empty);
    $('frame-counter').setAttribute('aria-label', UNLIMITED ? 'Frame tanpa batas' : left + ' frame tersisa');
    $('roll-done').hidden = !empty;
    $('preset-chips').hidden = empty;
    if (!state.busy) $('btn-shutter').disabled = empty || !C.isActive();
    var shots = U.list(), last = shots[shots.length - 1];
    $('roll-thumb-img').hidden = !last;
    $('roll-thumb-icon').style.display = last ? 'none' : '';
    if (last && last.thumb && $('roll-thumb-img').src !== last.thumb) $('roll-thumb-img').src = last.thumb;
  }

  function makeThumb(canvas) {
    return U.scaleToCanvas(canvas, canvas.width, canvas.height, 360).toDataURL('image/jpeg', 0.72);
  }

  /* ---------- Gaya film ---------- */
  var sampleImg = null, detailCache = {};

  function setPreset(id) {
    state.preset = id; keep('promcam.preset', id);
    document.querySelectorAll('[data-preset]').forEach(function (el) {
      el.setAttribute('aria-checked', String(el.getAttribute('data-preset') === id));
    });
    var chip = document.querySelector('.chip[data-preset="' + id + '"]');
    if (chip) { var row = chip.parentNode; row.scrollLeft = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2; }
    var p = P.get(id).preview || {};
    $('video').style.filter = p.filter || '';
    $('preview-overlay').style.background = p.overlay || '';
    $('preview-overlay').style.mixBlendMode = p.blend || 'normal';
  }

  function buildPresetUI() {
    var list = $('preset-list'), chips = $('preset-chips');
    PRESETS.forEach(function (p) {
      var card = document.createElement('button');
      card.className = 'preset-card'; card.type = 'button';
      card.setAttribute('role', 'radio'); card.setAttribute('data-preset', p.id);
      card.innerHTML = '<img alt=""><span class="pc-body"><b></b><small></small></span>';
      card.querySelector('b').textContent = p.name;
      card.querySelector('small').textContent = p.desc;
      card.addEventListener('click', function () { setPreset(p.id); });
      list.appendChild(card);

      var chip = document.createElement('button');
      chip.className = 'chip'; chip.type = 'button';
      chip.setAttribute('role', 'radio'); chip.setAttribute('data-preset', p.id);
      chip.textContent = p.name;
      chip.addEventListener('click', function () { setPreset(p.id); });
      chips.appendChild(chip);
    });
    setPreset(state.preset);
    // Thumbnail dibuat dari foto contoh dengan kode preset yang sama, setelah layar pertama tampil.
    P.loadImage(CFG.sampleImage).then(function (img) {
      sampleImg = img;
      PRESETS.forEach(function (p, i) {
        setTimeout(function () {
          list.querySelector('[data-preset="' + p.id + '"] img').src = P.makeThumb(p.id, 360, 378, img);
        }, 60 * i);
      });
    }, function () { /* foto contoh tidak ada: kartu tampil tanpa gambar */ });
  }

  RENDER.preset = function () {
    var p = P.get(state.preset);
    $('preset-title').textContent = p.name;
    $('preset-blurb').textContent = p.blurb;
    $('preset-caption').textContent = p.name + ' ♡';
    $('trait-tone').textContent = p.traits.tone;
    $('trait-grain').textContent = p.traits.grain;
    $('trait-contrast').textContent = p.traits.contrast;
    $('preset-tag').textContent = p.name;
    if (sampleImg) {
      detailCache[p.id] = detailCache[p.id] || P.makeThumb(p.id, 540, 720, sampleImg);
      detailCache.raw = detailCache.raw || coverThumb(sampleImg, 540, 720);
      $('preset-photo').src = detailCache[p.id];
      $('preset-before').src = detailCache.raw;
    }
    setCut(50);
  };

  function coverThumb(img, w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var iw = img.naturalWidth, ih = img.naturalHeight, k = Math.max(w / iw, h / ih);
    c.getContext('2d').drawImage(img, (iw - w / k) / 2, (ih - h / k) / 2, w / k, h / k, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.85);
  }

  function setCut(v) {
    $('preset-slider').value = v;
    $('compare-stage').style.setProperty('--cut', v + '%');
  }
  $('preset-slider').addEventListener('input', function (e) { setCut(e.target.value); });

  $('btn-preset-info').addEventListener('click', function () { go('preset'); });
  function join() { if (!state.joined) { state.joined = true; keep('promcam.joined', '1'); } }
  $('btn-preset-use').addEventListener('click', function () { join(); go('camera'); });
  $('btn-to-camera').addEventListener('click', function () { join(); go('camera'); });
  $('btn-presets-back').addEventListener('click', function () { go(state.joined ? 'hub' : 'landing'); });
  $('btn-hub-shoot').addEventListener('click', function () { go('camera'); });
  $('btn-cd-test').addEventListener('click', function () { go(state.joined ? 'camera' : 'presets'); });

  /* ---------- Pesan ---------- */
  function showMessage(title, html, actions) {
    $('msg-title').textContent = title;
    $('msg-body').innerHTML = html;
    var box = $('msg-actions'); box.textContent = '';
    (actions || []).forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'btn ' + (a.primary ? 'btn-primary' : 'btn-secondary');
      b.textContent = a.label;
      b.addEventListener('click', a.onClick);
      box.appendChild(b);
    });
    go('message');
  }

  var nativeAction = { label: 'Pakai kamera bawaan HP', onClick: function () { $('native-capture').click(); } };
  var backAction = { label: 'Kembali', onClick: function () { go('landing'); } };
  var retryCamera = { label: 'Coba lagi', primary: true, onClick: function () { go('camera'); } };

  function cameraError(err) {
    var kind = err && err.kind;
    if (kind === 'denied') {
      showMessage('Izin kamera ditolak',
        '<p>PromCam butuh izin kamera untuk memotret. Cara mengizinkan:</p>' +
        '<p><b>Android (Chrome)</b></p><ol><li>Ketuk ikon di kiri alamat situs.</li><li>Pilih <b>Izin</b>, lalu <b>Kamera</b>, lalu <b>Izinkan</b>.</li><li>Muat ulang halaman.</li></ol>' +
        '<p><b>iPhone (Safari)</b></p><ol><li>Ketuk <b>aA</b> di bilah alamat.</li><li>Pilih <b>Pengaturan Situs Web</b>, lalu <b>Kamera</b>, lalu <b>Izinkan</b>.</li><li>Muat ulang halaman.</li></ol>',
        [{ label: 'Muat ulang', primary: true, onClick: function () { location.reload(); } }, nativeAction, backAction]);
    } else if (kind === 'nocamera') {
      showMessage('Kamera tidak ditemukan', '<p>Browser tidak menemukan kamera di perangkat ini.</p>', [nativeAction, backAction]);
    } else if (kind === 'busy') {
      showMessage('Kamera sedang dipakai', '<p>Tutup aplikasi lain yang memakai kamera (video call, Instagram, dan sejenisnya), lalu coba lagi.</p>',
        [retryCamera, nativeAction, backAction]);
    } else {
      showMessage('Kamera tidak bisa dibuka', '<p>Terjadi kendala saat membuka kamera. Coba lagi, atau pakai kamera bawaan HP.</p>',
        [retryCamera, nativeAction, backAction]);
    }
  }

  /* ---------- Kamera ---------- */
  function openCamera() {
    if (!C.supported()) {
      showMessage('Browser ini tidak mendukung kamera web',
        '<p>Buka link ini di <b>Chrome</b> (Android) atau <b>Safari</b> (iPhone). Kamu juga bisa memakai kamera bawaan HP.</p>',
        [nativeAction, backAction]);
      return;
    }
    $('cam-loading').hidden = false;
    $('btn-shutter').disabled = true;
    C.start($('video'), C.facing()).then(function (info) {
      $('cam-loading').hidden = true;
      $('video').classList.toggle('mirror', info.facing === 'user');
      updateFlashButton();
      updateRoll(false);
      C.countCameras().then(function (n) { $('btn-flip').hidden = n < 2; $('flip-spacer').hidden = n >= 2; });
    }, function (err) {
      $('cam-loading').hidden = true;
      cameraError(err);
    });
  }

  $('btn-flip').addEventListener('click', function () {
    $('btn-flip').disabled = true; $('btn-shutter').disabled = true;
    C.flip().then(function (info) {
      $('video').classList.toggle('mirror', info.facing === 'user');
      updateFlashButton();
    }, cameraError).then(function () { $('btn-flip').disabled = false; updateRoll(false); });
  });

  /* Flash: layar putih untuk kamera depan, lampu senter untuk kamera belakang bila HP mendukung.
   * Kamera belakang tanpa lampu senter: tombol disembunyikan (layar menghadap ke arah lain). */
  function flashMode() {
    if (C.facing() === 'user') return 'screen';
    return C.hasTorch() ? 'torch' : null;
  }

  function updateFlashButton() {
    var mode = flashMode(), btn = $('btn-flash');
    btn.hidden = !mode;
    $('flash-spacer').hidden = !!mode;
    btn.setAttribute('aria-pressed', String(state.flash));
    btn.setAttribute('aria-label', mode === 'torch' ? 'Flash (lampu)' : 'Flash (layar)');
  }

  $('btn-flash').addEventListener('click', function () {
    state.flash = !state.flash; keep('promcam.flash', state.flash ? '1' : '0');
    updateFlashButton();
  });

  /* Menyalakan flash, menunggu eksposur kamera menyesuaikan, menjalankan fn, lalu mematikan flash. */
  /* Nyalakan flash, tunggu eksposur menyesuaikan, jalankan fn; flash dimatikan saat release() dipanggil. */
  function flashOn() {
    var mode = state.flash ? flashMode() : null;
    if (!mode) return Promise.resolve({ mode: null, off: function () {} });
    var on = mode === 'screen' ? Promise.resolve($('screen-flash').classList.add('on')) : C.setTorch(true);
    var wait = mode === 'screen' ? CFG.screenFlashMs : CFG.torchFlashMs;
    var off = function () {
      if (mode === 'screen') $('screen-flash').classList.remove('on');
      else C.setTorch(false);
    };
    return on.then(function () { return new Promise(function (r) { setTimeout(r, wait); }); })
      .then(function () { return { mode: mode, off: off }; });
  }

  function setTimer(on) {
    state.timer = on; keep('promcam.timer', on ? '1' : '0');
    $('btn-timer').setAttribute('aria-pressed', String(on));
  }
  $('btn-timer').addEventListener('click', function () { setTimer(!state.timer); });

  function cancelCountdown() {
    if (!state.counting) return;
    clearTimeout(state.counting); state.counting = null;
    $('countdown').hidden = true; state.busy = false; updateRoll(false);
  }
  $('viewfinder').addEventListener('click', cancelCountdown);

  $('btn-shutter').addEventListener('click', function () {
    if (state.busy || noFrames()) return;
    state.busy = true; $('btn-shutter').disabled = true;
    if (!state.timer) return shoot();
    var n = 3, el = $('countdown');
    (function step() {
      if (n === 0) { el.hidden = true; state.counting = null; return shoot(); }
      el.hidden = false; el.textContent = n;
      el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
      n--; state.counting = setTimeout(step, 1000);
    })();
  });

  function flashFx() {
    var f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) { /* tidak didukung */ }
  }

  /* Jepret: foto sensor penuh diambil TEPAT saat tombol ditekan (HP ditahan sebentar, biasanya < 1 detik),
   * flash mati begitu foto didapat, lalu pratinjau langsung tampil. Pengolahan 12 MP berjalan di latar. */
  function shoot() {
    var mirror = C.facing() === 'user' && CFG.mirrorFrontSaved;
    var vf = $('viewfinder'), aspect = vf.clientWidth / vf.clientHeight || CFG.frameAspect;
    flashOn().then(function (fl) {
      // Flash layar (kamera depan): pakai frame saja agar layar putih tidak menyala lama.
      // Maksimal 2 foto resolusi penuh diproses bersamaan agar memori HP aman.
      var wantStill = fl.mode !== 'screen' && PIPE.pending() < 2;
      var g;
      try { g = C.grab(CFG.maxEdge, mirror, aspect, wantStill); } catch (e) { fl.off(); throw e; }
      flashFx();
      if (fl.mode !== 'torch') fl.off();
      var hold = setTimeout(function () { $('hold-pill').hidden = false; }, 200);
      return g.still.then(null, function () { return null; }).then(function (still) {
        clearTimeout(hold); $('hold-pill').hidden = true;
        fl.off(); // senter mati segera setelah foto didapat
        var lc = C.lastCapture(), ss = C.streamSize() || {};
        var src = still ? 'sensor ' + (lc.sensor || '') : 'video ' + ss.width + 'x' + ss.height;
        return { frame: g.frame, still: still, src: src };
      });
    }).then(function (r) {
      state.source = 'stream';
      startShot(r.frame, r.still, mirror, r.src);
    }, function (e) {
      $('hold-pill').hidden = true;
      state.busy = false; updateRoll(false);
      cameraError(e);
    });
  }

  /* ---------- Pratinjau ---------- */
  var PREVIEW_EDGE = 1080, shotSeq = 0, BAKED = !!(CFG.frame && CFG.frame.style === 'polaroid'); // cukup tajam untuk layar HP (±360 pt × 3)

  function encCfg() {
    return { jpegQuality: CFG.jpegQuality, jpegQualityFallback: CFG.jpegQualityFallback,
             softMaxMB: CFG.softMaxMB, hardMaxMB: CFG.hardMaxMB, shrinkEdge: CFG.shrinkEdge };
  }

  function metaText(shot) {
    var name = P.get(shot.preset).name;
    if (!shot.done) return name + ' · menyiapkan resolusi penuh';
    var mp = (shot.photoWidth * shot.photoHeight) / 1e6;
    return name + ' · ' + (mp >= 1 ? mp.toFixed(mp >= 10 ? 0 : 1) : '<1') + ' MP';
  }

  /* Gambar potongan sumber (foto sensor atau frame) ke kanvas berukuran maksimal edge. */
  function regionCanvas(src, edge) {
    var r = src.region, k = Math.min(1, edge / Math.max(r.w, r.h));
    var c = document.createElement('canvas');
    c.width = Math.round(r.w * k); c.height = Math.round(r.h * k);
    var x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    if (src.mirror) { x.translate(c.width, 0); x.scale(-1, 1); }
    x.drawImage(src.source, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
    return c;
  }

  /* frame: canvas frame video (sudah dipotong sesuai bingkai). still: {bitmap, region} foto sensor penuh, atau null. */
  function startShot(frame, still, mirror, srcLabel) {
    var takenAt = new Date();
    var opts = { dateStamp: CFG.dateStamp, date: takenAt, seed: (takenAt.getTime() / 997) & 0xffff };
    var frameJob = { source: frame, region: { x: 0, y: 0, w: frame.width, h: frame.height }, mirror: false };
    var src = still ? { source: still.bitmap, region: still.region, mirror: !!mirror } : frameJob;
    var full = Math.min(1, CFG.maxEdge / Math.max(src.region.w, src.region.h));
    // Pratinjau dibuat dari foto yang SAMA dengan file akhir (sebelum sumbernya dikirim ke worker).
    var pv = regionCanvas(src, PREVIEW_EDGE);
    var shot = { id: ++shotSeq, preset: state.preset, takenAt: takenAt.toISOString(), photoAspect: pv.width / pv.height,
                 mode: shotMode(), src: srcLabel || '',
                 photoWidth: Math.round(src.region.w * full), photoHeight: Math.round(src.region.h * full), done: false };
    var prev = state.shot;
    if (prev && prev.url && !prev.kept) URL.revokeObjectURL(prev.url);
    state.shot = shot;
    var img = $('review-img'), live = $('review-live'), pol = document.querySelector('.polaroid-review');
    var preset = P.get(shot.preset);

    // 0) Seketika: foto hasil jepret ditampilkan dengan tampilan jendela bidik (filter CSS gaya film).
    var k = Math.min(1, 720 / Math.max(pv.width, pv.height));
    live.width = Math.round(pv.width * k); live.height = Math.round(pv.height * k);
    live.getContext('2d').drawImage(pv, 0, 0, live.width, live.height);
    live.style.filter = (preset.preview && preset.preview.filter) || '';
    live.hidden = false; img.hidden = true; img.removeAttribute('src'); img.classList.remove('fade-in');
    pol.classList.remove('is-baked');
    $('processing').hidden = true;
    $('review-meta').textContent = preset.name;
    $('btn-use').disabled = false;
    go('review');

    // 1) Pratinjau berbingkai (±1080 px) di halaman, menggantikan tampilan sementara.
    shot.previewReady = new Promise(function (resolve, reject) {
      setTimeout(function () {
        try { P.applyToCanvas(pv, shot.preset, opts); } catch (e) { /* gagal: tampil apa adanya */ }
        P.applyFrame(pv, CFG.frame).then(function (framed) {
          shot.thumb = makeThumb(framed);
          shot.width = framed.width; shot.height = framed.height;
          return P.encode(framed, { jpegQuality: 0.88, softMaxMB: 5, hardMaxMB: 8, shrinkEdge: PREVIEW_EDGE });
        }).then(function (enc) {
          shot.previewBlob = enc.blob;
          shot.url = URL.createObjectURL(enc.blob);
          resolve(shot);
          if (state.shot !== shot) return;
          img.onload = function () {
            if (state.shot !== shot) return;
            if (BAKED) pol.classList.add('is-baked');
            img.hidden = false; live.hidden = true; img.classList.add('fade-in');
          };
          img.src = shot.url;
        }).catch(function (e) {
          reject(e);
          if (state.shot !== shot) return;
          $('review-meta').textContent = 'Gagal memproses. Ulangi.';
          $('btn-use').disabled = true;
        }).then(function () { state.busy = false; updateRoll(false); });
      }, 16);
    });
    shot.previewReady.catch(function () {});

    // 2) Foto akhir resolusi penuh di latar (Web Worker bila ada). Gagal → frame video yang sama.
    shot.final = PIPE.render({ source: src.source, region: src.region, maxEdge: CFG.maxEdge, mirror: src.mirror,
      presetId: shot.preset, opts: opts, frame: CFG.frame, enc: encCfg(), fallback: frameJob, both: CFG.saveBothVersions !== false });
    shot.final.then(function (r) {
      shot.done = true; shot.finalBlob = r.blob; shot.via = r.via;
      shot.photoWidth = r.photoWidth; shot.photoHeight = r.photoHeight;
      shot.width = r.width; shot.height = r.height;
      if (state.shot === shot && state.screen === 'review' && shot.url) $('review-meta').textContent = metaText(shot);
    }, function () { /* pratinjau tetap dipakai */ });
  }

  $('btn-retake').addEventListener('click', function () {
    if (state.source === 'native') return $('native-capture').click();
    go('camera');
  });

  /* ---------- Gunakan foto → tersimpan di HP → dikirim di latar belakang ---------- */
  $('btn-use').addEventListener('click', function () {
    var s = state.shot; if (!s || !s.previewReady || s.kept) return;
    if (noFrames()) return go('roll');
    $('btn-use').disabled = true;
    s.kept = true;
    // Biasanya pratinjau sudah siap; bila belum (sepersekian detik), tunggu sebentar.
    s.previewReady.then(function () { useShot(s); }, function () { s.kept = false; });
  });

  function useShot(s) {
    // Langsung ke layar "Tersimpan". Pratinjau disimpan dulu, lalu diganti foto resolusi penuh begitu siap.
    U.enqueue({
      ready: s.final.then(function (r) { return { blob: r.blob, width: r.width, height: r.height, blobPlain: r.blobPlain }; }),
      fallback: { blob: s.previewBlob, width: s.width, height: s.height },
      thumb: s.thumb, preset: s.preset, takenAt: s.takenAt, mode: s.mode, src: s.src
    }).then(function (item) {
      state.savedId = item.uploadId;
      if (RENDER.saved && state.screen === 'saved') RENDER.saved();
    });
    $('saved-img').src = s.url;
    var pol = document.querySelector('.polaroid-saved');
    pol.classList.remove('develop'); void pol.offsetWidth; pol.classList.add('develop');
    state.savedId = null;
    updateRoll(true);
    go('saved');
  }

  function find(id) {
    var all = U.list();
    for (var i = 0; i < all.length; i++) if (all[i].uploadId === id) return all[i];
    return null;
  }

  var SYNC = {
    processing: ['', null, 'Menyiapkan foto resolusi penuh…'],
    sent: ['is-ok', 'i-check-circle', 'Terkirim ke album'],
    simulated: ['', 'i-info', 'Mode simulasi: foto belum dikirim ke mana pun'],
    sending: ['', null, 'Mengirim ke album…'],
    retrying: ['', 'i-clock', 'Menunggu sinyal. Dikirim otomatis nanti.'],
    failed: ['', 'i-alert', 'Belum terkirim. Buka galeri untuk mencoba lagi.']
  };

  RENDER.saved = function () {
    var item = find(state.savedId), line = $('saved-sync');
    if (!item) {
      line.className = 'sync-line';
      line.innerHTML = '<span class="spinner"></span><span>Menyimpan…</span>';
      return;
    }
    var key = item.status === 'sent' ? (item.simulated ? 'simulated' : 'sent') : (item.status === 'queued' ? 'sending' : item.status);
    var s = SYNC[key] || SYNC.sending;
    line.className = 'sync-line ' + s[0];
    line.innerHTML = (s[1] ? '<svg aria-hidden="true"><use href="#' + s[1] + '"/></svg>' : '<span class="spinner"></span>') + '<span></span>';
    line.lastChild.textContent = s[2];
    $('btn-again').textContent = noFrames() ? 'Lihat semua foto' : 'Ambil foto lagi';
  };

  $('btn-again').addEventListener('click', function () { go(noFrames() ? 'roll' : 'camera'); });

  /* ---------- Simpan ke HP ---------- */
  function fileName(shot) {
    var d = new Date(shot.takenAt), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return 'promnight-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
      p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + (shot.suffix || '') + '.jpg'; // jam lokal HP (WIB)
  }

  function download(shot) {
    var url = URL.createObjectURL(shot.blob), a = document.createElement('a');
    a.href = url; a.download = fileName(shot);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* Satu atau banyak foto: pakai menu Bagikan bawaan HP bila ada (bisa "Simpan Gambar"), selain itu unduh. */
  /* Satu foto bisa punya 2 versi: polaroid (blob) dan tanpa bingkai (blobPlain). Keduanya disimpan. */
  function versions(shots) {
    var out = [];
    shots.forEach(function (s) {
      if (!s || !s.blob) return;
      out.push({ blob: s.blob, takenAt: s.takenAt, suffix: s.blobPlain ? '-polaroid' : '' });
      if (s.blobPlain) out.push({ blob: s.blobPlain, takenAt: s.takenAt, suffix: '' });
    });
    return out;
  }

  function saveToPhone(shots) {
    shots = versions(shots);
    if (!shots.length) return;
    var files = [];
    try { files = shots.map(function (s) { return new File([s.blob], fileName(s), { type: 'image/jpeg' }); }); }
    catch (e) { files = []; }
    if (files.length && navigator.canShare && navigator.canShare({ files: files })) {
      navigator.share({ files: files }).catch(function () {});
      return;
    }
    shots.forEach(function (s, i) { setTimeout(function () { download(s); }, i * 350); });
  }

  /* ---------- Your Roll ---------- */
  function counts() {
    var all = U.list(), sent = 0, failed = 0;
    all.forEach(function (s) { if (s.status === 'sent') sent++; else if (s.status === 'failed') failed++; });
    return { all: all, total: all.length, sent: sent, failed: failed, waiting: all.length - sent - failed };
  }

  var BADGE = { sent: ['is-sent', 'i-check'], failed: ['is-failed', 'i-alert'], waiting: ['is-waiting', 'i-clock'] };

  RENDER.roll = function () {
    var c = counts(), grid = $('roll-grid');
    $('roll-count').textContent = UNLIMITED ? String(c.total) : framesUsed() + ' / ' + CFG.rollSize;
    grid.textContent = '';
    if (!c.total) {
      var empty = document.createElement('li');
      empty.className = 'roll-empty';
      empty.textContent = 'Belum ada foto. Foto yang kamu gunakan akan muncul di sini.';
      grid.appendChild(empty);
    }
    c.all.forEach(function (s, i) {
      var key = s.status === 'sent' || s.status === 'failed' ? s.status : 'waiting';
      var li = document.createElement('li'), btn = document.createElement('button'), img = document.createElement('img');
      li.className = 'roll-item';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Foto ' + (i + 1) + ', ' + { sent: 'terkirim', failed: 'gagal terkirim', waiting: 'menunggu dikirim' }[key]);
      img.src = s.thumb || ''; img.alt = '';
      btn.appendChild(img);
      btn.addEventListener('click', function () { state.photoId = s.uploadId; go('photo'); });
      var badge = document.createElement('span');
      badge.className = 'roll-badge ' + BADGE[key][0];
      badge.innerHTML = '<svg aria-hidden="true"><use href="#' + BADGE[key][1] + '"/></svg>';
      li.appendChild(btn); li.appendChild(badge);
      if (s.mode !== 'acara') {
        var tag = document.createElement('span'); tag.className = 'roll-tag'; tag.textContent = 'Uji coba';
        li.appendChild(tag);
      }
      grid.appendChild(li);
    });
    var left = framesLeft();
    if (!noFrames()) {
      var more = document.createElement('li'), mb = document.createElement('button');
      more.className = 'roll-item roll-more';
      mb.type = 'button';
      mb.innerHTML = '<svg aria-hidden="true"><use href="#i-camera"/></svg><span></span>';
      mb.lastChild.textContent = UNLIMITED ? 'Ambil foto' : '+' + left + ' tersedia';
      mb.addEventListener('click', function () { go('camera'); });
      more.appendChild(mb); grid.appendChild(more);
    }
    var card = $('roll-status'), allSent = c.total > 0 && c.sent === c.total;
    card.classList.toggle('is-pending', !allSent);
    $('roll-status-title').textContent = !c.total ? 'Belum ada foto' : allSent ? 'Semua foto terkirim!' : 'Semua foto tersimpan!';
    var parts = [c.sent + ' foto terkirim'];
    if (c.waiting) parts.push(c.waiting + ' menunggu');
    if (c.failed) parts.push(c.failed + ' gagal');
    $('roll-status-sub').textContent = parts.join(' · ');
  };

  /* ---------- Detail satu foto ---------- */
  function failText(code) {
    var map = {
      CLOSED: 'Album sedang ditutup (di luar jam acara).',
      DISABLED: 'Unggahan sedang dihentikan panitia.',
      INVALID_CODE: 'Kode acara tidak dikenali. Pindai ulang QR resmi acara.',
      TOO_LARGE: 'Ukuran foto terlalu besar.',
      RATE_LIMIT: 'Server sedang ramai.',
      ROLL_FULL: 'Batas foto dari HP ini sudah tercapai.',
      FULL: 'Album panitia sudah penuh.'
    };
    return (map[code] || 'Koneksi internet sedang tidak stabil.') + ' Foto kamu tetap tersimpan di perangkat.';
  }

  function setIcon(svg, id) { svg.querySelector('use').setAttribute('href', '#' + id); }

  RENDER.photo = function () {
    var s = find(state.photoId);
    if (!s) return go('roll');
    var view;
    if (s.status === 'sent') {
      view = ['i-cloud-check', 'Terkirim ke album', s.simulated ? 'Mode simulasi: foto belum dikirim ke mana pun.' : 'Foto ini sudah ada di album panitia.'];
    } else if (s.status === 'failed') {
      view = ['i-wifi-off', 'Tidak dapat mengirim', failText(s.lastError)];
    } else if (s.status === 'sending') {
      view = ['i-cloud-up', 'Sedang dikirim', 'Foto ini sedang dikirim ke album.'];
    } else if (s.status === 'processing') {
      view = ['i-cloud-up', 'Sedang diproses', 'Foto resolusi penuh sedang disiapkan, lalu dikirim otomatis.'];
    } else {
      view = ['i-cloud-up', 'Belum terkirim', 'Foto ini masih menunggu koneksi internet dan akan dikirim otomatis.'];
    }
    setIcon($('photo-icon'), view[0]);
    $('photo-title').textContent = view[1];
    $('photo-text').textContent = view[2];
    $('photo-img').src = s.thumb || '';
    $('btn-photo-retry').hidden = s.status === 'sent' || s.status === 'sending' || s.status === 'processing';
    var taken = new Date(s.takenAt);
    var rows = [
      ['Status', { sent: 'Terkirim', failed: 'Gagal', sending: 'Sedang dikirim', retrying: 'Menunggu sinyal', queued: 'Dalam antrean', processing: 'Diproses' }[s.status] || s.status],
      ['Ukuran', s.width && s.height ? s.width + ' × ' + s.height + ' px' : '–'],
      ['Percobaan kirim', String(s.attempts || 0)],
      ['Diambil', taken.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })],
      ['Gaya film', (P.get(s.preset) || {}).name || s.preset]
    ];
    if (s.lastError && s.status !== 'sent') rows.push(['Kesalahan terakhir', s.lastError]);
    var dl = $('photo-tech'); dl.textContent = '';
    rows.forEach(function (r) {
      var dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = r[0]; dd.textContent = r[1]; dl.appendChild(dt); dl.appendChild(dd);
    });
  };

  $('btn-photo-retry').addEventListener('click', function () { if (state.photoId) U.retry(state.photoId); });
  $('btn-photo-save').addEventListener('click', function () { var s = find(state.photoId); if (s) saveToPhone([s]); });

  /* ---------- Status album ---------- */
  RENDER.album = function () {
    var c = counts(), allSent = c.total > 0 && c.sent === c.total;
    $('album-head').textContent = !c.total ? 'Belum ada foto' : allSent ? 'Tersimpan!' : 'Tersimpan di HP';
    $('album-text').textContent = !c.total ? 'Foto yang kamu ambil akan muncul di sini.'
      : allSent ? 'Foto berhasil dikirim ke album ' + CFG.eventName + '.'
      : 'Foto aman di HP kamu. Sisanya dikirim otomatis saat ada sinyal.';
    $('album-local').textContent = c.total + ' / ' + c.total;
    $('album-sent').textContent = c.sent + ' / ' + c.total;
    $('album-spinner').hidden = allSent || !c.total || c.waiting === 0;
    $('album-sent-ok').style.visibility = allSent ? 'visible' : 'hidden';
    $('btn-album-save').disabled = !c.total;
  };

  $('btn-album-open').addEventListener('click', function () {
    if (CFG.albumUrl) window.open(CFG.albumUrl, '_blank', 'noopener');
    else go('reveal');
  });
  $('btn-album-save').addEventListener('click', function () { saveToPhone(U.list()); });

  /* ---------- Pembaruan status unggah ---------- */
  function updateQueueNote() {
    var c = counts(), note = $('queue-pill');
    if (!c.failed && !c.waiting) { note.hidden = true; return; }
    note.hidden = false;
    note.textContent = c.failed
      ? c.failed + ' foto belum terkirim. Buka galeri untuk mencoba lagi.'
      : c.waiting + (navigator.onLine ? ' foto sedang dikirim di latar belakang.' : ' foto menunggu sinyal.');
  }

  // Siapkan pengolah foto latar (Web Worker) lebih awal agar jepretan pertama tidak menunggu.
  window.addEventListener('load', function () { setTimeout(function () { PIPE.init(); }, 1200); });

  U.onChange(function () {
    updateQueueNote();
    if (RENDER[state.screen] && state.screen !== 'preset') RENDER[state.screen]();
  });

  /* ---------- Cadangan: kamera bawaan HP ---------- */
  $('native-capture').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var img = new Image();
    img.onload = function () {
      var c = U.scaleToCanvas(img, img.naturalWidth, img.naturalHeight, CFG.maxEdge, false, CFG.frameAspect);
      URL.revokeObjectURL(img.src);
      e.target.value = '';
      state.busy = true;
      state.source = 'native';
      startShot(c, null, false, 'kamera-hp ' + img.naturalWidth + 'x' + img.naturalHeight);
    };
    img.onerror = function () { showMessage('File tidak bisa dibuka', '<p>Coba ambil foto lagi.</p>', [backAction]); };
    img.src = URL.createObjectURL(f);
  });

  /* ---------- Pembuka ---------- */
  $('btn-open').addEventListener('click', function () {
    if (inApp) {
      showMessage('Buka di browser',
        '<p>Kamera sering diblokir di dalam aplikasi seperti Instagram atau LINE.</p>' +
        '<ol><li>Ketuk menu <b>⋯</b> di pojok layar.</li><li>Pilih <b>Buka di Chrome</b>, <b>Buka di Safari</b>, atau <b>Open in browser</b>.</li></ol>',
        [{ label: 'Tetap coba di sini', primary: true, onClick: function () { enter(); } }, backAction]);
      return;
    }
    enter();
  });

  function enter() {
    if (phase() === 'before') return go('countdown');
    go(state.joined ? 'hub' : 'presets');
  }

  /* ---------- Beranda tamu ---------- */
  RENDER.hub = function () {
    var c = counts(), left = framesLeft(), ph = phase(), chip = $('hub-chip');
    var look = ph === 'live' ? ['is-live', 'Berlangsung'] : ph === 'after' ? ['is-done', 'Acara selesai'] : ['is-soon', 'Segera dimulai'];
    chip.className = 'status-chip ' + look[0];
    $('hub-chip-text').textContent = look[1];
    $('hub-left').textContent = UNLIMITED ? '∞' : String(left);
    $('hub-shots').textContent = String(c.total);
    $('hub-sent').textContent = String(c.sent);
    $('btn-hub-shoot').disabled = !canShoot() || noFrames();
    $('hub-note').textContent = ph === 'before' && TRIAL ? 'Acara dimulai ' + fmtDate(START) + ' pukul ' + fmtTime(START) + '. Coba kamera sekarang; foto uji coba tidak mengurangi jatah ' + CFG.rollSize + ' frame.'
      : ph === 'after' && TRIAL ? 'Acara sudah selesai. Kamera masih bisa dipakai, tapi foto baru tidak masuk album acara.'
      : ph === 'after' ? 'Kamera sudah ditutup. Roll kamu tetap bisa dibuka dan disimpan.'
      : left === 0 ? 'Roll kamu sudah habis. Terima kasih sudah memotret!'
      : c.waiting ? c.waiting + ' foto menunggu sinyal untuk dikirim.'
      : 'Gaya film: ' + P.get(state.preset).name;
    tickReveal();
  };

  function tickReveal() {
    var left = REVEAL - Date.now(), open = left <= 0;
    var text = open ? 'Album sudah dibuka' : shortLeft(left);
    setText('hub-reveal', text);
    setText('reveal-count', open ? 'Album sudah dibuka' : 'Dibuka dalam ' + shortLeft(left));
  }

  /* ---------- Hitung mundur sebelum acara ---------- */
  RENDER.countdown = function () {
    var p = split(START - Date.now());
    setText('cd-d', pad(p.d)); setText('cd-h', pad(p.h)); setText('cd-m', pad(p.m)); setText('cd-s', pad(p.s));
    if (phase() !== 'before') enter(); // waktunya tiba: kamera terbuka otomatis
  };

  RENDER.reveal = tickReveal;

  /* Detik berjalan hanya untuk layar yang menampilkan waktu. */
  setInterval(function () {
    if (document.hidden) return;
    if (state.screen === 'countdown') RENDER.countdown();
    else if (state.screen === 'hub') RENDER.hub();
    else if (state.screen === 'reveal') tickReveal();
  }, 1000);

  /* Hentikan kamera saat aplikasi ditinggal (hemat baterai), buka lagi saat kembali. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { cancelCountdown(); C.stop(); }
    else if (state.screen === 'camera') openCamera();
  });

  /* ---------- Mulai ---------- */
  setTimer(state.timer);
  buildPresetUI();
  if (BAKED) {
    // Bingkai sudah tercetak di file foto: jangan tambah kertas polaroid lagi di layar.
    document.querySelectorAll('.polaroid-review, .polaroid-saved').forEach(function (f) { f.classList.add('is-baked'); });
  }
  U.init(CFG).then(function () {
    if (U.isSimulation()) $('sim-badge').hidden = false;
    updateQueueNote();
    updateRoll(false);
    if (state.joined && state.screen === 'landing') go(phase() === 'before' ? 'countdown' : 'hub');
  });

  /* Service worker: menyimpan file aplikasi di HP agar bisa dibuka ulang saat sinyal buruk.
   * Hanya di HTTPS / localhost (tidak berlaku saat dibuka sebagai file lokal). */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    // Versi lama di HP tamu otomatis diganti: begitu versi baru aktif, halaman dimuat ulang SEKALI
    // (hanya di layar yang aman; di tengah memotret ditunda sampai tamu kembali ke beranda).
    var hadController = !!navigator.serviceWorker.controller, swReload = false;
    var SAFE = { landing: 1, countdown: 1, hub: 1, presets: 1, preset: 1, help: 1, album: 1, reveal: 1, message: 1 };
    var reloadWhenSafe = function () {
      if (!swReload) return;
      if (SAFE[state.screen] && !state.busy) location.reload();
      else setTimeout(reloadWhenSafe, 1500);
    };
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || swReload) return;
      swReload = true; reloadWhenSafe();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) { if (reg.update) reg.update(); }).catch(function () {});
    });
  }

  // Untuk pengujian otomatis saja (tidak memengaruhi tamu).
  window.__promcam = { state: state, go: go, phase: phase };
})();
