import { z } from "zod";

const uuidSchema = z.uuid();

export const initiatePaymentBodySchema = z.object({
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
});

export const paymentRetryBodySchema = z.object({
  paymentId: uuidSchema
});

export const verifyPaymentBodySchema = z.object({
  provider: z.enum(["razorpay"]),
  paymentId: uuidSchema,
  providerOrderId: z.string().min(4).max(128),
  providerPaymentId: z.string().min(4).max(128),
  signature: z.string().min(16).max(256)
});

export const webhookParamsSchema = z.object({
  provider: z.enum(["stripe", "razorpay"])
});

export type InitiatePaymentRequestBody = z.infer<typeof initiatePaymentBodySchema>;
export type InitiatePaymentBody = InitiatePaymentRequestBody & {
  readonly tenantId: string;
};
export type PaymentRetryRequestBody = z.infer<typeof paymentRetryBodySchema>;
export type PaymentRetryBody = PaymentRetryRequestBody & {
  readonly tenantId: string;
};
export type VerifyPaymentRequestBody = z.infer<typeof verifyPaymentBodySchema>;
export type VerifyPaymentBody = VerifyPaymentRequestBody & {
  readonly tenantId: string;
};
