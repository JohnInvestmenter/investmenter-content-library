// /api/properties.js
// Fetches property data live from Google Sheets CSV export

const SHEET_ID = '1vadtRT0iQx_Z-BaI1vS07R2Ycwan9HZmuKDuG1GpD24';
const SHEET_GID = '0';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

/** Parse a CSV string into an array of arrays, handling quoted fields */
function parseCSV(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

function safeFloat(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function safeStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s && s !== 'NA' && s !== 'None' && s !== 'N/A' ? s : null;
}

export default async function handler(req, res) {
  // Allow CORS for same-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    const response = await fetch(CSV_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.ok) {
      return res.status(502).json({
        error: 'Failed to fetch Google Sheet',
        hint: 'Make sure the sheet is shared as "Anyone with the link" → Viewer',
        status: response.status
      });
    }

    const csv = await response.text();
    const rows = parseCSV(csv);

    // Row 3 (index 2) contains the EUR rate in column F (index 5)
    const eurRate = safeFloat(rows[2]?.[5]) || 0.25;

    // Data starts at row 5 (index 4)
    const properties = [];
    for (let i = 4; i < rows.length; i++) {
      const row = rows[i];
      const unit = safeStr(row[0]);
      if (!unit) continue;

      let originalPriceAed = safeFloat(row[14]);
      let originalPriceEur = safeFloat(row[15]);
      let sellingPriceAed  = safeFloat(row[16]);
      let sellingPriceEur  = safeFloat(row[17]);
      let pctOverUnder     = safeFloat(row[18]);
      let pricePerSqftAed  = safeFloat(row[19]);
      let paidToDeveloper  = safeFloat(row[21]);

      // Derived fields (matching extract-data.py logic)
      if (originalPriceEur === null && originalPriceAed !== null)
        originalPriceEur = Math.round(originalPriceAed * eurRate * 100) / 100;
      if (sellingPriceEur === null && sellingPriceAed !== null)
        sellingPriceEur = Math.round(sellingPriceAed * eurRate * 100) / 100;
      if (pctOverUnder === null && originalPriceAed && sellingPriceAed)
        pctOverUnder = Math.round(((sellingPriceAed - originalPriceAed) / originalPriceAed) * 1000) / 10;
      if (pricePerSqftAed === null && sellingPriceAed && safeFloat(row[9]))
        pricePerSqftAed = Math.round(sellingPriceAed / safeFloat(row[9]));

      const paidPct = paidToDeveloper !== null && originalPriceAed
        ? Math.round((paidToDeveloper / originalPriceAed) * 1000) / 10
        : null;

      properties.push({
        unit,
        project:               safeStr(row[1]),
        propertyType:          safeStr(row[2]),
        area:                  safeStr(row[3]),
        developer:             safeStr(row[4]),
        priority:              safeStr(row[5]),
        status:                safeStr(row[6]) || 'Available',
        bedrooms:              safeFloat(row[7]),
        bathrooms:             safeFloat(row[8]),
        sizeSqft:              safeFloat(row[9]),
        sizeSqm:               safeFloat(row[10]),
        furnished:             safeStr(row[11]),
        parking:               safeFloat(row[12]),
        view:                  safeStr(row[13]),
        originalPriceAed,
        originalPriceEur,
        sellingPriceAed,
        sellingPriceEur,
        pctOverUnder,
        pricePerSqftAed,
        pricePerSqmEur:        safeFloat(row[20]),
        paidToDeveloper,
        outstandingToDeveloper: safeFloat(row[22]),
        paymentPlan:           safeStr(row[23]),
        buyerNotes:            safeStr(row[24]),
        handoverDate:          safeStr(row[25]),
        daysOnMarket:          safeFloat(row[26]),
        ownerName:             safeStr(row[27]),
        leadsOwner:            safeStr(row[28]),
        pitchText:             safeStr(row[29]),
        photoLink:             safeStr(row[30]),
        layoutLink:            safeStr(row[31]),
        nextStepsPdf:          safeStr(row[32]),
        googleMapsLink:        safeStr(row[33]),
        driveLink:             safeStr(row[34]),
        brochureLink:          safeStr(row[35]),
        paidPct,
      });
    }

    res.status(200).json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
