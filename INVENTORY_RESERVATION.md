# Inventory Reservation Architecture

This foundation reserves inventory during checkout without relying on naive stock decrements.

## Core Model

Inventory is tracked with two counters:

- `InventoryItem.quantity`: sellable physical stock currently owned by the platform.
- `InventoryItem.reserved`: stock temporarily held by active checkout reservations.

Available stock is always computed as:

```text
quantity - reserved - safetyStock
```

Reservations are explicit lifecycle records:

- `active`: stock is held for a checkout/cart flow.
- `consumed`: order placement completed and stock was permanently deducted.
- `released`: customer or checkout flow released the hold.
- `expired`: worker cleanup released an abandoned hold.

## Reservation Flow

1. API receives `POST /inventory/reservations`.
2. Service acquires a short Redis lock for `tenantId + variantId`.
3. Repository runs a PostgreSQL transaction.
4. Transaction conditionally increments `reserved` only when available stock is enough:

```sql
UPDATE "InventoryItem"
SET "reserved" = "reserved" + $quantity
WHERE "tenantId" = $tenantId
  AND "variantId" = $variantId
  AND ("quantity" - "reserved" - "safetyStock") >= $quantity
```

5. Transaction creates an `InventoryReservation` with `expiresAt`.
6. Redis lock is released with a token-checked Lua script.

The Redis lock reduces collision and retries, but PostgreSQL is the correctness boundary that prevents overselling.

## Release Flow

Manual release and expiration cleanup use the same invariant:

1. Update only an `active` reservation to a terminal status.
2. If exactly one row changed, decrement `InventoryItem.reserved`.
3. Both writes happen in one transaction.

This makes release idempotent from the caller perspective: repeated releases cannot decrement reserved stock twice.

## Consume Flow

When an order is created successfully:

1. Update only an `active` reservation to `consumed`.
2. Decrement both `quantity` and `reserved` in the same transaction.
3. Attach `orderItemId` when available.

Checkout should consume reservations after order/payment state reaches the chosen business boundary. For card authorization flows, this is usually after payment authorization, before final order confirmation.

## Expiration Cleanup

Workers process `inventory.reservations.releaseExpired` jobs from the `inventory` queue.

Cleanup scans active reservations by `(tenantId, status, expiresAt)`, marks expired rows, and decrements reserved stock transactionally. Batch size is bounded to keep transactions short and retry-friendly.

## Idempotency

`InventoryReservation.idempotencyKey` is unique per tenant. Clients should send a stable key for checkout reservation attempts, such as `checkout:{cartId}:{variantId}:{cartVersion}`.

If a request is retried after a network timeout, the repository returns the existing reservation instead of reserving stock again.

## Consistency Tradeoffs

- Redis lock is best-effort contention control, not the source of truth.
- PostgreSQL conditional updates prevent oversell under concurrent requests.
- Expiration is eventually consistent; a reservation may remain active briefly after `expiresAt` until the worker releases it.
- Checkout should reject expired reservations before consuming them in the final order flow.
- For multi-region writes, inventory should be homed per tenant or SKU shard, or moved behind a single inventory command service.

## Scalability Decisions

- Tenant-scoped indexes keep multi-tenant queries narrow.
- Cursor-friendly cleanup indexes avoid full-table scans.
- Reservation rows provide auditability and recovery after worker/API failures.
- Lock keys are deterministic: `tenant + variant`, which prevents cross-tenant contention.
- Batch cleanup avoids long-running transactions while still allowing high throughput through BullMQ concurrency.
