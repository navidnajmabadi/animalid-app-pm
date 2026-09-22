/**
 * Animal ID — PM Dashboard backend
 * Deploy this as a Web App bound to the "Animal ID App — PM Tasks DB" Google Sheet.
 * Uses ONLY GET requests (list + update) so the browser never triggers a CORS
 * preflight — Apps Script Web Apps don't reliably support that for fetch().
 *
 * Sheet ID is hardcoded below. Tab name is assumed to be "Sheet1" — check yours
 * and adjust SHEET_NAME if different.
 */

const SHEET_ID = '1OcWDNFY3x1x2hDqeJ4LpdizVPg1_i_9Xt22nO1Cn19Y';
const SHEET_NAME = 'Sheet1';

function doGet(e) {
  const action = (e.parameter.action || 'list');
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());

  if (action === 'update') {
    const id = e.parameter.id;
    const status = e.parameter.status;
    const idCol = headers.indexOf('id');
    const statusCol = headers.indexOf('status');
    if (id && status && idCol > -1 && statusCol > -1) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idCol]) === String(id)) {
          sheet.getRange(i + 1, statusCol + 1).setValue(status);
          break;
        }
      }
    }
    return out({ ok: true });
  }

  // default: list all rows as JSON objects
  const rows = data.slice(1)
    .filter(r => r.some(c => c !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
  return out(rows);
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
