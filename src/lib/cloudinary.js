/**
 * Cloudinary Upload + Delete Helpers
 * Uses unsigned upload preset EVENTX for uploads.
 * Uses SHA-1 signed requests (via SubtleCrypto) for deletes.
 * NEVER commit .env — credentials are VITE_ prefixed.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;
const API_SECRET = import.meta.env.VITE_CLOUDINARY_API_SECRET;

/**
 * SHA-1 hash using SubtleCrypto (browser native — no library needed)
 */
async function sha1(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Upload a file to Cloudinary.
 * @param {File} file - The file to upload
 * @param {string} folder - Cloudinary folder path e.g. 'ece_hub/gallery'
 * @param {'auto'|'image'|'raw'|'video'} resourceType - Cloudinary resource type
 * @returns {Promise<{ url: string, public_id: string }>}
 */
export async function uploadToCloudinary(file, folder = 'ece_hub', resourceType = 'auto') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || 'Upload failed');
  }

  const data = await res.json();
  return { url: data.secure_url, public_id: data.public_id };
}

/**
 * Delete a file from Cloudinary using a signed request.
 * SYNC DELETE RULE: Always call this when removing a resource from DB.
 * @param {string} publicId - The Cloudinary public_id to delete
 * @param {'image'|'raw'|'video'} resourceType - Cloudinary resource type
 * @returns {Promise<void>}
 */
export async function deleteFromCloudinary(publicId, resourceType = 'image') {
  if (!publicId) return;

  const timestamp = Math.round(Date.now() / 1000);
  const str = `public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`;
  const signature = await sha1(str);

  const formData = new FormData();
  formData.append('public_id', publicId);
  formData.append('timestamp', String(timestamp));
  formData.append('api_key', API_KEY);
  formData.append('signature', signature);

  try {
    await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/destroy`,
      { method: 'POST', body: formData }
    );
  } catch (err) {
    console.error('[Cloudinary] Delete failed:', err);
    // Non-blocking — file may already be gone
  }
}
