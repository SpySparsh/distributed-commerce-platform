import type { FastifyInstance } from "fastify";
import type { ApiEnv } from "../env.js";
import { configPlugin } from "./config.js";
import { cookiePlugin } from "./cookie.js";
import { corsPlugin } from "./cors.js";
import { queuePlugin } from "./queue.js";
import { rateLimitPlugin } from "./rate-limit.js";
import { redisPlugin } from "./redis.js";
import { requestContextPlugin } from "./request-context.js";
import { sanitizationPlugin } from "./sanitization.js";
import { securityHeadersPlugin } from "./security-headers.js";
import { sentryPlugin } from "./sentry.js";

export const registerPlugins = async (app: FastifyInstance, config: ApiEnv): Promise<void> => {
  await app.register(configPlugin, { config });
  await app.register(sentryPlugin);
  await app.register(cookiePlugin);
  await app.register(requestContextPlugin);
  await app.register(securityHeadersPlugin);
  await app.register(corsPlugin);
  await app.register(redisPlugin);
  await app.register(queuePlugin);
  await app.register(sanitizationPlugin);
  await app.register(rateLimitPlugin);
};
