import type { InventoryAvailability } from "./cart.types.js";

export interface CartInventoryReader {
  getAvailability(tenantId: string, variantId: string): Promise<InventoryAvailability | undefined>;
}

export class UnconfiguredCartInventoryReader implements CartInventoryReader {
  async getAvailability(): Promise<InventoryAvailability | undefined> {
    throw new Error("CartInventoryReader is not configured with Prisma yet.");
  }
}
