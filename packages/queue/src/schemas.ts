import { z } from "zod";
import { jobNames } from "./names.js";

const uuidSchema = z.uuid();
const emailSchema = z.email();

export const jobMetadataSchema = z.object({
  tenantId: uuidSchema,
  requestId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(16),
  createdAt: z.iso.datetime()
});

export type JobMetadata = z.infer<typeof jobMetadataSchema>;

export const sendEmailJobSchema = z.object({
  name: z.literal(jobNames.sendEmail),
  metadata: jobMetadataSchema,
  data: z.object({
    to: emailSchema,
    template: z.string().min(1),
    variables: z.record(z.string(), z.unknown()).default({})
  })
});

export const generateInvoiceJobSchema = z.object({
  name: z.literal(jobNames.generateInvoice),
  metadata: jobMetadataSchema,
  data: z.object({
    orderId: uuidSchema,
    userId: uuidSchema.optional()
  })
});

export const analyticsJobSchema = z.object({
  name: z.literal(jobNames.trackAnalytics),
  metadata: jobMetadataSchema,
  data: z.object({
    event: z.string().min(1),
    subjectId: z.string().min(1),
    properties: z.record(z.string(), z.unknown()).default({})
  })
});

export const paymentRetryJobSchema = z.object({
  name: z.literal(jobNames.retryPayment),
  metadata: jobMetadataSchema,
  data: z.object({
    paymentId: uuidSchema,
    orderId: uuidSchema,
    attempt: z.number().int().positive()
  })
});

export const stockSyncJobSchema = z.object({
  name: z.literal(jobNames.syncStock),
  metadata: jobMetadataSchema,
  data: z.object({
    variantId: uuidSchema,
    source: z.enum(["warehouse", "supplier", "manual"])
  })
});

export const releaseExpiredInventoryReservationsJobSchema = z.object({
  name: z.literal(jobNames.releaseExpiredInventoryReservations),
  metadata: jobMetadataSchema,
  data: z.object({
    tenantId: uuidSchema.optional(),
    batchSize: z.number().int().min(1).max(1_000).default(100)
  })
});

export const indexProductSearchDocumentJobSchema = z.object({
  name: z.literal(jobNames.indexProductSearchDocument),
  metadata: jobMetadataSchema,
  data: z.object({
    productId: uuidSchema
  })
});

export const deleteProductSearchDocumentJobSchema = z.object({
  name: z.literal(jobNames.deleteProductSearchDocument),
  metadata: jobMetadataSchema,
  data: z.object({
    productId: uuidSchema
  })
});

export const rebuildSearchIndexJobSchema = z.object({
  name: z.literal(jobNames.rebuildSearchIndex),
  metadata: jobMetadataSchema,
  data: z.object({
    target: z.enum(["products", "categories", "all"]).default("all"),
    batchSize: z.number().int().min(50).max(2_000).default(500)
  })
});

export const dispatchDomainEventJobSchema = z.object({
  name: z.literal(jobNames.dispatchDomainEvent),
  metadata: jobMetadataSchema,
  data: z.object({
    event: z.unknown()
  })
});

export const deadLetterJobSchema = z.object({
  name: z.literal(jobNames.deadLetter),
  metadata: jobMetadataSchema,
  data: z.object({
    originalQueue: z.string().min(1),
    originalJobName: z.string().min(1),
    originalJobId: z.string().min(1).optional(),
    reason: z.string().min(1),
    failedAt: z.iso.datetime(),
    payload: z.unknown()
  })
});

export const ecommerceJobSchema = z.discriminatedUnion("name", [
  sendEmailJobSchema,
  generateInvoiceJobSchema,
  analyticsJobSchema,
  paymentRetryJobSchema,
  stockSyncJobSchema,
  releaseExpiredInventoryReservationsJobSchema,
  indexProductSearchDocumentJobSchema,
  deleteProductSearchDocumentJobSchema,
  rebuildSearchIndexJobSchema,
  dispatchDomainEventJobSchema,
  deadLetterJobSchema
]);

export type SendEmailJob = z.infer<typeof sendEmailJobSchema>;
export type GenerateInvoiceJob = z.infer<typeof generateInvoiceJobSchema>;
export type AnalyticsJob = z.infer<typeof analyticsJobSchema>;
export type PaymentRetryJob = z.infer<typeof paymentRetryJobSchema>;
export type StockSyncJob = z.infer<typeof stockSyncJobSchema>;
export type ReleaseExpiredInventoryReservationsJob = z.infer<typeof releaseExpiredInventoryReservationsJobSchema>;
export type IndexProductSearchDocumentJob = z.infer<typeof indexProductSearchDocumentJobSchema>;
export type DeleteProductSearchDocumentJob = z.infer<typeof deleteProductSearchDocumentJobSchema>;
export type RebuildSearchIndexJob = z.infer<typeof rebuildSearchIndexJobSchema>;
export type DispatchDomainEventJob = z.infer<typeof dispatchDomainEventJobSchema>;
export type DeadLetterJob = z.infer<typeof deadLetterJobSchema>;
export type EcommerceJob = z.infer<typeof ecommerceJobSchema>;

export type WorkerJob = Exclude<EcommerceJob, DeadLetterJob>;
