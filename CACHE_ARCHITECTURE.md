# Redis Caching Architecture

## Redis Roles

- Distributed read cache for products, categories, and hot product lists.
- Redis-backed cart persistence for fast cart reads/writes before checkout.
- Short-lived inventory locks for reservation-critical sections.
- Shared infrastructure for rate limiting and future background revalidation.

## Key Strategy

All cache keys use:

```text
ecommerce:v1:tenant:{tenantId}:{resource}:{scope}:{id}
```

Rules:

- Always include `tenantId`.
- Include a version segment for global cache migrations.
- Use resource-specific builders from `@ecommerce/cache`; do not concatenate ad hoc keys in services.
- Encode dynamic key parts.

Examples:

- Product: `ecommerce:v1:tenant:t1:product:id:p1`
- Category tree: `ecommerce:v1:tenant:t1:categories:tree`
- Cart: `ecommerce:v1:tenant:t1:cart:c1`
- Inventory lock: `ecommerce:v1:tenant:t1:inventory:lock:v1`

## TTL Strategy

- Products: short fresh TTL with longer stale window.
- Categories: longer TTL because changes are less frequent.
- Hot products: short TTL because popularity shifts quickly.
- Carts: long TTL aligned with abandoned-cart policy.
- Inventory locks: very short TTL to prevent deadlocks.

## Stale-While-Revalidate

`readThroughCache()` stores envelopes:

- `freshUntil`
- `staleUntil`
- `value`

Fresh entries are returned directly. Stale entries are returned immediately and can trigger asynchronous revalidation. Expired entries block on the fresh data loader.

## Invalidation

Invalidation helpers delete tenant-scoped resource patterns:

- `invalidateProductCache(redis, tenantId)`
- `invalidateCategoryCache(redis, tenantId)`

Production note: for very large tenants, prefer tag sets or versioned namespace counters over broad `SCAN` pattern deletion.

## Cart Persistence

Redis stores cart snapshots using `saveCart`, `getCart`, and `deleteCart`.

The database remains the source of truth during checkout. Redis carts are optimized for interactive shopping reads/writes and should be reconciled to PostgreSQL before order creation.

## Inventory Locks

`acquireInventoryLock()` uses Redis `SET key token EX ttl NX`.

`releaseInventoryLock()` uses a Lua compare-and-delete script so one worker cannot release another worker's lock. Database transactions and conditional inventory updates still remain the final correctness boundary.

## Scaling Tradeoffs

- Redis improves latency and absorbs hot catalog reads.
- PostgreSQL remains authoritative for inventory, orders, payments, and audit logs.
- SWR reduces tail latency but can briefly serve stale catalog data.
- Inventory locks reduce contention but do not replace database constraints.
- Key versioning allows cache migrations without cluster-wide deletes.
