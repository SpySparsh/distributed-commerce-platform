export interface ProductSearchDocument {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly slug: string;
  readonly sku: string;
  readonly name: string;
  readonly description?: string;
  readonly categoryIds: readonly string[];
  readonly categorySlugs: readonly string[];
  readonly categoryNames: readonly string[];
  readonly variantIds: readonly string[];
  readonly variantSkus: readonly string[];
  readonly attributes: Record<string, string | number | boolean | readonly string[]>;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly currency: string;
  readonly availableQuantity: number;
  readonly inStock: boolean;
  readonly status: "active";
  readonly popularityScore: number;
  readonly updatedAt: number;
}

export interface CategorySearchDocument {
  readonly id: string;
  readonly tenantId: string;
  readonly categoryId: string;
  readonly parentId?: string;
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  readonly path: readonly string[];
  readonly productCount: number;
  readonly position: number;
  readonly updatedAt: number;
}

export interface SearchSettings {
  readonly searchableAttributes: readonly string[];
  readonly filterableAttributes: readonly string[];
  readonly sortableAttributes: readonly string[];
  readonly rankingRules: readonly string[];
  readonly typoTolerance: {
    readonly enabled: boolean;
    readonly minWordSizeForTypos: {
      readonly oneTypo: number;
      readonly twoTypos: number;
    };
  };
}

export const productSearchIndexUid = "products";
export const categorySearchIndexUid = "categories";

export const productSearchSettings: SearchSettings = {
  searchableAttributes: [
    "name",
    "sku",
    "variantSkus",
    "categoryNames",
    "description",
    "attributes"
  ],
  filterableAttributes: [
    "tenantId",
    "categoryIds",
    "categorySlugs",
    "currency",
    "inStock",
    "status",
    "priceMin",
    "priceMax",
    "attributes"
  ],
  sortableAttributes: [
    "priceMin",
    "priceMax",
    "popularityScore",
    "updatedAt"
  ],
  rankingRules: [
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "exactness",
    "desc(popularityScore)",
    "desc(availableQuantity)",
    "desc(updatedAt)"
  ],
  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: {
      oneTypo: 4,
      twoTypos: 8
    }
  }
};

export const categorySearchSettings: SearchSettings = {
  searchableAttributes: ["name", "slug", "description", "path"],
  filterableAttributes: ["tenantId", "parentId"],
  sortableAttributes: ["position", "productCount", "updatedAt"],
  rankingRules: [
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "exactness",
    "desc(productCount)"
  ],
  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: {
      oneTypo: 4,
      twoTypos: 8
    }
  }
};
