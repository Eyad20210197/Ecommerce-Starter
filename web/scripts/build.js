import { build } from 'vite';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist');

const name = process.env.STORE_NAME || process.env.VITE_STORE_NAME || 'Store';
const description = process.env.STORE_DESCRIPTION || process.env.VITE_STORE_DESCRIPTION || 'Shop our collection.';
const color = process.env.THEME_COLOR || process.env.VITE_THEME_PRIMARY || '#17211e';
const logo = process.env.STORE_LOGO_URL || process.env.VITE_STORE_LOGO_URL || '';
const language = process.env.LANGUAGE || 'en';

if (!/^#[a-f0-9]{6}$/i.test(color)) throw new Error('THEME_COLOR must be a six-digit hex color');
if (logo && new URL(logo).protocol !== 'https:') throw new Error('STORE_LOGO_URL must use HTTPS');
if (!['en', 'ar'].includes(language)) throw new Error('LANGUAGE must be en or ar');

await build({
  root,
  configFile: path.join(root, 'vite.config.js'),
});

await writeFile(path.join(out, 'brand.js'), 'export const brand = ' + JSON.stringify({ name, description, logo, language }) + ';\n');
await writeFile(path.join(out, 'theme.css'), ':root { --brand: ' + color + '; }\n');

console.log('Storefront built successfully in web/dist');


