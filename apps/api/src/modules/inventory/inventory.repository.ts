import type {
  InventoryAvailabilityDto,
  InventoryReservationCleanupResult,
  InventoryReservationDto
} from "./inventory.types.js";

export interface CreateInventoryReservationInput {
  readonly tenantId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly expiresAt: Date;
  readonly cartItemId?: string;
  readonly idempotencyKey?: string;
}

export interface ConsumeInventoryReservationInput {
  readonly tenantId: string;
  readonly reservationId: string;
  readonly orderItemId?: string;
}

export interface ReleaseExpiredInventoryReservationsInput {
  readonly now: Date;
  readonly batchSize: number;
  readonly tenantId?: string;
}

export interface InventoryRepository {
  getAvailability(tenantId: string, variantId: string): Promise<InventoryAvailabilityDto | undefined>;
  createReservation(input: CreateInventoryReservationInput): Promise<InventoryReservationDto>;
  releaseReservation(tenantId: string, reservationId: string): Promise<InventoryReservationDto>;
  consumeReservation(input: ConsumeInventoryReservationInput): Promise<InventoryReservationDto>;
  releaseExpiredReservations(
    input: ReleaseExpiredInventoryReservationsInput
  ): Promise<InventoryReservationCleanupResult>;
}
