import { z } from "zod";

const uuidSchema = z.uuid();
const addressSchema = z.record(z.string(), z.unknown());

export const startCheckoutBodySchema = z.object({
  cartId: uuidSchema,
  email: z.email(),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  provider: z.enum(["stripe", "razorpay", "cod"]).optional(),
  idempotencyKey: z.string().min(16).max(128)
});

export const startBuyNowCheckoutBodySchema = z.object({
  productId: uuidSchema,
  variantId: uuidSchema,
  quantity: z.number().int().positive().max(99),
  email: z.email(),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  provider: z.enum(["stripe", "razorpay", "cod"]).optional(),
  idempotencyKey: z.string().min(16).max(128)
});

export type StartCheckoutRequestBody = z.infer<typeof startCheckoutBodySchema>;
export type StartCheckoutBody = StartCheckoutRequestBody & {
  readonly tenantId: string;
  readonly userId: string;
};
export type StartBuyNowCheckoutRequestBody = z.infer<typeof startBuyNowCheckoutBodySchema>;
export type StartBuyNowCheckoutBody = StartBuyNowCheckoutRequestBody & {
  readonly tenantId: string;
  readonly userId: string;
};
