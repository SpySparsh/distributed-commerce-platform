import { describe, expect, it } from "vitest";
import { assertOrderTransition, toOrderEventType } from "./order.state-machine.js";

describe("order state machine", () => {
  it("allows forward lifecycle transitions", () => {
    expect(() => assertOrderTransition("pending", "confirmed")).not.toThrow();
    expect(() => assertOrderTransition("confirmed", "paid")).not.toThrow();
    expect(() => assertOrderTransition("paid", "fulfilled")).not.toThrow();
    expect(() => assertOrderTransition("fulfilled", "refunded")).not.toThrow();
  });

  it("rejects uncontrolled direct transitions", () => {
    expect(() => assertOrderTransition("pending", "paid")).toThrow("Order cannot transition");
    expect(() => assertOrderTransition("cancelled", "fulfilled")).toThrow("Order cannot transition");
  });

  it("maps statuses to audit-friendly event types", () => {
    expect(toOrderEventType("paid")).toBe("paid");
    expect(toOrderEventType("cancelled")).toBe("cancelled");
  });
});
