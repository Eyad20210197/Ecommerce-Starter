import { z } from 'zod';

const flag = z.enum(['true', 'false']).default('false').transform(value => value === 'true');
const origin = z.url().refine(value => {
  let url; try { url = new URL(value); } catch { return false; }
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
}, 'Use an HTTP(S) origin without a path').transform(value => new URL(value).origin);
const databaseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url().refine(value => {
    let url; try { url = new URL(value); } catch { return false; }
    return ['postgres:', 'postgresql:'].includes(url.protocol) && Boolean(url.hostname) && url.pathname.length > 1;
  }),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DB_SSL: flag,
  DB_CA_FILE: z.string().default(''),
});
const schema = databaseSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: origin,
  TRUST_PROXY: z.string().default('loopback'),
  STORE_NAME: z.string().trim().min(1).max(80).default('Store'),
  STORE_ADDRESS: z.string().max(300).default(''),
  STORE_EMAIL: z.union([z.email(), z.literal('')]).default(''),
  STORE_TAX_ID: z.string().max(80).default(''),
  CURRENCY: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  LANGUAGE: z.enum(['en', 'ar']).default('en'),
  MULTI_CURRENCY: flag,
  MULTI_LANGUAGE: flag,
  CURRENCY_RATES: z.string().default('{}'),
  SHIPPING_FEE_MINOR: z.coerce.number().int().min(0).max(10000000).default(0),
  TAX_BPS: z.coerce.number().int().min(0).max(10000).default(0),
  RETURN_WINDOW_DAYS: z.coerce.number().int().min(1).max(365).default(14),
  PAYMENT_PROVIDER: z.enum(['cod', 'stripe']).default('cod'),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  SHIPPING_PROVIDER: z.enum(['manual', 'webhook']).default('manual'),
  SHIPPING_API_URL: z.union([z.url(), z.literal('')]).default(''),
  SHIPPING_API_TOKEN: z.string().default(''),
  SHIPPING_WEBHOOK_SECRET: z.string().default(''),
  SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  LOG_LEVEL: z.enum(['info', 'error']).default('info'),
  IMAGEKIT_PUBLIC_KEY: z.string().default(''),
  IMAGEKIT_PRIVATE_KEY: z.string().default(''),
  IMAGEKIT_URL_ENDPOINT: z.string().default(''),
  IMAGEKIT_ID: z.string().default(''),
});
function parse(target, source) {
  const result = target.safeParse(source);
  if (!result.success) throw new Error('Invalid environment fields: ' + [...new Set(result.error.issues.map(issue => issue.path.join('.')))].join(', '));
  return result.data;
}
export const readDatabaseEnv = (source = process.env) => parse(databaseSchema, source);
export function readEnv(source = process.env) {
  const config = parse(schema, source);
  if (config.NODE_ENV === 'production' && !config.WEB_ORIGIN.startsWith('https://')) throw new Error('WEB_ORIGIN must use HTTPS in production');
  try {
    const rates = JSON.parse(config.CURRENCY_RATES);
    if (!rates || Array.isArray(rates) || typeof rates !== 'object') throw new Error();
    config.rates = { [config.CURRENCY]: 1 };
    for (const [currency, rate] of Object.entries(rates)) {
      if (!/^[A-Z]{3}$/.test(currency) || typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0 || rate > 100000) throw new Error();
      new Intl.NumberFormat('en', { style: 'currency', currency });
      config.rates[currency] = rate;
    }
    config.rates[config.CURRENCY] = 1;
    if (!config.MULTI_CURRENCY) config.rates = { [config.CURRENCY]: 1 };
  } catch { throw new Error('Invalid environment fields: CURRENCY_RATES'); }
  if (config.PAYMENT_PROVIDER === 'stripe') throw new Error('Stripe is staged but disabled pending payment reconciliation and provider acceptance tests. Use PAYMENT_PROVIDER=cod.');
  if (config.SHIPPING_PROVIDER === 'webhook' && (!config.SHIPPING_API_URL.startsWith('https://') || !config.SHIPPING_API_TOKEN || config.SHIPPING_WEBHOOK_SECRET.length < 32)) throw new Error('Shipping HTTPS endpoint and credentials are required');
  return config;
}
