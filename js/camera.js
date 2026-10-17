/* PromCam — camera.js
 * Membuka kamera (getUserMedia), mengganti depan/belakang, dan mengambil frame penuh ke Canvas.
 * Foto diambil dari resolusi asli stream video (videoWidth × videoHeight), BUKAN dari ukuran tampilan di layar.
 */
(function (global) {
  'use strict';

  var video = null, stream = null, facing = 'environment';

  function supported() {
    return !!(global.isSecureContext !== false && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function errorKind(err) {
    var n = err && err.name;
    if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'denied';
    if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return 'nocamera';
    if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') return 'busy';
    return 'unknown';
  }

  /* ---------- Layar tetap menyala selama kamera terbuka (Screen Wake Lock) ---------- */
  var wakeLock = null;

  function keepAwake() {
    if (!navigator.wakeLock || wakeLock) return;
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock;
      lock.addEventListener('release', function () { wakeLock = null; });
    }, function () { /* ditolak (mis. hemat baterai): abaikan */ });
  }

  function releaseAwake() {
    if (wakeLock) wakeLock.release().catch(function () {});
    wakeLock = null;
  }

  function stop() {
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null;
    if (video) video.srcObject = null;
    releaseAwake();
  }

  /* ---------- Lampu senter sebagai flash (umumnya Chrome Android, kamera belakang) ---------- */
  function videoTrack() { return stream ? stream.getVideoTracks()[0] : null; }

  function hasTorch() {
    var t = videoTrack();
    if (!t || !t.getCapabilities) return false;
    try { return !!t.getCapabilities().torch; } catch (e) { return false; }
  }

  function setTorch(on) {
    var t = videoTrack();
    if (!t || !hasTorch()) return Promise.resolve(false);
    return t.applyConstraints({ advanced: [{ torch: !!on }] }).then(function () { return true; }, function () { return false; });
  }

  function attach(s) {
    stream = s;
    video.srcObject = s;
    return new Promise(function (resolve, reject) {
      var done = false;
      function ok() {
        if (done) return; done = true;
        var p = video.play();
        (p && p.then ? p : Promise.resolve()).then(function () {
          resolve({ facing: facing, width: video.videoWidth, height: video.videoHeight });
        }, function () { resolve({ facing: facing, width: video.videoWidth, height: video.videoHeight }); });
      }
      keepAwake();
      if (video.readyState >= 1 && video.videoWidth) ok();
      else video.addEventListener('loadedmetadata', ok, { once: true });
      setTimeout(function () {
        if (!done) { done = true; reject(Object.assign(new Error('Kamera tidak merespons'), { name: 'AbortError' })); }
      }, 10000);
    });
  }

  /* Membuka kamera. 'ideal' (bukan 'exact') agar HP yang tidak mengenali facingMode tetap dapat kamera. */
  function start(videoEl, wantFacing) {
    video = videoEl;
    facing = wantFacing || facing;
    stop();
    var constraints = {
      audio: false,
      // Minta resolusi setinggi mungkin (4:3 seperti mode foto). Browser memilih yang terdekat yang didukung kamera.
      video: { facingMode: { ideal: facing }, width: { ideal: 4096 }, height: { ideal: 3072 } }
    };
    return navigator.mediaDevices.getUserMedia(constraints).catch(function (err) {
      // Sebagian perangkat menolak permintaan resolusi; coba lagi dengan permintaan paling sederhana.
      if (err && err.name === 'OverconstrainedError') return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      throw err;
    }).then(function (s) {
      var track = s.getVideoTracks()[0];
      var settings = track && track.getSettings ? track.getSettings() : {};
      if (settings.facingMode) facing = settings.facingMode === 'user' ? 'user' : 'environment';
      return attach(s);
    }).catch(function (err) {
      err.kind = errorKind(err);
      throw err;
    });
  }

  function countCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return Promise.resolve(1);
    return navigator.mediaDevices.enumerateDevices().then(function (list) {
      return list.filter(function (d) { return d.kind === 'videoinput'; }).length;
    }, function () { return 1; });
  }

  /* Ganti kamera; jika gagal, kembali ke kamera sebelumnya. */
  function flip() {
    var prev = facing;
    var next = facing === 'user' ? 'environment' : 'user';
    return start(video, next).catch(function (err) {
      return start(video, prev).then(function (info) { info.flipFailed = true; info.error = err; return info; });
    });
  }

  /* Mengambil frame dari stream (resolusi asli), dipotong sesuai bingkai bidik. mirror=true membalik horizontal file akhir. */
  function captureFrame(maxEdge, mirror, aspect) {
    if (!video || !video.videoWidth) throw new Error('Kamera belum siap');
    return global.PromUpload.scaleToCanvas(video, video.videoWidth, video.videoHeight, maxEdge, mirror, aspect);
  }

  /* ---------- Foto resolusi penuh (ImageCapture.takePhoto, umumnya Chrome Android) ----------
   * Stream video HP biasanya 1–2 MP; takePhoto() memakai sensor penuh (mis. 12 MP).
   * Hasilnya dipakai hanya bila (a) orientasinya sama dengan video dan (b) lebih besar dari frame video.
   * Selain itu, atau bila lebih dari STILL_TIMEOUT_MS, dipakai frame video yang sudah diambil saat tombol ditekan. */
  var STILL_TIMEOUT_MS = 4000, STILL_MAX_W = 4096, last = { source: 'video', width: 0, height: 0 };

  function takeStill() {
    var t = videoTrack();
    if (!t || !global.ImageCapture || !global.createImageBitmap) return Promise.resolve(null);
    var ic, lost = false;
    try { ic = new global.ImageCapture(t); } catch (e) { return Promise.resolve(null); }
    var job = ic.getPhotoCapabilities().then(function (caps) {
      var max = caps && caps.imageWidth && caps.imageWidth.max;
      // Batasi ±12 MP agar HP kelas menengah tidak kehabisan memori pada sensor 50 MP.
      return max ? ic.takePhoto({ imageWidth: Math.min(max, STILL_MAX_W) }).catch(function () { return ic.takePhoto(); }) : ic.takePhoto();
    }).then(function (blob) {
      return global.createImageBitmap(blob);
    }).then(function (bmp) {
      if (lost && bmp.close) { bmp.close(); return null; }
      return bmp;
    });
    var timeout = new Promise(function (r) { setTimeout(function () { lost = true; r(null); }, STILL_TIMEOUT_MS); });
    return Promise.race([job, timeout]).catch(function () { return null; });
  }

  /* Potongan pusat dengan rasio tertentu. */
  function centerCrop(x, y, w, h, aspect) {
    if (w / h > aspect) { var nw = h * aspect; return { x: x + (w - nw) / 2, y: y, w: nw, h: h }; }
    var nh = w / aspect; return { x: x, y: y + (h - nh) / 2, w: w, h: nh };
  }

  function drawRegion(src, r, maxEdge, mirror) {
    var scale = Math.min(1, maxEdge / Math.max(r.w, r.h));
    var c = document.createElement('canvas');
    c.width = Math.round(r.w * scale); c.height = Math.round(r.h * scale);
    var ctx = c.getContext('2d', { willReadFrequently: true });
    if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
    return c;
  }

  /* Ambil foto terbaik yang tersedia → Promise<canvas>, dipotong persis seperti bingkai bidik. */
  function capture(maxEdge, mirror, aspect) {
    if (!video || !video.videoWidth) return Promise.reject(new Error('Kamera belum siap'));
    var vw = video.videoWidth, vh = video.videoHeight;
    var frame = captureFrame(maxEdge, mirror, aspect); // momen tombol ditekan; cadangan
    last = { source: 'video', width: frame.width, height: frame.height };
    return takeStill().then(function (bmp) {
      if (!bmp) return frame;
      var sameOrientation = (bmp.width >= bmp.height) === (vw >= vh);
      // Samakan sudut pandang dengan pratinjau: potong foto ke rasio video dulu, lalu ke rasio bingkai.
      var r = centerCrop(0, 0, bmp.width, bmp.height, vw / vh);
      r = centerCrop(r.x, r.y, r.w, r.h, aspect || vw / vh);
      var gain = (r.w * r.h) / (frame.width * frame.height);
      if (!sameOrientation || gain < 1.2) { if (bmp.close) bmp.close(); return frame; }
      var c = drawRegion(bmp, r, maxEdge, mirror);
      if (bmp.close) bmp.close();
      last = { source: 'photo', width: c.width, height: c.height };
      return c;
    });
  }

  global.PromCamera = {
    supported: supported,
    start: start,
    stop: stop,
    flip: flip,
    countCameras: countCameras,
    captureFrame: captureFrame,
    capture: capture,
    lastCapture: function () { return last; },
    streamSize: function () { return video ? { width: video.videoWidth, height: video.videoHeight } : null; },
    hasTorch: hasTorch,
    setTorch: setTorch,
    isActive: function () { return !!stream; },
    facing: function () { return facing; }
  };
})(window);
