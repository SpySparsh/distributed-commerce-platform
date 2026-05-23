# PostgreSQL + Prisma Architecture

## Shape

The source-of-truth schema lives at `packages/database/prisma/schema.prisma`. Prisma config, migrations, and seed data are owned by `packages/database`; root-level Prisma mirrors are intentionally not part of the runtime path.

Core decisions:

- Every tenant-owned table carries `tenantId`.
- Primary keys are UUIDs with PostgreSQL `uuid` columns.
- Every durable model has `createdAt`, `updatedAt`, and `deletedAt`.
- Products are split into `Product` and `ProductVariant`; inventory belongs to variants.
- Orders snapshot commercial data such as item name, SKU, unit price, totals, and addresses.
- Audit logs are append-oriented and tenant-scoped.
- RBAC uses normalized `Role`, `Permission`, `UserRole`, and `RolePermission` tables.

## Relationship Decisions

- `Tenant` is the isolation boundary. Tenant-scoped unique constraints prevent cross-tenant collisions.
- `Category` is self-referential for category trees, with `position` for stable ordering.
- `ProductVariant` carries purchasable SKU and price. Parent `Product` carries catalog grouping and SEO identity.
- `CartItem` is normalized by variant and unique per cart, avoiding duplicated line items for the same SKU.
- `OrderItem` references product and variant but also snapshots SKU/name/price so historical orders survive catalog edits.
- `InventoryItem` is one-to-one with `ProductVariant`; `InventoryReservation` supports checkout holds and order conversion.
- `Payment` uses idempotency keys and provider identifiers to guard against duplicate gateway callbacks.

## Indexing Strategy

Indexes are tenant-first because almost every query is tenant-scoped.

- Lookup indexes: tenant + slug, tenant + SKU, tenant + email, tenant + orderNumber.
- List indexes: tenant + status + createdAt + id for cursor pagination.
- Ownership indexes: tenant + userId + createdAt + id for user orders and carts.
- Operational indexes: tenant + reservation status + expiresAt for reservation cleanup workers.
- Audit indexes: tenant + entity type/id + createdAt and tenant + actor + createdAt.

Production note: Prisma does not express partial indexes like `WHERE deleted_at IS NULL`. Add those in SQL migrations for hot paths after traffic patterns are known.

## Transaction Strategy

Checkout should run inside a single database transaction:

1. Load cart items by `tenantId` and `cartId`.
2. Lock or conditionally update inventory rows by variant.
3. Create active inventory reservations with expiration.
4. Create the order and order items from cart snapshots.
5. Mark reservations as consumed once payment/order confirmation succeeds.
6. Write audit logs in the same transaction for critical state changes.

Use optimistic concurrency on `InventoryItem.version` or conditional updates such as:

```sql
UPDATE inventory_items
SET reserved = reserved + $quantity, version = version + 1
WHERE id = $id
  AND tenant_id = $tenantId
  AND quantity - reserved - safety_stock >= $quantity;
```

If no row is updated, inventory is unavailable.

## Pagination Strategy

Use cursor pagination, not offset pagination, for high-volume tables:

- Products: `(tenantId, status, deletedAt, createdAt, id)`
- Orders: `(tenantId, status, createdAt, id)`
- Audit logs: `(tenantId, createdAt, id)`
- Carts: `(tenantId, status, updatedAt, id)`

The cursor should include both timestamp and UUID to keep ordering stable when many rows share the same timestamp.

## Scalability Tradeoffs

- JSON is used for variant attributes and address snapshots because those fields vary by tenant and should not force schema churn.
- Money is stored as `Decimal(12, 2)` for readability. For very high scale or multi-currency precision, consider integer minor units.
- Soft deletes keep historical referential integrity but require every read path to filter `deletedAt`.
- Tenant-first indexes improve SaaS isolation but increase index width. This is the right default for multi-tenant ecommerce.
- Audit logs can grow quickly; partition by time or tenant once volume justifies it.

## Production Considerations

- Add row-level security when tenant isolation must be enforced at the database layer.
- Add SQL partial indexes for active rows after migration generation.
- Add check constraints for non-negative inventory and payment/order amounts.
- Use idempotency keys for checkout and payment capture.
- Keep payment webhook processing idempotent and transactional.
- Run reservation expiry from workers using the `tenantId, status, expiresAt` index.
- Avoid exposing Prisma models over API boundaries; map to DTOs in application services.
