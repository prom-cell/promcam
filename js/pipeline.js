/* PromCam — pipeline.js
 * Foto resolusi penuh diolah di LATAR BELAKANG setelah tombol jepret:
 *   - Web Worker + OffscreenCanvas bila tersedia (Chrome Android, Safari 16.4+): layar tetap responsif.
 *   - Selain itu di halaman (cadangan, hasil sama).
 * render(job) → Promise<{blob, width, height, quality, photoWidth, photoHeight, ms, via}>
 * job = { source: ImageBitmap|canvas, region: {x,y,w,h}, maxEdge, mirror, presetId, opts, frame, enc }
 */
(function (global) {
  'use strict';

  var P = global.PromPresets;
  var worker = null, ready = null, seq = 0, waiting = {}, inflight = 0;

  function init() {
    if (ready) return ready;
    ready = new Promise(function (resolve) {
      if (!global.Worker || !global.OffscreenCanvas || !global.createImageBitmap) return resolve(false);
      try { worker = new Worker('js/render-worker.js'); } catch (e) { return resolve(false); }
      var timer = setTimeout(function () { resolve(false); }, 6000);
      worker.onmessage = function (e) {
        var m = e.data;
        if (m.type === 'hello') { clearTimeout(timer); resolve(!!(m.offscreen && m.fonts)); return; }
        var job = waiting[m.id]; if (!job) return;
        delete waiting[m.id];
        if (m.ok) job.resolve(m); else job.reject(new Error(m.error || 'Worker gagal'));
      };
      worker.onerror = function () {
        clearTimeout(timer); resolve(false);
        Object.keys(waiting).forEach(function (id) { waiting[id].reject(new Error('Worker berhenti')); delete waiting[id]; });
      };
      worker.postMessage({ type: 'hello' });
    });
    return ready;
  }

  function viaWorker(job) {
    var src = job.source;
    var bmp = (global.ImageBitmap && src instanceof global.ImageBitmap) ? Promise.resolve(src) : global.createImageBitmap(src);
    return bmp.then(function (bitmap) {
      return new Promise(function (resolve, reject) {
        var id = ++seq;
        waiting[id] = { resolve: resolve, reject: reject };
        worker.postMessage({ type: 'render', id: id, bitmap: bitmap, region: job.region, maxEdge: job.maxEdge, mirror: !!job.mirror,
          presetId: job.presetId, opts: job.opts, frame: job.frame, enc: job.enc, both: !!job.both }, [bitmap]);
      });
    }).then(function (r) { r.via = 'worker'; return r; });
  }

  function onMain(job) {
    var r = job.region, scale = Math.min(1, job.maxEdge / Math.max(r.w, r.h));
    var w = Math.round(r.w * scale), h = Math.round(r.h * scale);
    var c = P.newCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    if (job.mirror) { x.translate(w, 0); x.scale(-1, 1); }
    x.drawImage(job.source, r.x, r.y, r.w, r.h, 0, 0, w, h);
    if (job.mirror) x.setTransform(1, 0, 0, 1, 0, 0);
    if (job.source.close) job.source.close();
    var t0 = Date.now();
    try { P.applyToCanvas(c, job.presetId, job.opts); } catch (e) { /* gagal: foto tetap dipakai apa adanya */ }
    var both = job.both && job.frame && job.frame.style === 'polaroid', plain = null;
    return (both ? P.encode(c, job.enc).then(function (p) { plain = p; }) : Promise.resolve()).then(function () {
      return P.applyFrame(c, job.frame);
    }).then(function (framed) { return P.encode(framed, job.enc); }).then(function (res) {
      return { blob: res.blob, width: res.width, height: res.height, quality: res.quality,
               blobPlain: plain ? plain.blob : null, plainWidth: plain ? plain.width : 0, plainHeight: plain ? plain.height : 0,
               photoWidth: w, photoHeight: h, ms: { total: Date.now() - t0 }, via: 'main' };
    });
  }

  function render(job) {
    inflight++;
    var done = function (v) { inflight--; return v; };
    return init().then(function (ok) {
      if (!ok) return onMain(job);
      return viaWorker(job).catch(function () {
        // Worker gagal (memori, dll.): ulangi di halaman dengan sumber yang masih ada
        if (job.fallback) { job.source = job.fallback.source; job.region = job.fallback.region; job.mirror = false; }
        return onMain(job);
      });
    }).then(done, function (e) { inflight--; throw e; });
  }

  global.PromPipeline = {
    init: init,
    render: render,
    pending: function () { return inflight; }
  };
})(window);
