import type { PrismaClient } from "@ecommerce/database";
import {
  insufficientInventoryError,
  inventoryReservationConflictError,
  inventoryReservationNotFoundError
} from "./inventory.errors.js";
import type {
  ConsumeInventoryReservationInput,
  CreateInventoryReservationInput,
  InventoryRepository,
  ReleaseExpiredInventoryReservationsInput
} from "./inventory.repository.js";
import type {
  InventoryAvailabilityDto,
  InventoryReservationCleanupResult,
  InventoryReservationDto,
  InventoryReservationStatus
} from "./inventory.types.js";

interface InventoryItemRow {
  readonly id: string;
  readonly tenantId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly reserved: number;
  readonly safetyStock: number;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

interface InventoryReservationRow {
  readonly id: string;
  readonly tenantId: string;
  readonly inventoryItemId: string;
  readonly variantId: string;
  readonly cartItemId: string | null;
  readonly orderItemId: string | null;
  readonly idempotencyKey: string | null;
  readonly quantity: number;
  readonly status: InventoryReservationStatus;
  readonly expiresAt: Date;
  readonly releasedAt: Date | null;
  readonly consumedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface InventoryTransactionClient {
  readonly $executeRaw: (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => Promise<number>;
  readonly inventoryItem: {
    findFirst(args: unknown): Promise<InventoryItemRow | null>;
  };
  readonly inventoryReservation: {
    create(args: unknown): Promise<InventoryReservationRow>;
    findFirst(args: unknown): Promise<InventoryReservationRow | null>;
    findMany(args: unknown): Promise<InventoryReservationRow[]>;
    update(args: unknown): Promise<InventoryReservationRow>;
    updateMany(args: unknown): Promise<{ readonly count: number }>;
  };
}

const toAvailabilityDto = (row: InventoryItemRow): InventoryAvailabilityDto => ({
  tenantId: row.tenantId,
  variantId: row.variantId,
  quantity: row.quantity,
  reserved: row.reserved,
  safetyStock: row.safetyStock,
  availableQuantity: Math.max(row.quantity - row.reserved - row.safetyStock, 0),
  updatedAt: row.updatedAt.toISOString()
});

const toReservationDto = (row: InventoryReservationRow): InventoryReservationDto => ({
  id: row.id,
  tenantId: row.tenantId,
  inventoryItemId: row.inventoryItemId,
  variantId: row.variantId,
  ...(row.cartItemId === null ? {} : { cartItemId: row.cartItemId }),
  ...(row.orderItemId === null ? {} : { orderItemId: row.orderItemId }),
  ...(row.idempotencyKey === null ? {} : { idempotencyKey: row.idempotencyKey }),
  quantity: row.quantity,
  status: row.status,
  expiresAt: row.expiresAt.toISOString(),
  ...(row.releasedAt === null ? {} : { releasedAt: row.releasedAt.toISOString() }),
  ...(row.consumedAt === null ? {} : { consumedAt: row.consumedAt.toISOString() }),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getAvailability(tenantId: string, variantId: string): Promise<InventoryAvailabilityDto | undefined> {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId,
        variantId,
        deletedAt: null
      }
    });

    return item === null ? undefined : toAvailabilityDto(item);
  }

