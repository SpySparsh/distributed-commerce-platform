import { expect, it, vi } from "vitest";
import type { CartDto } from "../modules/carts/cart.types.js";
import { PrismaCheckoutRepository } from "../modules/checkout/checkout.repository.js";
import { createIntegrationHarness, describeIntegration, integrationEnv, seedProductWithInventory, seedTenant, seedUser } from "../test-utils/integration-harness.js";

describeIntegration("checkout orchestration integration", () => {
  const harness = createIntegrationHarness();

  it("persists cart snapshot, reserves inventory, creates order, links reservations, and creates payment", async () => {
    const tenant = await seedTenant(harness.prisma);
    const user = await seedUser(harness.prisma, { tenantId: tenant.id });
    const product = await seedProductWithInventory(harness.prisma, {
      tenantId: tenant.id,
      quantity: 3,
      price: "12.00"
    });
    const cart = await harness.prisma.cart.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        status: "active",
        expiresAt: new Date(Date.now() + 60_000)
      }
    });
    const snapshot: CartDto = {
      id: cart.id,
      tenantId: tenant.id,
      userId: user.id,
      version: 1,
      items: [{
        productId: product.productId,
        variantId: product.variantId,
        quantity: 2,
        unitPrice: "12.00",
        currency: "USD",
        updatedAt: new Date().toISOString()
      }],
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      id: "pi_test_checkout",
      client_secret: "pi_secret_test"
    }), { status: 200 })));
    const repository = new PrismaCheckoutRepository(harness.prisma, integrationEnv);

    try {
      const result = await repository.startCheckout({
        tenantId: tenant.id,
        userId: user.id,
        cartId: cart.id,
        email: "buyer@example.com",
        shippingAddress: { line1: "Test" },
        idempotencyKey: "checkout-idempotency-key"
      }, snapshot, {
        userId: user.id,
        requestId: "test-request"
      });

      expect(result.order.status).toBe("pending");
      expect(result.payment.payment.providerPaymentId).toBe("pi_test_checkout");
      expect(result.payment.providerClientSecret).toBe("pi_secret_test");

      const reservations = await harness.prisma.inventoryReservation.findMany({
        where: {
          tenantId: tenant.id,
          orderItemId: {
            not: null
          }
        }
      });
      const inventory = await harness.prisma.inventoryItem.findUniqueOrThrow({
        where: {
          id: product.inventoryItemId
        }
      });

      expect(reservations).toHaveLength(1);
      expect(reservations[0]?.inventoryItemId).toBe(product.inventoryItemId);
      expect(reservations[0]?.quantity).toBe(2);
      expect(inventory.quantity).toBe(3);
      expect(inventory.reserved).toBe(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
