import type { FastifyPluginAsync } from "fastify";
import { getHealthStatus, getReadinessStatus } from "./health.service.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => getHealthStatus());
  app.get("/ready", async () => getReadinessStatus(app));
};
