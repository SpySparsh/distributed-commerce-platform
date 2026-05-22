ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMPTZ(6);

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "Order_tenantId_deliveredAt_id_idx"
  ON "Order"("tenantId", "deliveredAt", "id");

CREATE INDEX IF NOT EXISTS "Payment_tenantId_status_paidAt_idx"
  ON "Payment"("tenantId", "status", "paidAt");
