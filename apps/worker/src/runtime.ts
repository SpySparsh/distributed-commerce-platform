import { PrismaClient } from "@ecommerce/database";
import { MeilisearchHttpClient } from "@ecommerce/search";
import { loadWorkerEnv } from "./config/runtime.js";
import { createWorkerLogger } from "./logging/logger.js";
import { createWorkers } from "./queue/workers.js";

const closeWithTimeout = async (
  close: () => Promise<void>,
  timeoutMs: number
): Promise<void> => {
  await Promise.race([
    close(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Worker shutdown exceeded ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
};

export const startWorkerRuntime = async (): Promise<void> => {
  const env = loadWorkerEnv();
  const logger = createWorkerLogger(env);
  const prisma = new PrismaClient({
    log: ["error", "warn"]
  });
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  const search = new MeilisearchHttpClient({
    host: env.MEILISEARCH_HOST,
    apiKey: env.MEILISEARCH_API_KEY,
    indexPrefix: env.MEILISEARCH_INDEX_PREFIX
  });
  const runtime = createWorkers(
    {
      url: env.REDIS_URL,
      maxRetriesPerRequest: null
    },
    prisma,
    search,
    env,
    env.WORKER_CONCURRENCY,
    logger
  );

  logger.info({ concurrency: env.WORKER_CONCURRENCY }, "Worker runtime started");

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info({ signal }, "Worker shutdown signal received");

    try {
      await closeWithTimeout(async () => {
        await runtime.close();
        await prisma.$disconnect();
      }, env.WORKER_SHUTDOWN_GRACE_MS);
      logger.info("Worker runtime stopped");
      process.exit(0);
    } catch (error) {
      logger.error({ error }, "Worker runtime failed to stop cleanly");
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
};
