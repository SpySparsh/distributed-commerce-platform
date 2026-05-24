export const productSearchIndexUid = "products";
export const categorySearchIndexUid = "categories";
export const productSearchSettings = {
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
export const categorySearchSettings = {
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