  async createReservation(input: CreateInventoryReservationInput): Promise<InventoryReservationDto> {
    return this.prisma.$transaction(async (tx) => {
      if (input.idempotencyKey !== undefined) {
        const existing = await tx.inventoryReservation.findFirst({
          where: {
            tenantId: input.tenantId,
            idempotencyKey: input.idempotencyKey,
            deletedAt: null
          }
        });

        if (existing !== null) {
          return toReservationDto(existing);
        }
      }

      const updatedItems = await tx.$executeRaw`
        UPDATE "InventoryItem"
        SET "reserved" = "reserved" + ${input.quantity},
            "version" = "version" + 1,
            "updatedAt" = NOW()
        WHERE "tenantId" = ${input.tenantId}::uuid
          AND "variantId" = ${input.variantId}::uuid
          AND "deletedAt" IS NULL
          AND ("quantity" - "reserved" - "safetyStock") >= ${input.quantity}
      `;

      if (updatedItems !== 1) {
        throw insufficientInventoryError();
      }

      const item = await tx.inventoryItem.findFirst({
        where: {
          tenantId: input.tenantId,
          variantId: input.variantId,
          deletedAt: null
        }
      });

      if (item === null) {
        throw insufficientInventoryError();
      }

      const reservation = await tx.inventoryReservation.create({
        data: {
          tenantId: input.tenantId,
          inventoryItemId: item.id,
          variantId: input.variantId,
          quantity: input.quantity,
          expiresAt: input.expiresAt,
          ...(input.cartItemId === undefined ? {} : { cartItemId: input.cartItemId }),
          ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey })
        }
      });

      return toReservationDto(reservation);
    });
  }

  async releaseReservation(tenantId: string, reservationId: string): Promise<InventoryReservationDto> {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.inventoryReservation.findFirst({
        where: {
          id: reservationId,
          tenantId,
          deletedAt: null
        }
      });

      if (reservation === null) {
        throw inventoryReservationNotFoundError();
      }

      if (reservation.status !== "active") {
        throw inventoryReservationConflictError();
      }

      const updatedReservations = await tx.inventoryReservation.updateMany({
        where: {
          id: reservationId,
          tenantId,
          status: "active"
        },
        data: {
          status: "released",
          releasedAt: new Date()
        }
      });

      if (updatedReservations.count !== 1) {
        throw inventoryReservationConflictError();
      }

      await tx.$executeRaw`
        UPDATE "InventoryItem"
        SET "reserved" = GREATEST("reserved" - ${reservation.quantity}, 0),
            "version" = "version" + 1,
            "updatedAt" = NOW()
        WHERE "id" = ${reservation.inventoryItemId}::uuid
          AND "tenantId" = ${tenantId}::uuid
      `;

      const updated = await tx.inventoryReservation.findFirst({
        where: {
          id: reservationId,
          tenantId
        }
      });

      if (updated === null) {
        throw inventoryReservationNotFoundError();
      }

      return toReservationDto(updated);
    });
  }

  async consumeReservation(input: ConsumeInventoryReservationInput): Promise<InventoryReservationDto> {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.inventoryReservation.findFirst({
        where: {
          id: input.reservationId,
          tenantId: input.tenantId,
          deletedAt: null
        }
      });

      if (reservation === null) {
        throw inventoryReservationNotFoundError();
      }

      if (reservation.status !== "active") {
        throw inventoryReservationConflictError();
      }

      const updatedReservations = await tx.inventoryReservation.updateMany({
        where: {
          id: input.reservationId,
          tenantId: input.tenantId,
          status: "active"
        },
        data: {
          status: "consumed",
          consumedAt: new Date(),
          ...(input.orderItemId === undefined ? {} : { orderItemId: input.orderItemId })
        }
      });

      if (updatedReservations.count !== 1) {
        throw inventoryReservationConflictError();
      }

      await tx.$executeRaw`
        UPDATE "InventoryItem"
        SET "quantity" = GREATEST("quantity" - ${reservation.quantity}, 0),
            "reserved" = GREATEST("reserved" - ${reservation.quantity}, 0),
            "version" = "version" + 1,
            "updatedAt" = NOW()
        WHERE "id" = ${reservation.inventoryItemId}::uuid
          AND "tenantId" = ${input.tenantId}::uuid
      `;

      const updated = await tx.inventoryReservation.findFirst({
        where: {
          id: input.reservationId,
          tenantId: input.tenantId
        }
      });

      if (updated === null) {
        throw inventoryReservationNotFoundError();
      }

      return toReservationDto(updated);
    });
  }

  async releaseExpiredReservations(
    input: ReleaseExpiredInventoryReservationsInput
  ): Promise<InventoryReservationCleanupResult> {
    return this.prisma.$transaction(async (tx) => {
      const expired = await tx.inventoryReservation.findMany({
        where: {
          status: "active",
          expiresAt: {
            lte: input.now
          },
          deletedAt: null,
          ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId })
        },
        orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
        take: input.batchSize
      });

      let released = 0;

      for (const reservation of expired) {
        const updated = await tx.inventoryReservation.updateMany({
          where: {
            id: reservation.id,
            tenantId: reservation.tenantId,
            status: "active"
          },
          data: {
            status: "expired",
            releasedAt: input.now
          }
        });

        if (updated.count !== 1) {
          continue;
        }

        await tx.$executeRaw`
          UPDATE "InventoryItem"
          SET "reserved" = GREATEST("reserved" - ${reservation.quantity}, 0),
              "version" = "version" + 1,
              "updatedAt" = NOW()
          WHERE "id" = ${reservation.inventoryItemId}::uuid
            AND "tenantId" = ${reservation.tenantId}::uuid
        `;
        released += 1;
      }

      return {
        scanned: expired.length,
        released
      };
    });
  }
}
