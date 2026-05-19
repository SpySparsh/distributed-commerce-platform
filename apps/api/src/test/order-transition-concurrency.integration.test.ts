import { expect, it } from "vitest";
import { handlePaymentCompletedOrderWorkflow } from "../../../worker/src/jobs/order-payment-workflow.js";
import { createPaymentCompletedEvent } from "@ecommerce/events";
import { createIntegrationHarness, describeIntegration, seedProductWithInventory, seedTenant, seedUser } from "../test-utils/integration-harness.js";

describeIntegration("order transition concurrency integration", () => {
  const harness = createIntegrationHarness();

  it("marks an order paid once and consumes linked reservations exactly once", async () => {
    const tenant = await seedTenant(harness.prisma);
    const user = await seedUser(harness.prisma, { tenantId: tenant.id });
    const product = await seedProductWithInventory(harness.prisma, {
      tenantId: tenant.id,
      quantity: 2,
      reserved: 1
    });
    const order = await harness.prisma.order.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        orderNumber: "ORD-CONCURRENT-1",
        status: "pending",
        subtotalAmount: "25.00",
        totalAmount: "25.00",
        currency: "USD",
        email: "buyer@example.com",
        shippingAddress: {},
        items: {
          create: {
            tenantId: tenant.id,
            productId: product.productId,
            variantId: product.variantId,
            sku: "sku",
            name: "Item",
            quantity: 1,
            unitPrice: "25.00",
            totalAmount: "25.00",
            currency: "USD"
          }
        }
      },
      include: {
        items: true
      }
    });
    const payment = await harness.prisma.payment.create({
      data: {
        tenantId: tenant.id,
        orderId: order.id,
        provider: "stripe",
        status: "captured",
        providerPaymentId: "pi_concurrent",
        amount: "25.00",
        currency: "USD",
        idempotencyKey: "payment-concurrent"
      }
    });
    const orderItem = order.items[0];

    if (orderItem === undefined) {
      throw new Error("Expected seeded order item");
    }

    await harness.prisma.inventoryReservation.create({
      data: {
        tenantId: tenant.id,
        inventoryItemId: product.inventoryItemId,
        variantId: product.variantId,
        orderItemId: orderItem.id,
        quantity: 1,
        expiresAt: new Date(Date.now() + 60_000)
      }
    });
    const event = createPaymentCompletedEvent({
      tenantId: tenant.id,
      aggregateId: payment.id
    }, {
      paymentId: payment.id,
      orderId: order.id,
      provider: "stripe",
      amount: "25.00",
      currency: "USD",
      providerPaymentId: "pi_concurrent"
    });

    const results = await Promise.allSettled([
      handlePaymentCompletedOrderWorkflow(harness.prisma, event),
      handlePaymentCompletedOrderWorkflow(harness.prisma, event)
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await harness.prisma.order.count({ where: { id: order.id, status: "paid" } })).toBe(1);
    expect(await harness.prisma.inventoryReservation.count({
      where: {
        orderItemId: orderItem.id,
        status: "consumed"
      }
    })).toBe(1);

    const inventory = await harness.prisma.inventoryItem.findUniqueOrThrow({
      where: {
        id: product.inventoryItemId
      }
    });
    expect(inventory.quantity).toBe(1);
    expect(inventory.reserved).toBe(0);
  });
});
