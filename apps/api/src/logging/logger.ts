import { createPinoOptions } from "@ecommerce/logger";
import type { ApiEnv } from "../env.js";

export const createLoggerOptions = (config: ApiEnv) =>
  createPinoOptions({
    serviceName: "api",
    environment: config.NODE_ENV,
    level: config.LOG_LEVEL
  });
