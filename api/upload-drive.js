// /api/upload-drive.js
// Server-side proxy to Google Apps Script — avoids browser CORS restrictions.

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DRIVE_APP_SCRIPT = process.env.DRIVE_APP_SCRIPT_URL;
  if (!DRIVE_APP_SCRIPT) {
    return res.status(500).json({ error: 'Missing DRIVE_APP_SCRIPT_URL env var' });
  }

  try {
    const driveRes = await fetch(DRIVE_APP_SCRIPT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const text = await driveRes.text();
    let data;
    try { data = JSON.parse(text); } catch {
      return res.status(502).json({ error: 'Drive returned non-JSON', raw: text.slice(0, 300) });
    }

    return res.status(driveRes.ok ? 200 : 502).json(data);
  } catch (err) {
    console.error('Drive proxy error:', err);
    return res.status(500).json({ error: 'Drive proxy failed', message: err.message });
  }
}
