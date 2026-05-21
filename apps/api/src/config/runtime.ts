import { loadRootEnv, parseEnv } from "@ecommerce/config";
import { apiEnvSchema, type ApiEnv } from "../env.js";

export const loadApiEnv = (env: Record<string, string | undefined> = process.env): ApiEnv => {
  if (env === process.env) {
    loadRootEnv();
  }

  return parseEnv(apiEnvSchema, env);
};
