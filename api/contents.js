// /api/contents.js
import { Client } from "@notionhq/client";

/**
 * This handler auto-detects which Notion properties exist and
 * only reads/writes those. It also avoids sorting if "Created" is missing.
 *
 * Supported (if they exist in your DB):
 *   Title (Title)
 *   Content (Rich text)
 *   Formatted (Rich text)
 *   Category (Select)
 *   Folder (Select)
 *   Tags (Multi-select)
 *   Created (Date)
 *   UseCount (Number)
 *   LastUsed (Date)
 *   Attachments (Files & media)
 */

export default async function handler(req, res) {
  const debug = String(req.query?.debug || "").toLowerCase() === "1";

  try {
    const NOTION_API_KEY = process.env.NOTION_API_KEY;
    const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
    if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
      return res.status(500).json({
        error: "Missing env vars",
        hint:
          "Set NOTION_API_KEY and NOTION_DATABASE_ID in Vercel → Settings → Environment Variables, then redeploy."
      });
    }

    const notion = new Client({ auth: NOTION_API_KEY });

    // Fetch DB schema so we know which properties exist
    const db = await notion.databases.retrieve({ database_id: NOTION_DATABASE_ID });
    const DB_PROPS = db?.properties || {};

    // Helpers to check / read props safely
    const has = (name) => Boolean(DB_PROPS[name]);

    const getTitle = (props, name = "Title") =>
      props?.[name]?.title?.[0]?.plain_text ?? "";

    const getRich = (props, name) =>
      props?.[name]?.rich_text?.map(t => t?.plain_text || "")?.join("") || "";

    const getSelect = (props, name) => props?.[name]?.select?.name || "";
    const getMulti = (props, name) => (props?.[name]?.multi_select || []).map(t => t.name);
    const getDate = (props, name) => props?.[name]?.date?.start || "";
    const getNumber = (props, name) => {
      const n = props?.[name]?.number;
      return typeof n === "number" ? n : 0;
    };
    const getFiles = (props, name) =>
      (props?.[name]?.files || []).map((f) => {
        const url = f?.external?.url || f?.file?.url || "";
        return { name: f?.name || "file", url };
      });

    // Build filters/sorts safely
    const query = { database_id: NOTION_DATABASE_ID };
    if (has("Created")) {
      query.sorts = [{ property: "Created", direction: "descending" }];
    }

    if (req.method === "GET") {
      const pages = await notion.databases.query(query);

      const items = pages.results.map((p) => {
        const props = p.properties || {};

        return {
          id: p.id,
          title: has("Title") ? getTitle(props, "Title") : "",
          content: has("Content") ? getRich(props, "Content") : "",
          formattedContent: has("Formatted") ? getRich(props, "Formatted") : "",
          category: has("Category") ? getSelect(props, "Category") : "General",
          folder: has("Folder") ? getSelect(props, "Folder") : "",
          tags: has("Tags") ? getMulti(props, "Tags") : [],
          dateCreated: has("Created") ? getDate(props, "Created") : "",
          lastUsed: has("LastUsed") ? getDate(props, "LastUsed") : "",
          useCount: has("UseCount") ? getNumber(props, "UseCount") : 0,
          attachments: has("Attachments") ? getFiles(props, "Attachments") : [],
          sortOrder: has("SortOrder") ? getNumber(props, "SortOrder") : 9999
        };
      });

      // Sort by sortOrder (ascending) - items without sortOrder go to end
      items.sort((a, b) => a.sortOrder - b.sortOrder);

      return res.status(200).json({ items });
    }

    // PUT with action=reorder - Bulk update sort order
    if (req.method === "PUT" && req.query.action === "reorder") {
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      const { items } = body || {};

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Missing 'items' array in request body" });
      }

      // Update each item's SortOrder
      const updates = items.map(item =>
        notion.pages.update({
          page_id: item.id,
          properties: {
            SortOrder: { number: item.sortOrder }
          }
        })
      );

      await Promise.all(updates);

      return res.status(200).json({ ok: true, updated: items.length });
    }

    if (req.method === "POST") {
      // Parse body
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      const {
        title = "",
        content = "",
        formattedContent = "",
        category = "General",
        folder = "",
        tags = [],
        dateCreated = new Date().toISOString().slice(0, 10),
        useCount = 0,
        attachments = [] // [{ name, url }]
      } = body || {};

      // Only include properties that exist in the DB
      const properties = {};

      if (has("Title")) {
        properties.Title = { title: [{ type: "text", text: { content: title } }] };
      }
      if (has("Content") && content) {
        properties.Content = { rich_text: [{ type: "text", text: { content } }] };
      }
      if (has("Formatted") && (formattedContent || content)) {
        properties.Formatted = {
          rich_text: [{ type: "text", text: { content: formattedContent || content } }]
        };
      }
      if (has("Category") && category) {
        properties.Category = { select: { name: category } };
      }
      if (has("Folder") && folder) {
        properties.Folder = { select: { name: folder } };
      }
      if (has("Tags") && Array.isArray(tags) && tags.length) {
        properties.Tags = { multi_select: tags.map((t) => ({ name: t })) };
      }
      if (has("Created") && dateCreated) {
        properties.Created = { date: { start: dateCreated } };
      }
      if (has("UseCount")) {
        properties.UseCount = { number: Number(useCount || 0) };
      }
      if (has("Attachments") && Array.isArray(attachments) && attachments.length) {
        properties.Attachments = {
          files: attachments
            .filter((a) => a?.url)
            .map((a) => ({
              name: a.name || "attachment",
              external: { url: a.url }
            }))
        };
      }
      // LastUsed is intentionally not set here; you can add an update endpoint later.

      // If Title property doesn't exist, bail with a clear message
      if (!has("Title")) {
        return res.status(400).json({
          error: "No 'Title' property in database. Create a Title column named exactly 'Title'."
        });
      }

      const page = await notion.pages.create({
        parent: { database_id: NOTION_DATABASE_ID },
        properties
      });

      return res.status(200).json({ ok: true, id: page.id });
    }

    // PUT - Update existing content
    if (req.method === "PUT") {
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      const { id, title, content, formattedContent, category, folder, tags, attachments, skipHistory } = body || {};

      if (!id) {
        return res.status(400).json({ error: "Missing 'id' in request body" });
      }

      // Save current state to history before updating (if history database is configured)
      const NOTION_HISTORY_DATABASE_ID = process.env.NOTION_HISTORY_DATABASE_ID;
      let newVersionNumber = 1;

      if (NOTION_HISTORY_DATABASE_ID && !skipHistory) {
        try {
          // Fetch current content state
          const currentPage = await notion.pages.retrieve({ page_id: id });
          const currentProps = currentPage.properties || {};

          // Get current version count (default to 0 if not set)
          const currentVersionCount = currentProps.VersionCount?.number || 0;
          newVersionNumber = currentVersionCount + 1;

          // Save current state to history
          await notion.pages.create({
            parent: { database_id: NOTION_HISTORY_DATABASE_ID },
            properties: {
              Title: { title: [{ type: "text", text: { content: currentProps.Title?.title?.[0]?.plain_text || "" } }] },
              ContentId: { rich_text: [{ type: "text", text: { content: id } }] },
              Content: { rich_text: [{ type: "text", text: { content: currentProps.Content?.rich_text?.map(t => t.plain_text).join("") || "" } }] },
              FormattedContent: { rich_text: [{ type: "text", text: { content: currentProps.Formatted?.rich_text?.map(t => t.plain_text).join("") || "" } }] },
              VersionNumber: { number: currentVersionCount },
              CreatedAt: { date: { start: new Date().toISOString() } }
            }
          });
        } catch (historyError) {
          console.warn("Failed to save history:", historyError.message);
          // Continue with update even if history save fails
        }
      }

      const properties = {};

      if (has("Title") && title !== undefined) {
        properties.Title = { title: [{ type: "text", text: { content: title } }] };
      }
      if (has("Content") && content !== undefined) {
        properties.Content = { rich_text: [{ type: "text", text: { content } }] };
      }
      if (has("Formatted") && formattedContent !== undefined) {
        properties.Formatted = { rich_text: [{ type: "text", text: { content: formattedContent } }] };
      }
      if (has("Category") && category) {
        properties.Category = { select: { name: category } };
      }
      if (has("Folder") && folder !== undefined) {
        if (folder) {
          properties.Folder = { select: { name: folder } };
        } else {
          properties.Folder = { select: null };
        }
      }
      if (has("Tags") && Array.isArray(tags)) {
        properties.Tags = { multi_select: tags.map((t) => ({ name: t })) };
      }
      if (has("Attachments") && Array.isArray(attachments)) {
        properties.Attachments = {
          files: attachments
            .filter((a) => a?.url)
            .map((a) => ({
              name: a.name || "attachment",
              external: { url: a.url }
            }))
        };
      }

      // Add version tracking if history is enabled
      if (NOTION_HISTORY_DATABASE_ID && !skipHistory) {
        if (has("VersionCount")) {
          properties.VersionCount = { number: newVersionNumber };
        }
        if (has("LastModified")) {
          properties.LastModified = { date: { start: new Date().toISOString() } };
        }
      }

      await notion.pages.update({
        page_id: id,
        properties
      });

      return res.status(200).json({ ok: true, id, versionNumber: newVersionNumber });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("API /api/contents error:", e);
    return res.status(500).json({
      error: "Server error",
      message: e?.message || String(e),
      debug: debug ? { name: e?.name, code: e?.code, status: e?.status, body: e?.body } : undefined,
      hint:
        "Make sure your Notion integration is invited to the database (Share → Invite). If a column is missing, the API will skip it."
    });
  }
}
