import { z } from "zod";

const uuidSchema = z.uuid();

export const initiatePaymentBodySchema = z.object({
  tenantId: uuidSchema,
  orderId: uuidSchema,
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  idempotencyKey: z.string().min(16).max(128),
  provider: z.enum(["stripe", "razorpay"]).optional()
});

export const paymentParamsSchema = z.object({
  paymentId: uuidSchema
});

export const paymentTenantQuerySchema = z.object({
  tenantId: uuidSchema
});

export const paymentRetryBodySchema = z.object({
  tenantId: uuidSchema,
  paymentId: uuidSchema
});

export const webhookParamsSchema = z.object({
  provider: z.enum(["stripe", "razorpay"])
});

export const webhookTenantQuerySchema = z.object({
  tenantId: uuidSchema
});

export type InitiatePaymentBody = z.infer<typeof initiatePaymentBodySchema>;
export type PaymentRetryBody = z.infer<typeof paymentRetryBodySchema>;
