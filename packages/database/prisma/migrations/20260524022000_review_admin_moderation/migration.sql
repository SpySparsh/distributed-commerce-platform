ALTER TYPE "ReviewStatus" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "ReviewStatus" ADD VALUE IF NOT EXISTS 'hidden';
ALTER TYPE "ReviewStatus" ADD VALUE IF NOT EXISTS 'deleted';

ALTER TABLE "Review"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "Review_tenantId_status_createdAt_idx"
  ON "Review"("tenantId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Review_tenantId_productId_status_deletedAt_idx"
  ON "Review"("tenantId", "productId", "status", "deletedAt");
