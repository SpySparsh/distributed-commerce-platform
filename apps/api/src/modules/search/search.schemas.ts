import { z } from "zod";

const uuidSchema = z.uuid();

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
