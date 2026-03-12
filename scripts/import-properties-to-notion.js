#!/usr/bin/env node
/**
 * One-time script: imports properties.json into a Notion database.
 *
 * Usage:
 *   NOTION_API_KEY=secret_xxx NOTION_PROPERTIES_DATABASE_ID=xxx node scripts/import-properties-to-notion.js
 *
 * Make sure the Notion database has the exact property names and types listed below.
 * Run this once — re-running will create duplicates.
 */

import { Client } from "@notionhq/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROPERTIES_JSON = join(__dirname, "../properties.json");

const NOTION_API_KEY   = process.env.NOTION_API_KEY;
const DB_ID            = process.env.NOTION_PROPERTIES_DATABASE_ID;

if (!NOTION_API_KEY || !DB_ID) {
  console.error("❌  Set NOTION_API_KEY and NOTION_PROPERTIES_DATABASE_ID env vars before running.");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });
const properties = JSON.parse(readFileSync(PROPERTIES_JSON, "utf-8"));

const rich  = (v) => v ? [{ text: { content: String(v).slice(0, 2000) } }] : [];
const num   = (v) => v != null ? { number: v } : undefined;
const sel   = (v) => v ? { select: { name: String(v).slice(0, 100) } } : undefined;
const url   = (v) => v ? { url: String(v) } : undefined;
const title = (v) => [{ text: { content: String(v || "").slice(0, 2000) } }];

function buildPage(p) {
  const props = {
    "Unit":                   { title: title(p.unit) },
    "Project":                { rich_text: rich(p.project) },
    "Property Type":          sel(p.propertyType),
    "Area":                   sel(p.area),
    "Developer":              sel(p.developer),
    "Priority":               sel(p.priority),
    "Status":                 sel(p.status),
    "Bedrooms":               num(p.bedrooms),
    "Bathrooms":              num(p.bathrooms),
    "Size Sqft":              num(p.sizeSqft),
    "Size Sqm":               num(p.sizeSqm),
    "Furnished":              sel(p.furnished),
    "Parking":                num(p.parking),
    "View":                   { rich_text: rich(p.view) },
    "Original Price AED":     num(p.originalPriceAed),
    "Original Price EUR":     num(p.originalPriceEur),
    "Selling Price AED":      num(p.sellingPriceAed),
    "Selling Price EUR":      num(p.sellingPriceEur),
    "% vs OP":                num(p.pctOverUnder),
    "Price per Sqft AED":     num(p.pricePerSqftAed),
    "Price per Sqm EUR":      num(p.pricePerSqmEur),
    "Paid to Developer":      num(p.paidToDeveloper),
    "Outstanding AED":        num(p.outstandingToDeveloper),
    "Paid %":                 num(p.paidPct),
    "Payment Plan":           { rich_text: rich(p.paymentPlan) },
    "Buyer Notes":            { rich_text: rich(p.buyerNotes) },
    "Handover Date":          { rich_text: rich(p.handoverDate) },
    "Days on Market":         num(p.daysOnMarket),
    "Owner Name":             { rich_text: rich(p.ownerName) },
    "Leads Owner":            { rich_text: rich(p.leadsOwner) },
    "Pitch Text":             { rich_text: rich(p.pitchText) },
    "Photo Link":             url(p.photoLink),
    "Layout Link":            url(p.layoutLink),
    "Next Steps PDF":         url(p.nextStepsPdf),
    "Google Maps Link":       url(p.googleMapsLink),
    "Drive Link":             url(p.driveLink),
    "Brochure Link":          url(p.brochureLink),
  };

  // Remove undefined values — Notion rejects them
  Object.keys(props).forEach(k => { if (props[k] === undefined) delete props[k]; });
  return props;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(`📦  Importing ${properties.length} properties into Notion database ${DB_ID}...`);

  let success = 0, failed = 0;
  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    try {
      await notion.pages.create({
        parent: { database_id: DB_ID },
        properties: buildPage(p),
      });
      success++;
      process.stdout.write(`\r  ✅  ${success}/${properties.length} imported...`);
    } catch (err) {
      failed++;
      console.error(`\n  ❌  Failed [${p.unit}]: ${err.message}`);
    }
    // Respect Notion rate limit (3 req/s)
    if (i % 3 === 2) await sleep(1100);
  }

  console.log(`\n\n🎉  Done! ${success} imported, ${failed} failed.`);
}

main().catch(console.error);
