import Fastify, { type FastifyInstance } from "fastify";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Server } from "node:http";
import type { ZodError } from "zod";
import type { EmailServiceEnv } from "./env.js";
import { createLoggerOptions } from "./logging/logger.js";
import { sendRoute } from "./routes/send.route.js";

export interface BuildEmailServiceAppOptions {
  readonly config: EmailServiceEnv;
}

const getStatusCode = (error: Error & { statusCode?: number }): number =>
  typeof error.statusCode === "number" ? error.statusCode : 500;

export const buildEmailServiceApp = async ({
  config
}: BuildEmailServiceAppOptions): Promise<FastifyInstance> => {
  const app = Fastify<Server, IncomingMessage, ServerResponse>({
    logger: createLoggerOptions(config),
    trustProxy: config.NODE_ENV === "production",
    genReqId: (request) => {
      const headerValue = request.headers["x-request-id"];
      return Array.isArray(headerValue)
        ? headerValue[0] ?? crypto.randomUUID()
        : headerValue ?? crypto.randomUUID();
    }
  });

  app.decorate("emailRateLimitState", new Map<string, { count: number; windowStartedAt: number }>());

  app.addHook("onRequest", async (request) => {
    const now = Date.now();
    const windowMs = config.EMAIL_RATE_LIMIT_WINDOW_SECONDS * 1000;
    const state = request.server.emailRateLimitState;
    const ip = request.ip;
    const current = state.get(ip);

    if (current === undefined || now - current.windowStartedAt > windowMs) {
      state.set(ip, {
        count: 1,
        windowStartedAt: now
      });
      return;
    }

    current.count += 1;

    if (current.count > config.EMAIL_RATE_LIMIT_MAX_REQUESTS) {
      const error = new Error("Too many requests");
      Object.assign(error, {
        statusCode: 429,
        code: "RATE_LIMITED"
      });
      throw error;
    }
  });

  app.setErrorHandler(async (error: Error & { code?: string; statusCode?: number }, request, reply) => {
    const statusCode = getStatusCode(error);
    const zodError = error as Error & Partial<ZodError>;
    const fieldErrors = Array.isArray(zodError.issues)
      ? Object.fromEntries(zodError.issues.map((issue) => [issue.path.join(".") || "root", [issue.message]]))
      : undefined;

    request.log.error(
      {
        requestId: request.id,
        route: request.routeOptions.url,
        error: {
          name: error.name,
          code: error.code,
          message: error.message,
          stack: error.stack
        }
      },
      "Email service request failed"
    );

    await reply.status(statusCode).send({
      ok: false,
      error: {
        code: error.code ?? (statusCode === 401 ? "UNAUTHORIZED" : "EMAIL_SERVICE_ERROR"),
        message: statusCode >= 500 ? "Email service failed" : error.message,
        ...(fieldErrors === undefined ? {} : { fieldErrors })
      }
    });
  });

  app.get("/health", async () => ({
    ok: true,
    service: "email-service"
  }));

  await app.register(sendRoute, { config });

  app.log.info(
    {
      resendConfigured: config.RESEND_API_KEY.length > 0,
      emailFrom: config.EMAIL_FROM
    },
    "Email service configured"
  );

  return app;
};

declare module "fastify" {
  interface FastifyInstance {
    emailRateLimitState: Map<string, { count: number; windowStartedAt: number }>;
  }
}
