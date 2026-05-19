import type { FastifyInstance } from "fastify";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { healthRoutes } from "../modules/health/health.routes.js";

export const registerRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(healthRoutes, { prefix: "/health" });
};
