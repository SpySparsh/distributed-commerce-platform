import type { ReconcileInventoryReservationsJob } from "@ecommerce/queue";
import type { JobHandlerContext } from "./handlers.js";

interface InventoryReservationDriftRow {
  readonly inventoryItemId: string;
  readonly tenantId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly reserved: number;
  readonly activeReserved: bigint;
}

export const handleInventoryReconciliationJob = async (
  job: ReconcileInventoryReservationsJob,
  context: JobHandlerContext
): Promise<void> => {
  const rows = await context.prisma.$queryRaw<InventoryReservationDriftRow[]>`
    SELECT
      item."id" AS "inventoryItemId",
      item."tenantId" AS "tenantId",
      item."variantId" AS "variantId",
      item."quantity" AS "quantity",
      item."reserved" AS "reserved",
      COALESCE(SUM(reservation."quantity"), 0)::bigint AS "activeReserved"
    FROM "InventoryItem" item
    LEFT JOIN "InventoryReservation" reservation
      ON reservation."inventoryItemId" = item."id"
      AND reservation."tenantId" = item."tenantId"
      AND reservation."variantId" = item."variantId"
      AND reservation."status" = 'active'
      AND reservation."deletedAt" IS NULL
    WHERE item."deletedAt" IS NULL
      AND (${job.data.tenantId ?? null}::uuid IS NULL OR item."tenantId" = ${job.data.tenantId ?? null}::uuid)
    GROUP BY item."id", item."tenantId", item."variantId", item."quantity", item."reserved"
    HAVING item."reserved" <> COALESCE(SUM(reservation."quantity"), 0)
    ORDER BY item."updatedAt" ASC, item."id" ASC
    LIMIT ${job.data.batchSize}
  `;

  let repaired = 0;
  let unrecoverable = 0;

  for (const row of rows) {
    const activeReserved = Number(row.activeReserved);

    if (activeReserved > row.quantity) {
      unrecoverable += 1;
      context.logger.error(
        {
          tenantId: row.tenantId,
          inventoryItemId: row.inventoryItemId,
          variantId: row.variantId,
          quantity: row.quantity,
          reserved: row.reserved,
          activeReserved
        },
        "Inventory reservation drift exceeds available quantity and requires manual recovery"
      );
      continue;
    }

    if (!job.data.repair) {
      continue;
    }

    const updated = await context.prisma.$executeRaw`
      UPDATE "InventoryItem"
      SET "reserved" = ${activeReserved},
          "version" = "version" + 1,
          "updatedAt" = NOW()
      WHERE "id" = ${row.inventoryItemId}::uuid
        AND "tenantId" = ${row.tenantId}::uuid
        AND "variantId" = ${row.variantId}::uuid
        AND "deletedAt" IS NULL
        AND "quantity" >= ${activeReserved}
    `;

    if (updated === 1) {
      repaired += 1;
    }
  }

  context.logger.info(
    {
      tenantId: job.data.tenantId ?? job.metadata.tenantId,
      scanned: rows.length,
      repaired,
      unrecoverable,
      repair: job.data.repair,
      idempotencyKey: job.metadata.idempotencyKey
    },
    "Inventory reservation reconciliation completed"
  );
};
