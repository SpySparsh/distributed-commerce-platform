import { cacheKeys, readThroughCache } from "@ecommerce/cache";
import type { RedisCacheClient } from "@ecommerce/cache";
import type { ProductRepository } from "./product.repository.js";
import type { ProductListQuery } from "./product.schemas.js";
import type { CategoryNodeDto, CursorPage, ProductDetailDto, ProductListItemDto } from "./product.types.js";

export interface ProductService {
  listProducts(query: ProductListQuery): Promise<CursorPage<ProductListItemDto>>;
  getProductBySlug(tenantId: string, slug: string): Promise<ProductDetailDto | undefined>;
  getCategoryTree(tenantId: string): Promise<readonly CategoryNodeDto[]>;
}

export const createProductService = (
  repository: ProductRepository,
  redis: RedisCacheClient
): ProductService => ({
  async listProducts(query) {
    return repository.listProducts(query);
  },

  async getProductBySlug(tenantId, slug) {
    const cached = await readThroughCache(
      redis,
      cacheKeys.productBySlug({ tenantId, slug }),
      async () => {
        const product = await repository.findProductBySlug(tenantId, slug);
        return product ?? null;
      },
      {
        freshSeconds: 60,
        staleSeconds: 300
      }
    );

    return cached.status === "miss" || cached.value === null ? undefined : cached.value;
  },

  async getCategoryTree(tenantId) {
    const cached = await readThroughCache(
      redis,
      cacheKeys.categoryTree({ tenantId }),
      () => repository.getCategoryTree(tenantId),
      {
        freshSeconds: 300,
        staleSeconds: 900
      }
    );

    return cached.status === "miss" ? [] : cached.value;
  }
});
