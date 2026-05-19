import type { PrismaClient } from "@ecommerce/database";
import type { InventoryAvailability } from "./cart.types.js";

export interface CartInventoryReader {
  getAvailability(tenantId: string, variantId: string): Promise<InventoryAvailability | undefined>;
}

interface InventoryItemRow {
  readonly variantId: string;
  readonly quantity: number;
  readonly reserved: number;
  readonly safetyStock: number;
}

export class PrismaCartInventoryReader implements CartInventoryReader {
  constructor(private readonly prisma: PrismaClient) {}

  async getAvailability(tenantId: string, variantId: string): Promise<InventoryAvailability | undefined> {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId,
        variantId,
        deletedAt: null
      },
      select: {
        variantId: true,
        quantity: true,
        reserved: true,
        safetyStock: true
      }
    });

    if (item === null) {
      return undefined;
    }

    return {
      variantId: item.variantId,
      availableQuantity: Math.max(item.quantity - item.reserved - item.safetyStock, 0)
    };
  }
}
