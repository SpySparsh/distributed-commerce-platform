import { z } from "zod";

export const productSortSchema = z
  .enum(["newest", "oldest", "price_asc", "price_desc", "name_asc", "name_desc", "updated_desc"])
  .default("newest");

export const productListQuerySchema = z.object({
  tenantId: z.uuid(),
  categoryId: z.uuid().optional(),
  categorySlug: z.string().min(1).max(160).optional(),
  q: z.string().min(1).max(120).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  inStock: z.coerce.boolean().optional(),
  sort: productSortSchema,
  limit: z.coerce.number().int().positive().max(50).default(20),
  cursor: z.string().min(1).optional()
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const productParamsSchema = z.object({
  slug: z.string().min(1).max(180)
});

export type ProductParams = z.infer<typeof productParamsSchema>;

export const categoryTreeQuerySchema = z.object({
  tenantId: z.uuid()
});

export type CategoryTreeQuery = z.infer<typeof categoryTreeQuerySchema>;
