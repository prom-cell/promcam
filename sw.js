/* PromCam — sw.js
 * Menyimpan file aplikasi di HP agar halaman tetap bisa dibuka ulang saat sinyal di venue buruk.
 * Strategi "stale-while-revalidate": tampilkan salinan tersimpan seketika, lalu perbarui di latar belakang.
 * Akibatnya, perubahan kode baru terlihat pada kunjungan BERIKUTNYA (cukup muat ulang sekali).
 *
 * Hanya file milik situs ini yang disimpan. Unggahan ke Apps Script (domain lain, POST) tidak disentuh.
 */
(function () {
'use strict';

var CACHE = 'promcam-shell-v8';
var SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/config.js',
  'js/presets.js',
  'js/upload.js',
  'js/camera.js',
  'js/pipeline.js',
  'js/render-worker.js',
  'js/app.js',
  'assets/hero.jpg',
  'assets/sample.jpg',
  'fonts/bodoni-moda-latin-400-normal.woff2',
  'fonts/bodoni-moda-latin-400-italic.woff2',
  'fonts/bodoni-moda-latin-500-normal.woff2',
  'fonts/hanken-grotesk-latin-400-normal.woff2',
  'fonts/hanken-grotesk-latin-500-normal.woff2',
  'fonts/hanken-grotesk-latin-600-normal.woff2',
  'fonts/caveat-latin-500-normal.woff2'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(function (cache) {
    // ignoreSearch: '/?simfail=1' dan '/#k=…' tetap memakai index.html yang tersimpan.
    return cache.match(req, { ignoreSearch: true }).then(function (cached) {
      var fresh = fetch(req).then(function (res) {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(function () { return cached; });
      return cached || fresh;
    });
  }));
});
})();
