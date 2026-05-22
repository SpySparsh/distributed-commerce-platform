-- Standardize online payments on Stripe. Existing Razorpay demo rows are
-- converted to Stripe so the old enum value can be removed safely.
UPDATE "Payment"
SET "provider" = 'stripe'
WHERE "provider" = 'razorpay';

UPDATE "PaymentWebhookEvent"
SET "provider" = 'stripe'
WHERE "provider" = 'razorpay';

ALTER TYPE "PaymentProvider" RENAME TO "PaymentProvider_old";
CREATE TYPE "PaymentProvider" AS ENUM ('stripe', 'cod', 'manual');

ALTER TABLE "Payment"
  ALTER COLUMN "provider" TYPE "PaymentProvider"
  USING "provider"::text::"PaymentProvider";

ALTER TABLE "PaymentWebhookEvent"
  ALTER COLUMN "provider" TYPE "PaymentProvider"
  USING "provider"::text::"PaymentProvider";

DROP TYPE "PaymentProvider_old";
