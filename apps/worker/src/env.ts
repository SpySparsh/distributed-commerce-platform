import { createEnvSchema } from "@ecommerce/config";
import { z } from "zod";

export const workerEnvSchema = createEnvSchema({
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  MEILISEARCH_HOST: z.url().default("http://localhost:7700"),
  MEILISEARCH_API_KEY: z.string().min(1).default("development-master-key"),
  MEILISEARCH_INDEX_PREFIX: z.string().min(1).default("ecommerce"),
  EMAIL_WEBHOOK_URL: z.url().optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  WORKER_SHUTDOWN_GRACE_MS: z.coerce.number().int().positive().default(10000)
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;
