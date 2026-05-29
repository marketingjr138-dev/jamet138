/**
 * JAMET138 GUIDE PWA v1.0.0 - Google Apps Script Sync
 * Google Sheet sebagai master konten ringan untuk PWA tutorial member.
 */
const SHEET_NAME = 'CONFIG';
const LOG_SHEET_NAME = 'LOGS';
const DEFAULT_CONFIG = {
  "version": "1.0.0",
  "pin": "7788",
  "brandName": "JAMET138 GUIDE",
  "tagline": "Daftar • Deposit QRIS • Transfer • Withdraw",
  "heroTitle": "Panduan cepat member JAMET138",
  "heroSubtitle": "Tonton video singkat dari HP, ikuti langkahnya, lalu hubungi admin kalau butuh bantuan.",
  "logo": "assets/logo-jamet138.png",
  "banner": "",
  "daftarLink": "#",
  "loginLink": "#",
  "adminLink": "https://cutt.ly/adminresmi",
  "guides": {
    "daftar": [
      "Klik tombol Daftar Sekarang.",
      "Isi username, password, nomor WhatsApp, dan data rekening dengan benar.",
      "Pastikan semua data sesuai, lalu klik daftar.",
      "Setelah akun jadi, login menggunakan username dan password."
    ],
    "deposit": [
      "Login ke akun member.",
      "Pilih menu Deposit.",
      "Pilih metode QRIS atau tujuan pembayaran yang tersedia.",
      "Transfer sesuai nominal yang diminta.",
      "Upload bukti transfer jika diminta, lalu tunggu saldo masuk."
    ],
    "transfer": [
      "Login dan pastikan saldo utama sudah masuk.",
      "Pilih menu Transfer.",
      "Pilih dari Saldo Utama ke provider/game tujuan.",
      "Masukkan nominal transfer.",
      "Klik transfer, lalu buka game tujuan untuk mulai main."
    ],
    "withdraw": [
      "Pastikan saldo sudah berada di saldo utama.",
      "Kalau saldo masih ada di provider/game, transfer balik dulu ke saldo utama.",
      "Pilih menu Withdraw.",
      "Masukkan nominal penarikan sesuai ketentuan.",
      "Pastikan data rekening benar dan sesuai akun.",
      "Submit withdraw, lalu tunggu proses dari sistem/admin."
    ],
    "promo": [
      "Cek promo aktif sebelum deposit.",
      "Baca syarat dan ketentuan promo.",
      "Hubungi admin kalau ingin klaim bonus tertentu.",
      "Pastikan username benar saat klaim promo."
    ]
  },
  "media": {
    "daftar": {
      "image": "assets/tutorial-daftar-placeholder.svg",
      "video": ""
    },
    "deposit": {
      "image": "assets/tutorial-deposit-placeholder.svg",
      "video": ""
    },
    "transfer": {
      "image": "assets/tutorial-transfer-placeholder.svg",
      "video": ""
    },
    "withdraw": {
      "image": "assets/tutorial-withdraw-placeholder.svg",
      "video": ""
    },
    "promo": {
      "image": "assets/tutorial-promo-placeholder.svg",
      "video": ""
    }
  },
  "faq": [
    [
      "Kenapa saldo belum masuk?",
      "Pastikan nominal dan tujuan transfer benar. Kalau masih belum masuk, kirim bukti transfer ke admin."
    ],
    [
      "Bisa deposit pakai QRIS?",
      "Bisa, ikuti panduan Deposit QRIS di halaman ini."
    ],
    [
      "Kenapa saldo belum ada di game?",
      "Saldo biasanya masih di saldo utama. Transfer dulu ke provider/game tujuan."
    ],
    [
      "Bagaimana cara withdraw?",
      "Pastikan saldo ada di saldo utama, lalu masuk menu Withdraw dan ikuti langkah penarikan."
    ],
    [
      "Withdraw pending harus bagaimana?",
      "Cek data rekening dan hubungi admin dengan menyertakan username serta nominal withdraw."
    ],
    [
      "Kalau lupa password bagaimana?",
      "Hubungi admin dan siapkan username atau nomor WhatsApp terdaftar."
    ]
  ]
};

function setupSheet() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  sheet.clear();
  sheet.getRange(1, 1, 1, 3).setValues([['key', 'value', 'note']]);
  sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  const rows = configToRows(DEFAULT_CONFIG);
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  sheet.autoResizeColumns(1, 3);
  let logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) logSheet = ss.insertSheet(LOG_SHEET_NAME);
  if (logSheet.getLastRow() === 0) {
    logSheet.getRange(1, 1, 1, 4).setValues([['time', 'action', 'status', 'detail']]);
    logSheet.getRange(1, 1, 1, 4).setFontWeight('bold');
  }
}

function doGet(e) {
  const action = ((e && e.parameter && e.parameter.action) || 'getConfig').trim();
  if (action === 'getConfig') return jsonResponse({ ok: true, config: getConfigFromSheet() });
  if (action === 'ping') return jsonResponse({ ok: true, message: 'JAMET138 GUIDE GAS Sync aktif', time: new Date().toISOString() });
  return jsonResponse({ ok: false, error: 'Unknown action' });
}

