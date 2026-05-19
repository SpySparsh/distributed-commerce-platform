import Fastify from "fastify";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { configPlugin } from "../plugins/config.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { requestContextPlugin } from "../plugins/request-context.js";
import { healthRoutes } from "../modules/health/health.routes.js";
import { createTestApiEnv } from "../test-utils/api-env.js";

describe("health API", () => {
  it("serves health checks through an HTTP boundary", async () => {
    const app = Fastify();
    await app.register(configPlugin, { config: createTestApiEnv() });
    registerErrorHandler(app);
    await app.register(healthRoutes, { prefix: "/health" });
    await app.ready();

    try {
      const response = await request(app.server).get("/health").expect(200);

      expect(response.body).toMatchObject({
        status: "ok"
      });
      expect(response.body.timestamp).toEqual(expect.any(String));
    } finally {
      await app.close();
    }
  });

  it("formats not found responses consistently", async () => {
    const app = Fastify({
      genReqId: () => "test-request-id"
    });
    await app.register(configPlugin, { config: createTestApiEnv() });
    registerErrorHandler(app);
    await app.register(requestContextPlugin);
    await app.ready();

    try {
      const response = await request(app.server).get("/missing").expect(404);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Route not found",
          correlationId: "test-request-id"
        }
      });
    } finally {
      await app.close();
    }
  });
});
