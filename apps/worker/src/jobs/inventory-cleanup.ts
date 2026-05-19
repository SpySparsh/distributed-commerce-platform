import type { ReleaseExpiredInventoryReservationsJob } from "@ecommerce/queue";
import type { JobHandlerContext } from "./handlers.js";

export const handleInventoryCleanupJob = async (
  job: ReleaseExpiredInventoryReservationsJob,
  context: JobHandlerContext
): Promise<void> => {
  const now = new Date();
  const result = await context.prisma.$transaction(async (tx) => {
    const expired = await tx.inventoryReservation.findMany({
      where: {
        tenantId: job.data.tenantId ?? job.metadata.tenantId,
        status: "active",
        expiresAt: {
          lte: now
        },
        orderItemId: null,
        deletedAt: null
      },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      take: job.data.batchSize
    });

    let released = 0;

    for (const reservation of expired) {
      const claimed = await tx.inventoryReservation.updateMany({
        where: {
          id: reservation.id,
          tenantId: reservation.tenantId,
          status: "active",
          orderItemId: null
        },
        data: {
          status: "expired",
          releasedAt: now
        }
      });

      if (claimed.count !== 1) {
        continue;
      }

      const releasedInventory = await tx.$executeRaw`
        UPDATE "InventoryItem"
        SET "reserved" = "reserved" - ${reservation.quantity},
            "version" = "version" + 1,
            "updatedAt" = NOW()
        WHERE "id" = ${reservation.inventoryItemId}::uuid
          AND "tenantId" = ${reservation.tenantId}::uuid
          AND "variantId" = ${reservation.variantId}::uuid
          AND "reserved" >= ${reservation.quantity}
      `;
      if (releasedInventory !== 1) {
        throw new Error("Expired reservation could not be released from its inventory item");
      }
      released += 1;
    }

    return {
      scanned: expired.length,
      released
    };
  });

  context.logger.info(
    {
      tenantId: job.metadata.tenantId,
      scanned: result.scanned,
      released: result.released,
      idempotencyKey: job.metadata.idempotencyKey
    },
    "Expired inventory reservations released"
  );
};
