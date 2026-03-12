/**
 * GOOGLE APPS SCRIPT — Paste this entire file into your Google Sheet's Apps Script editor.
 *
 * Setup:
 * 1. In your Google Sheet: Extensions → Apps Script
 * 2. Paste this entire script, replacing the default code
 * 3. Set NOTION_API_KEY and NOTION_DATABASE_ID at the top
 * 4. Click Run → "fullSync" once to import all existing rows
 * 5. Click Triggers (clock icon) → Add Trigger:
 *      Function: onSheetEdit
 *      Event source: From spreadsheet
 *      Event type: On edit
 * 6. Done — every edit auto-syncs to Notion
 */

// ─── CONFIG ───────────────────────────────────────────────────────────────────
var NOTION_API_KEY          = "your_notion_api_key_here";
var NOTION_DATABASE_ID      = "your_notion_properties_database_id_here";
var DATA_START_ROW          = 5;   // Row where property data begins (same as extract-data.py)
var NOTION_ID_COLUMN        = 37;  // Column AK — we'll store the Notion page ID here for updates
var EUR_RATE_CELL           = "F3"; // EUR exchange rate cell
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Trigger this from the Apps Script editor once to sync all existing rows.
 */
function fullSync() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var lastRow = sheet.getLastRow();
  var eurRate = parseFloat(sheet.getRange(EUR_RATE_CELL).getValue()) || 0.25;

  Logger.log("Starting full sync of rows " + DATA_START_ROW + " to " + lastRow);

  for (var i = DATA_START_ROW; i <= lastRow; i++) {
    var row = sheet.getRange(i, 1, 1, 37).getValues()[0];
    if (!row[0]) continue; // skip empty rows
    syncRow(sheet, i, row, eurRate);
    Utilities.sleep(400); // respect Notion rate limit
  }

  Logger.log("Full sync complete.");
}

/**
 * Auto-trigger: runs whenever any cell is edited in the sheet.
 */
function onSheetEdit(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getIndex() !== 1) return; // only watch Sheet1

  var row = e.range.getRow();
  if (row < DATA_START_ROW) return; // ignore header rows

  var rowData = sheet.getRange(row, 1, 1, 37).getValues()[0];
  if (!rowData[0]) return; // skip empty rows

  var eurRate = parseFloat(sheet.getRange(EUR_RATE_CELL).getValue()) || 0.25;
  syncRow(sheet, row, rowData, eurRate);
}

/**
 * Syncs a single row to Notion (creates or updates).
 */
function syncRow(sheet, rowIndex, row, eurRate) {
  var unit = String(row[0] || "").trim();
  if (!unit) return;

  var props = buildNotionProperties(row, eurRate);

  // Check if we already have a Notion page ID stored for this row
  var storedId = sheet.getRange(rowIndex, NOTION_ID_COLUMN).getValue();

  try {
    if (storedId) {
      // Update existing Notion page
      notionRequest("PATCH", "/pages/" + storedId, { properties: props });
      Logger.log("Updated row " + rowIndex + " (unit: " + unit + ")");
    } else {
      // Create new Notion page
      var result = notionRequest("POST", "/pages", {
        parent: { database_id: NOTION_DATABASE_ID },
        properties: props
      });
      // Store the Notion page ID back in the sheet (column AK)
      sheet.getRange(rowIndex, NOTION_ID_COLUMN).setValue(result.id);
      Logger.log("Created row " + rowIndex + " (unit: " + unit + ") → " + result.id);
    }
  } catch (err) {
    Logger.log("Error on row " + rowIndex + ": " + err.message);
  }
}

/**
 * Maps a sheet row to Notion database properties.
 * Column order matches extract-data.py exactly.
 */
