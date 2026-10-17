/* PromCam — upload.js
 * Kompresi foto, roll tamu + antrean unggah yang tahan putus koneksi (IndexedDB), retry, dan mode simulasi.
 *
 * Mode simulasi aktif jika PROMCAM_CONFIG.endpoint kosong: tidak ada data yang dikirim ke mana pun.
 * Uji gagal-koneksi di mode simulasi: tambahkan ?simfail=0.5 di URL (50% percobaan gagal).
 */
(function (global) {
  'use strict';

  var MB = 1024 * 1024;
  var NON_RETRYABLE = { BAD_REQUEST: 1, TOO_LARGE: 1, NOT_JPEG: 1, INVALID_CODE: 1, CLOSED: 1, DISABLED: 1, BAD_PRESET: 1, ROLL_FULL: 1, FULL: 1 };

  /* ---------- Kompresi ---------- */

  /* Menggambar sumber (video/gambar/canvas) ke canvas baru, sisi terpanjang <= maxEdge.
   * aspect (lebar/tinggi, opsional): potong bagian tengah agar sama dengan bingkai bidik di layar,
   * sehingga foto akhir = apa yang terlihat saat membidik. */
  function scaleToCanvas(source, srcW, srcH, maxEdge, mirror, aspect) {
    var sx = 0, sy = 0, sw = srcW, sh = srcH;
    if (aspect) {
      if (srcW / srcH > aspect) { sw = Math.round(srcH * aspect); sx = Math.round((srcW - sw) / 2); }
      else { sh = Math.round(srcW / aspect); sy = Math.round((srcH - sh) / 2); }
    }
    var scale = Math.min(1, maxEdge / Math.max(sw, sh));
    var w = Math.round(sw * scale), h = Math.round(sh * scale);
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
    return c;
  }

  function toBlob(canvas, q) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('Gagal membuat JPEG')); }, 'image/jpeg', q);
    });
  }

  /* Kompresi bertahap (semua angka dari config.js):
   *   1. kualitas jpegQuality (default 0,92)
   *   2. jika > softMaxMB: kualitas jpegQualityFallback (default 0,85)
   *   3. jika masih > hardMaxMB: perkecil ke shrinkEdge px (default 3000) pada kualitas fallback
   *   4. jika masih > hardMaxMB: tolak (foto tetap bisa diambil ulang) */
  function encode(canvas, cfg) {
    cfg = cfg || global.PROMCAM_CONFIG || {};
    var softMax = (cfg.softMaxMB || 6) * MB, hardMax = (cfg.hardMaxMB || 10) * MB;
    var q1 = cfg.jpegQuality || 0.92, q2 = cfg.jpegQualityFallback || 0.85, shrink = cfg.shrinkEdge || 3000;
    return toBlob(canvas, q1).then(function (b) {
      if (b.size <= softMax) return { blob: b, quality: q1, canvas: canvas };
      return toBlob(canvas, q2).then(function (b2) {
        if (b2.size <= hardMax) return { blob: b2, quality: q2, canvas: canvas };
        var small = scaleToCanvas(canvas, canvas.width, canvas.height, shrink);
        return toBlob(small, q2).then(function (b3) {
          if (b3.size > hardMax) throw new Error('Foto terlalu besar setelah dikompres');
          return { blob: b3, quality: q2, canvas: small };
        });
      });
    }).then(function (r) {
      r.width = r.canvas.width; r.height = r.canvas.height;
      return r;
    });
  }

  /* ---------- ID ---------- */

  function randomId(len) {
    var chars = 'abcdefghijkmnpqrstuvwxyz23456789', out = '';
    var buf = new Uint8Array(len);
    (global.crypto || global.msCrypto).getRandomValues(buf);
    for (var i = 0; i < len; i++) out += chars[buf[i] % chars.length];
    return out;
  }

  function uuid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return randomId(8) + '-' + randomId(4) + '-' + randomId(4) + '-' + randomId(12);
  }

  function deviceId() {
    try {
      var id = localStorage.getItem('promcam.device');
      if (!id) { id = randomId(16); localStorage.setItem('promcam.device', id); }
      return id;
    } catch (e) { return 'nostorage-' + randomId(8); }
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(',')[1]); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsDataURL(blob);
    });
  }

  /* ---------- Roll tamu (IndexedDB, cadangan: memori) ----------
   * Satu catatan per foto yang dipakai ("Use Photo"). Foto TETAP disimpan setelah terkirim,
   * agar tamu bisa melihat dan menyimpan roll-nya sendiri (layar "Rollmu"). */

  var db = null, memory = {};

  function openDB() {
    return new Promise(function (resolve) {
      if (!global.indexedDB) return resolve(null);
      var req;
      try { req = indexedDB.open('promcam', 2); } catch (e) { return resolve(null); }
      req.onupgradeneeded = function () {
        var d = req.result;
        if (d.objectStoreNames.contains('queue')) d.deleteObjectStore('queue'); // skema v1 (belum pernah dirilis)
        if (!d.objectStoreNames.contains('shots')) d.createObjectStore('shots', { keyPath: 'uploadId' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
    });
  }

  function store(mode, fn) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('shots', mode), s = tx.objectStore('shots'), out;
      out = fn(s);
      tx.oncomplete = function () { resolve(out && out.result); };
      tx.onerror = function () { reject(tx.error); };
    });
  }

  function save(item) {
    memory[item.uploadId] = item;
    if (!db) return Promise.resolve();
    return store('readwrite', function (s) { return s.put(item); }).catch(function () {});
  }

  function loadAll() {
    if (!db) return Promise.resolve([]);
    return store('readonly', function (s) { return s.getAll(); }).catch(function () { return []; });
  }

  /* ---------- Pengiriman ---------- */

  var cfg = {}, listeners = [], sending = false, timer = null;

  function emit(item) { listeners.forEach(function (fn) { try { fn(item); } catch (e) {} }); }

  function simulate() {
    var failRate = parseFloat((location.search.match(/simfail=([\d.]+)/) || [])[1] || '0');
    var delay = 500 + Math.random() * 900;
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        if (!navigator.onLine) return reject(new Error('offline'));
        if (Math.random() < failRate) return reject(new Error('simulasi gagal jaringan'));
        resolve({ ok: true, ref: randomId(8), simulated: true });
      }, delay);
    });
  }

  function post(item) {
    if (!cfg.endpoint) return simulate();
    return blobToBase64(item.blob).then(function (data) {
      var body = JSON.stringify({
        v: 1, k: cfg.eventCode || '', uploadId: item.uploadId, deviceId: deviceId(),
        preset: item.preset, takenAt: item.takenAt, w: item.width, h: item.height, data: data
      });
      var ctrl = global.AbortController ? new AbortController() : null;
      var limitMs = (cfg.timeoutSec || 45) * 1000 + Math.ceil(item.blob.size / MB) * 10000;
      var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, limitMs);
      // text/plain = permintaan "sederhana" (tanpa preflight CORS). Jangan tambahkan header lain.
      return fetch(cfg.endpoint, {
        method: 'POST', body: body, redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        clearTimeout(to);
        if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { retry: true });
        return res.json();
      }, function (err) { clearTimeout(to); throw err; });
    }).then(function (json) {
      if (json && json.ok) return json;
      var code = (json && json.code) || 'UNKNOWN';
      throw Object.assign(new Error(code), { code: code, retry: !NON_RETRYABLE[code] });
    });
  }

  function backoff(attempt) {
    var base = [2, 4, 8, 16, 32][Math.min(attempt - 1, 4)] * 1000;
    return base + Math.random() * 1500; // jeda acak agar tidak serentak
  }

  function nextDue() {
    var now = Date.now();
    var due = list().filter(function (it) { return it.status === 'queued' || it.status === 'retrying'; });
    for (var i = 0; i < due.length; i++) if ((due[i].nextAt || 0) <= now) return due[i];
    var waits = due.map(function (it) { return it.nextAt - now; });
    return waits.length ? Math.max(500, Math.min.apply(null, waits)) : null;
  }

  function pump() {
    if (sending) return;
    clearTimeout(timer);
    var due = nextDue();
    if (due === null) return;
    if (typeof due === 'number') { timer = setTimeout(pump, due); return; }
    if (!navigator.onLine) { due.status = 'retrying'; due.lastError = 'offline'; emit(due); return; } // lanjut saat 'online'
    var item = due;
    sending = true;
    item.status = 'sending'; item.attempts = (item.attempts || 0) + 1; emit(item);
    post(item).then(function (res) {
      item.status = 'sent'; item.ref = res.ref; item.simulated = !!res.simulated; item.sentAt = Date.now();
      return save(item).then(function () { emit(item); });
    }, function (err) {
      var retryable = err.retry !== false;
      item.lastError = err.code || err.message || String(err);
      if (retryable && item.attempts < (cfg.maxAttempts || 5)) {
        item.status = 'retrying'; item.nextAt = Date.now() + backoff(item.attempts);
      } else {
        item.status = 'failed';
      }
      return save(item).then(function () { emit(item); });
    }).then(function () { sending = false; pump(); });
  }

  function enqueue(data) {
    var item = {
      uploadId: uuid(), blob: data.blob, thumb: data.thumb || '', preset: data.preset,
      takenAt: data.takenAt || new Date().toISOString(),
      width: data.width, height: data.height, status: 'queued', attempts: 0, createdAt: Date.now(), nextAt: 0
    };
    return save(item).then(function () { emit(item); pump(); return item; });
  }

  /* Coba lagi item yang gagal permanen (mis. tamu menekan "Coba kirim lagi"). */
  function retry(id) {
    var it = memory[id];
    if (!it) return;
    it.status = 'queued'; it.attempts = 0; it.nextAt = 0;
    save(it).then(function () { emit(it); pump(); });
  }

  /* Semua foto di roll, terlama lebih dulu. */
  function list() {
    return Object.keys(memory).map(function (k) { return memory[k]; })
      .sort(function (a, b) { return a.createdAt - b.createdAt; });
  }

  function pending() {
    return list().filter(function (it) { return it.status !== 'sent'; });
  }

  function init(config) {
    cfg = config || {};
    global.addEventListener('online', function () {
      Object.keys(memory).forEach(function (k) { if (memory[k].status === 'retrying') memory[k].nextAt = 0; });
      pump();
    });
    return openDB().then(function (d) {
      db = d;
      return loadAll();
    }).then(function (items) {
      (items || []).forEach(function (it) {
        if (it.status === 'sending') it.status = 'retrying';
        it.nextAt = 0; memory[it.uploadId] = it;
      });
      // Minta browser tidak menghapus roll saat ruang penyimpanan HP menipis (bila didukung).
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      pump();
      return { persistent: !!db, restored: (items || []).length };
    });
  }

  global.PromUpload = {
    scaleToCanvas: scaleToCanvas,
    encode: encode,
    init: init,
    enqueue: enqueue,
    retry: retry,
    list: list,
    pending: pending,
    onChange: function (fn) { listeners.push(fn); },
    isSimulation: function () { return !cfg.endpoint; },
    randomId: randomId
  };
})(window);
