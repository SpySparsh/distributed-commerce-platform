import { parseWithSchema } from "@ecommerce/validation";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";

export interface RequestValidationSchemas {
  readonly body?: z.ZodType;
  readonly query?: z.ZodType;
  readonly params?: z.ZodType;
}

export const validateRequest =
  (schemas: RequestValidationSchemas) =>
  async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (schemas.body !== undefined) {
      request.body = parseWithSchema(schemas.body, request.body);
    }

    if (schemas.query !== undefined) {
      request.query = parseWithSchema(schemas.query, request.query) as typeof request.query;
    }

    if (schemas.params !== undefined) {
      request.params = parseWithSchema(schemas.params, request.params) as typeof request.params;
    }
  };

export const withRateLimit =
  (options: NonNullable<FastifyRequest["rateLimit"]>) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    request.rateLimit = options;

    const maxRequests = options.maxRequests ?? request.server.config.RATE_LIMIT_MAX_REQUESTS;
    const windowSeconds = options.windowSeconds ?? request.server.config.RATE_LIMIT_WINDOW_SECONDS;
    const keyPrefix = options.keyPrefix ?? "route";
    const tenantId = request.user?.tenantId ?? "anonymous";
    const key = `rate-limit:${tenantId}:${keyPrefix}:${request.ip}`;
    const requestCount = await request.server.redis.incr(key);

    if (requestCount === 1) {
      await request.server.redis.expire(key, windowSeconds);
    }

    const ttl = await request.server.redis.ttl(key);
    const remaining = Math.max(maxRequests - requestCount, 0);

    reply.header("ratelimit-limit", String(maxRequests));
    reply.header("ratelimit-remaining", String(remaining));
    reply.header("ratelimit-reset", String(Math.max(ttl, 0)));

    if (requestCount > maxRequests) {
      const error = new Error("Too many requests");
      error.name = "RateLimitError";
      Object.assign(error, {
        code: "RATE_LIMITED",
        statusCode: 429
      });
      throw error;
    }
  };
