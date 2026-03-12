// /api/properties.js
// Reads property data from Google Sheets using service account JWT auth (no googleapis dependency)

import { createSign } from "crypto";

const SHEET_ID   = "1vadtRT0iQx_Z-BaI1vS07R2Ycwan9HZmuKDuG1GpD24";
const SHEET_NAME = "Sheet1";
const DATA_START = 5; // row where property data begins

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

function base64url(str) {
  return Buffer.from(str).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header  = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));

  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(credentials.private_key, "base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${header}.${payload}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error("Failed to get access token: " + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    return res.status(500).json({
      error: "Missing GOOGLE_SERVICE_ACCOUNT_KEY env var",
      hint: "Add it in Vercel → Settings → Environment Variables, then redeploy"
    });
  }

  try {
    const credentials = JSON.parse(keyJson);
    const accessToken = await getAccessToken(credentials);

    const range = encodeURIComponent(`${SHEET_NAME}!A1:AK`);
    const sheetRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!sheetRes.ok) {
      const err = await sheetRes.json();
      throw new Error(err?.error?.message || `Sheets API error ${sheetRes.status}`);
    }

    const sheetData = await sheetRes.json();
    const rows = sheetData.values || [];

    // EUR rate is in cell F3 (row index 2, col index 5)
    const eurRate = safeFloat(rows[2]?.[5]) || 0.25;

    const properties = [];
    for (let i = DATA_START - 1; i < rows.length; i++) {
      const row = rows[i];
      const unit = safeStr(row?.[0]);
      if (!unit) continue;

      const originalPriceAed = safeFloat(row[14]);
      const sellingPriceAed  = safeFloat(row[16]);
      const sizeSqft         = safeFloat(row[9]);
      const paidToDeveloper  = safeFloat(row[21]);
      let   originalPriceEur = safeFloat(row[15]);
      let   sellingPriceEur  = safeFloat(row[17]);
      let   pctOverUnder     = safeFloat(row[18]);
      let   pricePerSqftAed  = safeFloat(row[19]);

      if (originalPriceEur === null && originalPriceAed)
        originalPriceEur = Math.round(originalPriceAed * eurRate * 100) / 100;
      if (sellingPriceEur === null && sellingPriceAed)
        sellingPriceEur = Math.round(sellingPriceAed * eurRate * 100) / 100;
      if (pctOverUnder === null && originalPriceAed && sellingPriceAed)
        pctOverUnder = Math.round(((sellingPriceAed - originalPriceAed) / originalPriceAed) * 1000) / 10;
      if (pricePerSqftAed === null && sellingPriceAed && sizeSqft)
        pricePerSqftAed = Math.round(sellingPriceAed / sizeSqft);

      const paidPct = paidToDeveloper && originalPriceAed
        ? Math.round((paidToDeveloper / originalPriceAed) * 1000) / 10 : null;

      properties.push({
        unit, paidPct,
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
        originalPriceAed,       originalPriceEur,
        sellingPriceAed,        sellingPriceEur,
        pctOverUnder,           pricePerSqftAed,
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
      });
    }

    return res.status(200).json(properties);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
