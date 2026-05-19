import { parseEnv } from "@ecommerce/config";
import { workerEnvSchema, type WorkerEnv } from "../env.js";

export const loadWorkerEnv = (
  env: Record<string, string | undefined> = process.env
): WorkerEnv => parseEnv(workerEnvSchema, env);
