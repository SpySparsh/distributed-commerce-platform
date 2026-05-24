import { cacheKeys } from "./keys.js";
import { readThroughCache, writeCache } from "./swr.js";
import { cacheTtl } from "./ttl.js";
import { deleteByPattern } from "./invalidation.js";
export const getCachedProductById = async (redis, input) => readThroughCache(redis, cacheKeys.productById(input), input.fetchFresh, cacheTtl.product, input.revalidate === undefined ? {} : { revalidate: input.revalidate });
export const cacheHotProducts = async (redis, tenantId, products) => {
    await writeCache(redis, cacheKeys.hotProducts({ tenantId }), products, cacheTtl.hotProducts);
};
export const invalidateProductCache = async (redis, tenantId) => deleteByPattern(redis, cacheKeys.patternForTenantProducts({ tenantId }));
