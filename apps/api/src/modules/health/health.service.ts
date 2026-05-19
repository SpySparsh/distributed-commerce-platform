import type { FastifyInstance } from "fastify";

export interface HealthStatus {
  readonly status: "ok";
  readonly uptimeSeconds: number;
  readonly timestamp: string;
}

export interface ReadinessStatus {
  readonly status: "ready" | "not_ready";
  readonly dependencies: {
    readonly redis: "up" | "down";
    readonly database: "up" | "down";
  };
}

export const getHealthStatus = (): HealthStatus => ({
  status: "ok",
  uptimeSeconds: process.uptime(),
  timestamp: new Date().toISOString()
});

export const getReadinessStatus = async (app: FastifyInstance): Promise<ReadinessStatus> => {
  const [redis, database] = await Promise.all([
    app.redis
      .ping()
      .then(() => "up" as const)
      .catch(() => "down" as const),
    app.prisma
      .$queryRaw`SELECT 1`
      .then(() => "up" as const)
      .catch(() => "down" as const)
  ]);

  return {
    status: redis === "up" && database === "up" ? "ready" : "not_ready",
    dependencies: {
      redis,
      database
    }
  };
};
