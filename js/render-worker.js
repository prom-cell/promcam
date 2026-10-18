/* PromCam — render-worker.js
 * Mengolah foto resolusi penuh di utas terpisah (Web Worker + OffscreenCanvas),
 * agar tombol dan animasi di layar tetap responsif selama 12 MP diproses.
 * Pekerjaan dijalankan satu per satu untuk menghemat memori HP.
 */
/* global PromPresets */
importScripts('presets.js');

(function () {
'use strict';

var fontsOk = null;

function loadFonts() {
  if (fontsOk) return fontsOk;
  if (!self.fonts || typeof FontFace === 'undefined') { fontsOk = Promise.resolve(false); return fontsOk; }
  var base = new URL('../fonts/', self.location.href).href;
  var faces = [
    new FontFace('Caveat', 'url(' + base + 'caveat-latin-500-normal.woff2)', { weight: '500' }),
    new FontFace('Hanken Grotesk', 'url(' + base + 'hanken-grotesk-latin-500-normal.woff2)', { weight: '500' })
  ];
  fontsOk = Promise.all(faces.map(function (f) { return f.load(); })).then(function (loaded) {
    loaded.forEach(function (f) { self.fonts.add(f); });
    return true;
  }).catch(function () { return false; });
  return fontsOk;
}

function canRender() {
  try { return typeof OffscreenCanvas !== 'undefined' && !!new OffscreenCanvas(4, 4).getContext('2d'); }
  catch (e) { return false; }
}

function render(m) {
  var r = m.region, scale = Math.min(1, m.maxEdge / Math.max(r.w, r.h));
  var w = Math.round(r.w * scale), h = Math.round(r.h * scale);
  var c = new OffscreenCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  if (m.mirror) { x.translate(w, 0); x.scale(-1, 1); }
  x.drawImage(m.bitmap, r.x, r.y, r.w, r.h, 0, 0, w, h);
  if (m.bitmap.close) m.bitmap.close();
  if (m.mirror) x.setTransform(1, 0, 0, 1, 0, 0);
  var t0 = performance.now();
  PromPresets.applyToCanvas(c, m.presetId, m.opts);
  var t1 = performance.now();
  // Versi tanpa bingkai disimpan dulu (bila diminta), lalu versi polaroid.
  var both = m.both && m.frame && m.frame.style === 'polaroid';
  var plain = null;
  return (both ? PromPresets.encode(c, m.enc).then(function (p) { plain = p; }) : Promise.resolve()).then(function () {
    return PromPresets.applyFrame(c, m.frame);
  }).then(function (framed) {
    return PromPresets.encode(framed, m.enc);
  }).then(function (res) {
    return { blob: res.blob, width: res.width, height: res.height, quality: res.quality,
             blobPlain: plain ? plain.blob : null, plainWidth: plain ? plain.width : 0, plainHeight: plain ? plain.height : 0,
             photoWidth: w, photoHeight: h, ms: { preset: Math.round(t1 - t0), total: Math.round(performance.now() - t0) } };
  });
}

var chain = Promise.resolve();

self.onmessage = function (e) {
  var m = e.data;
  if (m.type === 'hello') {
    var ok = canRender();
    loadFonts().then(function (f) { self.postMessage({ type: 'hello', offscreen: ok, fonts: f }); });
    return;
  }
  if (m.type === 'render') {
    chain = chain.then(function () {
      return loadFonts().then(function () { return render(m); }).then(function (res) {
        res.type = 'done'; res.id = m.id; res.ok = true;
        self.postMessage(res);
      }, function (err) {
        if (m.bitmap && m.bitmap.close) try { m.bitmap.close(); } catch (x) { /* sudah ditutup */ }
        self.postMessage({ type: 'done', id: m.id, ok: false, error: String(err && err.message || err) });
      });
    });
  }
};
})();
