// /api/upload-notion.js
// Uploads a file to Notion's file hosting via the File Uploads API.
// Returns { fileUploadId } which is later attached to a page property.

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

  try {
    const { file, filename, contentType } = req.body;

    if (!file || !filename) {
      return res.status(400).json({ error: 'Missing file or filename' });
    }

    const NOTION_API_KEY = process.env.NOTION_API_KEY;
    if (!NOTION_API_KEY) {
      return res.status(500).json({ error: 'Missing NOTION_API_KEY env var' });
    }

    const base64Data = file.replace(/^data:.+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const mimeType = contentType || 'application/octet-stream';

    // Step 1: Create a file upload object in Notion
    const createRes = await fetch('https://api.notion.com/v1/file_uploads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content_type: mimeType,
        content_length: buffer.length
      })
    });

    const createData = await createRes.json();
    if (!createRes.ok) {
      throw new Error(createData.message || `Notion file_uploads create failed (HTTP ${createRes.status})`);
    }

    const { id: fileUploadId, upload_url } = createData;
    if (!fileUploadId || !upload_url) {
      throw new Error('Notion did not return fileUploadId or upload_url');
    }

    // Step 2: Upload the file binary to the upload URL (multipart form data)
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType }), filename);

    const uploadRes = await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28'
        // Do NOT set Content-Type — fetch sets it automatically with multipart boundary
      },
      body: form
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => String(uploadRes.status));
      throw new Error(`Notion file upload to S3 failed: ${errText.slice(0, 300)}`);
    }

    return res.status(200).json({
      success: true,
      fileUploadId
    });

  } catch (error) {
    console.error('Notion upload error:', error);
    return res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
}
