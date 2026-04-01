/**
 * Precision Geotagger — Google Apps Script Backend
 * 
 * This script acts as a web API for the React app.
 * Deploy it as a Web App (Execute as: Me, Access: Anyone) to get a URL
 * that the React app will use.
 *
 * Sheet structure (columns A–AA + AB–AE):
 *   A: Store ID          B: Store Name        C: AM ID            D: AM Name
 *   E: Region            F: HRBP 1 ID         G: HRBP 1 Name      H: HRBP 2 ID
 *   I: HRBP 2 Name       J: HRBP 3 ID         K: HRBP 3 Name      L: Trainer 1 ID
 *   M: Trainer 1 Name    N: Trainer 2 ID       O: Trainer 2 Name    P: Trainer 3 ID
 *   Q: Trainer 3 Name    R: Regional Trainer ID S: Regional Trainer Name
 *   T: Regional HR ID    U: Regional HR Name   V: HR Head ID       W: HR Head Name
 *   X: Store Format      Y: Menu Type          Z: Price Group      AA: City
 *   AB: Latitude          AC: Longitude         AD: Geotag Accuracy  AE: Geotag Timestamp
 */

// ─── Configuration ──────────────────────────────────────────────────────────────
// Replace with the name of your sheet tab (default is "Sheet1")
var SHEET_NAME = "Sheet1";

// Column indices (1-based) for the geotag output columns
var COL_LATITUDE  = 28; // AB
var COL_LONGITUDE = 29; // AC
var COL_ACCURACY  = 30; // AD
var COL_TIMESTAMP = 31; // AE

// ─── GET handler: return all stores ─────────────────────────────────────────────
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return _jsonResponse({ success: false, error: "Sheet '" + SHEET_NAME + "' not found." });
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return _jsonResponse({ success: true, stores: [] });
    }

    // Read columns A (Store ID), B (Store Name), E (Region), AA (City)
    var dataRange = sheet.getRange(2, 1, lastRow - 1, 31); // A2 to AE(lastRow)
    var values = dataRange.getValues();

    var stores = [];
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var storeId   = String(row[0]).trim();
      var storeName = String(row[1]).trim();
      var region    = String(row[4]).trim();
      var city      = String(row[26]).trim(); // AA = index 26

      if (!storeId || storeId === "") continue;

      stores.push({
        id: storeId,
        name: storeName,
        region: region,
        city: city,
        hasGeotag: row[27] !== "" && row[27] !== undefined && row[27] !== null // AB (Latitude) filled?
      });
    }

    return _jsonResponse({ success: true, stores: stores });

  } catch (err) {
    return _jsonResponse({ success: false, error: err.toString() });
  }
}

// ─── POST handler: update geotag for a store ────────────────────────────────────
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var storeId  = payload.storeId;
    var latitude  = payload.latitude;
    var longitude = payload.longitude;
    var accuracy  = payload.accuracy;

    if (!storeId || latitude === undefined || longitude === undefined) {
      return _jsonResponse({ success: false, error: "Missing required fields: storeId, latitude, longitude." });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return _jsonResponse({ success: false, error: "Sheet '" + SHEET_NAME + "' not found." });
    }

    var lastRow = sheet.getLastRow();
    var storeIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues(); // Column A

    var targetRow = -1;
    for (var i = 0; i < storeIds.length; i++) {
      if (String(storeIds[i][0]).trim() === String(storeId).trim()) {
        targetRow = i + 2; // +2 because data starts at row 2 and array is 0-indexed
        break;
      }
    }

    if (targetRow === -1) {
      return _jsonResponse({ success: false, error: "Store ID '" + storeId + "' not found in sheet." });
    }

    // Write Latitude, Longitude, Accuracy, Timestamp
    var timestamp = new Date().toISOString();
    sheet.getRange(targetRow, COL_LATITUDE).setValue(latitude);
    sheet.getRange(targetRow, COL_LONGITUDE).setValue(longitude);
    sheet.getRange(targetRow, COL_ACCURACY).setValue(accuracy || "");
    sheet.getRange(targetRow, COL_TIMESTAMP).setValue(timestamp);

    return _jsonResponse({
      success: true,
      message: "Geotag updated for store " + storeId,
      data: {
        storeId: storeId,
        latitude: latitude,
        longitude: longitude,
        accuracy: accuracy,
        timestamp: timestamp
      }
    });

  } catch (err) {
    return _jsonResponse({ success: false, error: err.toString() });
  }
}

// ─── Helper: return JSON with CORS headers ──────────────────────────────────────
function _jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
