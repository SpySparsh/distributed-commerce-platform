# Search Architecture

This search foundation uses Meilisearch for typo-tolerant product discovery, autocomplete, category search, filtering, sorting, and asynchronous indexing.

## Components

- `packages/search`: shared Meilisearch client, document contracts, index settings, filters, and sorting helpers.
- `apps/api/src/modules/search`: Fastify routes for product search, category search, autocomplete, and indexing commands.
- `packages/queue`: search indexing job contracts.
- `apps/worker`: search queue registration and job dispatch placeholders.
- `docker-compose.yml`: local Meilisearch service.

## Indexes

Two indexes are configured:

- `products`: product and variant search.
- `categories`: category discovery and autocomplete.

The API applies `MEILISEARCH_INDEX_PREFIX`, so environments can use isolated indexes such as `ecommerce_products`, `staging_products`, or `tenant-region-products` without changing code.

## Product Document

Product documents are denormalized for search:

- product identity: `productId`, `slug`, `sku`, `name`
- category facets: `categoryIds`, `categorySlugs`, `categoryNames`
- variant facets: `variantIds`, `variantSkus`
- pricing: `priceMin`, `priceMax`, `currency`
- inventory: `availableQuantity`, `inStock`
- ranking: `popularityScore`, `updatedAt`
- filters: `attributes`, `status`, tenant fields

This avoids joining PostgreSQL during search requests.

## Ranking Strategy

Product ranking uses Meilisearch built-ins first:

1. `words`
2. `typo`
3. `proximity`
4. `attribute`
5. `sort`
6. `exactness`

Then custom business ranking:

1. higher `popularityScore`
2. higher `availableQuantity`
3. newer `updatedAt`

This keeps exact text relevance primary while still pushing popular, available products upward.

## Filtering

Filters are built as explicit Meilisearch clauses:

- tenant isolation: `tenantId`
- category: `categoryIds` or `categorySlugs`
- stock: `inStock`
- price: `priceMin`, `priceMax`
- currency
- structured attributes

The API does not fall back to SQL `LIKE` queries. PostgreSQL remains the source of truth; Meilisearch is the query-optimized read model.

## Indexing Pipeline

Product writes should enqueue:

- `search.product.index` after create/update/publish/inventory-impacting changes.
- `search.product.delete` after archive/delete/unpublish.
- `search.index.rebuild` for full reindexing or recovery.

Workers should build search documents from PostgreSQL and call `upsertProducts`, `upsertCategories`, or `deleteProducts`. Jobs are idempotent because document IDs are stable.

## Autocomplete

Autocomplete calls the product index with:

- small limits
- `matchingStrategy: "last"`
- tenant and in-stock filters
- name highlighting

This supports partial terms and typo tolerance without a separate suggestions table.

## Scaling Tradeoffs

- Search is eventually consistent with PostgreSQL.
- Indexing is asynchronous to keep product writes fast.
- Rebuilds should run in bounded batches to avoid large memory spikes.
- Tenant filters are mandatory for multi-tenant isolation.
- Large catalogs should shard by environment/region and keep document payloads compact.
- High-volume ranking signals should update through batched jobs, not per-click synchronous writes.
