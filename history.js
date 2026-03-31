// /api/history.js
import { Client } from "@notionhq/client";

/**
 * Version History API for Content Items
 *
 * GET /api/history?contentId=xxx - Fetch version history for a content item
 * POST /api/history - Restore a specific version
 *
 * Requires NOTION_HISTORY_DATABASE_ID environment variable
 */

export default async function handler(req, res) {
  try {
    const NOTION_API_KEY = process.env.NOTION_API_KEY;
    const NOTION_HISTORY_DATABASE_ID = process.env.NOTION_HISTORY_DATABASE_ID;
    const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

    if (!NOTION_API_KEY) {
      return res.status(500).json({
        error: "Missing NOTION_API_KEY",
        hint: "Set NOTION_API_KEY in Vercel → Settings → Environment Variables"
      });
    }

    if (!NOTION_HISTORY_DATABASE_ID) {
      // Return empty versions if history database is not configured
      if (req.method === "GET") {
        return res.status(200).json({
          versions: [],
          notConfigured: true,
          hint: "Version history requires a ContentHistory database. Create one in Notion and set NOTION_HISTORY_DATABASE_ID in environment variables."
        });
      }
      return res.status(400).json({
        error: "Version history not configured",
        hint: "Create a ContentHistory database in Notion and set NOTION_HISTORY_DATABASE_ID in environment variables"
      });
    }

    const notion = new Client({ auth: NOTION_API_KEY });

    // GET: Fetch version history for a content item
    if (req.method === "GET") {
      const { contentId } = req.query;

      if (!contentId) {
        return res.status(400).json({ error: "Missing contentId parameter" });
      }

      // Query history database for all versions of this content
      const response = await notion.databases.query({
        database_id: NOTION_HISTORY_DATABASE_ID,
        filter: {
          property: "ContentId",
          rich_text: {
            equals: contentId
          }
        },
        sorts: [
          {
            property: "VersionNumber",
            direction: "descending"
          }
        ]
      });

      const versions = response.results.map(page => {
        const props = page.properties || {};
        return {
          id: page.id,
          contentId: props.ContentId?.rich_text?.[0]?.plain_text || "",
          versionNumber: props.VersionNumber?.number || 0,
          title: props.Title?.title?.[0]?.plain_text || "",
          content: props.Content?.rich_text?.map(t => t.plain_text).join("") || "",
          formattedContent: props.FormattedContent?.rich_text?.map(t => t.plain_text).join("") || "",
          createdAt: props.CreatedAt?.date?.start || "",
          changeNote: props.ChangeNote?.rich_text?.[0]?.plain_text || ""
        };
      });

      return res.status(200).json({ versions });
    }

    // POST: Restore a specific version
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      const { contentId, versionNumber } = body;

      if (!contentId || versionNumber === undefined) {
        return res.status(400).json({ error: "Missing contentId or versionNumber" });
      }

      // Find the specific version
      const historyResponse = await notion.databases.query({
        database_id: NOTION_HISTORY_DATABASE_ID,
        filter: {
          and: [
            {
              property: "ContentId",
              rich_text: { equals: contentId }
            },
            {
              property: "VersionNumber",
              number: { equals: versionNumber }
            }
          ]
        }
      });

      if (!historyResponse.results.length) {
        return res.status(404).json({ error: "Version not found" });
      }

      const versionPage = historyResponse.results[0];
      const versionProps = versionPage.properties || {};

      // Extract version data
      const restoredTitle = versionProps.Title?.title?.[0]?.plain_text || "";
      const restoredContent = versionProps.Content?.rich_text?.map(t => t.plain_text).join("") || "";
      const restoredFormatted = versionProps.FormattedContent?.rich_text?.map(t => t.plain_text).join("") || "";

      // Get current content to save as new history entry before restoring
      const currentPage = await notion.pages.retrieve({ page_id: contentId });
      const currentProps = currentPage.properties || {};

      // Get current version count
      const currentVersionCount = currentProps.VersionCount?.number || 0;
      const newVersionNumber = currentVersionCount + 1;

      // Save current state to history before restoring
      await notion.pages.create({
        parent: { database_id: NOTION_HISTORY_DATABASE_ID },
        properties: {
          Title: { title: [{ type: "text", text: { content: currentProps.Title?.title?.[0]?.plain_text || "" } }] },
          ContentId: { rich_text: [{ type: "text", text: { content: contentId } }] },
          Content: { rich_text: [{ type: "text", text: { content: currentProps.Content?.rich_text?.map(t => t.plain_text).join("") || "" } }] },
          FormattedContent: { rich_text: [{ type: "text", text: { content: currentProps.Formatted?.rich_text?.map(t => t.plain_text).join("") || "" } }] },
          VersionNumber: { number: currentVersionCount },
          CreatedAt: { date: { start: new Date().toISOString() } },
          ChangeNote: { rich_text: [{ type: "text", text: { content: `Before restore to version ${versionNumber}` } }] }
        }
      });

      // Update the main content with restored version
      const updateProps = {
        Title: { title: [{ type: "text", text: { content: restoredTitle } }] },
        Content: { rich_text: [{ type: "text", text: { content: restoredContent } }] },
        VersionCount: { number: newVersionNumber },
        LastModified: { date: { start: new Date().toISOString() } }
      };

      // Only add Formatted if it exists in the database
      if (currentProps.Formatted) {
        updateProps.Formatted = { rich_text: [{ type: "text", text: { content: restoredFormatted } }] };
      }

      await notion.pages.update({
        page_id: contentId,
        properties: updateProps
      });

      return res.status(200).json({
        ok: true,
        message: `Restored to version ${versionNumber}`,
        newVersionNumber
      });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (e) {
    console.error("API /api/history error:", e);
    return res.status(500).json({
      error: "Server error",
      message: e?.message || String(e)
    });
  }
}
