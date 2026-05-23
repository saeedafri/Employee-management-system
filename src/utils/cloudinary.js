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
 * @returns {Promise<{ url: string, publicId: string, bytes: number, format: string }>}
 */
export async function uploadToCloudinary(buffer, { folder, publicId, resourceType = 'auto' }) {
  ensureConfigured();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: resourceType, overwrite: true },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          bytes: result.bytes,
          format: result.format,
        });
      },
    );
    uploadStream.end(buffer);
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
