import type { FastifyPluginAsync } from "fastify";
import { getHealthStatus, getReadinessStatus } from "./health.service.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => getHealthStatus());
  app.get("/ready", async (request, reply) => {
    const readiness = await getReadinessStatus(app);

    if (readiness.status === "not_ready") {
      await reply.status(503).send(readiness);
      return;
    }

    return readiness;
  });
};
