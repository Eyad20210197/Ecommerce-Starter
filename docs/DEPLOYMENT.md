# Vercel + Coolify deployment

## Database

Provision PostgreSQL 18 with separate production and preview databases. Use a non-superuser application account. Restrict network access to the API server. For managed/cloud PostgreSQL, set DB_SSL=true; certificate verification remains enabled. Mount a provider CA file and set DB_CA_FILE if required. Do not disable certificate verification to bypass connection errors.

Use a separate migration credential where your operational setup permits it; migrations need DDL permissions, runtime does not. DB_POOL_MAX must be at least 2 when running migrations, because a dedicated connection holds the advisory lock.

Schedule backups and verify restore into an isolated database before launch. Ledger immutability triggers prevent accidental changes; a database administrator can still override them.

## API in Coolify

Create a Dockerfile application from this repository:
- Build context / base directory: `api`
- Dockerfile: `Dockerfile`
- Internal port: `4000` (or PORT)
- NODE_ENV=production
- WEB_ORIGIN=https://your-store-domain.example
- Set all required database and store settings from `api/.env.example`.
- Configure TRUST_PROXY for the actual trusted reverse-proxy addresses/subnets. Do not blindly set it to true.
- Add a stable HTTPS API domain. Vercel's server-side API_ORIGIN points to it.
- Persist data in PostgreSQL, never the API container filesystem.
- Run `npm run db:migrate` once as a deployment job before switching API traffic.
- Create the initial owner with `npm run owner:create` and temporary owner environment values.
- Check `/api/v1/ready` for readiness and `/api/v1/health` for liveness.
- Schedule `npm run maintenance` hourly to prune expired sessions and rate limits.

The Dockerfile runs as the unprivileged node user and uses a committed lockfile. It does not copy .env files into the image. Coolify provides runtime secrets.

## Frontend on Vercel

Create a separate project using the repository's `web` directory:
- Framework preset: Other
- Install: `npm ci`
- Build: `npm run build`
- Output directory: `dist`
- API_ORIGIN: the HTTPS API origin, without a path.
- STORE_NAME, STORE_DESCRIPTION, STORE_LOGO_URL, THEME_COLOR and LANGUAGE as desired.

`web/vercel.mjs` reads API_ORIGIN at deployment/config evaluation and creates an external rewrite for /api/*.
The browser always calls its own origin. This allows first-party HttpOnly Secure session cookies without cross-site cookie dependencies.
Use different backend origins/databases for Vercel preview deployments. A backend currently accepts exactly one WEB_ORIGIN.

Vercel supports JavaScript programmatic configuration: https://vercel.com/docs/project-configuration/vercel-ts

Do not include secrets in frontend branding variables or files. API_ORIGIN is used by server routing; it is not included in brand.js.

## Before accepting traffic

Verify actual mobile and desktop shopping, guest order recovery, account login, add-to-cart, concurrent stock purchase, invoice print, staff permission failures, COD collection and return receipt/refund.
Verify Secure/HttpOnly/SameSite cookies, no-store API responses, CORS, CSP and actual client-IP behavior through Vercel and Coolify.
Confirm SSE inventory updates are streamed through both proxies, with buffering disabled; checkout always checks live stock even if the stream is disconnected.
Test database outage readiness and SIGTERM shutdown.
Complete restore rehearsal, configure log/error alerts, set seller details/return policy/taxes and replace demo content.
Deploy only after STATUS.md's outstanding launch items have been addressed.

