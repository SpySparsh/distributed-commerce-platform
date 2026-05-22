import Fastify, { type FastifyInstance } from "fastify";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Server } from "node:http";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerLifecycleHooks } from "./plugins/lifecycle-hooks.js";
import { registerPlugins } from "./plugins/index.js";
import { registerRoutes } from "./routes/index.js";
import type { ApiEnv } from "./env.js";
import { createLoggerOptions } from "./logging/logger.js";

export interface BuildAppOptions {
  readonly config: ApiEnv;
}

const validateDefaultPaymentProviderConfig = (config: ApiEnv): void => {
  if (config.STRIPE_SECRET_KEY === undefined) {
    throw new Error("PAYMENT_PROVIDER=stripe requires STRIPE_SECRET_KEY");
  }
};

export const buildApp = async ({ config }: BuildAppOptions): Promise<FastifyInstance> => {
  validateDefaultPaymentProviderConfig(config);

  const app = Fastify<Server, IncomingMessage, ServerResponse>({
    logger: createLoggerOptions(config),
    genReqId: (request) => {
      const headerValue = request.headers[config.REQUEST_ID_HEADER];
      return Array.isArray(headerValue)
        ? headerValue[0] ?? crypto.randomUUID()
        : headerValue ?? crypto.randomUUID();
    },
    trustProxy: config.NODE_ENV === "production"
  });

  registerErrorHandler(app);
  await registerPlugins(app, config);
  app.log.info({
    defaultProvider: config.PAYMENT_PROVIDER,
    stripeSecretConfigured: config.STRIPE_SECRET_KEY !== undefined,
    stripeWebhookConfigured: config.STRIPE_WEBHOOK_SECRET !== undefined
  }, "Payment provider configuration validated");
  registerLifecycleHooks(app);
  await registerRoutes(app);

  return app;
};
