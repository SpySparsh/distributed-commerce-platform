import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTestApiEnv } from "../../test-utils/api-env.js";
import { createPaymentProviderClient } from "./payment.provider.js";

describe("payment provider webhooks", () => {
  it("verifies Stripe signatures and maps captured payments", () => {
    const webhookSecret = "whsec_test_secret";
    const env = createTestApiEnv({
      STRIPE_WEBHOOK_SECRET: webhookSecret
    });
    const client = createPaymentProviderClient("stripe", env);
    const timestamp = Math.floor(Date.now() / 1000);
    const rawBody = JSON.stringify({
      id: "evt_123",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_123",
          latest_charge: "ch_123"
        }
      }
    });
    const signature = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const event = client.verifyWebhook({
      rawBody,
      signature: `t=${timestamp},v1=${signature}`,
      tenantId: "tenant"
    });

    expect(event).toMatchObject({
      provider: "stripe",
      providerEventId: "evt_123",
      providerPaymentId: "pi_123",
      providerTransactionId: "ch_123",
      status: "captured"
    });
  });

  it("rejects invalid webhook signatures", () => {
    const client = createPaymentProviderClient("stripe", createTestApiEnv({
      STRIPE_WEBHOOK_SECRET: "whsec_test_secret"
    }));

    expect(() => client.verifyWebhook({
      rawBody: "{}",
      signature: "t=123,v1=bad",
      tenantId: "tenant"
    })).toThrow("Invalid payment webhook signature");
  });
});
