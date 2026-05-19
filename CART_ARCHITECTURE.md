# Cart Architecture

## Model

Carts are split across Redis and PostgreSQL:

- Redis is the fast interaction layer for browsing, item updates, and recovery.
- PostgreSQL is the durable source used for checkout, recovery, analytics, and auditability.

The `Cart` table supports:

- authenticated carts with `userId`
- guest carts with `guestId`
- multi-device tracking with `deviceId`
- optimistic sync/versioning with `version`
- expiration with `expiresAt`
- recovery/sync metadata with `lastSyncedAt`

## API

Cart routes live under `apps/api/src/modules/carts`.

Endpoints:

- `POST /carts`
- `GET /carts/:cartId`
- `PUT /carts/:cartId/items`
- `DELETE /carts/:cartId/items/:variantId`
- `POST /carts/merge`
- `POST /carts/:cartId/sync`

Routes validate input and call `CartService`; they do not own cart business rules.

## Redis Layer

Redis stores `CachedCart` snapshots with a 30-day TTL.

Key shape:

```text
ecommerce:v1:tenant:{tenantId}:cart:{cartId}
```

Redis gives:

- low-latency cart reads
- fast item mutation
- abandoned cart recovery window
- reduced database write pressure

## Persistence Strategy

The repository boundary supports:

- create cart
- find active user cart
- find active guest cart
- find cart by id
- persist cart snapshot
- mark cart expired

Production persistence should upsert cart items inside a transaction and increment `version` to avoid lost updates.

## Guest Cart Merging

When a guest logs in:

1. Load source guest cart.
2. Load target user cart.
3. Merge items by `variantId`.
4. Sum quantities for duplicate variants.
5. Save merged cart to Redis.
6. Expire source cart in Redis and PostgreSQL.

If quantity caps or inventory limits apply, enforce them during merge before checkout.

## Inventory Awareness

Item upsert checks inventory availability through `CartInventoryReader`.

The service also takes a short Redis inventory lock per variant during mutation:

```text
ecommerce:v1:tenant:{tenantId}:inventory:lock:{variantId}
```

This reduces concurrent cart mutation races. PostgreSQL inventory reservation remains the final correctness boundary during checkout.

## Expiration

Redis cart TTL handles fast expiration. PostgreSQL `expiresAt` supports durable cleanup and recovery jobs.

Worker cleanup should:

- mark expired active carts as `expired`
- delete stale Redis keys when needed
- preserve converted carts for order history

## Scaling Tradeoffs

- Redis-first carts improve UX and reduce write load.
- PostgreSQL persistence prevents cart loss and supports recovery.
- Versioning prepares for multi-device conflict detection.
- Inventory checks in cart improve feedback, but checkout must still reserve inventory transactionally.
- Large carts should be capped by policy to avoid oversized Redis values and expensive checkout operations.
