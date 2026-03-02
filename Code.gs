// ═══════════════════════════════════════════════════════════════
// Google Apps Script - 排程資料寫入 Google Sheet
// 將此程式碼貼入 Apps Script 編輯器（擴充功能 → Apps Script）
// 部署為「網頁應用程式」，執行身分=我，存取=任何人
// ═══════════════════════════════════════════════════════════════

// 允許跨域（CORS）的 GET 回應（用於連線測試）
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Apps Script 連線正常' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// POST 接收排程資料並寫入試算表
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const rows = payload.rows; // [{ a, b, c }, ...]

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return jsonResponse({ success: false, error: '無資料' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const lastRow = sheet.getLastRow();

    // 規則：
    // 1. 從第 2 列開始（第 1 列為標題）
    // 2. 若第 2 列之後有資料，在最後一筆資料下方空一列再寫
    let startRow;
    if (lastRow < 2) {
      // 試算表只有標題或空白
      startRow = 2;
    } else {
      // 找到最後有資料的列，往下空一列
      startRow = lastRow + 2;
    }

    // 最大列數警告（Google Sheet 上限 1,048,576）
    const SHEET_LIMIT = 1048576;
    if (startRow + rows.length - 1 > SHEET_LIMIT) {
      return jsonResponse({
        success: false,
        error: `列數不足：需要到第 ${startRow + rows.length - 1} 列，但試算表上限為 ${SHEET_LIMIT}`,
        rowsNeeded: rows.length,
        startRow: startRow
      });
    }

    // 寫入資料
    rows.forEach((row, i) => {
      const r = startRow + i;
      sheet.getRange(r, 1).setValue(row.a || '');  // A欄：日期時間
      // B欄：若 A 有值則填 O（公式或直接寫）
      if (row.a) sheet.getRange(r, 2).setValue('O');
      sheet.getRange(r, 3).setValue(row.c || '');  // C欄：內容
    });

    return jsonResponse({
      success: true,
      rowsWritten: rows.length,
      startRow: startRow,
      endRow: startRow + rows.length - 1
    });

  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
