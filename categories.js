// /api/categories.js
import { Client } from "@notionhq/client";

/**
 * Category Management API
 *
 * Provides CRUD operations for managing categories/folders:
 * - GET: Fetch categories with usage counts
 * - POST: Add new category
 * - PUT: Rename category (updates all items)
 * - DELETE: Delete category (migrates items to "General")
 */

export default async function handler(req, res) {
  try {
    const NOTION_API_KEY = process.env.NOTION_API_KEY;
    const CONTENTS_DB_ID = process.env.NOTION_DATABASE_ID;
    const PROMPTS_DB_ID = process.env.NOTION_PROMPTS_DB_ID;

    if (!NOTION_API_KEY || !CONTENTS_DB_ID || !PROMPTS_DB_ID) {
      return res.status(500).json({
        error: "Missing env vars",
        hint: "Set NOTION_API_KEY, NOTION_DATABASE_ID, and NOTION_PROMPTS_DB_ID in Vercel"
      });
    }

    const notion = new Client({ auth: NOTION_API_KEY });

    // Determine which database to use
    const dbType = req.query.db || req.body?.db;
    const database_id = dbType === 'prompts' ? PROMPTS_DB_ID : CONTENTS_DB_ID;

    // ===== GET: Fetch categories with usage counts =====
    if (req.method === "GET") {
      // Get DB schema to fetch Select options
      const db = await notion.databases.retrieve({ database_id });
      const categoryProp = db.properties.Category;

      if (!categoryProp || categoryProp.type !== 'select') {
        return res.status(200).json({ categories: [] });
      }

      const options = categoryProp.select?.options || [];

      // Query all pages to count usage per category
      const pages = await notion.databases.query({ database_id });
      const categoryCounts = {};

      pages.results.forEach(page => {
        const categoryName = page.properties?.Category?.select?.name;
        if (categoryName) {
          categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1;
        }
      });

      // Build response with usage counts
      const categories = options.map(opt => ({
        name: opt.name,
        color: opt.color || 'default',
        count: categoryCounts[opt.name] || 0
      }));

      return res.status(200).json({ categories });
    }

    // ===== POST: Add new category =====
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      const newName = (body.name || '').trim();

      if (!newName) {
        return res.status(400).json({ error: 'Category name is required' });
      }

      if (newName.length > 100) {
        return res.status(400).json({ error: 'Category name too long (max 100 characters)' });
      }

      // Get current options
      const db = await notion.databases.retrieve({ database_id });
      const categoryProp = db.properties.Category;

      if (!categoryProp || categoryProp.type !== 'select') {
        return res.status(400).json({ error: 'Category property not found or invalid type' });
      }

      const options = categoryProp.select?.options || [];

      // Check for duplicates (case-insensitive)
      const exists = options.some(opt => opt.name.toLowerCase() === newName.toLowerCase());
      if (exists) {
        return res.status(400).json({ error: 'Category already exists' });
      }

      // Add new option to schema
      const newOption = { name: newName, color: 'default' };
      await notion.databases.update({
        database_id,
        properties: {
          Category: {
            select: {
              options: [...options, newOption]
            }
          }
        }
      });

      return res.status(200).json({
        ok: true,
        category: newOption
      });
    }

    // ===== PUT: Rename category =====
    if (req.method === "PUT") {
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      const oldName = (body.oldName || '').trim();
      const newName = (body.newName || '').trim();

      if (!oldName || !newName) {
        return res.status(400).json({ error: 'Both oldName and newName are required' });
      }

      if (oldName === 'General') {
        return res.status(400).json({ error: 'Cannot rename the default "General" category' });
      }

      if (newName.length > 100) {
        return res.status(400).json({ error: 'Category name too long (max 100 characters)' });
      }

      // Get current options
      const db = await notion.databases.retrieve({ database_id });
      const categoryProp = db.properties.Category;

      if (!categoryProp || categoryProp.type !== 'select') {
        return res.status(400).json({ error: 'Category property not found' });
      }

      const options = categoryProp.select?.options || [];

      // Check new name doesn't already exist
      const exists = options.some(opt =>
        opt.name.toLowerCase() === newName.toLowerCase() &&
        opt.name !== oldName
      );
      if (exists) {
        return res.status(400).json({ error: 'A category with the new name already exists' });
      }

      // Step 1: Update all pages with oldName to newName
      const pages = await notion.databases.query({
        database_id,
        filter: {
          property: 'Category',
          select: { equals: oldName }
        }
      });

      let updatedCount = 0;
      for (const page of pages.results) {
        await notion.pages.update({
          page_id: page.id,
          properties: {
            Category: { select: { name: newName } }
          }
        });
        updatedCount++;
      }

      // Step 2: Update schema - replace old option with new
      const updatedOptions = options.map(opt =>
        opt.name === oldName
          ? { ...opt, name: newName }
          : opt
      );

      await notion.databases.update({
        database_id,
        properties: {
          Category: {
            select: {
              options: updatedOptions
            }
          }
        }
      });

      return res.status(200).json({
        ok: true,
        updatedCount
      });
    }

    // ===== DELETE: Delete category =====
    if (req.method === "DELETE") {
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      const name = (body.name || '').trim();
      const force = body.force === true;

      if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
      }

      if (name === 'General') {
        return res.status(400).json({ error: 'Cannot delete the default "General" category' });
      }

      // Get current options
      const db = await notion.databases.retrieve({ database_id });
      const categoryProp = db.properties.Category;

      if (!categoryProp || categoryProp.type !== 'select') {
        return res.status(400).json({ error: 'Category property not found' });
      }

      const options = categoryProp.select?.options || [];

      // Check if category exists
      const categoryExists = options.some(opt => opt.name === name);
      if (!categoryExists) {
        return res.status(404).json({ error: 'Category not found' });
      }

      // Count usage
      const pages = await notion.databases.query({
        database_id,
        filter: {
          property: 'Category',
          select: { equals: name }
        }
      });

      const count = pages.results.length;

      if (count > 0 && !force) {
        return res.status(200).json({
          canDelete: false,
          count
        });
      }

      // Migrate items to "General" if any exist
      let migratedCount = 0;
      if (count > 0 && force) {
        for (const page of pages.results) {
          await notion.pages.update({
            page_id: page.id,
            properties: {
              Category: { select: { name: 'General' } }
            }
          });
          migratedCount++;
        }
      }

      // Remove category from schema
      const updatedOptions = options.filter(opt => opt.name !== name);

      await notion.databases.update({
        database_id,
        properties: {
          Category: {
            select: {
              options: updatedOptions
            }
          }
        }
      });

      return res.status(200).json({
        ok: true,
        migratedCount
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Category API error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}
