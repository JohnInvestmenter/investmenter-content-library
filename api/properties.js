// /api/properties.js
// Reads property data live from Google Sheets using a service account.
// Requires env var: GOOGLE_SERVICE_ACCOUNT_KEY (paste the entire JSON key file contents)

import { google } from "googleapis";

const SHEET_ID   = "1vadtRT0iQx_Z-BaI1vS07R2Ycwan9HZmuKDuG1GpD24";
const SHEET_NAME = "Sheet1";
const DATA_START = 5; // row where property data begins (rows 1-4 are headers/metadata)

function safeFloat(v) {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function safeStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s && s !== "NA" && s !== "None" && s !== "N/A" ? s : null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    return res.status(500).json({
      error: "Missing GOOGLE_SERVICE_ACCOUNT_KEY env var",
      hint: "Add it in Vercel → Settings → Environment Variables"
    });
  }

  try {
    const credentials = JSON.parse(keyJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Fetch all data including the EUR rate row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:AK`,
    });

    const rows = response.data.values || [];

    // EUR rate is in cell F3 (row index 2, column index 5)
    const eurRate = safeFloat(rows[2]?.[5]) || 0.25;

    const properties = [];

    for (let i = DATA_START - 1; i < rows.length; i++) {
      const row = rows[i];
      const unit = safeStr(row?.[0]);
      if (!unit) continue;

      const originalPriceAed = safeFloat(row[14]);
      const sellingPriceAed  = safeFloat(row[16]);
      let   originalPriceEur = safeFloat(row[15]);
      let   sellingPriceEur  = safeFloat(row[17]);
      let   pctOverUnder     = safeFloat(row[18]);
      let   pricePerSqftAed  = safeFloat(row[19]);
      const paidToDeveloper  = safeFloat(row[21]);
      const sizeSqft         = safeFloat(row[9]);

      // Derived fields — same logic as extract-data.py
      if (originalPriceEur === null && originalPriceAed !== null)
        originalPriceEur = Math.round(originalPriceAed * eurRate * 100) / 100;
      if (sellingPriceEur === null && sellingPriceAed !== null)
        sellingPriceEur = Math.round(sellingPriceAed * eurRate * 100) / 100;
      if (pctOverUnder === null && originalPriceAed && sellingPriceAed)
        pctOverUnder = Math.round(((sellingPriceAed - originalPriceAed) / originalPriceAed) * 1000) / 10;
      if (pricePerSqftAed === null && sellingPriceAed && sizeSqft)
        pricePerSqftAed = Math.round(sellingPriceAed / sizeSqft);

      const paidPct = paidToDeveloper !== null && originalPriceAed
        ? Math.round((paidToDeveloper / originalPriceAed) * 1000) / 10
        : null;

      properties.push({
        unit,
        project:                safeStr(row[1]),
        propertyType:           safeStr(row[2]),
        area:                   safeStr(row[3]),
        developer:              safeStr(row[4]),
        priority:               safeStr(row[5]),
        status:                 safeStr(row[6]) || "Available",
        bedrooms:               safeFloat(row[7]),
        bathrooms:              safeFloat(row[8]),
        sizeSqft,
        sizeSqm:                safeFloat(row[10]),
        furnished:              safeStr(row[11]),
        parking:                safeFloat(row[12]),
        view:                   safeStr(row[13]),
        originalPriceAed,
        originalPriceEur,
        sellingPriceAed,
        sellingPriceEur,
        pctOverUnder,
        pricePerSqftAed,
        pricePerSqmEur:         safeFloat(row[20]),
        paidToDeveloper,
        outstandingToDeveloper: safeFloat(row[22]),
        paymentPlan:            safeStr(row[23]),
        buyerNotes:             safeStr(row[24]),
        handoverDate:           safeStr(row[25]),
        daysOnMarket:           safeFloat(row[26]),
        ownerName:              safeStr(row[27]),
        leadsOwner:             safeStr(row[28]),
        pitchText:              safeStr(row[29]),
        photoLink:              safeStr(row[30]),
        layoutLink:             safeStr(row[31]),
        nextStepsPdf:           safeStr(row[32]),
        googleMapsLink:         safeStr(row[33]),
        driveLink:              safeStr(row[34]),
        brochureLink:           safeStr(row[35]),
        paidPct,
      });
    }

    return res.status(200).json(properties);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
