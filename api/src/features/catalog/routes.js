import { Router } from 'express';
import { z } from 'zod';
import { validate, requireThat } from '../../shared/errors.js';
import { roles } from '../auth/middleware.js';
export const productSchema = z.object({
  sku: z.string().trim().min(1).max(80), name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(8000).default(''),
  price_minor: z.number().int().min(0).max(100000000),
  category_id: z.uuid().nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  image_url: z.union([z.url().refine(value => new URL(value).protocol === 'https:'), z.literal('')]).default(''),
  images: z.array(z.object({
    url: z.url().refine(value => new URL(value).protocol === 'https:'),
    alt: z.string().trim().max(160).default(''),
  }).strict()).max(12).default([]),
  translations: z.object({ ar: z.object({ name: z.string().max(160), description: z.string().max(8000).default('') }).optional() }).default({}),
  active: z.boolean().default(true), serialized: z.boolean().default(false),
}).strict();

const imageProjection = `COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'id',pi.id,'url',pi.url,'alt',pi.alt,'position',pi.position,'is_primary',pi.is_primary
) ORDER BY pi.position) FROM product_images pi WHERE pi.product_id=p.id), '[]'::jsonb) AS images`;

function normaliseImages(data) {
  const images = data.images.length ? data.images : (data.image_url ? [{ url: data.image_url, alt: data.name }] : []);
  requireThat(new Set(images.map(image => image.url)).size === images.length, 400, 'DUPLICATE_IMAGE', 'Each product photo must use a different URL.');
  return images;
}

