import { Redis } from "ioredis";
import fp from "fastify-plugin";
import {
  acquireInventoryLock,
  cacheKeys,
  getCart,
  invalidateCategoryCache,
  invalidateProductCache,
  releaseInventoryLock,
  saveCart
} from "@ecommerce/cache";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
    cache: {
      readonly keys: typeof cacheKeys;
      readonly carts: {
        readonly get: typeof getCart;
        readonly save: typeof saveCart;
      };
      readonly invalidate: {
        readonly products: typeof invalidateProductCache;
        readonly categories: typeof invalidateCategoryCache;
      };
      readonly inventoryLocks: {
        readonly acquire: typeof acquireInventoryLock;
        readonly release: typeof releaseInventoryLock;
      };
    };
  }
}

export const redisPlugin = fp(
  async (app) => {
    const redis = new Redis(app.config.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 3
    });

    app.decorate("redis", redis);
    app.decorate("cache", {
      keys: cacheKeys,
      carts: {
        get: getCart,
        save: saveCart
      },
      invalidate: {
        products: invalidateProductCache,
        categories: invalidateCategoryCache
      },
      inventoryLocks: {
        acquire: acquireInventoryLock,
        release: releaseInventoryLock
      }
    });

    app.addHook("onClose", async () => {
      redis.disconnect();
    });
  },
  {
    name: "redis",
    dependencies: ["config"]
  }
);
