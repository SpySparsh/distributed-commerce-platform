CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_tenant_status_name_trgm_idx"
  ON "Product" USING GIN (LOWER("name") gin_trgm_ops)
  WHERE "deletedAt" IS NULL AND "status" = 'active';

CREATE INDEX IF NOT EXISTS "Product_tenant_status_slug_trgm_idx"
  ON "Product" USING GIN (LOWER("slug") gin_trgm_ops)
  WHERE "deletedAt" IS NULL AND "status" = 'active';

CREATE INDEX IF NOT EXISTS "Product_description_trgm_idx"
  ON "Product" USING GIN (LOWER(COALESCE("description", '')) gin_trgm_ops)
  WHERE "deletedAt" IS NULL AND "status" = 'active';

CREATE INDEX IF NOT EXISTS "Category_tenant_name_trgm_idx"
  ON "Category" USING GIN (LOWER("name") gin_trgm_ops)
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "ProductVariant_tenant_product_price_idx"
  ON "ProductVariant"("tenantId", "productId", "status", "deletedAt", "price");

CREATE TABLE IF NOT EXISTS "SearchQueryLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID,
  "query" TEXT NOT NULL,
  "normalizedQuery" TEXT NOT NULL,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "clickedProductId" UUID,
  "failed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMPTZ(6),
  CONSTRAINT "SearchQueryLog_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SearchQueryLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SearchQueryLog_tenantId_normalizedQuery_createdAt_idx"
  ON "SearchQueryLog"("tenantId", "normalizedQuery", "createdAt");

CREATE INDEX IF NOT EXISTS "SearchQueryLog_tenantId_failed_createdAt_idx"
  ON "SearchQueryLog"("tenantId", "failed", "createdAt");

CREATE INDEX IF NOT EXISTS "SearchQueryLog_tenantId_clickedProductId_createdAt_idx"
  ON "SearchQueryLog"("tenantId", "clickedProductId", "createdAt");
