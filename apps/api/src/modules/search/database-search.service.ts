import { Prisma, type PrismaClient } from "@ecommerce/database";
import type { AdminSearchAnalyticsQuery, DatabaseSearchQuery, SearchClickBody } from "./search.schemas.js";

interface SearchRow {
  readonly id: string;
  readonly tenantId: string;
  readonly categoryId: string | null;
  readonly sku: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly averageRating: { toString(): string };
  readonly reviewCount: number;
  readonly minPrice: { toString(): string } | null;
  readonly currency: string | null;
  readonly primaryImageUrl: string | null;
  readonly primaryImageAlt: string | null;
  readonly categoryName: string | null;
  readonly categorySlug: string | null;
  readonly brands: readonly string[] | null;
  readonly totalAvailable: number | bigint | null;
  readonly score: number | { toString(): string };
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly totalCount: number | bigint;
}

interface SuggestionRow {
  readonly type: "product" | "category" | "brand" | "trending";
  readonly label: string;
  readonly value: string;
  readonly slug: string | null;
  readonly score: number | bigint;
}

interface AnalyticsRow {
  readonly query: string;
  readonly count: number | bigint;
  readonly resultCount: number | bigint;
}

interface ClickAnalyticsRow {
  readonly productId: string;
  readonly productName: string;
  readonly productSlug: string;
  readonly count: number | bigint;
}

export interface SearchProductDto {
  readonly id: string;
  readonly tenantId: string;
  readonly categoryId?: string;
  readonly sku: string;
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  readonly averageRating: string;
  readonly reviewCount: number;
  readonly minPrice?: string;
  readonly price?: string;
  readonly currency?: string;
  readonly image?: string;
  readonly primaryImage?: {
    readonly url: string;
    readonly altText?: string;
  };
  readonly category?: string;
  readonly categorySlug?: string;
  readonly brands: readonly string[];
  readonly totalAvailable: number;
  readonly score: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SearchSuggestionDto {
  readonly type: "product" | "category" | "brand" | "trending";
  readonly label: string;
  readonly value: string;
  readonly slug?: string;
}

export interface SearchResponseDto {
  readonly items: readonly SearchProductDto[];
  readonly total: number;
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly totalPages: number;
    readonly hasNextPage: boolean;
    readonly hasPreviousPage: boolean;
  };
  readonly appliedFilters: {
    readonly q: string;
    readonly category?: string;
    readonly brand?: string;
    readonly minPrice?: number;
    readonly maxPrice?: number;
    readonly rating?: number;
    readonly sort: DatabaseSearchQuery["sort"];
    readonly inStock?: boolean;
  };
  readonly suggestions: readonly SearchSuggestionDto[];
}

export interface SearchAnalyticsDto {
  readonly topSearches: readonly {
    readonly query: string;
    readonly count: number;
    readonly averageResultCount: number;
  }[];
  readonly noResultSearches: readonly {
    readonly query: string;
    readonly count: number;
  }[];
  readonly topClickedProducts: readonly {
    readonly productId: string;
    readonly productName: string;
    readonly productSlug: string;
    readonly count: number;
  }[];
}

export interface DatabaseSearchService {
  searchProducts(query: DatabaseSearchQuery, userId?: string): Promise<SearchResponseDto>;
  autocomplete(tenantId: string, q: string, limit: number): Promise<readonly SearchSuggestionDto[]>;
  recordClick(input: SearchClickBody, userId?: string): Promise<void>;
  getAnalytics(query: AdminSearchAnalyticsQuery): Promise<SearchAnalyticsDto>;
}

const normalizeSearchText = (value: string): string => value.trim().replace(/\s+/g, " ").toLowerCase();

const likePattern = (query: string): string => `%${query.replace(/[%_\\]/g, "\\$&")}%`;

const toNumber = (value: number | bigint | { toString(): string } | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === "bigint" ? Number(value) : Number(value.toString());
};

const sortSql = (sort: DatabaseSearchQuery["sort"]): Prisma.Sql => {
  switch (sort) {
    case "price_asc":
      return Prisma.sql`"minPrice" ASC NULLS LAST, score DESC, "createdAt" DESC`;
    case "price_desc":
      return Prisma.sql`"minPrice" DESC NULLS LAST, score DESC, "createdAt" DESC`;
    case "newest":
      return Prisma.sql`"createdAt" DESC, score DESC`;
    case "rating":
      return Prisma.sql`"averageRating" DESC, "reviewCount" DESC, score DESC`;
    case "popular":
      return Prisma.sql`"reviewCount" DESC, "averageRating" DESC, score DESC`;
    case "relevance":
    default:
      return Prisma.sql`score DESC, "reviewCount" DESC, "createdAt" DESC`;
  }
};

