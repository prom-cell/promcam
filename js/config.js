/* PromCam — config.js
 * Pengaturan yang boleh dilihat publik. JANGAN menaruh kata sandi, token, atau ID folder Drive di sini.
 * Semua teks di layar yang mungkin ingin diubah panitia ada di bagian "Teks".
 */
window.PROMCAM_CONFIG = {
  // ---- Teks ----
  eventName: 'Prom Night 2026',
  invitation: 'You’re invited',
  eventDate: '2 – 3 November 2026',
  tagline: 'Tangkap momen terbaik di malam yang tak terlupakan.',
  closingLine: 'Satu malam. Seribu cerita.',
  polaroidCaption: 'Prom Night 2026 ♡',   // tulisan di polaroid layar (bila bingkai foto 'none')
  thanksLine: 'Terima kasih sudah menjadi bagian dari malam ini ♡',

  // ---- Jadwal (WIB, format waktu lengkap dengan +07:00) ----
  // Sebelum eventStart tamu melihat hitung mundur; kamera terbuka otomatis saat waktunya tiba.
  // Setelah eventEnd kamera ditutup, tetapi roll tamu tetap bisa dibuka dan disimpan.
  // Jendela yang sama juga dicek server di Tahap 4.
  eventStart: '2026-11-02T17:00:00+07:00',
  eventEnd: '2026-11-03T04:00:00+07:00',
  // Reveal: kapan album panitia dibuka untuk tamu. albumUrl diisi panitia setelah kurasi;
  // selama kosong, tombol "Lihat Album" menampilkan layar "Album akan dibuka".
  revealAt: '2026-11-03T12:00:00+07:00',
  albumUrl: '',
  // Mode uji: kamera bisa dipakai di luar jadwal (untuk gladi). WAJIB false sebelum QR dibagikan.
  testMode: true,

  // ---- Gaya film & bingkai ----
  // Gaya yang boleh dipakai tamu, urut tampil. Hapus id untuk menyembunyikan gaya tertentu.
  // party, digicam, y2k, disposable, golden, softglow, dreamy, sunset, nineties, vintage, instant, finefilm, cinema, midnight, vhs, mono, booth, natural
  enabledPresets: ['party', 'digicam', 'y2k', 'disposable', 'golden', 'softglow', 'dreamy', 'sunset', 'nineties', 'vintage', 'instant', 'finefilm', 'cinema', 'midnight', 'vhs', 'mono', 'booth', 'natural'],
  // Bingkai yang ikut tersimpan di file foto: 'polaroid' (kertas putih + tulisan) atau 'none' (foto polos).
  frame: { style: 'polaroid', caption: 'Prom Night 2026', hashtag: '#promnight2026' },

  // Kontak bantuan (opsional). Nomor WhatsApp format internasional tanpa +, contoh '6281234567890'.
  // Kosong = tombol hubungi panitia tidak ditampilkan.
  helpName: '',
  helpWhatsApp: '',

  // ---- Gambar (panitia boleh mengganti file dengan foto asli, nama file sama) ----
  heroImage: 'assets/hero.jpg',      // latar halaman pembuka, potret, ±1080×1920
  sampleImage: 'assets/sample.jpg',  // foto contoh untuk thumbnail preset (foto panitia: potret malam, 960×1280)

  // ---- Server ----
  // URL Web App Apps Script "PromCam Server" (deployment v1, 17 Okt 2026). Kosong = MODE SIMULASI.
  // Kode acara TIDAK ditulis di sini; ia ikut di QR (#k=…) agar tidak tersimpan di repo publik.
  endpoint: 'https://script.google.com/macros/s/AKfycbxVCyKswor57yy4xfZmUlc8RFZFDEH6wOnswVs_kUxu9FFHzognDQbMAeL1y06bpNR3cQ/exec',

  // Kode acara dibaca dari QR: https://…/promcam/#k=KODE (disimpan di HP setelah pemindaian pertama).
  eventCode: (function () {
    var m = location.hash.match(/[#&]k=([A-Za-z0-9_-]{4,40})/);
    try {
      if (m) { localStorage.setItem('promcam.k', m[1]); return m[1]; }
      return localStorage.getItem('promcam.k') || '';
    } catch (e) { return m ? m[1] : ''; }
  })(),

  // ---- Foto ----
  // Disetel untuk kualitas maksimum: Drive panitia 350 GB untuk ±50 tamu, jadi ruang bukan batasan.
  // Batas yang tersisa adalah kuota data & lama unggah di HP tamu (lihat TEST-REPORT.md).
  maxEdge: 4608,             // sisi terpanjang (px) ≈ 16 MP pada 3:4 (HP 12 MP memakai resolusi aslinya). Chrome Android memakai sensor penuh (takePhoto);
                             // browser lain memakai stream video setinggi yang diizinkan kamera.
  frameAspect: 3 / 4,        // bingkai bidik & foto akhir: potret 3:4
  jpegQuality: 0.95,         // kualitas awal (tinggi: detail & grain tetap halus)
  softMaxMB: 10,             // di atas ini dikompres ulang ke jpegQualityFallback
  jpegQualityFallback: 0.9,
  hardMaxMB: 14,             // batas keras (server menerima s.d. 15 MB); di atas ini diperkecil ke shrinkEdge
  shrinkEdge: 4096,

  // Roll: jumlah frame per HP, seperti kamera sekali pakai (0 = tanpa batas).
  // Dihitung saat tamu menekan "Gunakan foto"; Ulangi tidak memakai frame.
  rollSize: 100,

  // Simpan 2 versi tiap foto: dengan bingkai polaroid & tanpa bingkai (dikirim dalam satu unggahan,
  // di Drive masuk subfolder "Polaroid" dan "Tanpa bingkai"). false = hanya versi polaroid.
  saveBothVersions: true,

  // Flash (disetel ulang di Tahap 5 setelah uji di HP). Waktu tunggu agar eksposur kamera menyesuaikan.
  screenFlashMs: 450,   // layar putih untuk kamera depan
  torchFlashMs: 350,    // lampu senter kamera belakang (bila HP mendukung)

  // ---- Unggah ----
  maxAttempts: 5,
  timeoutSec: 45,          // batas waktu dasar; ditambah 10 detik per MB foto (foto besar di sinyal lemah)

  // ---- Fitur ----
  defaultPreset: 'party',
  dateStamp: true,          // cap tanggal pada preset Disposable
  mirrorFrontSaved: false   // false = selfie disimpan tidak terbalik (tulisan terbaca benar)
};
