import { createEnvSchema } from "@ecommerce/config";
import { z } from "zod";

export const workerEnvSchema = createEnvSchema({
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  MEILISEARCH_HOST: z.url().default("http://localhost:7700"),
  MEILISEARCH_API_KEY: z.string().min(1).default("development-master-key"),
  MEILISEARCH_INDEX_PREFIX: z.string().min(1).default("ecommerce"),
  EMAIL_WEBHOOK_URL: z.url().optional(),
  EMAIL_SERVICE_SECRET: z.string().min(32).optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  WORKER_SHUTDOWN_GRACE_MS: z.coerce.number().int().positive().default(10000)
}).superRefine((env, context) => {
  if (env.NODE_ENV === "production" && env.EMAIL_WEBHOOK_URL === undefined) {
    context.addIssue({
      code: "custom",
      path: ["EMAIL_WEBHOOK_URL"],
      message: "EMAIL_WEBHOOK_URL is required in production so order, payment, and delivery emails do not silently fail."
    });
  }

  if (env.EMAIL_WEBHOOK_URL !== undefined && env.EMAIL_SERVICE_SECRET === undefined) {
    context.addIssue({
      code: "custom",
      path: ["EMAIL_SERVICE_SECRET"],
      message: "EMAIL_SERVICE_SECRET is required when EMAIL_WEBHOOK_URL is configured."
    });
  }
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;
