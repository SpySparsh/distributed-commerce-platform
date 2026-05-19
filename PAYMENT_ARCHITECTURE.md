# Payment Architecture

This foundation treats payment state as provider-confirmed state, not frontend-confirmed state.

## Flow

1. Client calls `POST /payments` with `tenantId`, `orderId`, amount, currency, and an idempotency key.
2. API creates or reuses a local `Payment` row in `pending` status.
3. API creates a provider payment object with the same idempotency key.
4. Client receives provider confirmation data, such as Stripe `client_secret` or Razorpay `order_id`.
5. Provider sends signed webhooks to `POST /payments/webhooks/:provider`.
6. API verifies the signature, records the webhook event, then applies state changes transactionally.

## Consistency Rules

- The frontend never marks an order paid.
- Webhooks are written to `PaymentWebhookEvent` before business state is applied.
- Webhook processing is idempotent through `(tenantId, provider, providerEventId)`.
- Payment initiation is idempotent through `(tenantId, idempotencyKey)`.
- Order state changes happen in the same transaction as payment state changes.

## Provider Strategy

The API exposes a small `PaymentProviderClient` interface:

- `createPayment`
- `verifyWebhook`

Stripe and Razorpay adapters sit behind that interface. SDKs can replace the HTTP implementation later without changing routes, repositories, or business services.

## Webhook Verification

Stripe verification uses:

- `Stripe-Signature`
- timestamp tolerance
- HMAC SHA-256 over `timestamp.rawBody`

Razorpay verification uses:

- `x-razorpay-signature`
- HMAC SHA-256 over the raw body

Production deployments should preserve the raw request body for webhook routes. If a JSON parser mutates formatting before verification, signatures will fail.

## Retry Handling

Failed payments can be scheduled through `POST /payments/retry`. The API records retry metadata and enqueues `payment.retry` in BullMQ.

Workers should perform retry attempts asynchronously and rely on webhooks/reconciliation for final truth. This prevents API requests from blocking on slow provider calls.

## Reconciliation

Reconciliation should run as a scheduled worker that:

1. Finds `pending`, `authorized`, or recently `failed` payments.
2. Fetches provider truth by `providerPaymentId`.
3. Applies the same repository state transition path as webhooks.
4. Emits alerts for local/provider mismatches.

This covers missed webhooks, provider outages, and deploy windows.

## Tradeoffs

- Webhooks are eventually consistent, so users may briefly see `pending`.
- The local database is the application source of truth, but provider APIs are the financial source of truth.
- Idempotency keys are required because network retries can happen at every layer.
- Payment and order state are coupled only at the state transition boundary, keeping provider details out of order logic.
