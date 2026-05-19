import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { loadApiEnv } from "./config/runtime.js";

const closeWithTimeout = async (app: FastifyInstance, timeoutMs: number): Promise<void> => {
  await Promise.race([
    app.close(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Graceful shutdown exceeded ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
};

export const startServer = async (): Promise<void> => {
  const config = loadApiEnv();
  const app = await buildApp({ config });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, "Shutdown signal received");

    try {
      await closeWithTimeout(app, config.SHUTDOWN_GRACE_MS);
      app.log.info("HTTP server closed");
      process.exit(0);
    } catch (error) {
      app.log.error({ error }, "Failed to shut down cleanly");
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  await app.listen({
    host: config.API_HOST,
    port: config.API_PORT
  });
};
