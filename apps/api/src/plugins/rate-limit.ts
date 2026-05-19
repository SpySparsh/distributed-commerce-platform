import fp from "fastify-plugin";

interface RateLimitOptions {
  readonly maxRequests?: number;
  readonly windowSeconds?: number;
  readonly keyPrefix?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    rateLimit?: RateLimitOptions;
  }
}

class RateLimitError extends Error {
  readonly code = "RATE_LIMITED";
  readonly statusCode = 429;

  constructor() {
    super("Too many requests");
    this.name = "RateLimitError";
  }
}

const getRateLimitKey = (tenantId: string, identifier: string, keyPrefix: string): string =>
  `rate-limit:${tenantId}:${keyPrefix}:${identifier}`;

export const rateLimitPlugin = fp(
  async (app) => {
    app.addHook("onRequest", async (request, reply) => {
      const options = request.rateLimit ?? {};
      const maxRequests = options.maxRequests ?? app.config.RATE_LIMIT_MAX_REQUESTS;
      const windowSeconds = options.windowSeconds ?? app.config.RATE_LIMIT_WINDOW_SECONDS;
      const keyPrefix = options.keyPrefix ?? "global";
      const tenantId = request.user?.tenantId ?? "anonymous";
      const key = getRateLimitKey(tenantId, request.ip, keyPrefix);

      const requestCount = await app.redis.incr(key);

      if (requestCount === 1) {
        await app.redis.expire(key, windowSeconds);
      }

      const ttl = await app.redis.ttl(key);
      const remaining = Math.max(maxRequests - requestCount, 0);

      reply.header("ratelimit-limit", String(maxRequests));
      reply.header("ratelimit-remaining", String(remaining));
      reply.header("ratelimit-reset", String(Math.max(ttl, 0)));

      if (requestCount > maxRequests) {
        throw new RateLimitError();
      }
    });
  },
  {
    name: "rate-limit",
    dependencies: ["config", "redis"]
  }
);
