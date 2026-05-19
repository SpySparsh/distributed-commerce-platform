import { z } from "zod";

const uuidSchema = z.uuid();
const moneySchema = z.string().regex(/^\d+(\.\d{1,2})?$/);
const addressSchema = z.record(z.string(), z.unknown());

export const orderParamsSchema = z.object({
  orderId: uuidSchema
});

export const orderTenantQuerySchema = z.object({
  tenantId: uuidSchema
});

export const createOrderItemSchema = z.object({
  productId: uuidSchema,
  variantId: uuidSchema,
  sku: z.string().min(1).max(128),
  name: z.string().min(1).max(240),
  quantity: z.number().int().positive().max(500),
  unitPrice: moneySchema,
  totalAmount: moneySchema,
  currency: z.string().length(3).transform((value) => value.toUpperCase())
});

export const createOrderBodySchema = z.object({
  tenantId: uuidSchema,
  userId: uuidSchema.optional(),
  cartId: uuidSchema.optional(),
  email: z.email(),
  subtotalAmount: moneySchema,
  taxAmount: moneySchema.default("0.00"),
  shippingAmount: moneySchema.default("0.00"),
  discountAmount: moneySchema.default("0.00"),
  totalAmount: moneySchema,
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  items: z.array(createOrderItemSchema).min(1).max(200),
  idempotencyKey: z.string().min(16).max(128).optional()
});

export const transitionOrderBodySchema = z.object({
  tenantId: uuidSchema,
  nextStatus: z.enum(["confirmed", "paid", "fulfilled", "cancelled", "refunded"]),
  paymentId: uuidSchema.optional(),
  reason: z.string().min(1).max(500).optional()
});

export const invoiceOrderBodySchema = z.object({
  tenantId: uuidSchema
});

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type TransitionOrderBody = z.infer<typeof transitionOrderBodySchema>;
