const escapeValue = (value) => value.replace(/"/g, '\\"');
export const buildProductFilter = (filters) => {
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
        clauses.push(typeof value === "string"
            ? `attributes.${key} = "${escapeValue(value)}"`
            : `attributes.${key} = ${String(value)}`);
    }
    return clauses;
};
export const buildCategoryFilter = (tenantId) => [
    `tenantId = "${escapeValue(tenantId)}"`
];
export const buildProductSort = (sort) => {
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
