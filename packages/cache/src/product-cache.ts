import { cacheKeys } from "./keys.js";
import type { RedisCacheClient } from "./redis.js";
import { readThroughCache, writeCache, type CacheReadResult } from "./swr.js";
import { cacheTtl } from "./ttl.js";
import { deleteByPattern } from "./invalidation.js";

export interface ProductCacheRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly slug: string;
  readonly name: string;
  readonly status: string;
  readonly updatedAt: string;
}

export interface HotProductRecord {
  readonly productId: string;
  readonly score: number;
}

export const getCachedProductById = async <TProduct extends ProductCacheRecord>(
  redis: RedisCacheClient,
  input: {
    readonly tenantId: string;
    readonly productId: string;
    readonly fetchFresh: () => Promise<TProduct>;
    readonly revalidate?: (key: string) => void;
  }
): Promise<CacheReadResult<TProduct>> =>
  readThroughCache(
    redis,
    cacheKeys.productById(input),
    input.fetchFresh,
    cacheTtl.product,
    input.revalidate === undefined ? {} : { revalidate: input.revalidate }
  );

export const cacheHotProducts = async (
  redis: RedisCacheClient,
  tenantId: string,
  products: readonly HotProductRecord[]
): Promise<void> => {
  await writeCache(redis, cacheKeys.hotProducts({ tenantId }), products, cacheTtl.hotProducts);
};

export const invalidateProductCache = async (
  redis: RedisCacheClient,
  tenantId: string
): Promise<number> => deleteByPattern(redis, cacheKeys.patternForTenantProducts({ tenantId }));
