import { Router } from 'express';
import crypto from 'node:crypto';
import { roles } from '../auth/middleware.js';
import { requireThat } from '../../shared/errors.js';

export function uploadRoutes(config) {
  const router = Router();

  /**
   * GET /api/v1/uploads/imagekit-auth
   * Returns temporary HMAC-SHA1 authentication parameters for ImageKit client-side uploads.
   * Requires staff role (owner, manager, warehouse).
   */
  router.get('/imagekit-auth', roles('owner', 'manager'), (request, response) => {
    const hasKeys = Boolean(config.IMAGEKIT_PUBLIC_KEY && config.IMAGEKIT_PRIVATE_KEY && config.IMAGEKIT_URL_ENDPOINT);

    if (!hasKeys) {
      return response.json({
        configured: false,
        message: 'ImageKit credentials not configured on the server. Please check your .env file.',
        provider: 'mock'
      });
    }

    const token = crypto.randomUUID();
    const expire = Math.floor(Date.now() / 1000) + 1800; // 30 minutes validity
    const signature = crypto
      .createHmac('sha1', config.IMAGEKIT_PRIVATE_KEY)
      .update(token + String(expire))
      .digest('hex');

    response.json({
      configured: true,
      provider: 'imagekit',
      publicKey: config.IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: config.IMAGEKIT_URL_ENDPOINT,
      imagekitId: config.IMAGEKIT_ID || '',
      token,
      expire,
      signature
    });
  });

  return router;
}
