import type { FastifyInstance } from "fastify";
import { buildEmailServiceApp } from "./app.js";
import { loadEmailServiceEnv } from "./config/runtime.js";

const closeWithTimeout = async (app: FastifyInstance, timeoutMs: number): Promise<void> => {
  await Promise.race([
    app.close(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Email service shutdown exceeded ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
};

const config = loadEmailServiceEnv();
const app = await buildEmailServiceApp({ config });

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  app.log.info({ signal }, "Email service shutdown signal received");

  try {
    await closeWithTimeout(app, 10_000);
    app.log.info("Email service stopped");
    process.exit(0);
  } catch (error) {
    app.log.error({ error }, "Email service failed to stop cleanly");
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
  host: config.EMAIL_SERVICE_HOST,
  port: config.EMAIL_SERVICE_PORT
});
