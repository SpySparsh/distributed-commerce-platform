import { describe, expect, it } from "vitest";

const runIntegration = process.env["RUN_INTEGRATION"] === "true";

describe.skipIf(!runIntegration)("database integration strategy", () => {
  it("is gated behind RUN_INTEGRATION to avoid accidental local DB coupling", () => {
    expect(process.env["DATABASE_URL"]).toEqual(expect.stringContaining("_test"));
  });
});
