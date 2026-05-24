import { createPinoOptions } from "@ecommerce/logger";
import type { EmailServiceEnv } from "../env.js";

export const createLoggerOptions = (config: EmailServiceEnv) =>
  createPinoOptions({
    serviceName: "email-service",
    environment: config.NODE_ENV,
    level: config.LOG_LEVEL
  });
