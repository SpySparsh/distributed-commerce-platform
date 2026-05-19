import { describe, expect, it } from "vitest";
import { createJobOptions, queueRouting } from "./options.js";
import { ecommerceJobSchema } from "./schemas.js";
import { jobNames, queueNames } from "./names.js";

const tenantId = "11111111-1111-4111-8111-111111111111";

describe("queue schemas and routing", () => {
  it("validates payment retry jobs with strict payloads", () => {
    const parsed = ecommerceJobSchema.parse({
      name: jobNames.retryPayment,
      metadata: {
        tenantId,
        idempotencyKey: "payment-retry-key-123",
        createdAt: new Date().toISOString()
      },
      data: {
        paymentId: "99999999-9999-4999-8999-999999999999",
        orderId: "88888888-8888-4888-8888-888888888888",
        attempt: 1
      }
    });

    expect(parsed.name).toBe(jobNames.retryPayment);
    expect(queueRouting[parsed.name].queueName).toBe(queueNames.paymentRetry);
  });

  it("routes domain events through the domain event queue with retry settings", () => {
    const routing = queueRouting[jobNames.dispatchDomainEvent];
    const options = createJobOptions(jobNames.dispatchDomainEvent, "domain-event:abc");

    expect(routing.queueName).toBe(queueNames.domainEvents);
    expect(options.attempts).toBe(8);
    expect(options.jobId).toBe("domain-event:abc");
  });

  it("rejects malformed jobs before they hit workers", () => {
    expect(() => ecommerceJobSchema.parse({
      name: jobNames.retryPayment,
      metadata: {
        tenantId,
        idempotencyKey: "short",
        createdAt: "not-a-date"
      },
      data: {
        paymentId: "bad",
        orderId: "bad",
        attempt: 0
      }
    })).toThrow();
  });
});
