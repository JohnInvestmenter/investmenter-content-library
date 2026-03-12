// /api/properties.js
// Reads property data from a Notion database
import { Client } from "@notionhq/client";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  const NOTION_API_KEY          = process.env.NOTION_API_KEY;
  const NOTION_PROPERTIES_DB_ID = process.env.NOTION_PROPERTIES_DATABASE_ID;

  if (!NOTION_API_KEY || !NOTION_PROPERTIES_DB_ID) {
    return res.status(500).json({
      error: "Missing env vars",
      hint: "Set NOTION_API_KEY and NOTION_PROPERTIES_DATABASE_ID in Vercel → Settings → Environment Variables"
    });
  }

  const notion = new Client({ auth: NOTION_API_KEY });

  // Helpers
  const getTitle  = (props, name) => props?.[name]?.title?.[0]?.plain_text?.trim() || null;
  const getRich   = (props, name) => props?.[name]?.rich_text?.map(t => t.plain_text).join("").trim() || null;
  const getSelect = (props, name) => props?.[name]?.select?.name || null;
  const getNum    = (props, name) => { const n = props?.[name]?.number; return typeof n === "number" ? n : null; };
  const getUrl    = (props, name) => props?.[name]?.url || null;
  const getRichOrUrl = (props, name) => getUrl(props, name) || getRich(props, name);

  try {
    // Paginate through all rows
    const allPages = [];
    let cursor;
    do {
      const res2 = await notion.databases.query({
        database_id: NOTION_PROPERTIES_DB_ID,
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {})
      });
      allPages.push(...res2.results);
      cursor = res2.has_more ? res2.next_cursor : undefined;
    } while (cursor);

    const properties = allPages.map(page => {
      const p = page.properties || {};

      const originalPriceAed = getNum(p, "Original Price AED");
      const sellingPriceAed  = getNum(p, "Selling Price AED");
      const paidToDeveloper  = getNum(p, "Paid to Developer");

      // Compute paidPct if not stored
      let paidPct = getNum(p, "Paid %");
      if (paidPct === null && paidToDeveloper !== null && originalPriceAed)
        paidPct = Math.round((paidToDeveloper / originalPriceAed) * 1000) / 10;

      return {
        notionId:              page.id,
        unit:                  getTitle(p, "Unit") || "",
        project:               getRich(p, "Project"),
        propertyType:          getSelect(p, "Property Type"),
        area:                  getSelect(p, "Area"),
        developer:             getSelect(p, "Developer"),
        priority:              getSelect(p, "Priority"),
        status:                getSelect(p, "Status") || "Available",
        bedrooms:              getNum(p, "Bedrooms"),
        bathrooms:             getNum(p, "Bathrooms"),
        sizeSqft:              getNum(p, "Size Sqft"),
        sizeSqm:               getNum(p, "Size Sqm"),
        furnished:             getSelect(p, "Furnished"),
        parking:               getNum(p, "Parking"),
        view:                  getRich(p, "View"),
        originalPriceAed,
        originalPriceEur:      getNum(p, "Original Price EUR"),
        sellingPriceAed,
        sellingPriceEur:       getNum(p, "Selling Price EUR"),
        pctOverUnder:          getNum(p, "% vs OP"),
        pricePerSqftAed:       getNum(p, "Price per Sqft AED"),
        pricePerSqmEur:        getNum(p, "Price per Sqm EUR"),
        paidToDeveloper,
        outstandingToDeveloper: getNum(p, "Outstanding AED"),
        paymentPlan:           getRich(p, "Payment Plan"),
        buyerNotes:            getRich(p, "Buyer Notes"),
        handoverDate:          getRich(p, "Handover Date"),
        daysOnMarket:          getNum(p, "Days on Market"),
        ownerName:             getRich(p, "Owner Name"),
        leadsOwner:            getRich(p, "Leads Owner"),
        pitchText:             getRich(p, "Pitch Text"),
        photoLink:             getRichOrUrl(p, "Photo Link"),
        layoutLink:            getRichOrUrl(p, "Layout Link"),
        nextStepsPdf:          getRichOrUrl(p, "Next Steps PDF"),
        googleMapsLink:        getRichOrUrl(p, "Google Maps Link"),
        driveLink:             getRichOrUrl(p, "Drive Link"),
        brochureLink:          getRichOrUrl(p, "Brochure Link"),
        paidPct,
      };
    }).filter(p => p.unit);

    return res.status(200).json(properties);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
