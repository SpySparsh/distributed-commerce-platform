import type { ProductListQuery } from "./product.schemas.js";
import type { CategoryNodeDto, CursorPage, ProductDetailDto, ProductListItemDto } from "./product.types.js";

export interface ProductRepository {
  listProducts(query: ProductListQuery): Promise<CursorPage<ProductListItemDto>>;
  findProductBySlug(tenantId: string, slug: string): Promise<ProductDetailDto | undefined>;
  getCategoryTree(tenantId: string): Promise<readonly CategoryNodeDto[]>;
}
