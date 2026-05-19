import { deleteCart, getCart, type RedisCacheClient } from "@ecommerce/cache";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { validateRequest, withRateLimit } from "../../http/validate.js";
import { getAuthenticatedTenantId, getAuthenticatedUserId, requirePermission } from "../auth/auth.middleware.js";
import { permissions } from "../auth/permissions.js";
import type { OrderActor } from "../orders/order.repository.js";
import type { CheckoutRepository } from "./checkout.repository.js";
import { startCheckoutBodySchema } from "./checkout.schemas.js";

const createRedisCacheClient = (app: Parameters<FastifyPluginAsync>[0]): RedisCacheClient => ({
  get: (key) => app.redis.get(key),
  set: (key, value, mode, ttl, condition) =>
    mode === undefined || ttl === undefined
      ? app.redis.set(key, value)
      : condition === undefined
        ? app.redis.call("set", key, value, mode, String(ttl))
        : app.redis.call("set", key, value, mode, String(ttl), condition),
  del: (...keys) => app.redis.del(...keys),
  expire: (key, seconds) => app.redis.expire(key, seconds),
  scan: (cursor, matchLabel, pattern, countLabel, count) =>
    app.redis.scan(cursor, matchLabel, pattern, countLabel, count),
  eval: (script, keyCount, ...args) => app.redis.eval(script, keyCount, ...args),
  hgetall: (key) => app.redis.hgetall(key),
  hset: (key, values) => app.redis.hset(key, values),
  hdel: (key, ...fields) => app.redis.hdel(key, ...fields)
});

const getActor = (request: FastifyRequest): OrderActor => ({
  ...(request.user?.id === undefined ? {} : { userId: request.user.id }),
  requestId: request.id,
  ipAddress: request.ip,
  ...(request.headers["user-agent"] === undefined
    ? {}
    : { userAgent: String(request.headers["user-agent"]) })
});

export interface CheckoutRouteOptions {
  readonly repository: CheckoutRepository;
}

export const checkoutRoutes: FastifyPluginAsync<CheckoutRouteOptions> = async (app, options) => {
  const redis = createRedisCacheClient(app);

  app.post(
    "/start",
    {
      preHandler: [
        requirePermission(permissions.checkoutWrite),
        withRateLimit({ keyPrefix: "checkout:start", maxRequests: 30 }),
        validateRequest({ body: startCheckoutBodySchema })
      ]
    },
    async (request, reply) => {
      const body = startCheckoutBodySchema.parse(request.body);
      const tenantId = getAuthenticatedTenantId(request);
      const userId = getAuthenticatedUserId(request);
      const checkout = await options.repository.startCheckout({
        ...body,
        tenantId,
        userId
      }, await getCart(redis, tenantId, body.cartId), getActor(request));

      await deleteCart(redis, tenantId, body.cartId);

      await reply.status(201).send({
        ok: true,
        data: checkout
      });
    }
  );
};
