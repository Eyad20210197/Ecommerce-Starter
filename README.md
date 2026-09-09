# Reusable commerce starter

Express 5 / Node.js 24 JavaScript API, PostgreSQL, and a minimal responsive JavaScript storefront. Frontend assets are deployed on Vercel; the API is a Docker application for Coolify. Bootstrap CSS is loaded from a pinned jsDelivr URL with Subresource Integrity. No third-party runtime JavaScript is loaded by the browser.

**Status: working, tested COD core; not yet signed off for production launch.** See [STATUS.md](STATUS.md) for the exact verification and remaining work. Do not enable the staged Stripe adapter.

## Run locally

Requirements: Node.js 24, npm, PostgreSQL 18

1. Start local PostgreSQL with `docker compose up -d database`, or provision a separate database.
2. Copy `api/.env.example` to `api/.env`. Set DATABASE_URL and WEB_ORIGIN. The example frontend origin is `http://127.0.0.1:3000`.
3. In `api`: `npm ci`, then `npm run db:migrate`.
4. Create the first owner using temporary environment variables OWNER_EMAIL, OWNER_NAME and OWNER_PASSWORD (at least 16 characters), then `npm run owner:create`. Remove the password from your shell environment afterward. There are no default owner credentials. To reset an existing owner's password, set `OWNER_PASSWORD` (and optionally `OWNER_EMAIL`) and run `npm run owner:reset-password`.
5. Optionally run `npm run db:seed` in development. Demo seeding is forbidden in production.
6. In `api`: `npm run dev`.
7. Copy `web/.env.example` to `web/.env`; in `web`: `npm ci`, then `npm run dev`.
8. Open `http://127.0.0.1:3000`. Sign in as the owner to manage products, staff, stock, and orders.

The database created during automated development verification was isolated in the operating-system temporary directory. It is not required by this project.

## Reuse for another store

Change API environment variables for store identity, seller/invoice details, currency, language, tax basis points, shipping fee, return window and integration settings. USD and English are defaults. Change web environment variables for page title, description, logo URL and theme color. Change `web/src/styles.css` for further theme customization. API STORE_NAME and frontend STORE_NAME should match.

Each deployed project uses its own database and credentials. This is a single-store application, not multi-tenant SaaS.

Customer and employee identities use random, hashed, server-stored sessions. Roles are customer, owner, manager and warehouse. Owner bootstrapping is command-line only; employees cannot create owners. Changing an employee's role or active status revokes their sessions.

## Included COD workflows

- Public catalog with categories, tags, full-text/partial search, price and availability filters.
- Guest/customer carts, registration, login, profile, password changes and saved addresses.
- Transactional checkout with server-calculated integer prices and durable idempotency.
- Per-product inventory reservations, row locking, stock movements and unique serial numbers.
- Order preparation, dispatch, delivery, explicit COD collection, completion and cancellation.
- Whole-order returns: request, approval, physical receipt/inspection, optional restock, separate refund.
- Order snapshots and printable HTML invoices; guest orders use private access links.
- Owner, store-manager and warehouse workspaces; server-side role and ownership enforcement.
- Sales, order, collection, refund and inventory reports; append-only audit/payment/stock records.
- PostgreSQL notifications and server-sent inventory updates.
- Opt-in configured currency conversion, English/Arabic interfaces and product translations.
- Disabled Google SSO, customer-service, AI chatbot and logistics placeholders shown only in owner settings.

## Policies and limits

Stock is reserved when an order is placed and issued on dispatch. Pre-dispatch cancellation releases it exactly once. Delivery does not imply cash collection. Only the owner records refunds; the manager can collect COD. Full refunds include shipping and tax. Returns cover the entire order, within RETURN_WINDOW_DAYS; partial returns are not implemented. Unpaid COD returns do not create money refunds.

Product tracking mode is immutable after creation. Archive products to preserve historical references. Products support up to 12 HTTPS gallery photos; the first photo is the main card and default product-page photo. Managers choose the main photo in the same product editor and can upload through ImageKit when configured.

Monetary amounts are integer minor units in each currency. CURRENCY_RATES are manually configured units of each target currency per base-currency unit; order rates and amounts are snapshotted. These are not live FX quotes. Pricing and inventory value use retail prices; no cost/profit accounting is included.

Tax is a single configured percentage, not a jurisdiction-specific tax engine. Seller details must be supplied before launch. Invoice format/legal numbering requirements must be reviewed for the deployment's jurisdiction.

## Architecture

`api/src/features/` owns auth, catalog, cart, inventory, orders, integrations and admin routes/services.
`api/src/shared/` provides narrow database, money, security, logging and error helpers.
`api/src/infrastructure/` owns PostgreSQL connectivity, migrations and inventory notifications.
`api/src/app.js` composes HTTP middleware and features; `server.js` handles lifecycle.
`web/src/` contains the storefront, customer screens and role-gated management screens.

Use bound SQL parameters. Keep writes and their ledger/audit entries in the same transaction. Lock inventory in product-ID order and lock an order before transitions. Never use schema sync in production, mutate ledger rows, or trust browser totals.

## Checks

API: `npm run check`, `npm test`.
Integration: set INTEGRATION_DATABASE_URL to a disposable PostgreSQL database whose name ends with `_test`, then `npm run test:integration`. The test migrates that database and creates uniquely named fixtures.
Frontend: `npm run build`, `npm test`.

See [deployment instructions](docs/DEPLOYMENT.md), [integration contracts](docs/INTEGRATIONS.md), and [remaining work](STATUS.md).
