/**
 * ImageKit helper library for cloud media uploading and real-time CDN transformations.
 */
import { api } from './api.js';

/**
 * Checks whether a given URL is an ImageKit-hosted URL.
 */
export function isImageKitUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('imagekit.io') || parsed.hostname.includes('imgkit.net');
  } catch {
    return false;
  }
}

/**
 * Builds an optimized ImageKit image URL with transformations (resizing, WebP/AVIF auto-format, quality).
 * Falls back to returning original URL for non-ImageKit URLs.
 * 
 * Example:
 * buildImageUrl('https://ik.imagekit.io/demo/sample.jpg', { width: 400, height: 400 })
 * => 'https://ik.imagekit.io/demo/sample.jpg?tr=w-400,h-400,q-80,f-auto'
 */
export function buildImageUrl(url, {
  width,
  height,
  quality = 80,
  crop = 'at_max',
  format = 'auto',
  blur
} = {}) {
  if (!url || typeof url !== 'string') return '';
  if (!isImageKitUrl(url)) return url;

  try {
    const parsed = new URL(url);
    const transforms = [];

    if (width) transforms.push(`w-${Math.round(width)}`);
    if (height) transforms.push(`h-${Math.round(height)}`);
    if (crop) transforms.push(`c-${crop}`);
    if (quality) transforms.push(`q-${quality}`);
    if (format) transforms.push(`f-${format}`);
    if (blur) transforms.push(`bl-${blur}`);

    if (transforms.length === 0) return url;

    // Append as ImageKit query parameter 'tr'
    parsed.searchParams.set('tr', transforms.join(','));
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Fetches authentication signature from our backend.
 */
export async function getImageKitAuth() {
  return await api('/uploads/imagekit-auth');
}

/**
 * Directly uploads a file from the browser to ImageKit Cloud CDN with progress tracking.
 * 
 * @param {File} file - The image file to upload
 * @param {Object} options - Upload options
 * @param {string} options.folder - Destination folder (default: '/products')
 * @param {Function} options.onProgress - Progress callback receiving percentage (0-100)
 * @returns {Promise<Object>} ImageKit response object containing url, fileId, etc.
 */
export function uploadToImageKit(file, { folder = '/products', onProgress } = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Fetch server-signed credentials
      const auth = await getImageKitAuth();

      if (!auth.configured) {
        throw new Error(
          auth.message ||
          'ImageKit is not yet configured. Please set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT in your .env file.'
        );
      }

      // 2. Prepare multipart form data
      const cleanName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'image.jpg';
      const fileName = `prod_${Date.now()}_${cleanName}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', fileName);
      formData.append('publicKey', auth.publicKey);
      formData.append('signature', auth.signature);
      formData.append('expire', String(auth.expire));
      formData.append('token', auth.token);
      formData.append('folder', folder);
      formData.append('useUniqueFileName', 'true');

      // 3. Perform direct upload with XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload', true);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (err) {
            reject(new Error('Invalid JSON response from ImageKit upload'));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData.message || `Upload failed with HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with HTTP ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during ImageKit upload. Please check your internet connection.'));
      };

      xhr.send(formData);
    } catch (err) {
      reject(err);
    }
  });
}