function buildNotionProperties(row, eurRate) {
  var safeStr = function(v) {
    if (v === null || v === undefined || v === "") return null;
    var s = String(v).trim();
    return (s && s !== "NA" && s !== "None" && s !== "N/A") ? s : null;
  };
  var safeNum = function(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = parseFloat(String(v).replace(/,/g, ""));
    return isNaN(n) ? null : n;
  };
  var rich = function(v) {
    var s = safeStr(v);
    return s ? [{ text: { content: s.slice(0, 2000) } }] : [];
  };
  var sel = function(v) {
    var s = safeStr(v);
    return s ? { name: s.slice(0, 100) } : null;
  };

  var originalPriceAed = safeNum(row[14]);
  var sellingPriceAed  = safeNum(row[16]);
  var originalPriceEur = safeNum(row[15]) || (originalPriceAed ? Math.round(originalPriceAed * eurRate * 100) / 100 : null);
  var sellingPriceEur  = safeNum(row[17]) || (sellingPriceAed  ? Math.round(sellingPriceAed  * eurRate * 100) / 100 : null);
  var pctOverUnder     = safeNum(row[18]) || (originalPriceAed && sellingPriceAed ? Math.round(((sellingPriceAed - originalPriceAed) / originalPriceAed) * 1000) / 10 : null);
  var sizeSqft         = safeNum(row[9]);
  var pricePerSqft     = safeNum(row[19]) || (sellingPriceAed && sizeSqft ? Math.round(sellingPriceAed / sizeSqft) : null);
  var paidToDeveloper  = safeNum(row[21]);
  var paidPct          = paidToDeveloper && originalPriceAed ? Math.round((paidToDeveloper / originalPriceAed) * 1000) / 10 : null;

  var props = {};

  // Title
  props["Unit"] = { title: [{ text: { content: String(row[0]).trim().slice(0, 2000) } }] };

  // Text fields
  var textFields = {
    "Project":      row[1],
    "View":         row[13],
    "Payment Plan": row[23],
    "Buyer Notes":  row[24],
    "Handover Date":row[25],
    "Owner Name":   row[27],
    "Leads Owner":  row[28],
    "Pitch Text":   row[29],
  };
  for (var k in textFields) {
    props[k] = { rich_text: rich(textFields[k]) };
  }

  // Select fields
  var selectFields = {
    "Property Type": row[2],
    "Area":          row[3],
    "Developer":     row[4],
    "Priority":      row[5],
    "Status":        safeStr(row[6]) || "Available",
    "Furnished":     row[11],
  };
  for (var k in selectFields) {
    var s = sel(selectFields[k]);
    if (s) props[k] = { select: s };
  }

  // Number fields
  var numFields = {
    "Bedrooms":          safeNum(row[7]),
    "Bathrooms":         safeNum(row[8]),
    "Size Sqft":         sizeSqft,
    "Size Sqm":          safeNum(row[10]),
    "Parking":           safeNum(row[12]),
    "Original Price AED": originalPriceAed,
    "Original Price EUR": originalPriceEur,
    "Selling Price AED":  sellingPriceAed,
    "Selling Price EUR":  sellingPriceEur,
    "% vs OP":            pctOverUnder,
    "Price per Sqft AED": pricePerSqft,
    "Price per Sqm EUR":  safeNum(row[20]),
    "Paid to Developer":  paidToDeveloper,
    "Outstanding AED":    safeNum(row[22]),
    "Paid %":             paidPct,
    "Days on Market":     safeNum(row[26]),
  };
  for (var k in numFields) {
    if (numFields[k] !== null) props[k] = { number: numFields[k] };
  }

  // URL fields
  var urlFields = {
    "Photo Link":      row[30],
    "Layout Link":     row[31],
    "Next Steps PDF":  row[32],
    "Google Maps Link":row[33],
    "Drive Link":      row[34],
    "Brochure Link":   row[35],
  };
  for (var k in urlFields) {
    var u = safeStr(urlFields[k]);
    if (u && (u.startsWith("http://") || u.startsWith("https://"))) {
      props[k] = { url: u };
    }
  }

  return props;
}

/**
 * Makes a Notion API request.
 */
function notionRequest(method, path, body) {
  var options = {
    method: method.toLowerCase(),
    headers: {
      "Authorization": "Bearer " + NOTION_API_KEY,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    },
    muteHttpExceptions: true
  };
  if (body) options.payload = JSON.stringify(body);

  var response = UrlFetchApp.fetch("https://api.notion.com/v1" + path, options);
  var code = response.getResponseCode();
  var text = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error("Notion API error " + code + ": " + text);
  }
  return JSON.parse(text);
}
