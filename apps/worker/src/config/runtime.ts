import { loadRootEnv, parseEnv } from "@ecommerce/config";
import { workerEnvSchema, type WorkerEnv } from "../env.js";

export const loadWorkerEnv = (
  env: Record<string, string | undefined> = process.env
): WorkerEnv => {
  if (env === process.env) {
    loadRootEnv();
  }

  return parseEnv(workerEnvSchema, env);
};
