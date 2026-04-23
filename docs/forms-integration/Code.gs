/**
 * VaxAI Vision — Forms Intake Apps Script
 * -----------------------------------------
 * Receives submissions from:
 *   - Contact Us form   (src/components/contact/form.tsx)
 *   - Join Waitlist form (src/components/waitlist/form.tsx)
 *
 * Writes each row to the bound spreadsheet:
 *   https://docs.google.com/spreadsheets/d/1t0v1ABeqNZe26lCNlbxcOKDeBsW7Fu5dFgxpNIJWcfM
 *
 * Deploy as Web App: Execute as "Me", Who has access: "Anyone".
 * Copy the resulting /exec URL into the Vercel env var NEXT_PUBLIC_FORMS_ENDPOINT.
 *
 * Important: The client posts with Content-Type: text/plain to avoid CORS preflight,
 * so we parse the request body (e.postData.contents) as JSON ourselves.
 */

var SHEET_ID = '1t0v1ABeqNZe26lCNlbxcOKDeBsW7Fu5dFgxpNIJWcfM';

var CONTACT_SHEET_NAME  = 'Contact Us';
var WAITLIST_SHEET_NAME = 'Waitlist';

var CONTACT_HEADERS = [
  'Timestamp', 'First Name', 'Last Name', 'Email', 'Phone', 'Message',
  'User Agent', 'Referrer'
];

var WAITLIST_HEADERS = [
  'Timestamp', 'Full Name', 'Email', 'Organization', 'Role', 'Country',
  'Use Case', 'User Agent', 'Referrer'
];

function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var type = (payload.type || '').toLowerCase();
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var row, sheet;

    if (type === 'waitlist') {
      sheet = getOrCreateSheet_(ss, WAITLIST_SHEET_NAME, WAITLIST_HEADERS);
      row = [
        new Date(),
        payload.full_name || '',
        payload.email || '',
        payload.organization || '',
        payload.role || '',
        payload.country || '',
        payload.use_case || '',
        payload.user_agent || '',
        payload.referrer || ''
      ];
    } else {
      // Default / "contact"
      sheet = getOrCreateSheet_(ss, CONTACT_SHEET_NAME, CONTACT_HEADERS);
      row = [
        new Date(),
        payload.first_name || '',
        payload.last_name || '',
        payload.email || '',
        payload.phone || '',
        payload.message || '',
        payload.user_agent || '',
        payload.referrer || ''
      ];
    }

    sheet.appendRow(row);

    return jsonResponse_({ success: true, sheet: sheet.getName() });
  } catch (err) {
    return jsonResponse_({ success: false, error: String(err) });
  }
}

/**
 * Simple GET handler so you can sanity-check the deployment in a browser.
 * Visiting the /exec URL should return {"ok": true, "sheet": "VaxAI Forms"}.
 */
function doGet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  return jsonResponse_({ ok: true, sheet: ss.getName() });
}

function getOrCreateSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
