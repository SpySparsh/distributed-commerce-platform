import { cacheKeys } from "./keys.js";
import { readThroughCache } from "./swr.js";
import { cacheTtl } from "./ttl.js";
import { deleteByPattern } from "./invalidation.js";
export const getCachedCategoryTree = async (redis, input) => readThroughCache(redis, cacheKeys.categoryTree(input), input.fetchFresh, cacheTtl.category, input.revalidate === undefined ? {} : { revalidate: input.revalidate });
export const invalidateCategoryCache = async (redis, tenantId) => deleteByPattern(redis, cacheKeys.patternForTenantCategories({ tenantId }));
