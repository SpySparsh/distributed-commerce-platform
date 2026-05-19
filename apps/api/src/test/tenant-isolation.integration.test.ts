import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { buildApp } from "../app.js";
import { issueTokens } from "../modules/auth/token.service.js";
import { createIntegrationHarness, describeIntegration, integrationEnv, seedTenant, seedUser } from "../test-utils/integration-harness.js";

describeIntegration("tenant isolation integration", () => {
  const harness = createIntegrationHarness();

  it("does not allow an authenticated user from one tenant to read another tenant cart", async () => {
    const tenantA = await seedTenant(harness.prisma, { slug: "tenant-a" });
    const tenantB = await seedTenant(harness.prisma, { slug: "tenant-b" });
    const userB = await seedUser(harness.prisma, { tenantId: tenantB.id });
    const cartA = await harness.prisma.cart.create({
      data: {
        tenantId: tenantA.id,
        status: "active",
        expiresAt: new Date(Date.now() + 60_000)
      }
    });
    const tokens = await issueTokens(integrationEnv, {
      sub: userB.id,
      tenantId: tenantB.id,
      sessionId: randomUUID(),
      roles: ["customer"],
      permissions: ["carts:read"]
    });
    const app = await buildApp({ config: integrationEnv });

    try {
      const response = await app.inject({
        method: "GET",
        url: `/carts/${cartA.id}`,
        headers: {
          authorization: `Bearer ${tokens.accessToken}`
        }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("CART_NOT_FOUND");
    } finally {
      await app.close();
    }
  });
});
