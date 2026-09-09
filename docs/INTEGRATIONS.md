# Optional integrations

## Payment

Cash on delivery is enabled by default and tested. The Stripe adapter is present for continued implementation but blocked by readEnv. Setting PAYMENT_PROVIDER=stripe currently fails startup deliberately.

Before unblocking it, finish durable provider attempt storage and reconciliation in integration_jobs:
- Persist exact Checkout parameters/idempotency key before contacting Stripe.
- Reconcile a created session if the response or local commit was lost; cancellation must not release stock while a remote session may remain payable.
- Persist pending refund state and provider refund ID; block fulfillment while uncertain and retrieve current provider status.
- Deduplicate and validate signed webhooks against order, provider session, amount and currency.
- Test races, timeouts, retries, expiry and refunds with Stripe's test environment.

Never treat a success-page redirect as payment confirmation. Do not enable online payments solely because keys are present.

## Shipping

SHIPPING_PROVIDER=manual is the default. Staff records a shipment reference and optional HTTPS tracking URL. Shipment references are unique.

SHIPPING_PROVIDER=webhook enables an adapter contract for project-specific carrier middleware:
- SHIPPING_API_URL: HTTPS endpoint controlled by your integration.
- SHIPPING_API_TOKEN: Bearer credential.
- SHIPPING_WEBHOOK_SECRET: random secret of at least 32 characters.

The API POSTs JSON containing orderId, number, contact, address, items, currency and collectOnDeliveryMinor.
It sends Idempotency-Key: shipment:<orderId>. The receiving adapter MUST permanently deduplicate this key and return the same shipment after ambiguous retries.
Successful JSON response: {"reference":"unique-carrier-reference","tracking_url":"https://carrier.example/track/123"}.
Creating a shipment does not dispatch stock automatically; warehouse staff confirms dispatch.

Delivery callback: POST /api/v1/webhooks/shipping with raw JSON:
{"eventId":"unique-event-id","reference":"unique-carrier-reference","status":"delivered"}.
Header X-Shipping-Signature is "<unix-seconds>.<hex-hmac-sha256>" where signed bytes are timestamp + "." + exact raw body.
Events older than five minutes are rejected. Event IDs are deduplicated. Delivery callbacks do not collect COD.
Provider-specific rates, purchasing labels and carrier credentials belong in your adapter; no carrier account was selected or validated.

## Currency/language

MULTI_CURRENCY=true plus CURRENCY_RATES={"EUR":0.9,"JPY":150} enables server-calculated order amounts and frontend selection. Rates are manually configured against base CURRENCY. Configure project-specific rounding/pricing policy before launch.
MULTI_LANGUAGE=true enables English/Arabic selection and RTL layout. Staff can enter Arabic product/category names. Complete the remaining language QA listed in STATUS.md.

Future Google SSO, customer-service role/dashboard, AI chatbot and logistics role/dashboard are hard-disabled and have no routes or privileges.

