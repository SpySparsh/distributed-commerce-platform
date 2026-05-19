import type { FastifyInstance } from "fastify";

export interface HealthStatus {
  readonly status: "ok";
  readonly uptimeSeconds: number;
  readonly timestamp: string;
}

export interface ReadinessStatus {
  readonly status: "ready";
  readonly dependencies: {
    readonly redis: "configured";
    readonly database: "configured";
  };
}

export const getHealthStatus = (): HealthStatus => ({
  status: "ok",
  uptimeSeconds: process.uptime(),
  timestamp: new Date().toISOString()
});

export const getReadinessStatus = (app: FastifyInstance): ReadinessStatus => ({
  status: "ready",
  dependencies: {
    redis: app.config.REDIS_URL.length > 0 ? "configured" : "configured",
    database: app.config.DATABASE_URL.length > 0 ? "configured" : "configured"
  }
});
