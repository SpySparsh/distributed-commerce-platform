import { z } from "zod";

const uuidSchema = z.uuid();

export const searchSortSchema = z
  .enum(["relevance", "price_asc", "price_desc", "newest", "rating", "popular"])
  .default("relevance");

export const databaseSearchQuerySchema = z.object({
  tenantId: uuidSchema,
  q: z.string().trim().max(120).optional().default(""),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  category: z.string().trim().min(1).max(160).optional(),
  brand: z.string().trim().min(1).max(120).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  sort: searchSortSchema,
  inStock: z.coerce.boolean().optional()
});

export const adminSearchAnalyticsQuerySchema = z.object({
  tenantId: uuidSchema,
  days: z.coerce.number().int().min(1).max(90).default(30),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const searchClickBodySchema = z.object({
  tenantId: uuidSchema,
  productId: uuidSchema,
  q: z.string().trim().max(120).optional().default("")
});

export const productSearchQuerySchema = z.object({
  tenantId: uuidSchema,
  q: z.string().trim().min(1).max(120),
  categoryId: uuidSchema.optional(),
  categorySlug: z.string().trim().min(1).max(120).optional(),
  inStock: z.coerce.boolean().optional(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  sort: z.enum(["relevance", "price_asc", "price_desc", "popular", "updated"]).default("relevance"),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0)
});

export const autocompleteQuerySchema = z.object({
  tenantId: uuidSchema,
  q: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(20).default(8)
});

export const categorySearchQuerySchema = z.object({
  tenantId: uuidSchema,
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

export const indexProductBodySchema = z.object({
  productId: uuidSchema
});

export const rebuildSearchBodySchema = z.object({
  target: z.enum(["products", "categories", "all"]).default("all"),
  batchSize: z.number().int().min(50).max(2_000).default(500)
});

export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;
export type DatabaseSearchQuery = z.infer<typeof databaseSearchQuerySchema>;
export type AdminSearchAnalyticsQuery = z.infer<typeof adminSearchAnalyticsQuerySchema>;
export type SearchClickBody = z.infer<typeof searchClickBodySchema>;
export type AutocompleteQuery = z.infer<typeof autocompleteQuerySchema>;
export type CategorySearchQuery = z.infer<typeof categorySearchQuerySchema>;
export type IndexProductRequestBody = z.infer<typeof indexProductBodySchema>;
export type IndexProductBody = IndexProductRequestBody & {
  readonly tenantId: string;
};
export type RebuildSearchRequestBody = z.infer<typeof rebuildSearchBodySchema>;
export type RebuildSearchBody = RebuildSearchRequestBody & {
  readonly tenantId: string;
};
