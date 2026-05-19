import { z } from "zod";

export const cartIdentityQuerySchema = z.object({
  guestId: z.string().min(8).max(160).optional(),
  deviceId: z.string().min(8).max(160).optional()
});

export type CartIdentityRequestQuery = z.infer<typeof cartIdentityQuerySchema>;
export type CartIdentityQuery = CartIdentityRequestQuery & {
  readonly tenantId: string;
  readonly userId?: string;
};

export const cartParamsSchema = z.object({
  cartId: z.uuid()
});

export type CartParams = z.infer<typeof cartParamsSchema>;

export const upsertCartItemBodySchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid(),
  quantity: z.number().int().positive().max(99),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().length(3).default("USD")
});

export type UpsertCartItemBody = z.infer<typeof upsertCartItemBodySchema>;

export const removeCartItemParamsSchema = cartParamsSchema.extend({
  variantId: z.uuid()
});

export type RemoveCartItemParams = z.infer<typeof removeCartItemParamsSchema>;

export const mergeCartBodySchema = z.object({
  sourceCartId: z.uuid(),
  targetCartId: z.uuid()
});

export type MergeCartBody = z.infer<typeof mergeCartBodySchema>;
