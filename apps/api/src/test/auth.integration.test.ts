import { expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createIntegrationHarness, describeIntegration, integrationEnv, seedTenant } from "../test-utils/integration-harness.js";

const getSetCookie = (headers: Record<string, unknown>): string => {
  const value = headers["set-cookie"];
  return Array.isArray(value) ? value.map(String).join("; ") : typeof value === "string" ? value : "";
};

describeIntegration("auth API integration", () => {
  const harness = createIntegrationHarness();

  it("registers, refreshes, logs out, and logs in against real DB/Redis runtime", async () => {
    const tenant = await seedTenant(harness.prisma);
    const app = await buildApp({ config: integrationEnv });

    try {
      const register = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          tenantId: tenant.id,
          email: "buyer@example.com",
          password: "Str0ng-password!"
        }
      });
      const registerBody = register.json();

      expect(register.statusCode).toBe(200);
      expect(registerBody.data.accessToken).toEqual(expect.any(String));
      expect(await harness.prisma.session.count()).toBe(1);

      const cookie = getSetCookie(register.headers);
      const refresh = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        headers: {
          cookie
        },
        payload: {
          csrfToken: registerBody.data.csrfToken
        }
      });

      expect(refresh.statusCode).toBe(200);
      expect(refresh.json().data.accessToken).toEqual(expect.any(String));

      const logout = await app.inject({
        method: "POST",
        url: "/auth/logout",
        headers: {
          cookie: getSetCookie(refresh.headers)
        }
      });

      expect(logout.statusCode).toBe(200);
      expect(await harness.prisma.session.count({ where: { revokedAt: { not: null } } })).toBe(1);

      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          tenantId: tenant.id,
          email: "buyer@example.com",
          password: "Str0ng-password!"
        }
      });

      expect(login.statusCode).toBe(200);
      expect(login.json().data.accessToken).toEqual(expect.any(String));
    } finally {
      await app.close();
    }
  });
});
