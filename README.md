# JAMET138 Guide PWA v1.0.0

Clone dari mesin final JAMET Guide v2.0.0, direbrand menjadi JAMET138 Guide tanpa membangun ulang logic inti.

## Yang dipertahankan
- PWA install
- Admin private lewat tombol `© 2026`
- PIN admin lokal
- Google Sheet sync + Apps Script flow
- Multi-device sync
- Static video assets di `assets/videos/`
- Video preload
- Native video player
- Siap deploy Cloudflare Pages / GitHub

## Yang sudah diubah
- Brand name: `JAMET138 GUIDE`
- Logo/favicon/icon memakai logo JAMET138
- Tone UI dominan hijau, putih, orange, dengan hitam tipis untuk depth
- Background dark street premium
- Copy default disesuaikan JAMET138
- `gasApiUrl` dan `window.GAS_API_URL` dikosongkan agar tidak tersambung ke Sheet JAMET138

## Struktur penting
- `index.html` — halaman utama PWA
- `style.css` — tema dan layout
- `app.js` — logic utama/admin/sync/video
- `config.js` dan `config.json` — config default JAMET138
- `google-apps-script-v1.0.0.gs` — script Google Apps Script untuk sync baru
- `assets/videos/` — video tutorial statis, struktur tetap dipertahankan

## Catatan deploy
Upload semua isi folder ini ke repository GitHub/Cloudflare Pages. Jangan upload ZIP-nya langsung sebagai file website; ekstrak dulu atau push isi project.
