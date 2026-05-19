export interface ProductImageDto {
  readonly id: string;
  readonly url: string;
  readonly altText?: string;
  readonly position: number;
  readonly isPrimary: boolean;
}

export interface ProductVariantDto {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly price: string;
  readonly compareAtPrice?: string;
  readonly currency: string;
  readonly attributes: Record<string, unknown>;
  readonly availableQuantity: number;
}

export interface ProductListItemDto {
  readonly id: string;
  readonly tenantId: string;
  readonly categoryId?: string;
  readonly sku: string;
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  readonly status: string;
  readonly primaryImage?: ProductImageDto;
  readonly minPrice?: string;
  readonly currency?: string;
  readonly totalAvailable: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProductDetailDto extends ProductListItemDto {
  readonly images: readonly ProductImageDto[];
  readonly variants: readonly ProductVariantDto[];
}

export interface CategoryNodeDto {
  readonly id: string;
  readonly parentId?: string;
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  readonly position: number;
  readonly children: readonly CategoryNodeDto[];
}

export interface CursorPage<TItem> {
  readonly items: readonly TItem[];
  readonly nextCursor?: string;
}
