import { expect, it } from "vitest";
import { PrismaInventoryRepository } from "../modules/inventory/prisma-inventory.repository.js";
import { createIntegrationHarness, describeIntegration, seedProductWithInventory, seedTenant } from "../test-utils/integration-harness.js";

describeIntegration("inventory concurrency integration", () => {
  const harness = createIntegrationHarness();

  it("prevents overselling under concurrent reservation attempts", async () => {
    const tenant = await seedTenant(harness.prisma);
    const product = await seedProductWithInventory(harness.prisma, {
      tenantId: tenant.id,
      quantity: 5
    });
    const repository = new PrismaInventoryRepository(harness.prisma);

    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        repository.createReservation({
          tenantId: tenant.id,
          variantId: product.variantId,
          quantity: 1,
          expiresAt: new Date(Date.now() + 60_000),
          idempotencyKey: `reservation-${index}`
        })
      )
    );

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(5);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(5);

    const inventory = await harness.prisma.inventoryItem.findUniqueOrThrow({
      where: {
        id: product.inventoryItemId
      }
    });
    const activeReservations = await harness.prisma.inventoryReservation.aggregate({
      where: {
        tenantId: tenant.id,
        inventoryItemId: product.inventoryItemId,
        status: "active"
      },
      _sum: {
        quantity: true
      }
    });

    expect(inventory.quantity).toBe(5);
    expect(inventory.reserved).toBe(5);
    expect(activeReservations._sum.quantity).toBe(5);
  });
});
