CREATE TYPE "ReviewStatus" AS ENUM ('approved', 'rejected');

ALTER TABLE "Product"
  ADD COLUMN "averageRating" DECIMAL(3, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Review" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "orderItemId" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "comment" TEXT NOT NULL,
  "verifiedPurchase" BOOLEAN NOT NULL DEFAULT true,
  "status" "ReviewStatus" NOT NULL DEFAULT 'approved',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Review_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE UNIQUE INDEX "Review_tenantId_userId_orderItemId_key"
  ON "Review"("tenantId", "userId", "orderItemId");

CREATE INDEX "Review_tenantId_productId_status_createdAt_idx"
  ON "Review"("tenantId", "productId", "status", "createdAt");

CREATE INDEX "Review_tenantId_userId_createdAt_idx"
  ON "Review"("tenantId", "userId", "createdAt");

CREATE INDEX "Review_tenantId_orderId_idx"
  ON "Review"("tenantId", "orderId");

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
