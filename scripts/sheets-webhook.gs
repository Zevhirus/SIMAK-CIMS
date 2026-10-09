// ============================================================
// Webhook Google Sheets — SIMAK CIMS (Pemeliharaan)
// Cara pakai:
//  1. Buka Google Sheet kamu -> Extensions -> Apps Script
//  2. Hapus semua kode lama, paste file ini
//  3. Ganti SPREADSHEET_ID & SHEET_NAME di bawah
//  4. Save -> Deploy -> New deployment -> Web app
//     (Execute as: Me, Who has access: Anyone)
//  5. Copy URL /exec -> tempel ke .env sebagai VITE_SHEET_URL
// ============================================================

var SPREADSHEET_ID = '19J8SfbIZcdsXqh8aM4RZb4BwBH5TFm29jjsTpjaeLkE';
var SHEET_NAME = 'Laporan'; // nama tab sheet (dibuat otomatis kalau belum ada)

var HEADERS = ['ID', 'Tanggal', 'Lantai', 'Area', 'Uraian', 'Kondisi', 'Pelapor', 'Status', 'Foto', 'Catatan Admin', 'Foto Bukti'];

function doGet() {
  return ContentService.createTextOutput('Webhook aktif');
}

function doPost(e) {
  try {
    if (!e || !e.postData) {
      return out_('ERROR: Tidak ada data POST. Jangan jalankan dari tombol Run.');
    }
    var d = JSON.parse(e.postData.contents);
    var sheet = getSheet_();
    var row = findById_(sheet, d.id);

    // Hapus laporan
    if (d.hapus === true) {
      if (row > 0) sheet.deleteRow(row);
      return out_('OK - dihapus');
    }

    // Update laporan yang sudah ada (status / catatan / foto bukti)
    if (row > 0) {
      if (d.status) sheet.getRange(row, 8).setValue(d.status);
      if (d.catatan !== undefined) sheet.getRange(row, 10).setValue(d.catatan);
      if (d.foto_bukti) sheet.getRange(row, 11).setValue(d.foto_bukti);
      return out_('OK - diupdate');
    }

    // Laporan baru
    sheet.appendRow([
      String(d.id || ''),
      d.tanggal || '',
      d.lantai || '',
      d.area || '',
      d.uraian || '',
      d.kondisi || '',
      d.pelapor || '',
      d.status || '',
      d.foto || '',
      '',
      ''
    ]);
    return out_('OK - ditambah');
  } catch (err) {
    return out_('ERROR: ' + err.message);
  }
}

function out_(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}

function getSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findById_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2 || !id) return -1;
  var col = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0]) === String(id)) return i + 2;
  }
  return -1;
}
