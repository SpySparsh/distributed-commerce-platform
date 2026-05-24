import { loadRootEnv, parseEnv } from "@ecommerce/config";
import { emailServiceEnvSchema, type EmailServiceEnv } from "../env.js";

export const loadEmailServiceEnv = (
  env: Record<string, string | undefined> = process.env
): EmailServiceEnv => {
  if (env === process.env) {
    loadRootEnv();
  }

  return parseEnv(emailServiceEnvSchema, env);
};
