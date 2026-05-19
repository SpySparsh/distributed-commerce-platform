import { createHmac } from "node:crypto";
import { expect, it } from "vitest";
import { createPaymentService } from "../modules/payments/payment.service.js";
import { PrismaPaymentRepository } from "../modules/payments/prisma-payment.repository.js";
import { createIntegrationHarness, describeIntegration, integrationEnv, seedTenant, seedUser } from "../test-utils/integration-harness.js";

const stripeSignature = (rawBody: string): string => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", integrationEnv.STRIPE_WEBHOOK_SECRET ?? "")
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
};

describeIntegration("payment webhook integration", () => {
  const harness = createIntegrationHarness();

  it("handles duplicate captured webhooks idempotently and writes a single outbox event", async () => {
    const tenant = await seedTenant(harness.prisma);
    const user = await seedUser(harness.prisma, { tenantId: tenant.id });
    const order = await harness.prisma.order.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        orderNumber: "ORD-WEBHOOK-1",
        status: "pending",
        subtotalAmount: "10.00",
        totalAmount: "10.00",
        currency: "USD",
        email: "buyer@example.com",
        shippingAddress: {}
      }
    });
    await harness.prisma.payment.create({
      data: {
        tenantId: tenant.id,
        orderId: order.id,
        provider: "stripe",
        providerPaymentId: "pi_duplicate",
        amount: "10.00",
        currency: "USD",
        idempotencyKey: "payment-webhook-idempotency"
      }
    });
    const rawBody = JSON.stringify({
      id: "evt_duplicate",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_duplicate",
          latest_charge: "ch_duplicate"
        }
      }
    });
    const service = createPaymentService(new PrismaPaymentRepository(harness.prisma), {
      enqueue: async () => "unused",
      close: async () => {}
    }, integrationEnv);

    const results = await Promise.all([
      service.handleWebhook({
        provider: "stripe",
        rawBody,
        signature: stripeSignature(rawBody)
      }),
      service.handleWebhook({
        provider: "stripe",
        rawBody,
        signature: stripeSignature(rawBody)
      })
    ]);

    expect(results.filter((result) => result.processed)).toHaveLength(1);
    expect(await harness.prisma.domainEventLog.count({
      where: {
        tenantId: tenant.id,
        name: "PaymentCompleted"
      }
    })).toBe(1);
    expect(await harness.prisma.paymentWebhookEvent.count({
      where: {
        tenantId: tenant.id,
        providerEventId: "evt_duplicate"
      }
    })).toBe(1);
  });
});
