import { createEnvSchema } from "@ecommerce/config";
import { z } from "zod";

export const workerEnvSchema = createEnvSchema({
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5)
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;
