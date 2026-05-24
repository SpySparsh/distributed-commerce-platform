import { z } from "zod";

export const emailTemplateSchema = z.enum([
  "order-confirmation",
  "payment-success",
  "order-delivered",
  "delivery-confirmation",
  "review-cta"
]);

export type EmailTemplate = z.infer<typeof emailTemplateSchema>;

export const sendEmailPayloadSchema = z.object({
  tenantId: z.uuid(),
  to: z.email(),
  template: emailTemplateSchema,
  variables: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().min(16),
  requestId: z.string().min(1).optional()
});

export type SendEmailPayload = z.infer<typeof sendEmailPayloadSchema>;

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}
