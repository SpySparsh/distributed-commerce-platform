export type InventoryReservationStatus = "active" | "consumed" | "released" | "expired";

export interface InventoryAvailabilityDto {
  readonly tenantId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly reserved: number;
  readonly safetyStock: number;
  readonly availableQuantity: number;
  readonly updatedAt: string;
}

export interface InventoryReservationDto {
  readonly id: string;
  readonly tenantId: string;
  readonly inventoryItemId: string;
  readonly variantId: string;
  readonly cartItemId?: string;
  readonly orderItemId?: string;
  readonly idempotencyKey?: string;
  readonly quantity: number;
  readonly status: InventoryReservationStatus;
  readonly expiresAt: string;
  readonly releasedAt?: string;
  readonly consumedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InventoryReservationCleanupResult {
  readonly scanned: number;
  readonly released: number;
}
