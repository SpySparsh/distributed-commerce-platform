import {
  acquireInventoryLock,
  releaseInventoryLock,
  type RedisCacheClient
} from "@ecommerce/cache";
import { inventoryLockedError } from "./inventory.errors.js";
import type {
  ConsumeInventoryReservationInput,
  InventoryRepository
} from "./inventory.repository.js";
import type { ReserveInventoryBody } from "./inventory.schemas.js";
import type {
  InventoryAvailabilityDto,
  InventoryReservationCleanupResult,
  InventoryReservationDto
} from "./inventory.types.js";

export interface InventoryService {
  getAvailability(tenantId: string, variantId: string): Promise<InventoryAvailabilityDto | undefined>;
  reserveStock(input: ReserveInventoryBody): Promise<InventoryReservationDto>;
  releaseReservation(tenantId: string, reservationId: string): Promise<InventoryReservationDto>;
  consumeReservation(input: ConsumeInventoryReservationInput): Promise<InventoryReservationDto>;
  releaseExpiredReservations(input: {
    readonly now: Date;
    readonly batchSize: number;
    readonly tenantId?: string;
  }): Promise<InventoryReservationCleanupResult>;
}

export const createInventoryService = (
  repository: InventoryRepository,
  redis: RedisCacheClient
): InventoryService => ({
  getAvailability(tenantId, variantId) {
    return repository.getAvailability(tenantId, variantId);
  },

  async reserveStock(input) {
    const lock = await acquireInventoryLock(redis, {
      tenantId: input.tenantId,
      variantId: input.variantId,
      ttlSeconds: 15
    });

    if (lock === undefined) {
      throw inventoryLockedError();
    }

    try {
      const expiresAt = new Date(Date.now() + input.ttlSeconds * 1_000);

      return await repository.createReservation({
        tenantId: input.tenantId,
        variantId: input.variantId,
        quantity: input.quantity,
        expiresAt,
        ...(input.cartItemId === undefined ? {} : { cartItemId: input.cartItemId }),
        ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey })
      });
    } finally {
      await releaseInventoryLock(redis, lock);
    }
  },

  releaseReservation(tenantId, reservationId) {
    return repository.releaseReservation(tenantId, reservationId);
  },

  consumeReservation(input) {
    return repository.consumeReservation(input);
  },

  releaseExpiredReservations(input) {
    return repository.releaseExpiredReservations(input);
  }
});