function doPost(e) {
  try {
    const body = parseRequestBody_(e);
    if (body.action === 'uploadFile') {
      const uploaded = uploadFileToDrive(body);
      logAction('uploadFile', 'ok', uploaded.name || 'uploaded');
      return jsonResponse({ ok: true, file: uploaded, url: uploaded.url, displayUrl: uploaded.displayUrl, previewUrl: uploaded.previewUrl, downloadUrl: uploaded.downloadUrl });
    }

    if (body.action === 'saveConfig') {
      saveConfigToSheet(body.config || {});
      logAction('saveConfig', 'ok', 'Config updated from PWA v1.0.1');
      return jsonResponse({ ok: true, message: 'Config saved' });
    }
    logAction('doPost', 'error', 'Unknown action: ' + (body.action || 'empty'));
    return jsonResponse({ ok: false, error: 'Unknown action' });
  } catch (err) {
    logAction('doPost', 'error', String(err));
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function parseRequestBody_(e) {
  const raw = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : '';

  // Normal fetch POST: text/plain JSON
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (err) {}
  }

  // Browser form/iframe fallback: payload=<JSON>
  if (e && e.parameter && e.parameter.payload) {
    try {
      return JSON.parse(e.parameter.payload);
    } catch (err) {
      throw new Error('Payload form tidak valid: ' + err);
    }
  }

  // Simple form fallback: action=saveConfig&config=<JSON>
  if (e && e.parameter && e.parameter.action) {
    const body = { action: e.parameter.action };
    if (e.parameter.config) {
      try {
        body.config = JSON.parse(e.parameter.config);
      } catch (err) {
        body.config = {};
      }
    }
    return body;
  }

  return {};
}

function getConfigFromSheet() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    setupSheet();
    sheet = ss.getSheetByName(SHEET_NAME);
  }
  const values = sheet.getDataRange().getValues();
  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || '').trim();
    const raw = values[i][1];
    if (!key) continue;
    if (key === 'guides' || key === 'faq' || key === 'media') {
      try {
        config[key] = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (err) {
        config[key] = DEFAULT_CONFIG[key];
      }
    } else {
      config[key] = raw;
    }
  }
  config.updatedAt = new Date().toISOString();
  return config;
}

function saveConfigToSheet(config) {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    setupSheet();
    sheet = ss.getSheetByName(SHEET_NAME);
  }
  const merged = Object.assign({}, DEFAULT_CONFIG, config || {});
  merged.guides = Object.assign({}, DEFAULT_CONFIG.guides, (config && config.guides) || {});
  merged.media = Object.assign({}, DEFAULT_CONFIG.media, (config && config.media) || {});
  merged.faq = (config && config.faq) || DEFAULT_CONFIG.faq;
  const rows = configToRows(merged);
  sheet.clear();
  sheet.getRange(1, 1, 1, 3).setValues([['key', 'value', 'note']]);
  sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  sheet.autoResizeColumns(1, 3);
}

function configToRows(config) {
  return [
    ['version', config.version || '2.0.0', 'versi config'],
    ['pin', config.pin || '7788', 'PIN admin PWA'],
    ['brandName', config.brandName || '', 'nama brand'],
    ['tagline', config.tagline || '', 'tagline kecil'],
    ['heroTitle', config.heroTitle || '', 'judul utama'],
    ['heroSubtitle', config.heroSubtitle || '', 'subjudul utama'],
    ['logo', config.logo || '', 'URL/path logo'],
    ['banner', config.banner || '', 'URL/path banner'],
    ['daftarLink', config.daftarLink || '', 'link daftar'],
    ['loginLink', config.loginLink || '', 'link login'],
    ['adminLink', config.adminLink || '', 'link chat admin/cutt.ly'],
    ['guides', JSON.stringify(config.guides || DEFAULT_CONFIG.guides), 'JSON panduan: daftar, deposit, transfer, withdraw, promo'],
    ['media', JSON.stringify(config.media || DEFAULT_CONFIG.media), 'JSON media 9:16: image/video per menu. Gunakan URL MP4 direct, bukan YouTube page.'],
    ['faq', JSON.stringify(config.faq || DEFAULT_CONFIG.faq), 'JSON FAQ']
  ];
}


function uploadFileToDrive(body) {
  if (!body || !body.base64) throw new Error('No file data');

  const folder = getOrCreateMediaFolder_(body.folderTag || 'media');
  const bytes = Utilities.base64Decode(body.base64);
  const safeName = sanitizeFileName_((body.fileName || 'upload-file').toString());
  const mimeType = body.mimeType || 'application/octet-stream';
  const blob = Utilities.newBlob(bytes, mimeType, safeName);
  const file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {}

  const id = file.getId();
  const isImage = String(mimeType).indexOf('image/') === 0;
  const downloadUrl = 'https://drive.google.com/uc?export=download&id=' + id;
  const thumbnailUrl = 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600';
  const lh3Url = 'https://lh3.googleusercontent.com/d/' + id + '=w1600';

  return {
    id: id,
    name: file.getName(),
    mimeType: mimeType,
    url: isImage ? lh3Url : downloadUrl,
    displayUrl: isImage ? lh3Url : downloadUrl,
    thumbnailUrl: thumbnailUrl,
    downloadUrl: downloadUrl,
    viewUrl: file.getUrl(),
    previewUrl: 'https://drive.google.com/file/d/' + id + '/preview'
  };
}

function getOrCreateMediaFolder_(tag) {
  const rootName = 'JAMET138_GUIDE_MEDIA';
  const rootFolders = DriveApp.getFoldersByName(rootName);
  const root = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder(rootName);

  const cleanTag = sanitizeFileName_(tag || 'media');
  const subFolders = root.getFoldersByName(cleanTag);
  return subFolders.hasNext() ? subFolders.next() : root.createFolder(cleanTag);
}

function sanitizeFileName_(name) {
  return String(name || 'file')
    .replace(/[\\/:*?"<>|#%{}~&]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 120);
}

function logAction(action, status, detail) {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(LOG_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 4).setValues([['time', 'action', 'status', 'detail']]);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
  }
  sheet.appendRow([new Date(), action, status, detail]);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
