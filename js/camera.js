/* PromCam — camera.js
 * Membuka kamera (getUserMedia), mengganti depan/belakang, dan mengambil frame penuh ke Canvas.
 * Foto diambil dari resolusi asli stream video (videoWidth × videoHeight), BUKAN dari ukuran tampilan di layar.
 */
(function (global) {
  'use strict';

  var video = null, stream = null, facing = 'environment';
  var ic = null, photoCaps = null, stillBusy = false; // ImageCapture yang disiapkan sekali per kamera

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
    stream = null; ic = null; photoCaps = null;
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
      return attach(s).then(function (info) {
        prepareStill();
        if (!global.ImageCapture) upgradeStream(); // mis. Safari iPhone: coba stream 4K bila lebih tajam
        return info;
      });
    }).catch(function (err) {
      err.kind = errorKind(err);
      throw err;
    });
  }

  /* Piksel yang tersisa setelah dipotong ke bingkai potret 3:4. */
  function cropArea(w, h) { var a = 0.75; return w / h > a ? h * h * a : w * w / a; }

  /* Browser tanpa takePhoto (Safari iPhone) hanya memakai stream video. Permintaan 4:3 sering diberi
   * 1440×1920; stream 4K 16:9 dipotong ke 3:4 memberi ±6 MP. Coba 4K, simpan hanya bila lebih tajam. */
  function upgradeStream() {
    var t = videoTrack(), v = video;
    if (!t || !t.applyConstraints || !v || !v.videoWidth) return;
    var before = cropArea(v.videoWidth, v.videoHeight);
    if (before >= 5e6) return;
    var s0 = t.getSettings ? t.getSettings() : {};
    t.applyConstraints({ width: { ideal: 3840 }, height: { ideal: 2160 } }).then(function () {
      return new Promise(function (r) { setTimeout(r, 600); });
    }).then(function () {
      if (videoTrack() !== t) return;
      if (cropArea(v.videoWidth, v.videoHeight) < before && s0.width) {
        return t.applyConstraints({ width: { ideal: s0.width }, height: { ideal: s0.height } });
      }
    }).catch(function () { /* tidak didukung: tetap pakai stream awal */ });
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
    return global.PromUpload.scaleToCanvas(video, video.videoWidth, video.videoHeight, maxEdge, mirror, aspect, true);
  }

  /* ---------- Foto resolusi penuh (ImageCapture.takePhoto, umumnya Chrome Android) ----------
   * Stream video HP biasanya 1–2 MP; takePhoto() memakai sensor penuh (mis. 12 MP).
   * - ImageCapture & kemampuan foto disiapkan SEKALI saat kamera dibuka (bukan setiap jepret).
   * - takePhoto() dimulai TEPAT saat tombol ditekan dan aplikasi menunggunya (tamu diminta menahan HP sebentar),
   *   karena foto yang diambil setelah HP bergerak menjadi blur. Pengolahan berat tetap di latar.
   * - Hasilnya dipakai bila orientasinya sama dengan video dan tidak jauh lebih kecil dari frame video:
   *   foto sensor (dengan pengolahan ISP kamera) jauh lebih tajam daripada frame video beresolusi sama.
   * - Lebar foto dibatasi 4096 px (≈12 MP): sensor 48/50 MP memberi mode binning yang lebih bersih & cepat. */
  var STILL_TIMEOUT_MS = 3000, STILL_MAX_W = 4096, last = { source: 'video', width: 0, height: 0 };

  function prepareStill() {
    ic = null; photoCaps = null;
    var t = videoTrack();
    if (!t || !global.ImageCapture) return;
    try { ic = new global.ImageCapture(t); } catch (e) { ic = null; return; }
    var mine = ic;
    ic.getPhotoCapabilities().then(function (c) { if (ic === mine) photoCaps = c; }, function () { /* tidak didukung */ });
  }

  function takeStill() {
    if (!ic || stillBusy || !global.createImageBitmap) return Promise.resolve(null);
    stillBusy = true;
    var mine = ic, lost = false, max = photoCaps && photoCaps.imageWidth && photoCaps.imageWidth.max;
    var shot = (max ? mine.takePhoto({ imageWidth: Math.min(max, STILL_MAX_W) }) : mine.takePhoto())
      .catch(function () { return mine.takePhoto(); })
      .then(function (blob) { return global.createImageBitmap(blob); })
      .then(function (bmp) { if (lost && bmp.close) { bmp.close(); return null; } return bmp; });
    var timeout = new Promise(function (r) { setTimeout(function () { lost = true; r(null); }, STILL_TIMEOUT_MS); });
    return Promise.race([shot, timeout]).catch(function () { return null; })
      .then(function (v) { stillBusy = false; return v; });
  }

  /* Potongan pusat dengan rasio tertentu. */
  function centerCrop(x, y, w, h, aspect) {
    if (w / h > aspect) { var nw = h * aspect; return { x: x + (w - nw) / 2, y: y, w: nw, h: h }; }
    var nh = w / aspect; return { x: x, y: y + (h - nh) / 2, w: w, h: nh };
  }

  /* Jepret: frame video SEKARANG (cadangan) + foto sensor penuh yang dimulai saat itu juga (bila wantStill).
   * → { frame: canvas, still: Promise<{bitmap, region}|null> }. Region = potongan yang sama dengan bingkai bidik. */
  function grab(maxEdge, mirror, aspect, wantStill) {
    if (!video || !video.videoWidth) throw new Error('Kamera belum siap');
    var vw = video.videoWidth, vh = video.videoHeight;
    var frame = captureFrame(maxEdge, mirror, aspect);
    last = { source: 'video', width: frame.width, height: frame.height };
    var still = !wantStill ? Promise.resolve(null) : takeStill().then(function (bmp) {
      if (!bmp) return null;
      var sameOrientation = (bmp.width >= bmp.height) === (vw >= vh);
      // Samakan sudut pandang dengan pratinjau: potong ke rasio video dulu, lalu ke rasio bingkai.
      var r = centerCrop(0, 0, bmp.width, bmp.height, vw / vh);
      r = centerCrop(r.x, r.y, r.w, r.h, aspect || vw / vh);
      var gain = (Math.min(r.w, maxEdge * r.w / Math.max(r.w, r.h)) * Math.min(r.h, maxEdge * r.h / Math.max(r.w, r.h))) /
                 (frame.width * frame.height);
      if (!sameOrientation || gain < 0.7) { if (bmp.close) bmp.close(); return null; }
      last = { source: 'photo', width: Math.round(r.w), height: Math.round(r.h), sensor: bmp.width + 'x' + bmp.height };
      return { bitmap: bmp, region: r };
    });
    return { frame: frame, still: still };
  }

  global.PromCamera = {
    supported: supported,
    start: start,
    stop: stop,
    flip: flip,
    countCameras: countCameras,
    captureFrame: captureFrame,
    grab: grab,
    lastCapture: function () { return last; },
    streamSize: function () { return video ? { width: video.videoWidth, height: video.videoHeight } : null; },
    hasTorch: hasTorch,
    setTorch: setTorch,
    isActive: function () { return !!stream; },
    facing: function () { return facing; }
  };
})(window);
