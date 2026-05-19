import type { ApiEnv } from "../env.js";

export const createLoggerOptions = (config: ApiEnv) => ({
  level: config.LOG_LEVEL,
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie"],
    remove: true
  }
});
