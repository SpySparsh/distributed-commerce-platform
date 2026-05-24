import { createEnvSchema } from "@ecommerce/config";
import { z } from "zod";

export const emailServiceEnvSchema = createEnvSchema({
  EMAIL_SERVICE_HOST: z.string().min(1).default("0.0.0.0"),
  EMAIL_SERVICE_PORT: z.coerce.number().int().positive().default(4100),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).default("info"),
  EMAIL_SERVICE_SECRET: z.string().min(32),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.email(),
  EMAIL_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
  EMAIL_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60)
});

export type EmailServiceEnv = z.infer<typeof emailServiceEnvSchema>;
