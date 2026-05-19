export interface CartItemDto {
  readonly productId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly unitPrice: string;
  readonly currency: string;
  readonly updatedAt: string;
}

export interface CartDto {
  readonly id: string;
  readonly tenantId: string;
  readonly userId?: string;
  readonly guestId?: string;
  readonly deviceId?: string;
  readonly version: number;
  readonly items: readonly CartItemDto[];
  readonly updatedAt: string;
  readonly expiresAt: string;
}

export interface InventoryAvailability {
  readonly variantId: string;
  readonly availableQuantity: number;
}