async function replaceImages(store, productId, images, transaction) {
  await store.rows('DELETE FROM product_images WHERE product_id=$product RETURNING id', { product: productId }, transaction);
  for (const [position, image] of images.entries()) {
    await store.rows(`INSERT INTO product_images(product_id,url,alt,position,is_primary)
      VALUES($product,$url,$alt,$position,$primary) RETURNING id`,
    { product: productId, url: image.url, alt: image.alt, position, primary: position === 0 }, transaction);
  }
  await store.rows('UPDATE products SET image_url=$url WHERE id=$id RETURNING id', { id: productId, url: images[0]?.url || '' }, transaction);
}
export function catalogRoutes(store) {
  const router = Router();
  router.get('/categories', async (request, response) => response.json({ categories: await store.rows('SELECT * FROM categories ORDER BY name') }));
  router.get('/products', async (request, response) => {
    const query = validate(z.object({
      q: z.string().max(100).default(''), category: z.union([z.uuid(), z.literal('')]).default(''),
      tag: z.string().max(40).default(''), available: z.enum(['true','false']).default('false'),
      min: z.coerce.number().int().min(0).default(0), max: z.coerce.number().int().min(0).max(100000000).default(100000000),
      page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(100).default(24),
      sort: z.enum(['newest','price_asc','price_desc','name']).default('newest'),
      all: z.enum(['true','false']).default('false'),
    }), request.query);
    const staff = ['owner','manager','warehouse'].includes(request.user?.role);
    const sort = { newest: 'p.created_at DESC,p.id', price_asc: 'p.price_minor,p.id', price_desc: 'p.price_minor DESC,p.id', name: 'p.name,p.id' }[query.sort];
    const where = `WHERE ($all OR p.active) AND ($category = '' OR p.category_id::text=$category)
      AND ($q = '' OR to_tsvector('simple',p.name || ' ' || p.description || ' ' || p.sku) @@ plainto_tsquery('simple',$q) OR p.name ILIKE $pattern OR p.sku ILIKE $pattern)
      AND ($tag = '' OR $tag = ANY(p.tags)) AND (NOT $available OR p.on_hand-p.reserved > 0)
      AND p.price_minor BETWEEN $min AND $max`;
    const bind = { ...query, all: staff && query.all === 'true', available: query.available === 'true', pattern: '%' + query.q.replace(/[\\%_]/g, '\\$&') + '%', offset: (query.page-1)*query.limit };
    const products = await store.rows(`SELECT p.*,c.name AS category_name,p.on_hand-p.reserved AS available,${imageProjection} FROM products p LEFT JOIN categories c ON c.id=p.category_id ${where} ORDER BY ${sort} LIMIT $limit OFFSET $offset`, bind);
    const count = await store.one(`SELECT count(*)::int AS total FROM products p ${where}`, bind);
    const tags = await store.rows('SELECT DISTINCT unnest(tags) AS tag FROM products WHERE active ORDER BY tag LIMIT 100');
    response.json({ products, ...count, page: query.page, tags: tags.map(row => row.tag) });
  });
  router.get('/products/:id', async (request, response) => {
    const id = validate(z.uuid(), request.params.id);
    const product = await store.one(`SELECT p.*,c.name AS category_name,p.on_hand-p.reserved AS available,${imageProjection}
      FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=$id AND (p.active OR $staff)`, { id, staff: ['owner','manager','warehouse'].includes(request.user?.role) });
    requireThat(product, 404, 'NOT_FOUND', 'Product not found.'); response.json({ product });
  });
  router.post('/categories', roles('owner','manager'), async (request, response) => {
    const data = validate(z.object({ name: z.string().trim().min(1).max(80), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), translations: z.object({ ar: z.string().max(80).optional() }).default({}) }).strict(), request.body);
    const category = await store.tx(async transaction => {
      const result = await store.one('INSERT INTO categories(name,slug,translations) VALUES($name,$slug,$translations::jsonb) RETURNING *', { ...data, translations: JSON.stringify(data.translations) }, transaction);
      await store.audit(request.user.id, 'category.created', 'category', result.id, { name: data.name }, transaction); return result;
    });
    response.status(201).json({ category });
  });
  router.patch('/categories/:id', roles('owner','manager'), async (request, response) => {
    const id = validate(z.uuid(), request.params.id);
    const data = validate(z.object({ name: z.string().trim().min(1).max(80), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), translations: z.object({ ar: z.string().max(80).optional() }).default({}) }).strict(), request.body);
    const category = await store.tx(async transaction => {
      const result = await store.one('UPDATE categories SET name=$name,slug=$slug,translations=$translations::jsonb WHERE id=$id RETURNING *', { ...data, id, translations: JSON.stringify(data.translations) }, transaction);
      requireThat(result, 404, 'NOT_FOUND', 'Category not found.');
      await store.audit(request.user.id, 'category.updated', 'category', id, { name: data.name }, transaction); return result;
    }); response.json({ category });
  });
  router.delete('/categories/:id', roles('owner','manager'), async (request, response) => {
    const id = validate(z.uuid(), request.params.id);
    await store.tx(async transaction => {
      const category = await store.one('SELECT id FROM categories WHERE id=$id FOR UPDATE', { id }, transaction);
      requireThat(category, 404, 'NOT_FOUND', 'Category not found.');
      const used = await store.one('SELECT id FROM products WHERE category_id=$id LIMIT 1', { id }, transaction);
      requireThat(!used, 409, 'CATEGORY_IN_USE', 'Move products to another category first.');
      await store.rows('DELETE FROM categories WHERE id=$id RETURNING id', { id }, transaction);
      await store.audit(request.user.id, 'category.deleted', 'category', id, {}, transaction);
    }); response.status(204).end();
  });
  router.post('/products', roles('owner','manager'), async (request, response) => {
    const data = validate(productSchema, request.body);
    const images = normaliseImages(data);
    const product = await store.tx(async transaction => {
      const result = await store.one(`INSERT INTO products(sku,name,description,price_minor,category_id,tags,image_url,translations,active,serialized)
        VALUES($sku,$name,$description,$price_minor,$category_id,$tags,$image_url,$translations::jsonb,$active,$serialized) RETURNING *`, { ...data, translations: JSON.stringify(data.translations) }, transaction);
      await replaceImages(store, result.id, images, transaction);
      result.images = images.map((image, position) => ({ ...image, position, is_primary: position === 0 }));
      result.image_url = images[0]?.url || '';
      await store.audit(request.user.id, 'product.created', 'product', result.id, { sku: data.sku, imageCount: images.length }, transaction); return result;
    }); response.status(201).json({ product });
  });
  router.patch('/products/:id', roles('owner','manager'), async (request, response) => {
    const id = validate(z.uuid(), request.params.id);
    const { version, ...data } = validate(productSchema.extend({ version: z.number().int().positive() }), request.body);
    const images = normaliseImages(data);
    const product = await store.tx(async transaction => {
      const before = await store.one('SELECT * FROM products WHERE id=$id FOR UPDATE', { id }, transaction);
      requireThat(before, 404, 'NOT_FOUND', 'Product not found.');
      requireThat(before.version === version, 409, 'STALE_PRODUCT', 'This product changed. Refresh before saving.');
      requireThat(before.serialized === data.serialized, 409, 'TRACKING_IMMUTABLE', 'Create a new SKU to change serial tracking.');
      const result = await store.one(`UPDATE products SET sku=$sku,name=$name,description=$description,price_minor=$price_minor,category_id=$category_id,tags=$tags,
        translations=$translations::jsonb,active=$active,version=version+1,updated_at=now() WHERE id=$id RETURNING *`, { ...data, id, translations: JSON.stringify(data.translations) }, transaction);
      await replaceImages(store, id, images, transaction);
      result.images = images.map((image, position) => ({ ...image, position, is_primary: position === 0 }));
      result.image_url = images[0]?.url || '';
      await store.audit(request.user.id, 'product.updated', 'product', id, { before: { price_minor: before.price_minor, active: before.active }, after: { price_minor: result.price_minor, active: result.active, imageCount: images.length } }, transaction); return result;
    }); response.json({ product });
  });
  router.delete('/products/:id', roles('owner','manager'), async (request, response) => {
    const id = validate(z.uuid(), request.params.id);
    await store.tx(async transaction => {
      const product = await store.one('UPDATE products SET active=false,version=version+1,updated_at=now() WHERE id=$id RETURNING id', { id }, transaction);
      requireThat(product, 404, 'NOT_FOUND', 'Product not found.');
      await store.audit(request.user.id, 'product.archived', 'product', id, {}, transaction);
    }); response.status(204).end();
  });
  return router;
}
