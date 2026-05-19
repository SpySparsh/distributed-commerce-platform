import type { ProductListQuery } from "./product.schemas.js";
import type { CategoryNodeDto, CursorPage, ProductDetailDto, ProductListItemDto } from "./product.types.js";

export interface ProductRepository {
  listProducts(query: ProductListQuery): Promise<CursorPage<ProductListItemDto>>;
  findProductBySlug(tenantId: string, slug: string): Promise<ProductDetailDto | undefined>;
  getCategoryTree(tenantId: string): Promise<readonly CategoryNodeDto[]>;
}

export class UnconfiguredProductRepository implements ProductRepository {
  async listProducts(): Promise<CursorPage<ProductListItemDto>> {
    throw new Error("ProductRepository is not configured with Prisma yet.");
  }

  async findProductBySlug(): Promise<ProductDetailDto | undefined> {
    throw new Error("ProductRepository is not configured with Prisma yet.");
  }

  async getCategoryTree(): Promise<readonly CategoryNodeDto[]> {
    throw new Error("ProductRepository is not configured with Prisma yet.");
  }
}
