import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/index.js';

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (!config.cloudinaryCloudName || !config.cloudinaryApiKey || !config.cloudinaryApiSecret) {
    throw new Error('Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET env vars.');
  }
  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
    secure: true,
  });
  configured = true;
}

/**
 * Upload a buffer to Cloudinary.
 * @param {Buffer} buffer - File buffer
 * @param {object} opts
 * @param {string} opts.folder - Cloudinary folder path
 * @param {string} opts.publicId - Unique identifier
 * @param {string} opts.resourceType - 'image' | 'raw' | 'auto'
 * @param {string} opts.type - Delivery type. Use 'authenticated' for private PII
 *   (documents) so the raw URL is NOT publicly deliverable; 'upload' (default,
 *   public) for low-sensitivity assets like profile avatars.
 * @returns {Promise<{ url: string, publicId: string, bytes: number, format: string, resourceType: string, type: string }>}
 */
export async function uploadToCloudinary(buffer, { folder, publicId, resourceType = 'auto', type = 'upload' }) {
  ensureConfigured();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: resourceType, type, overwrite: true },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          bytes: result.bytes,
          format: result.format,
          resourceType: result.resource_type,
          type: result.type,
        });
      },
    );
    uploadStream.end(buffer);
  });
}

/**
 * Generate a short-lived, signed download URL for an access-controlled
 * ('authenticated') asset. The URL carries a signature + expiry; without them
 * Cloudinary returns 401, so a permanent public link is never exposed.
 * @param {object} opts
 * @param {string} opts.storageKey - Cloudinary public_id
 * @param {string} opts.mimeType - stored mime type (drives image vs raw)
 * @param {number} opts.expiresInSec - link lifetime (default 300s)
 * @returns {string} signed URL
 */
export function getSignedDocumentUrl({ storageKey, mimeType, expiresInSec = 300 }) {
  ensureConfigured();
  const resourceType = mimeType?.startsWith('image/') ? 'image' : 'raw';
  const format = resourceType === 'image' ? 'webp' : '';
  const expires_at = Math.floor(Date.now() / 1000) + expiresInSec;
  return cloudinary.utils.private_download_url(storageKey, format, {
    resource_type: resourceType,
    type: 'authenticated',
    expires_at,
    attachment: true,
  });
}

/**
 * Migrate an existing public ('upload') asset to access-controlled
 * ('authenticated') delivery, keeping the same public_id. Idempotent-ish:
 * a second run for an already-authenticated asset throws "not found" which the
 * caller should treat as already-migrated. Reversible by swapping type/to_type.
 */
export async function moveToAuthenticated({ publicId, resourceType = 'raw' }) {
  ensureConfigured();
  return cloudinary.uploader.rename(publicId, publicId, {
    resource_type: resourceType,
    type: 'upload',
    to_type: 'authenticated',
    overwrite: true,
    invalidate: true,
  });
}

/**
 * Delete a file from Cloudinary by publicId.
 */
export async function deleteFromCloudinary(publicId, resourceType = 'auto') {
  ensureConfigured();
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

export function isCloudinaryConfigured() {
  return !!(config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret);
}
