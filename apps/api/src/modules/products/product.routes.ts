import type { FastifyPluginAsync } from "fastify";
import { validateRequest, withRateLimit } from "../../http/validate.js";
import {
  categoryTreeQuerySchema,
  productListQuerySchema,
  productParamsSchema
} from "./product.schemas.js";
import { UnconfiguredProductRepository } from "./product.repository.js";
import { createProductService } from "./product.service.js";
import type { RedisCacheClient } from "@ecommerce/cache";

export const productRoutes: FastifyPluginAsync = async (app) => {
  const redisCacheClient: RedisCacheClient = {
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
  };
  const productService = createProductService(new UnconfiguredProductRepository(), redisCacheClient);

  app.get(
    "/",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "products:list", maxRequests: 300 }),
        validateRequest({ query: productListQuerySchema })
      ]
    },
    async (request) => {
      const query = productListQuerySchema.parse(request.query);
      const page = await productService.listProducts(query);

      return {
        ok: true,
        data: page
      };
    }
  );

  app.get(
    "/categories/tree",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "categories:tree", maxRequests: 300 }),
        validateRequest({ query: categoryTreeQuerySchema })
      ]
    },
    async (request) => {
      const query = categoryTreeQuerySchema.parse(request.query);
      const categories = await productService.getCategoryTree(query.tenantId);

      return {
        ok: true,
        data: {
          categories
        }
      };
    }
  );

  app.get(
    "/:slug",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "products:detail", maxRequests: 300 }),
        validateRequest({ params: productParamsSchema, query: categoryTreeQuerySchema })
      ]
    },
    async (request, reply) => {
      const params = productParamsSchema.parse(request.params);
      const query = categoryTreeQuerySchema.parse(request.query);
      const product = await productService.getProductBySlug(query.tenantId, params.slug);

      if (product === undefined) {
        await reply.status(404).send({
          ok: false,
          error: {
            code: "PRODUCT_NOT_FOUND",
            message: "Product not found",
            correlationId: request.correlationId
          }
        });
        return;
      }

      return {
        ok: true,
        data: {
          product
        }
      };
    }
  );
};
