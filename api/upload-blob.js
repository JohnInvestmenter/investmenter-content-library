// /api/upload-blob.js
import { put } from '@vercel/blob';

/**
 * Upload file to Vercel Blob Storage
 *
 * This endpoint accepts file uploads and stores them in Vercel Blob.
 * Returns the blob URL for use in the application.
 */

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb' // Adjust based on your needs
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
      return res.status(400).json({
        error: 'Missing required fields',
        hint: 'Please provide both file (base64) and filename'
      });
    }

    // Decode base64 file data
    const base64Data = file.replace(/^data:.+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Upload to Vercel Blob
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: contentType || 'application/octet-stream',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return res.status(200).json({
      success: true,
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
      size: buffer.length
    });

  } catch (error) {
    console.error('Blob upload error:', error);
    return res.status(500).json({
      error: 'Upload failed',
      message: error.message,
      hint: 'Check that BLOB_READ_WRITE_TOKEN is set in environment variables'
    });
  }
}
