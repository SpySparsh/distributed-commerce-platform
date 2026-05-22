import type { FastifyPluginAsync } from "fastify";
import type { RedisCacheClient } from "@ecommerce/cache";
import { validateRequest, withRateLimit } from "../../http/validate.js";
import { getAuthenticatedTenantId, getAuthenticatedUserId, requirePermission } from "../auth/auth.middleware.js";
import { permissions } from "../auth/permissions.js";
import {
  cartIdentityQuerySchema,
  cartParamsSchema,
  mergeCartBodySchema,
  removeCartItemParamsSchema,
  upsertCartItemBodySchema
} from "./cart.schemas.js";
import type { CartRepository } from "./cart.repository.js";
import type { CartInventoryReader } from "./inventory.reader.js";
import { createCartService } from "./cart.service.js";

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

export interface CartRouteOptions {
  readonly repository: CartRepository;
  readonly inventory: CartInventoryReader;
}

export const cartRoutes: FastifyPluginAsync<CartRouteOptions> = async (app, options) => {
  const cartService = createCartService(
    options.repository,
    options.inventory,
    createRedisCacheClient(app)
  );

  app.post(
    "/",
    {
      preHandler: [
        requirePermission(permissions.cartsWrite),
        withRateLimit({ keyPrefix: "carts:create", maxRequests: 120 }),
        validateRequest({ query: cartIdentityQuerySchema })
      ]
    },
    async (request) => {
      const identity = cartIdentityQuerySchema.parse(request.query);
      const cart = await cartService.getOrCreateCart({
        ...identity,
        tenantId: getAuthenticatedTenantId(request),
        userId: getAuthenticatedUserId(request)
      });

      return {
        ok: true,
        data: {
          cart
        }
      };
    }
  );

  app.get(
    "/:cartId",
    {
      preHandler: [
        requirePermission(permissions.cartsRead),
        withRateLimit({ keyPrefix: "carts:get", maxRequests: 300 }),
        validateRequest({ params: cartParamsSchema, query: cartIdentityQuerySchema })
      ]
    },
    async (request, reply) => {
      const params = cartParamsSchema.parse(request.params);
      cartIdentityQuerySchema.parse(request.query);
      const tenantId = getAuthenticatedTenantId(request);
      const userId = getAuthenticatedUserId(request);
      const cart = await cartService.getCart(tenantId, params.cartId, { userId });

      if (cart === undefined) {
        await reply.status(404).send({
          ok: false,
          error: {
            code: "CART_NOT_FOUND",
            message: "Cart not found",
            correlationId: request.correlationId
          }
        });
        return;
      }

      return {
        ok: true,
        data: {
          cart
        }
      };
    }
  );

  app.put(
    "/:cartId/items",
    {
      preHandler: [
        requirePermission(permissions.cartsWrite),
        withRateLimit({ keyPrefix: "carts:item:upsert", maxRequests: 180 }),
        validateRequest({ params: cartParamsSchema, query: cartIdentityQuerySchema, body: upsertCartItemBodySchema })
      ]
    },
    async (request) => {
      const params = cartParamsSchema.parse(request.params);
      cartIdentityQuerySchema.parse(request.query);
      const body = upsertCartItemBodySchema.parse(request.body);
      const tenantId = getAuthenticatedTenantId(request);
      const userId = getAuthenticatedUserId(request);
      const cart = await cartService.upsertItem(tenantId, params.cartId, body, { userId });

      return {
        ok: true,
        data: {
          cart
        }
      };
    }
  );

  app.delete(
    "/:cartId/items/:variantId",
    {
      preHandler: [
        requirePermission(permissions.cartsWrite),
        withRateLimit({ keyPrefix: "carts:item:remove", maxRequests: 180 }),
        validateRequest({ params: removeCartItemParamsSchema, query: cartIdentityQuerySchema })
      ]
    },
    async (request) => {
      const params = removeCartItemParamsSchema.parse(request.params);
      cartIdentityQuerySchema.parse(request.query);
      const tenantId = getAuthenticatedTenantId(request);
      const userId = getAuthenticatedUserId(request);
      const cart = await cartService.removeItem(tenantId, params.cartId, params.variantId, { userId });

      return {
        ok: true,
        data: {
          cart
        }
      };
    }
  );

  app.post(
    "/merge",
    {
      preHandler: [
        requirePermission(permissions.cartsWrite),
        withRateLimit({ keyPrefix: "carts:merge", maxRequests: 60 }),
        validateRequest({ body: mergeCartBodySchema })
      ]
    },
    async (request) => {
      const body = mergeCartBodySchema.parse(request.body);
      const cart = await cartService.mergeGuestCart(
        getAuthenticatedTenantId(request),
        body.sourceCartId,
        body.targetCartId
      );

      return {
        ok: true,
        data: {
          cart
        }
      };
    }
  );

  app.post(
    "/:cartId/sync",
    {
      preHandler: [
        requirePermission(permissions.cartsWrite),
        withRateLimit({ keyPrefix: "carts:sync", maxRequests: 120 }),
        validateRequest({ params: cartParamsSchema, query: cartIdentityQuerySchema })
      ]
    },
    async (request) => {
      const params = cartParamsSchema.parse(request.params);
      cartIdentityQuerySchema.parse(request.query);
      const tenantId = getAuthenticatedTenantId(request);
      const userId = getAuthenticatedUserId(request);
      const cart = await cartService.syncCart(tenantId, params.cartId, { userId });

      return {
        ok: true,
        data: {
          cart
        }
      };
    }
  );
};