const toProductDto = (row: SearchRow): SearchProductDto => {
  const brands = Array.isArray(row.brands) ? row.brands.filter((brand) => brand.length > 0) : [];

  return {
    id: row.id,
    tenantId: row.tenantId,
    ...(row.categoryId === null ? {} : { categoryId: row.categoryId }),
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    ...(row.description === null ? {} : { description: row.description }),
    averageRating: row.averageRating.toString(),
    reviewCount: row.reviewCount,
    ...(row.minPrice === null ? {} : { minPrice: row.minPrice.toString(), price: row.minPrice.toString() }),
    ...(row.currency === null ? {} : { currency: row.currency }),
    ...(row.primaryImageUrl === null
      ? {}
      : {
          image: row.primaryImageUrl,
          primaryImage: {
            url: row.primaryImageUrl,
            ...(row.primaryImageAlt === null ? {} : { altText: row.primaryImageAlt })
          }
        }),
    ...(row.categoryName === null ? {} : { category: row.categoryName }),
    ...(row.categorySlug === null ? {} : { categorySlug: row.categorySlug }),
    brands,
    totalAvailable: toNumber(row.totalAvailable),
    score: toNumber(row.score),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
};

const toSuggestionDto = (row: SuggestionRow): SearchSuggestionDto => ({
  type: row.type,
  label: row.label,
  value: row.value,
  ...(row.slug === null ? {} : { slug: row.slug })
});

const autocompleteProducts = async (
  prisma: PrismaClient,
  tenantId: string,
  q: string,
  limit: number
): Promise<readonly SearchSuggestionDto[]> => {
  const normalizedQuery = normalizeSearchText(q);
  const hasQuery = normalizedQuery.length > 0;
  const pattern = likePattern(normalizedQuery);
  const productPredicate = hasQuery
    ? Prisma.sql`AND (LOWER(p."name") LIKE ${pattern} OR similarity(LOWER(p."name"), ${normalizedQuery}) > 0.18)`
    : Prisma.empty;
  const categoryPredicate = hasQuery
    ? Prisma.sql`AND (LOWER(c."name") LIKE ${pattern} OR similarity(LOWER(c."name"), ${normalizedQuery}) > 0.18)`
    : Prisma.empty;
  const brandPredicate = hasQuery
    ? Prisma.sql`AND LOWER(COALESCE(pv."attributes"->>'brand', '')) LIKE ${pattern}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<SuggestionRow[]>`
    (
      SELECT 'product'::text AS type, p."name" AS label, p."slug" AS value, p."slug" AS slug, 100::int AS score
      FROM "Product" p
      WHERE p."tenantId" = ${tenantId}::uuid
        AND p."status" = 'active'
        AND p."deletedAt" IS NULL
        ${productPredicate}
      ORDER BY p."reviewCount" DESC, p."updatedAt" DESC
      LIMIT ${limit}
    )
    UNION ALL
    (
      SELECT 'category'::text AS type, c."name" AS label, c."slug" AS value, c."slug" AS slug, 70::int AS score
      FROM "Category" c
      WHERE c."tenantId" = ${tenantId}::uuid
        AND c."deletedAt" IS NULL
        ${categoryPredicate}
      ORDER BY c."position" ASC, c."name" ASC
      LIMIT ${Math.max(Math.ceil(limit / 2), 1)}
    )
    UNION ALL
    (
      SELECT 'brand'::text AS type,
        pv."attributes"->>'brand' AS label,
        pv."attributes"->>'brand' AS value,
        NULL::text AS slug,
        50::int AS score
      FROM "ProductVariant" pv
      JOIN "Product" p ON p."id" = pv."productId"
      WHERE pv."tenantId" = ${tenantId}::uuid
        AND pv."deletedAt" IS NULL
        AND pv."status" = 'active'
        AND p."status" = 'active'
        AND p."deletedAt" IS NULL
        AND NULLIF(pv."attributes"->>'brand', '') IS NOT NULL
        ${brandPredicate}
      GROUP BY pv."attributes"->>'brand'
      ORDER BY COUNT(*) DESC
      LIMIT ${Math.max(Math.ceil(limit / 2), 1)}
    )
    ORDER BY score DESC, label ASC
    LIMIT ${limit}
  `;

  return rows.map(toSuggestionDto);
};

export const createDatabaseSearchService = (prisma: PrismaClient): DatabaseSearchService => ({
  async searchProducts(query, userId) {
    const normalizedQuery = normalizeSearchText(query.q);
    const hasQuery = normalizedQuery.length > 0;
    const pattern = likePattern(normalizedQuery);
    const offset = (query.page - 1) * query.limit;

    const searchPredicate = hasQuery
      ? Prisma.sql`
          AND (
            LOWER(p."name") LIKE ${pattern}
            OR LOWER(p."slug") LIKE ${pattern}
            OR LOWER(COALESCE(p."description", '')) LIKE ${pattern}
            OR LOWER(COALESCE(c."name", '')) LIKE ${pattern}
            OR EXISTS (
              SELECT 1 FROM "ProductVariant" pv_search
              WHERE pv_search."productId" = p."id"
                AND pv_search."tenantId" = p."tenantId"
                AND pv_search."deletedAt" IS NULL
                AND pv_search."status" = 'active'
                AND (
                  LOWER(pv_search."name") LIKE ${pattern}
                  OR LOWER(pv_search."sku") LIKE ${pattern}
                  OR LOWER(COALESCE(pv_search."attributes"->>'brand', '')) LIKE ${pattern}
                )
            )
            OR similarity(LOWER(p."name"), ${normalizedQuery}) > 0.18
            OR similarity(LOWER(COALESCE(c."name", '')), ${normalizedQuery}) > 0.18
          )
        `
      : Prisma.empty;

    const categoryPredicate = query.category === undefined
      ? Prisma.empty
      : Prisma.sql`AND (c."slug" = ${query.category} OR c."id"::text = ${query.category})`;

    const brandPredicate = query.brand === undefined
      ? Prisma.empty
      : Prisma.sql`
          AND EXISTS (
            SELECT 1 FROM "ProductVariant" pv_brand
            WHERE pv_brand."productId" = p."id"
              AND pv_brand."tenantId" = p."tenantId"
              AND pv_brand."deletedAt" IS NULL
              AND pv_brand."status" = 'active'
              AND LOWER(COALESCE(pv_brand."attributes"->>'brand', '')) = LOWER(${query.brand})
          )
        `;

    const minPricePredicate = query.minPrice === undefined
      ? Prisma.empty
      : Prisma.sql`AND EXISTS (
          SELECT 1 FROM "ProductVariant" pv_min
          WHERE pv_min."productId" = p."id"
            AND pv_min."tenantId" = p."tenantId"
            AND pv_min."deletedAt" IS NULL
            AND pv_min."status" = 'active'
            AND pv_min."price" >= ${query.minPrice}
        )`;

    const maxPricePredicate = query.maxPrice === undefined
      ? Prisma.empty
      : Prisma.sql`AND EXISTS (
          SELECT 1 FROM "ProductVariant" pv_max
          WHERE pv_max."productId" = p."id"
            AND pv_max."tenantId" = p."tenantId"
            AND pv_max."deletedAt" IS NULL
            AND pv_max."status" = 'active'
            AND pv_max."price" <= ${query.maxPrice}
        )`;

    const ratingPredicate = query.rating === undefined
      ? Prisma.empty
      : Prisma.sql`AND p."averageRating" >= ${query.rating}`;

    const stockPredicate = query.inStock === undefined
      ? Prisma.empty
      : query.inStock
        ? Prisma.sql`AND EXISTS (
            SELECT 1
            FROM "ProductVariant" pv_stock
            JOIN "InventoryItem" ii_stock ON ii_stock."variantId" = pv_stock."id"
            WHERE pv_stock."productId" = p."id"
              AND pv_stock."tenantId" = p."tenantId"
              AND pv_stock."deletedAt" IS NULL
              AND pv_stock."status" = 'active'
              AND (ii_stock."quantity" - ii_stock."reserved" - ii_stock."safetyStock") > 0
          )`
        : Prisma.empty;

    const scoreSql = hasQuery
      ? Prisma.sql`
          (
            CASE WHEN LOWER(p."name") = ${normalizedQuery} THEN 100 ELSE 0 END +
            CASE WHEN LOWER(p."name") LIKE ${pattern} THEN 60 ELSE 0 END +
            CASE WHEN EXISTS (
              SELECT 1 FROM "ProductVariant" pv_score
              WHERE pv_score."productId" = p."id"
                AND pv_score."tenantId" = p."tenantId"
                AND pv_score."deletedAt" IS NULL
                AND pv_score."status" = 'active'
                AND LOWER(COALESCE(pv_score."attributes"->>'brand', '')) LIKE ${pattern}
            ) THEN 40 ELSE 0 END +
            CASE WHEN LOWER(COALESCE(c."name", '')) LIKE ${pattern} THEN 30 ELSE 0 END +
            CASE WHEN LOWER(COALESCE(p."description", '')) LIKE ${pattern} THEN 10 ELSE 0 END +
            (similarity(LOWER(p."name"), ${normalizedQuery}) * 25) +
            (p."averageRating"::numeric * 2) +
            LEAST(p."reviewCount", 50) * 0.2 +
            CASE WHEN EXISTS (
              SELECT 1
              FROM "ProductVariant" pv_boost
              JOIN "InventoryItem" ii_boost ON ii_boost."variantId" = pv_boost."id"
              WHERE pv_boost."productId" = p."id"
                AND pv_boost."tenantId" = p."tenantId"
                AND pv_boost."deletedAt" IS NULL
                AND pv_boost."status" = 'active'
                AND (ii_boost."quantity" - ii_boost."reserved" - ii_boost."safetyStock") > 0
            ) THEN 8 ELSE -20 END
          )`
      : Prisma.sql`
          (
            p."averageRating"::numeric * 8 +
            LEAST(p."reviewCount", 100) * 0.5 +
            CASE WHEN EXISTS (
              SELECT 1
              FROM "ProductVariant" pv_boost
              JOIN "InventoryItem" ii_boost ON ii_boost."variantId" = pv_boost."id"
              WHERE pv_boost."productId" = p."id"
                AND pv_boost."tenantId" = p."tenantId"
                AND pv_boost."deletedAt" IS NULL
                AND pv_boost."status" = 'active'
                AND (ii_boost."quantity" - ii_boost."reserved" - ii_boost."safetyStock") > 0
            ) THEN 8 ELSE -20 END
          )`;

    const rows = await prisma.$queryRaw<SearchRow[]>`
      WITH ranked_products AS (
        SELECT
          p."id",
          p."tenantId",
          p."categoryId",
          p."sku",
          p."slug",
          p."name",
          p."description",
          p."averageRating",
          p."reviewCount",
          p."createdAt",
          p."updatedAt",
          c."name" AS "categoryName",
          c."slug" AS "categorySlug",
          ${scoreSql} AS score
        FROM "Product" p
        LEFT JOIN "Category" c
          ON c."id" = p."categoryId"
          AND c."tenantId" = p."tenantId"
          AND c."deletedAt" IS NULL
        WHERE p."tenantId" = ${query.tenantId}::uuid
          AND p."status" = 'active'
          AND p."deletedAt" IS NULL
          ${searchPredicate}
          ${categoryPredicate}
          ${brandPredicate}
          ${minPricePredicate}
          ${maxPricePredicate}
          ${ratingPredicate}
          ${stockPredicate}
      ),
      enriched_products AS (
        SELECT
          rp.*,
          variant_prices."minPrice",
          variant_prices."currency",
          variant_prices."brands",
          inventory."totalAvailable",
          image."url" AS "primaryImageUrl",
          image."altText" AS "primaryImageAlt",
          COUNT(*) OVER() AS "totalCount"
        FROM ranked_products rp
        LEFT JOIN LATERAL (
          SELECT
            MIN(pv."price") AS "minPrice",
            MIN(pv."currency") AS "currency",
            COALESCE(
              ARRAY_AGG(DISTINCT NULLIF(pv."attributes"->>'brand', ''))
                FILTER (WHERE NULLIF(pv."attributes"->>'brand', '') IS NOT NULL),
              ARRAY[]::text[]
            ) AS "brands"
          FROM "ProductVariant" pv
          WHERE pv."tenantId" = rp."tenantId"
            AND pv."productId" = rp."id"
            AND pv."deletedAt" IS NULL
            AND pv."status" = 'active'
        ) variant_prices ON true
        LEFT JOIN LATERAL (
          SELECT SUM(GREATEST(ii."quantity" - ii."reserved" - ii."safetyStock", 0)) AS "totalAvailable"
          FROM "ProductVariant" pv
          JOIN "InventoryItem" ii ON ii."variantId" = pv."id"
          WHERE pv."tenantId" = rp."tenantId"
            AND pv."productId" = rp."id"
            AND pv."deletedAt" IS NULL
            AND pv."status" = 'active'
        ) inventory ON true
        LEFT JOIN LATERAL (
          SELECT pi."url", pi."altText"
          FROM "ProductImage" pi
          WHERE pi."tenantId" = rp."tenantId"
            AND pi."productId" = rp."id"
            AND pi."deletedAt" IS NULL
          ORDER BY pi."isPrimary" DESC, pi."position" ASC
          LIMIT 1
        ) image ON true
      )
      SELECT *
      FROM enriched_products
      ORDER BY ${sortSql(query.sort)}
      LIMIT ${query.limit}
      OFFSET ${offset}
    `;

    const total = rows.length === 0 ? 0 : toNumber(rows[0]?.totalCount);
    const items = rows.map(toProductDto);
    const suggestions = hasQuery
      ? await autocompleteProducts(prisma, query.tenantId, normalizedQuery, 8)
      : await autocompleteProducts(prisma, query.tenantId, "", 8);

    void prisma.searchQueryLog.create({
      data: {
        tenantId: query.tenantId,
        ...(userId === undefined ? {} : { userId }),
        query: query.q,
        normalizedQuery,
        resultCount: total,
        failed: total === 0
      }
    }).catch(() => undefined);

    return {
      items,
      total,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalPages: Math.max(Math.ceil(total / query.limit), 1),
        hasNextPage: query.page * query.limit < total,
        hasPreviousPage: query.page > 1
      },
      appliedFilters: {
        q: query.q,
        ...(query.category === undefined ? {} : { category: query.category }),
        ...(query.brand === undefined ? {} : { brand: query.brand }),
        ...(query.minPrice === undefined ? {} : { minPrice: query.minPrice }),
        ...(query.maxPrice === undefined ? {} : { maxPrice: query.maxPrice }),
        ...(query.rating === undefined ? {} : { rating: query.rating }),
        sort: query.sort,
        ...(query.inStock === undefined ? {} : { inStock: query.inStock })
      },
      suggestions
    };
  },

  async autocomplete(tenantId, q, limit) {
    return autocompleteProducts(prisma, tenantId, q, limit);
  },

  async recordClick(input, userId) {
    const normalizedQuery = normalizeSearchText(input.q);

    await prisma.searchQueryLog.create({
      data: {
        tenantId: input.tenantId,
        ...(userId === undefined ? {} : { userId }),
        query: input.q,
        normalizedQuery,
        clickedProductId: input.productId,
        resultCount: 0,
        failed: false
      }
    });
  },

  async getAnalytics(query) {
    const since = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000);
    const topSearchRows = await prisma.$queryRaw<AnalyticsRow[]>`
      SELECT "normalizedQuery" AS query, COUNT(*) AS count, AVG("resultCount") AS "resultCount"
      FROM "SearchQueryLog"
      WHERE "tenantId" = ${query.tenantId}::uuid
        AND "createdAt" >= ${since}
        AND "deletedAt" IS NULL
      GROUP BY "normalizedQuery"
      ORDER BY COUNT(*) DESC
      LIMIT ${query.limit}
    `;
    const noResultRows = await prisma.$queryRaw<AnalyticsRow[]>`
      SELECT "normalizedQuery" AS query, COUNT(*) AS count, AVG("resultCount") AS "resultCount"
      FROM "SearchQueryLog"
      WHERE "tenantId" = ${query.tenantId}::uuid
        AND "createdAt" >= ${since}
        AND "failed" = true
        AND "deletedAt" IS NULL
      GROUP BY "normalizedQuery"
      ORDER BY COUNT(*) DESC
      LIMIT ${query.limit}
    `;
    const topClickedRows = await prisma.$queryRaw<ClickAnalyticsRow[]>`
      SELECT
        p."id" AS "productId",
        p."name" AS "productName",
        p."slug" AS "productSlug",
        COUNT(*) AS count
      FROM "SearchQueryLog" sql
      JOIN "Product" p ON p."id" = sql."clickedProductId"
      WHERE sql."tenantId" = ${query.tenantId}::uuid
        AND sql."createdAt" >= ${since}
        AND sql."clickedProductId" IS NOT NULL
        AND sql."deletedAt" IS NULL
      GROUP BY p."id", p."name", p."slug"
      ORDER BY COUNT(*) DESC
      LIMIT ${query.limit}
    `;

    return {
      topSearches: topSearchRows.map((row) => ({
        query: row.query,
        count: toNumber(row.count),
        averageResultCount: Math.round(toNumber(row.resultCount))
      })),
      noResultSearches: noResultRows.map((row) => ({
        query: row.query,
        count: toNumber(row.count)
      })),
      topClickedProducts: topClickedRows.map((row) => ({
        productId: row.productId,
        productName: row.productName,
        productSlug: row.productSlug,
        count: toNumber(row.count)
      }))
    };
  }
});
