import test from 'node:test';
import assert from 'node:assert/strict';
import { storeConfig, themePresets } from '../src/config/store.config.js';
import { t, getDirection, dictionary } from '../src/lib/i18n.js';
import { formatMoney, productName, productDescription } from '../src/lib/formatters.js';
import { setCsrfToken, getCsrfToken } from '../src/lib/api.js';
import { isImageKitUrl, buildImageUrl } from '../src/lib/imagekit.js';

test('storeConfig has complete branding, feature matrix, and theme presets', () => {
  // Brand identity
  assert.ok(storeConfig.brand.name);
  assert.ok(storeConfig.brand.description);
  assert.ok(storeConfig.brand.supportEmail);

  // Theme tokens
  assert.ok(storeConfig.theme.primary);
  assert.ok(storeConfig.theme.surface);
  assert.ok(storeConfig.theme.ink);
  assert.ok(storeConfig.theme.radius);

  // Theme presets
  assert.ok(themePresets.modern_emerald);
  assert.ok(themePresets.midnight_slate);
  assert.ok(themePresets.warm_amber);
  assert.ok(themePresets.pure_mono);
  assert.ok(themePresets.royal_indigo);

  // Feature flags
  const features = storeConfig.features;
  assert.strictEqual(typeof features.cashOnDelivery, 'boolean');
  assert.strictEqual(typeof features.onlinePayment, 'boolean');
  assert.strictEqual(typeof features.serialNumberTracking, 'boolean');
  assert.strictEqual(typeof features.orderReturns, 'boolean');
  assert.strictEqual(typeof features.liveInventoryUpdates, 'boolean');
  assert.strictEqual(typeof features.savedAddresses, 'boolean');
  assert.strictEqual(typeof features.invoices, 'boolean');
  assert.strictEqual(typeof features.guestCheckout, 'boolean');
});

test('i18n dictionary translates keys and detects text direction', () => {
  // English translation
  assert.strictEqual(t('Add to cart', 'en'), 'Add to cart');

  // Arabic translation
  assert.strictEqual(t('Add to cart', 'ar'), 'أضف للسلة');
  assert.strictEqual(t('Checkout', 'ar'), 'إتمام الطلب');
  assert.strictEqual(t('Search products & tags', 'ar'), 'البحث عن منتجات ووسوم');
  assert.strictEqual(t('Matching tags', 'ar'), 'وسوم مطابقة');
  assert.strictEqual(t('Tags', 'ar'), 'الوسوم');
  assert.strictEqual(t('Clear all', 'ar'), 'مسح الكل');

  // Unknown key fallback
  assert.strictEqual(t('Custom Unmapped String', 'en'), 'Custom Unmapped String');
  assert.strictEqual(t('Custom Unmapped String', 'ar'), 'Custom Unmapped String');

  // Text direction
  assert.strictEqual(getDirection('ar'), 'rtl');
  assert.strictEqual(getDirection('en'), 'ltr');
  assert.strictEqual(getDirection('fr'), 'ltr');
});

test('formatters handle integer minor money and localized fields', () => {
  // Money formatting
  const formattedUsd = formatMoney(2500, 'USD', null, 'USD', 'en', false);
  assert.ok(formattedUsd.includes('25'));

  // Multi-currency conversion
  const rates = { USD: 1, EUR: 0.92, EGP: 48.5 };
  const convertedEur = formatMoney(10000, 'EUR', rates, 'USD', 'en', true);
  assert.ok(convertedEur.includes('92'));

  // Localized product details
  const product = {
    name: 'Leather Notebook',
    description: 'Handcrafted notebook.',
    translations: {
      ar: {
        name: 'دفتر جلدي',
        description: 'دفتر جلدي مصنوع يدوياً.'
      }
    }
  };

  assert.strictEqual(productName(product, 'en'), 'Leather Notebook');
  assert.strictEqual(productName(product, 'ar'), 'دفتر جلدي');
  assert.strictEqual(productDescription(product, 'ar'), 'دفتر جلدي مصنوع يدوياً.');

  // Fallback to English if translation is missing
  const productNoAr = { name: 'Canvas Bag', description: 'Heavy canvas.' };
  assert.strictEqual(productName(productNoAr, 'ar'), 'Canvas Bag');
  assert.strictEqual(productDescription(productNoAr, 'ar'), 'Heavy canvas.');
});

test('api client CSRF token state management', () => {
  assert.strictEqual(getCsrfToken(), null);
  setCsrfToken('test-csrf-token-12345');
  assert.strictEqual(getCsrfToken(), 'test-csrf-token-12345');
  setCsrfToken(null);
  assert.strictEqual(getCsrfToken(), null);
});

