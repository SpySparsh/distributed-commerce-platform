export interface ProductSearchFilters {
  readonly tenantId: string;
  readonly categorySlug?: string;
  readonly categoryId?: string;
  readonly inStock?: boolean;
  readonly currency?: string;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly attributes?: Record<string, string | number | boolean>;
}

const escapeValue = (value: string): string => value.replace(/"/g, '\\"');

export const buildProductFilter = (filters: ProductSearchFilters): readonly string[] => {
  const clauses = [`tenantId = "${escapeValue(filters.tenantId)}"`, 'status = "active"'];

  if (filters.categorySlug !== undefined) {
    clauses.push(`categorySlugs = "${escapeValue(filters.categorySlug)}"`);
  }

  if (filters.categoryId !== undefined) {
    clauses.push(`categoryIds = "${escapeValue(filters.categoryId)}"`);
  }

  if (filters.inStock !== undefined) {
    clauses.push(`inStock = ${String(filters.inStock)}`);
  }

  if (filters.currency !== undefined) {
    clauses.push(`currency = "${escapeValue(filters.currency)}"`);
  }

  if (filters.minPrice !== undefined) {
    clauses.push(`priceMin >= ${filters.minPrice}`);
  }

  if (filters.maxPrice !== undefined) {
    clauses.push(`priceMax <= ${filters.maxPrice}`);
  }

  for (const [key, value] of Object.entries(filters.attributes ?? {})) {
    clauses.push(
      typeof value === "string"
        ? `attributes.${key} = "${escapeValue(value)}"`
        : `attributes.${key} = ${String(value)}`
    );
  }

  return clauses;
};

export const buildCategoryFilter = (tenantId: string): readonly string[] => [
  `tenantId = "${escapeValue(tenantId)}"`
];

export const buildProductSort = (sort: string | undefined): readonly string[] | undefined => {
  switch (sort) {
    case "price_asc":
      return ["priceMin:asc"];
    case "price_desc":
      return ["priceMax:desc"];
    case "popular":
      return ["popularityScore:desc"];
    case "updated":
      return ["updatedAt:desc"];
    case "relevance":
    case undefined:
      return undefined;
    default:
      return undefined;
  }
};
