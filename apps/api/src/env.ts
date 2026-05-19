import { createEnvSchema } from "@ecommerce/config";
import { z } from "zod";

export const apiEnvSchema = createEnvSchema({
  API_HOST: z.string().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).default("info"),
  REQUEST_ID_HEADER: z.string().min(1).default("x-request-id"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  CORS_ALLOWED_METHODS: z.string().min(1).default("GET,POST,PUT,PATCH,DELETE,OPTIONS"),
  SHUTDOWN_GRACE_MS: z.coerce.number().int().positive().default(10000),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(10),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  AUTH_COOKIE_DOMAIN: z.string().min(1).optional(),
  AUTH_COOKIE_SECURE: z.coerce.boolean().default(true),
  CSRF_COOKIE_NAME: z.string().min(1).default("csrf_token"),
  CSRF_HEADER_NAME: z.string().min(1).default("x-csrf-token")
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
