# Implementation checkpoint

## Verified in this version

- API JavaScript syntax checks passed.
- 8 API/unit tests passed.
- PostgreSQL integration suite passed (9 scenario subtests plus parent).
- Verified concurrent last-unit purchase protection, parallel checkout idempotency, changed-payload rejection, guest ownership, warehouse permissions, single-effect cancellation, COD collection/completion/return/refund, serial return validation/history, CSRF/parser error handling and immutable ledgers.
- Frontend JavaScript syntax, static build, and build-configuration test passed.
- Migration ran against real isolated PostgreSQL 18.

## Not production signed off

1. No Vercel project, Coolify server, deployment credentials, domain or production database was supplied; nothing has been deployed.
2. Browser interaction/responsive/accessibility QA and provider/end-to-end deployment smoke tests remain.
3. Stripe code is staged and intentionally blocked by configuration validation. Durable payment-attempt reconciliation, uncertain Checkout creation, pending refund fulfillment blocking and provider webhook acceptance tests must be finished before enabling it. `integration_jobs` schema exists for this work; processing is not implemented.
4. Generic shipping adapter needs a provider-specific implementation or middleware matching the documented contract, and provider acceptance tests.
5. The dependency audit previously identified the UUID advisory through Sequelize; verify and resolve/accept its actual reachability before launch. Do not run audit fix --force blindly.
6. Verify TLS, exact reverse-proxy trust/IP rate limiting, backup restoration, operational alerts, migrations and shutdown on the chosen VPS.
7. Public UI supports Arabic, but remaining secondary admin labels, validation errors and invoice language need a complete localization pass.
8. Inventory listing currently returns up to 200 products, serial browsing up to 500 rows, and reports top 50 rows. Add server pagination/search/export before stores exceed those working limits.
9. Automated tests should expand to failure injection, auth/password concurrency, shipping integration, browser workflows, deployment security headers and multi-currency checkout.
10. Password recovery/email verification, partial returns and file uploads are not included in this implementation. Decide their launch policy explicitly.
11. Demo catalog has no product photographs. Supply real store content and CDN images before launch.

## Next work order

First finish browser/API workflow QA and any failures, then complete optional integrations if required, then address deployment configuration and operational acceptance. Keep PAYMENT_PROVIDER=cod while Stripe remains staged. Keep future features disabled.

User requested a reusable store with Vercel frontend, Docker/Coolify API, PostgreSQL, environment-based feature selection, English and USD defaults. Quota warning prompted saving this explicit checkpoint rather than claiming launch readiness.

