// /api/upload-blob.js
// Generates a short-lived client token for direct browser-to-Vercel-Blob uploads.
// The actual file bytes go directly from the browser to Vercel Blob storage —
// they never pass through this function, so there is no body size limit issue.

import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb' // Only token metadata passes through here, not the file
    }
  }
};

const ALLOWED_CONTENT_TYPES = [
  // Images
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/svg+xml', 'image/bmp',
  // Video
  'video/mp4', 'video/webm', 'video/quicktime', 'video/avi', 'video/x-matroska',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  // Archives
  'application/zip', 'application/x-zip-compressed',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, payload } = req.body || {};

    if (type !== 'blob.generate-client-token') {
      return res.status(400).json({ error: `Unsupported event type: ${type}` });
    }

    const { pathname } = payload || {};
    if (!pathname) {
      return res.status(400).json({ error: 'Missing pathname in payload' });
    }

    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname,
      addRandomSuffix: true,
      allowedContentTypes: ALLOWED_CONTENT_TYPES,
    });

    return res.json({ type, clientToken });
  } catch (err) {
    console.error('Blob token error:', err);
    return res.status(500).json({ error: err.message });
  }
}
