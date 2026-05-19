import { cacheKeys } from "./keys.js";
import type { RedisCacheClient } from "./redis.js";
import { readThroughCache, type CacheReadResult } from "./swr.js";
import { cacheTtl } from "./ttl.js";
import { deleteByPattern } from "./invalidation.js";

export interface CategoryCacheRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly parentId?: string;
  readonly slug: string;
  readonly name: string;
  readonly position: number;
}

export const getCachedCategoryTree = async <TCategory extends CategoryCacheRecord>(
  redis: RedisCacheClient,
  input: {
    readonly tenantId: string;
    readonly fetchFresh: () => Promise<readonly TCategory[]>;
    readonly revalidate?: (key: string) => void;
  }
): Promise<CacheReadResult<readonly TCategory[]>> =>
  readThroughCache(
    redis,
    cacheKeys.categoryTree(input),
    input.fetchFresh,
    cacheTtl.category,
    input.revalidate === undefined ? {} : { revalidate: input.revalidate }
  );

export const invalidateCategoryCache = async (
  redis: RedisCacheClient,
  tenantId: string
): Promise<number> => deleteByPattern(redis, cacheKeys.patternForTenantCategories({ tenantId }));
