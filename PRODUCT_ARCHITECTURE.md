# Product Architecture

## Data Model

- `Product` owns catalog identity: tenant, category, SKU, slug, name, status, SEO-friendly URL identity.
- `ProductVariant` owns purchasable SKUs, price, currency, and variant attributes.
- `ProductImage` stores ordered media separately from product rows.
- `InventoryItem` belongs to variants, not products, so stock is tracked at the purchasable level.
- `Category` is a self-referencing tree with `parentId` and `position`.

This avoids a giant product table while keeping hot catalog reads efficient.

## API Module

Product code lives under `apps/api/src/modules/products`:

- `product.schemas.ts`: filter, sort, params, and category query schemas.
- `product.repository.ts`: repository contract.
- `prisma-product.repository.ts`: Prisma-shaped optimized query implementation.
- `product.service.ts`: cache-aware orchestration.
- `product.routes.ts`: thin Fastify route registration.

Routes:

- `GET /products`
- `GET /products/:slug`
- `GET /products/categories/tree`

## Filtering and Sorting

Supported filters:

- tenant
- category id
- category slug
- search text
- min/max variant price
- in-stock variants

Supported sorts:

- newest
- oldest
- updated desc
- name asc/desc
- price asc/desc placeholder

Price sorting generally needs denormalized min price or a search index at scale. The current repository keeps the contract in place while avoiding inefficient cross-variant ordering magic.

## Pagination

The API uses cursor pagination. Cursor payloads include:

- sort value
- product id

This gives stable pagination for high-volume catalogs and avoids offset scans.

## Query Optimization

The Prisma repository uses explicit `select` objects:

- no broad `include`
- variants are filtered to active/non-deleted
- images are ordered by primary flag and position
- inventory is selected only for availability calculation

This reduces payload size and avoids N+1 query patterns.

## Indexing Strategy

Product indexes include:

- tenant + SKU unique
- tenant + slug unique
- tenant + status + deletedAt + createdAt + id
- tenant + status + deletedAt + updatedAt + id
- tenant + category + status + deletedAt
- tenant + name

Image indexes include:

- tenant + product + position
- tenant + product + primary flag

For production search/filtering, add PostgreSQL trigram/full-text indexes or move catalog search to OpenSearch/Meilisearch once text search and facets become hot.

## Caching

Product details and category trees use Redis cache helpers from `@ecommerce/cache`.

Invalidation should happen on:

- product update
- variant update
- image update
- inventory visibility changes
- category changes

PostgreSQL remains the source of truth; Redis is a read optimization.

## Tradeoffs

- JSON variant attributes keep the schema flexible, but complex faceting may require normalized attribute tables later.
- Soft deletes preserve history but require `deletedAt: null` on every read path.
- Slugs are unique per tenant, supporting SEO and multi-tenant isolation.
- Inventory availability is computed from variant-level inventory, avoiding product-level stock mistakes.
